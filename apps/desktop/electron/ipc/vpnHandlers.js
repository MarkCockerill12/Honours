const { ipcMain } = require("electron");
const { EC2Client, StartInstancesCommand, StopInstancesCommand, DescribeInstancesCommand, ModifyInstanceAttributeCommand } = require("@aws-sdk/client-ec2");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

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
    const akMasked = `${accessKey.slice(0, 4)}...${accessKey.slice(-4)}`;
    console.log(`[AWS Diagnostics] Initializing client for ${region} (Credentials Securely Loaded)`);
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

const shutdownTimers = {};

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
        console.log(`[VPN Provision] Starting Spoke instance: ${spokeInstance.InstanceId}`);
        await spokeClient.send(new StartInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
        needsWarmup = true;
      } else if (stateName === "pending" || stateName === "running") {
        console.log(`[VPN Provision] Spoke instance is ${stateName}, proceeding to IP check...`);
      } else {
        console.warn(`[VPN Provision] Spoke instance is in unexpected state: ${stateName}. This might fail.`);
      }

      // 2. Wait for Spoke IP
      console.log(`[VPN Provision] Waiting for Spoke IP allocation...`);
      let spokeIp = "";
      for (let i = 0; i < 30; i++) {
        const spokeDesc = await spokeClient.send(new DescribeInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
        const s = spokeDesc.Reservations?.[0]?.Instances?.[0];

        if (s?.State?.Name === "running" && s?.PublicIpAddress) {
          spokeIp = s.PublicIpAddress;
          break;
        }
        console.log(`[VPN Provision] Waiting... attempt ${i+1}/30`);
        await new Promise(r => setTimeout(r, 5000));
      }

      if (!spokeIp) {
        console.error(`[VPN Provision] ❌ IP Timeout. Spoke: ${spokeIp}`);
        return { success: false, error: "Timed out waiting for server ready state." };
      }

      console.log(`[VPN Provision] ✅ Spoke Ready! IP: ${spokeIp}`);

      // If we just started the instances, they need time for cloud-init and WireGuard to initialize
      if (needsWarmup) {
        console.log(`[VPN Provision] ⏳ New instance detected. Waiting 45s for WireGuard + WARP initialization...`);
        await new Promise(r => setTimeout(r, 45000));
      }

      // 3. Set Lifecycle Timer for Spoke (auto-shutdown after 30 minutes idle)
      if (shutdownTimers[spokeInstance.InstanceId]) clearTimeout(shutdownTimers[spokeInstance.InstanceId]);
      shutdownTimers[spokeInstance.InstanceId] = setTimeout(async () => {
        console.log(`[Lifecycle] ⏰ Auto-shutdown: Stopping idle spoke ${spokeInstance.InstanceId} after 30min`);
        await spokeClient.send(new StopInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] })).catch(console.error);
        delete shutdownTimers[spokeInstance.InstanceId];
      }, 30 * 60 * 1000); // 30 minutes

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
    console.log(`[VPN Deprovision] Stopping spoke: ${serverId}`);
    try {
      const region = SERVER_REGION_MAP[serverId];
      if (!region) return { success: false, error: "Invalid serverId" };

      const client = getEC2Client(region);
      const tagName = EC2_TAG_NAMES[serverId];
      const existing = await findInstanceByTag(client, tagName);
      if (existing?.InstanceId) {
        await client.send(new StopInstancesCommand({ InstanceIds: [existing.InstanceId] }));
        console.log(`[VPN Deprovision] ✅ Spoke ${existing.InstanceId} stopping.`);

        // Clear shutdown timer if exists
        if (shutdownTimers[existing.InstanceId]) {
          clearTimeout(shutdownTimers[existing.InstanceId]);
          delete shutdownTimers[existing.InstanceId];
        }
      }

      return { success: true, message: "Server stopped." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Export a way to cleanly stop everything on exit
  state.deprovisionAll = async () => {
    console.log(`[VPN Cleanup] Stopping active spoke...`);
    try {
      if (state.activeVpnConfig?.Id) {
        const region = SERVER_REGION_MAP[state.activeVpnConfig.Id];
        if (region) {
          const client = getEC2Client(region);
          const existing = await findInstanceByTag(client, EC2_TAG_NAMES[state.activeVpnConfig.Id]);
          if (existing?.InstanceId) {
            console.log(`[VPN Cleanup] Stopping ${existing.InstanceId}`);
            await client.send(new StopInstancesCommand({ InstanceIds: [existing.InstanceId] }));

            // Clear timer
            if (shutdownTimers[existing.InstanceId]) {
              clearTimeout(shutdownTimers[existing.InstanceId]);
              delete shutdownTimers[existing.InstanceId];
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[VPN Cleanup] Warning: ${e.message}`);
    }
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

module.exports = { setupVpnHandlers, SERVER_REGION_MAP, EC2_TAG_NAMES, WG_PUBLIC_KEYS, getEC2Client, findInstanceByTag, shutdownTimers };
