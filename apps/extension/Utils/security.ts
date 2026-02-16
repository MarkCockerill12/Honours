// TODO: Replace with a production-grade threat intelligence API (e.g. Google Safe Browsing)

// Local Threat Database
const THREAT_DB = {
  PHISHING_DOMAINS: [
    "login-apple-id.com",
    "secure-paypal-verify.net",
    "crypto-wallet-update.io",
    "free-robux-generator.com",
    "bank-of-america-alert.xyz",
    "netflix-account-update.com"
  ],
  MALWARE_PATTERNS: [
    "exe", "dmg", "zip", "tar.gz", "bat", "sh" 
  ]
};

export interface ScanResult {
  url: string;
  isSafe: boolean;
  threatType: 'safe' | 'phishing' | 'malware' | 'suspicious';
  details?: string;
}

export const scanUrl = (urlString: string): ScanResult => {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // 1. Check Known Phishing DB
    if (THREAT_DB.PHISHING_DOMAINS.some(domain => hostname.includes(domain))) {
      return { url: urlString, isSafe: false, threatType: 'phishing', details: 'Known Phishing Domain' };
    }

    // 2. Check IP Address Hostnames (Often used by malware)
    // Matches 192.168.1.1 etc.
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return { url: urlString, isSafe: false, threatType: 'suspicious', details: 'Raw IP Address Usage' };
    }

    // 3. Check for File Extensions in URL (Malware Download)
    const extension = pathname.split('.').pop();
    if (extension && THREAT_DB.MALWARE_PATTERNS.includes(extension)) {
      return { url: urlString, isSafe: false, threatType: 'malware', details: `Dangerous .${extension} file` };
    }

    return { url: urlString, isSafe: true, threatType: 'safe' };
  } catch (e) {
    // If URL is invalid, treat as safe or ignore
    return { url: urlString, isSafe: true, threatType: 'safe' }; 
  }
};