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
    if (process.platform === 'win32') {
      await execAsync("net session");
    } else {
      const { stdout } = await execAsync("id -u");
      if (stdout.trim() !== "0") throw new Error("Not root");
    }
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
    // For Windows, we use a "Public Bridge" folder to ensure SYSTEM service access
    const bridgeDir = "C:\\Users\\Public\\PrivacyShield";
    const bridgeWg = path.join(bridgeDir, "wireguard.exe");
    const localBinDir = path.join(app.getAppPath(), 'bin');
    const localWg = path.join(localBinDir, 'wireguard.exe');
    const localWintun = path.join(localBinDir, 'wintun.dll');

    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });

    // Ensure binaries are in the bridge
    if (fs.existsSync(localWg)) {
      if (!fs.existsSync(bridgeWg) || fs.statSync(localWg).size !== fs.statSync(bridgeWg).size) {
        fs.copyFileSync(localWg, bridgeWg);
      }
      const bridgeWintun = path.join(bridgeDir, "wintun.dll");
      if (fs.existsSync(localWintun) && (!fs.existsSync(bridgeWintun) || fs.statSync(localWintun).size !== fs.statSync(bridgeWintun).size)) {
        fs.copyFileSync(localWintun, bridgeWintun);
      }
      return { type: 'svc', path: `"${bridgeWg}"` };
    }
    
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
  console.log(`[Routing] Ensuring bypass route: ${serverIp} -> ${gateway}`);
  try {
    await execAsync(`route delete ${serverIp}`).catch(() => {});
    await execAsync(`route add ${serverIp} mask 255.255.255.255 ${gateway} metric 1`);
  } catch (err) {
    console.warn(`[Routing] Warning: Route management failed: ${err.message}`);
  }
}

async function removeBypassRoute(serverIp) {
  if (process.platform !== 'win32' || !state.isAdmin) return;
  console.log(`[Routing] Removing bypass route: ${serverIp}`);
  try {
    await execAsync(`route delete ${serverIp}`).catch(() => {});
  } catch (err) {
    console.warn(`[Routing] Warning: Route delete failed: ${err.message}`);
  }
}

async function verifyConnectivity(retries = 3) {
  console.log(`[Connectivity] Verification starting (ping 8.8.8.8)...`);
  const pingCmd = process.platform === 'win32' ? "ping -n 1 -w 2000 8.8.8.8" : "ping -c 1 -W 2 8.8.8.8";
  
  for (let i = 0; i < retries; i++) {
    try {
      await execAsync(pingCmd);
      console.log(`[Connectivity] ✅ Internet transit verified.`);
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
  
  const wg = await getWgCmd();
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
  const subnet = config.Subnet || "10.150.0";
  return `
[Interface]
PrivateKey = ${(process.env.WG_CLIENT_PRIVATE_KEY || "").trim()}
Address = ${subnet}.2/24
DNS = ${dnsServers}
MTU = 1420

[Peer]
PublicKey = ${config.PublicKey}
Endpoint = ${config.PublicIp}:443
AllowedIPs = 0.0.0.0/1, 128.0.0.0/1
PersistentKeepalive = 25
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
    await new Promise(r => setTimeout(r, 2000));
  }
  return { ok: false };
}

async function startVpn(config) {
  console.log(`[VPN Toggle] 🚀 STARTING VPN ENGINE...`);
  if (!config?.PublicIp) {
    console.error(`[VPN Toggle] ❌ Invalid config received:`, config);
    throw new Error("Invalid config.");
  }
  
  const wg = await getWgCmd();
  if (!wg) throw new Error("WireGuard engine not found.");

  state.activeVpnConfig = config;
  const adStatus = await adblockTools.getAdBlockStatus();
  const dnsServers = adStatus.active ? "94.140.14.14, 94.140.15.15, 8.8.8.8" : "1.1.1.1, 8.8.8.8";
  
  console.log(`[VPN Toggle] Configuring for server: ${config.Id} at ${config.PublicIp}`);
  const confContent = generateWgConfig(config, dnsServers);

  const vpnDataDir = path.join(app.getPath("userData"), "vpn");
  if (!fs.existsSync(vpnDataDir)) fs.mkdirSync(vpnDataDir, { recursive: true });
  const tunnelName = `ps-${config.Id}`;
  const persistentPath = path.join(vpnDataDir, `${tunnelName}.conf`);
  fs.writeFileSync(persistentPath, confContent);
  
  let tunnelConfigPath = persistentPath;
  if (process.platform === 'win32') {
    const bridgeDir = "C:\\Users\\Public\\PrivacyShield";
    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });
    tunnelConfigPath = path.join(bridgeDir, `${tunnelName}.conf`);
    fs.writeFileSync(tunnelConfigPath, confContent);
  }

  state.activeVpnFile = persistentPath;
  
  console.log(`[VPN Toggle] Installing tunnel: ${tunnelName} (via ${wg.path})`);
  try {
    await addBypassRoute(config.PublicIp);

    if (process.platform === 'win32') {
      await execAsync("ipconfig /flushdns").catch(() => {});
      await execAsync(`${wg.path} /uninstalltunnelservice "${tunnelName}"`).catch(() => {});
      await execAsync(`${wg.path} /installtunnelservice "${tunnelConfigPath}"`);
      await execAsync(`sc start "WireGuardTunnel$${tunnelName}"`).catch(() => {});
    } else {
      await execAsync(`sudo ${wg.path} up "${persistentPath}"`);
    }
  } catch (err) {
    console.error(`[VPN Toggle] ❌ Failed to start tunnel: ${err.message}`);
    await removeBypassRoute(config.PublicIp);
    throw err;
  } finally {
    if (process.platform === 'win32' && fs.existsSync(tunnelConfigPath)) {
      setTimeout(() => { try { if (fs.existsSync(tunnelConfigPath)) fs.unlinkSync(tunnelConfigPath); } catch(e) {} }, 15000);
    }
  }
  
  console.log(`[VPN Toggle] Wait for interface to initialize...`);
  await new Promise(r => setTimeout(r, 5000));
  
  const gwIp = `${config.Subnet || "10.150.0"}.1`;
  const { ok, gw, time } = await pollGateway([gwIp, "10.150.0.1", "10.0.0.1"]);

  if (!ok) {
    console.error(`[VPN Toggle] ❌ Handshake Timeout. Gateway ${gwIp} did not reply.`);
    return { success: true, message: "Connected (Establishing...)" };
  }

  console.log(`[Connectivity] ✅ Handshake Verified (Ping Gateway ${gw} OK) after ${time}s.`);
  
  const isOnline = await verifyConnectivity();
  if (isOnline) return { success: true, message: "Connected & Verified." };
  
  return { success: true, message: "Connected (NAT/Routing Latency)." };
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
