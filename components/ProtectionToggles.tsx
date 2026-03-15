"use client";

import React, { useRef, useEffect } from "react";
import { Shield, Globe, Filter } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import anime from "animejs";
import { useTheme } from "./ThemeProvider";
import type { ProtectionState } from "./types";

interface ProtectionTogglesProps {
  readonly protection: ProtectionState;
  readonly onVpnToggle: () => void;
  readonly onAdblockToggle: () => void;
  readonly onFilteringToggle: () => void;
  readonly layout?: "horizontal" | "vertical";
}

export function ProtectionToggles({
  protection,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
  layout = "horizontal",
}: ProtectionTogglesProps) {
  const { colors, theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll(".toggle-card");
    anime({
      targets: items,
      scale: [0.9, 1],
      opacity: [0, 1],
      delay: anime.stagger(80),
      duration: 400,
      easing: "easeOutBack",
    });
  }, []);

  const containerClass =
    layout === "horizontal"
      ? "flex items-center gap-4 flex-wrap"
      : "flex flex-col gap-3";

  const isVpnLocked = protection.isActive;

  const handleToggle = (el: HTMLElement, callback: () => void) => {
    anime({
      targets: el,
      scale: [1, 0.95, 1],
      duration: 250,
      easing: "easeOutQuad",
    });
    callback();
  };

  const getHoverGlow = () => {
    switch (theme) {
      case "vaporwave": return "hover:shadow-[0_0_15px_rgba(244,114,182,0.15)]";
      case "frutiger-aero": return "hover:shadow-[0_0_15px_rgba(56,189,248,0.15)]";
      case "cyberpunk": return "hover:shadow-[0_0_20px_rgba(254,240,138,0.25)] hover:border-yellow-400/30";
      case "light": return "hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]";
      default: return "hover:shadow-[0_0_15px_rgba(52,211,153,0.15)] hover:border-emerald-500/30";
    }
  };

  return (
    <div ref={containerRef} className={containerClass}>
      <div
        className={`
          toggle-card flex items-center gap-3 p-3 rounded-xl
          ${colors.bgSecondary} ${colors.border} border backdrop-blur-sm
          transition-all duration-300 ${getHoverGlow()}
          ${isVpnLocked ? "opacity-60 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"}
        `}
        onClick={(e) =>
          !isVpnLocked && handleToggle(e.currentTarget, onVpnToggle)
        }
        title={isVpnLocked ? "VPN cannot be changed while active" : undefined}
      >
        <Globe
          className={
            protection.vpnEnabled ? colors.success : colors.textSecondary
          }
          size={20}
        />
        <span className={`text-sm font-medium ${colors.text}`}>VPN</span>
        <Switch
          checked={protection.vpnEnabled}
          onCheckedChange={protection.isActive ? undefined : onVpnToggle}
          onClick={(e) => e.stopPropagation()}
          disabled={isVpnLocked}
        />
      </div>

      <div
        className={`
          toggle-card flex items-center gap-3 p-3 rounded-xl
          ${colors.bgSecondary} ${colors.border} border backdrop-blur-sm
          transition-all duration-300 ${getHoverGlow()}
          hover:scale-105 active:scale-95 cursor-pointer
        `}
        onClick={(e) => handleToggle(e.currentTarget, onAdblockToggle)}
      >
        <Shield
          className={
            protection.adblockEnabled ? colors.success : colors.textSecondary
          }
          size={20}
        />
        <span className={`text-sm font-medium ${colors.text}`}>AdBlock</span>
        <Switch
          checked={protection.adblockEnabled}
          onCheckedChange={onAdblockToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div
        className={`
          toggle-card flex items-center gap-3 p-3 rounded-xl
          ${colors.bgSecondary} ${colors.border} border backdrop-blur-sm
          transition-all duration-300 ${getHoverGlow()}
          hover:scale-105 active:scale-95 cursor-pointer
        `}
        onClick={(e) => handleToggle(e.currentTarget, onFilteringToggle)}
      >
        <Filter
          className={
            protection.filteringEnabled ? colors.success : colors.textSecondary
          }
          size={20}
        />
        <span className={`text-sm font-medium ${colors.text}`}>Filter</span>
        <Switch
          checked={protection.filteringEnabled}
          onCheckedChange={onFilteringToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
