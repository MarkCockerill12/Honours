// Mobile Device-Level Ad Blocking
// Uses DNS configuration or local VPN for system-wide blocking on mobile devices
import { ADGUARD_DNS, COMPREHENSIVE_DOMAINS, COST_PER_GB } from "@/lib/constants";
import { TrackerStats } from "@/components/types";

export interface MobileAdBlockConfig {
  enabled: boolean;
  method: "dns-profile" | "local-vpn" | "private-dns";
  dnsServers: string[];
}

// Mobile-optimized DNS servers are now imported from packages/ui/constants as ADGUARD_DNS
export const MOBILE_DNS_SERVERS = {
  adguard: {
    ipv4: [ADGUARD_DNS.primary, ADGUARD_DNS.secondary],
    ipv6: ADGUARD_DNS.ipv6,
    dns_over_https: ADGUARD_DNS.dns_over_https,
    dns_over_tls: ADGUARD_DNS.dns_over_tls,
    description: "AdGuard DNS - Blocks ads, trackers, malware",
  },
  // ... other providers can stay or be unified later if they exist in multiple places
  cloudflare_malware: {
    ipv4: ["1.1.1.2", "1.0.0.2"],
    ipv6: ["2606:4700:4700::1112", "2606:4700:4700::1002"],
    dns_over_https: "https://security.cloudflare-dns.com/dns-query",
    dns_over_tls: "security.cloudflare-dns.com",
    description: "Cloudflare for Families - Blocks malware",
  },
  quad9: {
    ipv4: ["9.9.9.9", "149.112.112.112"],
    ipv6: ["2620:fe::fe", "2620:fe::9"],
    dns_over_https: "https://dns.quad9.net/dns-query",
    dns_over_tls: "dns.quad9.net",
    description: "Quad9 - Blocks malicious domains",
  },
};

/**
 * Generate iOS Configuration Profile for DNS-based ad blocking
 * This can be saved as a .mobileconfig file and installed on iOS devices
 */
export const generateiOSConfigProfile = (): string => {
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  const uuid3 = generateUUID();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerURL</key>
                <string>${MOBILE_DNS_SERVERS.adguard.dns_over_https}</string>
            </dict>
            <key>PayloadDescription</key>
            <string>Configures device to use AdGuard DNS for ad blocking</string>
            <key>PayloadDisplayName</key>
            <string>AdGuard DNS</string>
            <key>PayloadIdentifier</key>
            <string>com.privacyprotector.dnsadguard.${uuid2}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${uuid2}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>ProhibitDisablement</key>
            <false/>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Installs AdGuard DNS for system-wide ad blocking on iOS</string>
    <key>PayloadDisplayName</key>
    <string>Privacy Protector - Ad Blocking DNS</string>
    <key>PayloadIdentifier</key>
    <string>com.privacyprotector.dns.${uuid1}</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${uuid1}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;
};

/**
 * Generate Android Private DNS instructions
 */
export const getAndroidPrivateDNSInstructions = (): string => {
  return `
# Android Ad Blocking Setup - Private DNS (Android 9+)

## Method 1: Private DNS (Recommended for Android 9+)
1. Open Settings
2. Go to "Network & Internet" or "Connections"
3. Tap "Private DNS" or "Advanced"
4. Select "Private DNS provider hostname"
5. Enter: ${MOBILE_DNS_SERVERS.adguard.dns_over_tls}
6. Tap "Save"

This blocks ads in ALL apps system-wide!

## Method 2: WiFi DNS (Works on older Android)
1. Open Settings > WiFi
2. Long press your connected network
3. Tap "Modify network"
4. Show advanced options
5. Change "IP settings" to "Static"
6. Set DNS 1: ${MOBILE_DNS_SERVERS.adguard.ipv4[0]}
7. Set DNS 2: ${MOBILE_DNS_SERVERS.adguard.ipv4[1]}
8. Save

Note: This only works on WiFi, not mobile data.

## Method 3: Use a DNS Changer App
Download "Intra" (by Jigsaw) or "DNS Changer" from Play Store:
- No root required
- Works on mobile data + WiFi
- Free and open source
- Configure with: ${MOBILE_DNS_SERVERS.adguard.dns_over_https}
`;
};

/**
 * Generate setup instructions for iOS
 */
export const getiOSSetupInstructions = (): string => {
  return `
# iOS Ad Blocking Setup

## Method 1: DNS Profile (Recommended)
1. Download the iOS configuration profile from the app
2. Go to Settings > Profile Downloaded
3. Tap "Install" (enter passcode if prompted)
4. Tap "Install" again to confirm
5. Done! Ads are now blocked system-wide

To remove:
Settings > General > VPN & Device Management > DNS Profile > Remove

## Method 2: Manual DNS Configuration (WiFi only)
1. Open Settings > WiFi
2. Tap the (i) icon next to your network
3. Scroll to "Configure DNS"
4. Tap "Manual"
5. Remove existing DNS servers
6. Add DNS Server: ${MOBILE_DNS_SERVERS.adguard.ipv4[0]}
7. Add DNS Server: ${MOBILE_DNS_SERVERS.adguard.ipv4[1]}
8. Tap "Save"

Note: This only works on WiFi networks.

## Method 3: Use DNSCloak or AdGuard App
Download from App Store:
- "DNSCloak" (free, open source)
- "AdGuard" (freemium)
- Configure with: ${MOBILE_DNS_SERVERS.adguard.dns_over_https}
`;
};

/**
 * Local VPN configuration for Android (React Native)
 * This creates a local VPN that filters traffic through ad blocking rules
 */
export const ANDROID_VPN_CONFIG = {
  description: `Privacy Protector uses a local VPN to block ads and trackers.
  
How it works:
1. Creates a local VPN connection on your device
2. All network traffic goes through the VPN
3. Ad/tracker requests are blocked before reaching the internet
4. Regular traffic passes through normally

Benefits:
- Works on WiFi AND mobile data
- Blocks ads in ALL apps (browsers, games, social media)
- No external VPN server needed (all processing on-device)
- No data leaves your device
- Free and private

Technical:
- Uses Android VPN Service API
- Implements DNS-based filtering
- Blocks known ad/tracker domains
- Does NOT send data to external servers
`,
  blockedDomains: COMPREHENSIVE_DOMAINS,
};

/**
 * Generate UUID for iOS config profile
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if device supports Private DNS (Android 9+)
 */
export const supportsPrivateDNS = (): boolean => {
  // This would check Android version in a React Native app
  // For now, return true for modern devices
  return true;
};

/**
 * Download iOS config profile
 */
export const downloadiOSProfile = () => {
  const profile = generateiOSConfigProfile();
  const blob = new Blob([profile], {
    type: "application/x-apple-aspen-config",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "PrivacyProtector-AdBlock.mobileconfig";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Statistics tracking for mobile
 */
export interface MobileBlockStats extends TrackerStats {
  blockedToday: number;
  blockedThisWeek: number;
}

/**
 * Calculate mobile data savings
 * UK mobile data costs: £5-10 per GB
 */
export const calculateMobileSavings = (bytesBlocked: number): number => {
  const gbBlocked = bytesBlocked / (1024 * 1024 * 1024);
  return gbBlocked * COST_PER_GB;
};
