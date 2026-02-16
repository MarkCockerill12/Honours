"use client"

import React from "react"
import { Palette } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/packages/ui/ThemeProvider"
import { ActivationButton } from "@/packages/ui/ActivationButton"
import { ProtectionToggles } from "@/packages/ui/ProtectionToggles"
import { TrackerCard } from "@/packages/ui/TrackerCard"
import { ScalableContainer } from "@/packages/ui/ScalableContainer"
import type { ProtectionState, TrackerStats, SmartFilter, BlurMethod, Theme } from "@/packages/ui/types"
import { SmartFilters } from "./components/SmartFilters"
import { CyberScanner } from "./components/CyberScanner"

interface ExtensionAppProps {
  protection: ProtectionState
  onProtectionToggle: () => void
  onVpnToggle: () => void
  onAdblockToggle: () => void
  stats: TrackerStats
  filters: SmartFilter[]
  onFiltersChange: (filters: SmartFilter[]) => void
  contextLevel: number
  onContextLevelChange: (level: number) => void
  blurMethod: BlurMethod
  onBlurMethodChange: (method: BlurMethod) => void
}

export function ExtensionApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  stats,
  filters,
  onFiltersChange,
  contextLevel,
  onContextLevelChange,
  blurMethod,
  onBlurMethodChange,
}: ExtensionAppProps) {
  const { colors, theme, setTheme } = useTheme()

  return (
    <ScalableContainer className="w-full max-w-[350px] min-h-[600px] mx-auto">
      <div className="flex flex-col h-full p-4 space-y-4">
        {/* Header with Theme Selector */}
        <div className="flex items-center justify-between">
          <h1 
            className={`text-lg font-bold ${colors.text}`}
            style={{
              fontFamily: theme === "vaporwave" ? "'Comic Sans MS', cursive" : undefined,
              textShadow: theme === "vaporwave" ? "0 0 10px #f472b6, 0 0 20px #22d3ee" : undefined,
            }}
          >
             Blocker
          </h1>
          <div className="flex items-center gap-2">
            <Palette size={14} className={colors.textSecondary} />
            <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
              <SelectTrigger className={`w-28 h-7 text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="vaporwave">Vaporwave</SelectItem>
                <SelectItem value="frutiger-aero">Frutiger Aero</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Activation Button */}
        <div className="flex justify-center py-4">
          <ActivationButton 
            protection={protection}
            onToggle={onProtectionToggle}
            size="md"
          />
        </div>

        {/* Protection Toggles */}
        <div className="flex justify-center">
          <ProtectionToggles
            protection={protection}
            onVpnToggle={onVpnToggle}
            onAdblockToggle={onAdblockToggle}
            layout="horizontal"
          />
        </div>

        {/* Tracker Stats */}
        <TrackerCard stats={stats} compact />

        {/* Cyber Scanner */}
        <CyberScanner />

        {/* Smart Filters */}
        {/* <SmartFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          contextLevel={contextLevel}
          onContextLevelChange={onContextLevelChange}
          blurMethod={blurMethod}
          onBlurMethodChange={onBlurMethodChange}
        /> */}
      </div>
    </ScalableContainer>
  )
}
