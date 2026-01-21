"use client"

import React, { useState } from "react"
import { Palette } from "lucide-react"
import { useTheme } from "@/packages/ui/ThemeProvider"
import { ActivationButton } from "@/packages/ui/ActivationButton"
import { ProtectionToggles } from "@/packages/ui/ProtectionToggles"
import { TrackerCard } from "@/packages/ui/TrackerCard"
import { ScalableContainer } from "@/packages/ui/ScalableContainer"
import type { ProtectionState, TrackerStats, ServerLocation, Theme } from "@/packages/ui/types"
import { ServerMap } from "./components/ServerMap"
import { ServerList } from "./components/ServerList"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MobileAppProps {
  protection: ProtectionState
  onProtectionToggle: () => void
  onVpnToggle: () => void
  onAdblockToggle: () => void
  stats: TrackerStats
}

const defaultServers: ServerLocation[] = [
  { id: "uk", name: "London", country: "United Kingdom", flag: "GB", ping: 12, load: 35, x: 48, y: 30 },
  { id: "us-east", name: "New York", country: "United States", flag: "US", ping: 78, load: 62, x: 25, y: 35 },
  { id: "us-west", name: "Los Angeles", country: "United States", flag: "US", ping: 145, load: 45, x: 12, y: 38 },
  { id: "de", name: "Frankfurt", country: "Germany", flag: "DE", ping: 28, load: 55, x: 52, y: 28 },
  { id: "jp", name: "Tokyo", country: "Japan", flag: "JP", ping: 180, load: 30, x: 85, y: 35 },
  { id: "au", name: "Sydney", country: "Australia", flag: "AU", ping: 220, load: 25, x: 88, y: 75 },
  { id: "sg", name: "Singapore", country: "Singapore", flag: "SG", ping: 165, load: 40, x: 78, y: 52 },
]

export function MobileApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  stats,
}: MobileAppProps) {
  const { colors, theme, setTheme } = useTheme()
  const [selectedServer, setSelectedServer] = useState<ServerLocation | null>(defaultServers[0])

  const userLocation = { x: 48, y: 32 } // UK by default

  return (
    <ScalableContainer className="w-full max-w-[390px] min-h-[844px] mx-auto">
      <div className="flex flex-col h-full">
        {/* Status Bar Mockup */}
        <div className={`flex items-center justify-between px-6 py-2 ${colors.bgSecondary}`}>
          <span className={`text-xs font-semibold ${colors.text}`}>9:41</span>
          <div className="flex items-center gap-1">
            <div className={`w-4 h-2 ${colors.textSecondary}`}>
              <svg viewBox="0 0 24 12" fill="currentColor">
                <rect x="0" y="4" width="4" height="8" rx="1" />
                <rect x="6" y="2" width="4" height="10" rx="1" />
                <rect x="12" y="0" width="4" height="12" rx="1" />
                <rect x="18" y="0" width="4" height="12" rx="1" />
              </svg>
            </div>
            <div className={`w-6 h-3 border rounded-sm ${colors.border}`}>
              <div className="w-4 h-full bg-emerald-400 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Header with Theme Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h1 
                className={`text-xl font-bold ${colors.text}`}
                style={{
                  fontFamily: theme === "vaporwave" ? "'Comic Sans MS', cursive" : undefined,
                  textShadow: theme === "vaporwave" ? "0 0 10px #f472b6, 0 0 20px #22d3ee" : undefined,
                }}
              >
                 Blocker
              </h1>
              <p className={`text-xs ${colors.textSecondary}`}>Mobile Protection</p>
            </div>
            
            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <Palette size={14} className={colors.textSecondary} />
              <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
                <SelectTrigger className={`w-28 h-8 text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                  <SelectValue placeholder="Theme" />
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
          <div className="flex justify-center py-6">
            <ActivationButton 
              protection={protection}
              onToggle={onProtectionToggle}
              size="lg"
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

          {/* Server Map */}
          <ServerMap
            servers={defaultServers}
            selectedServer={selectedServer}
            onServerSelect={setSelectedServer}
            isConnected={protection.isActive && protection.vpnEnabled}
            userLocation={userLocation}
          />

          {/* Server List */}
          <ServerList
            servers={defaultServers}
            selectedServer={selectedServer}
            onServerSelect={setSelectedServer}
          />

          {/* Stats */}
          <TrackerCard stats={stats} />
        </div>
      </div>
    </ScalableContainer>
  )
}
