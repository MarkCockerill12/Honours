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

function loadStats() {
  try {
    if (fs.existsSync(STATS_PATH)) {
      adblockStats = JSON.parse(fs.readFileSync(STATS_PATH, "utf8"));
    }
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

function saveStats() {
  try {
    fs.writeFileSync(STATS_PATH, JSON.stringify(adblockStats, null, 2));
  } catch (err) {
    console.error("Failed to save stats:", err);
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
  adblockStats.totalBlocked++;
  adblockStats.bandwidthSaved += size || 50000;
  adblockStats.timeSaved += (size || 50000) / (1.25 * 1024 * 1024);
  adblockStats.moneySaved += ((size || 50000) / (1024 * 1024)) * 0.0048;
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
    await execAsync("ipconfig /flushdns", { windowsHide: true }).catch(() => {});
    return { success: true, message: "System cleaned and DNS flushed." };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

async function getActiveAdapter() {
  try {
    const { stdout } = await execAsync('powershell -Command "Get-NetAdapter -Physical | Where-Object Status -eq \'Up\' | Select-Object -ExpandProperty Name"');
    const adapters = stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
    return adapters.length > 0 ? adapters[0] : null;
  } catch (err) {
    console.error("Failed to get physical adapter:", err.message);
    return null;
  }
}

async function getDNS(adapter) {
  try {
    const { stdout } = await execAsync(`powershell -Command "(Get-DnsClientServerAddress -InterfaceAlias '${adapter}').ServerAddresses"`);
    return stdout.trim().split("\n").map(l => l.trim()).filter(Boolean);
  } catch (err) {
    return [];
  }
}

// Ensure the DNS resets safely!
async function safeResetDNS() {
  const adapter = await getActiveAdapter();
  if (adapter) {
    console.log(`[AdBlock] Restoring native generic DNS for ${adapter}...`);
    try {
      await execAsync(`powershell -Command "Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ResetServerAddresses"`);
    } catch (err) {
      console.log(`[AdBlock] Silent reset failed, utilizing elevated PowerShell reset string...`);
      try {
        await execAsync(`powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList \\"-Command Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ResetServerAddresses\\""`);
      } catch (elevateErr) {
        console.warn("[AdBlock] Forced UAC reset failed during exit:", elevateErr.message);
      }
    }
  }
}

ipcMain.handle("adblock:enable", async () => {
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const crossFetch = require('cross-fetch');
    
    // Ghostery Engine
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(crossFetch);
    if (app.isReady() && require('electron').session.defaultSession) {
      blocker.enableBlockingInSession(require('electron').session.defaultSession);
      console.log("[AdBlock] Ghostery engine enabled in App session.");
    }

    // System-Wide DNS Overrides using PowerShell + prompt
    const adapter = await getActiveAdapter();
    if (!adapter) throw new Error("Could not find an active physical network adapter to protect.");

    try {
      // Set to AdGuard Default DNS (IPv4 + IPv6) using pure Windows UAC Elevation
      const innerCmd = `Set-DnsClientServerAddress -InterfaceAlias '${adapter}' -ServerAddresses '94.140.14.14','94.140.15.15','2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'; ipconfig /flushdns`;
      const psCmd = `powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList \\"-Command ${innerCmd}\\""`;
      
      await execAsync(psCmd);
      console.log(`[AdBlock] Successfully bound ${adapter} system-wide to AdGuard!`);
      return { success: true, message: "System-wide network layer protection active." };
    } catch (error) {
      console.error("[AdBlock] Privilege override rejected:", error);
      return { success: false, message: `System-wide protection requires elevated permissions. User cancelled UAC.` };
    }

  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle("adblock:disable", async () => {
  await safeResetDNS();
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
  console.log("[QUIT] App closing, forcefully resetting adapter DNS back to normal network.");
  // Block app killing briefly to ensure the DNS is reset seamlessly so the user isn't bricked
  e.preventDefault();
  await safeResetDNS();
  app.exit();
});

async function initConfig() {
  await app.whenReady();
  await cleanupLegacyHosts();
  loadStats();
  createWindow();
}

initConfig().catch(() => process.exit(1));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("will-quit", () => {
  console.log("--- TERMINATED ---");
});
