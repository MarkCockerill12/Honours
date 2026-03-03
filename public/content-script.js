"use strict";
(() => {
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
    other: 2e4,
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
              youtube: 0,
            },
            lastUpdated: Date.now(),
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
    console.log(
      `[AdBlock] Blocked ${category}: ${url.substring(0, 50)}... (${(size / 1024).toFixed(1)}KB saved)`,
    );
    await chrome.storage.local.set({ blockStats: stats });
    return stats;
  };
  var AD_SELECTORS = [
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

  // apps/extension/Utils/youtubeAdBlocker.ts
  var observer = null;
  var videoCheckInterval = null;
  var adCheckInterval = null;
  var initYouTubeAdBlocker = () => {
    console.log("[YouTube AdBlock] Initializing YouTube ad blocker...");
    if (!window.location.hostname.includes("youtube.com")) {
      console.log("[YouTube AdBlock] Not on YouTube, skipping initialization");
      return;
    }
    console.log("[YouTube AdBlock] YouTube detected, setting up blockers");
    injectAdBlockingCSS();
    setupDOMObserver();
    setupAutoSkip();
    setupOverlayRemoval();
    setupAdSpeedControl();
    console.log("[YouTube AdBlock] All YouTube ad blocking methods activated");
  };
  var injectAdBlockingCSS = () => {
    console.log("[YouTube AdBlock] Injecting ad-blocking CSS...");
    const style = document.createElement("style");
    style.id = "youtube-adblock-css";
    style.textContent = `
    /* Hide video ads */
    .video-ads, .ytp-ad-module, .ytp-ad-overlay-container,
    .ytp-ad-text, .ytp-ad-player-overlay,
    ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer,
    ytd-ad-slot-renderer, ytd-banner-promo-renderer,
    ytd-player-legacy-desktop-watch-ads-renderer,
    #player-ads, .ad-showing, .ad-interrupting,
    ytd-compact-promoted-video-renderer,
    ytd-promoted-video-renderer {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      opacity: 0 !important;
    }
    
    /* Hide sidebar ads */
    ytd-rich-item-renderer[is-ad],
    ytd-video-renderer[is-ad],
    ytd-promoted-sparkles-text-search-renderer {
      display: none !important;
    }
    
    /* Hide banner ads */
    #masthead-ad, ytd-banner-promo-renderer-background {
      display: none !important;
    }
    
    /* Remove ad spacing */
    .ad-showing .html5-video-container {
      margin: 0 !important;
    }
  `;
    const existing = document.getElementById("youtube-adblock-css");
    if (existing) existing.remove();
    document.head.appendChild(style);
    console.log("[YouTube AdBlock] Ad-blocking CSS injected");
  };
  var setupDOMObserver = () => {
    console.log("[YouTube AdBlock] Setting up DOM mutation observer...");
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (isAdElement(element)) {
              console.log(
                "[YouTube AdBlock] Detected ad element, removing:",
                element.className,
              );
              element.remove();
              recordBlockedRequest("other", window.location.href, "youtube");
            }
            const adElements = element.querySelectorAll(
              'ytd-display-ad-renderer, ytd-ad-slot-renderer, ytd-promoted-sparkles-web-renderer, ytd-banner-promo-renderer, [class*="ad-showing"], [class*="video-ads"]',
            );
            if (adElements.length > 0) {
              console.log(
                `[YouTube AdBlock] Found ${adElements.length} ad elements, removing...`,
              );
              adElements.forEach((el) => {
                el.remove();
                recordBlockedRequest("other", window.location.href, "youtube");
              });
            }
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    console.log("[YouTube AdBlock] DOM observer active");
  };
  var isAdElement = (element) => {
    const adIndicators = [
      "ad-showing",
      "video-ads",
      "ytp-ad-",
      "ytd-display-ad",
      "ytd-ad-slot",
      "ytd-promoted",
      "ytd-banner-promo",
    ];
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    return adIndicators.some(
      (indicator) => className.includes(indicator) || id.includes(indicator),
    );
  };
  var setupAutoSkip = () => {
    console.log("[YouTube AdBlock] Setting up auto-skip...");
    adCheckInterval = window.setInterval(() => {
      const video = document.querySelector("video");
      if (!video) return;
      const adContainer = document.querySelector(".ad-showing");
      const adModule = document.querySelector(".ytp-ad-module");
      if (adContainer || adModule) {
        console.log("[YouTube AdBlock] Ad detected, attempting to skip...");
        const skipButton = document.querySelector(
          ".ytp-ad-skip-button, .ytp-skip-ad-button",
        );
        if (skipButton) {
          console.log("[YouTube AdBlock] Skip button found, clicking...");
          skipButton.click();
          recordBlockedRequest("video", window.location.href, "youtube");
        }
        if (video.duration && video.currentTime < video.duration - 0.5) {
          console.log("[YouTube AdBlock] Fast-forwarding ad video...");
          video.currentTime = video.duration - 0.5;
          video.playbackRate = 16;
        }
        const overlay = document.querySelector(".ytp-ad-overlay-container");
        if (overlay) {
          overlay.style.display = "none";
        }
      }
    }, 500);
    console.log("[YouTube AdBlock] Auto-skip active");
  };
  var setupOverlayRemoval = () => {
    console.log("[YouTube AdBlock] Setting up overlay removal...");
    const removeOverlays = () => {
      const overlays = document.querySelectorAll(
        ".ytp-ad-overlay-container, .ytp-ad-text-overlay, .ytp-ad-image-overlay, .ytp-ad-player-overlay-instream-container",
      );
      if (overlays.length > 0) {
        console.log(
          `[YouTube AdBlock] Removing ${overlays.length} ad overlays...`,
        );
        overlays.forEach((overlay) => {
          overlay.style.display = "none";
          recordBlockedRequest("other", window.location.href, "youtube");
        });
      }
    };
    setInterval(removeOverlays, 1e3);
    removeOverlays();
    console.log("[YouTube AdBlock] Overlay removal active");
  };
  var setupAdSpeedControl = () => {
    console.log("[YouTube AdBlock] Setting up ad speed control...");
    videoCheckInterval = window.setInterval(() => {
      const video = document.querySelector("video");
      if (!video) return;
      const isAdPlaying = document.querySelector(".ad-showing") !== null;
      if (isAdPlaying && video.playbackRate < 16) {
        console.log("[YouTube AdBlock] Ad playing, setting max speed...");
        video.playbackRate = 16;
        video.muted = true;
        video.volume = 0;
      }
    }, 250);
    console.log("[YouTube AdBlock] Ad speed control active");
  };

  // apps/extension/Utils/security.ts
  var THREAT_DB = {
    PHISHING_DOMAINS: [
      "login-apple-id.com",
      "secure-paypal-verify.net",
      "crypto-wallet-update.io",
      "free-robux-generator.com",
      "bank-of-america-alert.xyz",
      "netflix-account-update.com",
    ],
    MALWARE_PATTERNS: ["exe", "dmg", "zip", "tar.gz", "bat", "sh"],
  };
  var scanUrl = (urlString) => {
    console.log(`[Security] Scanning URL: ${urlString}`);
    try {
      const url = new URL(urlString);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();
      if (
        THREAT_DB.PHISHING_DOMAINS.some((domain) => hostname.includes(domain))
      ) {
        console.log(
          `[Security] THREAT: Phishing domain detected in ${hostname}`,
        );
        return {
          url: urlString,
          isSafe: false,
          threatType: "phishing",
          details: "Known Phishing Domain",
        };
      }
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
        if (
          hostname !== "127.0.0.1" &&
          hostname !== "localhost" &&
          !hostname.startsWith("192.168.")
        ) {
          console.log(
            `[Security] THREAT: Raw IP address detected - ${hostname}`,
          );
          return {
            url: urlString,
            isSafe: false,
            threatType: "suspicious",
            details: "Raw IP Address Usage",
          };
        }
      }
      const extension = pathname.split(".").pop();
      if (extension && THREAT_DB.MALWARE_PATTERNS.includes(extension)) {
        console.log(
          `[Security] THREAT: Dangerous file extension .${extension}`,
        );
        return {
          url: urlString,
          isSafe: false,
          threatType: "malware",
          details: `Dangerous .${extension} file`,
        };
      }
      console.log(`[Security] URL is SAFE: ${urlString}`);
      return { url: urlString, isSafe: true, threatType: "safe" };
    } catch (e) {
      console.log(
        `[Security] Invalid URL format, treating as safe: ${urlString}`,
      );
      return { url: urlString, isSafe: true, threatType: "safe" };
    }
  };

  // apps/extension/Utils/content.ts
  var filtersActive = false;
  var appliedElements = [];
  var adBlockingActive = false;
  console.log("[Content] Content script loaded on:", window.location.href);
  if (window.location.hostname.includes("youtube.com")) {
    console.log("[Content] YouTube detected, initializing ad blocker...");
    setTimeout(() => {
      initYouTubeAdBlocker();
    }, 1e3);
  }
  var clearBlurContent = () => {
    console.log("[Content] Clearing all content filters...");
    appliedElements.forEach((el) => {
      if (el.parentNode) {
        const textNode = document.createTextNode(
          el.getAttribute("data-original-text") || el.textContent || "",
        );
        el.parentNode.replaceChild(textNode, el);
      }
    });
    appliedElements = [];
    filtersActive = false;
    console.log("[Content] All filters cleared");
  };
  var blurContent = (rootElement, filters, blurMethod = "blur") => {
    console.log(
      "[Content] blurContent called with filters:",
      filters,
      "method:",
      blurMethod,
    );
    if (!filters || filters.length === 0) {
      console.log("[Content] No filters provided");
      return 0;
    }
    const activeFilters = filters.filter((f) => f.enabled);
    if (activeFilters.length === 0) {
      console.log("[Content] No active filters");
      return 0;
    }
    console.log("[Content] Active filters:", activeFilters);
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      null,
    );
    const nodesToBlur = [];
    let node;
    while ((node = walker.nextNode())) {
      const textNode = node;
      const textContent = textNode.textContent?.toLowerCase() || "";
      const parentTag = textNode.parentElement?.tagName;
      if (parentTag && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parentTag))
        continue;
      for (const filter of activeFilters) {
        if (textContent.includes(filter.blockTerm.toLowerCase())) {
          let shouldBlock = true;
          if (filter.exceptWhen) {
            let contextElement = textNode.parentElement;
            const contextText =
              contextElement?.innerText?.toLowerCase() ||
              contextElement?.textContent?.toLowerCase() ||
              "";
            if (contextText.includes(filter.exceptWhen.toLowerCase())) {
              shouldBlock = false;
            }
          }
          if (shouldBlock) {
            nodesToBlur.push(textNode);
            break;
          }
        }
      }
    }
    console.log(
      `[Content] Found ${nodesToBlur.length} text nodes to apply ${blurMethod} to`,
    );
    nodesToBlur.forEach((textNode) => {
      const span = document.createElement("span");
      const originalText = textNode.textContent || "";
      span.setAttribute("data-original-text", originalText);
      span.setAttribute("data-content-filtered", "true");
      switch (blurMethod) {
        case "blackbar": {
          span.textContent = "\u2588".repeat(Math.min(originalText.length, 40));
          span.style.backgroundColor = "#000";
          span.style.color = "#000";
          span.style.cursor = "pointer";
          span.style.borderRadius = "2px";
          span.style.padding = "0 2px";
          span.title = "Click to reveal redacted content";
          span.onclick = () => {
            span.textContent = originalText;
            span.style.backgroundColor = "transparent";
            span.style.color = "inherit";
          };
          break;
        }
        case "warning": {
          span.textContent = "\u26A0\uFE0F [Content Filtered]";
          span.style.backgroundColor = "rgba(234,179,8,0.15)";
          span.style.color = "#ca8a04";
          span.style.border = "1px solid rgba(234,179,8,0.3)";
          span.style.borderRadius = "4px";
          span.style.padding = "2px 6px";
          span.style.fontSize = "0.85em";
          span.style.fontWeight = "bold";
          span.style.cursor = "pointer";
          span.title = "Click to reveal filtered content";
          span.onclick = () => {
            span.textContent = originalText;
            span.style.backgroundColor = "transparent";
            span.style.color = "inherit";
            span.style.border = "none";
            span.style.fontWeight = "normal";
            span.style.padding = "0";
          };
          break;
        }
        case "kitten": {
          span.textContent =
            "\u{1F431}".repeat(
              Math.min(Math.ceil(originalText.length / 5), 8),
            ) + " meow!";
          span.style.cursor = "pointer";
          span.style.backgroundColor = "rgba(244,114,182,0.1)";
          span.style.borderRadius = "4px";
          span.style.padding = "2px 4px";
          span.title = "Click to reveal original content";
          span.onclick = () => {
            span.textContent = originalText;
            span.style.backgroundColor = "transparent";
          };
          break;
        }
        case "blur":
        default: {
          span.textContent = originalText;
          span.style.filter = "blur(6px)";
          span.style.cursor = "pointer";
          span.style.transition = "filter 0.3s";
          span.style.userSelect = "none";
          span.onclick = () => {
            span.style.filter = "none";
            span.style.userSelect = "text";
          };
          break;
        }
      }
      textNode.replaceWith(span);
      appliedElements.push(span);
    });
    filtersActive = true;
    console.log(
      `[Content] Applied ${blurMethod} to ${nodesToBlur.length} elements`,
    );
    return nodesToBlur.length;
  };
  var translatedElements = /* @__PURE__ */ new Map();
  var isTranslationActive = false;
  var clearTranslations = () => {
    console.log("[Content] Clearing all translations...");
    translatedElements.forEach((originalText, element) => {
      if (element.parentNode) {
        const textNode = document.createTextNode(originalText);
        element.parentNode.replaceChild(textNode, element);
      }
    });
    translatedElements.clear();
    isTranslationActive = false;
    console.log("[Content] All translations cleared");
  };
  var translateTextNodeReal = async (textNode, targetLang) => {
    const text = textNode.textContent;
    if (!text?.trim()) return false;
    console.log(
      `[Content] Translating text: "${text.substring(0, 50)}..." to ${targetLang}`,
    );
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "TRANSLATE_TEXT",
          text,
          targetLang,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Content] Translation error:",
              chrome.runtime.lastError,
            );
            resolve(false);
            return;
          }
          if (response?.success) {
            console.log(
              `[Content] Translation successful: "${response.translatedText.substring(0, 50)}..."`,
            );
            const span = document.createElement("span");
            const originalText = text;
            span.textContent = response.translatedText;
            span.dataset.originalText = originalText;
            span.dataset.translated = "true";
            span.style.display = "inline";
            span.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
            span.style.borderRadius = "2px";
            span.title = `Original: ${originalText}`;
            textNode.replaceWith(span);
            translatedElements.set(span, originalText);
            resolve(true);
          } else {
            console.error("[Content] Translation failed:", response?.error);
            resolve(false);
          }
        },
      );
    });
  };
  var translatePage = async (rootElement, targetLang) => {
    console.log(`[Content] Starting page translation to ${targetLang}`);
    console.log("[Content] Root element:", rootElement.tagName);
    const isPDF =
      document.contentType === "application/pdf" ||
      window.location.href.toLowerCase().endsWith(".pdf");
    console.log("[Content] Is PDF:", isPDF);
    if (isPDF) {
      console.log(
        "[Content] PDF detected - attempting to extract text from PDF viewer",
      );
      const textLayer = document.querySelector(".textLayer");
      if (textLayer) {
        rootElement = textLayer;
        console.log("[Content] Found PDF textLayer, using it as root");
      }
    }
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      null,
    );
    const nodesToTranslate = [];
    let node;
    while ((node = walker.nextNode())) {
      const textNode = node;
      const parentTag = textNode.parentElement?.tagName;
      if (
        textNode.textContent?.trim() &&
        parentTag &&
        !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parentTag)
      ) {
        if (textNode.textContent.length < 500) {
          nodesToTranslate.push(textNode);
        }
      }
    }
    console.log(
      `[Content] Found ${nodesToTranslate.length} text nodes to translate`,
    );
    let successCount = 0;
    for (let i = 0; i < nodesToTranslate.length; i++) {
      const textNode = nodesToTranslate[i];
      await new Promise((resolve) => setTimeout(resolve, i * 100));
      const success = await translateTextNodeReal(textNode, targetLang);
      if (success) successCount++;
    }
    isTranslationActive = true;
    console.log(
      `[Content] Translation complete. Successfully translated ${successCount}/${nodesToTranslate.length} elements`,
    );
    return successCount;
  };
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Content] Received message:", request.action);
    if (request.action === "TRANSLATE_PAGE") {
      console.log(
        "[Content] TRANSLATE_PAGE action triggered with targetLang:",
        request.targetLang,
      );
      translatePage(document.body, request.targetLang)
        .then((count) => {
          console.log(`[Content] Translation completed, count: ${count}`);
          sendResponse({ success: true, count });
        })
        .catch((error) => {
          console.error("[Content] Translation error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
    if (request.action === "CLEAR_TRANSLATIONS") {
      console.log("[Content] CLEAR_TRANSLATIONS action triggered");
      clearTranslations();
      sendResponse({ success: true });
      return true;
    }
    if (request.action === "APPLY_FILTERS") {
      console.log(
        "[Content] APPLY_FILTERS action triggered with filters:",
        request.filters,
        "method:",
        request.blurMethod,
      );
      const count = blurContent(
        document.body,
        request.filters,
        request.blurMethod || "blur",
      );
      console.log(`[Content] Applied filters, affected count: ${count}`);
      sendResponse({ success: true, count });
      return true;
    }
    if (request.action === "CLEAR_FILTERS") {
      console.log("[Content] CLEAR_FILTERS action triggered");
      clearBlurContent();
      sendResponse({ success: true });
      return true;
    }
    if (request.action === "EXTRACT_TEXT") {
      console.log("[Content] EXTRACT_TEXT action triggered");
      const content = document.body.innerText || document.body.textContent;
      const result = {
        text: content,
        type: document.contentType,
        url: globalThis.location.href,
      };
      console.log("[Content] Extracted text, length:", content?.length);
      sendResponse(result);
      return true;
    }
    if (request.action === "SCAN_PAGE_LINKS") {
      console.log("[Content] SCAN_PAGE_LINKS action triggered");
      if (
        document.contentType === "application/pdf" ||
        globalThis.location.href.endsWith(".pdf")
      ) {
        console.log("[Content] PDF detected, returning PDF scan result");
        sendResponse({
          type: "PDF",
          linkCount: 0,
          maliciousCount: 0,
          maliciousLinks: [],
          safeLinks: [],
        });
        return true;
      }
      const links = Array.from(document.querySelectorAll("a[href]"));
      console.log(`[Content] Found ${links.length} links on page`);
      const safeLinks = [];
      const maliciousLinks = [];
      const scanLink = (link) => {
        return new Promise((resolve) => {
          const localScan = scanUrl(link.href);
          console.log(
            `[Content] Local scan for ${link.href}:`,
            localScan.isSafe ? "SAFE" : "THREAT",
          );
          if (!localScan.isSafe) {
            maliciousLinks.push(localScan);
            link.style.border = "2px solid red";
            link.style.padding = "2px";
            link.title = `\u26A0\uFE0F THREAT: ${localScan.details}`;
            link.dataset.scanned = "threat";
            link.dataset.threatType = localScan.threatType;
            link.dataset.threatDetails = localScan.details || "";
            resolve();
            return;
          }
          chrome.runtime.sendMessage(
            { action: "CHECK_URL_REAL", url: link.href },
            (response) => {
              if (chrome.runtime.lastError || !response) {
                console.log(
                  `[Content] Background check failed for ${link.href}, using local scan`,
                );
                safeLinks.push(localScan);
                link.dataset.scanned = "safe";
                resolve();
                return;
              }
              console.log(
                `[Content] Background scan for ${link.href}:`,
                response.isSafe ? "SAFE" : "THREAT",
              );
              if (response.isSafe) {
                safeLinks.push(response);
                link.dataset.scanned = "safe";
              } else {
                maliciousLinks.push(response);
                link.style.border = "2px solid red";
                link.style.padding = "2px";
                link.title = `\u26A0\uFE0F THREAT: ${response.details}`;
                link.dataset.scanned = "threat";
                link.dataset.threatType = response.threatType;
                link.dataset.threatDetails = response.details || "";
              }
              resolve();
            },
          );
        });
      };
      Promise.all(links.map(scanLink)).then(() => {
        console.log(
          `[Content] Scan complete - Total: ${links.length}, Safe: ${safeLinks.length}, Threats: ${maliciousLinks.length}`,
        );
        sendResponse({
          type: "WEB",
          linkCount: links.length,
          maliciousCount: maliciousLinks.length,
          maliciousLinks,
          safeLinks,
        });
      });
      return true;
    }
    if (request.action === "ENABLE_ADBLOCK") {
      console.log("[Content] Enabling ad blocking...");
      enableAdBlocking();
      sendResponse({ success: true });
      return true;
    }
    if (request.action === "DISABLE_ADBLOCK") {
      console.log("[Content] Disabling ad blocking...");
      disableAdBlocking();
      sendResponse({ success: true });
      return true;
    }
  });
  var enableAdBlocking = () => {
    if (adBlockingActive) {
      console.log("[Content] Ad blocking already active");
      return;
    }
    console.log("[Content] Hiding ad elements...");
    adBlockingActive = true;
    hideAdElements();
    setupAdBlockObserver();
  };
  var disableAdBlocking = () => {
    if (!adBlockingActive) {
      console.log("[Content] Ad blocking already disabled");
      return;
    }
    console.log("[Content] Showing ad elements...");
    adBlockingActive = false;
    const hiddenAds = document.querySelectorAll('[data-ad-hidden="true"]');
    hiddenAds.forEach((ad) => {
      ad.style.display = "";
      ad.removeAttribute("data-ad-hidden");
    });
  };
  var adObserver = null;
  var hideAdElements = () => {
    AD_SELECTORS.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(
          `[Content] Found ${elements.length} elements matching ${selector}`,
        );
        elements.forEach((el) => {
          const htmlEl = el;
          htmlEl.style.display = "none";
          htmlEl.setAttribute("data-ad-hidden", "true");
        });
      } catch (error) {
        console.error(`[Content] Error with selector ${selector}:`, error);
      }
    });
  };
  var setupAdBlockObserver = () => {
    if (adObserver) {
      adObserver.disconnect();
    }
    adObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            for (const selector of AD_SELECTORS) {
              try {
                if (element.matches && element.matches(selector)) {
                  console.log("[Content] Hiding dynamically added ad element");
                  element.style.display = "none";
                  element.setAttribute("data-ad-hidden", "true");
                }
                const adChildren = element.querySelectorAll(selector);
                if (adChildren.length > 0) {
                  console.log(
                    `[Content] Hiding ${adChildren.length} ad children`,
                  );
                  adChildren.forEach((child) => {
                    const htmlChild = child;
                    htmlChild.style.display = "none";
                    htmlChild.setAttribute("data-ad-hidden", "true");
                  });
                }
              } catch (error) {}
            }
          }
        }
      }
    });
    adObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    console.log("[Content] Ad block observer active");
  };
})();
