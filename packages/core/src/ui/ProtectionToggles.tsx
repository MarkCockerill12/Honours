"use client";

import React, { useRef, useEffect } from "react";
import { Shield, Globe, Filter } from "lucide-react";
import { Switch } from "./primitives/switch";
import anime from "animejs";
import { useTheme } from "./ThemeProvider";
import type { ProtectionState } from "../shared";

interface ToggleItem {
  id: string;
  icon: any;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

interface ProtectionTogglesProps {
  readonly items: ToggleItem[];
  readonly layout?: "horizontal" | "vertical";
  readonly className?: string;
}

export function ProtectionToggles({
  items,
  layout = "horizontal",
  className = "",
}: ProtectionTogglesProps) {
  const { colors, theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const itemEls = containerRef.current.querySelectorAll(".toggle-card");
    anime({
      targets: itemEls,
      scale: [0.95, 1],
      opacity: [0, 1],
      delay: anime.stagger(60),
      duration: 350,
      easing: "easeOutQuart",
    });
  }, [items.length]);

  const containerClass =
    layout === "horizontal"
      ? "flex items-center gap-4 flex-wrap"
      : "flex flex-col gap-3";

  const getHoverGlow = () => {
    switch (theme) {
      case "vaporwave": return "hover:shadow-[0_0_20px_rgba(244,114,182,0.25)]";
      case "frutiger-aero": return "hover:shadow-[0_0_20px_rgba(56,189,248,0.25)]";
      default: return "hover:shadow-[0_0_15px_rgba(52,211,153,0.1)] hover:border-emerald-500/20";
    }
  };

  return (
    <div ref={containerRef} className={`${containerClass} ${className}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`
            toggle-card flex items-center gap-4 p-4 rounded-2xl
            ${colors.bgSecondary} ${colors.border} border backdrop-blur-md
            transition-all duration-300 ${getHoverGlow()}
            ${item.disabled ? "opacity-50 grayscale cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98] cursor-pointer"}
          `}
          onClick={() => !item.disabled && item.onToggle()}
        >
          <div className={`p-2.5 rounded-xl transition-all duration-500 ${item.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-black/20 text-zinc-600"}`}>
            <item.icon size={22} strokeWidth={2.5} />
          </div>

          <div className="flex-1 min-w-[120px]">
            <p className={`text-sm font-black tracking-tight ${colors.text}`}>
              {item.label}
            </p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary} opacity-60 truncate max-w-[180px]`}>
              {item.description}
            </p>
          </div>

          <Switch
            checked={item.enabled}
            onCheckedChange={() => !item.disabled && item.onToggle()}
            disabled={item.disabled}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />
        </div>
      ))}
    </div>
  );
}
