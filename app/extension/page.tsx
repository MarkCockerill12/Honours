"use client";
import React, { useState } from "react";
import { ExtensionApp } from "@/apps/extension/ExtensionApp";
import { ThemeProvider } from "@/packages/ui/ThemeProvider";
import type { Theme, ProtectionState, TrackerStats, SmartFilter, BlurMethod } from "@/packages/ui/types";

export default function ExtensionPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: true,
    adblockEnabled: true,
  });

  const [stats] = useState<TrackerStats>({
    bandwidthSaved: 847,
    timeSaved: 32,
    dataValueReclaimed: 4.73,
  });

  const [filters, setFilters] = useState<SmartFilter[]>([]);
  const [contextLevel, setContextLevel] = useState(50);
  const [blurMethod, setBlurMethod] = useState<BlurMethod>("blur");

  const handleProtectionToggle = () => {
    setProtection(prev => ({ ...prev, isActive: !prev.isActive }));
  };

  const handleVpnToggle = () => {
    setProtection(prev => ({ ...prev, vpnEnabled: !prev.vpnEnabled }));
  };

  const handleAdblockToggle = () => {
    setProtection(prev => ({ ...prev, adblockEnabled: !prev.adblockEnabled }));
  };

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="min-h-screen p-8 bg-zinc-950 flex justify-center">
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
      </div>
    </ThemeProvider>
  );
}