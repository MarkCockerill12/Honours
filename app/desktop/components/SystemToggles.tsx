"use client";

import React, { useMemo } from "react";
import { Shield, Lock, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/ThemeProvider";

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
}: Readonly<SystemTogglesProps>) {
  const { colors, theme } = useTheme();

  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      default: return "glass-card-light";
    }
  }, [theme]);

  const toggles = useMemo(() => [
    {
      id: "adblock",
      icon: Shield,
      label: "App & Extension AdBlock",
      description: "Zero-lag protection for App & Browser",
      enabled: systemAdblock,
      onToggle: onSystemAdblockToggle,
      isBeta: false
    },
    {
      id: "vpn",
      icon: Lock,
      label: "Encrypted VPN (BETA)",
      description: "Route traffic via secure tunnel",
      enabled: vpn,
      onToggle: onVpnToggle,
      isBeta: true
    },
  ], [systemAdblock, vpn, onSystemAdblockToggle, onVpnToggle]);

  return (
    <div className={`rounded-4xl ${glassCardClass} p-6 border ${colors.border}`}>
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className={`w-4 h-4 ${colors.accent}`} />
        <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${colors.textSecondary}`}>
          Protection Layers
        </h3>
      </div>

      <div className="space-y-4">
        {toggles.map((toggle) => (
          <div
            key={toggle.id}
            className={`
              flex items-center gap-4 p-4 rounded-2xl bg-black/10
              transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]
              cursor-pointer border border-white/5
              ${toggle.isBeta ? "opacity-60 grayscale-[0.5]" : "hover:border-white/10"}
            `}
            onClick={() => toggle.onToggle()}
          >
            <div className={`p-2.5 rounded-xl transition-all duration-500 ${toggle.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-black/20 text-zinc-600"}`}>
              <toggle.icon size={22} strokeWidth={2.5} />
            </div>
            
            <div className="flex-1">
              <p className={`text-sm font-black tracking-tight ${colors.text}`}>
                {toggle.label}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary} opacity-60`}>
                {toggle.description}
              </p>
            </div>

            <Switch
              checked={toggle.enabled}
              onCheckedChange={() => toggle.onToggle()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

