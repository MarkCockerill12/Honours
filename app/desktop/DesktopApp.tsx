"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Shield,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Activity,
  ShieldCheck,
} from "lucide-react";
import anime from "animejs";
import { useTheme } from "@/components/ThemeProvider";
import { ActivationButton } from "@/components/ActivationButton";
import { TrackerCard } from "@/components/TrackerCard";
import type { ProtectionState, TrackerStats, Theme, ServerLocation } from "@/components/types";
import { SystemToggles } from "./components/SystemToggles";
import { ServerList } from "./components/ServerList";

interface DesktopAppProps {
  protection: ProtectionState;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  onFilteringToggle: () => void;
  onTest: () => Promise<{ isBlocked: boolean; output: string } | null>;
  onReset: () => Promise<void>;
  stats: TrackerStats;
  loading?: boolean;
  dnsInfo?: Record<string, string[]>;
  initialDns?: Record<string, string[]>;
  setTheme?: (theme: Theme) => void;
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  onServerSelect: (server: ServerLocation) => void;
}

export function DesktopApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
  onTest,
  onReset,
  stats,
  loading = false,
  dnsInfo = {},
  initialDns = {},
  setTheme,
  servers,
  selectedServer,
  onServerSelect,
}: Readonly<DesktopAppProps>) {
  const { colors, theme } = useTheme();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    isBlocked: boolean;
    output: string;
    summary?: string;
  } | null>(null);

  const glassCardClass = useMemo(() => {
    switch (theme) {
      case "dark": return "glass-card";
      case "vaporwave": return "glass-card-vaporwave";
      case "frutiger-aero": return "glass-card-frutiger";
      case "cyberpunk": return "glass-card-cyberpunk border border-zinc-900 bg-zinc-950/90";
      default: return "glass-card-light";
    }
  }, [theme]);

  // Dashboard Ref and Animation Logic
  const dashboardRef = useRef<HTMLDivElement>(null);
  const glow1Ref = useRef<HTMLDivElement>(null);
  const glow2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dashboardRef.current) return;
    const elements = dashboardRef.current.querySelectorAll(".dashboard-anim-item");
    anime({
      targets: elements,
      translateY: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(100, { start: 100 }),
      duration: 800,
      easing: "easeOutQuint"
    });
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    // Parallax background glows
    if (glow1Ref.current && glow2Ref.current) {
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      
      anime({
        targets: glow1Ref.current,
        translateX: x,
        translateY: y,
        duration: 1000,
        easing: 'easeOutExpo'
      });
      anime({
        targets: glow2Ref.current,
        translateX: -x * 1.5,
        translateY: -y * 1.5,
        duration: 1200,
        easing: 'easeOutExpo'
      });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await onTest();
      setTestResult(result);
    } catch (err) {
      console.error("Test failed", err);
    } finally {
      setTesting(false);
      // Keep result visible for 15 seconds so user can read it
      setTimeout(() => setTestResult(null), 15000);
    }
  };

  const adapterNames = Object.keys(dnsInfo);
  const primaryAdapter = adapterNames.find((name) => dnsInfo[name].length > 0) || adapterNames[0] || "SCANNING";
  const activeDns = dnsInfo[primaryAdapter] || ["DEFAULT"];

  return (
    <div 
      className="w-full h-screen mx-auto overflow-hidden text-zinc-100 selection:bg-emerald-500/30"
      onMouseMove={handleMouseMove}
    >
      <div className={`${colors.bg} h-full flex flex-col relative transition-colors duration-1000`}>
        {/* Ambient Glows */}
        <div
          ref={glow1Ref}
          className={`absolute -top-40 -left-20 w-150 h-150 rounded-full mix-blend-screen filter blur-[100px] opacity-20 transition-colors duration-1000 ${protection.isActive ? (theme === "cyberpunk" ? "bg-cyan-500" : "bg-emerald-500") : "bg-red-500"}`}
        />
        <div
          ref={glow2Ref}
          className={`absolute -bottom-40 -right-20 w-150 h-150 rounded-full mix-blend-screen filter blur-[100px] opacity-20 transition-colors duration-1000 ${protection.isActive ? (theme === "vaporwave" ? "bg-pink-500" : theme === "cyberpunk" ? "bg-yellow-400" : "bg-blue-500") : "bg-orange-600"}`}
        />

        {/* Top Header Strip */}
        <div className={`dashboard-anim-item ${glassCardClass} border-b ${colors.border} px-8 py-6 flex items-center justify-between z-10 relative`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border transition-all duration-500 ${protection.isActive ? "bg-emerald-500/20 border-emerald-500/30" : "bg-red-500/10 border-red-500/20"}`}>
              <Shield className={`w-5 h-5 ${protection.isActive ? "text-emerald-400" : "text-red-400"}`} />
            </div>
            <div className="flex flex-col">
              <h1 className={`text-sm font-black tracking-tight ${colors.text}`}>AD-BLOCK SHIELD</h1>
              <p className={`text-[9px] font-bold ${colors.textSecondary} opacity-40 uppercase`}>Honours Project Edition</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const themes: Theme[] = ["dark", "light", "vaporwave", "frutiger-aero"];
                const idx = themes.indexOf(theme);
                if (setTheme) setTheme(themes[(idx + 1) % themes.length]);
              }}
              className={`p-2 rounded-xl transition-all duration-300 hover:rotate-180 bg-black/20 border ${colors.border} ${colors.textSecondary}`}
              title="Switch Theme"
            >
              <Activity className="w-4 h-4" />
            </button>
            <div className={`text-[9px] font-mono px-3 py-1 rounded-full border ${colors.border} ${colors.textSecondary} opacity-60 bg-black/20`}>
              BUILD v1.0.42 [STABLE]
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div ref={dashboardRef} className="flex-1 flex flex-col overflow-hidden items-center perspective-[1000px]">
          <div className="w-full max-w-full px-8 py-8 lg:px-24 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start py-4">
              
              {/* Left Side: System Integrity & Stats */}
              <div className="md:col-span-5 space-y-6 flex flex-col z-10">
                <div className="dashboard-anim-item">
                  <IntegrityCard 
                    protection={protection} 
                    glassCardClass={glassCardClass} 
                    colors={colors} 
                    onTest={handleTest} 
                    onReset={onReset}
                    testing={testing}
                    testResult={testResult}
                    dnsInfo={dnsInfo}
                    initialDns={initialDns}
                  />
                </div>
                
                <div className="dashboard-anim-item">
                  <ServerList
                    servers={servers}
                    selectedServer={selectedServer}
                    onServerSelect={onServerSelect}
                  />
                </div>
                
                <div className="dashboard-anim-item bg-black/20 rounded-4xl p-1 border border-zinc-800/50">
                  <TrackerCard stats={stats} />
                </div>
              </div>

              {/* Right Side: Primary Activation Area */}
              <div className="md:col-span-7 z-10 dashboard-anim-item">
                <ActivationArea 
                  protection={protection}
                  glassCardClass={glassCardClass}
                  colors={colors}
                  onProtectionToggle={onProtectionToggle}
                  onAdblockToggle={onAdblockToggle}
                  onVpnToggle={onVpnToggle}
                  onFilteringToggle={onFilteringToggle}
                  loading={loading}
                />
              </div>
            </div>
          </div>

          {/* Detailed Footer Bar */}
          <div className={`dashboard-anim-item w-full ${colors.bgSecondary} border-t ${colors.border} px-8 py-3 flex items-center justify-between text-[10px] font-black tracking-[0.2em] z-10 ${colors.textSecondary}`}>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                ADAPTER: <span className="text-zinc-300 uppercase">{primaryAdapter}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-3.5 h-3.5 ${protection.isActive ? "text-emerald-500" : "text-zinc-600"}`} />
                DNS NODE: <span className="text-zinc-300">{protection.isActive ? activeDns[0] : "DEFAULT"}</span>
              </div>
            </div>
            <div className="flex items-center gap-6 opacity-60">
              <span>PROTOCOL: AES-256-GCM</span>
              <span>VERSION: 5.4.1-STABLE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Internal Sub-components for better complexity management

interface IntegrityCardProps {
  protection: ProtectionState;
  glassCardClass: string;
  colors: any;
  onTest: () => void;
  onReset: () => void;
  testing: boolean;
  testResult: { isBlocked: boolean; output: string; summary?: string } | null;
  dnsInfo: Record<string, string[]>;
  initialDns: Record<string, string[]>;
}

function IntegrityCard({ 
  protection, 
  glassCardClass, 
  colors, 
  onTest, 
  onReset,
  testing,
  testResult,
  dnsInfo,
  initialDns
}: Readonly<IntegrityCardProps>) {
  const testButtonContent = useMemo(() => {
    if (testing) return { text: "VALIDATING...", icon: <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin" /> };
    if (testResult) {
      return {
        text: testResult.isBlocked ? "SHIELD ACTIVE" : "PROTECTION FAILED",
        icon: testResult.isBlocked ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />,
        className: testResult.isBlocked ? "bg-emerald-500 text-emerald-950 shadow-emerald-500/25" : "bg-red-500 text-white shadow-red-500/25"
      };
    }
    return {
      text: "TEST PROTECTION",
      icon: <Terminal className="w-5 h-5" />,
      className: protection.isActive 
        ? "bg-zinc-100 hover:bg-white text-zinc-900 shadow-white/10" 
        : "bg-zinc-100/10 hover:bg-zinc-100/20 text-zinc-300 border border-zinc-700 shadow-none"
    };
  }, [testing, testResult, protection.isActive]);

  return (
    <div className={`rounded-3xl ${glassCardClass} p-5 flex flex-col justify-between hover-lift transition-all duration-500 ${protection.isActive ? "border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.05)]" : "border-zinc-800 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"}`}>
      <div className="mb-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${protection.isActive ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
          <span>System Health</span>
        </h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50">
            <span className="text-sm tracking-wide text-zinc-300 font-bold">Initial Context</span>
            <span className="text-[10px] font-black text-zinc-500 bg-zinc-500/10 px-3 py-1 border border-zinc-500/20 rounded-full">
              {Object.values(initialDns)[0]?.[0] || "ISP-DEFAULT"}
            </span>
          </div>
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50">
            <span className="text-sm tracking-wide text-zinc-300 font-bold">DNS Node</span>
            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${protection.isActive ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {protection.isActive ? "ADGUARD-PRIVATE" : "UNFILTERED"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm tracking-wide text-zinc-300 font-bold">Current Node</span>
            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${protection.isActive ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-zinc-400 bg-zinc-800 border border-zinc-700"}`}>
              {Object.values(dnsInfo)[0]?.[0] || "SCANNING"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-4">
        {testResult && (
          <div className={`p-4 rounded-xl border mb-4 text-[11px] font-medium leading-relaxed animate-fade-slide-up ${testResult.isBlocked ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            <div className="font-black uppercase tracking-widest mb-1 opacity-60">Test Result:</div>
            <p className="mb-2 italic opacity-90">{testResult.summary}</p>
            <div className="p-2 rounded bg-black/40 font-mono text-[9px] overflow-hidden truncate">
              {testResult.output.split('\n')[0]}...
            </div>
          </div>
        )}
        <button
          onClick={onTest}
          disabled={testing}
          className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-sm font-black tracking-widest transition-all shadow-xl ${testButtonContent.className}`}
        >
          {testButtonContent.icon}
          {testButtonContent.text}
        </button>
        <button
          onClick={onReset}
          className="w-full py-2 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase opacity-40 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all text-zinc-500"
        >
          Emergency Protocol Reset
        </button>
      </div>
    </div>
  );
}

interface ActivationAreaProps {
  protection: ProtectionState;
  glassCardClass: string;
  colors: any;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  onFilteringToggle: () => void;
  loading: boolean;
}

function ActivationArea({
  protection,
  glassCardClass,
  colors,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onFilteringToggle,
  loading
}: Readonly<ActivationAreaProps>) {
  const statusHeading = protection.isActive ? "SYSTEM SECURED" : "PROTECTION PAUSED";
  const statusSubtext = protection.isActive 
    ? "Network traffic is encrypted and filtered. Tracking domains are blocked system-wide."
    : "Ad-blocking suspended. Your privacy is currently exposed to public networks.";

  return (
    <div className={`h-full rounded-4xl ${glassCardClass} p-8 lg:p-10 relative overflow-hidden flex flex-col items-center justify-center transition-all duration-700 hover-lift ${protection.isActive ? "border-emerald-500/30 shadow-[0_0_80px_rgba(16,185,129,0.1)]" : "border-red-500/20"}`}>
      <div className={`absolute inset-0 transition-opacity duration-1000 ${protection.isActive ? "opacity-10 animate-pulse" : "opacity-0"} pointer-events-none bg-emerald-500 blur-[120px]`} />

      <div className="relative z-10 flex flex-col items-center text-center w-full">
        <div className="mb-6">
          <h2 className={`text-3xl lg:text-4xl font-black ${colors.text} mb-2 tracking-tighter ${protection.isActive ? "drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]" : ""} transition-all duration-500`}>
            {statusHeading}
          </h2>
          <p className={`text-xs font-medium ${colors.textSecondary} leading-relaxed tracking-wide opacity-80 max-w-sm`}>
            {statusSubtext}
          </p>
        </div>

        <div className={`mt-8 transition-all duration-700 py-6 relative ${protection.isActive ? "animate-shield-pulse scale-105" : "scale-100 grayscale-[0.2]"}`}>
          {protection.isActive && (
            <div className="absolute inset-0 -m-8 rounded-full border border-emerald-500/20 animate-glow-ring pointer-events-none mix-blend-screen" />
          )}
          <ActivationButton
            protection={protection}
            onToggle={onProtectionToggle}
            size="lg"
            loading={loading}
          />
        </div>

        <div className="mt-10 w-full max-w-sm">
          <SystemToggles
            systemAdblock={protection.adblockEnabled}
            onSystemAdblockToggle={onAdblockToggle}
            vpn={protection.vpnEnabled}
            onVpnToggle={onVpnToggle}
          />
        </div>
      </div>
    </div>
  );
}

