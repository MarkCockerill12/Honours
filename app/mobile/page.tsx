"use client";
import React, { useState } from "react";
import { MobileApp } from "./MobileApp";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useStats } from "@/components/StatsProvider";
import type { Theme, ProtectionState } from "@/components/types";

export default function MobilePage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: false,
  });

  const { stats } = useStats();

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
      <div className="h-screen bg-zinc-950 overflow-y-auto">
        <MobileApp
          protection={protection}
          onProtectionToggle={handleProtectionToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
          onFilteringToggle={handleProtectionToggle}
          stats={{ ...stats, moneySaved: stats.moneySaved || 0, totalBlocked: stats.totalBlocked || 0 }}
        />
      </div>
    </ThemeProvider>
  );
}
