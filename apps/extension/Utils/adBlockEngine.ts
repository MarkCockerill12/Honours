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

// Update stats when a request is blocked
export const recordBlockedRequest = async (
  resourceType: string,
  url: string,
  category: "ads" | "trackers" | "analytics" | "social" | "youtube",
) => {
  const stats = await initBlockStats();

  // Determine size based on resource type
  const size =
    AVG_SIZES[resourceType as keyof typeof AVG_SIZES] || AVG_SIZES.other;

  stats.totalBlocked++;
  stats.bandwidthSaved += size;
  stats.blockedByType[category]++;

  // Calculate time saved (assume 10 Mbps connection = 1.25 MB/s)
  const timeSavedSeconds = size / (1.25 * 1024 * 1024);
  stats.timeSaved += timeSavedSeconds;

  // Calculate money saved
  const mbSaved = size / (1024 * 1024);
  stats.moneySaved += mbSaved * COST_PER_MB;

  stats.lastUpdated = Date.now();

  console.log(
    `[AdBlock] Blocked ${category}: ${url.substring(0, 50)}... (${(size / 1024).toFixed(1)}KB saved)`,
  );

  if (isChromeStorageAvailable()) {
    await chrome.storage.local.set({ blockStats: stats });
  } else {
    saveStatsToLocalStorage(stats);
  }
  return stats;
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

// Comprehensive filter lists (domains to block)
export const AD_DOMAINS = [
  // Google Ads
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "adservice.google.com",

  // YouTube Ads
  "youtube.com/api/stats/ads",
  "youtube.com/pagead/",
  "youtube.com/ptracking",
  "youtube.com/get_midroll_info",
  "googlevideo.com/videoplayback",

  // Facebook/Meta
  "facebook.com/tr/",
  "facebook.net",
  "fbcdn.net/tr",
  "connect.facebook.net",

  // Amazon
  "amazon-adsystem.com",
  "amazonclix.com",

  // Ad Networks
  "adnxs.com",
  "advertising.com",
  "adsrvr.org",
  "adroll.com",
  "adsafeprotected.com",
  "criteo.com",
  "criteo.net",
  "casalemedia.com",
  "pubmatic.com",
  "rubiconproject.com",
  "taboola.com",
  "outbrain.com",
  "revcontent.com",
  "mgid.com",

  // Analytics & Tracking
  "hotjar.com",
  "mouseflow.com",
  "clarity.ms",
  "fullstory.com",
  "segment.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",

  // Social Media Trackers
  "twitter.com/i/adsct",
  "ads-twitter.com",
  "t.co/i/adsct",
  "linkedin.com/px/",
  "snapchat.com/tr",

  // More Ad Networks
  "ad.doubleclick.net",
  "pubads.g.doubleclick.net",
  "securepubads.g.doubleclick.net",
  "tpc.googlesyndication.com",
  "pagead2.googlesyndication.com",
  "media.net",
  "advertising.com",
  "adtechus.com",
];

// YouTube-specific ad indicators in URLs
export const YOUTUBE_AD_PATTERNS = [
  "/api/stats/ads",
  "/pagead/",
  "/ptracking",
  "/get_midroll_info",
  "ad_type=",
  "&adformat=",
  "/generate_204",
];

// CSS Selectors for ad elements (EasyList-style)
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

  // YouTube ads
  if (
    urlLower.includes("youtube.com") ||
    urlLower.includes("googlevideo.com")
  ) {
    for (const pattern of YOUTUBE_AD_PATTERNS) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return { isAd: true, category: "youtube" };
      }
    }
  }

  // Check against domain list
  for (const domain of AD_DOMAINS) {
    if (urlLower.includes(domain)) {
      // Categorize
      if (
        domain.includes("analytic") ||
        domain.includes("segment") ||
        domain.includes("mixpanel")
      ) {
        return { isAd: true, category: "analytics" };
      }
      if (
        domain.includes("facebook") ||
        domain.includes("twitter") ||
        domain.includes("linkedin")
      ) {
        return { isAd: true, category: "social" };
      }
      if (
        domain.includes("hotjar") ||
        domain.includes("mouseflow") ||
        domain.includes("fullstory")
      ) {
        return { isAd: true, category: "trackers" };
      }
      return { isAd: true, category: "ads" };
    }
  }

  return { isAd: false, category: null };
};

// Generate declarativeNetRequest rules
export const generateDNRRules = (): chrome.declarativeNetRequest.Rule[] => {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let ruleId = 1;

  // Block ad domains
  for (const domain of AD_DOMAINS) {
    rules.push({
      id: ruleId++,
      priority: 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: {
        urlFilter: `*://*.${domain}/*`,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.IMAGE,
          chrome.declarativeNetRequest.ResourceType.STYLESHEET,
          chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
          chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
          chrome.declarativeNetRequest.ResourceType.MEDIA,
        ],
      },
    });
  }

  // Block YouTube-specific ad patterns on YouTube and Google Video domains
  const youtubeDomains = ["youtube.com", "googlevideo.com"];
  for (const domain of youtubeDomains) {
    for (const pattern of YOUTUBE_AD_PATTERNS) {
      rules.push({
        id: ruleId++,
        priority: 2, // Higher priority for YouTube specific rules
        action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
        condition: {
          urlFilter: `*://*.${domain}/*${pattern}*`,
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.SCRIPT,
            chrome.declarativeNetRequest.ResourceType.IMAGE,
            chrome.declarativeNetRequest.ResourceType.STYLESHEET,
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME, // Block ad frames too
            chrome.declarativeNetRequest.ResourceType.OTHER,
          ],
        },
      });
    }
  }

  return rules;
};
