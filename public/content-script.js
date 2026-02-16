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
    try {
      const url = new URL(urlString);
      const hostname = url.hostname.toLowerCase();
      const pathname = url.pathname.toLowerCase();
      if (THREAT_DB.PHISHING_DOMAINS.some((domain) => hostname.includes(domain))) {
        return { url: urlString, isSafe: false, threatType: "phishing", details: "Known Phishing Domain" };
      }
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
        if (hostname !== "127.0.0.1" && hostname !== "localhost") {
          return { url: urlString, isSafe: false, threatType: "suspicious", details: "Raw IP Address Usage" };
        }
      }
      const extension = pathname.split(".").pop();
      if (extension && THREAT_DB.MALWARE_PATTERNS.includes(extension)) {
        return { url: urlString, isSafe: false, threatType: "malware", details: `Dangerous .${extension} file` };
      }
      return { url: urlString, isSafe: true, threatType: "safe" };
    } catch (e) {
      return { url: urlString, isSafe: true, threatType: "safe" };
    }
  };

  // apps/extension/Utils/content.ts
  var blurContent = (rootElement, keywords) => {
    if (!keywords || keywords.length === 0) return;
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    const nodesToBlur = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent?.toLowerCase();
      const hasKeyword = keywords.some((k) => text?.includes(k.toLowerCase()));
      if (hasKeyword) {
        nodesToBlur.push(node);
      }
    }
    nodesToBlur.forEach((textNode) => {
      const span = document.createElement("span");
      span.innerHTML = textNode.textContent || "";
      span.style.filter = "blur(6px)";
      span.style.cursor = "pointer";
      span.style.transition = "0.3s";
      span.onclick = () => {
        span.style.filter = "none";
      };
      textNode.replaceWith(span);
    });
    return nodesToBlur.length;
  };
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCAN_PAGE_LINKS") {
      if (document.contentType === "application/pdf" || window.location.href.endsWith(".pdf")) {
        sendResponse({
          type: "PDF",
          linkCount: 0,
          maliciousCount: 0,
          maliciousLinks: []
        });
        return;
      }
      const links = Array.from(document.querySelectorAll("a[href]"));
      const results = [];
      for (const link of links) {
        const scan = scanUrl(link.href);
        if (!scan.isSafe) {
          link.style.border = "2px solid red";
          link.title = `\u26A0\uFE0F THREAT: ${scan.details}`;
          results.push(scan);
        }
      }
      sendResponse({
        type: "WEB",
        linkCount: links.length,
        maliciousCount: results.length,
        maliciousLinks: results
      });
    }
  });
})();
