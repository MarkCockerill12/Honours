import { scanUrl, checkSafeBrowsing } from "./security";
import type { ProtectionState } from "@privacy-shield/core";
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
import { isPdfUrl, hasBypassParam } from "@privacy-shield/core";
import { DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@privacy-shield/core";

let adBlockEnabled = false;
let protectionEnabled = false;
let vpnEnabled = false;
let isSyncing = false;
let lastError: { message: string; timestamp: number } | null = null;
let adBlockSetupStatus: "pending" | "success" | "error" = "pending";
let adBlockSetupError: string | null = null;
const allowedPdfs = new Map<number, Set<string>>(); // Tab-session specific allowlist

// HOISTED HELPER FUNCTIONS
function deobfuscateGroqKey(): string {
  try {
    const cipher = process.env.GROQ_CIPHER || '';
    const nonce = process.env.GROQ_NONCE || '';
    if (!cipher || !nonce) return '';
    const c = atob(cipher);
    const n = atob(nonce);
    return Array.from(c).map((ch, i) => 
      String.fromCharCode(ch.charCodeAt(0) ^ n.charCodeAt(i))
    ).join('');
  } catch {
    return '';
  }
}

async function setupPdfRule(_enabled: boolean) {
  try {
    const PDF_RULE_ID = 90000;
    if (chrome.declarativeNetRequest) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [PDF_RULE_ID],
      });
    }
  } catch (error) {
    console.warn("[Background] PDF rule cleanup failed:", (error as Error).message);
  }
}

const syncAdBlockState = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const res = await chrome.storage.local.get(["protectionState"]);
    const state = res.protectionState as ProtectionState | undefined;

    // Master logic: Global active state
    protectionEnabled = state?.isActive ?? false;
    const shouldBeEnabled =
      protectionEnabled && (state?.adblockEnabled ?? false);

    console.log(
      `[Background] Sync check: protectionEnabled=${protectionEnabled}, shouldBeEnabled=${shouldBeEnabled}, currentAdBlockEnabled=${adBlockEnabled}`,
    );

    await setupPdfRule(protectionEnabled);

    if (
      shouldBeEnabled !== adBlockEnabled ||
      !adBlockSetupStatus ||
      adBlockSetupStatus === "pending"
    ) {
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
    adBlockSetupError = (e as Error).message || String(e);
  } finally {
    isSyncing = false;
  }
};

const syncVpnProxy = async () => {
  try {
    const res = await chrome.storage.local.get(["protectionState", "vpnConfig"]);
    const state = res.protectionState as ProtectionState | undefined;
    const vpnConfig = res.vpnConfig as { publicIp?: string } | undefined;

    const shouldBeVpnEnabled = (state?.isActive ?? false) && (state?.vpnEnabled ?? false);

    if (shouldBeVpnEnabled !== vpnEnabled) {
      vpnEnabled = shouldBeVpnEnabled;
      
      if (chrome.proxy) {
        if (vpnEnabled && vpnConfig?.publicIp) {
          console.log(`[Background] Enabling SOCKS5 proxy: ${vpnConfig.publicIp}:1080`);
          const config: chrome.proxy.ProxyConfig = {
            mode: "fixed_servers",
            rules: {
              singleProxy: {
                scheme: "socks5" as const,
                host: vpnConfig.publicIp,
                port: 1080
              },
              bypassList: ["localhost", "127.0.0.1", "*.local"]
            }
          };
          chrome.proxy.settings.set({ value: config, scope: "regular" });
        } else {
          console.log("[Background] Disabling proxy.");
          chrome.proxy.settings.clear({ scope: "regular" });
        }
      }
    }
  } catch (e) {
    console.error("[Background] VPN Proxy sync failed:", e);
  }
};

// React to ANY storage change immediately
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.protectionState || changes.adBlockEnabled) {
      syncAdBlockState();
    }
    if (changes.protectionState || changes.vpnConfig) {
      syncVpnProxy();
    }
  }
});

// Re-inject content script into existing tabs to avoid "Receiving end does not exist"
const injectContentScripts = async () => {
  try {
    const tabs = await chrome.tabs.query({
      url: ["http://*/*", "https://*/*"],
    });
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
          console.log(
            `[Background] Content script already active in tab ${tab.id}, skipping re-injection.`,
          );
          continue;
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ["content-script.js"],
        });
        console.log(
          `[Background] Re-injected content script into tab ${tab.id}`,
        );
      } catch (err: any) {
        console.debug(
          `[Background] Could not inject into tab ${tab.id}: ${(err as Error).message || String(err)}`,
        );
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
      console.log(
        `[Background] Initial sync completed. AdBlock: ${adBlockEnabled}`,
      );

      // Always re-inject on startup to ensure persistence across dev reloads
      await injectContentScripts();
      
      // Initialize VPN proxy state
      await syncVpnProxy();
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
      await chrome.storage.local.set({
        protectionState: DEFAULT_PROTECTION_STATE,
      });
    }
    if (!res.filters) {
      console.log("[Background] Seeding default filters...");
      await chrome.storage.local.set({ filters: DEFAULT_FILTERS });
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
    const _isLocal = tab.url.startsWith("file://");
    const tabAllowed = allowedPdfs.get(tabId);
    const bypass = hasBypassParam(tab.url) || tabAllowed?.has(tab.url);

    if (isPdf && !bypass) {
      if (self.navigator?.userAgent?.toLowerCase().includes("firefox")) {
        return;
      }
      console.log(
        `[Background] PDF intercepted via tabs.onUpdated. Routing to Shield: ${tab.url}`,
      );
      const warningUrl = chrome.runtime.getURL(
        `pdf-warning.html?url=${encodeURIComponent(tab.url)}`,
      );
      chrome.tabs.update(tabId, { url: warningUrl });
      recordBlockedRequest("document", tab.url, "pdf" as any);
    }
  } else if (changeInfo.status === "complete" && tab.url) {
    if (!isPdfUrl(tab.url)) {
      allowedPdfs.delete(tabId);
    }
  }
});

// A1: Fix allowedPdfs memory leak - clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (allowedPdfs.has(tabId)) {
    console.debug(
      `[Background] Cleaning up allowedPdfs for closed tab ${tabId}`,
    );
    allowedPdfs.delete(tabId);
  }
});

// A1: Periodic sweep for any stragglers (every 30 mins)
chrome.alarms.create("pdf-cleanup-sweep", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pdf-cleanup-sweep") {
    try {
      const tabs = await chrome.tabs.query({});
      const activeTabIds = new Set(
        tabs.map((t) => t.id).filter((id): id is number => id !== undefined),
      );
      for (const tabId of allowedPdfs.keys()) {
        if (!activeTabIds.has(tabId)) {
          allowedPdfs.delete(tabId);
        }
      }
    } catch (_error) {
      console.error("[Background] PDF cleanup sweep failed:", _error);
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

async function handleAdBlockActions(
  request: any,
  sender: chrome.runtime.MessageSender,
) {
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
        lastError,
      };
    }
    case "GET_EXCEPTIONS":
      return { success: true, exceptions: await getExceptionList() };
    case "ADD_EXCEPTION":
      return { success: true, exceptions: await addException(request.domain) };
    case "REMOVE_EXCEPTION":
      return {
        success: true,
        exceptions: await removeException(request.domain),
      };
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
  } catch (error: unknown) {
    return { success: false, error: `Content script not ready: ${(error as Error).message || String(error)}` };
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
        return data[0]
          .filter((segment: any) => segment?.[0])
          .map((segment: any) => segment[0])
          .join("");
      }
      return text;
    });
    results.push(...(await Promise.all(batchPromises)));
  }
  return { success: true, translatedTexts: results };
}

async function handleSummarizeAction(request: any) {
  try {
    const storage = await chrome.storage.local.get(["groqApiKey"]);
    const apiKey =
      (storage.groqApiKey as string) || deobfuscateGroqKey() || "";
    if (!apiKey)
      return { success: false, error: "No Groq API key configured." };

    let contentToSummarize = "";
    if (request.url && isPdfUrl(request.url)) {
      // For PDFs on Groq, we'd ideally need text extraction.
      // For now, if text is provided via request.text, use it; otherwise, warn.
      contentToSummarize =
        request.text ||
        "PDF content could not be extracted for Groq summarization.";
    } else {
      contentToSummarize = (request.text || "").substring(0, 15000);
    }

    if (!contentToSummarize || contentToSummarize.length < 50) {
      return { success: false, error: "Not enough content to summarize." };
    }

    const endpoint = `https://api.groq.com/openai/v1/chat/completions`;
    const body = {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a professional assistant that provides extremely concise, high-impact summaries. Use bullet points for key takeaways. Avoid any introductory or closing remarks. Be brief.",
        },
        {
          role: "user",
          content: `Summarize the following content concisely:\n\n${contentToSummarize}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      return {
        success: false,
        error: `Groq API error (${resp.status}): ${errorData.error?.message || "Unknown error"}`,
      };
    }
    const data = await resp.json();
    const summary =
      data.choices?.[0]?.message?.content || "No summary generated.";
    return { success: true, summary };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || String(error) };
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
      const response = await chrome.tabs.sendMessage(
        request.tabId,
        request.message,
      );
      return { success: true, response };
    }
    default:
      return { success: false, error: "Unknown action" };
  }
}

async function handleRequest(
  request: any,
  sender: chrome.runtime.MessageSender,
) {
  const adBlockResult = await handleAdBlockActions(request, sender).catch(
    (error: Error) => ({ success: false, error: error.message }),
  );
  if (adBlockResult !== null) return adBlockResult;
  return handleOtherActions(request).catch((error: Error) => ({
    success: false,
    error: error.message,
  }));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRequest(request, sender)
    .then(sendResponse)
    .catch((error: Error) => sendResponse({ success: false, error: error.message }));
  return true;
});

if (chrome.runtime?.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener(
    (request, sender, sendResponse) => {
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

console.log("[Background] Background initialized.");
