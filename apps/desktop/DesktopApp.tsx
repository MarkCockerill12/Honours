"use client"

import React, { useState } from "react"
import { Shield, Globe, Terminal, CheckCircle2, AlertCircle } from "lucide-react"
import { useTheme } from "@/packages/ui/ThemeProvider"
import { ActivationButton } from "@/packages/ui/ActivationButton"
import { ScalableContainer } from "@/packages/ui/ScalableContainer"
import { TrackerCard } from "@/packages/ui/TrackerCard"
import type { ProtectionState, TrackerStats } from "@/packages/ui/types"
import { SystemToggles } from "./components/SystemToggles"

interface DesktopAppProps {
  protection: ProtectionState
  onProtectionToggle: () => void
  onVpnToggle: () => void
  onAdblockToggle: () => void
  onTest: () => Promise<{ isBlocked: boolean; output: string } | null>
  onReset: () => Promise<void>
  stats: TrackerStats
  loading?: boolean
  dnsInfo?: Record<string, string[]>
}

export function DesktopApp({
  protection,
  onProtectionToggle,
  onVpnToggle,
  onAdblockToggle,
  onTest,
  onReset,
  stats,
  loading = false,
  dnsInfo = {},
}: Readonly<DesktopAppProps>) {
  const { colors } = useTheme()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ isBlocked: boolean; output: string } | null>(null)

  // Find the primary DNS (usually first non-empty adapter)
  const adapterNames = Object.keys(dnsInfo);
  const primaryAdapter = adapterNames.find(name => dnsInfo[name].length > 0) || adapterNames[0];
  const activeDns = dnsInfo[primaryAdapter] || [];

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await onTest()
      setTestResult(result)
    } catch (err) {
      console.error('Test failed', err)
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  return (
    <ScalableContainer className="w-full h-screen mx-auto overflow-hidden text-zinc-100">
      <div className={`${colors.bg} h-full flex flex-col relative`}>
        {/* Ambient Background Glow */}
        <div className={`absolute -top-40 -right-40 w-96 h-96 rounded-full mix-blend-screen filter blur-[100px] opacity-20 transition-all duration-1000 ${protection.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <div className={`absolute -bottom-40 -left-40 w-96 h-96 rounded-full mix-blend-screen filter blur-[100px] opacity-20 transition-all duration-1000 ${protection.isActive ? 'bg-blue-500' : 'bg-orange-500'}`} />

        {/* Compact Header */}
        <div className={`glass-card border-b border-zinc-800/50 px-6 py-4 flex items-center justify-between z-10 relative`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border transition-all duration-500 ${protection.isActive ? 'bg-emerald-500/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-red-500/10 border-red-500/20'}`}>
                <Shield className={`w-5 h-5 transition-colors duration-500 ${protection.isActive ? 'text-emerald-400' : 'text-red-400'}`} />
            </div>
            <div className="flex flex-col">
                <h1 className={`text-sm font-black tracking-tight ${colors.text} leading-tight`}>AD-BLOCK SHIELD</h1>
                <p className={`text-[9px] font-bold ${colors.textSecondary} opacity-40 uppercase`}>Honours Project Edition</p>
            </div>
          </div>
          <div className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${colors.border} ${colors.textSecondary} opacity-60`}>
            BUILD v1.0.42 [STABLE]
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden items-center">
          {/* Dashboard Body */}
          <div className="w-full max-w-5xl p-6 lg:p-10 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Stats & Testing */}
              <div className="md:col-span-5 space-y-6 flex flex-col z-10">
                <div className={`flex-1 rounded-[2rem] glass-card p-8 flex flex-col justify-between hover-lift transition-all duration-500 ${protection.isActive ? 'border-emerald-500/20 shadow-[0_8px_32px_rgba(16,185,129,0.05)]' : 'border-zinc-800'}`}>
                    <div>
                        <h3 className={`text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2`}>
                          <span className={`w-2 h-2 rounded-full ${protection.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                          System Integrity
                        </h3>
                        <div className="space-y-5">
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50">
                                <span className={`text-sm tracking-wide text-zinc-300 font-medium`}>DNS Protocol</span>
                                <span className={`text-xs font-mono px-3 py-1 rounded-full font-bold tracking-wider ${protection.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {protection.isActive ? 'ADGUARD-DNS' : 'UNPROTECTED'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50">
                                <span className={`text-sm tracking-wide text-zinc-300 font-medium`}>Local Resolver</span>
                                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1 border border-blue-500/30 rounded-full font-bold tracking-wider">SYSTEM-LEVEL</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleTest}
                        disabled={testing || !protection.isActive}
                        className={`mt-10 w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-black tracking-widest transition-all shadow-lg
                            ${testing ? 'opacity-50' : 'hover-lift hover:scale-[1.02] active:scale-[0.98]'}
                            ${testResult 
                                ? (testResult.isBlocked ? 'bg-emerald-500 text-emerald-950 shadow-emerald-500/25' : 'bg-red-500 text-white shadow-red-500/25')
                                : (protection.isActive ? 'bg-zinc-100 hover:bg-white text-zinc-900 shadow-white/10' : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50')}`}
                    >
                        {testing ? (
                            <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin" />
                        ) : testResult ? (
                            testResult.isBlocked ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />
                        ) : <Terminal className="w-5 h-5" />}
                        
                        {testing ? 'VALIDATING...' : testResult ? (testResult.isBlocked ? 'BLOCKER ACTIVE' : 'PROTECTION FAILED!') : 'TEST SHIELD'}
                    </button>
                    
                    <button
                        onClick={onReset}
                        className={`mt-4 w-full py-3 rounded-xl text-xs font-bold tracking-[0.2em] uppercase opacity-40 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all text-zinc-500`}
                    >
                        Emergency Reset
                    </button>
                </div>

                <div className="z-10 bg-black/20 rounded-[2rem] p-1 border border-zinc-800/50">
                  <TrackerCard stats={stats} />
                </div>
              </div>

              {/* Right Column: Main Controls */}
              <div className="md:col-span-7 z-10">
                <div className={`h-full rounded-[2.5rem] glass-card p-8 lg:p-12 relative overflow-hidden flex flex-col items-center justify-center transition-all duration-700 hover-lift ${protection.isActive ? 'border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 'border-red-500/20'}`}>
                   <div className={`absolute inset-0 transition-opacity duration-1000 ${protection.isActive ? 'opacity-10 animate-pulse-glow' : 'opacity-0'} pointer-events-none bg-emerald-500 blur-[100px]`} />

                   <div className="relative z-10 flex flex-col items-center text-center w-full">
                        <div className="mb-12">
                            <h2 className={`text-5xl lg:text-6xl font-black ${colors.text} mb-4 tracking-tighter ${protection.isActive ? 'drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''} transition-all duration-500`}>
                                {protection.isActive ? "SECURED" : "PAUSED"}
                            </h2>
                            <p className={`text-base font-medium ${colors.textSecondary} max-w-sm mx-auto leading-relaxed tracking-wide`}>
                                {protection.isActive 
                                    ? "Network traffic is encrypted and filtered. Tracking domains are blocked system-wide." 
                                    : "Ad-blocking suspended. Your privacy is currently exposed to networks."}
                            </p>
                        </div>

                      <div className={`transition-all duration-700 py-6 relative ${protection.isActive ? 'animate-shield-pulse scale-110' : 'scale-100 grayscale-[0.2]'}`}>
                        {protection.isActive && (
                            <div className="absolute inset-0 -m-8 rounded-full border border-emerald-500/20 animate-glow-ring pointer-events-none mix-blend-screen" />
                        )}
                        <ActivationButton
                          protection={protection}
                          onToggle={onProtectionToggle}
                          size="xl"
                          loading={loading}
                        />
                      </div>

                      <div className="mt-10 w-full max-w-xs">
                        <SystemToggles 
                            systemAdblock={protection.adblockEnabled}
                            onSystemAdblockToggle={onAdblockToggle}
                            vpn={protection.vpnEnabled}
                            onVpnToggle={onVpnToggle}
                        />
                      </div>
                   </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Dynamic Footer */}
        <div className={`glass-card border-t border-zinc-800/50 px-8 py-4 flex items-center justify-between text-xs font-bold tracking-widest z-10 relative`}>
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full relative`}>
                    <div className={`absolute inset-0 rounded-full transition-all duration-300 ${protection.isActive ? 'bg-emerald-400 animate-ping opacity-30' : 'hidden'}`} />
                    <div className={`absolute inset-0 rounded-full transition-all duration-500 ${protection.isActive ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                </div>
                <span className={`tracking-[0.2em] ${protection.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {protection.isActive ? 'ENCRYPTED & FILTERED' : 'SYSTEM EXPOSED'}
                </span>
            </div>
            
            <div className="hidden sm:flex items-center gap-3 opacity-60">
                <span className="opacity-70 uppercase tracking-widest">Adapter:</span>
                <span className="text-zinc-200">{primaryAdapter || "SCANNING..."}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
             <div className="flex items-center gap-4">
                <span className="opacity-50 uppercase tracking-widest text-[10px]">Active Node:</span>
                <span className={`bg-black/30 px-3 py-1 rounded font-mono text-[11px] border ${protection.isActive ? 'border-blue-500/30 text-blue-400 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]' : 'border-zinc-800 text-zinc-500'}`}>
                    {activeDns[0] || '127.0.0.1'}
                </span>
            </div>
            <Globe className={`w-5 h-5 transition-all duration-1000 ${protection.isActive ? 'text-blue-400 opacity-80 animate-pulse' : 'text-zinc-600 opacity-40'}`} />
          </div>
        </div>
      </div>
    </ScalableContainer>
  )
}
