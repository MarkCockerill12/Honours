// Comprehensive Ad Blocking Engine for Chrome Extension
// Multi-layer approach: declarativeNetRequest + Element Hiding + YouTube Specific
import { WebExtensionBlocker } from "@ghostery/adblocker-webextension";
import { Request } from "@ghostery/adblocker";
import type { ProtectionState } from "../../../packages/ui/types";

let blocker: WebExtensionBlocker | null = null;
let engineReady = false;

export const initAdBlocker = async () => {
  if (blocker) return blocker;
  try {
    console.log("[AdBlock] Initializing Ghostery engine...");
    // Corrected method name
    blocker = await WebExtensionBlocker.fromPrebuiltAdsAndTracking(fetch);
    engineReady = true;
    console.log("[AdBlock] Ghostery engine initialized!");
    return blocker;
  } catch (e) {
    console.warn("[AdBlock] Failed to initialize Ghostery engine, using fallback:", e);
    return null;
  }
};

export interface BlockStats {
  totalBlocked: number;
  bandwidthSaved: number; // in bytes
  timeSaved: number; // in seconds
  moneySaved: number; // in GBP
  blockedByType: {
    ads: number;
    trackers: number;
    analytics: number;
    social: number;
    youtube: number;
    pdf: number; // Added PDF category
  };
  lastUpdated: number;
}

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

// UK mobile data cost: ~£5 per GB = £0.0048828125 per MB
const COST_PER_MB = 0.0048828125;

// Detect if chrome.storage.local is available (i.e., running as a Chrome extension)
const isChromeStorageAvailable = (): boolean => {
  try {
    return typeof chrome !== "undefined" && !!chrome?.storage?.local;
  } catch {
    return false;
  }
};

// Fallback storage using localStorage for dev mode
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
    pdf: 0, // Added PDF category
  },
  lastUpdated: Date.now(),
});

const getStatsFromLocalStorage = (): BlockStats => {
  try {
    if (typeof localStorage === "undefined") return createEmptyStats();
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BlockStats;
      // Ensure new categories are present if loading old stats
      if (!parsed.blockedByType.pdf) {
        parsed.blockedByType.pdf = 0;
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return createEmptyStats();
};

const saveStatsToLocalStorage = (stats: BlockStats): void => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    }
  } catch {
    /* ignore */
  }
};

// Initialize stats from storage or create new
export const initBlockStats = async (): Promise<BlockStats> => {
  if (!isChromeStorageAvailable()) {
    return getStatsFromLocalStorage();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(["blockStats"], (result) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[AdBlock] chrome.storage error, using fallback:",
          chrome.runtime.lastError.message,
        );
        resolve(getStatsFromLocalStorage());
        return;
      }
      if (result.blockStats) {
        const storedStats = result.blockStats as BlockStats;
        // Ensure new categories are present if loading old stats
        if (!storedStats.blockedByType.pdf) {
          storedStats.blockedByType.pdf = 0;
        }
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
let saveTimeout: NodeJS.Timeout | null = null;

// Update stats when a request is blocked
export const recordBlockedRequest = async (
  resourceType: string,
  url: string,
  category: "ads" | "trackers" | "analytics" | "social" | "youtube",
) => {
  // 1. Initialize memory stats if missing
  memoryStats ??= await initBlockStats();

  // 2. Determine size based on resource type
  const size =
    AVG_SIZES[resourceType as keyof typeof AVG_SIZES] || AVG_SIZES.other;

  // 3. Increment counters in memory synchronously to avoid race conditions
  memoryStats.totalBlocked++;
  memoryStats.bandwidthSaved += size;
  memoryStats.blockedByType[category]++;

  const timeSavedSeconds = size / (1.25 * 1024 * 1024);
  memoryStats.timeSaved += timeSavedSeconds;

  const mbSaved = size / (1024 * 1024);
  memoryStats.moneySaved += mbSaved * COST_PER_MB;
  memoryStats.lastUpdated = Date.now();

  console.log(
    `[AdBlock] Blocked ${category}: ${url.substring(0, 50)}... (${(size / 1024).toFixed(1)}KB saved)`,
  );

  // 4. Debounce the storage write to batch multiple rapid blocks into one disk I/O
  saveTimeout ??= setTimeout(async () => {
      // Flush to exact storage
      if (isChromeStorageAvailable()) {
        await chrome.storage.local.set({ blockStats: memoryStats });
      } else {
        saveStatsToLocalStorage(memoryStats!);
      }

      // Also record to Electron if available (for unified stats)
      const api = (globalThis.window as any)?.electron;
      if (api?.systemAdBlock?.recordBlock) {
        try {
          // We just send a ping to Electron, the actual tracking is done in main.js
          await api.systemAdBlock.recordBlock({ size, category });
        } catch (e) {
          console.warn("[AdBlock] Failed to record block to Electron:", e);
        }
      }
      
      saveTimeout = null;
    }, 2000); // 2 second batching window

  return memoryStats;
};

// Get current stats
export const getBlockStats = async (): Promise<BlockStats> => {
  return initBlockStats();
};

// Reset stats
export const resetBlockStats = async () => {
  const newStats = createEmptyStats();
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.set({ blockStats: newStats });
  } else {
    saveStatsToLocalStorage(newStats);
  }
  return newStats;
};

// Comprehensive filter lists generation using @ghostery/adblocker

export const AD_SELECTORS = [
  // Generic ad containers
  '[class*="ad-container"]',
  '[id*="ad-container"]',
  '[class*="advert"]',
  '[id*="advert"]',
  '[class*="sponsored"]',
  '[id*="sponsored"]',
  '[class*="promotion"]',
  '[id*="promotion"]',
  ".ad",
  "#ad",
  ".ads",
  "#ads",
  ".advertisement",
  ".advertising",

  // YouTube specific
  ".video-ads",
  ".ytp-ad-module",
  ".ytp-ad-overlay-container",
  ".ytp-ad-text",
  ".ytp-ad-player-overlay",
  ".ad-showing",
  "#player-ads",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-ad-slot-renderer",
  "ytd-banner-promo-renderer",

  // Social media ads
  "[data-ad-preview]",
  "[data-ad-comet-preview]",
  'div[data-testid*="ad"]',
  'div[data-testid*="sponsored"]',

  // Common patterns
  'iframe[src*="ad"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="amazon-adsystem"]',
  "ins.adsbygoogle",
  ".ad-slot",
  ".ad-unit",
  ".ad-box",
  ".ad-label",
  ".ad-text",
  ".ad-wrap",
  ".ads-container",
  ".ads-wrapper",
  ".sponsor-container",
  ".sponsored-post",
  'div[class*="truste"]',
  'div[id*="taboola"]',
  'div[id*="outbrain"]',
  'div[class*="outbrain"]',
  'div[class*="taboola"]'
];

// Check if URL is an ad/tracker using Ghostery engine
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
      // Map ghostery categories to our internal categories
      let category: "ads" | "trackers" | "analytics" | "social" | "youtube" = "ads";
      
      if (url.includes("youtube.com")) category = "youtube";
      // Simplified category mapping based on common list names
      const filterSpecs = match.getFilters?.() || [];
      if (filterSpecs.some((f: any) => f.getSpec().includes("social"))) category = "social";
      else if (filterSpecs.some((f: any) => f.getSpec().includes("tracker") || f.getSpec().includes("analytics"))) category = "analytics";
      
      return { isAd: true, category };
    }
  }

  // Minimal fallback while engine is initializing or if it fails
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

// Comprehensive list of highly active tracking and ad domains to block reliably via DNR
const COMPREHENSIVE_DOMAINS = [
  // Google & DoubleClick
  "doubleclick.net", "googleadservices.com", "googlesyndication.com",
  "adservice.google.com", "google-analytics.com", "analytics.google.com",
  "tpc.googlesyndication.com", "pagead2.googlesyndication.com",

  // Facebook / Meta
  "connect.facebook.net", "pixel.facebook.com", "graph.facebook.com",
  "facebook.net", "fbcdn.net", "facebook.com/tr", "instagram.com/logging",

  // Amazon Ads
  "amazon-adsystem.com", "aax-eu.amazon-adsystem.com", "aax-us-east.amazon-adsystem.com",

  // Programmatic & Native Ads
  "taboola.com", "outbrain.com", "criteo.com",
  "rubiconproject.com", "pubmatic.com", "advertising.com", "adnxs.com",
  "scorecardresearch.com", "quantserve.com", "adform.net", "casalemedia.com",
  "openx.net", "bidswitch.net", "smartadserver.com", "teads.tv",
  "exponential.com", "sharethis.com", "addthis.com", "zedo.com",

  // Analytics & Trackers
  "hotjar.com", "mixpanel.com", "segment.com", "fullstory.com",
  "mouseflow.com", "crazyegg.com", "optimizely.com", "clicktale.net",
  "newrelic.com", "sentry.io", "bugsnag.com", "appsflyer.com",
  "branch.io", "kochava.com", "adjust.com", "singular.net",
  
  // Video & Other Ads
  "vungle.com", "unity3d.com/ads", "chartboost.com", "applovin.com",
  "inmobi.com", "supersonicads.com", "adcolony.com", "flurry.com",
  "moatads.com", "iasds01.com", "doubleverify.com", "integralads.com",

  // Yahoo & Microsoft
  "ads.yahoo.com", "bingads.microsoft.com", "bat.bing.com",

  // TikTok & ByteDance
  "ads.tiktok.com", "analytics.tiktok.com",

  // Twitter
  "ads.twitter.com", "analytics.twitter.com", "syndication.twitter.com",
  
  // Criteo
  "criteo.net", "casalemedia.com", "rubiconproject.com", "mathtag.com"
];

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
    } catch {
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
    } catch {
      /* ignore */
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

// Generate declarativeNetRequest rules via custom list builder for MV3 compatibility
export const setupDeclarativeNetRequestRules = async (): Promise<boolean> => {
  try {
    console.log("[AdBlock] Setting up specific adblocker DNR rules for extension...");
    
    if (typeof chrome === "undefined" || !chrome.declarativeNetRequest) {
      console.warn("[AdBlock] Chrome DNR API is unavailable.");
      return false;
    }

    // Always clear old rules first
    await clearDeclarativeNetRequestRules();

    // Manually block using our comprehensive list, since WebExtensionBlocker 2.14.1 
    // does NOT generate DNR rules.
    const domains = COMPREHENSIVE_DOMAINS;
    const blockRules = domains.map((domain, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter: `||${domain}^`, resourceTypes: ["script", "image", "xmlhttprequest", "websocket", "other", "sub_frame"] }
    }));

    const chunkSize = 500;
    for (let i = 0; i < blockRules.length; i += chunkSize) {
      const chunk = blockRules.slice(i, i + chunkSize);
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: chunk as any });
    }
    console.log(`[AdBlock] Injected ${blockRules.length} manual declarativeNetRequest rules.`);

    // Still add user exceptions with higher priority
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


// Clear all declarativeNetRequest rules
export const clearDeclarativeNetRequestRules = async (): Promise<boolean> => {
  try {
    console.log("[AdBlock] Clearing all native Chrome DNR rules...");
    if (typeof chrome === "undefined" || !chrome.declarativeNetRequest) {
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

// Periodic keep-alive for DNR rules if enabled
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
