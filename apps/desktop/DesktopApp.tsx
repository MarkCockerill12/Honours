"use client"

import React, { useState } from "react"
import { Monitor, Minimize2, X, Minus, Palette } from "lucide-react"
import { useTheme } from "@/packages/ui/ThemeProvider"
import { ActivationButton } from "@/packages/ui/ActivationButton"
import { ProtectionToggles } from "@/packages/ui/ProtectionToggles"
import { TrackerCard } from "@/packages/ui/TrackerCard"
import { ScalableContainer } from "@/packages/ui/ScalableContainer"
import type { ProtectionState, TrackerStats, ServerLocation, Theme } from "@/packages/ui/types"
import { ServerList } from "@/apps/mobile/components/ServerList"
import { SystemToggles } from "./components/SystemToggles"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DesktopAppProps {
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
  { id: "nl", name: "Amsterdam", country: "Netherlands", flag: "NL", ping: 22, load: 48, x: 50, y: 28 },
]

export function DesktopApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  stats,
}: DesktopAppProps) {
  const { colors, theme, setTheme } = useTheme()
  const [selectedServer, setSelectedServer] = useState<ServerLocation | null>(defaultServers[0])
  const [systemAdblock, setSystemAdblock] = useState(true)
  const [dnsOverHttps, setDnsOverHttps] = useState(true)

  return (
    <ScalableContainer className="w-full max-w-[1200px] min-h-[700px] mx-auto">
      {/* Window Frame */}
      <div className={`rounded-2xl overflow-hidden ${colors.border} border shadow-2xl`}>
        {/* Title Bar */}
        <div className={`flex items-center justify-between px-4 py-2 ${colors.bgSecondary} ${colors.border} border-b`}>
          <div className="flex items-center gap-2">
            <Monitor size={16} className={colors.textSecondary} />
            <span 
              className={`text-sm font-semibold ${colors.text}`}
              style={{
                fontFamily: theme === "vaporwave" ? "'Comic Sans MS', cursive" : undefined,
              }}
            >
               Blocker - General{"'"}s Quarters
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Selector */}
            <div className="flex items-center gap-2">
              <Palette size={14} className={colors.textSecondary} />
              <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
                <SelectTrigger className={`w-32 h-7 text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
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
            
            {/* Window Controls */}
            <div className="flex items-center gap-1">
              {[Minus, Minimize2, X].map((Icon, index) => (
                <button
                  key={index}
                  className={`
                    p-1.5 rounded transition-all duration-200 hover:scale-110 active:scale-95
                    ${index === 2 ? "hover:bg-red-500 hover:text-white" : "hover:bg-black/20"}
                  `}
                >
                  <Icon size={14} className={index === 2 ? "" : colors.textSecondary} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`${colors.bg} p-6`}>
          <div className="grid grid-cols-12 gap-6">
            {/* Left Sidebar - Stats & Server List */}
            <div className="col-span-3 space-y-6">
              {/* Tracker Stats */}
              <TrackerCard stats={stats} />

              {/* Connection Status */}
              {selectedServer && (
                <div className={`rounded-2xl ${colors.bgSecondary} ${colors.border} border p-4`}>
                  <h3 className={`text-sm font-semibold mb-3 ${colors.text}`}>Current Connection</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedServer.flag}</span>
                    <div>
                      <p className={`font-medium ${colors.text}`}>{selectedServer.name}</p>
                      <p className={`text-xs ${colors.textSecondary}`}>{selectedServer.country}</p>
                      <p className={`text-xs ${protection.isActive && protection.vpnEnabled ? colors.success : colors.textSecondary}`}>
                        {protection.isActive && protection.vpnEnabled ? `Connected - ${selectedServer.ping}ms` : "Disconnected"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Server List */}
              <div className={`rounded-2xl ${colors.bgSecondary} ${colors.border} border p-4`}>
                <ServerList
                  servers={defaultServers}
                  selectedServer={selectedServer}
                  onServerSelect={setSelectedServer}
                />
              </div>
            </div>

            {/* Center - Activation & Controls */}
            <div className="col-span-6 flex flex-col items-center justify-center space-y-8">
              {/* Activation Button - Centered */}
              <div className="flex flex-col items-center">
                <ActivationButton 
                  protection={protection}
                  onToggle={onProtectionToggle}
                  size="lg"
                />
                
                <div className="mt-8">
                  <ProtectionToggles
                    protection={protection}
                    onVpnToggle={onVpnToggle}
                    onAdblockToggle={onAdblockToggle}
                    layout="horizontal"
                  />
                </div>
              </div>

              {/* Status Message */}
              <div className={`text-center ${colors.textSecondary}`}>
                <p className={`text-lg font-medium ${protection.isActive ? colors.success : colors.danger}`}>
                  {protection.isActive ? "Protection Active" : "Protection Disabled"}
                </p>
                <p className="text-sm mt-1">
                  {protection.isActive 
                    ? `VPN: ${protection.vpnEnabled ? "Connected" : "Off"} | AdBlock: ${protection.adblockEnabled ? "Enabled" : "Off"}`
                    : "Click the shield to activate protection"
                  }
                </p>
              </div>
            </div>

            {/* Right Sidebar - System Settings */}
            <div className="col-span-3 space-y-6">
              {/* System Toggles */}
              <SystemToggles
                systemAdblock={systemAdblock}
                onSystemAdblockToggle={() => setSystemAdblock(!systemAdblock)}
                dnsOverHttps={dnsOverHttps}
                onDnsOverHttpsToggle={() => setDnsOverHttps(!dnsOverHttps)}
              />
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`flex items-center justify-between px-4 py-2 ${colors.bgSecondary} ${colors.border} border-t text-xs ${colors.textSecondary}`}>
          <div className="flex items-center gap-4">
            <span className={protection.isActive ? colors.success : colors.danger}>
              {protection.isActive ? "Protection Active" : "Protection Disabled"}
            </span>
            <span>|</span>
            <span>VPN: {protection.vpnEnabled ? "On" : "Off"}</span>
            <span>|</span>
            <span>AdBlock: {protection.adblockEnabled ? "On" : "Off"}</span>
          </div>
          <div>
            <span>v1.0.0-prototype</span>
          </div>
        </div>
      </div>
    </ScalableContainer>
  )
}
