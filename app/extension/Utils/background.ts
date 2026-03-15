import { scanUrl, checkSafeBrowsing } from "./security";
import type { ProtectionState } from "@/components/types";
import {
  setupDeclarativeNetRequestRules,
  isAdOrTracker,
  recordBlockedRequest,
  initBlockStats,
  clearDeclarativeNetRequestRules,
  getExceptionList,
  addException,
  removeException,
} from "./adBlockEngine";
import { isPdfUrl, hasBypassParam } from "@/lib/urlUtils";
import { DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@/lib/constants";

let adBlockEnabled = false;
let protectionEnabled = false;
let isSyncing = false;
let lastError: { message: string; timestamp: number } | null = null;
let adBlockSetupStatus: "pending" | "success" | "error" = "pending";
let adBlockSetupError: string | null = null;
const allowedPdfs = new Map<number, Set<string>>(); // Tab-session specific allowlist

// HOISTED HELPER FUNCTIONS
async function setupPdfRule(enabled: boolean) {
  try {
    const PDF_RULE_ID = 90000;
    if (chrome.declarativeNetRequest) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [PDF_RULE_ID] });
    }
  } catch (err) {}
}

const syncAdBlockState = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const res = await chrome.storage.local.get(["protectionState"]);
    const state = res.protectionState as ProtectionState | undefined;
    
    // Master logic: Global active state
    protectionEnabled = state?.isActive ?? false;
    const shouldBeEnabled = protectionEnabled && (state?.adblockEnabled ?? false);
    
    console.log(`[Background] Sync check: protectionEnabled=${protectionEnabled}, shouldBeEnabled=${shouldBeEnabled}, currentAdBlockEnabled=${adBlockEnabled}`);

    await setupPdfRule(protectionEnabled);

    if (shouldBeEnabled !== adBlockEnabled || !adBlockSetupStatus || adBlockSetupStatus === "pending") {
      adBlockEnabled = shouldBeEnabled;
      console.log(`[Background] Applying AdBlock state: ${adBlockEnabled}`);
      
      if (adBlockEnabled) {
        const success = await setupDeclarativeNetRequestRules();
        adBlockSetupStatus = success ? "success" : "error";
        if (!success) adBlockSetupError = "DNR Setup failed.";
      } else {
        await clearDeclarativeNetRequestRules();
        adBlockSetupStatus = "success";
        adBlockSetupError = null;
      }
      
      await chrome.storage.local.set({ adBlockSetupStatus, adBlockSetupError });
    }
  } catch (e: any) {
    console.error("[Background] Sync failed:", e);
    adBlockSetupStatus = "error";
    adBlockSetupError = e.message;
  } finally {
    isSyncing = false;
  }
};

// React to ANY storage change immediately
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.protectionState || changes.adBlockEnabled)) {
    syncAdBlockState();
  }
});

// Re-inject content script into existing tabs to avoid "Receiving end does not exist"
const injectContentScripts = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (!tab.id || tab.url?.startsWith("chrome://")) continue;
      try {
        // 1. PING: Check if script is already alive
        const isAlive = await new Promise<boolean>((resolve) => {
          chrome.tabs.sendMessage(tab.id!, { action: "PING" }, (resp) => {
            if (chrome.runtime.lastError || !resp?.pong) resolve(false);
            else resolve(true);
          });
          setTimeout(() => resolve(false), 200); 
        });

        if (isAlive) {
          console.log(`[Background] Content script already active in tab ${tab.id}, skipping re-injection.`);
          continue;
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ["content-script.js"],
        });
        console.log(`[Background] Re-injected content script into tab ${tab.id}`);
      } catch (err: any) {
        console.debug(`[Background] Could not inject into tab ${tab.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error("[Background] Content script re-injection failed:", err);
  }
};

// Initial sync logic
const initializeBackground = async () => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await syncAdBlockState();
      console.log(`[Background] Initial sync completed. AdBlock: ${adBlockEnabled}`);
      
      // Always re-inject on startup to ensure persistence across dev reloads
      await injectContentScripts();
    }
  } catch (e) {
    console.error("[Background] Initial sync failed:", e);
  }
};

// Initialize or load from storage
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[Background] Extension Installed/Updated:", details.reason);
  try {
    // SEED STORAGE: Ensure defaults exist so content-script works on day one
    const res = await chrome.storage.local.get(["protectionState", "filters"]);
    if (!res.protectionState) {
      console.log("[Background] Seeding default protection state...");
      await chrome.storage.local.get({ protectionState: DEFAULT_PROTECTION_STATE });
    }
    if (!res.filters) {
      console.log("[Background] Seeding default filters...");
      await chrome.storage.local.get({ filters: DEFAULT_FILTERS });
    }

    await initBlockStats();
    await syncAdBlockState();
    
    // Always re-inject during development or on update to ensure bridges work
    await injectContentScripts();
  } catch (error: any) {
    console.error("[Background] Fatal error during initialization:", error);
  }
});

initializeBackground();

// Extremely Fast native PDF Blocker via Background Redirect
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!protectionEnabled || !adBlockEnabled) return;
  
  if (changeInfo.status === "loading" && tab.url) {
    const isPdf = isPdfUrl(tab.url);
    const isLocal = tab.url.startsWith("file://");
    const tabAllowed = allowedPdfs.get(tabId);
    const bypass = hasBypassParam(tab.url) || tabAllowed?.has(tab.url);

    if (isPdf && !bypass) {
      if (self.navigator?.userAgent?.toLowerCase().includes("firefox")) {
         return; 
      }
      console.log(`[Background] PDF intercepted via tabs.onUpdated. Routing to Shield: ${tab.url}`);
      const warningUrl = chrome.runtime.getURL(`pdf-warning.html?url=${encodeURIComponent(tab.url)}`);
      chrome.tabs.update(tabId, { url: warningUrl });
      recordBlockedRequest("document", tab.url, "pdf" as any);
    }
  } else if (changeInfo.status === "complete" && tab.url) {
    if (!isPdfUrl(tab.url)) {
      allowedPdfs.delete(tabId);
    }
  }
});

// MV3-compatible: Use webRequest ONLY for observational stats tracking (non-blocking).
if (chrome.webRequest?.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!adBlockEnabled) return;

      const check = isAdOrTracker(details.url, details.initiator);
      if (check.isAd && check.category) {
        recordBlockedRequest(details.type, details.url, check.category);
      }
      return undefined;
    },
    { urls: ["<all_urls>"] },
  );
}

// ------------------------------------------------------------------
// MESSAGE HANDLING HUB
// ------------------------------------------------------------------

async function handleAdBlockActions(request: any, sender: chrome.runtime.MessageSender) {
  switch (request.action) {
    case "GET_ADBLOCK_STATUS": {
      const status = await chrome.storage.local.get(["adBlockSetupStatus", "adBlockSetupError"]);
      return {
        success: true,
        setupStatus: status.adBlockSetupStatus || adBlockSetupStatus,
        setupError: status.adBlockSetupError || adBlockSetupError,
        enabled: adBlockEnabled,
        lastError
      };
    }
    case "GET_EXCEPTIONS":
      return { success: true, exceptions: await getExceptionList() };
    case "ADD_EXCEPTION":
       return { success: true, exceptions: await addException(request.domain) };
    case "REMOVE_EXCEPTION":
       return { success: true, exceptions: await removeException(request.domain) };
    case "ALLOW_PDF":
      if (request.url) {
        if (sender.tab?.id) {
          if (!allowedPdfs.has(sender.tab.id)) {
            allowedPdfs.set(sender.tab.id, new Set());
          }
          allowedPdfs.get(sender.tab.id)!.add(request.url);
        }
        return { success: true };
      }
      return { success: false, error: "No URL provided" };
    default:
      return null;
  }
}

async function handleContentActions(request: any) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) return { success: false, error: "No active tab found" };

  try {
    return await chrome.tabs.sendMessage(tabs[0].id, request);
  } catch (e: any) {
    return { success: false, error: `Content script not ready: ${e.message}` };
  }
}

async function handleTranslateAction(request: any) {
  const texts = Array.isArray(request.text) ? request.text : [request.text];
  const results: string[] = [];
  const BATCH_SIZE = 5;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (text: string) => {
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${request.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(translateUrl);
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].filter((segment: any) => segment?.[0]).map((segment: any) => segment[0]).join("");
      }
      return text;
    });
    results.push(...(await Promise.all(batchPromises)));
  }
  return { success: true, translatedTexts: results };
}

async function handleSummarizeAction(request: any) {
  try {
    const storage = await chrome.storage.local.get(["geminiApiKey"]);
    const apiKey = (storage.geminiApiKey as string) || process.env.GEMINI_API_KEY || "";
    if (!apiKey) return { success: false, error: "No Gemini API key configured." };
    
    let contents: any[] = [];
    if (request.url && isPdfUrl(request.url)) {
      const cleanUrl = request.url.split("?bypass=true")[0].split("&bypass=true")[0];
      const respPdf = await fetch(cleanUrl);
      const buffer = await respPdf.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const limit = Math.min(bytes.byteLength, 4 * 1024 * 1024);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < limit; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += Array.from(chunk).map(b => String.fromCharCode(b)).join("");
      }
      const base64Pdf = btoa(binary);
      contents = [{
        parts: [
          { text: "Analyze and summarize this PDF document thoroughly." },
          { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
        ]
      }];
    } else {
      const text = (request.text || "").substring(0, 15000);
      contents = [{
        parts: [{ text: `Summarize this webpage content:\n\n${text}` }]
      }];
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 2500, temperature: 0.1 } }),
    });
    
    if (!resp.ok) return { success: false, error: `Gemini API error (${resp.status})` };
    const data = await resp.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";
    return { success: true, summary };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function handleOtherActions(request: any) {
  switch (request.action) {
    case "GET_BLOCK_STATS": {
      const stats = await initBlockStats();
      return { success: true, stats };
    }
    case "TOGGLE_ADBLOCK": {
      await syncAdBlockState();
      return { success: true, enabled: adBlockEnabled };
    }
    case "CLEAR_FILTERS":
    case "APPLY_FILTERS":
    case "CLEAR_TRANSLATIONS":
    case "SCAN_PAGE_LINKS":
    case "GET_PAGE_TEXT":
      return handleContentActions(request);
    case "TRANSLATE_TEXT":
      return handleTranslateAction(request);
    case "CHECK_URL_REAL": 
      return scanUrl(request.url);
    case "CHECK_SAFE_BROWSING": {
      const storage = await chrome.storage.local.get(["safeBrowsingApiKey"]);
      const apiKey = (storage.safeBrowsingApiKey as string) || "";
      if (!apiKey) return { success: false, error: "No API key" };
      const result = await checkSafeBrowsing(request.url as string, apiKey);
      return { success: true, ...result };
    }
    case "SUMMARIZE_TEXT":
      return handleSummarizeAction(request);
    case "QUERY_TABS": {
      const tabs = await chrome.tabs.query(request.query || {});
      return { success: true, tabs };
    }
    case "SEND_MESSAGE": {
      const response = await chrome.tabs.sendMessage(request.tabId, request.message);
      return { success: true, response };
    }
    default:
      return { success: false, error: "Unknown action" };
  }
}

async function handleRequest(request: any, sender: chrome.runtime.MessageSender) {
  const adBlockResult = await handleAdBlockActions(request, sender).catch(e => ({ success: false, error: e.message }));
  if (adBlockResult !== null) return adBlockResult;
  return handleOtherActions(request).catch(e => ({ success: false, error: e.message }));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sender).then(sendResponse).catch((error) => sendResponse({ success: false, error: error.message }));
  return true; 
});

if (chrome.runtime?.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (sender.url?.startsWith("http://localhost:3000")) {
      handleRequest(request, sender).then(sendResponse).catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
}

console.log("[Background] Background initialized.");
