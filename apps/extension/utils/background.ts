import "./dom-polyfill";
import { scanUrl, checkSafeBrowsing } from "./security";
import type { ProtectionState } from "@privacy-shield/core/shared";
import {
  setupDeclarativeNetRequestRules,
  isAdOrTracker,
  recordBlockedRequest,
  initBlockStats,
  clearDeclarativeNetRequestRules,
  getExceptionList,
  addException,
  removeException,
} from "./adBlockEngine";
import { isPdfUrl, hasBypassParam, VPN_SERVERS } from "@privacy-shield/core/shared";
import { DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@privacy-shield/core/shared";
import { 
  EC2Client, 
  StartInstancesCommand, 
  DescribeInstancesCommand, 
  ModifyInstanceAttributeCommand,
  AuthorizeSecurityGroupIngressCommand 
} from "@aws-sdk/client-ec2";

// Firefox polyfill for proxy.settings
// @ts-expect-error browser object may not exist in Chrome
const browserProxy = typeof browser !== 'undefined' && browser.proxy ? browser.proxy : (typeof chrome !== 'undefined' && chrome.proxy ? chrome.proxy : null);

let adBlockEnabled = false;
let protectionEnabled = false;
let vpnEnabled = false;
let isProvisioning = false;
let currentProxyIp: string | null = null;

const BUILD_VERSION = "1.2.0-ULTIMATE";
console.log(`[Background] Initializing Privacy Sentinel v${BUILD_VERSION}`);

// Notify UI of VPN status
async function notifyVpnStatus(stage: string, message: string) {
  console.log(`[Background] VPN Status: ${stage} - ${message}`);
  await chrome.storage.local.set({ 
    vpnLoadingState: { stage, message, timestamp: Date.now(), version: BUILD_VERSION } 
  });
}

let isSyncing = false;
let lastError: { message: string; timestamp: number } | null = null;
const allowedPdfs = new Map<number, Set<string>>();

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

const SHIELD_MASK = "B4ST10N_PR0T0C0L";
const PREFIX = "SHIELD:";

function decode(obfuscated: string): string {
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

const ec2Clients: Record<string, EC2Client> = {};
function getEC2Client(region: string) {
  if (!ec2Clients[region]) {
    ec2Clients[region] = new EC2Client({
      region,
      credentials: {
        accessKeyId: decode(process.env.AWS_ACCESS_KEY_ID || ""),
        secretAccessKey: decode(process.env.AWS_SECRET_ACCESS_KEY || ""),
      },
    });
  }
  return ec2Clients[region];
}

async function findInstanceByTag(client: EC2Client, tagName: string) {
  const result = await client.send(new DescribeInstancesCommand({
    Filters: [
      { Name: "tag:Name", Values: [tagName] },
      { Name: "instance-state-name", Values: ["pending", "running", "stopping", "stopped"] }
    ],
  }));
  const instances = result.Reservations?.flatMap(r => r.Instances || []) || [];
  return instances.find(i => i.State?.Name === "running" || i.State?.Name === "pending") || instances[0];
}

async function verifyConnectivity(): Promise<boolean> {
  console.log("[Background] [Probe] Testing SOCKS5 proxy connectivity...");
  const endpoints = [
    "https://www.cloudflare.com/cdn-cgi/trace",
    "https://detectportal.firefox.com/canonical.html"
  ];

  let successCount = 0;
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, {
        signal: controller.signal,
        cache: "no-store"
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        console.log(`[Background] [Probe] ${url} -> OK (${resp.status})`);
        successCount++;
      }
    } catch (err: any) {
      console.warn(`[Background] [Probe] ${url} -> FAIL: ${err.message}`);
    }
  }

  const isValid = successCount >= 2;
  console.log(`[Background] [Probe] Result: ${successCount}/2 endpoints reachable. Status: ${isValid ? "PASS" : "FAIL"}`);
  return isValid;
}

const syncState = async (forceProxyApply: boolean = false) => {
  if (isSyncing && !forceProxyApply) return;
  const wasAlreadySyncing = isSyncing;
  if (!forceProxyApply) isSyncing = true;

  try {
    const res = await chrome.storage.local.get(["protectionState", "vpnConfig", "selectedServerId"]);
    const state = res.protectionState as ProtectionState | undefined;
    const vpnConfig = res.vpnConfig as { PublicIp?: string; publicIp?: string } | undefined;
    const selectedId = res.selectedServerId as string | undefined;

    protectionEnabled = state?.isActive ?? false;

    // 1. AdBlock Logic
    const shouldBeAdBlockEnabled = protectionEnabled && (state?.adblockEnabled ?? false);
    
    // 2. VPN Logic
    const shouldBeVpnEnabled = protectionEnabled && (state?.vpnEnabled ?? false);
    const server = VPN_SERVERS.find(s => s.id === (selectedId || "us"));
    const targetIp = vpnConfig?.PublicIp || vpnConfig?.publicIp || (server?.ip !== "" ? server?.ip : undefined);

    if (shouldBeAdBlockEnabled !== adBlockEnabled) {
      adBlockEnabled = shouldBeAdBlockEnabled;
      if (adBlockEnabled) {
        await setupDeclarativeNetRequestRules();
      } else {
        await clearDeclarativeNetRequestRules();
      }
    }

    if (isProvisioning && !forceProxyApply) return;

    if (shouldBeVpnEnabled && !targetIp) {
      console.warn("[Background] VPN should be enabled but targetIp is NONE. Provisioning automatically...");
      handleVpnProvisioning(selectedId || "us").catch(e => console.error("[Background] Auto-provision failed", e));
      return; 
    }

    const needsProxyUpdate = (shouldBeVpnEnabled !== vpnEnabled) || (shouldBeVpnEnabled && targetIp !== currentProxyIp) || forceProxyApply;

    if (needsProxyUpdate && browserProxy) {
      vpnEnabled = shouldBeVpnEnabled;
      currentProxyIp = targetIp || null;

      if (vpnEnabled && currentProxyIp) {
        console.log(`[Background] Applying Force-Shield Proxy for IP: ${currentProxyIp}`);
        
        const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('firefox');
        
        if (isFirefox) {
          // Firefox Mode: Use browser.proxy.settings with a PAC data URL
          const pacData = `
            function FindProxyForURL(url, host) {
              if (isPlainHostName(host) || host === "localhost" || host === "127.0.0.1" || 
                  shExpMatch(host, "*.local") || shExpMatch(host, "*.amazonaws.com") || host === "api.groq.com") {
                return "DIRECT";
              }
              return "SOCKS5 ${currentProxyIp}:1080; DIRECT";
            }
          `.trim();
          
          await browserProxy.settings.set({
            value: {
              proxyType: "manual", // Firefox specific
              autoConfigUrl: "data:application/x-ns-proxy-autoconfig;base64," + btoa(pacData)
            }
          });
          console.log("[Background] Firefox PAC Applied.");
        } else {
          // Chrome/Chromium Mode
          const pacData = `
            function FindProxyForURL(url, host) {
              var proxyIp = "${currentProxyIp}";
              if (isPlainHostName(host) || host === "localhost" || host === "127.0.0.1" || 
                  host === proxyIp || shExpMatch(host, "*.local") || shExpMatch(host, "*.amazonaws.com") || host === "api.groq.com") {
                return "DIRECT";
              }
              return "SOCKS5 172.16.10.1:1080; SOCKS5 " + proxyIp + ":1080; DIRECT";
            }
          `.trim();

          await new Promise<void>((resolve) => {
            browserProxy.settings.set({ 
              value: { mode: "pac_script", pacScript: { data: pacData } }, 
              scope: "regular" 
            }, () => {
              console.log("[Background] Chrome Hybrid PAC Applied.");
              setTimeout(resolve, 1500);
            });
          });
        }
      } else {
        console.log("[Background] Reverting to DIRECT connection.");
        await new Promise<void>((resolve) => {
          browserProxy.settings.clear({ scope: "regular" }, () => {
            if (typeof resolve === 'function') resolve();
          });
        });
      }
    }
  } catch (e) {
    console.error("[Background] Sync failed:", e);
  } finally {
    if (!wasAlreadySyncing) isSyncing = false;
  }
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") syncState();
});

const injectContentScripts = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: false },
          files: ["content-script.js"],
        });
      } catch {
        // Tab may be restricted or closed
      }
    }
  } catch {
    // Extension context may be invalid
  }
};

const initializeBackground = async () => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      if (browserProxy?.onProxyError) {
        browserProxy.onProxyError.addListener((details: any) => {
          if (!isProvisioning) console.error("[Background] Proxy Error:", details);
        });
      }
      await syncState();
      await injectContentScripts();
    }
  } catch (e) {
    console.error("[Background] Initialization failed:", e);
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const res = await chrome.storage.local.get(["protectionState", "filters"]);
    if (!res.protectionState) await chrome.storage.local.set({ protectionState: DEFAULT_PROTECTION_STATE });
    if (!res.filters) await chrome.storage.local.set({ filters: DEFAULT_FILTERS });
    await initBlockStats();
    await syncState();
  } catch {
    console.error("[Background] Failed to initialize on install");
  }
});

initializeBackground();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!protectionEnabled || !adBlockEnabled) return;
  if (changeInfo.status === "loading" && tab.url) {
    if (isPdfUrl(tab.url) && !hasBypassParam(tab.url)) {
      const warningUrl = chrome.runtime.getURL(`pdf-warning.html?url=${encodeURIComponent(tab.url)}`);
      chrome.tabs.update(tabId, { url: warningUrl });
    }
  }
});

async function handleVpnProvisioning(serverId: string) {
  if (isProvisioning) return { success: true }; 
  isProvisioning = true;
  try {
    await notifyVpnStatus("STARTING", "Initializing AWS instance...");
    const region = SERVER_REGION_MAP[serverId];
    const client = getEC2Client(region);
    const tagName = EC2_TAG_NAMES[serverId];
    const instance = await findInstanceByTag(client, tagName);
    
    const wasStopped = instance.State?.Name !== "running";
    if (wasStopped) {
      await notifyVpnStatus("STARTING", "Powering on secure server...");
      await client.send(new StartInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
    }

    let ip = "";
    for (let i = 0; i < 30; i++) {
      const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
      const s = desc.Reservations?.[0]?.Instances?.[0];
      if (s?.State?.Name === "running" && s?.PublicIpAddress) {
        ip = s.PublicIpAddress;
        break;
      }
      await notifyVpnStatus("WAITING_IP", `Acquiring secure IP... (${i+1}/30)`);
      await new Promise(r => setTimeout(r, 3000));
    }

    if (!ip) throw new Error("Server failed to assign an IP.");

    if (instance.SecurityGroups && instance.SecurityGroups.length > 0) {
      try {
        await client.send(new AuthorizeSecurityGroupIngressCommand({
          GroupId: instance.SecurityGroups[0].GroupId,
          IpPermissions: [{
            IpProtocol: "tcp",
            FromPort: 1080,
            ToPort: 1080,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }]
          }]
        }));
        console.log("[Background] Port 1080 opened successfully for Proxy access.");
      } catch (e: any) {
        if (!e.message?.includes("already exists") && !e.name?.includes("Duplicate")) {
          console.warn("[Background] Could not guarantee Port 1080 is open:", e);
        }
      }
    }

    if (wasStopped) {
      await notifyVpnStatus("CONFIGURING", "Initializing WARP egress tunnel...");
      await new Promise(r => setTimeout(r, 40000));
    }

    await notifyVpnStatus("VERIFYING", "Configuring SOCKS5 proxy...");
    await chrome.storage.local.set({ vpnConfig: { PublicIp: ip, Id: serverId } });
    await syncState(true);
    
    const isFunctional = await verifyConnectivity();
    if (!isFunctional) throw new Error("Tunnel ready but integrity probe failed.");

    await notifyVpnStatus("READY", "Protection fully active!");
    isProvisioning = false;
    await syncState();
    return { success: true };
  } catch (err: any) {
    isProvisioning = false;
    if (browserProxy) browserProxy.settings.clear({ scope: "regular" });
    await notifyVpnStatus("ERROR", err.message);
    return { success: false, error: err.message };
  }
}

async function handleOtherActions(request: any) {
  switch (request.action) {
    case "PROVISION_VPN": return await handleVpnProvisioning(request.serverId);
    case "GET_BLOCK_STATS": return { success: true, stats: await initBlockStats() };
    case "TOGGLE_ADBLOCK": await syncState(); return { success: true, enabled: adBlockEnabled };
    case "SET_VPN_CONFIG": await chrome.storage.local.set({ vpnConfig: request.config }); await syncState(); return { success: true };
    case "CHECK_URL_REAL": return scanUrl(request.url);
    default: return { success: false, error: "Unknown action" };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ADBLOCK_STATUS") {
    sendResponse({ success: true, enabled: adBlockEnabled });
    return true;
  }
  handleOtherActions(request).then(sendResponse);
  return true;
});

console.log("[Background] Background initialized.");
