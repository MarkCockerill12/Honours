// Comprehensive Ad Blocking Engine for Chrome Extension
// Multi-layer approach: declarativeNetRequest + Element Hiding + YouTube Specific
import { WebExtensionBlocker } from "@ghostery/adblocker-webextension";
import { Request } from "@ghostery/adblocker";
import type { ProtectionState, BlockStats } from "@/components/types";
import { AD_SELECTORS, COMPREHENSIVE_DOMAINS, computeBlockDelta } from "@/lib/constants";
import { isPdfUrl, hasBypassParam } from "@/lib/urlUtils";

let blocker: WebExtensionBlocker | null = null;
let engineReady = false;

export const initAdBlocker = async () => {
  if (blocker) return blocker;
  try {
    console.log("[AdBlock] Initializing Ghostery engine...");
    blocker = await WebExtensionBlocker.fromPrebuiltAdsAndTracking(fetch);
    engineReady = true;
    console.log("[AdBlock] Ghostery engine initialized!");
    return blocker;
  } catch (e) {
    console.warn("[AdBlock] Failed to initialize Ghostery engine, using fallback:", e);
    return null;
  }
};

export type { BlockStats };

// Average sizes for different request types (in bytes)
const AVG_SIZES = {
  image: 50000, // 50KB
  script: 75000, // 75KB
  stylesheet: 25000, // 25KB
  video: 2000000, // 2MB for ad videos
  xmlhttprequest: 10000, // 10KB
  media: 500000, // 500KB
  other: 20000, // 20KB
  document: 100000, // 100KB for PDF/document
};

// Detect if chrome.storage.local is available
const isChromeStorageAvailable = (): boolean => {
  try {
    return typeof chrome !== "undefined" && chrome.storage !== undefined && chrome.storage.local !== undefined;
  } catch {
    return false;
  }
};

const STATS_STORAGE_KEY = "blockStats";

const createEmptyStats = (): BlockStats => ({
  totalBlocked: 0,
  bandwidthSaved: 0,
  timeSaved: 0,
  moneySaved: 0,
  blockedByType: {
    ads: 0,
    trackers: 0,
    analytics: 0,
    social: 0,
    youtube: 0,
    pdf: 0,
  },
  lastUpdated: Date.now(),
});

const getStatsFromLocalStorage = (): BlockStats => {
  try {
    if (typeof localStorage === "undefined") return createEmptyStats();
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BlockStats;
      if (!parsed.blockedByType.pdf) parsed.blockedByType.pdf = 0;
      return parsed;
    }
  } catch (err) {
    console.debug("[AdBlock] LocalStorage stats recovery failed:", err);
  }
  return createEmptyStats();
};

const saveStatsToLocalStorage = (stats: BlockStats): void => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    }
  } catch (err) {
    console.debug("[AdBlock] LocalStorage stats save failed:", err);
  }
};

export const initBlockStats = async (): Promise<BlockStats> => {
  if (!isChromeStorageAvailable()) {
    return getStatsFromLocalStorage();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(["blockStats"], (result) => {
      if (chrome.runtime.lastError) {
        console.warn("[AdBlock] chrome.storage error, using fallback:", chrome.runtime.lastError.message);
        resolve(getStatsFromLocalStorage());
        return;
      }
      if (result.blockStats) {
        const storedStats = result.blockStats as BlockStats;
        if (!storedStats.blockedByType.pdf) storedStats.blockedByType.pdf = 0;
        resolve(storedStats);
      } else {
        const newStats = createEmptyStats();
        chrome.storage.local.set({ blockStats: newStats });
        resolve(newStats);
      }
    });
  });
};

let memoryStats: BlockStats | null = null;
let saveTimeout: any = null;

export const recordBlockedRequest = async (
  resourceType: string,
  url: string,
  category: "ads" | "trackers" | "analytics" | "social" | "youtube",
) => {
  memoryStats ??= await initBlockStats();

  const size = AVG_SIZES[resourceType as keyof typeof AVG_SIZES] || AVG_SIZES.other;

  memoryStats.totalBlocked++;
  memoryStats.bandwidthSaved += size;
  memoryStats.blockedByType[category]++;

  const delta = computeBlockDelta(size);
  memoryStats.timeSaved += delta.timeSaved;
  memoryStats.moneySaved += delta.moneySaved;
  memoryStats.lastUpdated = Date.now();

  console.log(`[AdBlock] Blocked ${category}: ${url.substring(0, 50)}... (${(size / 1024).toFixed(1)}KB saved)`);

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (isChromeStorageAvailable()) {
      await chrome.storage.local.set({ blockStats: memoryStats });
    } else {
      saveStatsToLocalStorage(memoryStats!);
    }

    const api = (globalThis as any).window?.electron;
    if (api?.systemAdBlock?.recordBlock) {
      try {
        await api.systemAdBlock.recordBlock({ size, category });
      } catch (err) {
        console.debug("[AdBlock] Failed to record block to Electron:", err);
      }
    }
    
    saveTimeout = null;
  }, 2000);

  return memoryStats;
};

export const getBlockStats = async (): Promise<BlockStats> => {
  return initBlockStats();
};

export const resetBlockStats = async () => {
  const newStats = createEmptyStats();
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.set({ blockStats: newStats });
  } else {
    saveStatsToLocalStorage(newStats);
  }
  return newStats;
};

export const isAdOrTracker = (
  url: string,
  sourceUrl: string = ""
): {
  isAd: boolean;
  category: "ads" | "trackers" | "analytics" | "social" | "youtube" | null;
} => {
  if (blocker && engineReady) {
    const request = Request.fromRawDetails({ url, sourceUrl });
    const match = (blocker as any).match(request);
    if (match?.match) {
      let category: "ads" | "trackers" | "analytics" | "social" | "youtube" = "ads";
      if (url.includes("youtube.com")) category = "youtube";
      const filterSpecs = match.getFilters?.() || [];
      if (filterSpecs.some((f: any) => f.getSpec().includes("social"))) category = "social";
      else if (filterSpecs.some((f: any) => f.getSpec().includes("tracker") || f.getSpec().includes("analytics"))) category = "analytics";
      
      return { isAd: true, category };
    }
  }

  const urlLower = url.toLowerCase();
  const isFallbackMatch = [
    "doubleclick.net", "googlesyndication.com", "googleadservices.com",
    "facebook.net", "fbcdn.net", "analytics.google.com", "connect.facebook.net",
    "youtube.com/pagead", "youtube.com/api/stats/ads"
  ].some(d => urlLower.includes(d));

  if (isFallbackMatch) {
    let category: "ads" | "trackers" | "analytics" | "social" | "youtube" = "ads";
    if (urlLower.includes("facebook") || urlLower.includes("fbcdn")) category = "social";
    else if (urlLower.includes("analytics")) category = "analytics";
    else if (urlLower.includes("youtube")) category = "youtube";
    return { isAd: true, category };
  }

  return { isAd: false, category: null };
};

const EXCEPTION_LIST_KEY = "adBlockExceptions";

export const getExceptionList = async (): Promise<string[]> => {
  if (isChromeStorageAvailable()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([EXCEPTION_LIST_KEY], (res) => {
        resolve((res[EXCEPTION_LIST_KEY] as string[]) || []);
      });
    });
  } else {
    try {
      if (typeof localStorage === "undefined") return [];
      const saved = localStorage.getItem(EXCEPTION_LIST_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.debug("[AdBlock] LocalStorage exception list recovery failed:", err);
      return [];
    }
  }
};

export const saveExceptionList = async (list: string[]) => {
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.set({ [EXCEPTION_LIST_KEY]: list });
  } else {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(EXCEPTION_LIST_KEY, JSON.stringify(list));
      }
    } catch (err) {
      console.debug("[AdBlock] LocalStorage exception list save failed:", err);
    }
  }
};

export const addException = async (domain: string) => {
  const current = await getExceptionList();
  if (!current.includes(domain)) {
    const updated = [...current, domain];
    await saveExceptionList(updated);
    await setupDeclarativeNetRequestRules();
    return updated;
  }
  return current;
};

export const removeException = async (domain: string) => {
  const current = await getExceptionList();
  const updated = current.filter((d) => d !== domain);
  await saveExceptionList(updated);
  await setupDeclarativeNetRequestRules();
  return updated;
};

export const setupDeclarativeNetRequestRules = async (): Promise<boolean> => {
  try {
    console.log("[AdBlock] Setting up specific adblocker DNR rules for extension...");
    
    if (chrome === undefined || chrome.declarativeNetRequest === undefined) {
      console.warn("[AdBlock] Chrome DNR API is unavailable.");
      return false;
    }

    await clearDeclarativeNetRequestRules();

    const blockRules = COMPREHENSIVE_DOMAINS.map((domain, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter: `||${domain}^`, resourceTypes: ["script", "image", "xmlhttprequest", "websocket", "other", "sub_frame"] }
    }));

    const allRules = [...blockRules];

    const chunkSize = 500;
    for (let i = 0; i < allRules.length; i += chunkSize) {
      const chunk = allRules.slice(i, i + chunkSize);
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: chunk as any });
    }
    console.log(`[AdBlock] Injected ${allRules.length} manual declarativeNetRequest rules.`);

    const exceptions = await getExceptionList();
    if (exceptions.length > 0) {
      const allowRules = exceptions.map((domain, i) => ({
        id: 20000 + i,
        priority: 2,
        action: { type: "allowAllRequests" },
        condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame", "sub_frame"] }
      }));
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: allowRules as any });
    }

    return true;
  } catch (err) {
    console.error("[AdBlock] Error setting up custom specific DNR adblocker:", err);
    return false;
  }
};

export const clearDeclarativeNetRequestRules = async (): Promise<boolean> => {
  try {
    console.log("[AdBlock] Clearing all native Chrome DNR rules...");
    if (chrome === undefined || chrome.declarativeNetRequest === undefined) {
      return false;
    }

    const existingDynamic = await chrome.declarativeNetRequest.getDynamicRules();
    const dynamicIds = existingDynamic.map((r) => r.id);

    const existingSession = await (chrome.declarativeNetRequest as any).getSessionRules?.() || [];
    const sessionIds = existingSession.map((r: any) => r.id);

    if (dynamicIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: dynamicIds,
      });
    }
    
    if (sessionIds.length > 0 && (chrome.declarativeNetRequest as any).updateSessionRules) {
      await (chrome.declarativeNetRequest as any).updateSessionRules({
        removeRuleIds: sessionIds,
      });
    }

    console.log("[AdBlock] Successfully cleared all dynamic and session DNR rules");
    return true;
  } catch (err) {
    console.error("[AdBlock] Error clearing DNR rules:", err);
    return false;
  }
};

if (typeof chrome !== "undefined" && chrome.alarms) {
  chrome.alarms.create("adblock-keepalive", { periodInMinutes: 30 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "adblock-keepalive") {
       chrome.storage.local.get(["protectionState"], (res) => {
         const state = res.protectionState as ProtectionState | undefined;
         if (state?.isActive && state?.adblockEnabled) {
           setupDeclarativeNetRequestRules();
         }
       });
    }
  });
}
