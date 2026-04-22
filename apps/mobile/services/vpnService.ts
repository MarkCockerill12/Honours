import WireGuardVpn from "react-native-wireguard-vpn";
import {
  EC2Client,
  StartInstancesCommand,
  DescribeInstancesCommand,
  ModifyInstanceAttributeCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { decodeKey } from "@privacy-shield/core/src/shared/utils/security";
import { VPN_SERVERS } from "@privacy-shield/core/src/shared";

const extra = Constants.expoConfig?.extra ?? {};

const SERVER_REGION_MAP: Record<string, string> = {
  us: "us-east-1",
  uk: "eu-west-2",
  de: "eu-central-1",
  jp: "ap-northeast-1",
  au: "ap-southeast-2",
};

const EC2_TAG_NAMES: Record<string, string> = {
  us: "VPN-US",
  uk: "VPN-UK",
  de: "VPN-Germany",
  jp: "VPN-Japan",
  au: "VPN-Sydney",
};

const ec2Clients: Record<string, EC2Client> = {};

function getEC2Client(region: string): EC2Client {
  if (!ec2Clients[region]) {
    ec2Clients[region] = new EC2Client({
      region,
      credentials: {
        accessKeyId: decodeKey(extra.awsAccessKeyId || ""),
        secretAccessKey: decodeKey(extra.awsSecretAccessKey || ""),
      },
    });
  }
  return ec2Clients[region];
}

async function findInstanceByTag(client: EC2Client, tagName: string) {
  const result = await client.send(
    new DescribeInstancesCommand({
      Filters: [
        { Name: "tag:Name", Values: [tagName] },
        { Name: "instance-state-name", Values: ["pending", "running", "stopping", "stopped"] },
      ],
    })
  );
  const instances = result.Reservations?.flatMap((r) => r.Instances || []) || [];
  return instances.find((i) => i.State?.Name === "running" || i.State?.Name === "pending") || instances[0];
}

export type VpnStage = "IDLE" | "STARTING" | "WAITING_IP" | "REGISTERING" | "CONNECTING" | "VERIFYING" | "CONNECTED" | "ERROR";

export interface VpnStatusUpdate {
  stage: VpnStage;
  message: string;
}

let _onStatus: ((update: VpnStatusUpdate) => void) | null = null;

export function setStatusCallback(cb: (update: VpnStatusUpdate) => void) {
  _onStatus = cb;
}

function notify(stage: VpnStage, message: string) {
  _onStatus?.({ stage, message });
}

export async function provisionServer(serverId: string): Promise<{ ip: string } | null> {
  const region = SERVER_REGION_MAP[serverId];
  if (!region) {
    notify("ERROR", `Unknown server: ${serverId}`);
    return null;
  }

  try {
    notify("STARTING", "Locating your server...");
    const client = getEC2Client(region);
    const tagName = EC2_TAG_NAMES[serverId];
    const instance = await findInstanceByTag(client, tagName);

    if (!instance) {
      notify("ERROR", `Server ${serverId} not found`);
      return null;
    }

    const wasStopped = instance.State?.Name !== "running";
    if (wasStopped) {
      await client.send(new StartInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
    }

    notify("WAITING_IP", "Server coming online...");
    let ip = "";
    for (let i = 0; i < 30; i++) {
      const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
      const s = desc.Reservations?.[0]?.Instances?.[0];
      if (s?.State?.Name === "running" && s?.PublicIpAddress) {
        ip = s.PublicIpAddress;
        break;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (!ip) {
      notify("ERROR", "Server failed to assign an IP");
      return null;
    }

    if (wasStopped) {
      notify("WAITING_IP", "Warming up secure tunnel...");
      await new Promise((r) => setTimeout(r, 30000));
    }

    await client.send(
      new ModifyInstanceAttributeCommand({
        InstanceId: instance.InstanceId,
        SourceDestCheck: { Value: false },
      })
    ).catch(() => {});

    return { ip };
  } catch (err: any) {
    notify("ERROR", err.message);
    return null;
  }
}

export async function connectVpn(serverId: string, useAdGuard: boolean = true): Promise<boolean> {
  try {
    const server = VPN_SERVERS.find((s) => s.id === serverId);
    if (!server) {
      notify("ERROR", "Unknown server");
      return false;
    }

    const clientPrivateKey = decodeKey(extra.wgClientPrivateKey || "");
    if (!clientPrivateKey) {
      notify("ERROR", "WireGuard client key not configured in app.config.js");
      return false;
    }

    const spokePublicKey = decodeKey(extra.wgServerPublicKey || "");
    if (!spokePublicKey) {
      notify("ERROR", "Server public key not configured in app.config.js");
      return false;
    }

    // Validate keys look like base64 WireGuard keys (44 chars)
    if (clientPrivateKey.length < 40 || spokePublicKey.length < 40) {
      notify("ERROR", `Key decode failed — check WG_CLIENT_PRIVATE_KEY and WG_US_PUBLIC_KEY in .env.local`);
      console.error("[VPN] Key lengths:", clientPrivateKey.length, spokePublicKey.length);
      return false;
    }

    // Tear down any stale tunnel before provisioning so the backend starts clean
    try {
      await WireGuardVpn.disconnect();
    } catch {
      // Ignore — nothing was connected
    }

    const provision = await provisionServer(serverId);
    if (!provision) return false;

    const clientIp = extra.wgClientAddress || "172.16.10.2";
    const dns = useAdGuard ? ["94.140.14.14", "94.140.15.15"] : ["1.1.1.1", "8.8.8.8"];

    notify("CONNECTING", "Establishing secure tunnel...");

    // Fresh initialize every connect — GoBackend holds context that must be reset
    await WireGuardVpn.initialize();

    const wgConfig = {
      privateKey: clientPrivateKey,
      publicKey: spokePublicKey,
      serverAddress: provision.ip,
      serverPort: 443,
      address: clientIp + "/32",
      allowedIPs: ["0.0.0.0/0"],
      dns,
      mtu: 1420,
    };

    console.log("[VPN] Connecting to", provision.ip, "with client IP", clientIp);

    // connect() is synchronous at the native level — it blocks until UP or throws
    await WireGuardVpn.connect(wgConfig);

    notify("CONNECTED", "You're protected!");
    return true;
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    console.error("[VPN] Connection error:", msg);
    notify("ERROR", msg.length > 120 ? msg.substring(0, 120) + "…" : msg);
    return false;
  }
}

export async function disconnectVpn(): Promise<void> {
  try {
    await WireGuardVpn.disconnect();
    notify("IDLE", "Disconnected");
  } catch (err: any) {
    console.warn("[VPN] Disconnect error:", err.message);
    notify("IDLE", "Disconnected");
  }
}

export async function getVpnStatus() {
  try {
    return await WireGuardVpn.getStatus();
  } catch {
    return null;
  }
}

export async function deprovisionServer(serverId: string): Promise<void> {
  const region = SERVER_REGION_MAP[serverId];
  if (!region) return;
  try {
    const client = getEC2Client(region);
    const instance = await findInstanceByTag(client, EC2_TAG_NAMES[serverId]);
    if (instance?.InstanceId) {
      await client.send(new StopInstancesCommand({ InstanceIds: [instance.InstanceId] }));
    }
  } catch (err: any) {
    console.warn("[VPN] Deprovision error:", err.message);
  }
}
