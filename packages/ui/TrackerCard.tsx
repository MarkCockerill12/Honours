"use client"

import React from "react"
import { TrendingUp, Clock, PoundSterling } from "lucide-react"
import { useTheme } from "./ThemeProvider"
import type { TrackerStats } from "./types"

interface TrackerCardProps {
  stats: TrackerStats
  compact?: boolean
}

export function TrackerCard({ stats, compact = false }: TrackerCardProps) {
  const { colors, theme } = useTheme()

  if (compact) {
    return (
      <div className={`flex items-center justify-around p-3 rounded-xl ${colors.bgSecondary} ${colors.border} border`}>
        <div className="flex items-center gap-2 transition-all duration-200 hover:scale-110">
          <TrendingUp className={colors.success} size={16} />
          <span className={`text-sm font-bold ${colors.text}`}>{stats.bandwidthSaved}MB</span>
        </div>
        <div className={`w-px h-4 ${colors.border} border-r`} />
        <div className="flex items-center gap-2 transition-all duration-200 hover:scale-110">
          <Clock className={colors.warning} size={16} />
          <span className={`text-sm font-bold ${colors.text}`}>{stats.timeSaved}m</span>
        </div>
        <div className={`w-px h-4 ${colors.border} border-r`} />
        <div className="flex items-center gap-2 transition-all duration-200 hover:scale-110">
          <PoundSterling className={theme === "vaporwave" ? "text-pink-400" : colors.success} size={16} />
          <span className={`text-sm font-bold ${colors.text}`}>£{stats.dataValueReclaimed.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-4 rounded-2xl ${colors.bgSecondary} ${colors.border} border`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${colors.textSecondary}`}>
        You Are The Product Tracker
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center p-3 rounded-xl bg-black/20 transition-all duration-200 hover:scale-105 active:scale-95">
          <TrendingUp className={colors.success} size={24} />
          <span className={`text-2xl font-bold ${colors.text} mt-1`}>{stats.bandwidthSaved}</span>
          <span className={`text-xs ${colors.textSecondary}`}>MB Saved</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-black/20 transition-all duration-200 hover:scale-105 active:scale-95">
          <Clock className={colors.warning} size={24} />
          <span className={`text-2xl font-bold ${colors.text} mt-1`}>{stats.timeSaved}</span>
          <span className={`text-xs ${colors.textSecondary}`}>Mins Saved</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-black/20 transition-all duration-200 hover:scale-105 active:scale-95">
          <PoundSterling className={theme === "vaporwave" ? "text-pink-400" : colors.success} size={24} />
          <span className={`text-2xl font-bold ${colors.text} mt-1`}>£{stats.dataValueReclaimed.toFixed(2)}</span>
          <span className={`text-xs ${colors.textSecondary}`}>Reclaimed</span>
        </div>
      </div>
    </div>
  )
}
