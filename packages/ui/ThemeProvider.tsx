"use client"

import React, { createContext, useContext } from "react"
import type { Theme, ThemeColors } from "./types"

const themeConfigs: Record<Theme, ThemeColors> = {
  dark: {
    bg: "bg-zinc-950",
    bgSecondary: "bg-zinc-900",
    text: "text-zinc-100",
    textSecondary: "text-zinc-400",
    accent: "bg-emerald-500",
    accentSecondary: "bg-emerald-600",
    border: "border-zinc-800",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  },
  light: {
    bg: "bg-slate-50",
    bgSecondary: "bg-white",
    text: "text-slate-900",
    textSecondary: "text-slate-500",
    accent: "bg-blue-500",
    accentSecondary: "bg-blue-600",
    border: "border-slate-200",
    success: "text-blue-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  },
  vaporwave: {
    bg: "bg-purple-950",
    bgSecondary: "bg-purple-900/50",
    text: "text-pink-200",
    textSecondary: "text-cyan-300",
    accent: "bg-pink-500",
    accentSecondary: "bg-cyan-500",
    border: "border-pink-500/30",
    success: "text-cyan-400",
    warning: "text-pink-400",
    danger: "text-red-400",
  },
  "frutiger-aero": {
    bg: "bg-gradient-to-br from-sky-100 to-emerald-100",
    bgSecondary: "bg-white/70",
    text: "text-slate-800",
    textSecondary: "text-slate-600",
    accent: "bg-gradient-to-r from-sky-400 to-emerald-400",
    accentSecondary: "bg-sky-500",
    border: "border-white/50",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-500",
  },
}

interface ThemeContextType {
  theme: Theme
  colors: ThemeColors
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}

export function ThemeProvider({
  children,
  theme,
  setTheme,
}: {
  children: React.ReactNode
  theme: Theme
  setTheme: (theme: Theme) => void
}) {
  return (
    <ThemeContext.Provider value={{ theme, colors: themeConfigs[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export { themeConfigs }
