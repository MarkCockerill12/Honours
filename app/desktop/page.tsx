"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { DesktopApp } from "@/apps/desktop/DesktopApp";
import { ThemeProvider } from "@/packages/ui/ThemeProvider";
import type { Theme, ProtectionState, TrackerStats } from "@/packages/ui/types";

// Declare electron global
declare global {
  interface Window {
    electron?: {
      systemAdBlock: {
        checkStatus: () => Promise<{ active: boolean; adapters: string[]; error?: string }>;
        enable: () => Promise<{ success: boolean; message: string }>;
        disable: () => Promise<{ success: boolean; message: string }>;
        forceReset: () => Promise<{ success: boolean; message: string }>;
        testDns?: () => Promise<{ isBlocked: boolean; output: string }>;
      };
      system: {
        getDnsInfo: () => Promise<Record<string, string[]>>;
      };
    };
  }
}

const isElectron = () => (globalThis.window !== undefined) && !!(globalThis.window as any).electron?.systemAdBlock;

export default function DesktopPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: true,
  });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentDns, setCurrentDns] = useState<Record<string, string[]>>({});
  const [isToggling, setIsToggling] = useState(false);
  const isTogglingRef = useRef(false);

  // Simulated stats for the dashboard
  const [stats] = useState<TrackerStats>({
    bandwidthSaved: 847,
    timeSaved: 32,
    dataValueReclaimed: 4.73,
  });

  const updateDnsInfo = useCallback(async () => {
    if (!isElectron()) return;
    try {
      const api = (globalThis.window as any).electron;
      const info = await api.system.getDnsInfo();
      setCurrentDns(info);
    } catch {
      // ignore
    }
  }, []);

  const handleTest = useCallback(async () => {
    if (!isElectron()) return null;
    try {
      const api = (globalThis.window as any).electron;
      // Using direct channel if exposed or specific method
      if (api.systemAdBlock && api.systemAdBlock.testDns) {
          return await api.systemAdBlock.testDns();
      }
      // Fallback
      return await api.invoke('adblock:test-dns');
    } catch (err) {
      console.error("Test invocation failed:", err);
      return null;
    }
  }, []);

  // VPN is currently in Beta and not supported
  const isVpnSupported = false;

  // On mount: check status
  useEffect(() => {
    if (!isElectron()) {
        console.warn("Dev mode: System functions are simulated.");
        return;
    }
    const sync = async () => {
      try {
        const api = (globalThis.window as any).electron;
        const status = await api.systemAdBlock.checkStatus();
        if (status.error === 'Not Admin') {
            setError("Requires Administrator privileges! Please restart Terminal as Admin.");
        }
        if (status.active) {
          setProtection(prev => ({ ...prev, isActive: true, adblockEnabled: true }));
        }
        await updateDnsInfo();
      } catch (err) {
        console.error("Initial sync failure:", err);
      }
    };
    sync();
  }, [updateDnsInfo]);

  // Periodic status poll
  useEffect(() => {
    if (!isElectron()) return;
    const interval = setInterval(async () => {
      if (isTogglingRef.current) return;
      try {
        const status = await (globalThis.window as any).electron.systemAdBlock.checkStatus();
        await updateDnsInfo();
        
        setProtection(prev => {
          if (prev.isActive && prev.adblockEnabled && !status.active) {
            return { ...prev, isActive: prev.vpnEnabled ? prev.isActive : false };
          }
          return prev;
        });
      } catch {
        // silence
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [updateDnsInfo]);

  const handleProtectionToggle = useCallback(async () => {
    if (isTogglingRef.current) return;
    
    if (!protection.isActive && !protection.adblockEnabled && !protection.vpnEnabled) {
      setError("Enable VPN or AdBlock before activating.");
      return;
    }

    isTogglingRef.current = true;
    setIsToggling(true);
    setError(null);
    setStatusMessage(null);

    try {
      if (protection.isActive) {
        // === DEACTIVATE ===
        if (protection.adblockEnabled && isElectron()) {
          const api = (globalThis.window as any).electron;
          const result = await api.systemAdBlock.disable();
          if (result.success) {
            setStatusMessage("Protection Disabled: All system settings restored.");
          } else {
            setError(`Restoration Error: ${result.message}`);
          }
        } else if (!isElectron()) {
          setStatusMessage("Simulation disabled.");
        }
        setProtection(prev => ({ ...prev, isActive: false }));
        await updateDnsInfo();
      } else {
        // === ACTIVATE ===
        let adBlockSuccess = false;

        if (protection.adblockEnabled) {
          if (isElectron()) {
            const api = (globalThis.window as any).electron;
            const result = await api.systemAdBlock.enable();
            if (result.success) {
              adBlockSuccess = true;
              setStatusMessage("AdBlock Active: System-wide DNS + Hosts protection enabled.");
            } else {
              setError(`AdBlock Error: ${result.message}`);
            }
          } else {
            adBlockSuccess = true;
            setStatusMessage("Browser Simulation Mode Active.");
          }
        }

        if (protection.vpnEnabled) {
          setError("VPN connectivity is currently in Beta.");
        }

        const canActivate = (protection.adblockEnabled && adBlockSuccess) || (protection.vpnEnabled && isVpnSupported);
        setProtection(prev => ({ ...prev, isActive: canActivate }));
        await updateDnsInfo();
      }
    } finally {
      isTogglingRef.current = false;
      setIsToggling(false);
    }
  }, [protection, updateDnsInfo, isVpnSupported]);

  const handleVpnToggle = useCallback(() => {
    setProtection(prev => ({ ...prev, vpnEnabled: !prev.vpnEnabled }));
    if (protection.isActive) {
      setError("VPN connectivity is currently in Beta and cannot be toggled while active.");
    }
  }, [protection.isActive]);

  const handleReset = useCallback(async () => {
    if (!isElectron()) return;
    setIsToggling(true);
    try {
        const api = (globalThis.window as any).electron;
        const result = await api.systemAdBlock.forceReset();
        if (result.success) {
            setStatusMessage("SYSTEM RESET COMPLETE: Network settings restored.");
            setProtection({ isActive: false, vpnEnabled: false, adblockEnabled: true });
        } else {
            setError(`Reset Failed: ${result.message}`);
        }
        await updateDnsInfo();
    } catch (err: any) {
        setError(`Critical Error: ${err.message}`);
    } finally {
        setIsToggling(false);
    }
  }, [updateDnsInfo]);

  const handleAdblockToggle = useCallback(async () => {
    const nextState = !protection.adblockEnabled;
    setProtection(prev => ({ ...prev, adblockEnabled: nextState }));

    if (protection.isActive && isElectron()) {
      setIsToggling(true);
      try {
        if (nextState) {
          await (globalThis.window as any).electron.systemAdBlock.enable();
          setStatusMessage("AdBlock enabled and system settings updated.");
        } else {
          await (globalThis.window as any).electron.systemAdBlock.disable();
          setStatusMessage("AdBlock disabled and system settings restored.");
        }
        await updateDnsInfo();
      } catch (err: any) {
        setError(`Failed to update AdBlock state: ${err.message}`);
      } finally {
        setIsToggling(false);
      }
    }
  }, [protection, updateDnsInfo]);

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="h-screen overflow-hidden bg-zinc-950 flex flex-col">
        {/* Toast notifications */}
        <div className="absolute top-4 right-4 z-9999 flex flex-col gap-2 w-80">
          {error && (
            <div className="bg-red-500/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-red-400/50 flex items-start gap-3 animate-in slide-in-from-right">
              <div className="flex-1 text-sm font-semibold">{error}</div>
              <button onClick={() => setError(null)} className="text-white hover:opacity-75">×</button>
            </div>
          )}
          {statusMessage && (
            <div className="bg-emerald-600/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-400/50 flex items-start gap-3 animate-in slide-in-from-right">
              <div className="flex-1 text-sm font-semibold">{statusMessage}</div>
              <button onClick={() => setStatusMessage(null)} className="text-white hover:opacity-75">×</button>
            </div>
          )}
        </div>

        <DesktopApp
          protection={protection}
          onProtectionToggle={handleProtectionToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
          onTest={handleTest}
          onReset={handleReset}
          stats={stats}
          loading={isToggling}
          dnsInfo={currentDns}
        />
      </div>
    </ThemeProvider>
  );
}

