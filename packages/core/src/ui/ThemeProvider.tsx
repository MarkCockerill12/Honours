"use client";

import React, { createContext, useContext, useEffect } from "react";
import type { Theme, ThemeColors } from "../shared";

const themeConfigs: Record<Theme, ThemeColors> = {
  dark: {
    bg: "bg-[#09090b]",
    bgSecondary: "bg-[#18181b]",
    text: "text-[#fafafa]",
    textSecondary: "text-[#a1a1aa]",
    accent: "bg-[#2dd4bf]",
    accentSecondary: "bg-[#047857]",
    border: "border-white/10",
    success: "text-[#2dd4bf]",
    warning: "text-[#fbbf24]",
    danger: "text-[#f87171]",
  },
  light: {
    bg: "bg-[#ffffff]",
    bgSecondary: "bg-[#f4f4f5]",
    text: "text-[#09090b]",
    textSecondary: "text-[#52525b]",
    accent: "bg-[#3b82f6]",
    accentSecondary: "bg-[#bfdbfe]",
    border: "border-black/10",
    success: "text-[#16a34a]",
    warning: "text-[#d97706]",
    danger: "text-[#dc2626]",
  },
  vaporwave: {
    bg: "bg-[#0a0015]",
    bgSecondary: "bg-[#1a0030]",
    text: "text-[#ff71ce]",
    textSecondary: "text-[#b967ff]",
    accent: "bg-[#ff6ac1]",
    accentSecondary: "bg-[#7b2d8e]",
    border: "border-[#3d0066]",
    success: "text-[#05ffa1]",
    warning: "text-[#fffb96]",
    danger: "text-[#ff4d6a]",
  },
  "frutiger-aero": {
    bg: "bg-[#d0eaf8]",
    bgSecondary: "bg-[#e8f4fd]/90",
    text: "text-[#0c2d48]",
    textSecondary: "text-[#2a6496]",
    accent: "bg-[#0284c7]",
    accentSecondary: "bg-[#bfdbfe]/60",
    border: "border-[#7ec8e3]",
    success: "text-[#0369a1]",
    warning: "text-[#b45309]",
    danger: "text-[#be123c]",
  },
  cyberpunk: {
    bg: "bg-[#000000]",
    bgSecondary: "bg-[#111111]",
    text: "text-[#00ff00]",
    textSecondary: "text-[#eab308]",
    accent: "bg-[#eab308]",
    accentSecondary: "bg-[#000000]",
    border: "border-[#eab308]/50",
    success: "text-[#00ff00]",
    warning: "text-[#eab308]",
    danger: "text-[#ff0000]",
  },
};

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeProvider({
  children,
  theme,
  setTheme,
}: {
  children: React.ReactNode;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isDark = theme === "dark" || theme === "vaporwave";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", theme);
    
    const bgMap = {
      dark: "#09090b",
      light: "#ffffff",
      vaporwave: "#0a0015",
      "frutiger-aero": "#f0f9ff",
      cyberpunk: "#000000"
    };
    document.body.style.backgroundColor = bgMap[theme];
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ theme, colors: themeConfigs[theme], setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export { themeConfigs };
