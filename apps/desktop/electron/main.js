 
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");

// Environment Variables — try .env.local for dev, fall back to embedded values
const envPath = path.resolve(__dirname, "../../../.env.local");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath, override: true });
}
try { require('./_env.js'); } catch {
  console.log("[Env] No _env.js found, relying on local env vars.");
}

// Modular Handlers
const { setupVpnHandlers } = require("./ipc/vpnHandlers");
const { setupAdblockHandlers, STATS_PATH } = require("./ipc/adblockHandlers");

const execAsync = promisify(exec);

// Global State
const state = {
  isAdmin: false,
  activeVpnFile: null,
  activeVpnBridgeFile: null,
  activeVpnConfig: null,
  adblockEnabled: false, // Track user's intent for DNS
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
    const bridgeDir = "C:\\Users\\Public\\PrivacyShield";
    const bridgeWg = path.join(bridgeDir, "wireguard.exe");
    const localBinDir = path.join(app.getAppPath(), 'bin');
    const localWg = path.join(localBinDir, 'wireguard.exe');
    const localWintun = path.join(localBinDir, 'wintun.dll');

    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });

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

async function verifyConnectivity(retries = 5) {
  console.log(`[Connectivity] Verification starting (ping 8.8.8.8)...`);
  const pingCmd = process.platform === 'win32' ? "ping -n 1 -w 1000 8.8.8.8" : "ping -c 1 -W 1 8.8.8.8";
  
  for (let i = 0; i < retries; i++) {
    try {
      await execAsync(pingCmd);
      console.log(`[Connectivity] OK: Internet transit verified.`);
      return true;
    } catch (err) {
      console.warn(`[Connectivity] Attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
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
    console.log(`[VPN Toggle] OK: Tunnel uninstalled.`);
  } catch (err) {
    console.error(`[VPN Toggle] ERROR: Failed to uninstall tunnel: ${err.message}`);
  }
  
  if (state.activeVpnConfig?.PublicIp) {
    await removeBypassRoute(state.activeVpnConfig.PublicIp);
  }

  // Cleanup files
  if (fs.existsSync(state.activeVpnFile)) fs.unlinkSync(state.activeVpnFile);
  if (state.activeVpnBridgeFile && fs.existsSync(state.activeVpnBridgeFile)) {
    fs.unlinkSync(state.activeVpnBridgeFile);
  }
  
  state.activeVpnFile = null;
  state.activeVpnBridgeFile = null;
  state.activeVpnConfig = null;
  return { success: true, message: "Disconnected." };
}

const SHIELD_MASK = "B4ST10N_PR0T0C0L";
const SHIELD_PREFIX = "SHIELD:";

function decodeShield(obfuscated) {
  if (!obfuscated) return "";
  const input = obfuscated.trim();
  if (!input.startsWith(SHIELD_PREFIX)) return input;
  const payload = input.slice(SHIELD_PREFIX.length);
  let result = "";
  for (let i = 0; i < payload.length; i += 2) {
    const code = parseInt(payload.slice(i, i + 2), 16) ^ SHIELD_MASK.charCodeAt((i / 2) % SHIELD_MASK.length);
    result += String.fromCharCode(code);
  }
  return result.trim();
}

function generateWgConfig(config, dnsServers) {
  const clientPrivateKey = decodeShield(process.env.WG_CLIENT_PRIVATE_KEY) || "";
  if (!clientPrivateKey) {
    throw new Error("WG_CLIENT_PRIVATE_KEY not configured in environment");
  }

  const clientIp = "172.16.10.2";
  console.log(`[VPN Config] Using environment client key, address: ${clientIp}`);

  return `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIp}
DNS = ${dnsServers}
MTU = 1420

[Peer]
PublicKey = ${config.PublicKey}
Endpoint = ${config.PublicIp}:${config.Port || 443}
AllowedIPs = 0.0.0.0/0
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
    await new Promise(r => setTimeout(r, 3000));
  }
  return { ok: false };
}

function sendVpnStatus(message) {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send("vpn:status", message);
  }
}

async function startVpn(config) {
  console.log(`[VPN Toggle] starting VPN engine...`);
  if (!config?.PublicIp) {
    console.error(`[VPN Toggle] ERROR: Invalid config received:`, config);
    return { success: false, message: "No server config available — provision the server first." };
  }

  const wg = await getWgCmd();
  if (!wg) throw new Error("WireGuard engine not found.");

  state.activeVpnConfig = config;
  
  const useAdGuard = state.adblockEnabled;
  const dnsServers = useAdGuard ? "94.140.14.14, 94.140.15.15" : "1.1.1.1, 8.8.8.8";

  console.log(`[VPN Toggle] Configuring for server: ${config.Id} at ${config.PublicIp} (DNS: ${useAdGuard ? 'Protected' : 'Standard'})`);  const confContent = generateWgConfig(config, dnsServers);
  console.log(`[VPN Toggle] 📝 Generated Config (First 50 chars): ${confContent.substring(0, 50)}...`);

  const vpnDataDir = path.join(app.getPath("temp"), "ps-vpn");
  if (!fs.existsSync(vpnDataDir)) fs.mkdirSync(vpnDataDir, { recursive: true });
  const tunnelName = `ps-${config.Id}`;
  const persistentPath = path.join(vpnDataDir, `${tunnelName}.conf`);
  
  try {
    fs.writeFileSync(persistentPath, confContent, { encoding: "utf8" });
    console.log(`[VPN Toggle] ✅ Config written to ${persistentPath}`);
  } catch (err) {
    console.error(`[VPN Toggle] ❌ Failed to write config to ${persistentPath}: ${err.message}`);
    throw err;
  }
  
  let tunnelConfigPath = persistentPath;
  if (process.platform === 'win32') {
    const bridgeDir = path.join(app.getPath("temp"), "PrivacyShieldBridge");
    if (!fs.existsSync(bridgeDir)) fs.mkdirSync(bridgeDir, { recursive: true });
    tunnelConfigPath = path.join(bridgeDir, `${tunnelName}.conf`);
    try {
      fs.writeFileSync(tunnelConfigPath, confContent, { encoding: "utf8" });
      state.activeVpnBridgeFile = tunnelConfigPath;
      console.log(`[VPN Toggle] ✅ Bridge config written to ${tunnelConfigPath}`);
    } catch (err) {
      console.error(`[VPN Toggle] ❌ Failed to write bridge config: ${err.message}`);
    }
  }

  state.activeVpnFile = persistentPath;
  
  sendVpnStatus("Installing tunnel...");
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
    console.error(`[VPN Toggle] ERROR: Failed to start tunnel: ${err.message}`);
    await removeBypassRoute(config.PublicIp);
    throw err;
  }

  console.log(`[VPN Toggle] Wait for interface to initialize...`);
  await new Promise(r => setTimeout(r, 500)); // Reduced from 2000ms

  // Diagnostic Ping: Check if Public IP is even reachable (non-blocking)
  const publicPingCmd = process.platform === 'win32' ? `ping -n 1 -w 1000 ${config.PublicIp}` : `ping -c 1 -W 1 ${config.PublicIp}`;
  execAsync(publicPingCmd).catch(() => {});

  sendVpnStatus("Establishing secure connection...");
  const { ok, gw, time } = await pollGateway(["172.16.10.1"]);

  if (!ok) {
    console.error(`[VPN Toggle] ERROR: Handshake Timeout. Unified Gateway 172.16.10.1 did not reply.`);
    await stopVpn();
    return { success: false, message: "Connection failed — server did not respond. Try again in 30 seconds." };
  }

  console.log(`[Connectivity] OK: Handshake Verified (Ping Gateway ${gw} OK) after ${time}s.`);

  // If handshake was instant (< 3s), skip heavy verification to speed up "warm" starts
  if (time < 3) {
    sendVpnStatus("Connected");
    return { success: true, message: "Connected & Verified." };
  }

  sendVpnStatus("Verifying connectivity...");
  const isOnline = await verifyConnectivity(2);
  if (isOnline) return { success: true, message: "Connected & Verified." };

  // Server can take time on cold-started instances — give it one more chance
  sendVpnStatus("Almost there...");
  console.warn(`[VPN Toggle] Extended wait: giving server 5 more seconds...`);
  await new Promise(r => setTimeout(r, 5000));
  const finalRetry = await verifyConnectivity(2);
  if (finalRetry) return { success: true, message: "Connected & Verified." };

  await stopVpn();
  return { success: false, message: "Tunnel established but internet unreachable." };
}

async function handleVpnToggle(config) {
  if (state.isVpnToggling) {
    return { success: false, message: "Operation in progress" };
  }
  state.isVpnToggling = true;
  try {
    if (state.activeVpnFile) {
      return await stopVpn();
    } else {
      return await startVpn(config);
    }
  } finally {
    state.isVpnToggling = false;
  }
}

async function updateVpnDnsIfActive() {
  if (!state.activeVpnFile || !state.activeVpnConfig) return;

  const useAdGuard = state.adblockEnabled;
  console.log(`[VPN DNS Update] → ${useAdGuard ? 'Protected (AdGuard)' : 'Standard'}`);
  console.log(`[VPN DNS Update] Restarting tunnel to apply DNS natively...`);

  // Clone config before stopVpn nullifies it
  const config = { ...state.activeVpnConfig };

  try {
    await stopVpn();
    await startVpn(config);
    console.log(`[VPN DNS Update] ✅ DNS updated successfully with quick tunnel restart`);
  } catch (err) {
    console.error(`[VPN DNS Update] Failed to restart tunnel: ${err.message}`);
  }
}

// Setup Modular Handlers
setupVpnHandlers(state, handleVpnToggle);
const adblockTools = setupAdblockHandlers(state, updateVpnDnsIfActive);

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
    title: "Privacy Sentinel",
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

async function forceCleanupTunnels() {
  if (process.platform !== 'win32') return;
  console.log("[CleanUp] Force-cleaning any legacy tunnels...");
  try {
    const wg = await getWgCmd();
    if (!wg) return;
    
    // Get all running tunnel services
    const { stdout } = await execAsync('powershell -Command "Get-Service WireGuardTunnel$* | Select-Object -ExpandProperty Name"').catch(() => ({ stdout: "" }));
    const services = stdout.trim().split(/\r?\n/).filter(s => s.startsWith("WireGuardTunnel$"));
    
    for (const svc of services) {
      const tunnelName = svc.replace("WireGuardTunnel$", "");
      console.log(`[CleanUp] Force-removing stuck tunnel: ${tunnelName}`);
      // Uninstall is the most reliable way to clear the interface and routes
      await execAsync(`${wg.path} /uninstalltunnelservice "${tunnelName}"`).catch(() => {});
    }
    await execAsync("ipconfig /flushdns").catch(() => {});
  } catch (err) {
    console.debug("[CleanUp] Legacy cleanup skipped:", err.message);
  }
}

app.on("ready", async () => {
  await checkAdmin();
  // Ensure system is in a clean state on startup
  await forceCleanupTunnels();
  try {
    await adblockTools.safeResetDNS();
    if (process.platform === 'win32') {
      await execAsync("ipconfig /flushdns").catch(() => {});
    }
  } catch {
    console.debug("[Startup] DNS cleanup skipped.");
  }
  loadStats();
  createWindow();
});

app.on("before-quit", async (e) => {
  if (state.isQuitting) return;
  e.preventDefault();
  state.isQuitting = true;
  
  console.log("[CleanUp] Shutdown sequence initiated...");
  
  try {
    // Attempt graceful VPN stop
    if (state.activeVpnFile) {
      console.log("[CleanUp] Stopping active VPN...");
      await Promise.race([
        handleVpnToggle(null),
        new Promise(r => setTimeout(r, 5000))
      ]);
    }
    
    // Attempt deprovisioning
    if (state.deprovisionAll) {
      console.log("[CleanUp] Deprovisioning regional spokes...");
      await Promise.race([
        state.deprovisionAll(),
        new Promise(r => setTimeout(r, 10000))
      ]);
    }

    // Restore System DNS
    await adblockTools.safeResetDNS();
    
    // Nuclear option for Windows: forcefully uninstall any leftover PS services
    await forceCleanupTunnels();
    
    console.log("[CleanUp] System restored. Exiting.");
  } catch (err) {
    console.error("[CleanUp] Fatal error during shutdown:", err.message);
  } finally {
    // Ensure the process actually dies
    setTimeout(() => app.exit(0), 1000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
