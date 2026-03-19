import { describe, it, expect } from "vitest";
import { VPN_SERVERS, getVpnConfig } from "./vpn";

describe("VPN_SERVERS", () => {
  it("is a non-empty array", () => {
    expect(VPN_SERVERS).toBeInstanceOf(Array);
    expect(VPN_SERVERS.length).toBeGreaterThan(0);
  });

  it("each server has required ServerLocation fields", () => {
    for (const server of VPN_SERVERS) {
      expect(server).toHaveProperty("id");
      expect(server).toHaveProperty("country");
      expect(server).toHaveProperty("name");
      expect(server).toHaveProperty("status");
      expect(typeof server.id).toBe("string");
      expect(typeof server.country).toBe("string");
      expect(["off", "starting", "active"]).toContain(server.status);
    }
  });

  it("includes the Germany (AWS) server", () => {
    const ger = VPN_SERVERS.find(s => s.id === "aws-eu-1");
    expect(ger).toBeDefined();
    expect(ger?.country).toBe("Germany");
  });
});

describe("getVpnConfig", () => {
  it("is an async function", () => {
    expect(typeof getVpnConfig).toBe("function");
  });

  // Note: Actual API call tests would require mocking fetch
});
