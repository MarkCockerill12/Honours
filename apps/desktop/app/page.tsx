"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { DesktopApp } from "../DesktopApp";
import { ThemeProvider, useStats } from "@privacy-shield/ui";
import type { Theme, ProtectionState, ServerLocation } from "@privacy-shield/shared";
import { VPN_SERVERS } from "@privacy-shield/shared";

// Declare electron global
declare global {
  interface Window {
    electron?: {
      systemAdBlock: {
        checkStatus: () => Promise<{
          active: boolean;
          adapters: string[];
          error?: string;
        }>;
        enable: () => Promise<{ success: boolean; message: string }>;
        disable: () => Promise<{ success: boolean; message: string }>;
        forceReset: () => Promise<{ success: boolean; message: string }>;
        testDns?: () => Promise<{ isBlocked: boolean; output: string; summary?: string }>;
        getStats: () => Promise<{
          totalBlocked: number;
          bandwidthSaved: number;
          timeSaved: number;
          moneySaved: number;
        }>;
        recordBlock: (data: { size: number; category: string }) => Promise<any>;
      };
      system: {
        getDnsInfo: () => Promise<Record<string, string[]>>;
      };
      vpn: {
        toggle: (config: any) => Promise<{ success: boolean; message: string }>;
        provision: (serverId: string) => Promise<{ success: boolean; config?: any; error?: string }>;
        deprovision: (serverId: string) => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

const isElectron = () =>
  globalThis.window !== undefined &&
  !!(globalThis.window as any).electron?.systemAdBlock;

export default function DesktopPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: false,
    filteringEnabled: false,
  });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentDns, setCurrentDns] = useState<Record<string, string[]>>({});
  const [, setInitialDns] = useState<Record<string, string[]>>({});
  const [servers, setServers] = useState<ServerLocation[]>(VPN_SERVERS);
  const [selectedServer, setSelectedServer] = useState<ServerLocation | null>(VPN_SERVERS[0]);
  const [isToggling, setIsToggling] = useState(false);
  const isTogglingRef = useRef(false);

  const { stats, updateStats } = useStats();

  const updateDnsInfo = useCallback(async (isInitial = false) => {
    if (!isElectron()) return;
    try {
      const api = (globalThis.window as any).electron;
      const info = await api.system.getDnsInfo();
      setCurrentDns(info);
      if (isInitial) setInitialDns(info);
    } catch {
      // ignore
    }
  }, []);

  const handleTest = useCallback(async () => {
    if (!isElectron()) {
      console.log("Dev mode: Simulating DNS test...");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        isBlocked: protection.isActive,
        output: protection.isActive
          ? "Non-authoritative answer:\nName:    doubleclick.net\nAddress:  0.0.0.0"
          : "Non-authoritative answer:\nName:    doubleclick.net\nAddress:  142.250.74.206",
        summary: protection.isActive
          ? "SUCCESS: Traffic to doubleclick.net was correctly intercepted by the shield."
          : "WARNING: Traffic to doubleclick.net bypasses the shield and resolved to a public IP."
      };
    }
    try {
      const api = (globalThis.window as any).electron;
      // Using direct channel if exposed or specific method
      if (api.systemAdBlock?.testDns) {
        return await api.systemAdBlock.testDns();
      }
      // Fallback
      return await api.invoke("adblock:test-dns");
    } catch (err) {
      console.error("Test invocation failed:", err);
      return null;
    }
  }, [protection.isActive]);

  // VPN is fully supported via dynamic provisioning
  const isVpnSupported = true;

  // On mount: check status
  useEffect(() => {
    if (!isElectron()) {
      console.warn("Dev mode: System functions are simulated.");
      updateDnsInfo(true);
      return;
    }
    const sync = async () => {
      try {
        const api = (globalThis.window as any).electron;
        const status = await api.systemAdBlock.checkStatus();
        if (status.error === "Not Admin") {
          setError(
            "Requires Administrator privileges! Please restart Terminal as Admin.",
          );
        }
        if (status.active) {
          setProtection((prev) => ({
            ...prev,
            isActive: true,
            adblockEnabled: false,
          }));
        }
        await updateDnsInfo(true);
        await updateStats();
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
        const status = await (
          globalThis.window as any
        ).electron.systemAdBlock.checkStatus();
        await updateDnsInfo();
        await updateStats();

        setProtection((prev) => {
          if (prev.isActive && prev.adblockEnabled && !status.active) {
            return {
              ...prev,
              isActive: prev.vpnEnabled ? prev.isActive : false,
            };
          }
          return prev;
        });
      } catch {
        // silence
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [updateDnsInfo, updateStats]);

  const handleProtectionToggle = useCallback(async () => {
    if (isTogglingRef.current) return;

    if (
      !protection.isActive &&
      !protection.adblockEnabled &&
      !protection.vpnEnabled
    ) {
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
        if (isElectron()) {
          const api = (globalThis.window as any).electron;

          // 1. Disconnect VPN tunnel + stop EC2
          if (protection.vpnEnabled) {
            await api.vpn.toggle(null); // drops WireGuard tunnel
            if (selectedServer) {
              await api.vpn.deprovision(selectedServer.id); // stops EC2 instance
              setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "off" } : s));
            }
          }

          // 2. Disable AdBlock DNS
          if (protection.adblockEnabled) {
            const result = await api.systemAdBlock.disable();
            if (result.success) {
              setStatusMessage("Protection Disabled: All system settings restored.");
            } else {
              setError(`Restoration Error: ${result.message}`);
            }
          }
        } else {
          setStatusMessage("Simulation disabled.");
        }
        setProtection((prev) => ({ ...prev, isActive: false }));
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
              setStatusMessage(
                "AdBlock Active: System-wide DNS + Hosts protection enabled.",
              );
            } else {
              setError(`AdBlock Error: ${result.message}`);
            }
          } else {
            adBlockSuccess = true;
            setStatusMessage("Browser Simulation Mode Active.");
          }
        }

        let vpnSuccess = false;
        if (protection.vpnEnabled) {
          if (isElectron()) {
            const api = (globalThis.window as any).electron;
            if (!selectedServer) throw new Error("No VPN server selected");
            
            try {
              setStatusMessage(`Provisioning VPN node in ${selectedServer.country}...`);
              setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "starting" } : s));
              
              const provisionResult = await api.vpn.provision(selectedServer.id);
              if (!provisionResult.success) throw new Error(provisionResult.error || "Provisioning failed");
              const vpnResult = await api.vpn.toggle(provisionResult.config);
              
              if (vpnResult.success) {
                vpnSuccess = true;
                setStatusMessage(`VPN Active: Secure tunnel via ${selectedServer.name}.`);
                setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "active" } : s));
              } else {
                setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "off" } : s));
                setError(`VPN Error: ${vpnResult.message}`);
              }
            } catch (err: any) {
              setServers(prev => prev.map(s => s.id === selectedServer.id ? { ...s, status: "off" } : s));
              setError(`VPN Provisioning Failed: ${err.message}`);
            }
          } else {
            vpnSuccess = true;
            setStatusMessage("VPN Simulation Mode Active.");
          }
        }

        const canActivate =
          (protection.adblockEnabled && adBlockSuccess) ||
          (protection.vpnEnabled && vpnSuccess);
        setProtection((prev) => ({ ...prev, isActive: canActivate }));
        await updateDnsInfo();
      }
    } finally {
      isTogglingRef.current = false;
      setIsToggling(false);
    }
  }, [protection, updateDnsInfo, isVpnSupported]);

  const handleVpnToggle = useCallback(() => {
    setProtection((prev) => ({ ...prev, vpnEnabled: !prev.vpnEnabled }));
    if (protection.isActive) {
      setError(
        "VPN connectivity cannot be toggled while active.",
      );
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
        setProtection({
          isActive: false,
          vpnEnabled: false,
          adblockEnabled: false,
          filteringEnabled: false,
        });
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
    setProtection((prev) => ({ ...prev, adblockEnabled: nextState }));

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

  const handleServerSelect = useCallback(async (server: ServerLocation) => {
    const previousServer = selectedServer;
    setSelectedServer(server);

    if (protection.isActive && protection.vpnEnabled && isElectron()) {
      if (previousServer?.id === server.id) return;
      
      setIsToggling(true);
      setStatusMessage(`Swapping VPN node to ${server.name}...`);
      
      try {
        const api = (globalThis.window as any).electron;
        
        // 1. Drop current tunnel
        await api.vpn.toggle(null);
        setServers(prev => prev.map(s => s.id === previousServer?.id ? { ...s, status: "off" } : s));

        // 2. Provision new tunnel
        setServers(prev => prev.map(s => s.id === server.id ? { ...s, status: "starting" } : s));
        const provisionResult = await api.vpn.provision(server.id);
        if (!provisionResult.success) throw new Error(provisionResult.error || "Provisioning failed");
        const result = await api.vpn.toggle(provisionResult.config);

        if (result.success) {
          setStatusMessage(`VPN Swapped: Secure tunnel now via ${server.name}.`);
          setServers(prev => prev.map(s => s.id === server.id ? { ...s, status: "active" } : s));
        } else {
          setError(`VPN Swap Failed: ${result.message}`);
          setServers(prev => prev.map(s => s.id === server.id ? { ...s, status: "off" } : s));
        }
      } catch (err: any) {
        setError(`VPN Migration Error: ${err.message}`);
        setServers(prev => prev.map(s => s.id === server.id ? { ...s, status: "off" } : s));
      } finally {
        setIsToggling(false);
      }
    }
  }, [protection.isActive, protection.vpnEnabled, selectedServer, setServers, setStatusMessage, setIsToggling, setError]);

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="h-screen overflow-hidden bg-zinc-950 flex flex-col">
        {/* Toast notifications */}
        <div className="absolute top-4 right-4 z-9999 flex flex-col gap-2 w-80">
          {error && (
            <div className="bg-red-500/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-red-400/50 flex items-start gap-3 animate-in slide-in-from-right">
              <div className="flex-1 text-sm font-semibold">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-white hover:opacity-75"
              >
                ×
              </button>
            </div>
          )}
          {statusMessage && (
            <div className="bg-emerald-600/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-400/50 flex items-start gap-3 animate-in slide-in-from-right">
              <div className="flex-1 text-sm font-semibold">
                {statusMessage}
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-white hover:opacity-75"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <DesktopApp
          protection={protection}
          onProtectionToggle={handleProtectionToggle}
          onVpnToggle={handleVpnToggle}
          onAdblockToggle={handleAdblockToggle}
          onFilteringToggle={handleProtectionToggle}
          onTest={handleTest}
          onReset={handleReset}
          stats={stats}
          loading={isToggling}
          dnsInfo={currentDns}
          setTheme={setTheme}
          servers={servers}
          selectedServer={selectedServer}
          onServerSelect={handleServerSelect}
        />
      </div>
    </ThemeProvider>
  );
}

