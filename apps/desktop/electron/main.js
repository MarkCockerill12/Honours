/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");

// Modular Handlers
const { setupVpnHandlers, StopInstancesCommand, getEC2Client, findInstanceByTag, SERVER_REGION_MAP, EC2_TAG_NAMES, ADGUARD_VPN_DNS, DEFAULT_VPN_DNS } = require("./ipc/vpnHandlers");
const { setupAdblockHandlers, STATS_PATH } = require("./ipc/adblockHandlers");

const envPath = path.resolve(__dirname, "../../../.env.local");
require("dotenv").config({ path: envPath, override: true });

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

async function verifyConnectivity(retries = 3) {
  console.log(`[Connectivity] Verification starting (ping 8.8.8.8)...`);
  for (let i = 0; i < retries; i++) {
    try {
      // Ping google DNS with 1s timeout
      const { stdout, stderr } = await execAsync("ping -n 1 -w 1000 8.8.8.8");
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
  
  if (fs.existsSync(state.activeVpnFile)) fs.unlinkSync(state.activeVpnFile);
  state.activeVpnFile = null;
  state.activeVpnConfig = null;
  return { success: true, message: "Disconnected." };
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
  const confContent = `
[Interface]
PrivateKey = ${(process.env.WG_CLIENT_PRIVATE_KEY || "").trim()}
Address = 10.0.0.2/32
DNS = ${dnsServers}
MTU = ${config.MTU || 1280}

[Peer]
PublicKey = ${config.PublicKey}
Endpoint = ${config.PublicIp}:${config.Port || 51820}
AllowedIPs = 0.0.0.0/0
`.trim();

  const tempPath = path.join(app.getPath("temp"), `ps-${config.Id}.conf`);
  fs.writeFileSync(tempPath, confContent);
  state.activeVpnFile = tempPath;
  
  console.log(`[VPN Toggle] Installing tunnel service: ${tempPath} (${wg.type})`);
  try {
    if (wg.type === 'svc') {
      const { stdout, stderr } = await execAsync(`${wg.path} /installtunnelservice "${tempPath}"`);
      console.log(`[VPN Toggle] Windows SVC result: ${stdout} ${stderr}`);
    } else {
      const { stdout, stderr } = await execAsync(`sudo ${wg.path} up "${tempPath}"`);
      console.log(`[VPN Toggle] Unix Quick result: ${stdout} ${stderr}`);
    }
  } catch (err) {
    console.error(`[VPN Toggle] ❌ Failed to install service: ${err.message}`);
    throw err;
  }
  
  // VERIFICATION STEP
  console.log(`[VPN Toggle] Wait for interface to initialize...`);
  await new Promise(r => setTimeout(r, 5000));
  
  // 1. Check Handshake (Ping Server internal IP 10.0.0.1)
  console.log(`[Connectivity] Pinging VPN Gateway (10.0.0.1)...`);
  let handshakeOk = false;
  try {
    const pingCmd = process.platform === 'win32' ? "ping -n 1 -w 2000 10.0.0.1" : "ping -c 1 -W 2 10.0.0.1";
    await execAsync(pingCmd);
    handshakeOk = true;
    console.log(`[Connectivity] ✅ Handshake Verified (Ping Gateway OK).`);
  } catch (err) {
    console.warn(`[Connectivity] ❌ Handshake Timeout. Sever Gateway (10.0.0.1) unreachable: ${err.message}`);
  }

  if (!handshakeOk) {
    return { success: true, message: "Connected (Handshake Timeout - Check Keys)." };
  }

  // 2. Check Transit (Ping 8.8.8.8)
  const isOnline = await verifyConnectivity();
  
  if (isOnline) {
    return { success: true, message: "Connected & Verified." };
  } else {
    console.warn("[VPN Toggle] ⚠️ Handshake OK but Transit failed. Likely Server NAT/Forwarding issue.");
    return { success: true, message: "Connected (NAT/Forwarding Error on Server)." };
  }
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
