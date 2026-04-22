const { ipcMain, app } = require("electron");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const path = require("node:path");

const execAsync = promisify(exec);
const STATS_PATH = path.join(app.getPath("userData"), "adblock-stats.json");

// --- Helper Utilities ---

async function getActiveAdapter() {
  try {
    if (process.platform === 'win32') {
      const { stdout: routeOut } = await execAsync('powershell -Command "Get-NetRoute -DestinationPrefix \'0.0.0.0/0\' | Sort-Object RouteMetric | Select-Object -ExpandProperty InterfaceAlias -First 1"');
      let primaryAlias = routeOut.trim();
      if (!primaryAlias) {
        const { stdout: adapterOut } = await execAsync('powershell -Command "Get-NetAdapter -Physical | Where-Object Status -eq \'Up\' | Select-Object -ExpandProperty Name -First 1"');
        primaryAlias = adapterOut.trim();
      }
      return primaryAlias || null;
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync("networksetup -listallnetworkservices | grep -v '*' | head -n 1");
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

async function getAdBlockStatus(state) {
  const vpnActive = !!state.activeVpnFile;
  const adaptersToCheck = [];
  
  const physicalAdapter = await getActiveAdapter();
  if (physicalAdapter) adaptersToCheck.push(physicalAdapter);
  
  if (vpnActive && state.activeVpnConfig?.Id) {
    adaptersToCheck.push(`ps-${state.activeVpnConfig.Id}`);
  }

  if (adaptersToCheck.length === 0) return { active: false, adapters: [], vpnActive };

  let isActive = false;
  const verifiedAdapters = [];

  for (const adapter of adaptersToCheck) {
    try {
      const dns = await getDNS(adapter);
      const hasAdGuard = dns.some(ip => 
        ip.includes("94.140.14.14") || 
        ip.includes("94.140.15.15") || 
        ip.includes("2a10:50c0::ad1:ff") || 
        ip.includes("2a10:50c0::ad2:ff")
      );
      if (hasAdGuard) {
        isActive = true;
        verifiedAdapters.push(adapter);
      }
    } catch (e) {
      console.debug(`[AdBlock] Error checking DNS for ${adapter}:`, e.message);
    }
  }

  return { active: isActive, adapters: verifiedAdapters, vpnActive };
}

async function safeResetDNS(adapter) {
  if (!adapter) {
    try {
      if (process.platform === 'win32') {
        console.log("[AdBlock] Performing GLOBAL DNS reset on all adapters...");
        await execAsync(String.raw`powershell -Command "Get-NetAdapter | ForEach-Object { Set-DnsClientServerAddress -InterfaceAlias $_.Name -ResetServerAddresses }"`);
        await execAsync("ipconfig /flushdns").catch(() => {});
      } else if (process.platform === 'darwin') {
        await execAsync(`networksetup -listallnetworkservices | while read line; do networksetup -setdnsservers "$line" Empty; done`);
      }
      return;
    } catch (e) {
      console.debug("[AdBlock] Global reset failed, trying active adapter only.");
      adapter = await getActiveAdapter();
    }
  }
  
  if (!adapter) return;

  try {
    console.log(`[AdBlock] Resetting DNS for ${adapter}...`);
    if (process.platform === 'win32') {
      const escapedAdapter = adapter.replaceAll("'", "''");
      await execAsync(String.raw`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${escapedAdapter}' -ResetServerAddresses"`).catch(async () => {    
        const innerCmd = `Set-DnsClientServerAddress -InterfaceAlias ''${escapedAdapter}'' -ResetServerAddresses`.replaceAll('"', '""');
        await execAsync(String.raw`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command ${innerCmd}'"`);      
      });
      await execAsync("ipconfig /flushdns").catch(() => {});
    } else if (process.platform === 'darwin') {
      await execAsync(`networksetup -setdnsservers "${adapter}" Empty`);
    }
    console.log(`[AdBlock] OK: DNS reset for ${adapter} complete.`);
  } catch (err) {
    console.error(`[AdBlock] ERROR: DNS reset failed for ${adapter}:`, err.message);
  }
}

// --- Main Handler Setup ---

function setupAdblockHandlers(state, updateVpnDnsIfActive) {
  
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
      return { ...status, isAdmin: state.isAdmin };
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
    const testDomain = "googleadservices.com";
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`http://${testDomain}`, { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);
      return { isBlocked: false, output: `HTTP ${response.status}`, domain: testDomain, summary: `Domain reached.` };
    } catch (err) {
      return { isBlocked: true, output: err.message, domain: testDomain, summary: `Blocked.` };
    }
  });

  ipcMain.handle("adblock:force-reset", async () => {
    console.log("[AdBlock] Force Reset requested...");
    state.adblockEnabled = false;
    try {
      await safeResetDNS();
      if (process.platform === 'win32') {
        await execAsync("ipconfig /flushdns").catch(() => {});
      }
      if (state.adBlocker) {
        try { state.adBlocker.disableBlockingInSession(require('electron').session.defaultSession); } catch { /* ignore */ }
        state.adBlocker = null;
      }
      // If VPN is active, update the tunnel DNS to reflect reset state
      await updateVpnDnsIfActive();
      
      console.log("[AdBlock] OK: Force Reset complete.");
      return { success: true, message: "System cleaned." };
    } catch (err) {
      console.error(`[AdBlock] ERROR: Force Reset failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("adblock:enable", async () => {
    console.log("[AdBlock] Enabling Protection...");
    state.adblockEnabled = true;
    try {
      const { ElectronBlocker, fullLists } = require('@ghostery/adblocker-electron');
      const crossFetch = require('cross-fetch');
      if (!state.adBlocker) {
        console.log("[AdBlock] Initializing High-Performance Ghostery engine...");
        state.adBlocker = await ElectronBlocker.fromLists(crossFetch, [
          ...fullLists,
          'https://easylist.to/easylist/easylist.txt',
          'https://easylist.to/easylist/easyprivacy.txt',
          'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext',
        ]);
      }
      if (app.isReady() && require('electron').session.defaultSession) {
        state.adBlocker.enableBlockingInSession(require('electron').session.defaultSession);
        console.log("[AdBlock] Ghostery (Ultra Mode) active in Electron session.");
      }

      const isVpnActive = !!state.activeVpnConfig?.Id;

      if (isVpnActive) {
        console.log("[AdBlock] VPN is active. Updating tunnel DNS to inject Protected DNS...");
        await updateVpnDnsIfActive();
      } else {
        const adapter = await getActiveAdapter();
        if (!adapter) {
          console.warn("[AdBlock] No active physical adapter found.");
        } else {
          console.log(`[AdBlock] Setting system DNS for adapter: ${adapter}...`);
          const escapedAdapter = adapter.replaceAll("'", "''");
          const dnsList = "'94.140.14.14','94.140.15.15','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'";
          const innerCmd = `Set-DnsClientServerAddress -InterfaceAlias '${escapedAdapter}' -ServerAddresses ${dnsList}; ipconfig /flushdns`;
          try {
            await execAsync(`powershell -Command "${innerCmd}"`);
            console.log("[AdBlock] OK: Physical DNS set successfully.");
          } catch (directError) {
            console.log("[AdBlock] Direct set failed, attempting UAC...");
            const psCmd = `powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command ${innerCmd.replaceAll("'", "''")}'"`;
            await Promise.race([ execAsync(psCmd), new Promise((_, reject) => setTimeout(() => reject(new Error("UAC Timeout")), 30000)) ]);
            console.log("[AdBlock] OK: Physical DNS set (elevated).");
          }
        }
      }
      
      console.log("[AdBlock] OK: Protection fully enabled.");
      return { success: true, message: "System-wide protection active." };
    } catch (err) {
      state.adblockEnabled = false;
      console.error(`[AdBlock] ERROR: Enable failed: ${err.message}`);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("adblock:disable", async () => {
    console.log("[AdBlock] Disabling Protection...");
    state.adblockEnabled = false;
    try {
      const isVpnActive = !!state.activeVpnConfig?.Id;
      if (isVpnActive) {
        // Only reset the physical adapter — never wipe the WireGuard tunnel DNS
        const physicalAdapter = await getActiveAdapter();
        if (physicalAdapter) await safeResetDNS(physicalAdapter);
        console.log("[AdBlock] VPN is active. Updating tunnel DNS to restore Standard DNS...");
        await updateVpnDnsIfActive();
      } else {
        await safeResetDNS();
      }

      if (state.adBlocker) {
        try { state.adBlocker.disableBlockingInSession(require('electron').session.defaultSession); } catch { /* ignore */ }
      }
      console.log("[AdBlock] OK: Protection fully disabled.");
      return { success: true, message: "Protection session detached." };
    } catch (err) {
      console.error(`[AdBlock] ERROR: Disable failed: ${err.message}`);
      return { success: false, message: err.message };
    }
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
      return { status: "No active adapter" };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle("adblock:set-intent", async (_event, enabled) => {
    console.log(`[AdBlock] Intent updated: ${enabled ? 'PROTECT' : 'STANDARD'}`);
    state.adblockEnabled = !!enabled;
    // We do NOT update the VPN DNS here because if we are enabling AdBlock,
    // the DNS switch to AdGuard will block the download of the adblock lists (yoyo.org, easylist)
    // The updateVpnDnsIfActive() call is already handled at the end of the enable() and disable() flows.
    return { success: true };
  });

  return { getAdBlockStatus: () => getAdBlockStatus(state), safeResetDNS: () => safeResetDNS() };
}

module.exports = { setupAdblockHandlers, STATS_PATH };
