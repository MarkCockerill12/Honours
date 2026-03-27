"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { DesktopApp } from "../DesktopApp";
import { ThemeProvider, useStats, VPN_SERVERS } from "@privacy-shield/core";
import type { Theme, ProtectionState, ServerLocation } from "@privacy-shield/core";

// Declare electron global
declare global {
  interface Window {
    electron?: {
      systemAdBlock: {
        checkStatus: () => Promise<{
          active: boolean;
          adapters: string[];
          error?: string;
          isAdmin?: boolean;
          vpnActive?: boolean;
        }>;
        enable: () => Promise<{ success: boolean; message: string }>;
        disable: () => Promise<{ success: boolean; message: string }>;
        forceReset: () => Promise<{ success: boolean; message: string }>;
        testDns?: () => Promise<{ isBlocked: boolean; output: string; summary?: string }>;
        getStats: () => Promise<Record<string, number>>;
        recordBlock: (data: { size: number; category: string }) => Promise<void>;
      };
      system: {
        getDnsInfo: () => Promise<Record<string, string[]>>;
      };
      vpn: {
        toggle: (config: Record<string, unknown> | null) => Promise<{ success: boolean; message: string; errorCode?: string }>;
        provision: (serverId: string) => Promise<{ success: boolean; config?: Record<string, unknown>; error?: string }>;
        deprovision: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ active: boolean; serverId: string | null; serverIp: string | null }>;
      };
    };
  }
}

const isElectron = () =>
  globalThis.window !== undefined &&
  !!(globalThis.window as Window).electron?.systemAdBlock;

export default function DesktopPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [protection, setProtection] = useState<ProtectionState>({
    isActive: false,
    vpnEnabled: false,
    adblockEnabled: false,
    filteringEnabled: false,
  });

  const [currentDns, setCurrentDns] = useState<Record<string, string[]>>({});
  const [initialDns, setInitialDns] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerLocation | null>(VPN_SERVERS[0]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerLocation["status"]>>({});
  const [isToggling, setIsToggling] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);
  const isTogglingRef = useRef(false);

  const { stats, updateStats } = useStats();

  // Derive servers with live status overlays
  const servers = VPN_SERVERS.map(s => ({
    ...s,
    status: serverStatuses[s.id] || s.status,
  }));

  const updateDnsInfo = useCallback(async (isInitial = false) => {
    if (!isElectron()) return;
    try {
      const info = await (globalThis.window as Window).electron!.system.getDnsInfo();
      setCurrentDns(info);
      if (isInitial) setInitialDns(info);
    } catch { /* ignore */ }
  }, []);

  const handleTest = useCallback(async () => {
    if (!isElectron()) {
      await new Promise(r => setTimeout(r, 1000));
      return { isBlocked: protection.isActive, output: "Simulated output", summary: "Simulation successful" };
    }
    try {
      const api = (globalThis.window as Window).electron!;
      if (api.systemAdBlock?.testDns) return await api.systemAdBlock.testDns();
      return { isBlocked: false, output: "Test failed" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Test error: ${message}`);
      return null;
    }
  }, [protection.isActive]);

  // Single unified sync loop
  useEffect(() => {
    if (!isElectron()) return;
    const sync = async () => {
      // DON'T sync state while a manual toggle is in progress
      if (isTogglingRef.current) return;
      
      try {
        const api = (globalThis.window as Window).electron!;
        const status = await api.systemAdBlock.checkStatus();
        setIsAdmin(!!status.isAdmin);
        setProtection(prev => ({ 
          ...prev, 
          isActive: status.active || !!status.vpnActive, 
          adblockEnabled: status.active,
          vpnEnabled: !!status.vpnActive
        }));

        // Sync VPN server status
        if (status.vpnActive) {
          const vpnStatus = await api.vpn.getStatus();
          if (vpnStatus.serverId) {
            setServerStatuses(prev => ({ ...prev, [vpnStatus.serverId!]: "active" }));
            // Also ensure selectedServer matches
            const activeServer = VPN_SERVERS.find(s => s.id === vpnStatus.serverId);
            if (activeServer) setSelectedServer(activeServer);
          }
        }

        await updateDnsInfo(true);
        await updateStats();
      } catch (err) { console.error("Sync error:", err); }
    };
    sync();
    const interval = setInterval(sync, 10000);
    return () => clearInterval(interval);
  }, [updateDnsInfo, updateStats]);

  const toggleAdBlock = useCallback(async (enable: boolean) => {
    const api = (globalThis.window as Window).electron;
    if (!isElectron() || !api) return true;
    if (enable) {
      const res = await api.systemAdBlock.enable();
      if (!res.success) setError(res.message);
      return res.success;
    } else {
      await api.systemAdBlock.disable();
      return true;
    }
  }, []);

  const toggleVpn = useCallback(async (enable: boolean, server?: ServerLocation) => {
    const api = (globalThis.window as Window).electron;
    if (!isElectron() || !api) return true;
    
    if (enable) {
      if (!server) return false;
      try {
        setServerStatuses(prev => ({ ...prev, [server.id]: "starting" }));
        const prov = await api.vpn.provision(server.id);
        if (!prov.success) {
          setServerStatuses(prev => ({ ...prev, [server.id]: "off" }));
          setError(prov.error ?? "Provisioning failed");
          return false;
        }

        const res = await api.vpn.toggle(prov.config!);
        if (res.success) {
          setServerStatuses(prev => ({ ...prev, [server.id]: "active" }));
          setStatusInfo(res.message);
        } else {
          setServerStatuses(prev => ({ ...prev, [server.id]: "off" }));
          setError(res.errorCode === "MISSING_DEPENDENCY" 
            ? "WireGuard binary not found. Please check 'apps/desktop/bin/'." 
            : res.message);
        }
        return res.success;
      } catch (e: unknown) {
        setServerStatuses(prev => ({ ...prev, [server.id]: "off" }));
        setError(e instanceof Error ? e.message : String(e));
        return false;
      }
    } else {
      await api.vpn.toggle(null);
      if (server) {
        await api.vpn.deprovision(server.id);
        setServerStatuses(prev => ({ ...prev, [server.id]: "off" }));
      } else {
        setServerStatuses({});
      }
      return true;
    }
  }, []);

  const handleProtectionToggle = useCallback(async () => {
    if (isTogglingRef.current) return;
    
    const currentProtection = protection;
    if (!currentProtection.isActive && !currentProtection.adblockEnabled && !currentProtection.vpnEnabled) {
      setError("Please enable at least one shield.");
      return;
    }

    isTogglingRef.current = true;
    setIsToggling(true);
    setError(null);
    setStatusInfo(null);

    try {
      if (currentProtection.isActive) {
        // TURN OFF ALL
        if (currentProtection.vpnEnabled) await toggleVpn(false, selectedServer || undefined);
        if (currentProtection.adblockEnabled) await toggleAdBlock(false);
        setProtection(prev => ({ ...prev, isActive: false }));
      } else {
        // TURN ON SELECTED
        const abOk = currentProtection.adblockEnabled ? await toggleAdBlock(true) : true;
        const vpnOk = currentProtection.vpnEnabled ? await toggleVpn(true, selectedServer || undefined) : true;

        setProtection(prev => ({ 
          ...prev, 
          isActive: (prev.adblockEnabled && abOk) || (prev.vpnEnabled && vpnOk) 
        }));
      }
      await updateDnsInfo();
    } catch (err: unknown) {
      setError(`Toggle failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsToggling(false);
      isTogglingRef.current = false;
    }
  }, [protection, selectedServer, updateDnsInfo, toggleAdBlock, toggleVpn]);

  const handleVpnToggle = useCallback(() => setProtection(prev => ({ ...prev, vpnEnabled: !prev.vpnEnabled })), []);
  const handleAdblockToggle = useCallback(() => setProtection(prev => ({ ...prev, adblockEnabled: !prev.adblockEnabled })), []);
  const handleReset = useCallback(async () => {
    if (!isElectron()) return;
    setIsToggling(true);
    try {
      await (globalThis.window as Window).electron!.systemAdBlock.forceReset();
      setProtection({ isActive: false, vpnEnabled: false, adblockEnabled: false, filteringEnabled: false });
      setServerStatuses({});
      await updateDnsInfo();
    } finally { setIsToggling(false); }
  }, [updateDnsInfo]);

  // Server switching — disconnect from old, reconnect to new if VPN is active
  const handleServerSelect = useCallback(async (server: ServerLocation) => {
    if (server.id === selectedServer?.id) return;

    const wasActive = protection.isActive && protection.vpnEnabled;
    const oldServer = selectedServer;

    setSelectedServer(server);

    // If VPN is not running, just update the selection (no reconnect needed)
    if (!wasActive || !isElectron()) return;

    const api = (globalThis.window as Window).electron;
    if (!api) return;

    isTogglingRef.current = true;
    setIsToggling(true);
    setError(null);
    setStatusInfo(null);

    try {
      // 1. Disconnect current tunnel
      await api.vpn.toggle(null);
      if (oldServer) {
        setServerStatuses(prev => ({ ...prev, [oldServer.id]: "off" }));
        await api.vpn.deprovision(oldServer.id);
      }

      // 2. Provision new server
      setServerStatuses(prev => ({ ...prev, [server.id]: "starting" }));
      const prov = await api.vpn.provision(server.id);
      if (!prov.success) {
        setServerStatuses(prev => ({ ...prev, [server.id]: "off" }));
        setError(prov.error ?? "Failed to provision new server");
        setProtection(prev => ({ ...prev, isActive: false }));
        return;
      }

      // 3. Connect to new server
      const res = await api.vpn.toggle(prov.config!);
      if (res.success) {
        setServerStatuses(prev => ({ ...prev, [server.id]: "active" }));
        setStatusInfo(res.message);
      } else {
        setServerStatuses(prev => ({ ...prev, [server.id]: "off" }));
        setError(res.message);
        setProtection(prev => ({ ...prev, isActive: false }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Server switch failed: ${message}`);
    } finally {
      setIsToggling(false);
      isTogglingRef.current = false;
      await updateDnsInfo();
    }
  }, [selectedServer, protection.isActive, protection.vpnEnabled, updateDnsInfo]);

  return (
    <ThemeProvider theme={theme} setTheme={setTheme}>
      <div className="h-screen overflow-hidden bg-zinc-950 flex flex-col">
        <div className="absolute top-4 right-4 z-[9999] flex flex-col gap-2 w-80">
          {error && (
            <div className="bg-red-500/90 text-white px-4 py-3 rounded-xl shadow-2xl flex justify-between items-center backdrop-blur-md">
              <div className="text-sm font-semibold">{error}</div>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}
          {statusInfo && (
            <div className="bg-blue-600/90 text-white px-4 py-3 rounded-xl shadow-2xl flex justify-between items-center backdrop-blur-md">
              <div className="text-sm font-semibold">{statusInfo}</div>
              <button onClick={() => setStatusInfo(null)}>×</button>
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
          initialDns={initialDns}
          setTheme={setTheme}
          servers={servers}
          selectedServer={selectedServer}
          onServerSelect={handleServerSelect}
          isAdmin={isAdmin}
        />
      </div>
    </ThemeProvider>
  );
}
