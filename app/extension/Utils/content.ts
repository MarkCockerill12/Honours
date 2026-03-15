import { SmartFilter } from "@/components/types";
import { initYouTubeAdBlocker, enableYouTubeAdBlocker, disableYouTubeAdBlocker } from "./youtubeAdBlocker";
import { scanUrl } from "./security";
import { isPdfUrl } from "@/lib/urlUtils";
import { DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@/lib/constants";

// --- INTERNAL STATE ---
let currentProtectionState: any = null;
let currentFilters: SmartFilter[] = [];
let currentBlurMethod: string = "blur";
let lastAppliedFilterHash = "";
let pageWarningBypassed = false;
let pageWarningOverlay: HTMLElement | null = null;
let filtersActive = false;
const appliedElements: HTMLElement[] = [];
// @ts-ignore
const translatedElements = new Map<HTMLElement, string>();
// @ts-ignore
let isTranslationActive = false;

// --- SHARED UTILS ---
const safeSendMessage = (message: any): Promise<any> => {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.debug("[Content] SendMessage error (ignoring):", chrome.runtime.lastError.message);
          resolve({ success: false });
        } else {
          resolve(response || { success: false });
        }
      });
    } catch (e) {
      resolve({ success: false });
    }
  });
};

// --- FILTERING ENGINE ---

export const blockWord = (textNode: Text, filters: SmartFilter[], method: string) => {
  const parent = textNode.parentElement;
  if (!parent || parent.closest('[data-content-filtered]')) return [];
  
  let content = textNode.textContent || "";
  let hasMatch = false;
  const elements: HTMLElement[] = [];

  const sortedFilters = [...filters].sort((a,b) => b.blockTerm.length - a.blockTerm.length);
  const fragment = globalThis.document.createDocumentFragment();
  let lastIndex = 0;

  const terms = sortedFilters.map(f => f.blockTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${terms})`, 'gi');
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    hasMatch = true;
    if (match.index > lastIndex) {
      fragment.appendChild(globalThis.document.createTextNode(content.substring(lastIndex, match.index)));
    }

    const term = match[0];
    const span = globalThis.document.createElement("span");
    span.textContent = term;
    span.dataset.contentFiltered = "true";
    span.dataset.originalTerm = term;
    
    if (method === "redact") {
      span.style.background = "#000";
      span.style.color = "#000";
    } else if (method === "kitten") {
      span.textContent = "🐱";
    } else {
      span.style.filter = "blur(4px)";
    }

    span.title = "Content hidden by Privacy Shield";
    span.style.cursor = "help";
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Show hidden content?")) {
        span.style.filter = "none";
        span.style.background = "transparent";
        span.style.color = "inherit";
        if (method === "kitten") span.textContent = span.dataset.originalTerm || "";
        span.dataset.userRevealed = "true";
      }
    });

    fragment.appendChild(span);
    elements.push(span);
    lastIndex = regex.lastIndex;
  }

  if (hasMatch) {
    if (lastIndex < content.length) {
      fragment.appendChild(globalThis.document.createTextNode(content.substring(lastIndex)));
    }
    textNode.replaceWith(fragment);
    return elements;
  }
  return [];
};

export const blockParagraph = (textNode: Text, method: string) => {
  const el = textNode.parentElement;
  if (!el || el.closest('[data-content-filtered]')) return null;
  
  el.dataset.contentFiltered = "true";
  if (method === "redact") {
    el.style.background = "#000";
    el.style.color = "#000";
  } else if (method === "kitten") {
     el.dataset.originalHtml = el.innerHTML;
     el.innerHTML = "🐱 Paragraph hidden for your safety.";
  } else {
    el.style.filter = "blur(12px)";
  }
  
  el.style.cursor = "help";
  el.addEventListener("click", () => {
    if (confirm("Show hidden paragraph?")) {
      el.style.filter = "none";
      el.style.background = "transparent";
      el.style.color = "inherit";
      if (method === "kitten" && el.dataset.originalHtml) el.innerHTML = el.dataset.originalHtml;
      el.dataset.userRevealed = "true";
    }
  });
  return el;
};

export const showPageWarning = (matchedTerms: string[], blurMethod: string) => {
  if (globalThis.document.getElementById("content-filter-page-warning")) return 0;
  if (pageWarningBypassed) return 0;
  
  console.log("[Content] showPageWarning triggered for:", matchedTerms);
  pageWarningOverlay = globalThis.document.createElement("div");
  pageWarningOverlay.id = "content-filter-page-warning";
  pageWarningOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:24px;font-family:sans-serif;";
  pageWarningOverlay.innerHTML = `
    <div>
      <div style="font-size:64px;">${blurMethod === "kitten" ? "🐱" : "⚠️"}</div>
      <h1>Content Warning</h1>
      <p>Detected terms: ${matchedTerms.join(", ")}</p>
      <button id="privacy-shield-proceed-btn" style="padding:12px 32px;cursor:pointer;background:#fff;color:#000;border:none;border-radius:8px;font-weight:bold;margin-top:20px;">Proceed</button>
    </div>
  `;
  globalThis.document.body.appendChild(pageWarningOverlay);
  globalThis.document.body.classList.add("content-filter-warning-active");
  
  if (!globalThis.document.getElementById("content-filter-warning-styles")) {
    const style = globalThis.document.createElement("style");
    style.id = "content-filter-warning-styles";
    style.textContent = `body.content-filter-warning-active > :not(#content-filter-page-warning) { filter: blur(25px) !important; pointer-events: none !important; }`;
    globalThis.document.head.appendChild(style);
  }
  
  pageWarningOverlay.querySelector("#privacy-shield-proceed-btn")?.addEventListener("click", () => { 
    pageWarningBypassed = true;
    pageWarningOverlay?.remove();
    pageWarningOverlay = null;
    globalThis.document.body.classList.remove("content-filter-warning-active");
    globalThis.document.getElementById("content-filter-warning-styles")?.remove();
    console.log("[Content] Warning bypassed.");
  });
  
  return 1;
};

export const blurContent = (rootElement: HTMLElement, filters: SmartFilter[], blurMethod: string = "blur") => {
  if (!filters || filters.length === 0) return 0;
  const active = filters.filter(f => f.enabled);
  if (active.length === 0) return 0;

  const pageText = (rootElement.textContent || "").toLowerCase();
  const hasMatches = active.some(f => pageText.includes(f.blockTerm.toLowerCase()));
  if (!hasMatches) return 0;

  const pwf = active.filter(f => f.blockScope === "page-warning");
  if (pwf.length > 0 && !pageWarningBypassed) {
    const matched = pwf.filter(f => pageText.includes(f.blockTerm.toLowerCase())).map(f => f.blockTerm);
    if (matched.length > 0) {
      showPageWarning(matched, blurMethod);
      return 1;
    }
  }

  const walker = globalThis.document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  let node;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const matches = active.filter(f => textNode.textContent?.toLowerCase().includes(f.blockTerm.toLowerCase()));
    if (matches.length > 0) {
       blockWord(textNode, matches, blurMethod).forEach(e => appliedElements.push(e));
       count++;
    }
  }
  filtersActive = true;
  return count;
};

export const clearBlurContent = () => {
  appliedElements.forEach(el => {
    el.style.filter = "none";
    el.style.background = "transparent";
    el.style.color = "inherit";
    delete el.dataset.contentFiltered;
  });
  appliedElements.length = 0;
  filtersActive = false;
};

export const deactivateFiltering = () => {
  clearBlurContent();
  lastAppliedFilterHash = "";
  pageWarningBypassed = false;
  pageWarningOverlay?.remove();
  pageWarningOverlay = null;
  globalThis.document.body.classList.remove("content-filter-warning-active");
};

export const syncState = (protection: any, filters: SmartFilter[], method: string) => {
  if (typeof globalThis.window === "undefined" || globalThis.location.protocol === "chrome-extension:") return;
  
  const activeFiltering = (protection?.isActive ?? false) && (protection?.filteringEnabled !== false);
  const filterHash = JSON.stringify({ filters, method, activeFiltering });
  
  if (activeFiltering && filters?.length > 0) {
    if (filterHash !== lastAppliedFilterHash) {
      console.log("[Content] syncState: applying filters...");
      clearBlurContent();
      blurContent(globalThis.document.body, filters, method as any);
      lastAppliedFilterHash = filterHash;
    }
  } else {
    if (lastAppliedFilterHash !== "") deactivateFiltering();
  }
};

// --- INITIALIZATION ---
if (typeof globalThis.window !== "undefined") {
  let isInitialSyncCompleted = false;
  let isSyncInProgress = false;

  const runInitialSync = (trigger: string) => {
    if (isSyncInProgress) return;
    if (isInitialSyncCompleted && (trigger === "DOMContentLoaded" || trigger === "load")) return;

    if (!globalThis.document.body) {
      console.log("[Content] Body not ready, retrying sync...");
      setTimeout(() => runInitialSync(trigger), 200);
      return;
    }

    isSyncInProgress = true;
    chrome.storage.local.get(["protectionState", "filters", "blurMethod"], (res: any) => {
      currentProtectionState = res.protectionState || DEFAULT_PROTECTION_STATE;
      currentFilters = res.filters || DEFAULT_FILTERS;
      currentBlurMethod = res.blurMethod || "blur";
      
      console.log(`[Content] Initial Sync (${trigger}): active=${currentProtectionState.isActive}, filters=${currentFilters.length}`);
      syncState(currentProtectionState, currentFilters, currentBlurMethod);
      
      isInitialSyncCompleted = true;
      isSyncInProgress = false;
    });
  };

  // Immediate start on injection
  runInitialSync("startup");
  
  // Standard event hooks
  globalThis.document.addEventListener("DOMContentLoaded", () => runInitialSync("DOMContentLoaded"));
  globalThis.window.addEventListener("load", () => runInitialSync("load"));

  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, resp) => {
      if (req.action === "PING") {
        resp({ success: true, pong: true });
      } else if (req.action === "APPLY_FILTERS") {
        console.log("[Content] Message: APPLY_FILTERS received.");
        lastAppliedFilterHash = ""; // Force re-sync
        syncState(req.protectionState || currentProtectionState, req.filters || currentFilters, req.blurMethod || currentBlurMethod);
        resp({ success: true });
      }
    });
  }
}
