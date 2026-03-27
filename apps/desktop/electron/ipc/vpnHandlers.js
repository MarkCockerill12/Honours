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
  us: "IUu0LjkWt3/C63v74f0FXi8FTMowDAe2Vxa01v90SmE=",
  uk: "saAonkWpEUg5jMGIu4bTsmAd/+h8+dG5R+IlwzV+n1Q=",
  de: "CxLUtihiFIuwZk5f/aMfbUAKua1KdGe9Wbj9gJTiIxA=",
  jp: "oi7o2tSdayG36iXdOpC1euaTczVnPKosT/V9r4Ioy0s=",
  au: "VSE/OJ4XyjBsa/nedLRdo8ZMP0jnAoKzg5aOpmnrDhs=",
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

const shutdownTimers = {};

function setupVpnHandlers(state, handleVpnToggle) {
  // IPC: VPN Provision
  ipcMain.handle("vpn:provision", async (_event, serverId) => {
    console.log(`[VPN Provision] Requested server: ${serverId}`);
    try {
      const region = SERVER_REGION_MAP[serverId];
      if (!region) return { success: false, error: `Unknown server: ${serverId}` };

      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return { success: false, error: "AWS credentials not configured." };
      }

      const client = getEC2Client(region);
      const tagName = EC2_TAG_NAMES[serverId];
      const existing = await findInstanceByTag(client, tagName);
      const instanceId = existing?.InstanceId;

      if (!instanceId) return { success: false, error: `Instance "${tagName}" not found in ${region}` };

      if (existing?.State?.Name === "running" && existing.PublicIpAddress) {
        return {
          success: true,
          config: { Id: serverId, PublicIp: existing.PublicIpAddress, PublicKey: WG_PUBLIC_KEYS[serverId], Port: 51820, MTU: 1280 },
        };
      }

      await client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
      await client.send(new ModifyInstanceAttributeCommand({
        InstanceId: instanceId,
        SourceDestCheck: { Value: false }
      })).catch(err => console.warn(`[VPN Provision] Warning: Failed to disable SourceDestCheck: ${err.message}`));

      let publicIp = "";
      for (let i = 0; i < 30; i++) {
        const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
        const inst = desc.Reservations?.[0]?.Instances?.[0];
        if (inst?.State?.Name === "running" && inst?.PublicIpAddress) {
          publicIp = inst.PublicIpAddress;
          break;
        }
        await new Promise(r => setTimeout(r, 10000));
      }

      if (!publicIp) return { success: false, error: "Timed out waiting for IP allocation." };

      if (shutdownTimers[instanceId]) clearTimeout(shutdownTimers[instanceId]);
      shutdownTimers[instanceId] = setTimeout(async () => {
        await client.send(new StopInstancesCommand({ InstanceIds: [instanceId] })).catch(console.error);
        delete shutdownTimers[instanceId];
      }, 60 * 60 * 1000);

      const config = { Id: serverId, PublicIp: publicIp, PublicKey: WG_PUBLIC_KEYS[serverId], Port: 51820, MTU: 1280 };
      return { success: true, config };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // IPC: VPN Deprovision
  ipcMain.handle("vpn:deprovision", async (_event, serverId) => {
    try {
      const region = SERVER_REGION_MAP[serverId];
      if (!region) return { success: false, error: "Invalid serverId" };

      const client = getEC2Client(region);
      const tagName = EC2_TAG_NAMES[serverId];
      const existing = await findInstanceByTag(client, tagName);
      if (!existing?.InstanceId) return { success: false, error: "Instance not found" };

      await client.send(new StopInstancesCommand({ InstanceIds: [existing.InstanceId] }));
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
    return await handleVpnToggle(config);
  });
}

module.exports = { setupVpnHandlers, SERVER_REGION_MAP, EC2_TAG_NAMES, WG_PUBLIC_KEYS, getEC2Client, findInstanceByTag, shutdownTimers };
