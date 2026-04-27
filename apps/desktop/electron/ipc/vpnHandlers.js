const { ipcMain, BrowserWindow } = require("electron");
const { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstancesCommand } = require("@aws-sdk/client-ec2");

// VPN Configuration
const SERVER_REGION_MAP = {
  us: "us-east-1",
  uk: "eu-west-2",
  de: "eu-central-1",
  jp: "ap-northeast-1",
  au: "ap-southeast-2",
};

// All clients use 172.16.10.2 — within server's NAT range (172.16.10.0/24)
const SERVER_SUBNET_MAP = {
  us: "172.16.10",
  uk: "172.16.10",
  de: "172.16.10",
  jp: "172.16.10",
  au: "172.16.10",
};

const EC2_TAG_NAMES = {
  us: "VPN-US",
  uk: "VPN-UK",
  de: "VPN-Germany",
  jp: "VPN-Japan",
  au: "VPN-Sydney",
};

const SHIELD_MASK = "B4ST10N_PR0T0C0L";
const PREFIX = "SHIELD:";

function decode(obfuscated) {
  if (!obfuscated) return "";
  const input = obfuscated.trim();
  if (!input.startsWith(PREFIX)) return input;
  
  const payload = input.slice(PREFIX.length);
  let result = "";
  for (let i = 0; i < payload.length; i += 2) {
    const hexPart = payload.slice(i, i + 2);
    const code = parseInt(hexPart, 16) ^ SHIELD_MASK.charCodeAt((i / 2) % SHIELD_MASK.length);
    result += String.fromCharCode(code);
  }
  return result.trim();
}

const WG_PUBLIC_KEYS = {
  us: decode(process.env.WG_US_PUBLIC_KEY) || "",
  uk: decode(process.env.WG_UK_PUBLIC_KEY) || "",
  de: decode(process.env.WG_DE_PUBLIC_KEY) || "",
  jp: decode(process.env.WG_JP_PUBLIC_KEY) || "",
  au: decode(process.env.WG_AU_PUBLIC_KEY) || "",
};

const ec2Clients = {};
function getEC2Client(region) {
  const accessKey = decode(process.env.AWS_ACCESS_KEY_ID) || "";
  const secretKey = decode(process.env.AWS_SECRET_ACCESS_KEY) || "";

  if (!accessKey || !secretKey) {
    console.error(`[AWS Diagnostics] ❌ Missing credentials for client in ${region}.`);
  } else {
    console.log(`[AWS Diagnostics] Initializing EC2 client for ${region} (Credentials OK)`);
  }

  if (!ec2Clients[region]) {
    ec2Clients[region] = new EC2Client({
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }
  return ec2Clients[region];
}

async function findInstanceByTag(client, tagName) {
  const result = await client.send(new DescribeInstancesCommand({
    Filters: [
      { Name: "tag:Name", Values: [tagName] },
      { Name: "instance-state-name", Values: ["pending", "running", "stopping", "stopped"] }
    ],
  }));
  // If multiple instances are found (e.g. during replacement), prefer the one that is NOT terminal
  const instances = result.Reservations?.flatMap(r => r.Instances) || [];
  return instances.find(i => i.State?.Name === "running" || i.State?.Name === "pending") || instances[0];
}

function sendVpnStatus(message) {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send("vpn:status", message);
  }
}

function setupVpnHandlers(state, handleVpnToggle) {
  // IPC: VPN Provision (Direct-to-Spoke Architecture)
  // Client connects DIRECTLY to the regional spoke instance, bypassing the Hub relay.
  // Hub is started only as an orchestrator (for future management), not as a VPN tunnel relay.
  ipcMain.handle("vpn:provision", async (_event, serverId) => {
    console.log(`[VPN Provision] Requested server: ${serverId}`);
    try {
      const region = SERVER_REGION_MAP[serverId];
      if (!region) {
        console.error(`[VPN Provision] ❌ Unknown serverId: ${serverId}`);
        return { success: false, error: `Unknown server: ${serverId}` };
      }

      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error(`[VPN Provision] ❌ AWS Credentials missing.`);
        return { success: false, error: "AWS credentials not configured." };
      }

      const spokePublicKey = WG_PUBLIC_KEYS[serverId];
      if (!spokePublicKey) {
        console.error(`[VPN Provision] ❌ No public key configured for spoke: ${serverId}`);
        return { success: false, error: `No WireGuard key for ${serverId}. Check .env.local.` };
      }

      // 1. Provision Spoke (Regional Server) — this is the VPN endpoint
      sendVpnStatus("Locating secure server...");
      console.log(`[VPN Provision] Orchestrating Spoke: ${serverId} in ${region}`);
      const spokeClient = getEC2Client(region);
      const spokeTagName = EC2_TAG_NAMES[serverId];
      const spokeInstance = await findInstanceByTag(spokeClient, spokeTagName);
      if (!spokeInstance) {
        console.error(`[VPN Provision] ❌ Spoke instance "${spokeTagName}" not found in ${region}`);
        return { success: false, error: `Region ${serverId} not available.` };
      }

      const stateName = spokeInstance.State?.Name;
      console.log(`[VPN Provision] Found Spoke ${spokeInstance.InstanceId} in state: ${stateName}`);

      let needsWarmup = false;
      if (stateName === "stopped") {
        sendVpnStatus("Powering up server...");
        console.log(`[VPN Provision] Starting Spoke instance: ${spokeInstance.InstanceId}`);
        await spokeClient.send(new StartInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
        needsWarmup = true;
      } else if (stateName === "stopping" || stateName === "shutting-down") {
        // Instance is mid-shutdown — wait up to 30s for it to reach stopped, then start it
        sendVpnStatus("Waiting for server to finish stopping...");
        console.log(`[VPN Provision] Spoke is ${stateName}, waiting for it to reach stopped state...`);
        let alreadyRunning = false;
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const checkDesc = await spokeClient.send(new DescribeInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
          const checkState = checkDesc.Reservations?.[0]?.Instances?.[0]?.State?.Name;
          if (checkState === "stopped") break;
          if (checkState === "running") { alreadyRunning = true; break; }
        }
        if (!alreadyRunning) {
          sendVpnStatus("Powering up server...");
          console.log(`[VPN Provision] Starting Spoke after stop...`);
          await spokeClient.send(new StartInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
          needsWarmup = true;
        }
      } else if (stateName === "pending" || stateName === "running") {
        console.log(`[VPN Provision] Spoke instance is ${stateName}, proceeding to IP check...`);
      } else {
        console.warn(`[VPN Provision] Spoke instance is in unexpected state: ${stateName}. Attempting start anyway.`);
        await spokeClient.send(new StartInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] })).catch(() => {});
        needsWarmup = true;
      }

      // 2. Wait for Spoke IP
      let spokeIp = spokeInstance.PublicIpAddress || "";
      
      if (!spokeIp || stateName !== "running") {
        sendVpnStatus("Waiting for server to come online...");
        console.log(`[VPN Provision] Waiting for Spoke IP allocation...`);
        for (let i = 0; i < 20; i++) { // Fewer retries, but faster
          const spokeDesc = await spokeClient.send(new DescribeInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
          const s = spokeDesc.Reservations?.[0]?.Instances?.[0];

          if (s?.State?.Name === "running" && s?.PublicIpAddress) {
            spokeIp = s.PublicIpAddress;
            break;
          }
          console.log(`[VPN Provision] Waiting... attempt ${i+1}/20`);
          await new Promise(r => setTimeout(r, 3000)); // 3s polling instead of 5s
        }
      }

      if (!spokeIp) {
        console.error(`[VPN Provision] ❌ IP Timeout. Spoke: ${spokeIp}`);
        return { success: false, error: "Timed out waiting for server ready state." };
      }

      // If we just started the instances, they need time for cloud-init and WireGuard to initialize
      if (needsWarmup) {
        sendVpnStatus("Warming up tunnel...");
        console.log(`[VPN Provision] ⏳ New instance detected. Waiting for server initialization...`);
        await new Promise(r => setTimeout(r, 10000)); // 10s warmup instead of 20s
      } else {
        console.log(`[VPN Provision] ✅ Server already warm. IP: ${spokeIp}`);
      }

      sendVpnStatus("Connecting...");

      // 3. (Server handles auto-shutdown)

      // 4. Build Config — Connect DIRECTLY to Spoke
      const config = {
        Id: serverId,
        PublicIp: spokeIp,             // Dynamic IP from EC2 API
        PublicKey: spokePublicKey,      // Spoke's WireGuard public key
        Port: 443,
        Subnet: SERVER_SUBNET_MAP[serverId], // 172.16.10.0/24 for all spokes
      };

      console.log(`[VPN Provision] ✅ Direct-to-Spoke Config Ready: ${serverId} @ ${spokeIp}:443`);

      return { success: true, config };
    } catch (err) {
      console.error(`[VPN Provision] ❌ Fatal error in ${serverId}: ${err.message}`);
      console.error(`[VPN Provision] Full error stack:`, err.stack);
      return { success: false, error: err.message };
    }
  });

  // IPC: VPN Deprovision
  ipcMain.handle("vpn:deprovision", async (_event, serverId) => {
    console.log(`[VPN Deprovision] Detaching from spoke: ${serverId} (relying on 30-min auto-shutdown)`);
    return { success: true, message: "Server detached." };
  });

  // Export a way to cleanly stop everything on exit
  state.deprovisionAll = async () => {
    console.log(`[VPN Cleanup] Detaching active spoke (relying on 30-min auto-shutdown)...`);
  };

  // IPC: VPN get-status
  ipcMain.handle("vpn:get-status", () => {
    return {
      active: !!state.activeVpnFile,
      serverId: state.activeVpnConfig?.Id || null,
      serverIp: state.activeVpnConfig?.PublicIp || null,
    };
  });

  ipcMain.handle("vpn:toggle", async (_event, config) => {
    console.log(`[VPN Toggle IPC] Executing toggle...`);
    return await handleVpnToggle(config);
  });
}

module.exports = { setupVpnHandlers, SERVER_REGION_MAP, EC2_TAG_NAMES, WG_PUBLIC_KEYS, getEC2Client, findInstanceByTag };
