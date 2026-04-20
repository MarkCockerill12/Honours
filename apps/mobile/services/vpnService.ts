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
import { getOrCreateIdentity, registerPeer, type WgIdentity } from "@privacy-shield/core/src/shared/vpn_keys";
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

async function getIdentity(): Promise<WgIdentity> {
  return getOrCreateIdentity(
    () => SecureStore.getItemAsync("wg_identity"),
    (val) => SecureStore.setItemAsync("wg_identity", val)
  );
}

export async function provisionServer(serverId: string): Promise<{ ip: string } | null> {
  const region = SERVER_REGION_MAP[serverId];
  if (!region) {
    notify("ERROR", `Unknown server: ${serverId}`);
    return null;
  }

  try {
    notify("STARTING", "Powering on secure server...");
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

    notify("WAITING_IP", "Acquiring secure IP...");
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
      notify("WAITING_IP", "Waiting for services to initialize...");
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

    const provision = await provisionServer(serverId);
    if (!provision) return false;

    const identity = await getIdentity();
    notify("REGISTERING", "Registering peer identity...");
    const regResult = await registerPeer(provision.ip, identity.publicKey);
    const clientIp = regResult.success && regResult.ip ? regResult.ip : "172.16.10.2";

    const spokePublicKey = decodeKey(extra[`wg${serverId.charAt(0).toUpperCase() + serverId.slice(1)}PublicKey`] || "");

    notify("CONNECTING", "Establishing WireGuard tunnel...");
    const dns = useAdGuard ? ["94.140.14.14", "94.140.15.15"] : ["1.1.1.1", "8.8.8.8"];

    await WireGuardVpn.connect({
      privateKey: identity.privateKey,
      publicKey: spokePublicKey,
      endpoint: `${provision.ip}:443`,
      address: `${clientIp}/32`,
      allowedIPs: ["0.0.0.0/0", "::/0"],
      dns,
      mtu: 1280,
      persistentKeepalive: 25,
    });

    notify("VERIFYING", "Verifying connection...");
    await new Promise((r) => setTimeout(r, 3000));

    const status = await WireGuardVpn.getStatus();
    if (status?.tunnelState === "UP" || status?.tunnelState === "ACTIVE") {
      notify("CONNECTED", "Protection active");
      return true;
    }

    notify("CONNECTED", "Connected (verifying...)");
    return true;
  } catch (err: any) {
    notify("ERROR", err.message);
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
