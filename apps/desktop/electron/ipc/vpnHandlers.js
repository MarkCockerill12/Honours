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

const EC2_TAG_NAMES = {
  us: "VPN-US",
  uk: "VPN-UK",
  de: "VPN-Germany",
  jp: "VPN-Japan",
  au: "VPN-Sydney",
};

const WG_PUBLIC_KEYS = {
  us: process.env.WG_US_PUBLIC_KEY || "",
  uk: process.env.WG_UK_PUBLIC_KEY || "",
  de: process.env.WG_DE_PUBLIC_KEY || "",
  jp: process.env.WG_JP_PUBLIC_KEY || "",
  au: process.env.WG_AU_PUBLIC_KEY || "",
};

const ec2Clients = {};
function getEC2Client(region) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID || "";
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY || "";
  
  if (!accessKey || !secretKey) {
    console.error(`[AWS Diagnostics] ❌ Missing credentials for client in ${region}.`);
  } else {
    const akMasked = `${accessKey.slice(0, 4)}...${accessKey.slice(-4)}`;
    const skMasked = `${secretKey.slice(0, 2)}...${secretKey.slice(-2)}`;
    console.log(`[AWS Diagnostics] Initializing client for ${region} with:`);
    console.log(`  AccessKey: ${akMasked} (Length: ${accessKey.length})`);
    console.log(`  SecretKey: ${skMasked} (Length: ${secretKey.length})`);
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
    Filters: [{ Name: "tag:Name", Values: [tagName] }],
  }));
  return result.Reservations?.[0]?.Instances?.[0];
}

const MAIN_HUB_TAG = "AwesomeVPN";
const HUB_REGION = "us-east-1"; 
const HUB_PUBLIC_KEY = process.env.WG_HUB_PUBLIC_KEY || "";

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

      if (spokeInstance.State?.Name !== "running") {
        console.log(`[VPN Provision] Starting Spoke instance: ${spokeInstance.InstanceId}`);
        await spokeClient.send(new StartInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
      }

      // 2. (Optional) Start Hub as orchestrator — non-blocking
      const hubClient = getEC2Client(HUB_REGION);
      const hubInstance = await findInstanceByTag(hubClient, MAIN_HUB_TAG).catch(() => null);
      if (hubInstance && hubInstance.State?.Name !== "running") {
        console.log(`[VPN Provision] Starting Hub orchestrator: ${hubInstance.InstanceId}`);
        hubClient.send(new StartInstancesCommand({ InstanceIds: [hubInstance.InstanceId] })).catch(
          err => console.warn(`[VPN Provision] Hub start failed (non-critical): ${err.message}`)
        );
      }

      // 3. Wait for Spoke IP
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

      // 4. Disable SourceDestCheck & Set Lifecycle Timer for Spoke
      await spokeClient.send(new ModifyInstanceAttributeCommand({
        InstanceId: spokeInstance.InstanceId,
        SourceDestCheck: { Value: false }
      })).catch(err => console.warn(`[VPN Provision] Warning: Failed to disable SourceDestCheck: ${err.message}`));

      if (shutdownTimers[spokeInstance.InstanceId]) clearTimeout(shutdownTimers[spokeInstance.InstanceId]);
      shutdownTimers[spokeInstance.InstanceId] = setTimeout(async () => {
        console.log(`[Lifecycle] ⏰ Shutting down idle spoke: ${spokeInstance.InstanceId}`);
        await spokeClient.send(new StopInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] })).catch(console.error);
        delete shutdownTimers[spokeInstance.InstanceId];
      }, 30 * 60 * 1000); // 30 minutes

      // 5. Build Config — Connect DIRECTLY to Spoke
      const config = { 
        Id: serverId, 
        PublicIp: spokeIp,             // Client connects to SPOKE directly
        PublicKey: spokePublicKey,      // Use the spoke's public key for handshake
        Port: 443, 
        MTU: 1200 
      };
      
      return { success: true, config };
    } catch (err) {
      console.error(`[VPN Provision] ❌ Fatal error in ${serverId}: ${err.message}`);
      console.error(`[VPN Provision] Full error stack:`, err.stack);
      return { success: false, error: err.message };
    }
  });

  // IPC: VPN Deprovision
  ipcMain.handle("vpn:deprovision", async (_event, serverId) => {
    console.log(`[VPN Deprovision] Tearing down region: ${serverId}`);
    try {
      const region = SERVER_REGION_MAP[serverId];
      if (!region) return { success: false, error: "Invalid serverId" };

      const client = getEC2Client(region);
      const tagName = EC2_TAG_NAMES[serverId];
      const existing = await findInstanceByTag(client, tagName);
      if (existing?.InstanceId) {
        await client.send(new StopInstancesCommand({ InstanceIds: [existing.InstanceId] }));
        console.log(`[VPN Deprovision] ✅ Spoke ${existing.InstanceId} stopping.`);
      }
      
      // Optionally stop Hub if no other spokes are active? 
      // For now, keep Hub running or let it timeout.
      
      return { success: true, message: "Server shutting down." };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

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
