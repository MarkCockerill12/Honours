// Enhanced Cyber Security Scanner - Threat Intelligence Module
// Uses heuristic analysis, pattern matching, and known threat databases

// Local Threat Database — expanded with comprehensive lists
const THREAT_DB = {
  PHISHING_DOMAINS: [
    // Generic phishing patterns — domains that impersonate real brands
    "login-apple-id.com",
    "secure-paypal-verify.net",
    "crypto-wallet-update.io",
    "free-robux-generator.com",
    "bank-of-america-alert.xyz",
    "netflix-account-update.com",
    "microsoft-security-alert.com",
    "amazon-refund-process.net",
    "google-account-verify.com",
    "facebook-confirm-identity.com",
    "instagram-recovery.net",
    "dropbox-share-verify.com",
    "icloud-verify-account.com",
    "wellsfargo-secure-login.com",
    "chase-secure-verify.com",
    "linkedin-verify-account.com",
    "twitter-confirm-login.com",
    "coinbase-verify-wallet.com",
    "binance-secure-login.com",
    "metamask-verify-wallet.io",
  ],
  // ONLY truly executable/dangerous file extensions — NOT normal web assets
  DANGEROUS_EXTENSIONS: [
    "exe", "msi", "bat", "cmd", "scr", "pif", "vbs", "vbe",
    "jse", "wsf", "wsc", "ps1", "psm1", "reg", "inf", "hta",
    "cpl", "sct",
  ],
  // Known malicious TLDs (free or frequently abused)
  SUSPICIOUS_TLDS: [
    ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".work", ".click", ".loan",
    ".download", ".win", ".racing", ".review", ".stream", ".gdn", ".bid",
    ".date", ".trade", ".accountant",
  ],
  // TLDs that are almost always safe/official
  OFFICIAL_TLDS: [
    ".com", ".net", ".org", ".edu", ".gov", ".mil", ".io", ".app", ".dev",
    ".co.uk", ".de", ".fr", ".jp", ".co", ".me", ".info", ".uk", ".us",
    ".ca", ".au", ".eu",
  ],
  // Trusted domains that should NEVER be flagged — includes subdomains
  TRUSTED_DOMAINS: [
    "facebook.com", "google.com", "google.co.uk", "youtube.com", "apple.com",
    "icloud.com", "microsoft.com", "live.com", "outlook.com", "amazon.com",
    "amazon.co.uk", "netflix.com", "paypal.com", "twitter.com", "x.com",
    "linkedin.com", "github.com", "gitlab.com", "bitbucket.org",
    "dundee.ac.uk", "instructure.com", "canvas-user-content.com",
    "reddit.com", "stackoverflow.com", "wikipedia.org", "mozilla.org",
    "cloudflare.com", "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com",
    "fonts.googleapis.com", "fonts.gstatic.com", "ajax.googleapis.com",
    "static.xx.fbcdn.net", "fbcdn.net", "akamaihd.net", "twimg.com",
    "instagram.com", "whatsapp.com", "signal.org", "zoom.us",
    "slack.com", "discord.com", "notion.so", "figma.com",
  ],
  // URL shorteners (not inherently malicious, but worth flagging)
  URL_SHORTENERS: [
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "buff.ly",
    "ow.ly", "adf.ly", "shorte.st", "bc.vc",
  ],
  // Known tracker/ad domains
  TRACKER_DOMAINS: [
    "doubleclick.net", "googlesyndication.com", "googleadservices.com",
    "analytics.google.com", "ads.yahoo.com", "advertising.com", "adnxs.com",
    "rubiconproject.com", "pubmatic.com",
  ],
};

// Heuristic scoring thresholds — raised to reduce false positives
const HEURISTIC_THRESHOLDS = {
  SUSPICIOUS: 4, // Score >= 4 = suspicious (was 3)
  DANGEROUS: 7,  // Score >= 7 = likely dangerous (was 6)
};

export interface ScanResult {
  url: string;
  isSafe: boolean;
  threatType:
    | "safe"
    | "phishing"
    | "malware"
    | "suspicious"
    | "tracker"
    | "redirect";
  details?: string;
  score?: number; // Heuristic risk score (0-10)
}

// Check if a hostname or any of its parent domains is in the trusted list
const isTrustedDomain = (hostname: string): boolean => {
  return THREAT_DB.TRUSTED_DOMAINS.some(
    (trusted) => hostname === trusted || hostname.endsWith("." + trusted),
  );
};

// Heuristic analysis — scores URL on multiple risk factors
const heuristicAnalysis = (url: URL): { score: number; factors: string[] } => {
  const hostname = url.hostname.toLowerCase();
  const fullUrl = url.href.toLowerCase();
  let score = 0;
  const factors: string[] = [];

  // 1. Excessive subdomains (>4 levels = suspicious, ignore www)
  const baseHostname = hostname.replace(/^www\./, "");
  const subdomainCount = baseHostname.split(".").length;
  if (subdomainCount > 4) {
    score += 2;
    factors.push(`Excessive subdomains (${subdomainCount} levels)`);
  }

  // 2. Very long hostnames (>50 chars — raised from 40)
  if (hostname.length > 50) {
    score += 1;
    factors.push("Unusually long hostname");
  }

  // 3. Contains suspicious keywords in hostname
  // Only flag if 3+ keywords found (raised from 2)
  const suspiciousKeywords = [
    "verify", "confirm", "alert", "suspend", "password",
    "wallet", "recover", "refund", "crypto", "free",
    "prize", "winner", "lucky",
  ];
  // NOTE: Removed "login", "secure", "account", "update", "bank", "paypal"
  // These appear on many legitimate sites and cause excessive false positives
  const matchedKeywords = suspiciousKeywords.filter((kw) =>
    hostname.includes(kw),
  );
  if (matchedKeywords.length >= 3) {
    score += 3;
    factors.push(`Multiple suspicious keywords: ${matchedKeywords.join(", ")}`);
  } else if (matchedKeywords.length >= 2) {
    score += 2;
    factors.push(`Suspicious keywords: ${matchedKeywords.join(", ")}`);
  } else if (matchedKeywords.length === 1) {
    score += 1;
    factors.push(`Suspicious keyword: ${matchedKeywords[0]}`);
  }

  // 4. Brand name + suspicious TLD combo
  const brandNames = [
    "apple", "google", "microsoft", "amazon", "facebook", "netflix",
    "paypal", "instagram", "twitter", "coinbase", "binance",
  ];
  const hasBrand = brandNames.some((brand) => hostname.includes(brand));
  const isOfficialTLD = THREAT_DB.OFFICIAL_TLDS.some((tld) =>
    hostname.endsWith(tld),
  );

  if (hasBrand && !isOfficialTLD) {
    score += 3;
    factors.push("Brand name on non-standard TLD");
  }

  // 5. Suspicious TLD
  if (THREAT_DB.SUSPICIOUS_TLDS.some((tld) => hostname.endsWith(tld))) {
    score += 2;
    factors.push("Suspicious top-level domain");
  }

  // 6. Contains @ symbol (URL obfuscation)
  if (fullUrl.includes("@")) {
    score += 3;
    factors.push("Contains @ symbol (URL obfuscation)");
  }

  // 7. Numeric hostname that isn't local
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (
      !hostname.startsWith("192.168.") &&
      !hostname.startsWith("10.") &&
      hostname !== "127.0.0.1" &&
      hostname !== "localhost"
    ) {
      score += 2;
      factors.push("Non-local IP address");
    }
  }

  // 8. HTTP instead of HTTPS
  if (
    url.protocol === "http:" &&
    hostname !== "localhost" &&
    !hostname.startsWith("192.168.") &&
    !hostname.startsWith("127.")
  ) {
    score += 1;
    factors.push("Insecure HTTP connection");
  }

  // 9. Very long URL (>200 chars), ignoring hash fragments
  const urlWithoutHash = fullUrl.split("#")[0];
  if (urlWithoutHash.length > 250) {
    score += 1;
    factors.push("Extremely long URL");
  }

  // 10. Multiple redirects/parameters
  const paramCount = url.searchParams.toString().split("&").length;
  if (paramCount > 8) {
    score += 1;
    factors.push(`Excessive URL parameters (${paramCount})`);
  }

  // 11. Contains encoded/obfuscated characters (ignore hash fragment)
  const encodedChars = (urlWithoutHash.match(/%[0-9a-fA-F]{2}/g) || []).length;
  if (encodedChars > 8) {
    score += 2;
    factors.push(`Heavily encoded URL (${encodedChars} encoded chars)`);
  }

  // 12. Homograph attack detection (mixed scripts)
  if (/xn--/.test(hostname)) {
    score += 3;
    factors.push(
      "Punycode/internationalized domain (possible homograph attack)",
    );
  }

  return { score: Math.min(score, 10), factors };
};

export const scanUrl = (urlString: string): ScanResult => {
  console.log(`[Security] Scanning URL: ${urlString}`);

  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 0. Trusted Domain Check (Fast bailout) — applies to all sub-resources too
    if (isTrustedDomain(hostname)) {
      console.log(`[Security] Whitelisted domain detected: ${hostname}`);
      return { url: urlString, isSafe: true, threatType: "safe", score: 0 };
    }

    // 1. Check Known Phishing DB (exact match)
    if (
      THREAT_DB.PHISHING_DOMAINS.some((domain) => hostname.includes(domain))
    ) {
      console.log(`[Security] THREAT: Phishing domain detected in ${hostname}`);
      return {
        url: urlString,
        isSafe: false,
        threatType: "phishing",
        details: "Known Phishing Domain",
        score: 10,
      };
    }

    // 2. Check URL shorteners (flag as redirect risk)
    if (
      THREAT_DB.URL_SHORTENERS.some(
        (shortener) =>
          hostname === shortener || hostname.endsWith("." + shortener),
      )
    ) {
      console.log(`[Security] WARNING: URL shortener detected - ${hostname}`);
      return {
        url: urlString,
        isSafe: false,
        threatType: "redirect",
        details: "URL Shortener (potential redirect risk)",
        score: 4,
      };
    }

    // 3. Check for TRULY dangerous file extensions only
    const extension = pathname.split(".").pop();
    if (extension && THREAT_DB.DANGEROUS_EXTENSIONS.includes(extension)) {
      console.log(`[Security] THREAT: Dangerous file extension .${extension}`);
      return {
        url: urlString,
        isSafe: false,
        threatType: "malware",
        details: `Dangerous .${extension} file download`,
        score: 8,
      };
    }

    // 4. Check tracking domains
    if (THREAT_DB.TRACKER_DOMAINS.some((domain) => hostname.includes(domain))) {
      console.log(`[Security] TRACKER: Known tracking domain - ${hostname}`);
      return {
        url: urlString,
        isSafe: false,
        threatType: "tracker",
        details: "Known Advertising/Tracking Domain",
        score: 3,
      };
    }

    // 5. Heuristic analysis
    const { score, factors } = heuristicAnalysis(url);

    if (score >= HEURISTIC_THRESHOLDS.DANGEROUS) {
      console.log(
        `[Security] THREAT: Heuristic score ${score}/10 - ${factors.join(", ")}`,
      );
      return {
        url: urlString,
        isSafe: false,
        threatType: "suspicious",
        details: `High risk (${score}/10): ${factors.slice(0, 3).join(", ")}`,
        score,
      };
    }

    if (score >= HEURISTIC_THRESHOLDS.SUSPICIOUS) {
      console.log(
        `[Security] WARNING: Heuristic score ${score}/10 - ${factors.join(", ")}`,
      );
      return {
        url: urlString,
        isSafe: false,
        threatType: "suspicious",
        details: `Moderate risk (${score}/10): ${factors.slice(0, 2).join(", ")}`,
        score,
      };
    }

    console.log(`[Security] URL is SAFE (score ${score}/10): ${urlString}`);
    return { url: urlString, isSafe: true, threatType: "safe", score };
  } catch (e) {
    console.log(
      `[Security] Invalid URL format, treating as safe: ${urlString}`,
    );
    return { url: urlString, isSafe: true, threatType: "safe", score: 0 };
  }
};

// Bulk scan utility
export const scanUrls = (
  urls: string[],
): { safe: ScanResult[]; threats: ScanResult[] } => {
  const results = urls.map(scanUrl);
  return {
    safe: results.filter((r) => r.isSafe),
    threats: results.filter((r) => !r.isSafe),
  };
};

// --- Google Safe Browsing API v4 Integration ---
// This provides REAL threat intelligence on top of local heuristics.
// The API call is proxied through the background script to keep the API key secure.

export interface SafeBrowsingResult {
  isMalicious: boolean;
  threats: string[];
  source: "google_safe_browsing";
}

/**
 * Check a URL against Google Safe Browsing API v4.
 * This must be called from the background script context (has fetch access).
 */
export const checkSafeBrowsing = async (
  url: string,
  apiKey: string,
): Promise<SafeBrowsingResult> => {
  if (!apiKey) {
    return { isMalicious: false, threats: [], source: "google_safe_browsing" };
  }

  try {
    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
    const body = {
      client: { clientId: "lofi-web-extension", clientVersion: "1.0.0" },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`[Security] Safe Browsing API error: ${response.status}`);
      return { isMalicious: false, threats: [], source: "google_safe_browsing" };
    }

    const data = await response.json();
    const matches = data.matches || [];

    if (matches.length > 0) {
      const threats = matches.map(
        (m: any) => `${m.threatType} (${m.platformType})`,
      );
      console.log(`[Security] Safe Browsing THREAT for ${url}:`, threats);
      return { isMalicious: true, threats, source: "google_safe_browsing" };
    }

    return { isMalicious: false, threats: [], source: "google_safe_browsing" };
  } catch (e) {
    console.warn("[Security] Safe Browsing API call failed:", e);
    return { isMalicious: false, threats: [], source: "google_safe_browsing" };
  }
};

/**
 * Enhanced scan: local heuristics + Google Safe Browsing API.
 * Returns the local result immediately, then enhances with Safe Browsing.
 */
export const scanUrlEnhanced = async (
  urlString: string,
  apiKey: string,
): Promise<ScanResult> => {
  // 1. Start with fast local scan
  const localResult = scanUrl(urlString);

  // 2. If already flagged locally, return immediately
  if (!localResult.isSafe) return localResult;

  // 3. Check against Google Safe Browsing
  const sbResult = await checkSafeBrowsing(urlString, apiKey);
  if (sbResult.isMalicious) {
    return {
      url: urlString,
      isSafe: false,
      threatType: "malware",
      details: `Google Safe Browsing: ${sbResult.threats.join(", ")}`,
      score: 10,
    };
  }

  return localResult;
};
