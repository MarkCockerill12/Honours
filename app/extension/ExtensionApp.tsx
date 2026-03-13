"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, LayoutDashboard, Filter } from "lucide-react";
import anime from "animejs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/ThemeProvider";
import { ActivationButton } from "@/components/ActivationButton";
import { ProtectionToggles } from "@/components/ProtectionToggles";
import { ScalableContainer } from "@/components/ScalableContainer";
import type { ProtectionState, Theme, SmartFilter } from "@/components/types";
import { SmartFilters } from "./components/SmartFilters";
import { CyberScanner } from "./components/CyberScanner";
import { Translator } from "./components/Translator";
import { AdBlockExceptions } from "./components/AdBlockExceptions";
import { AiSummary } from "./components/AiSummary";
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
  onFilteringToggle: () => void;
  filters?: SmartFilter[];
  onFiltersChange?: (filters: SmartFilter[]) => void;
}

export default function ExtensionApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
  filters: propFilters,
  onFiltersChange,
}: Readonly<ExtensionAppProps>) {
  const { colors, theme, setTheme } = useTheme();
  const [internalFilters, setInternalFilters] = useState<SmartFilter[]>([]);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.get(["filters"], (result) => {
        if (result.filters) setInternalFilters(result.filters as SmartFilter[]);
      });
    }
  }, []);

  const filters = propFilters || internalFilters;
  const setFilters = onFiltersChange || ((newFilters: SmartFilter[]) => {
    setInternalFilters(newFilters);
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.set({ filters: newFilters });
    }
  });

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
    <ScalableContainer className={`w-full h-full mx-auto relative ${scrollbarClass}`}>
      <div className={`flex flex-col h-full bg-cover bg-center ${colors.bg}`}>
        {protection.isActive && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-screen filter blur-[80px] bg-emerald-500/20 animate-pulse-glow" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-screen filter blur-[80px] bg-blue-500/20 animate-pulse-glow" style={{ animationDelay: "1s" }} />
          </div>
        )}

        <div ref={containerRef} className="flex-1 flex flex-col h-full z-10">
          <div className="px-4 pt-3 pb-1 flex items-center justify-end popup-anim-item">
              <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
                <SelectTrigger className="w-24 h-8 text-[10px] font-black uppercase tracking-widest bg-zinc-800/50 border-none rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${glassCardClass} ${colors.text} border-zinc-800/50`}>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="vaporwave">Vapor</SelectItem>
                  <SelectItem value="frutiger-aero">Aero</SelectItem>
                </SelectContent>
              </Select>
          </div>

          <Tabs defaultValue="shield" className="flex-1 flex flex-col mt-2">
            <div className="px-4 popup-anim-item">
              <TabsList className="grid grid-cols-3 w-full h-11 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50 backdrop-blur-md">
                <TabsTrigger value="shield" className="text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                  <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
                  SHIELD
                </TabsTrigger>
                <TabsTrigger value="filters" className="text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  FILTER
                </TabsTrigger>
                <TabsTrigger value="security" className="text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                  <Search className="w-3.5 h-3.5 mr-1" />
                  SCAN
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
              <TabsContent value="shield" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col items-center space-y-6">
                  <div className={`flex justify-center py-2 relative transition-all duration-700 ${protection.isActive ? "animate-shield-pulse" : "scale-95 grayscale-[0.2]"}`}>
                    <ActivationButton protection={protection} onToggle={onProtectionToggle} size="lg" />
                  </div>
                  <div className="text-center">
                    <h2 className={`text-xl font-black tracking-tighter uppercase ${colors.text}`}>{protection.isActive || protection.adblockEnabled || protection.vpnEnabled ? "Protected" : "System Off"}</h2>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${protection.isActive || protection.adblockEnabled || protection.vpnEnabled ? colors.success : colors.textSecondary}`}>
                      {protection.isActive || protection.adblockEnabled || protection.vpnEnabled ? "Security Shield Active" : "Vulnerable to trackers"}
                    </p>
                  </div>
                </div>

                <div className={`p-1 rounded-2xl ${glassCardClass} relative overflow-hidden group`}>
                   <ProtectionToggles 
                     protection={protection} 
                     onVpnToggle={onVpnToggle} 
                     onAdblockToggle={onAdblockToggle} 
                     onFilteringToggle={onFilteringToggle}
                     layout="horizontal" 
                   />
                </div>

                {blockStats && (
                  <div className={`rounded-xl overflow-hidden ${colors.border} border ${colors.bgSecondary} shadow-lg`}>
                    <div className={`flex items-center justify-between px-3 py-2 border-b ${colors.border}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${colors.textSecondary}`}>Global Stats</span>
                      <button onClick={handleResetStats} className={`text-[8px] font-black uppercase ${colors.textSecondary} hover:text-red-500`}>Clear</button>
                    </div>
                    <div className={`grid grid-cols-2 gap-px ${colors.border}`}>
                      <StatItem label="Ads Blocked" value={blockStats.totalBlocked} highlight colors={colors} />
                      <StatItem label="Data Saved" value={(blockStats.bandwidthSaved / (1024 * 1024)).toFixed(1)} unit="MB" colors={colors} />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="filters" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SmartFilters filters={filters} onFiltersChange={setFilters} isActive={protection.isActive} />
                <AdBlockExceptions />
              </TabsContent>

              <TabsContent value="security" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CyberScanner />
                <div className={`border-t ${colors.border} pt-3`}>
                  <AiSummary />
                </div>
                <div className={`border-t ${colors.border} pt-3`}>
                  <Translator />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </ScalableContainer>
  );
}

function StatItem({ label, value, unit, unitPrefix, highlight, colors }: Readonly<{ label: string, value: string | number, unit?: string, unitPrefix?: boolean, highlight?: boolean, colors: any }>) {
  return (
    <div className={`p-3 ${colors.bgSecondary} flex flex-col items-center justify-center text-center`}>
      <span className={`text-[10px] uppercase font-bold tracking-wider ${colors.textSecondary} mb-1`}>{label}</span>
      <span className={`font-black tracking-tight ${highlight ? `text-xl ${colors.success} drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]` : `text-[15px] pt-1 ${colors.text}`}`}>
        {unitPrefix && <span className={`text-xs ${colors.textSecondary} mr-0.5`}>{unit}</span>}
        {value}
        {!unitPrefix && unit && <span className={`text-xs ${colors.textSecondary} ml-0.5`}>{unit}</span>}
      </span>
    </div>
  );
}

