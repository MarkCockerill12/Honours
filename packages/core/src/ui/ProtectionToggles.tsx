"use client";

import React, { useRef, useEffect } from "react";
import { Switch } from "./primitives/switch";
import anime from "animejs";
import { useTheme } from "./ThemeProvider";
import { LucideIcon } from "lucide-react";

interface ToggleItem {
  id: string;
  icon: LucideIcon;
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

interface ProtectionTogglesProps {
  readonly items: ToggleItem[];
  readonly layout?: "horizontal" | "vertical" | "list" | "grid";
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
      translateY: [10, 0],
      opacity: [0, 1],
      delay: anime.stagger(60),
      duration: 350,
      easing: "easeOutQuart",
    });
  }, [items.length]);

  const containerClass =
    layout === "horizontal"
      ? "flex items-center gap-4 flex-wrap"
      : layout === "vertical" || layout === "list"
      ? "flex flex-col gap-2"
      : "grid grid-cols-2 gap-2";

  return (
    <div ref={containerRef} className={`${containerClass} ${className} pointer-events-auto w-full`}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`
            toggle-card flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300 group
            ${theme === "dark" 
              ? "bg-[#18181b] border border-zinc-800/50 hover:border-zinc-700" 
              : "bg-white border border-zinc-200 hover:border-zinc-300 shadow-sm"}
            ${item.disabled ? "opacity-50 grayscale cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
            ${item.enabled && theme === "dark" ? "ring-1 ring-[#10b981]/20 bg-[#10b981]/5" : ""}
            ${item.enabled && theme !== "dark" ? "ring-1 ring-emerald-500/10 bg-emerald-50/30" : ""}
          `}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!item.disabled) item.onToggle();
          }}
        >
          <div className="flex items-center gap-3 pointer-events-none">
            <div className={`
              p-2 rounded-xl transition-colors duration-300
              ${item.enabled 
                ? (theme === 'dark' ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-emerald-100 text-emerald-600') 
                : (theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400')}
            `}>
              <item.icon size={18} />
            </div>
            <div className="flex flex-col">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${theme === "dark" ? 'text-zinc-200' : 'text-zinc-900'}`}>
                {item.label}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-tight ${item.enabled 
                ? (theme === 'frutiger-aero' ? 'text-emerald-700' : colors.success) 
                : 'text-zinc-500 opacity-60'}`}>
                {item.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          </div>

          <div className={`
            p-1 rounded-full transition-all duration-300
            ${item.enabled ? 'bg-emerald-500/10' : 'bg-zinc-500/5'}
          `}>
            <Switch
              checked={item.enabled}
              onCheckedChange={() => {}} // parent div handles the click
              disabled={item.disabled}
              className="pointer-events-none"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
