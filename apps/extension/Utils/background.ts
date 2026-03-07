import { scanUrl } from "./security";
import {
  setupDeclarativeNetRequestRules,
  isAdOrTracker,
  recordBlockedRequest,
  initBlockStats,
} from "./adBlockEngine";

let adBlockEnabled = true;
let lastError: { message: string; timestamp: number } | null = null;
let adBlockSetupStatus: "pending" | "success" | "error" = "pending";
let adBlockSetupError: string | null = null;

// Initialize or load from storage
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Background] Extension Installed Successfully");

  try {
    // Initialize ad block stats
    await initBlockStats();
    console.log("[Background] Block stats initialized");

    // Setup declarative net request rules for ad blocking
    const dnrResult = await setupDeclarativeNetRequest();
    if (dnrResult.success) {
      adBlockSetupStatus = "success";
      await chrome.storage.local.set({
        adBlockSetupStatus: "success",
        adBlockSetupError: null,
      });
      console.log("[Background] Ad blocking setup completed successfully");
    } else {
      console.error("[Background] DNR setup failed:", dnrResult.error);
      adBlockSetupStatus = "error";
      adBlockSetupError = dnrResult.error || "Unknown error";
      // Store error for UI to display
      await chrome.storage.local.set({
        adBlockSetupStatus: "error",
        adBlockSetupError: dnrResult.error,
      });
    }
  } catch (error: any) {
    console.error("[Background] Fatal error during initialization:", error);
    adBlockSetupStatus = "error";
    adBlockSetupError = `Initialization failed: ${error.message}`;
    await chrome.storage.local.set({
      adBlockSetupStatus: "error",
      adBlockSetupError: error.message,
    });
  }

  // Load preferences on start
  try {
    const result = await chrome.storage.local.get([
      "adBlockEnabled",
    ]);

    // Load ad block preference
    if (result.adBlockEnabled !== undefined) {
      adBlockEnabled = result.adBlockEnabled as boolean;
      console.log("[Background] Ad block enabled:", adBlockEnabled);
    }
  } catch (error: any) {
    console.error("[Background] Error loading preferences:", error);
  }
});

// Setup declarative net request for efficient ad blocking
const setupDeclarativeNetRequest = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  console.log("[Background] Setting up declarativeNetRequest rules via Ghostery package...");

  try {
    // Check if API is available
    if (!chrome.declarativeNetRequest) {
      throw new Error(
        "declarativeNetRequest API not available - check manifest permissions",
      );
    }

    const success = await setupDeclarativeNetRequestRules();
    
    if (success) {
      console.log(
        `[Background] Successfully engaged ghostery DNR rules setup.`,
      );
      return { success: true };
    } else {
      throw new Error("Failed to engage ghostery DNR setup.");
    }
  } catch (error: any) {
    const errorMsg = `DNR setup failed: ${error.message}`;
    console.error("[Background]", errorMsg, error);
    lastError = { message: errorMsg, timestamp: Date.now() };
    return { success: false, error: errorMsg };
  }
};

// MV3-compatible: Use webRequest ONLY for observational stats tracking (non-blocking).
// Actual ad blocking is handled by declarativeNetRequest rules set up in setupDeclarativeNetRequest().
// In MV3, webRequest does NOT support the "blocking" option.
if (chrome.webRequest?.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!adBlockEnabled) return;

      const check = isAdOrTracker(details.url);
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

/**
 * Shared message handler for both internal and external (dev) requests
 */
async function handleRequest(
  request: any,
  sender: chrome.runtime.MessageSender,
) {
  console.log(
    "[Background] Handling action:",
    request.action,
    "from:",
    sender.url,
  );

  switch (request.action) {
    case "GET_ADBLOCK_STATUS": {
      const status = await chrome.storage.local.get([
        "adBlockSetupStatus",
        "adBlockSetupError",
      ]);
      return {
        success: true,
        setupStatus: status.adBlockSetupStatus || adBlockSetupStatus,
        setupError: status.adBlockSetupError || adBlockSetupError,
        enabled: adBlockEnabled,
        lastError: lastError,
      };
    }

    case "GET_BLOCK_STATS": {
      try {
        const stats = await initBlockStats();
        return { success: true, stats };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    case "TOGGLE_ADBLOCK": {
      adBlockEnabled = request.enabled;
      await chrome.storage.local.set({ adBlockEnabled });
      return { success: true, enabled: adBlockEnabled };
    }

    case "TRANSLATE_TEXT": {
      const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${request.targetLang}&dt=t&q=${encodeURIComponent(request.text)}`;
      const res = await fetch(translateUrl);
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedText = data[0]
          .map((segment: any) => segment[0])
          .join("");
        return { success: true, translatedText };
      }
      throw new Error("Invalid translation response");
    }

    case "CHECK_URL_REAL": {
      try {
        new URL(request.url); // Validate URL structure
        return scanUrl(request.url);
      } catch (e: any) {
        console.warn("[Background] Invalid URL provided to CHECK_URL_REAL:", e.message);
        return { isSafe: true, threatType: "safe", details: "Invalid URL" };
      }
    }

    case "QUERY_TABS": {
      return new Promise((resolve) => {
        chrome.tabs.query(request.query || {}, (tabs) =>
          resolve({ success: true, tabs }),
        );
      });
    }

    case "SEND_MESSAGE": {
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(
          request.tabId,
          request.message,
          (response: any) => resolve({ success: true, response }),
        );
      });
    }

    default:
      console.warn("[Background] Unknown action:", request.action);
      return { success: false, error: "Unknown action" };
  }
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

console.log(
  "[Background] Background script initialized and ready (Dev Support Active)",
);

console.log("[Background] Background script initialized and ready");
