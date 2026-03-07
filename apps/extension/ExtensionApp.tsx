"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Shield, Zap, Search } from "lucide-react";
import anime from "animejs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/packages/ui/ThemeProvider";
import { ActivationButton } from "@/packages/ui/ActivationButton";
import { ProtectionToggles } from "@/packages/ui/ProtectionToggles";
import { ScalableContainer } from "@/packages/ui/ScalableContainer";
import type { ProtectionState, Theme, SmartFilter } from "@/packages/ui/types";
import { SmartFilters } from "./components/SmartFilters";
import { CyberScanner } from "./components/CyberScanner";
import { Translator } from "./components/Translator";
import {
  getBlockStats,
  resetBlockStats,
  type BlockStats,
} from "./Utils/adBlockEngine";

interface ExtensionAppProps {
  protection: ProtectionState;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  filters?: SmartFilter[];
  onFiltersChange?: (filters: SmartFilter[]) => void;
}

export default function ExtensionApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  filters: propFilters,
  onFiltersChange,
}: Readonly<ExtensionAppProps>) {
  const { colors, theme, setTheme } = useTheme();
  const [internalFilters, setInternalFilters] = useState<SmartFilter[]>([
    {
      id: "1",
      blockTerm: "violence",
      exceptWhen: "peace treaty",
      enabled: true,
      blockScope: "word",
    },
    {
      id: "2",
      blockTerm: "nsfw",
      exceptWhen: "art",
      enabled: true,
      blockScope: "word",
    },
  ]);

  const filters = propFilters || internalFilters;
  const setFilters = onFiltersChange || setInternalFilters;
  const [blockStats, setBlockStats] = useState<BlockStats | null>(null);

  const scrollbarClass = useMemo(() => {
    switch (theme) {
      case "dark": return "scrollbar-dark text-zinc-100";
      case "vaporwave": return "scrollbar-vaporwave text-zinc-100";
      case "frutiger-aero": return "scrollbar-frutiger text-zinc-900";
      default: return "scrollbar-light text-zinc-900";
    }
  }, [theme]);

  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      default: return "glass-card-light";
    }
  }, [theme]);

  // Entrance Animation Logic
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const elements = containerRef.current.querySelectorAll(".popup-anim-item");
    anime({
      targets: elements,
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(50),
      duration: 600,
      easing: "easeOutQuint"
    });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await getBlockStats();
        setBlockStats(stats);
      } catch (error) {
        console.error("[ExtensionApp] Error fetching block stats:", error);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResetStats = async () => {
    try {
      const stats = await resetBlockStats();
      setBlockStats(stats);
    } catch (error) {
      console.error("[ExtensionApp] Error resetting block stats:", error);
    }
  };

  return (
    <ScalableContainer className={`w-100 h-150 max-h-150 mx-auto overflow-hidden relative ${scrollbarClass}`}>
      <div className={`flex flex-col h-full bg-cover bg-center ${colors.bg}`}>
        {protection.isActive && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-screen filter blur-[80px] bg-emerald-500/20 animate-pulse-glow" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-screen filter blur-[80px] bg-blue-500/20 animate-pulse-glow" style={{ animationDelay: "1s" }} />
          </div>
        )}

        <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6 z-10 custom-scrollbar">
          <div className="popup-anim-item">
            <ExtensionHeader theme={theme} setTheme={setTheme} protection={protection} colors={colors} glassCardClass={glassCardClass} />
          </div>

          <div className="flex flex-col items-center mt-2 space-y-8">
            <div className={`popup-anim-item flex justify-center py-2 relative transition-all duration-700 ${protection.isActive ? "animate-shield-pulse" : "scale-95 grayscale-[0.2]"}`}>
              {protection.isActive && (
                <div className="absolute inset-0 rounded-full animate-glow-ring border border-emerald-500/20 pointer-events-none mix-blend-screen scale-110" />
              )}
              <ActivationButton protection={protection} onToggle={onProtectionToggle} size="lg" />
            </div>

            <div className="popup-anim-item text-center w-full max-w-70">
              <h2 className={`text-2xl font-black tracking-tighter mb-1 transition-all duration-300 ${protection.isActive ? "drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" : ""}`}>
                {protection.isActive ? "PROTECTED" : "EXPOSED"}
              </h2>
              <p className={`text-xs font-medium opacity-70 tracking-wide ${protection.isActive ? "text-emerald-400" : "text-red-400"}`}>
                {protection.isActive ? "Network encrypted & filtered" : "Ad-blocking is suspended"}
              </p>
            </div>

            <div className="popup-anim-item w-full">
              <div className={`p-1 rounded-2xl hover-lift ${glassCardClass}`}>
                <ProtectionToggles protection={protection} onVpnToggle={onVpnToggle} onAdblockToggle={onAdblockToggle} layout="horizontal" />
              </div>
            </div>
          </div>

          {blockStats && (
            <div className="popup-anim-item">
              <StatsCard blockStats={blockStats} onReset={handleResetStats} glassCardClass={glassCardClass} />
            </div>
          )}

          <div className="space-y-4">
            <h3 className="popup-anim-item text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 pl-2 mt-4 flex items-center gap-2">
              <Search className="w-3 h-3" /> System Modules
            </h3>
            <div className="space-y-4 pb-6">
              <div className="popup-anim-item hover-lift"><CyberScanner /></div>
              <div className="hover-lift"><Translator /></div>
              <div className="hover-lift"><SmartFilters filters={filters} onFiltersChange={setFilters} /></div>
            </div>
          </div>
        </div>
      </div>
    </ScalableContainer>
  );
}

function ExtensionHeader({ theme, setTheme, protection, colors, glassCardClass }: Readonly<{ theme: Theme, setTheme: (t: Theme) => void, protection: ProtectionState, colors: any, glassCardClass: string }>) {
  return (
    <div className={`rounded-2xl p-3 flex items-center justify-between shadow-lg ${glassCardClass}`}>
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${protection.isActive ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/20"}`}>
          <Shield className={`w-4 h-4 ${protection.isActive ? "text-emerald-400" : "text-red-400"}`} />
        </div>
        <h1 className={`text-md font-black tracking-tight ${colors.text}`}>AD-BLOCK SHIELD</h1>
      </div>
      <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
        <SelectTrigger className={`w-28 h-8 text-xs font-bold tracking-wider rounded-xl border-none ${protection.isActive ? "bg-emerald-500/10 text-emerald-500/80 hover:bg-emerald-500/20 transition-colors" : "bg-zinc-800/50 text-zinc-400"}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
          <SelectItem value="dark" className="focus:bg-zinc-800 focus:text-white cursor-pointer hover:bg-zinc-800/50">Dark Mode</SelectItem>
          <SelectItem value="light" className="focus:bg-zinc-200 focus:text-black cursor-pointer hover:bg-zinc-200/50">Light Mode</SelectItem>
          <SelectItem value="vaporwave" className="focus:bg-purple-800 focus:text-white cursor-pointer hover:bg-purple-800/50">Vaporwave</SelectItem>
          <SelectItem value="frutiger-aero" className="focus:bg-sky-200 focus:text-slate-900 cursor-pointer hover:bg-sky-200/50">Frutiger</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function StatsCard({ blockStats, onReset, glassCardClass }: Readonly<{ blockStats: BlockStats, onReset: () => void, glassCardClass: string }>) {
  return (
    <div className={`rounded-xl overflow-hidden animate-fade-slide-up hover-lift shadow-lg ${glassCardClass}`}>
      <div className="flex flex-row items-center justify-between px-4 py-3 border-b border-zinc-800/30">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <h3 className="text-xs font-bold tracking-widest uppercase">Performance Stats</h3>
        </div>
        <button onClick={onReset} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded bg-black/20 hover:bg-black/40">Reset</button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-zinc-800/30">
        <StatItem label="Total Blocked" value={blockStats.totalBlocked} highlight />
        <StatItem label="Bandwidth" value={(blockStats.bandwidthSaved / (1024 * 1024)).toFixed(1)} unit="MB" />
        <StatItem label="Time Saved" value={blockStats.timeSaved.toFixed(0)} unit="Sec" />
        <StatItem label="Value Reclaimed" value={blockStats.moneySaved.toFixed(2)} unit="£" unitPrefix />
      </div>
    </div>
  );
}

function StatItem({ label, value, unit, unitPrefix, highlight }: Readonly<{ label: string, value: string | number, unit?: string, unitPrefix?: boolean, highlight?: boolean }>) {
  return (
    <div className="p-3 bg-black/20 flex flex-col items-center justify-center text-center">
      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">{label}</span>
      <span className={`font-black tracking-tight ${highlight ? "text-xl text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "text-[15px] pt-1 text-zinc-200"}`}>
        {unitPrefix && <span className="text-xs text-zinc-500 mr-0.5">{unit}</span>}
        {value}
        {!unitPrefix && unit && <span className="text-xs text-zinc-500 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}
