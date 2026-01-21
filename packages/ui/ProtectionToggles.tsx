"use client"

import React from "react"
import { Shield, Globe } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "./ThemeProvider"
import type { ProtectionState } from "./types"

interface ProtectionTogglesProps {
  protection: ProtectionState
  onVpnToggle: () => void
  onAdblockToggle: () => void
  layout?: "horizontal" | "vertical"
}

export function ProtectionToggles({
  protection,
  onVpnToggle,
  onAdblockToggle,
  layout = "horizontal",
}: ProtectionTogglesProps) {
  const { colors } = useTheme()

  const containerClass = layout === "horizontal" 
    ? "flex items-center gap-6" 
    : "flex flex-col gap-3"

  return (
    <div className={containerClass}>
      <div 
        className={`
          flex items-center gap-3 p-3 rounded-xl
          ${colors.bgSecondary} ${colors.border} border
          transition-all duration-200 hover:scale-105 active:scale-95
          cursor-pointer
        `}
        onClick={onVpnToggle}
      >
        <Globe className={protection.vpnEnabled ? colors.success : colors.textSecondary} size={20} />
        <span className={`text-sm font-medium ${colors.text}`}>VPN</span>
        <Switch 
          checked={protection.vpnEnabled} 
          onCheckedChange={onVpnToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div 
        className={`
          flex items-center gap-3 p-3 rounded-xl
          ${colors.bgSecondary} ${colors.border} border
          transition-all duration-200 hover:scale-105 active:scale-95
          cursor-pointer
        `}
        onClick={onAdblockToggle}
      >
        <Shield className={protection.adblockEnabled ? colors.success : colors.textSecondary} size={20} />
        <span className={`text-sm font-medium ${colors.text}`}>AdBlock</span>
        <Switch 
          checked={protection.adblockEnabled} 
          onCheckedChange={onAdblockToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
