"use client"

import React, { useState, useEffect } from "react"
import { Palette, Shield, Zap, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/packages/ui/ThemeProvider"
import { ActivationButton } from "@/packages/ui/ActivationButton"
import { ProtectionToggles } from "@/packages/ui/ProtectionToggles"
import { ScalableContainer } from "@/packages/ui/ScalableContainer"
import type { ProtectionState, Theme, SmartFilter } from "@/packages/ui/types"
import { SmartFilters } from "./components/SmartFilters"
import { CyberScanner } from "./components/CyberScanner"
import { Translator } from "./components/Translator"
import { getBlockStats, resetBlockStats, type BlockStats } from './Utils/adBlockEngine';

interface ExtensionAppProps {
  protection: ProtectionState
  onProtectionToggle: () => void
  onVpnToggle: () => void
  onAdblockToggle: () => void
}

export default function ExtensionApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
}: Readonly<ExtensionAppProps>) {
  const { colors, theme, setTheme } = useTheme()
  const [filters, setFilters] = useState<SmartFilter[]>(
    [
      { id: "1", blockTerm: "violence", exceptWhen: "peace treaty", enabled: true },
      { id: "2", blockTerm: "nsfw", exceptWhen: "art", enabled: true },
    ]
  );
  const [blockStats, setBlockStats] = useState<BlockStats | null>(null);

  // Fetch block stats on mount and periodically
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
    const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleResetStats = async () => {
    try {
      const stats = await resetBlockStats();
      setBlockStats(stats);
      console.log("[ExtensionApp] Block stats reset.");
    } catch (error) {
      console.error("[ExtensionApp] Error resetting block stats:", error);
    }
  };

  return (
    <ScalableContainer className={`w-[400px] min-h-[600px] mx-auto overflow-hidden relative ${theme === 'dark' ? 'scrollbar-dark text-zinc-100' : theme === 'vaporwave' ? 'scrollbar-vaporwave text-zinc-100' : theme === 'frutiger-aero' ? 'scrollbar-frutiger text-zinc-900' : 'scrollbar-light text-zinc-900'}`}>
      <div className={`flex flex-col h-full bg-cover bg-center ${colors.bg}`}>
        
        {/* Animated Background Highlights */}
        {protection.isActive && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
             <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-screen filter blur-[80px] bg-emerald-500/20 animate-pulse-glow" />
             <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-screen filter blur-[80px] bg-blue-500/20 animate-pulse-glow" style={{ animationDelay: '1s'}} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 z-10 custom-scrollbar">
          {/* Header */}
          <div className={`glass-card rounded-2xl p-3 flex items-center justify-between shadow-lg
              ${theme === 'dark' ? 'glass-card' : theme === 'vaporwave' ? 'glass-card-vaporwave' : theme === 'frutiger-aero' ? 'glass-card-frutiger' : 'glass-card-light'}`}>
            <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${protection.isActive ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <Shield className={`w-4 h-4 ${protection.isActive ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
                <h1 className={`text-md font-black tracking-tight ${colors.text}`}>AD-BLOCK SHIELD</h1>
            </div>
            <div className="flex items-center gap-2">
              <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
                <SelectTrigger className={`w-28 h-8 text-xs font-bold tracking-wider rounded-xl border-none ${protection.isActive ? 'bg-emerald-500/10 text-emerald-500/80 hover:bg-emerald-500/20 transition-colors' : 'bg-zinc-800/50 text-zinc-400'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-zinc-800/50">
                  <SelectItem value="dark" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Dark Mode</SelectItem>
                  <SelectItem value="light" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Light Mode</SelectItem>
                  <SelectItem value="vaporwave" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Vaporwave</SelectItem>
                  <SelectItem value="frutiger-aero" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Frutiger</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-center mt-2 space-y-8">
            {/* Activation Button with premium ripple */}
            <div className={`flex justify-center py-2 relative transition-all duration-700 ${protection.isActive ? 'animate-shield-pulse' : 'scale-95 grayscale-[0.2]'}`}>
                {protection.isActive && (
                    <div className="absolute inset-0 rounded-full animate-glow-ring border border-emerald-500/20 pointer-events-none mix-blend-screen scale-110" />
                )}
                <ActivationButton protection={protection} onToggle={onProtectionToggle} size="lg" />
            </div>

            {/* Quick Status */}
            <div className="text-center w-full max-w-[280px]">
                <h2 className={`text-2xl font-black tracking-tighter mb-1 transition-all duration-300 ${protection.isActive ? 'drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : ''}`}>
                    {protection.isActive ? "PROTECTED" : "EXPOSED"}
                </h2>
                <p className={`text-xs font-medium opacity-70 tracking-wide ${protection.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {protection.isActive ? "Network encrypted & filtered" : "Ad-blocking is suspended"}
                </p>
            </div>

            {/* Protection Toggles */}
            <div className="w-full animate-fade-slide-up">
              <div className={`p-1 rounded-2xl hover-lift ${theme === 'dark' ? 'glass-card' : theme === 'vaporwave' ? 'glass-card-vaporwave' : theme === 'frutiger-aero' ? 'glass-card-frutiger' : 'glass-card-light'}`}>
                  <ProtectionToggles
                    protection={protection}
                    onVpnToggle={onVpnToggle}
                    onAdblockToggle={onAdblockToggle}
                    layout="horizontal"
                  />
              </div>
            </div>
          </div>

          {/* Blocked Stats Card */}
          {blockStats && (
            <div className={`rounded-xl overflow-hidden animate-fade-slide-up hover-lift shadow-lg
                ${theme === 'dark' ? 'glass-card' : theme === 'vaporwave' ? 'glass-card-vaporwave' : theme === 'frutiger-aero' ? 'glass-card-frutiger' : 'glass-card-light'}`}>
              <div className="flex flex-row items-center justify-between px-4 py-3 border-b border-zinc-800/30">
                <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <h3 className="text-xs font-bold tracking-widest uppercase">Performance Stats</h3>
                </div>
                <button onClick={handleResetStats} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded bg-black/20 hover:bg-black/40">
                  Reset
                </button>
              </div>
              <div className="grid grid-cols-2 gap-px bg-zinc-800/30">
                <div className="p-3 bg-black/20 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">Total Blocked</span>
                  <span className="font-black text-xl text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{blockStats.totalBlocked}</span>
                </div>
                <div className="p-3 bg-black/20 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">Bandwidth</span>
                  <span className="font-black text-[15px] pt-1 text-zinc-200">{(blockStats.bandwidthSaved / (1024 * 1024)).toFixed(1)} <span className="text-xs text-zinc-500 ml-0.5">MB</span></span>
                </div>
                <div className="p-3 bg-black/20 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">Time Saved</span>
                  <span className="font-black text-[15px] pt-1 text-zinc-200">{blockStats.timeSaved.toFixed(0)} <span className="text-xs text-zinc-500 ml-0.5">Sec</span></span>
                </div>
                <div className="p-3 bg-black/20 flex flex-col items-center justify-center text-center">
                   <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">Value Reclaimed</span>
                  <span className="font-black text-[15px] pt-1 text-zinc-200"><span className="text-xs text-zinc-500 mr-0.5">£</span>{blockStats.moneySaved.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 pl-2 mt-4 flex items-center gap-2">
                <Search className="w-3 h-3" /> System Modules
              </h3>
              
              <div className="space-y-4 pb-6">
                {/* Scanner */}
                <div className="hover-lift">
                  <CyberScanner />
                </div>

                {/* Translator */}
                <div className="hover-lift">
                  <Translator />
                </div>

                {/* Content Sanitizer */}
                <div className="hover-lift">
                  <SmartFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                  />
                </div>
              </div>
          </div>

        </div>
      </div>
    </ScalableContainer>
  )
}