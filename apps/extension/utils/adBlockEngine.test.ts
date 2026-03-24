import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isAdOrTracker,
  recordBlockedRequest,
  initBlockStats,
  resetBlockStats,
} from "./adBlockEngine";

describe("adBlockEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("isAdOrTracker", () => {
    it("identifies generic ad domains", () => {
      expect(isAdOrTracker("https://doubleclick.net/some-ad").isAd).toBe(true);
      expect(isAdOrTracker("https://googlesyndication.com/ads").category).toBe(
        "ads",
      );
    });

    it("identifies YouTube ads", () => {
      const result = isAdOrTracker("https://www.youtube.com/pagead/123");
      expect(result.isAd).toBe(true);
      expect(result.category).toBe("youtube");
    });

    it("identifies social trackers", () => {
      const result = isAdOrTracker("https://facebook.net/tracking/tr");
      expect(result.isAd).toBe(true);
      expect(result.category).toBe("social");
    });

    it("returns false for safe domains", () => {
      expect(isAdOrTracker("https://google.com").isAd).toBe(false);
      expect(isAdOrTracker("https://github.com").isAd).toBe(false);
    });
  });

  describe("stats tracking", () => {
    it("initializes empty stats", async () => {
      const stats = await initBlockStats();
      expect(stats.totalBlocked).toBe(0);
      expect(stats.bandwidthSaved).toBe(0);
    });

    it("records blocked requests and updates stats", async () => {
      await recordBlockedRequest("image", "https://ad.com/img.jpg", "ads");
      const stats = await initBlockStats();

      expect(stats.totalBlocked).toBe(1);
      expect(stats.bandwidthSaved).toBeGreaterThan(0);
      expect(stats.blockedByType.ads).toBe(1);
      expect(stats.moneySaved).toBeGreaterThan(0);
    });

    it("resets stats correctly", async () => {
      await recordBlockedRequest("video", "https://yt.com/ad.mp4", "youtube");
      await resetBlockStats();
      const stats = await initBlockStats();

      expect(stats.totalBlocked).toBe(0);
      expect(stats.bandwidthSaved).toBe(0);
      expect(stats.blockedByType.youtube).toBe(0);
    });
  });
});
