import { SmartFilter } from "@/components/types";
import { initYouTubeAdBlocker, enableYouTubeAdBlocker, disableYouTubeAdBlocker } from "./youtubeAdBlocker";
import { scanUrl } from "./security";
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
let domObserver: MutationObserver | null = null;

// --- SHARED UTILS ---
const isContextValid = () => {
    try { return !!chrome.runtime?.id; } catch (e) { return false; }
};

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
      span.style.filter = "none";
      span.style.background = "transparent";
      span.style.color = "inherit";
      if (method === "kitten") span.textContent = span.dataset.originalTerm || "";
      span.dataset.userRevealed = "true";
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
    el.style.filter = "none";
    el.style.background = "transparent";
    el.style.color = "inherit";
    if (method === "kitten" && el.dataset.originalHtml) el.innerHTML = el.dataset.originalHtml;
    el.dataset.userRevealed = "true";
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
    <div style="max-width:80%;">
      <div style="font-size:64px;margin-bottom:20px;">${blurMethod === "kitten" ? "🐱" : "⚠️"}</div>
      <h1 style="font-size:32px;margin-bottom:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#60a5fa;">Content Protected</h1>
      <p style="font-size:16px;color:#aaa;margin-bottom:24px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Terms Detected:</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:32px;">
        ${matchedTerms.map(t => `<span style="background:rgba(255,255,255,0.1);padding:6px 16px;border-radius:100px;font-size:14px;font-weight:900;color:#fff;border:1px solid rgba(255,255,255,0.2);text-transform:none !important;filter:none !important;backdrop-filter:none !important;">${t}</span>`).join("")}
      </div>
      <button id="privacy-shield-proceed-btn" style="padding:16px 48px;cursor:pointer;background:#fff;color:#000;border:none;border-radius:100px;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:2px;transition:transform 0.2s;">Proceed to Site</button>
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
    console.log("[Content] Warning bypassed. Triggering re-sync.");
    syncState(currentProtectionState, currentFilters, currentBlurMethod);
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

  const pageFilters = active.filter(f => f.blockScope === "page-warning");
  const wordFilters = active.filter(f => f.blockScope === "word" || f.blockScope === "paragraph" || !f.blockScope);

  if (pageFilters.length > 0 && !pageWarningBypassed && rootElement === globalThis.document.body) {
    const matched = pageFilters.filter(f => pageText.includes(f.blockTerm.toLowerCase())).map(f => f.blockTerm);
    if (matched.length > 0) {
      showPageWarning(matched, blurMethod);
      // We continue so word-level filters (if any) can still be prepared
    }
  }

  // If no word-level filters exist, we can stop here as there's nothing to blur
  if (wordFilters.length === 0) return 0;

  const walker = globalThis.document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  let count = 0;
  for (const textNode of textNodes) {
    const matches = wordFilters.filter(f => textNode.textContent?.toLowerCase().includes(f.blockTerm.toLowerCase()));
    if (matches.length > 0) {
       const added = blockWord(textNode, matches, blurMethod);
       added.forEach(e => appliedElements.push(e));
       if (added.length > 0) count++;
    }
  }
  
  console.log(`[Content] blurContent: scanned ${textNodes.length} nodes, modified ${count}. (Bypassed: ${pageWarningBypassed})`);
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
  const filterHash = JSON.stringify({ 
    filters, 
    method, 
    activeFiltering, 
    pageWarningBypassed, 
    isActive: protection?.isActive 
  });
  
  if (activeFiltering && filters?.length > 0) {
    if (filterHash !== lastAppliedFilterHash) {
      console.log("[Content] syncState: applying filters...");
      clearBlurContent();
      blurContent(globalThis.document.body, filters, method as any);
      lastAppliedFilterHash = filterHash;
      startDomObserver();
    }
  } else {
    if (lastAppliedFilterHash !== "") {
        deactivateFiltering();
        stopDomObserver();
    }
  }
};

const startDomObserver = () => {
    if (domObserver || typeof globalThis.window === "undefined") return;
    
    domObserver = new MutationObserver((mutations) => {
        if (!isContextValid() || !currentProtectionState?.isActive || currentProtectionState?.filteringEnabled === false) return;
        
        for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    blurContent(node as HTMLElement, currentFilters, currentBlurMethod);
                }
            }
        }
    });

    domObserver.observe(globalThis.document.body, {
        childList: true,
        subtree: true
    });
    console.log("[Content] DOM Observer started.");
};

const stopDomObserver = () => {
    if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
        console.log("[Content] DOM Observer stopped.");
    }
};

// --- INITIALIZATION ---
if (typeof globalThis.window !== "undefined") {
  let isInitialSyncCompleted = false;
  let isSyncInProgress = false;

  const runInitialSync = (trigger: string) => {
    if (isSyncInProgress || !isContextValid()) return;
    if (isInitialSyncCompleted && (trigger === "DOMContentLoaded" || trigger === "load")) return;

    if (!globalThis.document.body) {
      console.log("[Content] Body not ready, retrying sync...");
      setTimeout(() => runInitialSync(trigger), 200);
      return;
    }

    isSyncInProgress = true;
    try {
      chrome.storage.local.get(["protectionState", "filters", "blurMethod"], (res: any) => {
        if (!isContextValid()) return;
        currentProtectionState = res.protectionState || DEFAULT_PROTECTION_STATE;
        currentFilters = res.filters || DEFAULT_FILTERS;
        currentBlurMethod = res.blurMethod || "blur";
        
        console.log(`[Content] Initial Sync (${trigger}): active=${currentProtectionState.isActive}, filters=${currentFilters.length}`);
        syncState(currentProtectionState, currentFilters, currentBlurMethod);
        
        isInitialSyncCompleted = true;
        isSyncInProgress = false;
      });
    } catch (e) {
      isSyncInProgress = false;
    }
  };

  // Immediate start on injection
  runInitialSync("startup");
  initYouTubeAdBlocker();
  
  // Standard event hooks
  globalThis.document.addEventListener("DOMContentLoaded", () => runInitialSync("DOMContentLoaded"));
  globalThis.window.addEventListener("load", () => runInitialSync("load"));

  // Real-time Storage Sync
  if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "local" || !isContextValid()) return;
          
          let needsSync = false;
          if (changes.protectionState) {
              currentProtectionState = changes.protectionState.newValue;
              needsSync = true;
              
              const adblockEnabled = currentProtectionState?.isActive && currentProtectionState?.adblockEnabled;
              if (adblockEnabled) enableYouTubeAdBlocker();
              else disableYouTubeAdBlocker();
          }
          if (changes.filters) {
              currentFilters = (changes.filters.newValue as SmartFilter[]) || [];
              needsSync = true;
          }
          if (changes.blurMethod) {
              currentBlurMethod = (changes.blurMethod.newValue as string) || "blur";
              needsSync = true;
          }

          if (needsSync) {
              console.log("[Content] Storage changed, syncing state...");
              syncState(currentProtectionState, currentFilters, currentBlurMethod);
          }
      });
  }

  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, resp) => {
      if (req.action === "PING") {
        resp({ success: true, pong: true });
        return true;
      }

      if (req.action === "APPLY_FILTERS") {
        console.log("[Content] Message: APPLY_FILTERS received.");
        const protection = {
          isActive: req.isActive !== undefined ? req.isActive : (req.protectionState?.isActive ?? currentProtectionState?.isActive),
          filteringEnabled: req.filteringEnabled !== undefined ? req.filteringEnabled : (req.protectionState?.filteringEnabled ?? currentProtectionState?.filteringEnabled)
        };
        currentProtectionState = protection;
        currentFilters = req.filters || currentFilters;
        currentBlurMethod = req.blurMethod || currentBlurMethod;

        lastAppliedFilterHash = ""; // Force re-sync
        syncState(protection, currentFilters, currentBlurMethod);
        resp({ success: true });
        return true;
      }

      if (req.action === "ENABLE_ADBLOCK") {
        enableYouTubeAdBlocker();
        resp({ success: true });
        return true;
      }

      if (req.action === "DISABLE_ADBLOCK") {
        disableYouTubeAdBlocker();
        resp({ success: true });
        return true;
      }

      if (req.action === "CLEAR_FILTERS") {
        deactivateFiltering();
        resp({ success: true });
        return true;
      }

      if (req.action === "GET_PAGE_TEXT") {
        resp({ success: true, text: globalThis.document.body.innerText });
        return true;
      }

      if (req.action === "SCAN_PAGE_LINKS") {
        const links = Array.from(globalThis.document.querySelectorAll("a"));
        const results = links.map(a => scanUrl(a.href));
        const malicious = results.filter(r => !r.isSafe);
        const safe = results.filter(r => r.isSafe);

        resp({
          success: true,
          type: "WEB",
          linkCount: results.length,
          maliciousCount: malicious.length,
          maliciousLinks: malicious,
          safeLinks: safe
        });
        return true;
      }

      if (req.action === "TRANSLATE_PAGE") {
        const walker = globalThis.document.createTreeWalker(globalThis.document.body, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent?.trim();
          if (text && text.length > 3) {
            textNodes.push(node as Text);
          }
        }

        const batchSize = 10;
        let translatedCount = 0;

        const processTranslation = async () => {
          for (let i = 0; i < textNodes.length; i += batchSize) {
            const batch = textNodes.slice(i, i + batchSize);
            const textsToTranslate = batch.map(n => n.textContent || "");
            
            const response = await safeSendMessage({
              action: "TRANSLATE_TEXT",
              text: textsToTranslate,
              targetLang: req.targetLang
            });

            if (response?.success && response.translatedTexts) {
              batch.forEach((node, index) => {
                if (response.translatedTexts[index]) {
                  if (!translatedElements.has(node.parentElement!)) {
                    translatedElements.set(node.parentElement!, node.textContent || "");
                  }
                  node.textContent = response.translatedTexts[index];
                  translatedCount++;
                }
              });
            }
          }
          isTranslationActive = true;
          resp({ success: true, count: translatedCount });
        };

        processTranslation();
        return true; // Keep channel open for async
      }

      if (req.action === "CLEAR_TRANSLATIONS") {
        translatedElements.forEach((originalText, element) => {
          element.textContent = originalText;
        });
        translatedElements.clear();
        isTranslationActive = false;
        resp({ success: true });
        return true;
      }
    });
  }
}
