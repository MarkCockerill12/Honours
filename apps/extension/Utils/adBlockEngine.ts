// Comprehensive Ad Blocking Engine for Chrome Extension
// Multi-layer approach: declarativeNetRequest + Element Hiding + YouTube Specific

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
  },
  lastUpdated: Date.now(),
});

const getStatsFromLocalStorage = (): BlockStats => {
  try {
    if (typeof localStorage === "undefined") return createEmptyStats();
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BlockStats;
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
        resolve(result.blockStats as BlockStats);
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
  if (!saveTimeout) {
    saveTimeout = setTimeout(async () => {
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
  }

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
  "ins.adsbygoogle",
];

// Check if URL is an ad/tracker
export const isAdOrTracker = (
  url: string,
): {
  isAd: boolean;
  category: "ads" | "trackers" | "analytics" | "social" | "youtube" | null;
} => {
  const urlLower = url.toLowerCase();

  if (urlLower.includes("youtube.com/pagead") || urlLower.includes("youtube.com/api/stats")) {
    return { isAd: true, category: "youtube" };
  }
  if (urlLower.includes("facebook") || urlLower.includes("twitter")) {
    return { isAd: true, category: "social" };
  }
  if (urlLower.includes("doubleclick") || urlLower.includes("googlesyndication") || urlLower.includes("googleads")) {
    return { isAd: true, category: "ads" };
  }
  if (urlLower.includes("google-analytics") || urlLower.includes("tracker")) {
    return { isAd: true, category: "analytics" };
  }

  return { isAd: false, category: null };
};

// Generate declarativeNetRequest rules via ghostery webextension package
export const setupDeclarativeNetRequestRules = async (): Promise<boolean> => {
  try {
    const { FiltersEngine } = require("@ghostery/adblocker-webextension");
    
    // Fetch and compile standard lists:
    console.log("[AdBlock] Fetching EasyList & EasyPrivacy rulesets...");
    const engine = await FiltersEngine.fromLists(fetch as any, [
      "https://easylist.to/easylist/easylist.txt",
      "https://easylist.to/easylist/easyprivacy.txt",
    ]);

    // Push the compiled declarativeNetRequest structure dynamically onto the extension
    if (typeof chrome !== "undefined" && chrome.declarativeNetRequest) {
      await engine.updateDeclarativeNetRequestRules(chrome.declarativeNetRequest);
      console.log("[AdBlock] Successfully injected DNR rules natively via @ghostery/adblocker-webextension");
      return true;
    } else {
      console.warn("[AdBlock] Chrome DNR API is unavailable. Are we running inside an extension manifest v3?");
      return false;
    }
  } catch (err) {
    console.error("[AdBlock] Error loading adblock packages dynamically:", err);
    return false;
  }
};

