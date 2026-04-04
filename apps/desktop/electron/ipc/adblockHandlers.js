const { ipcMain, app } = require("electron");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const path = require("node:path");

const execAsync = promisify(exec);
const STATS_PATH = path.join(app.getPath("userData"), "adblock-stats.json");

// Helper Utilities (Outer Scope)
async function getActiveAdapter() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('powershell -Command "Get-NetAdapter -Physical | Where-Object Status -eq \'Up\' | Select-Object -ExpandProperty Name"');
      const adapterLines = stdout.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      return adapterLines.length > 0 ? adapterLines[0] : null;
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync("networksetup -listallnetworkservices | grep -v '*' | head -n 1");
      return stdout.trim() || null;
    }
    if (process.platform === 'linux') {
      const { stdout } = await execAsync("ip route | grep default | awk '{print $5}' | head -n 1");
      return stdout.trim() || null;
    }
    return null;
  } catch (err) {
    console.debug("[AdBlock] No active physical adapter found:", err.message);
    return null;
  }
}

async function getDNS(adapter) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(String.raw`powershell -Command "(Get-DnsClientServerAddress -InterfaceAlias \"${adapter}\").ServerAddresses"`);
      return stdout.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`networksetup -getdnsservers "${adapter}"`);
      return stdout.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }
    return [];
  } catch (err) {
    console.debug("[AdBlock] Failed to query DNS for adapter:", err.message);
    return [];
  }
}

// Handlers
async function getAdBlockStatus(state) {
  const adapter = await getActiveAdapter();
  if (!adapter) return { active: false, adapters: [] };
  const dns = await getDNS(adapter);
  const isActive = dns.includes("94.140.14.14") || dns.includes("2a10:50c0::ad1:ff") || dns.includes("94.140.15.15");
  return { active: isActive, adapters: [adapter] };
}

async function safeResetDNS() {
  const adapter = await getActiveAdapter();
  if (!adapter) return;

  try {
    if (process.platform === 'win32') {
      const escapedAdapter = adapter.replaceAll("'", "''");
      await execAsync(String.raw`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${escapedAdapter}' -ResetServerAddresses"`).catch(async () => {
        const innerCmd = `Set-DnsClientServerAddress -InterfaceAlias ''${escapedAdapter}'' -ResetServerAddresses`.replaceAll('"', '""');
        await execAsync(String.raw`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command ${innerCmd}'"`);
      });
    } else if (process.platform === 'darwin') {
      await execAsync(`networksetup -setdnsservers "${adapter}" Empty`);
    }
  } catch (err) {
    console.error("[AdBlock] DNS reset failed:", err.message);
  }
}

async function syncVpnDns(state, active) {
  if (!state.activeVpnConfig?.Id) return;
  const vpnAdapter = `ps-${state.activeVpnConfig.Id}`;
  
  if (process.platform === 'win32') {
    const dnsServers = active ? "'94.140.14.14','94.140.15.15','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'" : "'1.1.1.1','8.8.8.8'";
    console.log(`[AdBlock] Syncing DNS for VPN adapter ${vpnAdapter}: ${active ? 'Enabled' : 'Disabled'}`);
    try {
      const setCmd = active 
        ? `Set-DnsClientServerAddress -InterfaceAlias '${vpnAdapter}' -ServerAddresses ${dnsServers}`
        : `Set-DnsClientServerAddress -InterfaceAlias '${vpnAdapter}' -ResetServerAddresses`;
      await execAsync(`powershell -Command "${setCmd}"`);
    } catch (err) {
      console.debug(`[AdBlock] VPN DNS sync failed:`, err.message);
    }
  } else if (process.platform === 'darwin') {
    const dnsServers = active ? "94.140.14.14 94.140.15.15" : "Empty";
    try {
      await execAsync(`networksetup -setdnsservers "${vpnAdapter}" ${dnsServers}`);
    } catch (err) {
      console.debug(`[AdBlock] Mac VPN DNS sync failed:`, err.message);
    }
  } else if (process.platform === 'linux') {
    const dnsServers = active ? "94.140.14.14 94.140.15.15" : "";
    try {
      // Try systemd-resolved (resolvectl)
      await execAsync(`sudo resolvectl dns "${vpnAdapter}" ${dnsServers}`);
    } catch (err) {
      console.debug(`[AdBlock] Linux VPN DNS sync (resolvectl) failed:`, err.message);
      try {
        // Fallback to nmcli
        await execAsync(`sudo nmcli device modify "${vpnAdapter}" ipv4.dns "${dnsServers.replace(/ /g, ',')}"`);
      } catch (nmErr) {
        console.debug(`[AdBlock] Linux VPN DNS sync (nmcli) failed:`, nmErr.message);
      }
    }
  }
}

function setupAdblockHandlers(state, restartVpnIfActive) {
  
  function saveStats() {
    try {
      fs.writeFileSync(STATS_PATH, JSON.stringify(state.adblockStats, null, 2));
    } catch (err) {
      console.warn("[AdBlock] Failed to save stats:", err);
    }
  }

  // Handlers
  ipcMain.handle("adblock:check-status", async () => {
    try {
      const status = await getAdBlockStatus(state);
      return { ...status, isAdmin: state.isAdmin, vpnActive: !!state.activeVpnFile };
    } catch (error) {
      console.error("[AdBlock] Status check failed:", error.message);
      return { active: false, adapters: [], isAdmin: false, vpnActive: false };
    }
  });

  ipcMain.handle("adblock:get-stats", () => state.adblockStats);

  ipcMain.handle("adblock:record-block", (_event, { size }) => {
    const validSize = (typeof size === 'number' && Number.isFinite(size) && size > 0) ? size : 50000;
    state.adblockStats.totalBlocked++;
    state.adblockStats.bandwidthSaved += validSize;
    state.adblockStats.timeSaved += validSize / (1.25 * 1024 * 1024);
    state.adblockStats.moneySaved += (validSize / (1024 * 1024)) * 0.0048828125;
    saveStats();
    return state.adblockStats;
  });

  ipcMain.handle("adblock:test-dns", async () => {
    const testDomain = "googleads.g.doubleclick.net";
    try {
      const response = await fetch(`http://${testDomain}`, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
      return {
        isBlocked: false,
        output: `HTTP ${response.status}`,
        domain: testDomain,
        summary: `Domain reached. App-interceptor is passive or domain allowed.`,
      };
    } catch (err) {
      return {
        isBlocked: true,
        output: err.message,
        domain: testDomain,
        summary: `Blocked: Ghostery/System intercepted the request to ${testDomain}.`,
      };
    }
  });

  ipcMain.handle("adblock:force-reset", async () => {
    try {
      await safeResetDNS();
      await execAsync(String.raw`ipconfig /flushdns`, { windowsHide: true }).catch((err) => {
        console.debug("[AdBlock] DNS flush failed during force-reset:", err);
      });
      if (state.adBlocker) {
        try {
          state.adBlocker.disableBlockingInSession(require('electron').session.defaultSession);
        } catch { /* ignore */ }
        state.adBlocker = null;
      }
      return { success: true, message: "System cleaned, DNS reset and flushed." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("adblock:enable", async () => {
    try {
      const { ElectronBlocker } = require('@ghostery/adblocker-electron');
      const crossFetch = require('cross-fetch');
      if (!state.adBlocker) {
        state.adBlocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(crossFetch);
      }
      if (app.isReady() && require('electron').session.defaultSession) {
        state.adBlocker.enableBlockingInSession(require('electron').session.defaultSession);
      }
      const adapter = await getActiveAdapter();
      if (!adapter) throw new Error("Could not find an active physical network adapter.");
      const escapedAdapter = adapter.replaceAll("'", "''");
      const innerCmd = String.raw`Set-DnsClientServerAddress -InterfaceAlias '${escapedAdapter}' -ServerAddresses '94.140.14.14','94.140.15.15','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'; ipconfig /flushdns`;
      try {
        await execAsync(`powershell -Command "${innerCmd}"`);
        await syncVpnDns(state, true);
        return { success: true, message: "System-wide protection active." };
      } catch (directError) {
        console.log("[AdBlock] Direct set failed, prompting for UAC...");
        const psCmd = String.raw`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command ${innerCmd}'"`;
        await execAsync(psCmd);
        await syncVpnDns(state, true);
        return { success: true, message: "System-wide protection active (elevated)." };
      }
    } catch (err) {
      console.error("[AdBlock] Enable failed:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("adblock:disable", async () => {
    await safeResetDNS();
    await syncVpnDns(state, false);
    return { success: true, message: "Protection session detached." };
  });

  ipcMain.handle("adblock:flush-dns", async () => {
    try {
      await execAsync("ipconfig /flushdns", { windowsHide: true });
      return { success: true, message: "DNS cache flushed." };
    } catch (err) {
      console.error("[AdBlock] DNS flush failed:", err.message);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("system:get-dns-info", async () => {
    try {
      const adapter = await getActiveAdapter();
      if (adapter) {
        const dnsNodes = await getDNS(adapter);
        return { [adapter]: dnsNodes };
      }
      return { status: "Inactive / Scanning Failed" };
    } catch (err) {
      return { error: err.message };
    }
  });

  return { getAdBlockStatus, safeResetDNS };
}

module.exports = { setupAdblockHandlers, STATS_PATH };
