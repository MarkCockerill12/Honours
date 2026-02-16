"use client"

import React, { useState } from "react"
import { Monitor, Smartphone, Chrome } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeProvider, themeConfigs } from "@/packages/ui/ThemeProvider"
import type { Theme, Platform, ProtectionState, TrackerStats, SmartFilter, BlurMethod } from "@/packages/ui/types"
import { ExtensionApp } from "@/apps/extension/ExtensionApp"
import { MobileApp } from "@/apps/mobile/MobileApp"
import { DesktopApp } from "@/apps/desktop/DesktopApp"

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark")
  const [platform, setPlatform] = useState<Platform>("extension")
  
  // Shared protection state
  // TODO: Persist protection state in local storage or sync with backend
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: true,
    adblockEnabled: true,
  })
  
  // Tracker stats (simulated)
  // TODO: Fetch real-time statistics from the backend analytics service
  const [stats] = useState<TrackerStats>({
    bandwidthSaved: 847,
    timeSaved: 32,
    dataValueReclaimed: 4.73,
  })
  
  // Extension-specific state
  const [filters, setFilters] = useState<SmartFilter[]>([
    { id: "1", blockTerm: "war", exceptWhen: "peace treaty", enabled: true },
    { id: "2", blockTerm: "violence", exceptWhen: "", enabled: true },
  ])
  const [contextLevel, setContextLevel] = useState(50)
  const [blurMethod, setBlurMethod] = useState<BlurMethod>("blur")

  const handleProtectionToggle = () => {
    setProtection(prev => ({ ...prev, isActive: !prev.isActive }))
  }

  const handleVpnToggle = () => {
    setProtection(prev => ({ ...prev, vpnEnabled: !prev.vpnEnabled }))
  }

  const handleAdblockToggle = () => {
    setProtection(prev => ({ ...prev, adblockEnabled: !prev.adblockEnabled }))
  }

  const colors = themeConfigs[theme]

  const platformIcons = {
    extension: Chrome,
    mobile: Smartphone,
    desktop: Monitor,
  }

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className={`min-h-screen ${colors.bg} transition-colors duration-300`}>
        {/* Dev Control Bar - Platform Selector Only */}
        <div className={`sticky top-0 z-50 ${colors.bgSecondary} ${colors.border} border-b backdrop-blur-sm`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Dev Mode Label */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-1 rounded bg-amber-500/20 text-amber-400`}>
                  DEV MODE
                </span>
                <span className={`text-sm ${colors.textSecondary}`}>
                  Platform Preview
                </span>
              </div>

              {/* Platform Selector */}
              <div className="flex items-center gap-2">
                {(["extension", "mobile", "desktop"] as Platform[]).map((p) => {
                  const Icon = platformIcons[p]
                  return (
                    <Button
                      key={p}
                      variant={platform === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPlatform(p)}
                      className={`
                        flex items-center gap-2 capitalize
                        transition-all duration-200 hover:scale-105 active:scale-95
                      `}
                    >
                      <Icon size={16} />
                      {p}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-8 px-4 pb-20">
          <div className="max-w-7xl mx-auto">
            {/* Platform Preview */}
            <div className="flex justify-center">
              {platform === "extension" && (
                <ExtensionApp
                  protection={protection}
                  onProtectionToggle={handleProtectionToggle}
                  onVpnToggle={handleVpnToggle}
                  onAdblockToggle={handleAdblockToggle}
                  stats={stats}
                  filters={filters}
                  onFiltersChange={setFilters}
                  contextLevel={contextLevel}
                  onContextLevelChange={setContextLevel}
                  blurMethod={blurMethod}
                  onBlurMethodChange={setBlurMethod}
                />
              )}
              
              {platform === "mobile" && (
                <MobileApp
                  protection={protection}
                  onProtectionToggle={handleProtectionToggle}
                  onVpnToggle={handleVpnToggle}
                  onAdblockToggle={handleAdblockToggle}
                  stats={stats}
                />
              )}
              
              {platform === "desktop" && (
                <DesktopApp
                  protection={protection}
                  onProtectionToggle={handleProtectionToggle}
                  onVpnToggle={handleVpnToggle}
                  onAdblockToggle={handleAdblockToggle}
                  stats={stats}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`fixed bottom-0 left-0 right-0 ${colors.bgSecondary} ${colors.border} border-t py-2 px-4`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <span className={colors.textSecondary}>
              Cybersecurity Honours Project - Frontend Prototype
            </span>
            <span className={colors.textSecondary}>
              Backend integration points marked with TODO comments
            </span>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
