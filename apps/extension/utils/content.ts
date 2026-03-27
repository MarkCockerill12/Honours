import { SmartFilter, DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@privacy-shield/core";
import { initYouTubeAdBlocker, enableYouTubeAdBlocker, disableYouTubeAdBlocker } from "./youtubeAdBlocker";
import { scanUrl } from "./security";

// --- INTERNAL STATE ---
let currentProtectionState: any = null;
let currentFilters: SmartFilter[] = [];
let currentBlurMethod: string = "blur";
let lastAppliedFilterHash = "";
let pageWarningBypassed = false;
let pageWarningOverlay: HTMLElement | null = null;
let _filtersActive = false;
const appliedElements: WeakRef<HTMLElement>[] = [];
const originalContentMap = new WeakMap<HTMLElement, DocumentFragment>();

// A2: Periodic pruning of dead elements from the appliedElements array
setInterval(() => {
  if (appliedElements.length > 50) {
    const initialLength = appliedElements.length;
    for (let i = appliedElements.length - 1; i >= 0; i--) {
      if (!appliedElements[i].deref()) {
        appliedElements.splice(i, 1);
      }
    }
    if (appliedElements.length < initialLength) {
      console.debug(`[Content] Pruned ${initialLength - appliedElements.length} dead element references.`);
    }
  }
}, 30000); // Every 30 seconds if array is getting large
const translatedElements = new Map<HTMLElement, string>();
let _isTranslationActive = false;
let domObserver: MutationObserver | null = null;

// --- SHARED UTILS ---
const isContextValid = () => {
    try { return !!chrome.runtime?.id; } catch { return false; }
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
      } catch (error) { 
        console.warn("[Content] Style cleanup failed:", (error as Error).message); 
      }
  });
};

// --- FILTERING ENGINE ---

const blockWord = (textNode: Text, filters: SmartFilter[], method: string) => {
  const parent = textNode.parentElement;
  if (!parent || parent.closest('[data-content-filtered]')) return [];
  
  let content = textNode.textContent || "";
  let hasMatch = false;
  const elements: HTMLElement[] = [];

  const sortedFilters = [...filters].sort((a,b) => b.blockTerm.length - a.blockTerm.length);
  const fragment = globalThis.document.createDocumentFragment();
  let lastIndex = 0;

  const terms = sortedFilters.map(f => f.blockTerm.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)).join('|');
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
    
    const isRedact = method === "redact" || method === "blackbar";
    
    if (isRedact) {
      span.style.backgroundColor = "#000";
      span.style.color = "#000";
    } else if (method === "kitten") {
      span.textContent = "🐱";
    } else {
      span.style.filter = "blur(6px)";
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

const blockParagraph = (textNode: Text, method: string) => {
  const el = textNode.parentElement;
  if (!el || el.closest('[data-content-filtered]')) return null;
  
  el.dataset.contentFiltered = "true";
  const isRedact = method === "redact" || method === "blackbar";

  if (isRedact) {
    el.style.backgroundColor = "#000";
    el.style.color = "#000";
  } else if (method === "kitten") {
     // C4: Store children in DocumentFragment instead of innerHTML string to prevent XSS
     const fragment = globalThis.document.createDocumentFragment();
     while (el.firstChild) {
       fragment.appendChild(el.firstChild);
     }
     originalContentMap.set(el, fragment);
     el.textContent = "🐱 Paragraph hidden for your safety.";
  } else {
    el.style.filter = "blur(12px)";
  }
  
  el.style.cursor = "help";
  el.addEventListener("click", () => {
    el.style.filter = "none";
    el.style.backgroundColor = "transparent";
    el.style.color = "inherit";
    if (method === "kitten") {
      const fragment = originalContentMap.get(el);
      if (fragment) {
        el.textContent = "";
        el.appendChild(fragment);
        originalContentMap.delete(el);
      }
    }
    el.dataset.userRevealed = "true";
  });
  return el;
};

const showPageWarning = (matchedTerms: string[], blurMethod: string) => {
  if (globalThis.document.getElementById("content-filter-page-warning")) return 0;
  if (pageWarningBypassed) return 0;
  
  console.log("[Content] showPageWarning triggered for:", matchedTerms);
  pageWarningOverlay = globalThis.document.createElement("div");
  pageWarningOverlay.id = "content-filter-page-warning";
  pageWarningOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:24px;font-family:sans-serif;";
  
  const container = globalThis.document.createElement("div");
  container.style.maxWidth = "80%";
  
  const icon = globalThis.document.createElement("div");
  icon.style.fontSize = "64px";
  icon.style.marginBottom = "20px";
  icon.textContent = blurMethod === "kitten" ? "🐱" : "⚠️";
  
  const title = globalThis.document.createElement("h1");
  title.style.cssText = "font-size:32px;margin-bottom:16px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#60a5fa;";
  title.textContent = "Content Protected";
  
  const desc = globalThis.document.createElement("p");
  desc.style.cssText = "font-size:16px;color:#aaa;margin-bottom:24px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;";
  desc.textContent = "Terms Detected:";
  
  const termsDiv = globalThis.document.createElement("div");
  termsDiv.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:32px;";
  
  matchedTerms.forEach(t => {
    const badge = globalThis.document.createElement("span");
    badge.style.cssText = "background:rgba(255,255,255,0.1);padding:6px 16px;border-radius:100px;font-size:14px;font-weight:900;color:#fff;border:1px solid rgba(255,255,255,0.2);text-transform:none !important;filter:none !important;backdrop-filter:none !important;";
    badge.textContent = t;
    termsDiv.appendChild(badge);
  });
  
  const btn = globalThis.document.createElement("button");
  btn.id = "privacy-shield-proceed-btn";
  btn.style.cssText = "padding:16px 48px;cursor:pointer;background:#fff;color:#000;border:none;border-radius:100px;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:2px;transition:transform 0.2s;";
  btn.textContent = "Proceed to Site";
  
  container.appendChild(icon);
  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(termsDiv);
  container.appendChild(btn);
  pageWarningOverlay.appendChild(container);
  
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

const checkPageWarnings = (rootElement: HTMLElement, active: SmartFilter[], pageText: string, blurMethod: string) => {
  const pageFilters = active.filter(f => f.blockScope === "page-warning");
  if (pageFilters.length > 0 && !pageWarningBypassed && rootElement === globalThis.document.body) {
    const matched = pageFilters.filter(f => pageText.includes(f.blockTerm.toLowerCase())).map(f => f.blockTerm);
    if (matched.length > 0) {
      showPageWarning(matched, blurMethod);
    }
  }
};

const collectTextNodes = (rootElement: HTMLElement): Text[] => {
  const walker = globalThis.document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  return textNodes;
};

const processTextNode = (textNode: Text, wordFilters: SmartFilter[], blurMethod: string) => {
  const content = textNode.textContent?.toLowerCase() || "";
  const matches = wordFilters.filter(f => {
    const isMatch = content.includes(f.blockTerm.toLowerCase());
    if (isMatch && f.exceptWhen && content.includes(f.exceptWhen.toLowerCase())) {
      return false;
    }
    return isMatch;
  });

  if (matches.length > 0) {
    const hasParagraphScope = matches.some(f => f.blockScope === "paragraph");
    if (hasParagraphScope) {
      const added = blockParagraph(textNode, blurMethod);
      if (added) {
        appliedElements.push(new WeakRef(added));
        return true;
      }
    } else {
      const added = blockWord(textNode, matches, blurMethod);
      added.forEach(e => appliedElements.push(new WeakRef(e)));
      return added.length > 0;
    }
  }
  return false;
};

export const blurContent = (rootElement: HTMLElement, filters: SmartFilter[], blurMethod: string = "blur") => {
  if (!filters?.length) return 0;
  const active = filters.filter(f => f.enabled);
  if (!active.length) return 0;

  const pageText = (rootElement.textContent || "").toLowerCase();
  const hasMatches = active.some(f => pageText.includes(f.blockTerm.toLowerCase()));
  if (!hasMatches) return 0;

  checkPageWarnings(rootElement, active, pageText, blurMethod);

  const wordFilters = active.filter(f => f.blockScope === "word" || f.blockScope === "paragraph" || !f.blockScope);
  if (wordFilters.length === 0) return 0;

  const textNodes = collectTextNodes(rootElement);
  let count = 0;
  for (const textNode of textNodes) {
    if (textNode.parentElement?.closest('[data-content-filtered]')) continue;
    if (processTextNode(textNode, wordFilters, blurMethod)) {
      count++;
    }
  }
  
  console.log(`[Content] blurContent: scanned ${textNodes.length} nodes, modified ${count}. (Bypassed: ${pageWarningBypassed})`);
  _filtersActive = true;
  return count;
};

export const clearBlurContent = () => {
  appliedElements.forEach(ref => {
    const el = ref.deref();
    if (el) {
      el.style.filter = "none";
      el.style.background = "transparent";
      el.style.color = "inherit";
      delete el.dataset.contentFiltered;
      
      // Restore kitten content if cleared via UI toggle
      const fragment = originalContentMap.get(el);
      if (fragment) {
        el.textContent = "";
        el.appendChild(fragment);
        originalContentMap.delete(el);
      }
    }
  });
  appliedElements.length = 0;
  _filtersActive = false;
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
  if (globalThis.window === undefined || globalThis.location.protocol === "chrome-extension:") return;
  
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
      blurContent(globalThis.document.body, filters, method);
      lastAppliedFilterHash = filterHash;
      startDomObserver();
    }
  } else if (lastAppliedFilterHash !== "") {
    deactivateFiltering();
    stopDomObserver();
  }
};

const startDomObserver = () => {
    if (domObserver !== undefined || globalThis.window === undefined) return;
    
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
if (globalThis.window !== undefined) {
  let isInitialSyncCompleted = false;
  let isSyncInProgress = false;

  const runInitialSync = async (trigger: string) => {
    if (isSyncInProgress || !isContextValid()) return;
    if (isInitialSyncCompleted && (trigger === "DOMContentLoaded" || trigger === "load")) return;

    // Robust wait for body
    if (!globalThis.document.body) {
      console.log("[Content] Body not ready, waiting for body...");
      await new Promise(resolve => {
        const check = () => {
          if (globalThis.document.body) resolve(null);
          else requestAnimationFrame(check);
        };
        check();
      });
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
    } catch (error) {
      console.error("[Content] Initial sync fatal error:", error);
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

  const handleMessage = (req: any, _sender: chrome.runtime.MessageSender, resp: (response?: any) => void) => {
    switch (req.action) {
      case "PING":
        resp({ success: true, pong: true });
        break;
      case "APPLY_FILTERS":
        handleApplyFilters(req, resp);
        break;
      case "ENABLE_ADBLOCK":
        enableYouTubeAdBlocker();
        resp({ success: true });
        break;
      case "DISABLE_ADBLOCK":
        disableYouTubeAdBlocker();
        resp({ success: true });
        break;
      case "CLEAR_FILTERS":
        deactivateFiltering();
        resp({ success: true });
        break;
      case "GET_PAGE_TEXT":
        resp({ success: true, text: globalThis.document.body.innerText });
        break;
      case "SCAN_PAGE_LINKS":
        handleScanLinks(resp);
        break;
      case "TRANSLATE_PAGE":
        handleTranslatePage(req, resp);
        break;
      case "CLEAR_TRANSLATIONS":
        handleClearTranslations(resp);
        break;
      default:
        return false;
    }
    return true;
  };

  const handleApplyFilters = (req: any, resp: (response?: any) => void) => {
    console.log("[Content] Message: APPLY_FILTERS received.");
    const isActive = req.isActive ?? req.protectionState?.isActive ?? currentProtectionState?.isActive;
    const filteringEnabled = req.filteringEnabled ?? req.protectionState?.filteringEnabled ?? currentProtectionState?.filteringEnabled;
    
    const protection = { isActive, filteringEnabled };
    currentProtectionState = protection;
    currentFilters = req.filters || currentFilters;
    currentBlurMethod = req.blurMethod || currentBlurMethod;

    lastAppliedFilterHash = ""; // Force re-sync
    syncState(protection, currentFilters, currentBlurMethod);
    resp({ success: true });
  };

  const handleScanLinks = (resp: (response?: any) => void) => {
    const links = Array.from(globalThis.document.querySelectorAll("a"));
    const results = links.map(a => scanUrl(a.href));
    const malicious = results.filter(r => !r.isSafe);
    resp({
      success: true,
      type: "WEB",
      linkCount: results.length,
      maliciousCount: malicious.length,
      maliciousLinks: malicious,
      safeLinks: results.filter(r => r.isSafe)
    });
  };

  const handleTranslatePage = (req: any, resp: (response?: any) => void) => {
    const walker = globalThis.document.createTreeWalker(globalThis.document.body, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && text.length > 3) textNodes.push(node as Text);
    }

    const batchSize = 10;
    let translatedCount = 0;

    const processTranslation = async () => {
      for (let i = 0; i < textNodes.length; i += batchSize) {
        const batch = textNodes.slice(i, i + batchSize);
        const texts = batch.map(n => n.textContent || "");
        const response = await safeSendMessage({ action: "TRANSLATE_TEXT", text: texts, targetLang: req.targetLang });

        if (response?.success && response.translatedTexts) {
          batch.forEach((node, idx) => {
            if (response.translatedTexts[idx]) {
              if (!translatedElements.has(node.parentElement!)) translatedElements.set(node.parentElement!, node.textContent || "");
              node.textContent = response.translatedTexts[idx];
              translatedCount++;
            }
          });
        }
      }
      _isTranslationActive = true;
      resp({ success: true, count: translatedCount });
    };
    processTranslation();
  };

  const handleClearTranslations = (resp: (response?: any) => void) => {
    translatedElements.forEach((originalText, element) => { element.textContent = originalText; });
    translatedElements.clear();
    _isTranslationActive = false;
    resp({ success: true });
  };

  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(handleMessage);
  }
}
