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
let filteringEnabled = false;
let isProvisioning = false;
let currentProxyIp: string | null = null;
let filterExclusions: string[] = [];

// TRANSLATION CACHE
const TRANSLATION_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 2000;

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
  us: "us-east-1", uk: "eu-west-2", de: "eu-central-1", jp: "ap-northeast-1", au: "ap-southeast-2",
};

const EC2_TAG_NAMES: Record<string, string> = {
  us: "VPN-US", uk: "VPN-UK", de: "VPN-Germany", jp: "VPN-Japan", au: "VPN-Sydney",
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

async function probeEndpoints(): Promise<number> {
  const endpoints = ["https://www.cloudflare.com/cdn-cgi/trace", "https://detectportal.firefox.com/canonical.html"];
  let successCount = 0;
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(url, { signal: controller.signal, cache: "no-store", mode: "no-cors" });
      clearTimeout(timeoutId);
      if (resp.ok || resp.type === 'opaque') successCount++;
    } catch { /* ignore */ }
  }
  return successCount;
}

async function verifyConnectivity(): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const successCount = await probeEndpoints();
    if (successCount >= 1) {
      try {
        const traceResp = await fetch("https://www.cloudflare.com/cdn-cgi/trace", { cache: "no-store" });
        const traceText = await traceResp.text();
        const ipMatch = traceText.match(/ip=(.+)/);
        const routedIp = ipMatch ? ipMatch[1].trim() : "unknown";
        if (routedIp === currentProxyIp) return true;
      } catch { /* ignore */ }
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

const syncState = async (forceProxyApply: boolean = false) => {
  if (isSyncing && !forceProxyApply) return;
  const wasAlreadySyncing = isSyncing;
  if (!forceProxyApply) isSyncing = true;
  try {
    const res = await chrome.storage.local.get(["protectionState", "vpnConfig", "selectedServerId", "filterDomainExclusions"]);
    const state = res.protectionState as ProtectionState | undefined;
    const vpnConfig = res.vpnConfig as { PublicIp?: string; publicIp?: string } | undefined;
    const selectedId = res.selectedServerId as string | undefined;
    filterExclusions = res.filterDomainExclusions || [];
    protectionEnabled = state?.isActive ?? false;
    filteringEnabled = state?.filteringEnabled ?? false;
    const shouldBeAdBlockEnabled = protectionEnabled && (state?.adblockEnabled ?? false);
    const shouldBeVpnEnabled = protectionEnabled && (state?.vpnEnabled ?? false);
    const server = VPN_SERVERS.find(s => s.id === (selectedId || "us"));
    const targetIp = vpnConfig?.PublicIp || vpnConfig?.publicIp || (server?.ip !== "" ? server?.ip : undefined);
    if (shouldBeAdBlockEnabled !== adBlockEnabled) {
      adBlockEnabled = shouldBeAdBlockEnabled;
      if (adBlockEnabled) await setupDeclarativeNetRequestRules(); else await clearDeclarativeNetRequestRules();
    }
    if (!protectionEnabled || !shouldBeVpnEnabled) {
      vpnEnabled = false; currentProxyIp = null; isProvisioning = false;
      if (browserProxy) { await new Promise<void>(r => browserProxy.settings.clear({ scope: "regular" }, () => r())); }
      await chrome.storage.local.remove(["vpnConfig"]).catch(() => {});
      await notifyVpnStatus("IDLE", "Disconnected.");
      return;
    }
    if (isProvisioning && !forceProxyApply) return;
    if (shouldBeVpnEnabled && !targetIp) { handleVpnProvisioning(selectedId || "us").catch(() => {}); return; }
    const needsProxyUpdate = (shouldBeVpnEnabled !== vpnEnabled) || (shouldBeVpnEnabled && targetIp !== currentProxyIp) || forceProxyApply;
    if (needsProxyUpdate && browserProxy) {
      vpnEnabled = shouldBeVpnEnabled; currentProxyIp = targetIp || null;
      if (vpnEnabled && currentProxyIp) {
        const pacData = `function FindProxyForURL(url, host) { var proxyIp = "${currentProxyIp}"; if (isPlainHostName(host) || host === "localhost" || host === "127.0.0.1" || host === proxyIp || shExpMatch(host, "*.local") || shExpMatch(host, "*.amazonaws.com") || host === "api.groq.com") return "DIRECT"; return "SOCKS5 " + proxyIp + ":1080"; }`.trim();
        await new Promise<void>((resolve) => { browserProxy.settings.set({ value: { mode: "pac_script", pacScript: { data: pacData } }, scope: "regular" }, () => { setTimeout(resolve, 1000); }); });
      }
    }
  } catch (e) { console.error("[Background] Sync failed:", e); } finally { if (!wasAlreadySyncing) isSyncing = false; }
};

chrome.storage.onChanged.addListener((changes, area) => { if (area === "local") syncState(); });

const injectContentScripts = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: false }, files: ["content-script.js"] }); } catch { }
    }
  } catch { }
};

const initializeBackground = async () => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const data = await chrome.storage.local.get(["cachedWordlists", "translation_cache"]);
      if (!data.cachedWordlists) await fetchAndCacheWordlists();
      if (data.translation_cache) Object.entries(data.translation_cache).forEach(([k, v]) => TRANSLATION_CACHE.set(k, v as string));
      await syncState();
      await injectContentScripts();
    }
  } catch (e) { console.error("[Background] Initialization failed:", e); }
};

const WORDLIST_URL = "https://raw.githubusercontent.com/awdev1/better-profane-words/main/words.json";
async function fetchAndCacheWordlists() {
  try {
    const resp = await fetch(WORDLIST_URL); if (!resp.ok) return;
    const wordsRaw = await resp.json(); const categorized: Record<string, string[]> = {};
    if (Array.isArray(wordsRaw)) { wordsRaw.forEach((entry: any) => { if (entry.word && Array.isArray(entry.categories)) { entry.categories.forEach((cat: string) => { if (!categorized[cat]) categorized[cat] = []; categorized[cat].push(entry.word.toLowerCase()); }); } }); }
    await chrome.storage.local.set({ cachedWordlists: categorized, wordlistsLastUpdated: Date.now() });
  } catch (err) { console.error("[Background] Failed to update wordlists:", err); }
}

chrome.alarms.create("update-wordlists", { periodInMinutes: 7 * 24 * 60 });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "update-wordlists") fetchAndCacheWordlists(); });

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const res = await chrome.storage.local.get(["protectionState", "filters", "cachedWordlists"]);
    if (!res.protectionState) await chrome.storage.local.set({ protectionState: DEFAULT_PROTECTION_STATE });
    if (!res.filters) await chrome.storage.local.set({ filters: DEFAULT_FILTERS });
    if (!res.cachedWordlists) fetchAndCacheWordlists();
    await initBlockStats(); await syncState();
  } catch { }
});

initializeBackground();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!protectionEnabled || (!adBlockEnabled && !filteringEnabled)) return;
  const url = tab.url; if (!url) return;
  try {
    const normalize = (s: string) => s.toLowerCase().replace(/\\/g, "/").replace(/^file:\/\/\//, "");
    const normalizedUrl = normalize(url); if (filterExclusions.some(ex => ex && normalizedUrl.includes(normalize(ex)))) return;
  } catch { }
  if (changeInfo.status === "loading") { if (isPdfUrl(url) && !hasBypassParam(url)) { const warningUrl = chrome.runtime.getURL(`pdf-warning.html?url=${encodeURIComponent(url)}`); chrome.tabs.update(tabId, { url: warningUrl }); } }
});

async function handleVpnProvisioning(serverId: string) {
  if (isProvisioning) return { success: true }; 
  isProvisioning = true;
  try {
    await notifyVpnStatus("STARTING", "Locating your secure server...");
    const region = SERVER_REGION_MAP[serverId]; const client = getEC2Client(region); const tagName = EC2_TAG_NAMES[serverId];
    const instance = await findInstanceByTag(client, tagName);
    if (instance.State?.Name !== "running") { await notifyVpnStatus("STARTING", "Powering up server, please wait..."); await client.send(new StartInstancesCommand({ InstanceIds: [instance.InstanceId!] })); }
    let ip = "";
    for (let i = 0; i < 30; i++) {
      const desc = await client.send(new DescribeInstancesCommand({ InstanceIds: [instance.InstanceId!] }));
      const s = desc.Reservations?.[0]?.Instances?.[0]; if (s?.State?.Name === "running" && s?.PublicIpAddress) { ip = s.PublicIpAddress; break; }
      await notifyVpnStatus("WAITING_IP", `Server coming online... (${i+1}/30)`); await new Promise(r => setTimeout(r, 3000));
    }
    if (!ip) throw new Error("Server failed to assign an IP.");
    let userIp = ""; try { const ipResp = await fetch("https://checkip.amazonaws.com"); userIp = (await ipResp.text()).trim(); } catch { }
    if (instance.SecurityGroups && instance.SecurityGroups.length > 0) {
      try { const ingressIp = userIp ? `${userIp}/32` : "0.0.0.0/0"; await client.send(new AuthorizeSecurityGroupIngressCommand({ GroupId: instance.SecurityGroups[0].GroupId, IpPermissions: [{ IpProtocol: "tcp", FromPort: 1080, ToPort: 1080, IpRanges: [{ CidrIp: ingressIp }] }] })); } catch { }
    }
    await notifyVpnStatus("VERIFYING", "Almost ready...");
    await chrome.storage.local.set({ vpnConfig: { PublicIp: ip, Id: serverId } }); await syncState(true);
    const isFunctional = await verifyConnectivity(); if (!isFunctional) throw new Error("Tunnel integrity check failed.");
    isProvisioning = false; await notifyVpnStatus("READY", "Connected! You're protected."); await syncState(); return { success: true };
  } catch (err: any) {
    isProvisioning = false; const res = await chrome.storage.local.get("protectionState"); const state = res.protectionState as ProtectionState;
    if (state) await chrome.storage.local.set({ protectionState: { ...state, isActive: false, vpnEnabled: false } });
    if (browserProxy) await new Promise<void>(r => browserProxy.settings.clear({ scope: "regular" }, () => r()));
    await notifyVpnStatus("ERROR", `Failed: ${err.message}`); return { success: false, error: err.message };
  }
}

async function callGroqApi(messages: Array<{role: string; content: string}>, maxTokens: number = 500): Promise<string> {
  const apiKey = decode(process.env.GROQ_API_KEY || ""); if (!apiKey) throw new Error("AI service not configured");
  const models = ["llama-3.1-8b-instant", "llama3-8b-8192"];
  for (const model of models) {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }) });
      if (resp.status === 429) continue; const data = await resp.json(); return data.choices?.[0]?.message?.content || "";
    } catch (err: any) { if (model === models[models.length - 1]) throw err; }
  }
  throw new Error("AI models unavailable");
}

async function handleSummarize(text: string, url: string) {
  const truncated = text.substring(0, 4000); const prompt = `Summarize the following webpage in 4-6 concise bullet points. Format: - [Point]... TRIGGER WARNING: [List topics or "None"] URL: ${url} Content: ${truncated}`;
  const summary = await callGroqApi([{ role: "user", content: prompt }], 350); return { success: true, summary };
}

// RELIABLE GOOGLE TRANSLATE ENGINE
async function handleTranslate(texts: string[], targetLang: string) {
  const finalResults: string[] = new Array(texts.length).fill(""); const toFetch: { index: number; text: string }[] = [];
  texts.forEach((text, i) => { const cacheKey = `${targetLang}:${text}`; if (TRANSLATION_CACHE.has(cacheKey)) finalResults[i] = TRANSLATION_CACHE.get(cacheKey)!; else toFetch.push({ index: i, text }); });
  if (toFetch.length === 0) return { success: true, translatedTexts: finalResults };
  const chunks: { index: number; text: string }[][] = []; let currentChunk: { index: number; text: string }[] = []; let currentLength = 0;
  toFetch.forEach(item => { if (currentLength + item.text.length > 2000) { chunks.push(currentChunk); currentChunk = []; currentLength = 0; } currentChunk.push(item); currentLength += item.text.length + 1; });
  if (currentChunk.length > 0) chunks.push(currentChunk);

  await Promise.all(chunks.map(async (chunk) => {
    const combinedText = chunk.map(c => c.text).join("\n");
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(combinedText)}`;
      const res = await fetch(url); if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      
      // Google returns an array of segments. We map these segments back to our original chunk based on content matches or position.
      let segmentIndex = 0;
      chunk.forEach((item) => {
        let translatedNodeText = "";
        // Collect segments until we've matched the approximate length or reached a newline
        while (segmentIndex < data[0].length) {
          const segment = data[0][segmentIndex];
          translatedNodeText += segment[0];
          segmentIndex++;
          if (segment[1] && (segment[1].includes("\n") || segment[0].includes("\n"))) break;
        }
        const result = translatedNodeText.trim() || item.text;
        finalResults[item.index] = result;
        if (TRANSLATION_CACHE.size < MAX_CACHE_SIZE) TRANSLATION_CACHE.set(`${targetLang}:${item.text}`, result);
      });
    } catch { chunk.forEach(item => { finalResults[item.index] = item.text; }); }
  }));
  chrome.storage.local.set({ translation_cache: Object.fromEntries(TRANSLATION_CACHE.entries()) });
  return { success: true, translatedTexts: finalResults };
}

async function handleOtherActions(request: any, sender: chrome.runtime.MessageSender) {
  switch (request.action) {
    case "PROVISION_VPN": return await handleVpnProvisioning(request.serverId);
    case "GET_BLOCK_STATS": return { success: true, stats: await initBlockStats() };
    case "TOGGLE_ADBLOCK": await syncState(); return { success: true, enabled: adBlockEnabled };
    case "CHECK_URL_REAL": return scanUrl(request.url);
    case "SUMMARIZE_TEXT": return await handleSummarize(request.text || "", request.url || "");
    case "TRANSLATE_TEXT": return await handleTranslate(request.text || [], request.targetLang || "es");
    case "GET_EXCEPTIONS": return { success: true, exceptions: await getExceptionList() };
    case "ADD_EXCEPTION": { await addException(request.domain); return { success: true, exceptions: await getExceptionList() }; }
    case "REMOVE_EXCEPTION": { await removeException(request.domain); return { success: true, exceptions: await getExceptionList() }; }
    case "ALLOW_PDF": { const tabId = sender.tab?.id; if (tabId && request.url) { if (!allowedPdfs.has(tabId)) allowedPdfs.set(tabId, new Set()); allowedPdfs.get(tabId)!.add(request.url); return { success: true }; } return { success: false, error: "Invalid tab" }; }
    default: return { success: false, error: "Unknown action" };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ADBLOCK_STATUS") { sendResponse({ success: true, enabled: adBlockEnabled }); return true; }
  handleOtherActions(request, sender).then(sendResponse); return true;
});

console.log("[Background] Background initialized.");
