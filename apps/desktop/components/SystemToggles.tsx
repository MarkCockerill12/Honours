"use client";

import React from "react";
import { Shield, Globe, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/packages/ui/ThemeProvider";

interface SystemTogglesProps {
  systemAdblock: boolean;
  onSystemAdblockToggle: () => void;
  vpn: boolean;
  onVpnToggle: () => void;
}

export function SystemToggles({
  systemAdblock,
  onSystemAdblockToggle,
  vpn,
  onVpnToggle,
}: SystemTogglesProps) {
  const { colors } = useTheme();

  const toggles = [
    {
      icon: Shield,
      label: "System-Wide AdBlock",
      description: "Block ads in all applications",
      enabled: systemAdblock,
      onToggle: onSystemAdblockToggle,
    },
    {
      icon: Lock,
      label: "Encrypted VPN (BETA)",
      description: "Route traffic via secure tunnel",
      enabled: vpn,
      onToggle: onVpnToggle,
    },
  ];

  return (
    <div
      className={`rounded-2xl ${colors.bgSecondary} ${colors.border} border p-4`}
    >
      <h3 className={`text-sm font-semibold mb-4 ${colors.text}`}>
        Protection Layers
      </h3>

      <div className="space-y-3">
        {toggles.map((toggle) => (
          <div
            key={toggle.label}
            className={`
              flex items-center gap-3 p-3 rounded-xl bg-black/10
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              cursor-pointer
              ${toggle.label.includes("BETA") ? "opacity-50 cursor-not-allowed" : ""}
            `}
            onClick={() => !toggle.label.includes("BETA") && toggle.onToggle()}
          >
            <div
              className={`
              p-2 rounded-lg
              ${toggle.enabled ? colors.accent : "bg-black/20"}
              transition-all duration-200
            `}
            >
              <toggle.icon
                size={20}
                className={toggle.enabled ? "text-white" : colors.textSecondary}
              />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${colors.text}`}>
                {toggle.label}
              </p>
              <p className={`text-xs ${colors.textSecondary}`}>
                {toggle.description}
              </p>
            </div>
            <Switch
              checked={toggle.enabled}
              onCheckedChange={() =>
                !toggle.label.includes("BETA") && toggle.onToggle()
              }
              onClick={(e) => e.stopPropagation()}
              disabled={toggle.label.includes("BETA")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
