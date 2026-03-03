// Enhanced Cyber Security Scanner - Threat Intelligence Module
// Uses heuristic analysis, pattern matching, and known threat databases

// Local Threat Database — expanded with comprehensive lists
const THREAT_DB = {
  PHISHING_DOMAINS: [
    // Generic phishing patterns
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
  MALWARE_PATTERNS: [
    "exe", "dmg", "zip", "tar.gz", "bat", "sh", "cmd", "scr",
    "pif", "com", "msi", "vbs", "js", "jse", "wsf", "wsc",
    "ps1", "psm1", "reg", "inf", "hta", "cpl", "sct",
  ],
  // Known malicious TLDs (free or frequently abused)
  SUSPICIOUS_TLDS: [
    ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work",
    ".click", ".loan", ".download", ".win", ".racing", ".review",
    ".stream", ".gdn", ".bid", ".date", ".trade", ".accountant",
  ],
  // URL shorteners (not inherently malicious, but suspicious in some contexts)
  URL_SHORTENERS: [
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd",
    "buff.ly", "ow.ly", "adf.ly", "shorte.st", "bc.vc",
  ],
  // Known tracker/ad domains (lightweight, for heuristic scoring)
  TRACKER_DOMAINS: [
    "doubleclick.net", "googlesyndication.com", "googleadservices.com",
    "facebook.net", "fbcdn.net", "analytics.google.com",
    "connect.facebook.net", "ads.yahoo.com", "advertising.com",
    "adnxs.com", "rubiconproject.com", "pubmatic.com",
  ],
};

// Heuristic scoring thresholds
const HEURISTIC_THRESHOLDS = {
  SUSPICIOUS: 3,  // Score >= 3 = suspicious
  DANGEROUS: 6,   // Score >= 6 = likely dangerous
};

export interface ScanResult {
  url: string;
  isSafe: boolean;
  threatType: 'safe' | 'phishing' | 'malware' | 'suspicious' | 'tracker' | 'redirect';
  details?: string;
  score?: number; // Heuristic risk score (0-10)
}

// Heuristic analysis — scores URL on multiple risk factors
const heuristicAnalysis = (url: URL): { score: number; factors: string[] } => {
  const hostname = url.hostname.toLowerCase();
  const fullUrl = url.href.toLowerCase();
  let score = 0;
  const factors: string[] = [];

  // 1. Excessive subdomains (>3 levels = suspicious)
  const subdomainCount = hostname.split('.').length;
  if (subdomainCount > 4) {
    score += 2;
    factors.push(`Excessive subdomains (${subdomainCount} levels)`);
  }

  // 2. Very long hostnames (>40 chars)
  if (hostname.length > 40) {
    score += 1;
    factors.push('Unusually long hostname');
  }

  // 3. Contains suspicious keywords in hostname
  const suspiciousKeywords = [
    'login', 'verify', 'secure', 'account', 'update', 'confirm',
    'alert', 'suspend', 'password', 'wallet', 'recover', 'refund',
    'bank', 'paypal', 'crypto', 'free', 'prize', 'winner', 'lucky',
  ];
  const matchedKeywords = suspiciousKeywords.filter(kw => hostname.includes(kw));
  if (matchedKeywords.length >= 2) {
    score += 3;
    factors.push(`Multiple suspicious keywords: ${matchedKeywords.join(', ')}`);
  } else if (matchedKeywords.length === 1) {
    score += 1;
    factors.push(`Suspicious keyword: ${matchedKeywords[0]}`);
  }

  // 4. Brand name + suspicious TLD combo
  const brandNames = ['apple', 'google', 'microsoft', 'amazon', 'facebook', 'netflix', 'paypal', 'instagram', 'twitter', 'coinbase', 'binance'];
  const hasBrand = brandNames.some(brand => hostname.includes(brand));
  const isNotOfficial = hasBrand && !hostname.endsWith('.com') && !hostname.endsWith('.co.uk') && !hostname.endsWith('.org');
  if (isNotOfficial && hasBrand) {
    score += 3;
    factors.push('Brand name on non-official domain');
  }

  // 5. Suspicious TLD
  if (THREAT_DB.SUSPICIOUS_TLDS.some(tld => hostname.endsWith(tld))) {
    score += 2;
    factors.push('Suspicious top-level domain');
  }

  // 6. Contains @ symbol (URL obfuscation)
  if (fullUrl.includes('@')) {
    score += 3;
    factors.push('Contains @ symbol (URL obfuscation)');
  }

  // 7. Numeric hostname that isn't local
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (!hostname.startsWith('192.168.') && !hostname.startsWith('10.') && hostname !== '127.0.0.1' && hostname !== 'localhost') {
      score += 2;
      factors.push('Non-local IP address');
    }
  }

  // 8. HTTP instead of HTTPS
  if (url.protocol === 'http:' && hostname !== 'localhost' && !hostname.startsWith('192.168.') && !hostname.startsWith('127.')) {
    score += 1;
    factors.push('Insecure HTTP connection');
  }

  // 9. Very long URL (>200 chars)
  if (fullUrl.length > 200) {
    score += 1;
    factors.push('Extremely long URL');
  }

  // 10. Multiple redirects/parameters
  const paramCount = url.searchParams.toString().split('&').length;
  if (paramCount > 8) {
    score += 1;
    factors.push(`Excessive URL parameters (${paramCount})`);
  }

  // 11. Contains encoded/obfuscated characters
  const encodedChars = (fullUrl.match(/%[0-9a-fA-F]{2}/g) || []).length;
  if (encodedChars > 5) {
    score += 2;
    factors.push(`Heavily encoded URL (${encodedChars} encoded chars)`);
  }

  // 12. Homograph attack detection (mixed scripts)
  if (/xn--/.test(hostname)) {
    score += 3;
    factors.push('Punycode/internationalized domain (possible homograph attack)');
  }

  return { score: Math.min(score, 10), factors };
};

export const scanUrl = (urlString: string): ScanResult => {
  console.log(`[Security] Scanning URL: ${urlString}`);
  
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 1. Check Known Phishing DB (exact match)
    if (THREAT_DB.PHISHING_DOMAINS.some(domain => hostname.includes(domain))) {
      console.log(`[Security] THREAT: Phishing domain detected in ${hostname}`);
      return { url: urlString, isSafe: false, threatType: 'phishing', details: 'Known Phishing Domain', score: 10 };
    }

    // 2. Check URL shorteners (flag as redirect risk)
    if (THREAT_DB.URL_SHORTENERS.some(shortener => hostname === shortener || hostname.endsWith('.' + shortener))) {
      console.log(`[Security] WARNING: URL shortener detected - ${hostname}`);
      return { url: urlString, isSafe: false, threatType: 'redirect', details: 'URL Shortener (potential redirect risk)', score: 4 };
    }

    // 3. Check for dangerous file extensions
    const extension = pathname.split('.').pop();
    if (extension && THREAT_DB.MALWARE_PATTERNS.includes(extension)) {
      console.log(`[Security] THREAT: Dangerous file extension .${extension}`);
      return { url: urlString, isSafe: false, threatType: 'malware', details: `Dangerous .${extension} file download`, score: 8 };
    }

    // 4. Check tracking domains
    if (THREAT_DB.TRACKER_DOMAINS.some(domain => hostname.includes(domain))) {
      console.log(`[Security] TRACKER: Known tracking domain - ${hostname}`);
      return { url: urlString, isSafe: false, threatType: 'tracker', details: 'Known Advertising/Tracking Domain', score: 3 };
    }

    // 5. Heuristic analysis
    const { score, factors } = heuristicAnalysis(url);
    
    if (score >= HEURISTIC_THRESHOLDS.DANGEROUS) {
      console.log(`[Security] THREAT: Heuristic score ${score}/10 - ${factors.join(', ')}`);
      return { 
        url: urlString, 
        isSafe: false, 
        threatType: 'suspicious', 
        details: `High risk (${score}/10): ${factors.slice(0, 3).join(', ')}`,
        score 
      };
    }

    if (score >= HEURISTIC_THRESHOLDS.SUSPICIOUS) {
      console.log(`[Security] WARNING: Heuristic score ${score}/10 - ${factors.join(', ')}`);
      return { 
        url: urlString, 
        isSafe: false, 
        threatType: 'suspicious', 
        details: `Moderate risk (${score}/10): ${factors.slice(0, 2).join(', ')}`,
        score 
      };
    }

    console.log(`[Security] URL is SAFE (score ${score}/10): ${urlString}`);
    return { url: urlString, isSafe: true, threatType: 'safe', score };
  } catch (e) {
    console.log(`[Security] Invalid URL format, treating as safe: ${urlString}`);
    return { url: urlString, isSafe: true, threatType: 'safe', score: 0 }; 
  }
};

// Bulk scan utility
export const scanUrls = (urls: string[]): { safe: ScanResult[]; threats: ScanResult[] } => {
  const results = urls.map(scanUrl);
  return {
    safe: results.filter(r => r.isSafe),
    threats: results.filter(r => !r.isSafe),
  };
};