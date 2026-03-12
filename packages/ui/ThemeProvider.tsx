"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Theme, ThemeColors } from "./types";

const themeConfigs: Record<Theme, ThemeColors> = {
  dark: {
    bg: "bg-zinc-950",
    bgSecondary: "bg-zinc-900",
    text: "text-zinc-50",
    textSecondary: "text-zinc-400",
    accent: "bg-emerald-500",
    accentSecondary: "bg-emerald-600",
    border: "border-zinc-800",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-500",
  },
  light: {
    bg: "bg-white",
    bgSecondary: "bg-slate-50",
    text: "text-slate-900",
    textSecondary: "text-slate-600",
    accent: "bg-blue-600",
    accentSecondary: "bg-blue-700",
    border: "border-slate-200",
    success: "text-emerald-600",
    warning: "text-orange-600",
    danger: "text-red-600",
  },
  vaporwave: {
    bg: "bg-purple-950",
    bgSecondary: "bg-fuchsia-900/40",
    text: "text-pink-100",
    textSecondary: "text-cyan-300",
    accent: "bg-gradient-to-r from-pink-500 to-purple-500",
    accentSecondary: "bg-cyan-400",
    border: "border-pink-500/50",
    success: "text-cyan-400",
    warning: "text-pink-400",
    danger: "text-rose-500",
  },
  "frutiger-aero": {
    bg: "bg-gradient-to-br from-blue-50 via-sky-100 to-emerald-50",
    bgSecondary: "bg-white/70 backdrop-blur-xl shadow-glass",
    text: "text-slate-800",
    textSecondary: "text-sky-700",
    accent: "bg-gradient-to-b from-sky-400 to-blue-500 shadow-inner",
    accentSecondary: "bg-emerald-400",
    border: "border-white/50",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  },
  cyberpunk: {
    bg: "bg-yellow-400", // The classic Cyberpunk 2077 bright UI background
    bgSecondary: "bg-zinc-950", // High contrast dark cards
    text: "text-zinc-950", // Inverse text for yellow bg
    textSecondary: "text-zinc-800",
    accent: "bg-cyan-400", // Glitch cyan
    accentSecondary: "bg-red-500", // Danger red
    border: "border-zinc-950", // Aggressive borders
    success: "text-cyan-600",
    warning: "text-red-600",
    danger: "text-red-700",
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
  return (
    <ThemeContext.Provider
      value={{ theme, colors: themeConfigs[theme], setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export { themeConfigs };
