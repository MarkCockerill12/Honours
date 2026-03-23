import { describe, it, expect, vi } from "vitest";
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
    const ger = VPN_SERVERS.find(s => s.id === "de");
    expect(ger).toBeDefined();
    expect(ger?.country).toBe("Germany");
  });
});

describe("getVpnConfig", () => {
  it("successfully fetches config", async () => {
    const mockConfig = { PublicIp: "1.2.3.4" };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: mockConfig }),
    });

    const config = await getVpnConfig("us");
    expect(config).toEqual(mockConfig);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/vpn/connect"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ serverId: "us" }),
      })
    );
  });

  it("throws error when response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });

    await expect(getVpnConfig("us")).rejects.toThrow("Failed to fetch VPN config: Internal Server Error");
  });

  it("throws error on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    await expect(getVpnConfig("us")).rejects.toThrow("Network Error");
  });
});
