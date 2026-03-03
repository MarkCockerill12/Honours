import { scanUrl } from "./security";
import {
  generateDNRRules,
  isAdOrTracker,
  recordBlockedRequest,
  initBlockStats,
} from "./adBlockEngine";

// Load a simple blocklist for demo purposes (actual free DB fetch)
let MALICIOUS_DOMAINS = new Set<string>();
let adBlockEnabled = true;
let lastError: { message: string; timestamp: number } | null = null;
let adBlockSetupStatus: "pending" | "success" | "error" = "pending";
let adBlockSetupError: string | null = null;

const updateBlocklist = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log("[Background] Updating blocklist from StevenBlack hosts...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(
      "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts",
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split("\n");

    const newDomains = new Set<string>();
    for (const line of lines) {
      if (line.startsWith("0.0.0.0")) {
        const domain = line.split(" ")[1];
        if (domain && domain !== "0.0.0.0") {
          newDomains.add(domain.trim());
        }
      }
    }

    if (newDomains.size === 0) {
      throw new Error("Blocklist is empty - this shouldn't happen!");
    }

    MALICIOUS_DOMAINS = newDomains;
    console.log(
      `[Background] Blocklist updated with ${MALICIOUS_DOMAINS.size} domains.`,
    );

    await chrome.storage.local.set({
      maliciousDomains: Array.from(MALICIOUS_DOMAINS),
      lastUpdate: Date.now(),
    });

    return { success: true };
  } catch (error: any) {
    const errorMsg =
      error.name === "AbortError"
        ? "Blocklist update timed out (30s)"
        : `Failed to update blocklist: ${error.message}`;
    console.error("[Background]", errorMsg, error);
    lastError = { message: errorMsg, timestamp: Date.now() };
    return { success: false, error: errorMsg };
  }
};

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

  // Load blocklist on start
  try {
    const result = await chrome.storage.local.get([
      "maliciousDomains",
      "lastUpdate",
      "adBlockEnabled",
    ]);
    const now = Date.now();
    const lastUpdate = result.lastUpdate as number | undefined;

    // Load ad block preference
    if (result.adBlockEnabled !== undefined) {
      adBlockEnabled = result.adBlockEnabled as boolean;
      console.log("[Background] Ad block enabled:", adBlockEnabled);
    }

    if (result.maliciousDomains && lastUpdate && now - lastUpdate < 86400000) {
      MALICIOUS_DOMAINS = new Set(result.maliciousDomains as string[]);
      console.log(
        `[Background] Loaded ${MALICIOUS_DOMAINS.size} domains from storage.`,
      );
    } else {
      console.log(
        "[Background] Blocklist outdated or not found, fetching new one...",
      );
      const updateResult = await updateBlocklist();
      if (!updateResult.success) {
        console.error(
          "[Background] Failed to fetch initial blocklist:",
          updateResult.error,
        );
        // Store error but continue - some ad blocking will still work via DNR
        await chrome.storage.local.set({
          blocklistError: updateResult.error,
          blocklistLastError: Date.now(),
        });
      }
    }
  } catch (error: any) {
    console.error("[Background] Error loading blocklist:", error);
    await chrome.storage.local.set({
      blocklistError: error.message,
      blocklistLastError: Date.now(),
    });
  }

  // Check periodically
  chrome.alarms.create("updateBlocklist", { periodInMinutes: 1440 });
  console.log("[Background] Scheduled daily blocklist updates");
});

// Setup declarative net request for efficient ad blocking
const setupDeclarativeNetRequest = async (): Promise<{
  success: boolean;
  error?: string;
}> => {
  console.log("[Background] Setting up declarativeNetRequest rules...");

  try {
    // Check if API is available
    if (!chrome.declarativeNetRequest) {
      throw new Error(
        "declarativeNetRequest API not available - check manifest permissions",
      );
    }

    // Get current rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map((rule) => rule.id);

    // Remove old rules
    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
      });
      console.log(`[Background] Removed ${existingRuleIds.length} old rules`);
    }

    // Generate new rules
    const rules = generateDNRRules();

    if (rules.length === 0) {
      console.warn(
        "[Background] No DNR rules generated - ad blocking may not work",
      );
      return { success: false, error: "No blocking rules generated" };
    }

    // Chrome has a limit of ~5000 dynamic rules, so we'll add them in batches
    const batchSize = 1000;
    let addedCount = 0;

    for (let i = 0; i < rules.length; i += batchSize) {
      const batch = rules.slice(i, i + batchSize);
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: batch,
        });
        addedCount += batch.length;
        console.log(
          `[Background] Added ${addedCount}/${rules.length} DNR rules`,
        );
      } catch (batchError: any) {
        console.error(
          `[Background] Failed to add batch ${i}-${i + batchSize}:`,
          batchError,
        );
        // Continue with other batches even if one fails
      }
    }

    if (addedCount === 0) {
      throw new Error(
        "Failed to add any DNR rules - ad blocking will not work",
      );
    }

    console.log(
      `[Background] Successfully added ${addedCount}/${rules.length} ad-blocking rules`,
    );
    return { success: true };
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateBlocklist") {
    console.log("[Background] Alarm triggered: updating blocklist");
    updateBlocklist()
      .then((result) => {
        if (!result.success) {
          console.error(
            "[Background] Scheduled blocklist update failed:",
            result.error,
          );
        }
      })
      .catch((error) => {
        console.error(
          "[Background] Unexpected error during blocklist update:",
          error,
        );
      });
  }
});

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
        "blocklistError",
      ]);
      return {
        success: true,
        setupStatus: status.adBlockSetupStatus || adBlockSetupStatus,
        setupError: status.adBlockSetupError || adBlockSetupError,
        blocklistError: status.blocklistError,
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
        const urlObj = new URL(request.url);
        if (MALICIOUS_DOMAINS.has(urlObj.hostname)) {
          return {
            isSafe: false,
            threatType: "malware",
            details: "Blacklisted Domain",
          };
        }
        return scanUrl(request.url);
      } catch (e) {
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
