"use client";

import React, { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import anime from "animejs";
import { useTheme } from "@/packages/ui/ThemeProvider";
import { ActivationButton } from "@/packages/ui/ActivationButton";
import { ProtectionToggles } from "@/packages/ui/ProtectionToggles";
import { ScalableContainer } from "@/packages/ui/ScalableContainer";
import { TrackerCard } from "@/packages/ui/TrackerCard";
import type {
  ProtectionState,
  Theme,
  TrackerStats,
  ServerLocation,
} from "@/packages/ui/types";
import { ServerMap } from "./components/ServerMap";

// VPN Server locations
const VPN_SERVERS: ServerLocation[] = [
  {
    id: "uk-1",
    name: "London",
    country: "United Kingdom",
    flag: "🇬🇧",
    ping: 12,
    load: 32,
    x: 48,
    y: 28,
  },
  {
    id: "us-1",
    name: "New York",
    country: "United States",
    flag: "🇺🇸",
    ping: 78,
    load: 45,
    x: 25,
    y: 30,
  },
  {
    id: "de-1",
    name: "Frankfurt",
    country: "Germany",
    flag: "🇩🇪",
    ping: 24,
    load: 55,
    x: 52,
    y: 27,
  },
  {
    id: "jp-1",
    name: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    ping: 180,
    load: 28,
    x: 82,
    y: 30,
  },
  {
    id: "au-1",
    name: "Sydney",
    country: "Australia",
    flag: "🇦🇺",
    ping: 220,
    load: 18,
    x: 85,
    y: 70,
  },
  {
    id: "ca-1",
    name: "Toronto",
    country: "Canada",
    flag: "🇨🇦",
    ping: 92,
    load: 38,
    x: 22,
    y: 25,
  },
  {
    id: "sg-1",
    name: "Singapore",
    country: "Singapore",
    flag: "🇸🇬",
    ping: 160,
    load: 22,
    x: 76,
    y: 52,
  },
  {
    id: "br-1",
    name: "São Paulo",
    country: "Brazil",
    flag: "🇧🇷",
    ping: 180,
    load: 15,
    x: 32,
    y: 62,
  },
];

interface MobileAppProps {
  protection: ProtectionState;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  stats?: TrackerStats;
}

type MobileTab = "shield" | "vpn" | "stats";

export function MobileApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  stats = { bandwidthSaved: 0, timeSaved: 0, dataValueReclaimed: 0 },
}: MobileAppProps) {
  const { theme, setTheme, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<MobileTab>("shield");
  const [selectedServer, setSelectedServer] = useState<ServerLocation | null>(
    VPN_SERVERS[0],
  );
  const [isVpnConnected, setIsVpnConnected] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);

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

  const handleServerSelect = (server: ServerLocation) => {
    setSelectedServer(server);
  };

  const themes: Theme[] = ["dark", "light", "vaporwave", "frutiger-aero"];
  const cycleTheme = () => {
    const idx = themes.indexOf(theme);
    setTheme(themes[(idx + 1) % themes.length]);
  };

  const getTabColor = (tab: MobileTab) => {
    if (tab === activeTab) return "text-white font-bold";
    return `${colors.textSecondary} hover:text-white/80`;
  };

  return (
    <ScalableContainer
      maxWidth="420px"
      className="h-full flex flex-col relative overflow-hidden"
    >
      {/* Premium Header Strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${protection.isActive ? "animate-gradient-shift" : ""}`}
        style={{
          background: protection.isActive
            ? theme === "vaporwave"
              ? "linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4, #ec4899)"
              : theme === "frutiger-aero"
                ? "linear-gradient(90deg, #38bdf8, #34d399, #2dd4bf, #38bdf8)"
                : "linear-gradient(90deg, #10b981, #3b82f6, #0ea5e9, #10b981)"
            : "transparent",
          backgroundSize: "200% 100%",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mt-4 mb-4 shrink-0 px-2">
        <div>
          <h1 className={`text-xl font-bold ${colors.text}`}>Privacy Shield</h1>
          <p
            className={`text-xs uppercase tracking-widest font-bold mt-1 ${colors.textSecondary}`}
          >
            Mobile Protection
          </p>
        </div>
        <button
          onClick={cycleTheme}
          className={`p-2 rounded-xl transition-all duration-300 hover-lift hover:rotate-180
            ${theme === "dark" ? "glass-card" : theme === "vaporwave" ? "glass-card-vaporwave" : theme === "frutiger-aero" ? "glass-card-frutiger" : "glass-card-light"}`}
          title="Change theme"
        >
          <Palette className={colors.textSecondary} size={18} />
        </button>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pb-4 px-2"
      >
        {activeTab === "shield" && (
          <div className="animate-fade-slide-up bg-black/5 rounded-2xl h-full flex flex-col justify-center px-4 space-y-8">
            {/* Activation Button with Shield Pulse wrapper */}
            <div className="flex justify-center flex-col items-center">
              <div
                className={`relative ${protection.isActive ? "animate-shield-pulse" : ""} transition-all duration-700`}
              >
                <ActivationButton
                  protection={protection}
                  onToggle={onProtectionToggle}
                  size="xl"
                />
              </div>

              {/* Status text */}
              <p
                className={`mt-8 text-center text-sm font-medium tracking-wide ${protection.isActive ? colors.success : colors.textSecondary}`}
              >
                {protection.isActive ? "SYSTEM SECURED" : "PROTECTION OFFLINE"}
              </p>
            </div>

            {/* Protection Toggles */}
            <div
              className="animate-fade-slide-up"
              style={{ animationDelay: "100ms" }}
            >
              <ProtectionToggles
                protection={protection}
                onVpnToggle={onVpnToggle}
                onAdblockToggle={onAdblockToggle}
                layout="vertical"
              />
            </div>

            {/* Compact Stats */}
            <div className="pt-4">
              <TrackerCard stats={stats} compact />
            </div>
          </div>
        )}

        {activeTab === "vpn" && (
          <div className="animate-fade-slide-up h-full flex flex-col gap-4">
            {/* Connection Status Card */}
            <div
              className={`p-4 rounded-xl transition-all duration-500
              ${theme === "dark" ? "glass-card" : theme === "vaporwave" ? "glass-card-vaporwave" : theme === "frutiger-aero" ? "glass-card-frutiger" : "glass-card-light"}
              ${isVpnConnected ? "inner-glow-emerald border-emerald-500/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-medium uppercase tracking-wider ${colors.textSecondary}`}
                >
                  Status
                </span>
                <span
                  className={`text-sm font-bold tracking-wider ${isVpnConnected ? colors.success : colors.warning}`}
                >
                  {isVpnConnected ? "CONNECTED" : "DISCONNECTED"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-3xl ${colors.text}`}>
                  {selectedServer?.flag}
                </div>
                <div>
                  <div className={`font-semibold ${colors.text}`}>
                    {selectedServer?.country || "Select a server"}
                  </div>
                  <div className={`text-xs ${colors.textSecondary}`}>
                    {selectedServer && isVpnConnected
                      ? `IP: 198.51.100.${selectedServer.ping}`
                      : "Traffic unencrypted"}
                  </div>
                </div>
              </div>

              {isVpnConnected && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20">
                  <div className="h-1.5 w-full bg-emerald-950/50 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-emerald-500 rounded-full animate-connection-flow"></div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-zinc-400">
                    <span>Protocol: WireGuard</span>
                    <span className="text-emerald-400 font-medium tracking-wide animate-pulse">
                      Secured
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* VPN World Map */}
            <div
              className={`rounded-xl overflow-hidden hover-lift flex-1 transition-all duration-300
              ${theme === "dark" ? "glass-card" : theme === "vaporwave" ? "glass-card-vaporwave" : theme === "frutiger-aero" ? "glass-card-frutiger" : "glass-card-light"}`}
            >
              <ServerMap
                servers={VPN_SERVERS}
                selectedServer={selectedServer}
                onServerSelect={handleServerSelect}
                isConnected={isVpnConnected}
                userLocation={{ x: 48, y: 28 }}
              />
            </div>

            {/* Connect button */}
            <button
              onClick={() => setIsVpnConnected(!isVpnConnected)}
              className={`w-full py-4 rounded-xl font-bold tracking-wide text-sm transition-all duration-300 hover-lift mt-2 ${
                isVpnConnected
                  ? "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20"
                  : `${colors.accent} text-white hover:opacity-90 shadow-lg shadow-emerald-500/20`
              }`}
            >
              {isVpnConnected ? "DISCONNECT" : "QUICK CONNECT"}
            </button>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="animate-fade-slide-up space-y-4 pb-4">
            {/* Full Stats */}
            <TrackerCard stats={stats} />

            {/* Additional info */}
            <div
              className={`p-5 rounded-xl transition-all duration-300 hover-lift
              ${theme === "dark" ? "glass-card" : theme === "vaporwave" ? "glass-card-vaporwave" : theme === "frutiger-aero" ? "glass-card-frutiger" : "glass-card-light"}`}
            >
              <h3
                className={`text-xs font-bold uppercase tracking-wider mb-2 ${colors.textSecondary}`}
              >
                How it works
              </h3>
              <p
                className={`text-sm ${colors.textSecondary} leading-relaxed font-medium`}
              >
                Privacy Shield uses system-level DNS filtering to block ads and
                trackers across all apps on your device. When enabled, ad
                requests are redirected to a null address, saving bandwidth and
                protecting your privacy.
              </p>
            </div>

            {/* Protection status */}
            <div
              className={`p-5 rounded-xl transition-all duration-300 hover-lift
              ${theme === "dark" ? "glass-card" : theme === "vaporwave" ? "glass-card-vaporwave" : theme === "frutiger-aero" ? "glass-card-frutiger" : "glass-card-light"}`}
            >
              <h3
                className={`text-xs font-bold uppercase tracking-wider mb-4 ${colors.textSecondary}`}
              >
                System Security
              </h3>
              <div className="space-y-4">
                {[
                  {
                    label: "Ad Blocking",
                    active: protection.adblockEnabled,
                    desc: "DNS-level ad filtering",
                  },
                  {
                    label: "VPN Tunnel",
                    active: protection.vpnEnabled,
                    desc: "Encrypted traffic routing",
                  },
                  {
                    label: "Tracker Blocking",
                    active: protection.isActive,
                    desc: "System-wide privacy",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between pb-3 border-b border-zinc-700/50 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className={`text-sm font-bold ${colors.text}`}>
                        {item.label}
                      </p>
                      <p
                        className={`text-xs font-medium mt-0.5 ${colors.textSecondary}`}
                      >
                        {item.desc}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                        item.active
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]"
                          : "bg-zinc-800 text-zinc-500 border-zinc-700"
                      }`}
                    >
                      {item.active ? "ACTIVE" : "OFFLINE"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Glassmorphic Bottom Tab Navigation */}
      <div
        className={`mt-auto shrink-0 relative p-1.5 mx-2 rounded-2xl flex items-center shadow-[0_-10px_40px_rgba(0,0,0,0.2)] mb-4
        ${theme === "dark" ? "glass-card" : theme === "vaporwave" ? "glass-card-vaporwave" : theme === "frutiger-aero" ? "glass-card-frutiger" : "glass-card-light"}`}
      >
        {/* Sliding background indicator */}
        <div
          ref={tabIndicatorRef}
          className={`absolute top-1.5 bottom-1.5 rounded-xl transition-none ${colors.accent}`}
          style={{ width: "calc(33.33% - 4px)", left: "2px", opacity: 0.15 }}
        />

        {(["shield", "vpn", "stats"] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative z-10 flex-1 py-3 text-sm font-bold tracking-wide rounded-xl transition-all duration-300 ${getTabColor(tab)} hover:scale-105 active:scale-95`}
          >
            {tab === "shield" ? "SHIELD" : tab === "vpn" ? "VPN" : "STATS"}
          </button>
        ))}
      </div>
    </ScalableContainer>
  );
}
