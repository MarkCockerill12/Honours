import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_VERSION,
  API_ENDPOINTS,
  VPN_REGIONS,
  DNS_PROVIDERS,
} from "./constants";

describe("APP_NAME and APP_VERSION", () => {
  it("APP_NAME is defined as a string", () => {
    expect(typeof APP_NAME).toBe("string");
    expect(APP_NAME.length).toBeGreaterThan(0);
  });

  it("APP_VERSION follows semver-like format", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("API_ENDPOINTS", () => {
  it("has required endpoint keys", () => {
    expect(API_ENDPOINTS).toHaveProperty("ADGUARD_API");
    expect(API_ENDPOINTS).toHaveProperty("VPN_SERVERS");
    expect(API_ENDPOINTS).toHaveProperty("NLP_ANALYZE");
    expect(API_ENDPOINTS).toHaveProperty("STATS_API");
  });

  it("each endpoint is a string", () => {
    for (const [key, value] of Object.entries(API_ENDPOINTS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("VPN_REGIONS", () => {
  it("is a non-empty array", () => {
    expect(VPN_REGIONS).toBeInstanceOf(Array);
    expect(VPN_REGIONS.length).toBeGreaterThan(0);
  });

  it("each region has id, name, and emoji", () => {
    for (const region of VPN_REGIONS) {
      expect(region).toHaveProperty("id");
      expect(region).toHaveProperty("name");
      expect(region).toHaveProperty("emoji");
      expect(typeof region.id).toBe("string");
      expect(typeof region.name).toBe("string");
    }
  });

  it("includes UK and US regions", () => {
    const ids = VPN_REGIONS.map((r) => r.id);
    expect(ids).toContain("uk");
    expect(ids).toContain("us");
  });
});

describe("DNS_PROVIDERS", () => {
  it("includes cloudflare and google providers", () => {
    expect(DNS_PROVIDERS).toHaveProperty("cloudflare");
    expect(DNS_PROVIDERS).toHaveProperty("google");
  });

  it("each provider has name, doh, and ipv4", () => {
    for (const [key, provider] of Object.entries(DNS_PROVIDERS)) {
      expect(provider).toHaveProperty("name");
      expect(provider).toHaveProperty("doh");
      expect(provider).toHaveProperty("ipv4");
    }
  });

  it("cloudflare DNS is 1.1.1.1", () => {
    expect(DNS_PROVIDERS.cloudflare.ipv4).toBe("1.1.1.1");
  });

  it("google DNS is 8.8.8.8", () => {
    expect(DNS_PROVIDERS.google.ipv4).toBe("8.8.8.8");
  });
});
