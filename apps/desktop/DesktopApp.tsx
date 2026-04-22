import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@privacy-shield/core";
import type { ProtectionState, TrackerStats, Theme, ServerLocation } from "@privacy-shield/core";
import { WorldMap } from "./components/WorldMap";
import Tutorial from "./components/Tutorial";
import anime from "animejs";
import { Map, Shield, Palette, RefreshCw, HelpCircle } from "lucide-react";

interface DesktopAppProps {
  protection: ProtectionState;
  onProtectionToggle: () => void;
  onVpnToggle: () => void;
  onAdblockToggle: () => void;
  onTest: () => Promise<{ isBlocked: boolean; output: string; summary?: string } | null>;
  onReset: () => Promise<void>;
  stats: TrackerStats;
  loading?: boolean;
  statusMessage?: string | null;
  dnsInfo?: Record<string, string[]>;
  initialDns?: Record<string, string[]>;
  setTheme?: (theme: any) => void;
  servers: ServerLocation[];
  selectedServer: ServerLocation | null;
  onServerSelect: (server: ServerLocation) => void;
  isAdmin?: boolean;
}

export function DesktopApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onReset,
  stats,
  loading = false,
  statusMessage,
  setTheme,
  servers,
  selectedServer,
  onServerSelect,
}: Readonly<DesktopAppProps>) {
  const { theme, colors } = useTheme();
  const isDark = theme === "dark" || theme === "vaporwave";
  const [isMapMode, setIsMapMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const [showTutorial, setShowTutorial] = useState(false);
  const [shouldFlashTutorial, setShouldFlashTutorial] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('ps_tutorial_seen')) {
      setShouldFlashTutorial(true);
      const timer = setTimeout(() => setShouldFlashTutorial(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const powerBtnRef = useRef<HTMLButtonElement>(null);
  const powerBtnContainerRef = useRef<HTMLDivElement>(null);
  const mainUiRef = useRef<HTMLDivElement>(null);

  const triggerLightningBurst = (container: HTMLElement) => {
    const isVaporwave = theme === 'vaporwave';
    const primary = isVaporwave ? '#ff71ce' : isDark ? '#81ecff' : '#3b82f6';
    const secondary = isVaporwave ? '#b967ff' : isDark ? '#a5f3fc' : '#60a5fa';
    const rayCount = 14;

    const btn = container.querySelector('button') as HTMLElement || container;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const btnR = rect.width / 2;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;overflow:visible;`;
    document.body.appendChild(wrapper);

    for (let i = 0; i < rayCount; i++) {
      const angle = (360 / rayCount) * i + Math.random() * 10 - 5;
      const rad = (angle * Math.PI) / 180;
      const color = i % 2 === 0 ? primary : secondary;
      const len = 70 + Math.random() * 60;
      const startR = btnR + 2;
      const endR = btnR + len;

      const sx = cx + Math.sin(rad) * startR;
      const sy = cy - Math.cos(rad) * startR;
      const ex = cx + Math.sin(rad) * endR;
      const ey = cy - Math.cos(rad) * endR;
      const midX = (sx + ex) / 2 + (Math.random() - 0.5) * 20;
      const midY = (sy + ey) / 2 + (Math.random() - 0.5) * 20;

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      const pad = 30;
      const minX = Math.min(sx, ex, midX) - pad;
      const minY = Math.min(sy, ey, midY) - pad;
      const maxX = Math.max(sx, ex, midX) + pad;
      const maxY = Math.max(sy, ey, midY) + pad;
      svg.style.cssText = `position:fixed;top:${minY}px;left:${minX}px;width:${maxX-minX}px;height:${maxY-minY}px;pointer-events:none;overflow:visible;`;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", `M${sx-minX},${sy-minY} L${midX-minX},${midY-minY} L${ex-minX},${ey-minY}`);
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", `${2.5 + Math.random() * 1.5}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.style.cssText = `filter:drop-shadow(0 0 5px ${color}) drop-shadow(0 0 10px ${color});opacity:0;`;
      svg.appendChild(path);
      wrapper.appendChild(svg);

      const orb = document.createElement('div');
      const orbSize = 7 + Math.random() * 6;
      orb.style.cssText = `position:fixed;width:${orbSize}px;height:${orbSize}px;border-radius:50%;background:${color};left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);opacity:0;box-shadow:0 0 ${orbSize*2}px ${color},0 0 ${orbSize*4}px ${color};`;
      wrapper.appendChild(orb);

      const delay = Math.random() * 100;
      anime({ targets: path, opacity: [0, 1, 0], strokeWidth: ['3', '0.5'], duration: 550 + Math.random() * 200, easing: 'easeOutExpo', delay });
      anime({
        targets: orb,
        opacity: [0, 1, 0],
        translateX: ['-50%', `calc(-50% + ${(ex - sx) * 0.8}px)`],
        translateY: ['-50%', `calc(-50% + ${(ey - sy) * 0.8}px)`],
        scale: [0.5, 1.3, 0],
        duration: 650 + Math.random() * 200,
        easing: 'easeOutCubic',
        delay,
        complete: i === rayCount - 1 ? () => wrapper.remove() : undefined,
      });
    }

    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;width:${btnR*2.5}px;height:${btnR*2.5}px;border-radius:50%;background:radial-gradient(circle,${primary}88,transparent);left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);opacity:0;pointer-events:none;`;
    wrapper.appendChild(flash);
    anime({ targets: flash, opacity: [0, 1, 0], scale: [0.8, 1.6, 2.8], duration: 450, easing: 'easeOutExpo' });
  };

  const handleProtectionToggleWithLightning = () => {
    if (!protection.isActive && powerBtnContainerRef.current) {
      triggerLightningBurst(powerBtnContainerRef.current);
    }
    onProtectionToggle();
  };

  const handleInteraction = (el: HTMLElement | null, type: 'enter' | 'leave' | 'down' | 'up') => {
    if (!el) return;
    const configs = {
      enter: { scale: 1.05, duration: 400, easing: "easeOutElastic(1, .8)" },
      leave: { scale: 1, duration: 400, easing: "easeOutQuint" },
      down: { scale: 0.92, duration: 100, easing: "easeOutQuint" },
      up: { scale: 1.05, duration: 400, easing: "easeOutElastic(1, .8)" }
    };
    anime({ targets: el, ...configs[type] });
  };

  useEffect(() => {
    anime({
      targets: ".anim-entry",
      translateY: [20, 0],
      opacity: [0, 1],
      delay: anime.stagger(100),
      duration: 1000,
      easing: "easeOutQuint"
    });
  }, []);

  useEffect(() => {
    if (!mainUiRef.current) return;
    
    if (isMapMode) {
      anime({
        targets: mainUiRef.current,
        opacity: 0,
        scale: 0.9,
        duration: 600,
        easing: "easeOutQuint",
        complete: () => {
          if (mainUiRef.current) mainUiRef.current.style.visibility = "hidden";
        }
      });
    } else {
      if (mainUiRef.current) mainUiRef.current.style.visibility = "visible";
      anime({
        targets: mainUiRef.current,
        opacity: 1,
        scale: 1,
        duration: 800,
        easing: "easeOutElastic(1, .8)"
      });
    }
  }, [isMapMode]);

  const handleServerClick = (server: ServerLocation) => {
    onServerSelect(server);
    setIsMapMode(false);
  };

  const [pings, setPings] = useState<Record<string, number>>({});

  useEffect(() => {
    const pingRegions = async () => {
      const newPings: Record<string, number> = {};
      const SERVER_REGION_MAP: Record<string, string> = {
        us: "us-east-1", uk: "eu-west-2", de: "eu-central-1", jp: "ap-northeast-1", au: "ap-southeast-2"
      };

      await Promise.all(servers.map(async (s) => {
        const start = Date.now();
        try {
          const region = SERVER_REGION_MAP[s.id];
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 2000);
          await fetch(`https://dynamodb.${region}.amazonaws.com`, { method: "HEAD", mode: "no-cors", signal: ctrl.signal });
          clearTimeout(tid);
          newPings[s.id] = Date.now() - start;
        } catch {
          newPings[s.id] = 999;
        }
      }));
      setPings(newPings);
    };

    pingRegions();
    const interval = setInterval(pingRegions, 10000);
    return () => clearInterval(interval);
  }, [servers]);

  return (
    <div className={`fixed inset-0 ${colors.bg} ${colors.text} font-body transition-all duration-1000 overflow-hidden`}>
      
      {/* Background Map Layer */}
      <div className="absolute inset-0 z-0 map-mesh opacity-20 pointer-events-none"></div>
      <div className={`absolute inset-0 z-10 flex items-center justify-center overflow-hidden transition-all duration-1000 ${isMapMode ? 'scale-110 opacity-100' : 'scale-100 opacity-40'}`}>
        {isMounted && (
          <WorldMap
            servers={servers.map(s => ({ ...s, ping: pings[s.id] || 0 }))}
            selectedServer={selectedServer}
            onServerSelect={handleServerClick}
            isMapMode={isMapMode}
          />
        )}
      </div>

      {/* Main UI Layer */}
      <div ref={mainUiRef} className="relative z-20 w-full h-full flex flex-col items-center justify-center">
        
        {/* Top Navigation */}
        <nav className="fixed top-0 w-full flex justify-between items-center px-12 py-8 bg-transparent anim-entry">
          <div className="flex items-center gap-3">
            <span className={`font-headline font-extrabold text-xl tracking-tighter ${colors.text}`}>PRIVACY SENTINEL</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTutorial(true)}
              className={`p-2.5 rounded-xl transition-all border ${colors.border} ${colors.bgSecondary} hover:scale-105 active:scale-95 ${shouldFlashTutorial ? 'animate-pulse' : ''}`}
              title="Help"
            >
              <HelpCircle className={`w-4 h-4 ${shouldFlashTutorial ? colors.accent.replace('bg-', 'text-') : colors.textSecondary}`} />
            </button>
            <button
              onClick={() => {
                const themes: Theme[] = ['dark', 'light', 'vaporwave', 'frutiger-aero'];
                const next = themes[(themes.indexOf(theme as Theme) + 1) % themes.length];
                setTheme?.(next);
              }}
              className={`p-2.5 rounded-xl transition-all border ${colors.border} ${colors.bgSecondary} hover:scale-105 active:scale-95`}
              title={`Theme: ${theme}`}
            >
              <Palette className={`w-4 h-4 ${colors.textSecondary}`} />
            </button>
          </div>
        </nav>

        {/* Central Controller Hub */}
        <div className="flex flex-col items-center max-w-4xl w-full px-6">
          <div ref={powerBtnContainerRef} className="relative w-96 h-96 flex items-center justify-center anim-entry">
            {protection.isActive && !loading && (
               <div className={`absolute inset-0 shield-orbit-ring scale-100 opacity-20 ${isDark ? 'border-cyan-400' : 'border-blue-500'}`}></div>
            )}
            { (protection.isActive && loading) && (
              <>
                <div className={`absolute inset-0 shield-orbit-ring scale-100 opacity-20 animate-radar-sweep ${isDark ? 'border-cyan-400' : 'border-blue-500'}`}></div>
                <div className={`absolute inset-12 shield-orbit-ring scale-100 opacity-30 animate-radar-sweep [animation-direction:reverse] ${isDark ? 'border-cyan-400' : 'border-blue-500'}`}></div>
                <div className={`absolute inset-24 shield-orbit-ring scale-100 opacity-50 animate-radar-sweep [animation-duration:3s] ${isDark ? 'border-cyan-400' : 'border-blue-500'}`}></div>
              </>
            )}
            
            <button 
              ref={powerBtnRef}
              onClick={handleProtectionToggleWithLightning}
              onMouseEnter={() => handleInteraction(powerBtnRef.current, 'enter')}
              onMouseLeave={() => handleInteraction(powerBtnRef.current, 'leave')}
              onMouseDown={() => handleInteraction(powerBtnRef.current, 'down')}
              onMouseUp={() => handleInteraction(powerBtnRef.current, 'up')}
              disabled={loading}
              className={`
                relative group w-48 h-48 rounded-full p-[2px] transition-all shadow-xl
                ${protection.isActive 
                  ? (isDark ? 'bg-linear-to-br from-cyan-400 to-blue-500 shadow-[0_0_60px_rgba(0,229,255,0.4)]' : 'bg-linear-to-br from-blue-500 to-emerald-500 shadow-[0_0_40px_rgba(37,99,235,0.3)]')
                  : 'bg-linear-to-br from-slate-700 to-slate-800 opacity-80'}
              `}
            >
              <div className={`
                w-full h-full rounded-full flex flex-col items-center justify-center gap-2 transition-colors
                ${protection.isActive ? "bg-transparent" : `${colors.bgSecondary} group-hover:bg-transparent`}
              `}>
                {loading ? (
                  <RefreshCw className={`w-12 h-12 animate-spin ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} />
                ) : (
                  <Shield className={`w-12 h-12 transition-colors ${protection.isActive ? (theme === 'frutiger-aero' || theme === 'light' ? 'text-white' : 'text-[#00363d]') : (isDark ? "text-cyan-400" : "text-blue-600") + " group-hover:text-white"}`} />
                )}
                <span className={`font-headline font-bold text-xs tracking-[0.2em] transition-colors ${protection.isActive ? (theme === 'frutiger-aero' || theme === 'light' ? 'text-white' : 'text-[#00363d]') : (isDark ? "text-cyan-400" : "text-blue-600") + " group-hover:text-white"}`}>
                  {protection.isActive ? "SECURE" : "SHIELD"}
                </span>
              </div>
            </button>
            {(loading || statusMessage) && (
              <div className="absolute bottom-0 translate-y-full pt-4 flex items-center gap-2 justify-center w-full">
                {loading && <RefreshCw className={`w-3 h-3 animate-spin flex-shrink-0 ${isDark ? 'text-cyan-400' : 'text-blue-600'}`} />}
                <span className={`font-label text-[11px] tracking-[0.15em] uppercase animate-pulse text-center ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                  {statusMessage || (loading ? 'Connecting...' : '')}
                </span>
              </div>
            )}
          </div>

          {/* Analytics & Controls Section */}
          <div className="mt-12 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start anim-entry">
            <div className="flex flex-col gap-6">
              <div className={`font-label text-[10px] tracking-widest uppercase font-bold ${colors.textSecondary} pl-2`}>Security Analytics</div>
              <div className="grid grid-cols-1 gap-4">
                <div className={`${colors.bgSecondary} backdrop-blur-md p-6 rounded-xl border ${colors.border} shadow-inner flex justify-between items-center hover:scale-[1.02] hover:shadow-lg transition-all duration-300 cursor-default`}>
                  <div className={`font-label text-[10px] tracking-wider ${colors.textSecondary} uppercase`}>Latency</div>
                  <div className={`font-headline text-3xl font-extrabold ${colors.success} mb-1`}>{selectedServer ? (pings[selectedServer.id] || 0) : 0} ms</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className={`font-label text-[10px] tracking-widest uppercase font-bold ${colors.textSecondary} pl-2`}>Vault Controls</div>
              <div className="flex flex-col gap-3">
                <div className={`${colors.bgSecondary} backdrop-blur-md px-6 py-4 rounded-xl border ${colors.border} shadow-inner hover:scale-[1.02] hover:shadow-lg transition-all duration-300`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Map className={`w-5 h-5 ${colors.success}`} />
                      <span className={`font-medium text-sm ${colors.text}`}>VPN Encryption</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setIsMapMode(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-600'} border text-[10px] font-black hover:bg-opacity-20 transition-all uppercase tracking-widest`}
                      >
                        <Map className="w-3 h-3" />
                        Location
                      </button>
                      <button 
                        onClick={onVpnToggle}
                        className={`w-12 h-6 rounded-full relative transition-colors ${protection.vpnEnabled ? (isDark ? 'bg-cyan-400' : 'bg-blue-600') : 'bg-slate-700/50'} active:scale-90 duration-100`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${protection.vpnEnabled ? 'right-1 bg-white shadow-sm' : 'left-1 bg-slate-400'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`${colors.bgSecondary} backdrop-blur-md px-6 py-4 rounded-xl flex items-center justify-between border ${colors.border} shadow-inner hover:scale-[1.02] hover:shadow-lg transition-all duration-300`}>
                  <div className="flex items-center gap-4">
                    <Shield className={`w-5 h-5 ${colors.success}`} />
                    <span className={`font-medium text-sm ${colors.text}`}>Adblock Protocol</span>
                  </div>
                  <button
                    onClick={onAdblockToggle}
                    className={`w-12 h-6 rounded-full relative transition-colors ${protection.adblockEnabled ? (isDark ? 'bg-cyan-400' : 'bg-blue-600') : 'bg-slate-700/50'} active:scale-90 duration-100 cursor-pointer`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${protection.adblockEnabled ? 'right-1 bg-white shadow-sm' : 'left-1 bg-slate-400'}`}></div>
                  </button>
                </div>              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className={`fixed bottom-0 w-full flex justify-between items-center px-12 py-8 z-30 bg-transparent transition-opacity duration-500 ${isMapMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button onClick={onReset} className={`font-body text-[10px] tracking-widest uppercase font-medium ${isDark ? 'text-red-400/60 hover:text-red-400' : 'text-red-600/60 hover:text-red-600'} transition-colors duration-300 flex items-center gap-2 anim-entry`}>
          <RefreshCw className="w-3 h-3" />
          System Reset
        </button>
        <div className="flex items-center gap-4 anim-entry">
          <div className="flex gap-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${protection.isActive ? (isDark ? "bg-cyan-400 shadow-[0_0_8px_#00daf3]" : "bg-blue-600 shadow-[0_0_8px_#2563eb]") : "bg-red-500 shadow-[0_0_8px_#ef4444]"}`}></div>
            <div className={`w-1.5 h-1.5 rounded-full opacity-50 ${protection.isActive ? (isDark ? "bg-cyan-400" : "bg-blue-600") : "bg-red-500"}`}></div>
            <div className={`w-1.5 h-1.5 rounded-full opacity-20 ${protection.isActive ? (isDark ? "bg-cyan-400" : "bg-blue-600") : "bg-red-500"}`}></div>
          </div>
        </div>
      </footer>

      {isMapMode && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none">
          <div className={`bg-black/80 backdrop-blur-2xl px-16 py-8 rounded-[3rem] border border-white/20 flex flex-col items-center shadow-[0_0_50px_rgba(0,0,0,0.5)] anim-entry`}>
            <span className="font-headline font-black text-4xl text-cyan-400 tracking-tighter drop-shadow-2xl animate-pulse text-center">SELECT TERMINAL</span>
            <p className="font-label text-[10px] text-white/60 uppercase tracking-[0.4em] mt-4 mb-8">Click a glowing node to re-route your connection</p>
            <button 
              onClick={() => setIsMapMode(false)}
              className="px-12 py-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-black uppercase tracking-widest text-white transition-all pointer-events-auto"
            >
              Cancel Selection
            </button>
          </div>
        </div>
      )}

      <div className={`fixed top-32 left-12 flex flex-col gap-1 pointer-events-none z-30 transition-opacity duration-500 ${isMapMode ? 'opacity-0' : 'opacity-100'}`}>
        <span className={`font-label text-[10px] tracking-[0.3em] ${colors.success}/50 uppercase`}>Current Node</span>
        <span className={`font-headline font-extrabold text-2xl uppercase ${protection.isActive ? colors.text : "text-red-500"}`}>
          {protection.isActive ? (selectedServer?.name || "CONNECTED") : "UNPROTECTED"}
        </span>
        <div className={`w-24 h-0.5 mt-2 ${protection.isActive ? `bg-gradient-to-r ${isDark ? 'from-cyan-400' : 'from-blue-600'} to-transparent` : "bg-gradient-to-r from-red-500 to-transparent"}`}></div>
      </div>

      {showTutorial && (
        <Tutorial onClose={() => {
          setShowTutorial(false);
          if (typeof window !== 'undefined') localStorage.setItem('ps_tutorial_seen', 'true');
        }} />
      )}
    </div>
  );
}
