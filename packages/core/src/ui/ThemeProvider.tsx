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
    bg: "bg-[#2b0b3f]",
    bgSecondary: "bg-[#4a154b]",
    text: "text-[#00ffff]",
    textSecondary: "text-[#ffb8ff]",
    accent: "bg-[#ff00ff]",
    accentSecondary: "bg-[#b800b8]",
    border: "border-[#ff00ff]/30",
    success: "text-[#00ffff]",
    warning: "text-[#ffee00]",
    danger: "text-[#ff0055]",
  },
  "frutiger-aero": {
    bg: "bg-[#0369a1]", 
    bgSecondary: "bg-white/80",
    text: "text-[#002d44]", 
    textSecondary: "text-[#004d6e]",
    accent: "bg-[#22c55e]",
    accentSecondary: "bg-white/95",
    border: "border-white/90",
    success: "text-[#166534]",
    warning: "text-[#854d0e]",
    danger: "text-[#991b1b]",
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
    const isDark = theme === "dark" || theme === "vaporwave" || theme === "frutiger-aero";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", theme);
    
    const bgMap = {
      dark: "#09090b",
      light: "#ffffff",
      vaporwave: "#2b0b3f",
      "frutiger-aero": "#0369a1",
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
