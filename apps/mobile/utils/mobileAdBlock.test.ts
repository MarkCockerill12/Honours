import { describe, it, expect } from "vitest";
import {
  MOBILE_DNS_SERVERS,
  getAndroidPrivateDNSInstructions,
  getiOSSetupInstructions,
  generateiOSConfigProfile,
  calculateMobileSavings,
  supportsPrivateDNS,
  ANDROID_VPN_CONFIG,
} from "./mobileAdBlock";

describe("MOBILE_DNS_SERVERS", () => {
  it("has adguard, cloudflare_malware, and quad9 configs", () => {
    expect(MOBILE_DNS_SERVERS).toHaveProperty("adguard");
    expect(MOBILE_DNS_SERVERS).toHaveProperty("cloudflare_malware");
    expect(MOBILE_DNS_SERVERS).toHaveProperty("quad9");
  });

  it("each config has ipv4, ipv6, dns_over_https, and dns_over_tls", () => {
    for (const config of Object.values(MOBILE_DNS_SERVERS)) {
      expect(config.ipv4).toBeInstanceOf(Array);
      expect(config.ipv6).toBeInstanceOf(Array);
      expect(typeof config.dns_over_https).toBe("string");
      expect(typeof config.dns_over_tls).toBe("string");
    }
  });

  it("adguard DNS addresses are correct", () => {
    expect(MOBILE_DNS_SERVERS.adguard.ipv4[0]).toBe("94.140.14.14");
  });
});

describe("getAndroidPrivateDNSInstructions", () => {
  it("returns a non-empty string with setup steps", () => {
    const instructions = getAndroidPrivateDNSInstructions();
    expect(typeof instructions).toBe("string");
    expect(instructions.length).toBeGreaterThan(100);
  });

  it("references the AdGuard DNS hostname", () => {
    const instructions = getAndroidPrivateDNSInstructions();
    expect(instructions).toContain("dns.adguard.com");
  });

  it("includes both Private DNS and WiFi DNS methods", () => {
    const instructions = getAndroidPrivateDNSInstructions();
    expect(instructions).toContain("Private DNS");
    expect(instructions).toContain("WiFi DNS");
  });
});

describe("getiOSSetupInstructions", () => {
  it("returns setup instructions with DNS profile method", () => {
    const instructions = getiOSSetupInstructions();
    expect(instructions).toContain("DNS Profile");
  });

  it("includes AdGuard DNS IP addresses", () => {
    const instructions = getiOSSetupInstructions();
    expect(instructions).toContain("94.140.14.14");
  });
});

describe("generateiOSConfigProfile", () => {
  it("returns valid XML plist structure", () => {
    const profile = generateiOSConfigProfile();
    expect(profile).toContain('<?xml version="1.0"');
    expect(profile).toContain('<plist version="1.0">');
    expect(profile).toContain("</plist>");
  });

  it("contains AdGuard DoH URL", () => {
    const profile = generateiOSConfigProfile();
    expect(profile).toContain("https://dns.adguard.com/dns-query");
  });

  it("includes Privacy Protector branding", () => {
    const profile = generateiOSConfigProfile();
    expect(profile).toContain("Privacy Protector");
  });
});

describe("calculateMobileSavings", () => {
  it("returns 0 for 0 bytes", () => {
    expect(calculateMobileSavings(0)).toBe(0);
  });

  it("calculates savings at £7.50/GB rate", () => {
    const oneGB = 1024 * 1024 * 1024;
    const savings = calculateMobileSavings(oneGB);
    expect(savings).toBeCloseTo(7.5, 1);
  });

  it("handles fractional GB correctly", () => {
    const halfGB = (1024 * 1024 * 1024) / 2;
    const savings = calculateMobileSavings(halfGB);
    expect(savings).toBeCloseTo(3.75, 1);
  });
});

describe("supportsPrivateDNS", () => {
  it("returns a boolean", () => {
    expect(typeof supportsPrivateDNS()).toBe("boolean");
  });
});

describe("ANDROID_VPN_CONFIG", () => {
  it("has a description and blockedDomains", () => {
    expect(typeof ANDROID_VPN_CONFIG.description).toBe("string");
    expect(ANDROID_VPN_CONFIG.blockedDomains).toBeInstanceOf(Array);
    expect(ANDROID_VPN_CONFIG.blockedDomains.length).toBeGreaterThan(0);
  });

  it("blockedDomains includes key ad domains", () => {
    expect(ANDROID_VPN_CONFIG.blockedDomains).toContain("doubleclick.net");
    expect(ANDROID_VPN_CONFIG.blockedDomains).toContain(
      "googlesyndication.com",
    );
  });
});
