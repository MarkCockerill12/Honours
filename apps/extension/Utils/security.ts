// A mock database of bad domains for the prototype
const THREAT_DB = [
  "suspicious-bank-login.com",
  "free-iphone-giveaway.net",
  "paypal-secure-verify.xyz"
];

export interface SecurityScanResult {
  isSafe: boolean;
  threatType?: 'phishing' | 'malware' | 'tracker';
}

export const scanUrl = (url: string): SecurityScanResult => {
  try {
    const hostname = new URL(url).hostname;

    // Check 1: Known Bad DB
    if (THREAT_DB.some(bad => hostname.includes(bad))) {
      return { isSafe: false, threatType: 'phishing' };
    }

    // Check 2: Heuristic (Too many subdomains is sketchy)
    // e.g., secure.login.paypal.verify.com
    if (hostname.split('.').length > 5) {
      return { isSafe: false, threatType: 'malware' };
    }

    return { isSafe: true };
  } catch (e) {
    return { isSafe: true }; // Fail open if URL is invalid
  }
};