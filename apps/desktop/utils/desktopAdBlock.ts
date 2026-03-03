// Desktop-level Ad Blocking via DNS
// Uses AdGuard DNS or hosts file modification for system-wide ad blocking

export interface DesktopAdBlockConfig {
  enabled: boolean;
  method: "adguard-dns" | "hosts-file" | "system-proxy";
  customDnsServers?: string[];
}

// AdGuard DNS Servers (free, no-log, ad-blocking DNS)
export const ADGUARD_DNS_SERVERS = {
  default: {
    ipv4: ["94.140.14.14", "94.140.15.15"],
    ipv6: ["2a10:50c0::ad1:ff", "2a10:50c0::ad2:ff"],
    description: "AdGuard DNS (Default) - Blocks ads, trackers, and phishing",
  },
  family: {
    ipv4: ["94.140.14.15", "94.140.15.16"],
    ipv6: ["2a10:50c0::bad1:ff", "2a10:50c0::bad2:ff"],
    description: "AdGuard DNS (Family Protection) - Blocks ads + adult content",
  },
  unfiltered: {
    ipv4: ["94.140.14.140", "94.140.14.141"],
    ipv6: ["2a10:50c0::1:ff", "2a10:50c0::2:ff"],
    description: "AdGuard DNS (Unfiltered) - No blocking, just secure DNS",
  },
};

// Alternative DNS providers
export const DNS_PROVIDERS = {
  cloudflare_malware: {
    ipv4: ["1.1.1.2", "1.0.0.2"],
    ipv6: ["2606:4700:4700::1112", "2606:4700:4700::1002"],
    description: "Cloudflare - Blocks malware",
  },
  cloudflare_malware_adult: {
    ipv4: ["1.1.1.3", "1.0.0.3"],
    ipv6: ["2606:4700:4700::1113", "2606:4700:4700::1003"],
    description: "Cloudflare - Blocks malware and adult content",
  },
  quad9: {
    ipv4: ["9.9.9.9", "149.112.112.112"],
    ipv6: ["2620:fe::fe", "2620:fe::9"],
    description: "Quad9 - Blocks malicious domains",
  },
};

// Comprehensive ad/tracker domains (combined from multiple sources)
export const DESKTOP_BLOCKLIST = [
  // Google Ads
  "0.0.0.0 doubleclick.net",
  "0.0.0.0 googlesyndication.com",
  "0.0.0.0 googleadservices.com",
  "0.0.0.0 googletagmanager.com",
  "0.0.0.0 googletagservices.com",
  "0.0.0.0 www.googleadservices.com",
  "0.0.0.0 pagead2.googlesyndication.com",
  "0.0.0.0 tpc.googlesyndication.com",

  // Facebook/Meta
  "0.0.0.0 facebook.com",
  "0.0.0.0 www.facebook.com",
  "0.0.0.0 connect.facebook.net",
  "0.0.0.0 staticxx.facebook.com",
  "0.0.0.0 www.instagram.com",
  "0.0.0.0 i.instagram.com",

  // Amazon Ads
  "0.0.0.0 amazon-adsystem.com",
  "0.0.0.0 s.amazon-adsystem.com",
  "0.0.0.0 amazonclix.com",

  // Major Ad Networks
  "0.0.0.0 adnxs.com",
  "0.0.0.0 advertising.com",
  "0.0.0.0 adsrvr.org",
  "0.0.0.0 adroll.com",
  "0.0.0.0 adsafeprotected.com",
  "0.0.0.0 criteo.com",
  "0.0.0.0 criteo.net",
  "0.0.0.0 casalemedia.com",
  "0.0.0.0 pubmatic.com",
  "0.0.0.0 rubiconproject.com",
  "0.0.0.0 taboola.com",
  "0.0.0.0 outbrain.com",
  "0.0.0.0 revcontent.com",
  "0.0.0.0 mgid.com",

  // Analytics
  "0.0.0.0 google-analytics.com",
  "0.0.0.0 www.google-analytics.com",
  "0.0.0.0 analytics.google.com",
  "0.0.0.0 hotjar.com",
  "0.0.0.0 mouseflow.com",
  "0.0.0.0 clarity.ms",
  "0.0.0.0 fullstory.com",
  "0.0.0.0 segment.com",
  "0.0.0.0 segment.io",
  "0.0.0.0 mixpanel.com",
  "0.0.0.0 amplitude.com",

  // YouTube Ads (careful - may break some functionality)
  "0.0.0.0 ads.youtube.com",

  // Social Media Trackers
  "0.0.0.0 ads-twitter.com",
  "0.0.0.0 static.ads-twitter.com",

  // More Ad Networks
  "0.0.0.0 media.net",
  "0.0.0.0 adtechus.com",
  "0.0.0.0 2mdn.net",
  "0.0.0.0 adj.st",
];

/**
 * Generate instructions for setting up DNS-based ad blocking on desktop
 */
export const generateDesktopSetupInstructions = (
  method: "dns" | "hosts",
): string => {
  if (method === "dns") {
    return `
# Desktop Ad Blocking Setup - DNS Method (Recommended)

## Windows:
1. Open Settings > Network & Internet > Status
2. Click "Change adapter options"
3. Right-click your network connection > Properties
4. Select "Internet Protocol Version 4 (TCP/IPv4)" > Properties
5. Select "Use the following DNS server addresses"
6. Preferred DNS: ${ADGUARD_DNS_SERVERS.default.ipv4[0]}
7. Alternate DNS: ${ADGUARD_DNS_SERVERS.default.ipv4[1]}
8. Click OK

## macOS:
1. Open System Preferences > Network
2. Select your network connection > Advanced
3. Go to DNS tab
4. Click + and add: ${ADGUARD_DNS_SERVERS.default.ipv4[0]}
5. Click + and add: ${ADGUARD_DNS_SERVERS.default.ipv4[1]}
6. Click OK > Apply

## Linux:
1. Edit /etc/resolv.conf (requires sudo)
2. Add these lines:
   nameserver ${ADGUARD_DNS_SERVERS.default.ipv4[0]}
   nameserver ${ADGUARD_DNS_SERVERS.default.ipv4[1]}
3. Save and restart network service

This method blocks ads system-wide for ALL applications.
No configuration needed in individual browsers.
`;
  } else {
    return `
# Desktop Ad Blocking Setup - Hosts File Method

## Windows:
1. Open Notepad as Administrator
2. Open: C:\\Windows\\System32\\drivers\\etc\\hosts
3. Add the blocking entries (see generated file)
4. Save the file
5. Flush DNS: Open CMD and run: ipconfig /flushdns

## macOS/Linux:
1. Open Terminal
2. Edit hosts file: sudo nano /etc/hosts
3. Add the blocking entries (see generated file)
4. Save (Ctrl+X, Y, Enter)
5. Flush DNS:
   - macOS: sudo dscacheutil -flushcache
   - Linux: sudo systemctl restart systemd-resolved

## Generated Hosts File Entries:
${DESKTOP_BLOCKLIST.join("\n")}

This method blocks ads by redirecting ad domains to 0.0.0.0 (nowhere).
Works system-wide for ALL applications and browsers.
`;
  }
};

/**
 * Check current DNS configuration (for Electron app)
 */
export const checkCurrentDNS = async (): Promise<{
  servers: string[];
  isAdBlocking: boolean;
}> => {
  // This would be implemented in the Electron main process
  // For now, return a placeholder
  return {
    servers: ["system-default"],
    isAdBlocking: false,
  };
};

/**
 * Export hosts file content for easy download
 */
export const generateHostsFileContent = (): string => {
  const header = `# Ad Blocking Hosts File
# Generated by Privacy Protector
# Date: ${new Date().toISOString()}
# Entries: ${DESKTOP_BLOCKLIST.length}
#
# This file blocks ads, trackers, and malicious domains system-wide.
# Installation: See README or setup instructions
#

# Localhost
127.0.0.1 localhost
::1 localhost

# Ad/Tracker Blocking
${DESKTOP_BLOCKLIST.join("\n")}
`;

  return header;
};
