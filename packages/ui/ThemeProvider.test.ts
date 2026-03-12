import { describe, it, expect } from "vitest";
import { themeConfigs } from "./ThemeProvider";

describe("themeConfigs", () => {
  const themes = ["dark", "light", "vaporwave", "frutiger-aero"] as const;

  it("contains all four themes", () => {
    for (const theme of themes) {
      expect(themeConfigs).toHaveProperty(theme);
    }
  });

  it("each theme has all required color properties", () => {
    const requiredProps = [
      "bg",
      "bgSecondary",
      "text",
      "textSecondary",
      "accent",
      "accentSecondary",
      "border",
      "success",
      "warning",
      "danger",
    ];

    for (const theme of themes) {
      for (const prop of requiredProps) {
        expect(themeConfigs[theme]).toHaveProperty(prop);
        expect(typeof (themeConfigs[theme] as any)[prop]).toBe("string");
      }
    }
  });

  it("dark theme uses zinc/emerald palette", () => {
    expect(themeConfigs.dark.bg).toContain("zinc");
    expect(themeConfigs.dark.accent).toContain("emerald");
  });

  it("light theme uses white/blue palette", () => {
    expect(themeConfigs.light.bg).toContain("white");
    expect(themeConfigs.light.accent).toContain("blue");
  });

  it("vaporwave theme uses purple/pink palette", () => {
    expect(themeConfigs.vaporwave.bg).toContain("purple");
    expect(themeConfigs.vaporwave.accent).toContain("pink");
  });

  it("frutiger-aero theme uses sky/emerald palette", () => {
    expect(themeConfigs["frutiger-aero"].bg).toContain("sky");
    expect(themeConfigs["frutiger-aero"].accent).toContain("sky");
  });
});
