import { describe, it, expect } from "vitest";
import { scanUrl } from "./security";

describe("scanUrl", () => {
  it("identifies safe URLs", () => {
    const result = scanUrl("https://www.google.com");
    expect(result.isSafe).toBe(true);
    expect(result.threatType).toBe("safe");
  });

  it("identifies known phishing domains", () => {
    const result = scanUrl("https://login-apple-id.com");
    expect(result.isSafe).toBe(false);
    expect(result.threatType).toBe("phishing");
    expect(result.details).toContain("Known Phishing Domain");
  });

  it("identifies dangerous file extensions from path", () => {
    const result = scanUrl("https://example.com/downloads/malware.exe");
    expect(result.isSafe).toBe(false);
    expect(result.threatType).toBe("malware");
    expect(result.details).toContain("Dangerous .exe");
  });

  it("identifies known tracker domains", () => {
    const result = scanUrl("https://doubleclick.net/ad/123");
    expect(result.isSafe).toBe(false);
    expect(result.threatType).toBe("tracker");
  });

  it("flags URL shorteners as redirect risk", () => {
    const result = scanUrl("https://bit.ly/random-code");
    expect(result.isSafe).toBe(false);
    expect(result.threatType).toBe("redirect");
  });

  it("uses heuristic analysis to flag complex suspicious URLs", () => {
    // Multiple factors: brand name mismatch, long hostname, suspicious keywords
    const result = scanUrl(
      "http://secure-login-apple-verify-identity.apple.untrustworthy.top/verify",
    );
    expect(result.isSafe).toBe(false);
    expect(result.threatType).toBe("suspicious");
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it("flags URLs with @ symbols (obfuscation)", () => {
    // @ symbol (3) + suspicious TLD (2) = score 5 >= threshold 4
    const result = scanUrl("https://secure-bank.com@login.evil.tk");
    expect(result.isSafe).toBe(false);
    expect(result.threatType).toBe("suspicious");
  });

  it("handles invalid URLs gracefully", () => {
    const result = scanUrl("not-a-url");
    expect(result.isSafe).toBe(true);
    expect(result.threatType).toBe("safe");
  });
});
