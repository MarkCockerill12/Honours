/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");

// Environment Variables
const envPath = path.resolve(__dirname, "../../../.env.local");
require("dotenv").config({ path: envPath, override: true });

// Modular Handlers
const { setupVpnHandlers } = require("./ipc/vpnHandlers");
const { setupAdblockHandlers, STATS_PATH } = require("./ipc/adblockHandlers");

const execAsync = promisify(exec);

// Global State Object (Shared between main and modular handlers)
const state = {
  isAdmin: false,
  activeVpnFile: null,
  activeVpnConfig: null,
  adBlocker: null,
  adblockStats: {
    totalBlocked: 0,
    bandwidthSaved: 0,
    timeSaved: 0,
    moneySaved: 0,
  }
};

async function checkAdmin() {
  try {
    await execAsync("net session");
    state.isAdmin = true;
    return true;
  } catch {
    state.isAdmin = false;
    return false;
  }
}

// -------------------------
// VPN Binaries & Connectivity
// -------------------------
async function getWgCmd() {
  if (process.platform === 'win32') {
    const localSvc = path.join(app.getAppPath(), 'bin', 'wireguard.exe');
    if (fs.existsSync(localSvc)) return { type: 'svc', path: `"${localSvc}"` };
    return { type: 'svc', path: 'wireguard.exe' };
  }
  
  if (process.platform === 'linux' || process.platform === 'darwin') {
    return { type: 'quick', path: 'wg-quick' };
  }
  
  return null;
}

async function getPhysicalGateway() {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execAsync('route print -4 0.0.0.0');
    const lines = stdout.split('\n');
    const gwRegex = /^0\.0\.0\.0\s+0\.0\.0\.0\s+([\d.]+)\s+([\d.]+)/;
    for (const line of lines) {
      if (line.includes('0.0.0.0') && line.includes('Active Routes')) continue;
      const match = gwRegex.exec(line.trim());
      if (match) return match[1];
    }
  } catch (err) {
    console.error(`[Routing] Failed to find gateway: ${err.message}`);
  }
  return null;
}

async function addBypassRoute(serverIp) {
  if (process.platform !== 'win32' || !state.isAdmin) return;
  const gateway = await getPhysicalGateway();
  if (!gateway) return;
  console.log(`[Routing] Adding bypass route: ${serverIp} -> ${gateway}`);
  try {
    await execAsync(`route add ${serverIp} mask 255.255.255.255 ${gateway} metric 1`);
  } catch (err) {
    console.warn(`[Routing] Warning: Route add failed (may already exist): ${err.message}`);
  }
}

async function removeBypassRoute(serverIp) {
  if (process.platform !== 'win32' || !state.isAdmin) return;
  console.log(`[Routing] Removing bypass route: ${serverIp}`);
  try {
    await execAsync(`route delete ${serverIp}`);
  } catch (err) {
    console.warn(`[Routing] Warning: Route delete failed: ${err.message}`);
  }
}

async function verifyConnectivity(retries = 3) {
  console.log(`[Connectivity] Verification starting (ping 8.8.8.8)...`);
  for (let i = 0; i < retries; i++) {
    try {
      // Ping google DNS with 1s timeout
      const { stdout } = await execAsync("ping -n 1 -w 1000 8.8.8.8");
      console.log(`[Connectivity] ✅ Internet transit verified: ${stdout.trim()}`);
      return true;
    } catch (err) {
      console.warn(`[Connectivity] Attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return false;
}

async function stopVpn() {
  if (!state.activeVpnFile) return { success: true, message: "No active VPN." };
  
  const wg = await getWgCmd() || { type: 'svc', path: 'wireguard.exe' };
  const tunnelName = path.basename(state.activeVpnFile, '.conf');
  console.log(`[VPN Toggle] Disconnecting tunnel: ${tunnelName}`);
  
  try {
    if (wg.type === 'svc') {
      await execAsync(`${wg.path} /uninstalltunnelservice "${tunnelName}"`);
    } else {
      await execAsync(`sudo ${wg.path} down "${state.activeVpnFile}"`);
    }
    console.log(`[VPN Toggle] ✅ Tunnel uninstalled.`);
  } catch (err) {
    console.error(`[VPN Toggle] ❌ Failed to uninstall tunnel: ${err.message}`);
  }
  
  if (state.activeVpnConfig?.PublicIp) {
    await removeBypassRoute(state.activeVpnConfig.PublicIp);
  }

  if (fs.existsSync(state.activeVpnFile)) fs.unlinkSync(state.activeVpnFile);
  state.activeVpnFile = null;
  state.activeVpnConfig = null;
  return { success: true, message: "Disconnected." };
}

function generateWgConfig(config, dnsServers) {
  return `
[Interface]
PrivateKey = ${(process.env.WG_CLIENT_PRIVATE_KEY || "").trim()}
Address = 10.150.0.2/32
DNS = ${dnsServers}
MTU = ${config.MTU || 1200}

[Peer]
PublicKey = ${config.PublicKey}
Endpoint = ${config.PublicIp}:443
AllowedIPs = 0.0.0.0/0
`.trim();
}

async function pollGateway(gateways, maxWait = 60000) {
  console.log(`[Connectivity] Entering gateway polling loop (Max ${maxWait/1000}s)...`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    for (const gw of gateways) {
      try {
        const pingCmd = process.platform === 'win32' ? `ping -n 1 -w 1000 ${gw}` : `ping -c 1 -W 1 ${gw}`;
        await execAsync(pingCmd);
        return { ok: true, gw, time: Math.round((Date.now() - startTime) / 1000) };
      } catch {
        // Continue polling
      }
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  return { ok: false };
}

async function startVpn(config) {
  if (!config?.PublicIp) {
    console.error(`[VPN Toggle] ❌ Invalid config received:`, config);
    throw new Error("Invalid config.");
  }
  
  const wg = await getWgCmd() || { type: 'svc', path: 'wireguard.exe' };
  state.activeVpnConfig = config;
  const adStatus = await adblockTools.getAdBlockStatus();
  const dnsServers = adStatus.active ? "94.140.14.14, 94.140.15.15, 8.8.8.8" : "1.1.1.1, 8.8.8.8";
  
  console.log(`[VPN Toggle] Configuring for server: ${config.Id} at ${config.PublicIp}`);
  const confContent = generateWgConfig(config, dnsServers);

  const tempPath = path.join(app.getPath("temp"), `ps-${config.Id}.conf`);
  fs.writeFileSync(tempPath, confContent);
  state.activeVpnFile = tempPath;
  
  console.log(`[VPN Toggle] Installing tunnel service: ${tempPath} (${wg.type})`);
  try {
    // 1. Add Bypass Route BEFORE tunnel starts
    await addBypassRoute(config.PublicIp);

    if (wg.type === 'svc') {
      await execAsync(`${wg.path} /installtunnelservice "${tempPath}"`);
    } else {
      await execAsync(`sudo ${wg.path} up "${tempPath}"`);
    }
  } catch (err) {
    console.error(`[VPN Toggle] ❌ Failed to install service: ${err.message}`);
    await removeBypassRoute(config.PublicIp);
    throw err;
  }
  
  console.log(`[VPN Toggle] Wait for interface to initialize...`);
  await new Promise(r => setTimeout(r, 5000));
  
  const { ok, gw, time } = await pollGateway(["10.150.0.1", "10.0.0.1"]);

  if (!ok) {
    console.error(`[VPN Toggle] ❌ Handshake Timeout. Neither 10.150.0.1 nor 10.0.0.1 replied after 60s.`);
    console.log(`[VPN Toggle] [DEBUG] WireGuard Config: \n${confContent}`);
    return { success: true, message: "Connected (Handshake Timeout - Server still bootstrapping?)" };
  }

  console.log(`[Connectivity] ✅ Handshake Verified (Ping Gateway ${gw} OK) after ${time}s.`);
  if (gw === "10.0.0.1") console.warn(`[VPN Toggle] ⚠️ SUBNET MISMATCH DETECTED: Server is on 10.0.0.1.`);

  const isOnline = await verifyConnectivity();
  if (isOnline) return { success: true, message: "Connected & Verified." };
  
  console.warn("[VPN Toggle] ⚠️ Handshake OK but Transit failed. Likely Server NAT/Forwarding issue.");
  return { success: true, message: "Connected (NAT/Forwarding Error on Server)." };
}

async function handleVpnToggle(config) {
  if (state.activeVpnFile) {
    return await stopVpn();
  } else {
    return await startVpn(config);
  }
}

async function restartVpnIfActive() {
  if (state.activeVpnFile && state.activeVpnConfig) {
    const saved = { ...state.activeVpnConfig };
    await handleVpnToggle(null);
    await handleVpnToggle(saved);
  }
}

// Setup Modular Handlers
setupVpnHandlers(state, handleVpnToggle);
const adblockTools = setupAdblockHandlers(state, restartVpnIfActive);

// -------------------------
// Lifecycle & UI
// -------------------------
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Privacy Shield",
  });
  const startUrl = process.env.ELECTRON_START_URL || `http://localhost:3000`;
  mainWindow.loadURL(startUrl).catch(() => {
    setTimeout(() => { if (mainWindow) mainWindow.loadURL(startUrl); }, 2000);
  });
}

function loadStats() {
  try {
    if (fs.existsSync(STATS_PATH)) {
      state.adblockStats = JSON.parse(fs.readFileSync(STATS_PATH, "utf8"));
    }
  } catch (err) {
    console.warn("[Stats] Load failed, using defaults:", err.message);
  }
}

app.on("ready", async () => {
  await checkAdmin();
  loadStats();
  createWindow();
});

app.on("before-quit", async (e) => {
  e.preventDefault();
  try {
    if (state.activeVpnFile) await handleVpnToggle(null);
    await adblockTools.safeResetDNS();
  } catch (err) {
    console.error("[CleanUp] Failed during quit:", err.message);
  } finally {
    app.exit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
