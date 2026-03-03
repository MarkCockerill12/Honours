"use strict";
(() => {
  // apps/extension/Utils/security.ts
  var THREAT_DB = {
    PHISHING_DOMAINS: [
      "login-apple-id.com",
      "secure-paypal-verify.net",
      "crypto-wallet-update.io",
      "free-robux-generator.com",
      "bank-of-america-alert.xyz",
      "netflix-account-update.com"
    ],
    MALWARE_PATTERNS: [
      "exe",
      "dmg",
      "zip",
      "tar.gz",
      "bat",
      "sh"
    ]
  };
  var scanUrl = (urlString) => {
    console.log(`[Security] Scanning URL: ${urlString}`);
    try {
      const url = new URL(urlString);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();
      if (THREAT_DB.PHISHING_DOMAINS.some((domain) => hostname.includes(domain))) {
        console.log(`[Security] THREAT: Phishing domain detected in ${hostname}`);
        return { url: urlString, isSafe: false, threatType: "phishing", details: "Known Phishing Domain" };
      }
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
        if (hostname !== "127.0.0.1" && hostname !== "localhost" && !hostname.startsWith("192.168.")) {
          console.log(`[Security] THREAT: Raw IP address detected - ${hostname}`);
          return { url: urlString, isSafe: false, threatType: "suspicious", details: "Raw IP Address Usage" };
        }
      }
      const extension = pathname.split(".").pop();
      if (extension && THREAT_DB.MALWARE_PATTERNS.includes(extension)) {
        console.log(`[Security] THREAT: Dangerous file extension .${extension}`);
        return { url: urlString, isSafe: false, threatType: "malware", details: `Dangerous .${extension} file` };
      }
      console.log(`[Security] URL is SAFE: ${urlString}`);
      return { url: urlString, isSafe: true, threatType: "safe" };
    } catch (e) {
      console.log(`[Security] Invalid URL format, treating as safe: ${urlString}`);
      return { url: urlString, isSafe: true, threatType: "safe" };
    }
  };

  // apps/extension/Utils/adBlockEngine.ts
  var AVG_SIZES = {
    image: 5e4,
    // 50KB
    script: 75e3,
    // 75KB
    stylesheet: 25e3,
    // 25KB
    video: 2e6,
    // 2MB for ad videos
    xmlhttprequest: 1e4,
    // 10KB
    media: 5e5,
    // 500KB
    other: 2e4
    // 20KB
  };
  var COST_PER_MB = 0.0048828125;
  var initBlockStats = async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["blockStats"], (result) => {
        if (result.blockStats) {
          resolve(result.blockStats);
        } else {
          const newStats = {
            totalBlocked: 0,
            bandwidthSaved: 0,
            timeSaved: 0,
            moneySaved: 0,
            blockedByType: {
              ads: 0,
              trackers: 0,
              analytics: 0,
              social: 0,
              youtube: 0
            },
            lastUpdated: Date.now()
          };
          chrome.storage.local.set({ blockStats: newStats });
          resolve(newStats);
        }
      });
    });
  };
  var recordBlockedRequest = async (resourceType, url, category) => {
    const stats = await initBlockStats();
    const size = AVG_SIZES[resourceType] || AVG_SIZES.other;
    stats.totalBlocked++;
    stats.bandwidthSaved += size;
    stats.blockedByType[category]++;
    const timeSavedSeconds = size / (1.25 * 1024 * 1024);
    stats.timeSaved += timeSavedSeconds;
    const mbSaved = size / (1024 * 1024);
    stats.moneySaved += mbSaved * COST_PER_MB;
    stats.lastUpdated = Date.now();
    console.log(`[AdBlock] Blocked ${category}: ${url.substring(0, 50)}... (${(size / 1024).toFixed(1)}KB saved)`);
    await chrome.storage.local.set({ blockStats: stats });
    return stats;
  };
  var AD_DOMAINS = [
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
    "adtechus.com"
  ];
  var YOUTUBE_AD_PATTERNS = [
    "/api/stats/ads",
    "/pagead/",
    "/ptracking",
    "/get_midroll_info",
    "ad_type=",
    "&adformat=",
    "/generate_204"
  ];
  var isAdOrTracker = (url) => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes("youtube.com") || urlLower.includes("googlevideo.com")) {
      for (const pattern of YOUTUBE_AD_PATTERNS) {
        if (urlLower.includes(pattern.toLowerCase())) {
          return { isAd: true, category: "youtube" };
        }
      }
    }
    for (const domain of AD_DOMAINS) {
      if (urlLower.includes(domain)) {
        if (domain.includes("analytic") || domain.includes("segment") || domain.includes("mixpanel")) {
          return { isAd: true, category: "analytics" };
        }
        if (domain.includes("facebook") || domain.includes("twitter") || domain.includes("linkedin")) {
          return { isAd: true, category: "social" };
        }
        if (domain.includes("hotjar") || domain.includes("mouseflow") || domain.includes("fullstory")) {
          return { isAd: true, category: "trackers" };
        }
        return { isAd: true, category: "ads" };
      }
    }
    return { isAd: false, category: null };
  };
  var generateDNRRules = () => {
    const rules = [];
    let ruleId = 1;
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
            chrome.declarativeNetRequest.ResourceType.MEDIA
          ]
        }
      });
    }
    const youtubeDomains = ["youtube.com", "googlevideo.com"];
    for (const domain of youtubeDomains) {
      for (const pattern of YOUTUBE_AD_PATTERNS) {
        rules.push({
          id: ruleId++,
          priority: 2,
          // Higher priority for YouTube specific rules
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
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              // Block ad frames too
              chrome.declarativeNetRequest.ResourceType.OTHER
            ]
          }
        });
      }
    }
    return rules;
  };

  // apps/extension/Utils/background.ts
  var MALICIOUS_DOMAINS = /* @__PURE__ */ new Set();
  var adBlockEnabled = true;
  var lastError = null;
  var adBlockSetupStatus = "pending";
  var adBlockSetupError = null;
  var updateBlocklist = async () => {
    try {
      console.log("[Background] Updating blocklist from StevenBlack hosts...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3e4);
      const response = await fetch(
        "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts",
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      const lines = text.split("\n");
      const newDomains = /* @__PURE__ */ new Set();
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
      console.log(`[Background] Blocklist updated with ${MALICIOUS_DOMAINS.size} domains.`);
      await chrome.storage.local.set({
        maliciousDomains: Array.from(MALICIOUS_DOMAINS),
        lastUpdate: Date.now()
      });
      return { success: true };
    } catch (error) {
      const errorMsg = error.name === "AbortError" ? "Blocklist update timed out (30s)" : `Failed to update blocklist: ${error.message}`;
      console.error("[Background]", errorMsg, error);
      lastError = { message: errorMsg, timestamp: Date.now() };
      return { success: false, error: errorMsg };
    }
  };
  chrome.runtime.onInstalled.addListener(async () => {
    console.log("[Background] Extension Installed Successfully");
    try {
      await initBlockStats();
      console.log("[Background] Block stats initialized");
      const dnrResult = await setupDeclarativeNetRequest();
      if (dnrResult.success) {
        adBlockSetupStatus = "success";
        await chrome.storage.local.set({
          adBlockSetupStatus: "success",
          adBlockSetupError: null
        });
        console.log("[Background] Ad blocking setup completed successfully");
      } else {
        console.error("[Background] DNR setup failed:", dnrResult.error);
        adBlockSetupStatus = "error";
        adBlockSetupError = dnrResult.error || "Unknown error";
        await chrome.storage.local.set({
          adBlockSetupStatus: "error",
          adBlockSetupError: dnrResult.error
        });
      }
    } catch (error) {
      console.error("[Background] Fatal error during initialization:", error);
      adBlockSetupStatus = "error";
      adBlockSetupError = `Initialization failed: ${error.message}`;
      await chrome.storage.local.set({
        adBlockSetupStatus: "error",
        adBlockSetupError: error.message
      });
    }
    try {
      const result = await chrome.storage.local.get(["maliciousDomains", "lastUpdate", "adBlockEnabled"]);
      const now = Date.now();
      const lastUpdate = result.lastUpdate;
      if (result.adBlockEnabled !== void 0) {
        adBlockEnabled = result.adBlockEnabled;
        console.log("[Background] Ad block enabled:", adBlockEnabled);
      }
      if (result.maliciousDomains && lastUpdate && now - lastUpdate < 864e5) {
        MALICIOUS_DOMAINS = new Set(result.maliciousDomains);
        console.log(`[Background] Loaded ${MALICIOUS_DOMAINS.size} domains from storage.`);
      } else {
        console.log("[Background] Blocklist outdated or not found, fetching new one...");
        const updateResult = await updateBlocklist();
        if (!updateResult.success) {
          console.error("[Background] Failed to fetch initial blocklist:", updateResult.error);
          await chrome.storage.local.set({
            blocklistError: updateResult.error,
            blocklistLastError: Date.now()
          });
        }
      }
    } catch (error) {
      console.error("[Background] Error loading blocklist:", error);
      await chrome.storage.local.set({
        blocklistError: error.message,
        blocklistLastError: Date.now()
      });
    }
    chrome.alarms.create("updateBlocklist", { periodInMinutes: 1440 });
    console.log("[Background] Scheduled daily blocklist updates");
  });
  var setupDeclarativeNetRequest = async () => {
    console.log("[Background] Setting up declarativeNetRequest rules...");
    try {
      if (!chrome.declarativeNetRequest) {
        throw new Error("declarativeNetRequest API not available - check manifest permissions");
      }
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map((rule) => rule.id);
      if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds
        });
        console.log(`[Background] Removed ${existingRuleIds.length} old rules`);
      }
      const rules = generateDNRRules();
      if (rules.length === 0) {
        console.warn("[Background] No DNR rules generated - ad blocking may not work");
        return { success: false, error: "No blocking rules generated" };
      }
      const batchSize = 1e3;
      let addedCount = 0;
      for (let i = 0; i < rules.length; i += batchSize) {
        const batch = rules.slice(i, i + batchSize);
        try {
          await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: batch
          });
          addedCount += batch.length;
          console.log(`[Background] Added ${addedCount}/${rules.length} DNR rules`);
        } catch (batchError) {
          console.error(`[Background] Failed to add batch ${i}-${i + batchSize}:`, batchError);
        }
      }
      if (addedCount === 0) {
        throw new Error("Failed to add any DNR rules - ad blocking will not work");
      }
      console.log(`[Background] Successfully added ${addedCount}/${rules.length} ad-blocking rules`);
      return { success: true };
    } catch (error) {
      const errorMsg = `DNR setup failed: ${error.message}`;
      console.error("[Background]", errorMsg, error);
      lastError = { message: errorMsg, timestamp: Date.now() };
      return { success: false, error: errorMsg };
    }
  };
  chrome.webRequest?.onBeforeRequest?.addListener(
    (details) => {
      if (!adBlockEnabled) return;
      const check = isAdOrTracker(details.url);
      if (check.isAd && check.category) {
        console.log(`[Background] Blocked ${check.category} request:`, details.url.substring(0, 80));
        recordBlockedRequest(details.type, details.url, check.category);
        return { cancel: true };
      }
      return void 0;
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
  );
  console.log("[Background] Web request listener registered for tracking");
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "updateBlocklist") {
      console.log("[Background] Alarm triggered: updating blocklist");
      updateBlocklist().then((result) => {
        if (!result.success) {
          console.error("[Background] Scheduled blocklist update failed:", result.error);
        }
      }).catch((error) => {
        console.error("[Background] Unexpected error during blocklist update:", error);
      });
    }
  });
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log("[Background] Received message:", request.action);
    if (request.action === "GET_ADBLOCK_STATUS") {
      console.log("[Background] Fetching adblock status...");
      const result = await chrome.storage.local.get(["adBlockSetupStatus", "adBlockSetupError", "blocklistError"]);
      sendResponse({
        success: true,
        setupStatus: result.adBlockSetupStatus || adBlockSetupStatus,
        setupError: result.adBlockSetupError || adBlockSetupError,
        blocklistError: result.blocklistError,
        enabled: adBlockEnabled,
        lastError
      });
      return true;
    }
    if (request.action === "GET_BLOCK_STATS") {
      console.log("[Background] Fetching block stats...");
      try {
        const stats = await initBlockStats();
        console.log("[Background] Block stats:", stats);
        sendResponse({ success: true, stats });
      } catch (error) {
        console.error("[Background] Error fetching stats:", error);
        sendResponse({
          success: false,
          error: error.message,
          stats: {
            totalBlocked: 0,
            bandwidthSaved: 0,
            timeSaved: 0,
            moneySaved: 0
          }
        });
      }
      return true;
    }
    if (request.action === "RESET_BLOCK_STATS") {
      console.log("[Background] Resetting block stats...");
      try {
        await chrome.storage.local.set({
          blockStats: {
            totalBlocked: 0,
            bandwidthSaved: 0,
            timeSaved: 0,
            moneySaved: 0,
            blockedByType: { ads: 0, trackers: 0, analytics: 0, social: 0, youtube: 0 },
            lastUpdated: Date.now()
          }
        });
        console.log("[Background] Block stats reset");
        sendResponse({ success: true });
      } catch (error) {
        console.error("[Background] Error resetting stats:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    if (request.action === "TOGGLE_ADBLOCK") {
      console.log("[Background] Toggling ad block to:", request.enabled);
      try {
        adBlockEnabled = request.enabled;
        await chrome.storage.local.set({ adBlockEnabled });
        const verification = await chrome.storage.local.get(["adBlockEnabled"]);
        if (verification.adBlockEnabled !== adBlockEnabled) {
          throw new Error("Failed to save ad block preference");
        }
        console.log("[Background] Ad block toggled successfully:", adBlockEnabled);
        sendResponse({ success: true, enabled: adBlockEnabled });
      } catch (error) {
        console.error("[Background] Error toggling ad block:", error);
        sendResponse({ success: false, error: error.message, enabled: adBlockEnabled });
      }
      return true;
    }
    if (request.action === "TRANSLATE_TEXT") {
      const { text, targetLang } = request;
      console.log(`[Background] Translating text to ${targetLang}: "${text.substring(0, 50)}..."`);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      fetch(url).then((res) => res.json()).then((data) => {
        console.log("[Background] Translation API response received");
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedText = data[0].map((segment) => segment[0]).join("");
          console.log(`[Background] Translation successful: "${translatedText.substring(0, 50)}..."`);
          sendResponse({ success: true, translatedText });
        } else {
          console.error("[Background] Invalid translation response format:", data);
          sendResponse({ success: false, error: "Invalid response format" });
        }
      }).catch((err) => {
        console.error("[Background] Translation error:", err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
    if (request.action === "CHECK_URL_REAL") {
      const { url } = request;
      console.log(`[Background] Checking URL: ${url}`);
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        if (MALICIOUS_DOMAINS.has(hostname)) {
          console.log(`[Background] THREAT DETECTED: ${hostname} is in blocklist`);
          sendResponse({
            url,
            isSafe: false,
            threatType: "malware",
            details: "Blacklisted Domain (StevenBlack Hosts)"
          });
        } else {
          console.log(`[Background] ${hostname} not in blocklist, using heuristic scan`);
          const heuristicScan = scanUrl(url);
          console.log(`[Background] Heuristic scan result:`, heuristicScan);
          sendResponse(heuristicScan);
        }
      } catch (error) {
        console.error(`[Background] Invalid URL: ${url}`, error);
        sendResponse({ url, isSafe: true, threatType: "safe", details: "Invalid URL" });
      }
      return true;
    }
    return false;
  });
  console.log("[Background] Background script initialized and ready");
})();
