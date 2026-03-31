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
  if (!ec2Clients[region]) {
    ec2Clients[region] = new EC2Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
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
  // IPC: VPN Provision
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

      // 1. Provision Main Hub (AwesomeVPN)
      console.log(`[VPN Provision] Orchestrating Hub: ${MAIN_HUB_TAG} in ${HUB_REGION}`);
      const hubClient = getEC2Client(HUB_REGION);
      const hubInstance = await findInstanceByTag(hubClient, MAIN_HUB_TAG);
      if (!hubInstance) {
        console.error(`[VPN Provision] ❌ Hub instance "${MAIN_HUB_TAG}" not found!`);
        return { success: false, error: "Hub management failed." };
      }

      if (hubInstance.State?.Name !== "running") {
        console.log(`[VPN Provision] Starting Hub instance: ${hubInstance.InstanceId}`);
        await hubClient.send(new StartInstancesCommand({ InstanceIds: [hubInstance.InstanceId] }));
      }
      
      // 2. Provision Spoke (Regional Server)
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

      // 3. Wait for IPs (Hub and Spoke)
      console.log(`[VPN Provision] Waiting for Hub/Spoke IP allocation...`);
      let hubIp = "", spokeIp = "";
      for (let i = 0; i < 30; i++) {
        const hubDesc = await hubClient.send(new DescribeInstancesCommand({ InstanceIds: [hubInstance.InstanceId] }));
        const spokeDesc = await spokeClient.send(new DescribeInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
        
        const h = hubDesc.Reservations?.[0]?.Instances?.[0];
        const s = spokeDesc.Reservations?.[0]?.Instances?.[0];

        if (h?.State?.Name === "running" && h?.PublicIpAddress) hubIp = h.PublicIpAddress;
        if (s?.State?.Name === "running" && s?.PublicIpAddress) spokeIp = s.PublicIpAddress;

        if (hubIp && spokeIp) break;
        console.log(`[VPN Provision] Waiting... attempt ${i+1}/30`);
        await new Promise(r => setTimeout(r, 5000));
      }

      if (!hubIp || !spokeIp) {
        console.error(`[VPN Provision] ❌ IP Timeout. Hub: ${hubIp}, Spoke: ${spokeIp}`);
        return { success: false, error: "Timed out waiting for server ready state." };
      }

      console.log(`[VPN Provision] ✅ Ready! Hub: ${hubIp}, Spoke: ${spokeIp}`);

      // 4. Set Lifecycle Timers (30 minutes) & Disable SourceDestCheck
      for (const inst of [hubInstance, spokeInstance]) {
        const id = inst.InstanceId;
        const client = inst === hubInstance ? hubClient : spokeClient;
        
        // Disable SourceDestCheck (Essential for VPN NAT/Routing)
        await client.send(new ModifyInstanceAttributeCommand({
          InstanceId: id,
          SourceDestCheck: { Value: false }
        })).catch(err => console.warn(`[VPN Provision] Warning: Failed to disable SourceDestCheck on ${id}: ${err.message}`));

        if (shutdownTimers[id]) clearTimeout(shutdownTimers[id]);
        shutdownTimers[id] = setTimeout(async () => {
          console.log(`[Lifecycle] ⏰ Shutting down idle instance: ${id}`);
          await client.send(new StopInstancesCommand({ InstanceIds: [id] })).catch(console.error);
          delete shutdownTimers[id];
        }, 30 * 60 * 1000); // 30 minutes
      }

      // 5. Build Config (Connect to HUB)
      const config = { 
        Id: serverId, 
        PublicIp: hubIp, // Client connects to HUB
        PublicKey: HUB_PUBLIC_KEY, // Use the Hub's public key for the handshake
        Port: 51820, 
        MTU: 1280 
      };
      
      return { success: true, config };
    } catch (err) {
      console.error(`[VPN Provision] ❌ Fatal error: ${err.message}`);
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
