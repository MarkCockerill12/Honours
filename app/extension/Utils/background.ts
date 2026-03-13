import { scanUrl, checkSafeBrowsing } from "./security";
import type { ProtectionState, SmartFilter } from "@/components/types";
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

let adBlockEnabled = false;
let protectionEnabled = false;
let isSyncing = false;
let lastError: { message: string; timestamp: number } | null = null;
let adBlockSetupStatus: "pending" | "success" | "error" = "pending";
let adBlockSetupError: string | null = null;
const allowedPdfs = new Map<number, Set<string>>(); // Tab-session specific allowlist

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

// Initialize or load from storage
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Background] Extension Installed Successfully");
  try {
    await initBlockStats();
    await syncAdBlockState();
  } catch (error: any) {
    console.error("[Background] Fatal error during initialization:", error);
  }
});

// Initial sync logic
const initializeBackground = async () => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await syncAdBlockState();
      console.log(`[Background] Initial sync completed. AdBlock: ${adBlockEnabled}`);
    }
  } catch (e) {
    console.error("[Background] Initial sync failed:", e);
  }
};
initializeBackground();

// Setup declarative net request for efficient ad blocking
const setupDeclarativeNetRequest = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    if (!chrome.declarativeNetRequest) throw new Error("DNR API unavailable.");
    const success = await setupDeclarativeNetRequestRules();
    return success ? { success: true } : { success: false, error: "DNR Setup failed." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Extremely Fast native PDF Blocker via Background Redirect
// We cannot rely purely on DNR because some PDFs are loaded as links, and we want a visual block overlay.
// MV3 allows chrome.webNavigation or chrome.tabs for this, but tabs.onUpdated is the most reliable for main frame PDFs.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!protectionEnabled || !adBlockEnabled) return;
  
  if (changeInfo.status === "loading" && tab.url) {
    const isPdf = tab.url.toLowerCase().split("?")[0].endsWith(".pdf");
    const isLocal = tab.url.startsWith("file://");
    const tabAllowed = allowedPdfs.get(tabId);
    const bypass = tab.url.includes("bypass=true") || (tabAllowed && tabAllowed.has(tab.url));

    if (isPdf && !bypass) {
      // Firefox's open-source pdf.js viewer DOES support content scripts inline, 
      // unlike Chrome/Edge's closed-source PDFium!
      if (self.navigator?.userAgent?.toLowerCase().includes("firefox")) {
         console.log("[Background] Firefox platform detected. Allowing native inline PDF shielding.");
         return; 
      }

      if (isLocal) {
        console.warn("[Background] Cannot scan local file:// PDFs safely.");
      }
      console.log(`[Background] PDF intercepted via tabs.onUpdated. Routing to Shield: ${tab.url}`);
      const warningUrl = chrome.runtime.getURL(`pdf-warning.html?url=${encodeURIComponent(tab.url)}`);
      chrome.tabs.update(tabId, { url: warningUrl });
      recordBlockedRequest("document", tab.url, "pdf" as any);
    }
  } else if (changeInfo.status === "complete" && tab.url) {
    const isPdf = tab.url.toLowerCase().split("?")[0].endsWith(".pdf");
    const tabAllowed = allowedPdfs.get(tabId);
    const bypass = tab.url.includes("bypass=true") || (tabAllowed && tabAllowed.has(tab.url));
    
    if (isPdf && bypass) {
      // Clear bypass after successful load so that refresh triggers the warning again
      allowedPdfs.get(tabId)?.delete(tab.url);
    }
  } else if (changeInfo.status === "loading" && tab.url) {
    const isPdf = tab.url.toLowerCase().split("?")[0].endsWith(".pdf");
    if (!isPdf) {
      allowedPdfs.delete(tabId);
    }
  }
});

const setupPdfRule = async (enabled: boolean) => {
  // DNR rule removed in favor of reliable tabs.onUpdated redirect which guarantees the warning page loads.
  try {
    const PDF_RULE_ID = 90000;
    if (chrome.declarativeNetRequest) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [PDF_RULE_ID] });
    }
  } catch (err) {}
};

// MV3-compatible: Use webRequest ONLY for observational stats tracking (non-blocking).
// Actual ad blocking is handled by declarativeNetRequest rules set up in setupDeclarativeNetRequest().
// In MV3, webRequest does NOT support the "blocking" option.
if (chrome.webRequest?.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!adBlockEnabled) return;

      const check = isAdOrTracker(details.url, details.initiator);
      if (check.isAd && check.category) {
        // Just track stats — the actual blocking is done by declarativeNetRequest
        console.log(
          `[Background] Tracked ${check.category} request:`,
          details.url.substring(0, 80),
        );
        recordBlockedRequest(details.type, details.url, check.category);
      }
      return undefined; // Fixed: Explicitly return undefined
    },
    { urls: ["<all_urls>"] },
    // NOTE: No "blocking" option — fully MV3 compatible
  );
  console.log(
    "[Background] Web request observer registered for stats tracking (MV3 compatible)",
  );
} else {
  console.warn(
    "[Background] webRequest API not available — stats tracking will rely on declarativeNetRequest only",
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

async function handleOtherActions(request: any) {
  switch (request.action) {
    case "GET_BLOCK_STATS": {
      try {
        const stats = await initBlockStats();
        return { success: true, stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case "TOGGLE_ADBLOCK": {
      // Background just initiates a sync; the popup already updated storage
      console.log("[Background] TOGGLE_ADBLOCK requested, initiating sync...");
      await syncAdBlockState();
      return { success: true, enabled: adBlockEnabled };
    }

    case "CLEAR_FILTERS":
    case "APPLY_FILTERS":
    case "CLEAR_TRANSLATIONS":
    case "SCAN_PAGE_LINKS": {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        if (request.action === "SCAN_PAGE_LINKS" && tabs[0].url?.toLowerCase().endsWith(".pdf")) {
          return { success: false, error: "Scanning is not supported for native PDF documents." };
        }
        try {
          return await chrome.tabs.sendMessage(tabs[0].id, request);
        } catch (e: any) {
          console.debug("[Background] Message failed (normal if receiver absent):", e.message);
          return { success: false, error: `Content script not ready: ${e.message}` };
        }
      }
      return { success: false, error: "No active tab found" };
    }

    case "TRANSLATE_TEXT": {
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

    case "CHECK_URL_REAL": {
      try {
        new URL(request.url);
        return scanUrl(request.url);
      } catch (e: any) {
        return { isSafe: true, threatType: "safe", details: `Invalid URL: ${e.message}` };
      }
    }

    case "CHECK_SAFE_BROWSING": {
      try {
        const storage = await chrome.storage.local.get(["safeBrowsingApiKey"]);
        const apiKey = (storage.safeBrowsingApiKey as string) || "";
        if (!apiKey) {
          return { success: false, error: "No Safe Browsing API key configured" };
        }
        const result = await checkSafeBrowsing(request.url as string, apiKey);
        return { success: true, ...result };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    case "SUMMARIZE_TEXT": {
      try {
        const storage = await chrome.storage.local.get(["geminiApiKey"]);
        // Use storage key if available, otherwise fallback to baked key from build process
        const apiKey = (storage.geminiApiKey as string) || (process.env as any).GEMINI_API_KEY || "";
        
        if (!apiKey) {
          return { success: false, error: "No Gemini API key configured. Add one in the extension settings." };
        }
        let contents: any[] = [];
        if (request.url && (request.url.toLowerCase().split("?")[0].endsWith(".pdf") || request.url.includes("application/pdf"))) {
          // Strip bypass params from URL before fetching
          const cleanUrl = request.url.split("?bypass=true")[0].split("&bypass=true")[0];
          const respPdf = await fetch(cleanUrl);
          const buffer = await respPdf.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const limit = Math.min(bytes.byteLength, 4 * 1024 * 1024); // Cap at 4MB
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < limit; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
          }
          const base64Pdf = btoa(binary);
          contents = [{
            parts: [
              { text: "Analyze and summarize this PDF document thoroughly. Provide 5-7 clear, direct, and informative bullet points covering the key findings, conclusions, and any technical details present. Do not truncate the summary." },
              { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
            ]
          }];
        } else {
          const text = (request.text || "").substring(0, 15000);
          contents = [{
            parts: [{ text: `Analyze and summarize this webpage content thoroughly. Provide 5-7 clear, direct, and informative bullet points. Do not be brief; capture the essential meaning and details. Keep the output comprehensive:\n\n${text}` }]
          }];
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 2000, temperature: 0.1 }
          }),
        });
        if (!resp.ok) {
          const errData = await resp.text();
          return { success: false, error: `Gemini API error (${resp.status}): ${errData.substring(0, 200)}` };
        }
        const data = await resp.json();
        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated.";
        return { success: true, summary };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    case "GET_PAGE_TEXT": {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        try {
          return await chrome.tabs.sendMessage(tabs[0].id, { action: "GET_PAGE_TEXT" });
        } catch (e: any) {
          return { success: false, error: `Content script not ready: ${e.message}` };
        }
      }
      return { success: false, error: "No active tab found" };
    }

    case "QUERY_TABS": {
      const tabs = await chrome.tabs.query(request.query || {});
      return { success: true, tabs };
    }

    case "SEND_MESSAGE": {
      const response = await chrome.tabs.sendMessage(request.tabId, request.message);
      return { success: true, response };
    }

    default:
      console.warn("[Background] Unknown action:", request.action);
      return { success: false, error: "Unknown action" };
  }
}

async function handleRequest(request: any, sender: chrome.runtime.MessageSender) {
  console.log("[Background] Action:", request.action, "from:", sender.url);

  // 1. Try AdBlock specific actions
  const adBlockResult = await handleAdBlockActions(request, sender).catch(e => ({ success: false, error: e.message }));
  if (adBlockResult && adBlockResult.success) return adBlockResult;

  // 2. Try remaining actions
  return handleOtherActions(request).catch(e => ({ success: false, error: e.message }));
}

// 1. Internal messages (Popup, Options, Content Scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true; // Keep channel open
});

// 2. External messages (Dev mode from localhost:3000)
if (chrome.runtime?.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener(
    (request, sender, sendResponse) => {
      // Only allow from localhost during development
      if (sender.url?.startsWith("http://localhost:3000")) {
        handleRequest(request, sender)
          .then(sendResponse)
          .catch((error) =>
            sendResponse({ success: false, error: error.message }),
          );
        return true;
      }
    },
  );
}

console.log("[Background] Background logic initialized.");
