"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  Filter, 
  Globe, 
  Shield, 
  Radar,
  Brain,
  HelpCircle,
  Zap,
  Lock,
} from "lucide-react";
import anime from "animejs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@privacy-shield/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@privacy-shield/core";
import { useTheme } from "@privacy-shield/core";
import { ActivationButton } from "@privacy-shield/core";
import { ProtectionToggles } from "@privacy-shield/core";
import { ScalableContainer } from "@privacy-shield/core";
import { ProtectionState, BlockStats, Theme, SmartFilter, VPN_SERVERS } from "@privacy-shield/core";
import { SmartFilters } from "./components/SmartFilters";
import { CyberScanner } from "./components/CyberScanner";
import { Translator } from "./components/Translator";
import { AdBlockExceptions } from "./components/AdBlockExceptions";
import { AiSummary } from "./components/AiSummary";
import { VpnServers } from "./components/VpnServers";
import { getBlockStats } from "./utils/adBlockEngine";
import { chromeBridge } from "./utils/chromeBridge";

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
  const [selectedServerId, setSelectedServerId] = useState<string | null>(VPN_SERVERS[0].id);
  const [isVpnLoading, setIsVpnLoading] = useState(false);
  const [vpnLoadingMessage, setVpnLoadingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      const checkLoading = () => {
        chrome.storage.local.get(["vpnLoadingState"], (res) => {
          const state = res.vpnLoadingState;
          if (state && (Date.now() - state.timestamp < 120000)) {
            if (state.stage === "READY" || state.stage === "ERROR") {
              setVpnLoadingMessage(null);
            } else {
              setVpnLoadingMessage(state.message);
            }
          } else {
            setVpnLoadingMessage(null);
          }
        });
      };

      const listener = (changes: Record<string, any>) => {
        if (changes.vpnLoadingState) checkLoading();
      };
      chrome.storage.onChanged.addListener(listener);
      checkLoading();
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);
  const [blockStats, setBlockStats] = useState<BlockStats | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    // Show tutorial on first install
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.get(["has_seen_tutorial"], (result) => {
        if (!result.has_seen_tutorial) {
          setShowTutorial(true);
        }
      });
    }
  }, []);

  const closeTutorial = () => {
    setShowTutorial(false);
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.set({ has_seen_tutorial: true });
    }
  };

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.get(["filters", "selectedServerId"], (result) => {
        if (result.filters) setInternalFilters(result.filters as SmartFilter[]);
        if (result.selectedServerId) setSelectedServerId(result.selectedServerId);
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

  const handleServerSelect = async (serverId: string) => {
    setSelectedServerId(serverId);
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      chrome.storage.local.set({ selectedServerId: serverId });
    }
    if (protection.isActive && protection.vpnEnabled) {
      setIsVpnLoading(true);
      try {
        await chromeBridge.sendMessage(undefined, { action: "PROVISION_VPN", serverId });
      } finally {
        setIsVpnLoading(false);
      }
    }
  };

  const handleVpnToggle = async () => {
    const newState = !protection.vpnEnabled;
    onVpnToggle();
    if (protection.isActive && newState) {
      setIsVpnLoading(true);
      try {
        await chromeBridge.sendMessage(undefined, { 
          action: "PROVISION_VPN", 
          serverId: selectedServerId || VPN_SERVERS[0].id 
        });
      } finally {
        setIsVpnLoading(false);
      }
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const elements = containerRef.current.querySelectorAll(".popup-anim-item");
    anime({
      targets: elements,
      translateY: [15, 0],
      opacity: [0, 1],
      delay: anime.stagger(40),
      duration: 500,
      easing: "easeOutQuad"
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

  const handleProtectionToggleWithLightning = async () => {
    onProtectionToggle();
    if (!protection.isActive) {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "TRIGGER_LIGHTNING" }, () => {
              const _ = chrome.runtime.lastError;
            });
          }
        } catch (e) {
          console.warn("Failed to trigger lightning on tab:", e);
        }
      }

      // Provision VPN if turning on master protection and VPN is enabled
      if (protection.vpnEnabled) {
        setIsVpnLoading(true);
        try {
          await chromeBridge.sendMessage(undefined, {
            action: "PROVISION_VPN",
            serverId: selectedServerId || VPN_SERVERS[0].id
          });
        } finally {
          setIsVpnLoading(false);
        }
      }
    }
  };

  const currentServer = VPN_SERVERS.find(s => s.id === selectedServerId);

  const [activeTab, setActiveTab] = useState("shield");
  const tabContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tabContentRef.current) return;
    anime({
      targets: tabContentRef.current,
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 400,
      easing: "easeOutCubic"
    });
  }, [activeTab]);

  return (
    <ScalableContainer className={`w-full h-full mx-auto relative overflow-hidden ${colors.bg}`}>
      <div ref={containerRef} className={`flex flex-col h-full ${colors.bg} relative transition-colors duration-700 overflow-hidden`}>
        
        {/* Minimal Header Area - Fixed height */}
        <header className={`w-full h-12 flex-none flex items-center justify-between px-4 z-50 border-b ${colors.border} ${colors.bgSecondary} popup-anim-item shadow-sm`}>
          <div className="flex items-center gap-2">
            <Shield className={`w-4.5 h-4.5 ${protection.isActive ? colors.success : colors.textSecondary}`} />
            <span className={`text-sm font-bold tracking-[0.15em] font-headline uppercase ${protection.isActive ? colors.success : colors.textSecondary}`}>PRIVACY SENTINEL</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowTutorial(true)}
              className={`p-1.5 rounded-lg transition-colors hover:bg-zinc-500/10 ${colors.textSecondary} pointer-events-auto`}
              title="Show Tutorial"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <Select value={theme} onValueChange={(val) => setTheme(val as Theme)}>
              <SelectTrigger className={`w-20 h-7 text-[8px] font-black uppercase tracking-widest ${colors.bgSecondary} border-none shadow-none pointer-events-auto`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`${theme === 'dark' || theme === 'vaporwave' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900'} border-zinc-800/50 z-[9999] pointer-events-auto opacity-100`}>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="vaporwave">Vapor</SelectItem>
                <SelectItem value="frutiger-aero">Aero</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <Tabs defaultValue="shield" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          
          <div ref={tabContentRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pt-2 pb-4">
            
            <TabsContent value="shield" className="mt-0 flex flex-col items-center justify-between h-full py-0 gap-0 overflow-hidden">
              {/* Central Power Button Section */}
              <div className="flex flex-col items-center gap-0 popup-anim-item">
                <div className="hover:scale-105 active:scale-95 transition-transform duration-200 mt-0.5">
                  <ActivationButton protection={protection} onToggle={handleProtectionToggleWithLightning} size="md" />
                </div>
                <div className="flex flex-col items-center min-h-[20px] justify-center mt-0">
                  {vpnLoadingMessage ? (
                    <span className="text-[8px] text-amber-400 font-black animate-pulse uppercase tracking-widest text-center px-4">
                      {vpnLoadingMessage}
                    </span>
                  ) : isVpnLoading ? (
                    <span className="text-[8px] text-amber-400 font-black animate-pulse uppercase tracking-widest">
                      Initializing Connection...
                    </span>
                  ) : protection.isActive && (
                    <>
                      <span className={`font-headline font-bold tracking-widest text-[9px] ${theme === 'dark' ? 'text-[#81ecff]' : colors.success} leading-none`}>
                        {protection.vpnEnabled ? 'VPN ACTIVE' : 'PROTECTED'}
                      </span>
                      <span className={`text-[8px] ${colors.textSecondary} uppercase tracking-tighter font-black opacity-60 leading-none mt-0.5`}>
                        {currentServer?.name || 'Active'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Toggles Section */}
              <div className="w-full space-y-0.5 popup-anim-item">
                <ProtectionToggles 
                   items={[
                     { id: "vpn", icon: Globe, label: "VPN", enabled: protection.vpnEnabled, onToggle: handleVpnToggle },
                     { id: "adblock", icon: Shield, label: "Adblock", enabled: protection.adblockEnabled, onToggle: onAdblockToggle },
                     { id: "filtering", icon: Filter, label: "Filter", enabled: protection.filteringEnabled, onToggle: onFilteringToggle },
                   ]}
                   layout="list" 
                 />
              </div>

              {/* Stats Row */}
              <div className={`w-full flex justify-between px-2 border-t ${colors.border} pt-1.5 popup-anim-item mb-0`}>
                <div className="flex flex-col">
                  <span className={`text-[8px] uppercase font-black ${colors.textSecondary} tracking-widest opacity-60`}>Data Saved</span>
                  <span className={`font-headline ${colors.text} font-bold text-[11px] tracking-tight`}>
                    {blockStats ? (blockStats.bandwidthSaved / (1024 * 1024)).toFixed(1) : "0.0"} MB
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-[8px] uppercase font-black ${colors.textSecondary} tracking-widest opacity-60`}>Blocked</span>
                  <span className={`font-headline ${colors.text} font-bold text-[11px] tracking-tight`}>
                    {blockStats ? blockStats.totalBlocked.toLocaleString() : "0"}
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vpn" className="mt-0 h-full animate-in fade-in slide-in-from-bottom-2">
              <VpnServers servers={VPN_SERVERS} selectedServerId={selectedServerId} onServerSelect={handleServerSelect} isLoading={isVpnLoading} />
            </TabsContent>

            <TabsContent value="scanner" className="mt-0 h-full animate-in fade-in slide-in-from-bottom-2">
              <CyberScanner />
            </TabsContent>

            <TabsContent value="filters" className="mt-0 h-full space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <SmartFilters filters={filters} onFiltersChange={setFilters} isActive={protection.isActive} />
              <div className={`pt-3 border-t ${colors.border}`}>
                <AdBlockExceptions />
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-0 h-full space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <AiSummary />
              <div className={`pt-3 border-t ${colors.border}`}>
                <Translator />
              </div>
            </TabsContent>
          </div>

          {/* Minimalist Bottom Tab Navigation */}
          <footer className={`flex-none w-full z-50 ${colors.bgSecondary} border-t ${colors.border} shadow-2xl h-14`}>
            <TabsList className="flex justify-around items-center w-full h-full bg-transparent px-2">
              <TabsTrigger value="shield" className={`p-2 rounded-xl transition-all duration-200 data-[state=active]:bg-zinc-500/5 data-[state=active]:${colors.success} text-zinc-500 border-none shadow-none pointer-events-auto hover:bg-zinc-500/10`}>
                <LayoutDashboard className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger value="vpn" className={`p-2 rounded-xl transition-all duration-200 data-[state=active]:bg-zinc-500/5 data-[state=active]:${colors.success} text-zinc-500 border-none shadow-none pointer-events-auto hover:bg-zinc-500/10`}>
                <Globe className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger value="scanner" className={`p-2 rounded-xl transition-all duration-200 data-[state=active]:bg-zinc-500/5 data-[state=active]:${colors.success} text-zinc-500 border-none shadow-none pointer-events-auto hover:bg-zinc-500/10`}>
                <Radar className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger value="filters" className={`p-2 rounded-xl transition-all duration-200 data-[state=active]:bg-zinc-500/5 data-[state=active]:${colors.success} text-zinc-500 border-none shadow-none pointer-events-auto hover:bg-zinc-500/10`}>
                <Filter className="w-5 h-5" />
              </TabsTrigger>
              <TabsTrigger value="ai" className={`p-2 rounded-xl transition-all duration-200 data-[state=active]:bg-zinc-500/5 data-[state=active]:${colors.success} text-zinc-500 border-none shadow-none pointer-events-auto hover:bg-zinc-500/10`}>
                <Brain className="w-5 h-5" />
              </TabsTrigger>
            </TabsList>
          </footer>
        </Tabs>

        {/* Multi-Step Tutorial Overlay */}
        {showTutorial && (() => {
          const steps = [
            { icon: <Zap className="w-5 h-5 text-emerald-400" />, title: "WELCOME", desc: "Privacy Sentinel protects your browsing with military-grade encryption, ad blocking, and AI-powered security scanning." },
            { icon: <Shield className="w-5 h-5 text-emerald-400" />, title: "SHIELD DASHBOARD", desc: "The Shield tab is your control centre. The power button activates all protection at once. Use the individual toggles for VPN, Ad Blocking, and Content Filtering." },
            { icon: <Globe className="w-5 h-5 text-emerald-400" />, title: "VPN & SERVERS", desc: "The VPN tab lets you choose from 5 global server locations. Your browser traffic is encrypted and routed through the selected region via a secure tunnel." },
            { icon: <Radar className="w-5 h-5 text-emerald-400" />, title: "SCANNER & FILTERS", desc: "The Scanner analyses every link on a page for phishing, malware, and trackers. Smart Filters let you block specific words or content across all websites." },
            { icon: <Brain className="w-5 h-5 text-emerald-400" />, title: "AI TOOLS", desc: "Summarise any webpage instantly or translate it into 11 languages. The AI tab is powered by Groq for fast, private processing." },
          ];
          const s = steps[tutorialStep];
          return (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 p-5 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
              <div className="w-full bg-[#0f172a] border border-emerald-500/20 p-5 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
                <div className="bg-emerald-500/10 p-3 rounded-2xl">{s.icon}</div>
                <h2 className="text-lg font-black text-white tracking-wider">{s.title}</h2>
                <p className="text-zinc-400 text-[11px] leading-relaxed text-center px-2">{s.desc}</p>

                <div className="flex gap-1.5 mt-1">
                  {steps.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === tutorialStep ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                  ))}
                </div>

                <div className="flex w-full gap-2 mt-1">
                  {tutorialStep > 0 && (
                    <button onClick={() => setTutorialStep(p => p - 1)} className="px-4 py-2.5 border border-zinc-700 rounded-xl text-zinc-400 text-[10px] font-black tracking-wider pointer-events-auto">BACK</button>
                  )}
                  <div className="flex-1" />
                  {tutorialStep < steps.length - 1 ? (
                    <button onClick={() => setTutorialStep(p => p + 1)} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black tracking-wider text-[10px] transition-all active:scale-95 pointer-events-auto">NEXT</button>
                  ) : (
                    <button onClick={() => { closeTutorial(); setTutorialStep(0); }} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black tracking-wider text-[10px] transition-all active:scale-95 pointer-events-auto shadow-lg shadow-emerald-500/20">INITIALIZE</button>
                  )}
                </div>
                <button onClick={() => { setShowTutorial(false); setTutorialStep(0); }} className="text-[9px] text-zinc-500 font-black tracking-widest pointer-events-auto hover:text-zinc-300">SKIP</button>
              </div>
            </div>
          );
        })()}
      </div>
    </ScalableContainer>
  );
}
