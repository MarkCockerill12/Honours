import { scanUrl, checkSafeBrowsing } from "./security";
import type { ProtectionState, SmartFilter } from "../../../packages/ui/types";
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
let isSyncing = false;
let lastError: { message: string; timestamp: number } | null = null;
let adBlockSetupStatus: "pending" | "success" | "error" = "pending";
let adBlockSetupError: string | null = null;

const syncAdBlockState = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const res = await chrome.storage.local.get(["protectionState"]);
    const state = res.protectionState as ProtectionState | undefined;
    
    // Master logic: Both global active state AND adblock toggle must be on
    const shouldBeEnabled = (state?.isActive ?? false) && (state?.adblockEnabled ?? false);
    
    console.log(`[Background] Sync check: shouldBeEnabled=${shouldBeEnabled}, currentAdBlockEnabled=${adBlockEnabled}`);

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

// PDF SCANNING LOGIC
// Since content scripts can't run in the native PDF viewer, we intercept PDF loads
// and scan them in the background.
if (chrome.webRequest?.onHeadersReceived) {
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      // Only check if either AdBlock or Content Filters are active
      if (!adBlockEnabled) {
        // Can't use await here (webRequest callback is sync), so just return
        // PDF scan for content filters is handled below asynchronously
        return;
      }
      if (details.type !== "main_frame" && details.type !== "sub_frame") return;

      const contentType = details.responseHeaders?.find(h => h.name.toLowerCase() === "content-type")?.value || "";
      if (contentType.toLowerCase().includes("application/pdf") || details.url.toLowerCase().endsWith(".pdf")) {
        // Skip scanning if bypass is present
        if (details.url.includes("bypass=true")) return undefined;
        
        console.log("[Background] PDF detected, starting content scan:", details.url);
        scanPdfAndHandle(details.url, details.tabId);
      }
      return undefined;
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
  );
}

async function scanPdfAndHandle(url: string, tabId: number) {
  try {
    const res = await chrome.storage.local.get(["filters"]);
    const filters = (res.filters as SmartFilter[]) || [];
    const activeFilters = filters.filter(f => f.enabled);
    if (activeFilters.length === 0) return;

    const response = await fetch(url, { method: "GET" }).catch(() => null);
    if (!response) return;
    
    const buffer = await response.arrayBuffer();
    // PDFs are binary, but many text strings remain literal in many encoders
    const text = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 1024 * 1024))); 
    const lowerText = text.toLowerCase();

    const matched = activeFilters.filter(f => {
      const term = f.blockTerm.toLowerCase();
      if (lowerText.includes(term)) {
        if (f.exceptWhen && lowerText.includes(f.exceptWhen.toLowerCase())) return false;
        return true;
      }
      return false;
    });

    if (matched.length > 0) {
      console.warn(`[Background] PDF contains blocked terms: ${matched.map(m => m.blockTerm).join(", ")}`);
      
      const warningUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(url)}&terms=${encodeURIComponent(matched.map(m => m.blockTerm).join(", "))}`);
      chrome.tabs.update(tabId, { url: warningUrl });
      recordBlockedRequest("document", url, "pdf" as any);
    }
  } catch (err) {
    console.error("[Background] PDF Scan failed:", err);
  }
}



// ------------------------------------------------------------------
// MESSAGE HANDLING HUB
// ------------------------------------------------------------------

async function handleAdBlockActions(request: any) {
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
        try {
          return await chrome.tabs.sendMessage(tabs[0].id, request);
        } catch (e: any) {
          return { success: false, error: `Content script not ready or error: ${e.message}` };
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
        const apiKey = (process.env.SAFE_BROWSING_API_KEY as string) || (storage.safeBrowsingApiKey as string) || "";
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
        const apiKey = (process.env.GEMINI_API_KEY as string) || (storage.geminiApiKey as string) || "";
        if (!apiKey) {
          return { success: false, error: "No Gemini API key configured. Add one in the extension settings." };
        }
        const text = (request.text || "").substring(0, 12000);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `Summarize this webpage content in 3-5 concise bullet points. Be direct and informative:\n\n${text}` }]
            }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.3 }
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
  const adBlockResult = await handleAdBlockActions(request).catch(e => ({ success: false, error: e.message }));
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
