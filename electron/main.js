const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");

const execAsync = promisify(exec);

const HOSTS_PATH =
  process.platform === "win32"
    ? String.raw`C:\Windows\System32\drivers\etc\hosts`
    : "/etc/hosts";

const HOSTS_MARKER_START = "# --- Honours AdBlock Start ---";
const HOSTS_MARKER_END = "# --- Honours AdBlock End ---";

let adblockStats = {
  totalBlocked: 0,
  bandwidthSaved: 0,
  timeSaved: 0,
  moneySaved: 0,
};
const STATS_PATH = path.join(app.getPath("userData"), "adblock-stats.json");
let activeVpnFile = null;
let activeVpnConfig = null;
let adBlocker = null;

// Graceful termination handlers for Ctrl+C and terminal close
process.on("SIGINT", () => app.quit());
process.on("SIGTERM", () => app.quit());

// Helper to get public IP
async function getPublicIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) return "Unknown (Status Error)";
    const data = await response.json();
    return data.ip || "Unknown (Missing IP)";
  } catch (err) {
    console.warn("[!] Failed to fetch public IP:", err.message);
    return "Unknown (Connection Failed)";
  }
}

// System AdBlock now relies exclusively on internal @ghostery filters for Electron stability.
// The hosts file is no longer touched to prevent performance degradation.

// Stats persistence
function saveStats() {
  try {
    fs.writeFileSync(STATS_PATH, JSON.stringify(adblockStats, null, 2));
  } catch (err) {
    console.warn("[AdBlock] Failed to save stats:", err);
  }
}

function loadStats() {
  try {
    if (fs.existsSync(STATS_PATH)) {
      const data = fs.readFileSync(STATS_PATH, "utf8");
      adblockStats = JSON.parse(data);
    }
  } catch (err) {
    console.debug("[AdBlock] No stats found or failed to load, using defaults.", err);
    adblockStats = {
      totalBlocked: 0,
      bandwidthSaved: 0,
      timeSaved: 0,
      moneySaved: 0,
    };
  }
}

async function getAdBlockStatus() {
  const adapter = await getActiveAdapter();
  if (!adapter) return { active: false, adapters: [] };
  const dns = await getDNS(adapter);
  const isActive = dns.includes("94.140.14.14") || dns.includes("2a10:50c0::ad1:ff");
  return {
    active: isActive,
    adapters: [adapter],
  };
}

// Function to clean up any legacy hosts entries from previous iterations
async function cleanupLegacyHosts() {
  try {
    if (!fs.existsSync(HOSTS_PATH)) return;
    let content = fs.readFileSync(HOSTS_PATH, "utf8");
    if (content.includes(HOSTS_MARKER_START)) {
      console.log("[CLEANUP] Removing legacy hosts block...");
      const regex = new RegExp(
        String.raw`${HOSTS_MARKER_START}[\s\S]*?${HOSTS_MARKER_END}\s*`,
        "g",
      );
      content = content.replaceAll(regex, "");
      fs.writeFileSync(HOSTS_PATH, content.trim() + "\n");
    }
  } catch (err) {
    console.warn("Legacy hosts cleanup failed (likely no permission):", err.message);
  }
}

// IPC Handlers
ipcMain.handle("adblock:check-status", async () => {
  return await getAdBlockStatus();
});

ipcMain.handle("adblock:get-stats", () => adblockStats);

ipcMain.handle("adblock:record-block", (event, { size, category }) => {
  // T2: Input validation - ensure size is a finite positive number
  const validSize = (typeof size === 'number' && Number.isFinite(size) && size > 0) ? size : 50000;
  
  adblockStats.totalBlocked++;
  adblockStats.bandwidthSaved += validSize;
  
  // A4: Consistency - using precise 0.0048828125 (£5/GB)
  const COST_PER_MB_SHIELD = 0.0048828125;
  adblockStats.timeSaved += validSize / (1.25 * 1024 * 1024);
  adblockStats.moneySaved += (validSize / (1024 * 1024)) * COST_PER_MB_SHIELD;
  
  saveStats();
  return adblockStats;
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
    await cleanupLegacyHosts();
    await execAsync(String.raw`ipconfig /flushdns`, { windowsHide: true }).catch((err) => {
      console.debug("[AdBlock] DNS flush failed during force-reset:", err);
    });
    return { success: true, message: "System cleaned and DNS flushed." };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

async function getActiveAdapter() {
  try {
    const { stdout } = await execAsync('powershell -Command "Get-NetAdapter -Physical | Where-Object Status -eq \'Up\' | Select-Object -ExpandProperty Name"');
    const adapters = stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const adapter = adapters.length > 0 ? adapters[0] : null;
    
    // Security: Only allow safe characters in adapter names to prevent shell injection
    if (adapter && !/^[a-zA-Z0-9\s\-_]+$/.test(adapter)) {
      console.error("[Security] Malicious network adapter name detected:", adapter);
      return null;
    }
    
    return adapter;
  } catch (err) {
    console.error("Failed to get physical adapter:", err.message);
    return null;
  }
}

async function getDNS(adapter) {
  try {
    const { stdout } = await execAsync(String.raw`powershell -Command "(Get-DnsClientServerAddress -InterfaceAlias '${adapter}').ServerAddresses"`);
    return stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
  } catch (err) {
    console.debug("[AdBlock] Failed to get DNS addresses for adapter:", adapter, err);
    return [];
  }
}

// Helper to restart VPN if active to apply new DNS settings
async function restartVpnIfActive() {
  if (activeVpnFile && activeVpnConfig) {
    console.log("[VPN] AdBlock state changed. Restarting VPN to sync DNS...");
    const currentConfig = activeVpnConfig;
    // Toggle off
    await execAsync(`wg-quick down "${activeVpnFile}"`).catch(() => {});
    // Toggle back on (re-generates file with new DNS)
    await ipcMain.emit("vpn:toggle", {}, currentConfig);
  }
}

// Ensure the DNS resets safely!
async function safeResetDNS() {
  const adapter = await getActiveAdapter();
  if (adapter) {
    console.log(`[AdBlock] Restoring native generic DNS for ${adapter}...`);
    try {
      await execAsync(String.raw`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ResetServerAddresses"`);
    } catch (err) {
      console.debug(`[AdBlock] Silent reset failed for ${adapter}, attempting elevated reset.`, err);
      try {
        await execAsync(String.raw`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command Set-DnsClientServerAddress -InterfaceAlias \"${adapter}\" -ResetServerAddresses'"`);
      } catch (error_) {
        console.warn("[AdBlock] Forced UAC reset failed during exit:", error_.message);
      }
    }
  }
}

ipcMain.handle("adblock:enable", async () => {
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const crossFetch = require('cross-fetch');
    
    // Ghostery Engine (Singleton Pattern)
    if (!adBlocker) {
      console.log("[AdBlock] Initializing Ghostery engine...");
      adBlocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(crossFetch);
    }
    
    if (app.isReady() && require('electron').session.defaultSession) {
      // Only enable if not already active in session to prevent "second handler" error
      try {
        adBlocker.enableBlockingInSession(require('electron').session.defaultSession);
        console.log("[AdBlock] Ghostery engine active in App session.");
      } catch (err) {
        if (err.message?.includes("second handler")) {
          console.log("[AdBlock] Engine already active in session, skipping re-registration.");
        } else {
          throw err;
        }
      }
    }

    // System-Wide DNS Overrides using PowerShell + prompt
    const adapter = await getActiveAdapter();
    if (!adapter) throw new Error("Could not find an active physical network adapter to protect.");
    const innerCmd = String.raw`Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ServerAddresses '94.140.14.14','94.140.15.15','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'; ipconfig /flushdns`;

    try {
      // 1. Try silent/direct set first (works if already elevated)
      console.log(`[AdBlock] Attempting silent DNS bind for ${adapter}...`);
      await execAsync(`powershell -Command "${innerCmd}"`);
      console.log(`[AdBlock] Successfully bound ${adapter} system-wide (direct).`);
      return { success: true, message: "System-wide network layer protection active." };
    } catch (err) {
      console.log("[AdBlock] Direct set failed, attempting elevated bind via UAC prompt...");
      // 2. Try with UAC prompt
      const psCmd = String.raw`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command ${innerCmd}'"`;
      try {
        await execAsync(psCmd);
      console.log(`[AdBlock] Successfully bound ${adapter} system-wide (elevated).`);
        await restartVpnIfActive();
        return { success: true, message: "System-wide network layer protection active." };
      } catch (uacError) {
        console.error("[AdBlock] Privilege override rejected:", uacError);
        return { success: false, message: "System-wide protection requires elevated permissions. User cancelled UAC." };
      }
    }

  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle("adblock:disable", async () => {
  await safeResetDNS();
  await restartVpnIfActive();
  return { success: true, message: "Protection session detached and DNS restored natively." };
});

ipcMain.handle("adblock:flush-dns", async () => {
  try {
    await execAsync("ipconfig /flushdns", { windowsHide: true });
    return { success: true, message: "DNS cache flushed." };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle("system:get-dns-info", async () => {
  const adapter = await getActiveAdapter();
  if (adapter) {
    const dnsNodes = await getDNS(adapter);
    return { [adapter]: dnsNodes };
  }
  return { status: "Inactive / Scanning Failed" };
});

ipcMain.handle("vpn:toggle", async (event, config) => {
  try {
    if (activeVpnFile) {
      // Deactivate existing tunnel
      console.log("[VPN] Deactivating tunnel...");
      await execAsync(`wg-quick down "${activeVpnFile}"`).catch(e => console.warn("wg-quick down failed:", e.message));
      if (fs.existsSync(activeVpnFile)) fs.unlinkSync(activeVpnFile);
      activeVpnFile = null;
      activeVpnConfig = null;
      return { success: true, message: "VPN Tunnel Disconnected." };
    } else {
      // Activate new tunnel
      if (!config || !config.PublicIp || !config.PublicKey) {
        throw new Error("Invalid WireGuard configuration received (v2.0). Missing IP or Key.");
      }
      
      activeVpnConfig = config;

      // AdBlock Sync: Check if system-wide AdBlock is active
      const adState = await getAdBlockStatus();
      const dnsServers = adState.active ? "94.140.14.14, 94.140.15.15" : "1.1.1.1";

      // v2.0 Client-Side Profile Generation
      const clientPrivateKey = process.env.WG_CLIENT_PRIVATE_KEY || "CLIENT_PRIVATE_KEY_PLACEHOLDER";
      const confContent = `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = 10.0.0.2/32
DNS = ${dnsServers}
MTU = ${config.MTU || 1280}

[Peer]
PublicKey = ${config.PublicKey}
Endpoint = ${config.PublicIp}:${config.Port || 51820}
AllowedIPs = 0.0.0.0/0
`.trim();

      const tempPath = path.join(app.getPath("temp"), `honours-vpn-${config.Id || 'default'}.conf`);
      fs.writeFileSync(tempPath, confContent);
      activeVpnFile = tempPath;

      console.log(`[VPN] Activating tunnel via ${tempPath}...`);
      // Note: wg-quick requires admin/root privileges on most systems
      await execAsync(`wg-quick up "${tempPath}"`);
      return { success: true, message: "VPN Tunnel Active." };
    }
  } catch (err) {
    console.error("[VPN IPC Error]:", err.message);
    activeVpnFile = null; // Reset on failure
    return { success: false, message: `VPN Error: ${err.message}` };
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Honours - Secure AdBlocker",
  });

  const startUrl = process.env.ELECTRON_START_URL || `http://localhost:3000/desktop`;
  mainWindow.loadURL(startUrl).catch(() => {
    setTimeout(() => { if (mainWindow) mainWindow.loadURL(startUrl); }, 2000);
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.on("before-quit", async (e) => {
  console.log("[QUIT] App closing, cleaning up system services...");
  // Block app killing briefly to ensure transitions are seamless
  e.preventDefault();
  
  try {
    if (activeVpnFile) {
      console.log("[QUIT] Shutting down active VPN...");
      // Use synchronous exec to ensure it finishes before process ends if needed,
      // but wg-quick down is usually fast.
      const { execSync } = require("node:child_process");
      try {
        execSync(`wg-quick down "${activeVpnFile}"`, { windowsHide: true });
        if (fs.existsSync(activeVpnFile)) fs.unlinkSync(activeVpnFile);
      } catch (vErr) {
        console.warn("[QUIT] VPN cleanup failed:", vErr.message);
      }
    }

    // FINAL ROBUST DNS RESET
    const adapter = await getActiveAdapter();
    if (adapter) {
      console.log(`[QUIT] Restoring native DNS for ${adapter} (Final)...`);
      const { execSync } = require("node:child_process");
      try {
        // Try direct reset first
        execSync(String.raw`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ResetServerAddresses"`, { windowsHide: true });
      } catch (dnsErr) {
        // If direct fails (not elevated), we attempt the UAC prompt one last time, 
        // but this might be interrupted by OS shutdown if forced.
        console.warn("[QUIT] Silent reset failed, attempting final elevated reset.");
        const innerCmd = `Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ResetServerAddresses`;
        execSync(String.raw`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '-Command ${innerCmd}'"`, { windowsHide: true });
      }
    }
  } catch (err) {
    console.error("[QUIT] Critical cleanup error:", err);
  } finally {
    console.log("[QUIT] Cleanup complete. Exiting.");
    app.exit();
  }
});

async function initConfig() {
  await app.whenReady();
  await cleanupLegacyHosts();
  loadStats();
  createWindow();
}

(async () => {
  try {
    await initConfig();
  } catch (err) {
    console.error("Initialization failed:", err);
    process.exit(1);
  }
})();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("will-quit", () => {
  console.log("--- TERMINATED ---");
});
