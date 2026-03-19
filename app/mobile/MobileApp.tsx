"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Palette } from "lucide-react";
import anime from "animejs";
import { useTheme } from "@/components/ThemeProvider";
import { ActivationButton } from "@/components/ActivationButton";
import { ProtectionToggles } from "@/components/ProtectionToggles";
import { ScalableContainer } from "@/components/ScalableContainer";
import { TrackerCard } from "@/components/TrackerCard";
import type {
  ProtectionState,
  Theme,
  TrackerStats,
  ServerLocation,
} from "@/components/types";
import { getVpnConfig } from "@/lib/vpn";
import { ServerMap } from "./components/ServerMap";
import { ServerList } from "./components/ServerList";

// VPN Server locations - Aligned with AWS Backend v2.0
const VPN_SERVERS: ServerLocation[] = [
  { id: "us", name: "New York", country: "United States", flag: "🇺🇸", ping: 78, load: 45, x: 25, y: 30, status: "off" },
  { id: "uk", name: "London", country: "United Kingdom", flag: "🇬🇧", ping: 12, load: 32, x: 48, y: 28, status: "off" },
  { id: "aws-eu-1", name: "Frankfurt", country: "Germany", flag: "🇩🇪", ping: 24, load: 55, x: 52, y: 27, status: "off" },
  { id: "jp", name: "Tokyo", country: "Japan", flag: "🇯🇵", ping: 180, load: 28, x: 82, y: 30, status: "off" },
  { id: "au", name: "Sydney", country: "Australia", flag: "🇦🇺", ping: 220, load: 18, x: 85, y: 70, status: "off" },
];

interface MobileAppProps {
  protection: ProtectionState;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  onFilteringToggle: () => void;
  stats?: TrackerStats;
}

type MobileTab = "shield" | "vpn" | "stats";

export function MobileApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
  stats = { totalBlocked: 0, bandwidthSaved: 0, timeSaved: 0, moneySaved: 0 },
}: Readonly<MobileAppProps>) {
  const { theme, setTheme, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<MobileTab>("shield");
  const [servers, setServers] = useState<ServerLocation[]>(VPN_SERVERS);
  const [selectedServer, setSelectedServer] = useState<ServerLocation | null>(VPN_SERVERS[0]);
  const [isVpnConnected, setIsVpnConnected] = useState(false);
  const [userLocation] = useState({ x: 48, y: 28 }); // Default to London for demo
  const contentRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);

  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      default: return "glass-card-light";
    }
  }, [theme]);

  const scrollbarClass = useMemo(() => {
    switch (theme) {
      case "dark": return "scrollbar-dark text-zinc-100";
      case "vaporwave": return "scrollbar-vaporwave text-zinc-100";
      case "frutiger-aero": return "scrollbar-frutiger text-zinc-900";
      default: return "scrollbar-light text-zinc-900";
    }
  }, [theme]);

  const premiumHeaderStyle = useMemo(() => {
    if (!protection.isActive) return { background: "transparent" };
    
    let gradient = "linear-gradient(90deg, #10b981, #3b82f6, #0ea5e9, #10b981)";
    if (theme === "vaporwave") gradient = "linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4, #ec4899)";
    else if (theme === "frutiger-aero") gradient = "linear-gradient(90deg, #38bdf8, #34d399, #2dd4bf, #38bdf8)";
    
    return {
      background: gradient,
      backgroundSize: "200% 100%",
    };
  }, [protection.isActive, theme]);

  // Tab content switching animation
  useEffect(() => {
    if (!contentRef.current) return;
    anime({
      targets: contentRef.current,
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 400,
      easing: "easeOutExpo",
    });
  }, [activeTab]);

  // Tab indicator slide animation
  useEffect(() => {
    if (!tabIndicatorRef.current) return;
    const tabIndex = activeTab === "shield" ? 0 : activeTab === "vpn" ? 1 : 2;
    anime({
      targets: tabIndicatorRef.current,
      translateX: `${tabIndex * 100}%`,
      duration: 350,
      easing: "easeOutExpo",
    });
  }, [activeTab]);

  const cycleTheme = () => {
    const themes: Theme[] = ["dark", "light", "vaporwave", "frutiger-aero"];
    const idx = themes.indexOf(theme);
    setTheme(themes[(idx + 1) % themes.length]);
  };

  return (
    <ScalableContainer maxWidth="420px" className="h-full flex flex-col relative overflow-hidden">
      {/* Premium Header Strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${protection.isActive ? "animate-gradient-shift" : ""}`}
        style={premiumHeaderStyle}
      />

      {/* Header */}
      <div className="flex items-center justify-between mt-4 mb-4 shrink-0 px-4">
        <div>
          <h1 className={`text-xl font-bold ${colors.text}`}>Privacy Shield</h1>
          <p className={`text-xs uppercase tracking-widest font-bold mt-1 ${colors.textSecondary}`}>
            Mobile Protection
          </p>
        </div>
        <button
          onClick={cycleTheme}
          className={`p-2 rounded-xl transition-all duration-300 hover-lift hover:rotate-180 ${glassCardClass}`}
        >
          <Palette className={colors.textSecondary} size={18} />
        </button>
      </div>

      {/* Content */}
      <div ref={contentRef} className={`flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pb-4 px-4 ${scrollbarClass}`}>
        {activeTab === "shield" && (
          <ShieldTab
            protection={protection}
            onProtectionToggle={onProtectionToggle}
            onVpnToggle={onVpnToggle}
            onAdblockToggle={onAdblockToggle}
            onFilteringToggle={onFilteringToggle}
            stats={stats}
            colors={colors}
          />
        )}
        {activeTab === "vpn" && (
          <VpnTab
            colors={colors}
            glassCardClass={glassCardClass}
            servers={servers}
            selectedServer={selectedServer}
            isVpnConnected={isVpnConnected}
            onVpnConnectToggle={async () => {
              if (!selectedServer) return;
              
              if (isVpnConnected) {
                // Disconnect logic
                setIsVpnConnected(false);
                setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "off" } : s));
                return;
              }

              // Start Connection
              setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "starting" } : s));
              
              try {
                const config = await getVpnConfig(selectedServer.id);
                // In a real mobile app, we'd call the native module here
                console.log("VPN Config Received:", config);
                
                // Simulate polling/waiting for "active"
                // The backend already waits for "running" before returning, 
                // but we might want to show "active" in the UI now.
                setIsVpnConnected(true);
                setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "active" } : s));
              } catch (err) {
                console.error("VPN Connection failed:", err);
                setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "off" } : s));
                alert("Failed to start VPN: " + (err as Error).message);
              }
            }}
            onServerSelect={setSelectedServer}
            userLocation={userLocation}
          />
        )}
        {activeTab === "stats" && (
          <StatsTab
            colors={colors}
            glassCardClass={glassCardClass}
            stats={stats}
            protection={protection}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className={`mt-auto px-4 py-6 shrink-0 border-t ${colors.border} bg-black/5 backdrop-blur-lg`}>
        <div className={`p-1 flex items-center justify-around relative rounded-2xl ${glassCardClass}`}>
          <div
            ref={tabIndicatorRef}
            className={`absolute left-0 top-1 bottom-1 w-1/3 p-1 z-0 transition-opacity duration-300 pointer-events-none`}
          >
            <div className={`w-full h-full rounded-xl opacity-20 ${colors.accent}`} />
          </div>
          {(["shield", "vpn", "stats"] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest z-10 transition-all duration-300
                ${activeTab === tab ? "text-white" : `${colors.textSecondary} opacity-60 hover:opacity-100`}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </ScalableContainer>
  );
}

// Sub-components for cleaner structure

interface ShieldTabProps {
  protection: ProtectionState;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  onFilteringToggle: () => void;
  stats: TrackerStats;
  colors: any;
}

function ShieldTab({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
  stats,
  colors,
}: Readonly<ShieldTabProps>) {
  return (
    <div className="flex-1 flex flex-col justify-center space-y-10 py-6">
      <div className="flex flex-col items-center">
        <div className={`relative ${protection.isActive ? "animate-shield-pulse scale-110" : "scale-100 grayscale-[0.2]"} transition-all duration-700`}>
          <ActivationButton protection={protection} onToggle={onProtectionToggle} size="xl" />
        </div>
        <p className={`mt-10 text-center text-sm font-black tracking-widest ${protection.isActive ? colors.success : colors.textSecondary}`}>
          {protection.isActive ? "SYSTEM SECURED" : "PROTECTION OFFLINE"}
        </p>
      </div>

      <div className="space-y-4">
          <ProtectionToggles
            protection={protection}
            onVpnToggle={onVpnToggle}
            onAdblockToggle={onAdblockToggle}
            onFilteringToggle={onFilteringToggle}
            layout="vertical"
          />
        <div className="pt-4">
          <TrackerCard stats={stats} compact />
        </div>
      </div>
    </div>
  );
}

interface VpnTabProps {
  colors: any;
  glassCardClass: string;
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  isVpnConnected: boolean;
  onVpnConnectToggle: () => void;
  onServerSelect: (server: ServerLocation) => void;
  userLocation: { x: number; y: number };
}

function VpnTab({
  colors,
  glassCardClass,
  servers,
  selectedServer,
  isVpnConnected,
  onVpnConnectToggle,
  onServerSelect,
  userLocation,
}: Readonly<VpnTabProps>) {
  const currentServer = servers.find(s => s.id === selectedServer?.id) || selectedServer;
  const isStarting = currentServer?.status === "starting";
  return (
    <div className="flex-1 flex flex-col gap-5 pt-2">
      <div className={`p-5 rounded-2xl transition-all duration-500 ${glassCardClass} ${isVpnConnected ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : "border-zinc-800/50"}`}>
        <div className="flex items-center justify-between mb-4">
          <span className={`text-[10px] font-black uppercase tracking-widest ${colors.textSecondary}`}>VPN Status</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${isVpnConnected ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}>
            {isVpnConnected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-4xl">{selectedServer?.flag || "🌍"}</div>
          <div className="flex flex-col">
            <span className={`text-xl font-black tracking-tight ${colors.text}`}>{selectedServer?.name || "Select Server"}</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary}`}>
              {selectedServer ? `${selectedServer.country} • ${selectedServer.ping}ms` : "Location Services Active"}
            </span>
          </div>
        </div>
      </div>

      <div className={`flex-1 rounded-2xl overflow-hidden border border-zinc-800/30 relative min-h-62.5 ${glassCardClass}`}>
        <ServerMap
          servers={servers}
          selectedServer={selectedServer}
          onServerSelect={onServerSelect}
          isConnected={isVpnConnected}
          userLocation={userLocation}
        />
      </div>

      <div className="flex-1 mt-4">
        <ServerList 
          servers={servers}
          selectedServer={selectedServer}
          onServerSelect={onServerSelect}
        />
      </div>

      <button
        onClick={onVpnConnectToggle}
        disabled={isStarting}
        className={`w-full py-5 rounded-2xl font-black tracking-[0.2em] transition-all duration-500 shadow-xl
          ${isStarting ? "bg-amber-500/20 text-amber-500 cursor-wait" : 
            isVpnConnected ? "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20" : 
            "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]"}`}
      >
        {isStarting ? "PROVISIONING..." : isVpnConnected ? "DISCONNECT VPN" : "CONNECT NOW"}
      </button>
    </div>
  );
}

interface StatsTabProps {
  colors: any;
  glassCardClass: string;
  stats: TrackerStats;
  protection: ProtectionState;
}

function StatsTab({ colors, glassCardClass, stats, protection }: Readonly<StatsTabProps>) {
  const securityItems = useMemo(() => [
    { label: "Ad Guard Service", active: protection.adblockEnabled, desc: "DNS-level filtering" },
    { label: "VPN Tunnel", active: protection.vpnEnabled, desc: "AES-256 Encryption" },
    { label: "Trackers Blocked", active: protection.isActive, desc: "Privacy Shield Active" },
  ], [protection]);

  return (
    <div className="flex-1 flex flex-col gap-8 pt-2">
      <div className="space-y-4">
        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 ${colors.textSecondary}`}>Network Metrics</h3>
        <TrackerCard stats={stats} />
      </div>

      <div className="space-y-4">
        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 ${colors.textSecondary}`}>Shield Integrity</h3>
        <div className="grid grid-cols-1 gap-3">
          {securityItems.map((item) => (
            <div key={item.label} className={`p-4 rounded-xl flex items-center justify-between border border-white/5 bg-black/10 ${glassCardClass}`}>
              <div className="flex flex-col">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${colors.textSecondary}`}>{item.label}</span>
                <span className={`text-xs font-bold ${colors.text}`}>{item.desc}</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${item.active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]" : "bg-zinc-700"}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

