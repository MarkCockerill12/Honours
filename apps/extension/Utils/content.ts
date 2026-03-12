import { SmartFilter } from "../../../packages/ui/types";
import { initYouTubeAdBlocker } from "./youtubeAdBlocker";
import { AD_SELECTORS } from "./adBlockEngine";
import { scanUrl } from "./security";

// --- STATE ---
let filtersActive = false;
let appliedElements: HTMLElement[] = [];
let adBlockingActive = false;
let pageWarningOverlay: HTMLElement | null = null;
let currentProtectionState: any = null;
let currentFilters: SmartFilter[] = [];
let currentBlurMethod: string = "blur";
let adObserver: MutationObserver | null = null;
let contentMutationObserver: MutationObserver | null = null;
let isTranslationActive = false;
let translatedElements: Map<HTMLElement, string> = new Map();
let pageWarningBypassed = false;
let lastAppliedFilterHash = ""; // Track filter changes to avoid unnecessary clear/re-apply

// --- UTILITIES (Ordered for initialization) ---

const safeSendMessage = async (message: any): Promise<any> => {
  return new Promise((resolve) => {
    try {
      if (!chrome.runtime?.id) {
        console.warn("[Content] Extension context invalidated. Please refresh the page.");
        resolve({ success: false, error: "context_invalidated" });
        return;
      }
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    } catch (e: any) {
      console.error("[Content] Send message failed:", e);
      resolve({ success: false, error: "extension_context_invalidated" });
    }
  });
};

const hideAdElements = () => {
  AD_SELECTORS.forEach((selector) => {
    try {
      globalThis.document.querySelectorAll(selector).forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = "none";
        htmlEl.dataset.adHidden = "true";
      });
    } catch (error: any) {
      console.warn(`[Content] Failed to hide elements for selector ${selector}:`, error.message);
    }
  });
};

const setupAdBlockObserver = () => {
  if (adObserver) adObserver.disconnect();
  adObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLElement) {
          for (const selector of AD_SELECTORS) {
            if (node.matches(selector)) {
              node.style.display = "none";
              node.dataset.adHidden = "true";
            }
          }
        }
      }
    }
  });
  adObserver.observe(globalThis.document.body, { childList: true, subtree: true });
};

const enableAdBlocking = () => {
  if (adBlockingActive) return;
  adBlockingActive = true;
  
  // Inject global aggressive CSS rules to ensure ad scripts cannot override visibility
  const styleStr = AD_SELECTORS.map(sel => `${sel} { display: none !important; }`).join('\n');
  const styleEl = document.createElement("style");
  styleEl.id = "privacy-protector-adblock-styles";
  styleEl.textContent = styleStr;
  globalThis.document.head.appendChild(styleEl);

  hideAdElements();
  setupAdBlockObserver();
};

const disableAdBlocking = () => {
  if (!adBlockingActive) return;
  adBlockingActive = false;
  
  const styleEl = globalThis.document.getElementById("privacy-protector-adblock-styles");
  if (styleEl) styleEl.remove();

  globalThis.document.querySelectorAll('[data-ad-hidden="true"]').forEach((ad) => {
    (ad as HTMLElement).style.display = "";
    delete (ad as HTMLElement).dataset.adHidden;
  });
};

const setupContentObserver = (filters: SmartFilter[], method: string) => {
  if (contentMutationObserver) contentMutationObserver.disconnect();
  contentMutationObserver = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
      blurContent(document.body, filters, method as any);
    }
  });
  contentMutationObserver.observe(document.body, { childList: true, subtree: true });
};

export const clearBlurContent = () => {
  // 1. Clear Spans
  appliedElements.forEach((el) => {
    if (el.parentNode && el.dataset.originalText) {
      const textNode = globalThis.document.createTextNode(el.dataset.originalText);
      el.parentNode.replaceChild(textNode, el);
    }
  });
  
  // 2. Clear Paragraph/Block level
  globalThis.document.querySelectorAll('[data-content-filtered="true"]').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.dataset.originalHtml) {
      htmlEl.innerHTML = htmlEl.dataset.originalHtml;
    }
    htmlEl.style.filter = "";
    htmlEl.style.backgroundColor = "";
    htmlEl.style.color = "";
    htmlEl.style.cursor = "";
    htmlEl.onclick = null;
    delete htmlEl.dataset.contentFiltered;
    delete htmlEl.dataset.originalHtml;
  });

  appliedElements = [];
  filtersActive = false;
  if (pageWarningOverlay) { 
    pageWarningOverlay.remove(); 
    pageWarningOverlay = null; 
  }
  // NOTE: Do NOT reset pageWarningBypassed here — it persists until page refresh
  globalThis.document.body.classList.remove("content-filter-warning-active");
  const style = globalThis.document.getElementById("content-filter-warning-styles");
  if (style) style.remove();
};

const applyBlurMethodToSpan = (span: HTMLElement, originalText: string, blurMethod: string) => {
  span.dataset.originalText = originalText;
  span.dataset.contentFiltered = "true";
  span.dataset.filterMethod = blurMethod;
  const revealSpan = () => { span.dataset.userRevealed = "true"; };
  switch (blurMethod) {
    case "blackbar":
      span.textContent = "█".repeat(Math.min(originalText.length, 40));
      span.style.backgroundColor = "#000";
      span.style.color = "#000";
      span.style.borderRadius = "2px";
      span.onclick = () => { span.textContent = originalText; span.style.backgroundColor = "transparent"; span.style.color = "inherit"; revealSpan(); };
      break;
    case "warning":
      span.textContent = "⚠️ [Filtered]";
      span.style.backgroundColor = "rgba(234,179,8,0.15)";
      span.style.color = "#ca8a04";
      span.style.borderRadius = "4px";
      span.onclick = () => { span.textContent = originalText; span.style.backgroundColor = "transparent"; span.style.padding = "0"; revealSpan(); };
      break;
    default:
      span.textContent = originalText;
      span.style.filter = "blur(6px)";
      span.onclick = () => { span.style.filter = "none"; revealSpan(); };
      break;
  }
};

const showPageWarning = (matchedTerms: string[], blurMethod: string) => {
  if (pageWarningBypassed || pageWarningOverlay) return 0;
  pageWarningOverlay = globalThis.document.createElement("div");
  pageWarningOverlay.id = "content-filter-page-warning";
  pageWarningOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:24px;font-family:sans-serif;";
  pageWarningOverlay.innerHTML = `<div><div style="font-size:64px;">${blurMethod === "kitten" ? "🐱" : "⚠️"}</div><h1>Content Warning</h1><p>Detected terms: ${matchedTerms.join(", ")}</p><button id="proceed" style="padding:12px 32px;cursor:pointer;background:#fff;color:#000;border:none;border-radius:8px;font-weight:bold;">Proceed</button></div>`;
  globalThis.document.body.appendChild(pageWarningOverlay);
  
  globalThis.document.body.classList.add("content-filter-warning-active");
  
  if (!globalThis.document.getElementById("content-filter-warning-styles")) {
    const style = globalThis.document.createElement("style");
    style.id = "content-filter-warning-styles";
    style.textContent = `
      body.content-filter-warning-active > :not(#content-filter-page-warning) {
        filter: blur(25px) grayscale(0.5) !important;
        pointer-events: none !important;
      }
    `;
    globalThis.document.head.appendChild(style);
  }
  
  globalThis.document.getElementById("proceed")?.addEventListener("click", () => { 
    pageWarningBypassed = true;
    // Directly remove the overlay and styles instead of clearing all filters
    if (pageWarningOverlay) {
      pageWarningOverlay.remove();
      pageWarningOverlay = null;
    }
    globalThis.document.body.classList.remove("content-filter-warning-active");
    const warningStyle = globalThis.document.getElementById("content-filter-warning-styles");
    if (warningStyle) warningStyle.remove();
  });
  return 1;
};

const blockParagraph = (textNode: Text, blurMethod: string): HTMLElement | null => {
  let blockParent: HTMLElement | null = textNode.parentElement;
  // Tags that are good candidates for full-paragraph blocking
  const tags = new Set(["P", "DIV", "LI", "TD", "BLOCKQUOTE", "ARTICLE", "SECTION", "MAIN", "ASIDE", "H1", "H2", "H3", "H4", "H5", "H6"]);
  
  // Go up until we find a block-ish container or a reasonably sized text container
  // We avoid going too high to the BODY or large structural elements if possible
  while (blockParent && !tags.has(blockParent.tagName) && blockParent.tagName !== "BODY") {
    // If the parent is very large compared to the text, we might want to stop
    if (blockParent.innerText.length > textNode.textContent!.length * 10) break;
    blockParent = blockParent.parentElement;
  }
  
  if (!blockParent || blockParent.tagName === "BODY") blockParent = textNode.parentElement;
  if (!blockParent || blockParent.dataset.contentFiltered) return null;
  // Skip if user already revealed this element
  if (blockParent.dataset.userRevealed === "true") return null;
  const originalHTML = blockParent.innerHTML;
  blockParent.dataset.contentFiltered = "true";
  blockParent.dataset.originalHtml = originalHTML;

  console.log(`[Content] blockParagraph: applying ${blurMethod} to ${blockParent.tagName}`);

  switch (blurMethod) {
    case "blackbar":
      blockParent.style.backgroundColor = "rgb(0, 0, 0)";
      blockParent.style.color = "rgb(0, 0, 0)";
      blockParent.style.cursor = "pointer";
      blockParent.onclick = (e) => {
        e.stopPropagation();
        blockParent!.style.backgroundColor = "";
        blockParent!.style.color = "";
        blockParent!.dataset.userRevealed = "true";
        delete blockParent!.dataset.contentFiltered;
      };
      break;
    case "warning":
      blockParent.innerHTML = '<div style="background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.3);border-radius:8px;padding:12px;color:#ca8a04;font-weight:bold;cursor:pointer;">⚠️ Content Filtered</div>';
      blockParent.onclick = (e) => { 
        e.stopPropagation();
        blockParent!.innerHTML = originalHTML; 
        blockParent!.dataset.userRevealed = "true";
        delete blockParent!.dataset.contentFiltered; 
      };
      break;
    default:
      blockParent.style.filter = "blur(12px)";
      blockParent.style.cursor = "pointer";
      blockParent.onclick = (e) => { 
        e.stopPropagation();
        blockParent!.style.filter = "none"; 
        blockParent!.dataset.userRevealed = "true";
        delete blockParent!.dataset.contentFiltered; 
      };
      break;
  }
  return blockParent;
};

const blockWord = (textNode: Text, matchingFilters: SmartFilter[], blurMethod: string): HTMLElement[] => {
  const text = textNode.textContent || "";
  const sorted = [...matchingFilters].sort((a, b) => b.blockTerm.length - a.blockTerm.length);
  const terms = sorted.map(f => f.blockTerm.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)).filter(t => t.length > 0);
  if (terms.length === 0) return [];
  const regex = new RegExp(`(${terms.join('|')})`, "gi");
  const parts = text.split(regex);
  if (parts.length <= 1) return [];
  const fragment = document.createDocumentFragment();
  const created: HTMLElement[] = [];
  parts.forEach((part) => {
    const filter = sorted.find(f => f.blockTerm.toLowerCase() === part.toLowerCase());
    if (filter) {
      const span = document.createElement("span");
      applyBlurMethodToSpan(span, part, blurMethod);
      fragment.appendChild(span);
      created.push(span);
    } else if (part) fragment.appendChild(document.createTextNode(part));
  });
  textNode.replaceWith(fragment);
  return created;
};

const processInlineFilters = (rootElement: HTMLElement, filters: SmartFilter[], blurMethod: string): number => {
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  const nodes: { textNode: Text; matchingFilters: SmartFilter[] }[] = [];
  let node;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) continue;
    if (parent?.closest('[data-content-filtered]')) continue;
    // Skip elements the user has already revealed
    if (parent?.closest('[data-user-revealed="true"]')) continue;
    if (parent?.dataset.userRevealed === "true") continue;
    const text = textNode.textContent?.toLowerCase() || "";
    const matches = filters.filter(f => {
      const term = f.blockTerm.toLowerCase();
      if (!text.includes(term)) return false;
      if (f.exceptWhen) {
        const exception = f.exceptWhen.toLowerCase();
        // Check immediate parent and also the container itself if we are in a test environment
        const contextText = (parent?.innerText || parent?.textContent || "").toLowerCase();
        if (contextText.includes(exception)) return false;
        
        // Sometimes innerText/textContent might be missing the full context if the node is deep
        let current: HTMLElement | null = parent;
        while (current && current !== rootElement) {
          if ((current.innerText || current.textContent || "").toLowerCase().includes(exception)) return false;
          current = current.parentElement;
        }
        if ((rootElement.innerText || rootElement.textContent || "").toLowerCase().includes(exception)) return false;
      }
      return true;
    });
    if (matches.length > 0) nodes.push({ textNode, matchingFilters: matches });
  }
  let count = 0;
  nodes.forEach(({ textNode, matchingFilters }) => {
    if (textNode.parentElement?.closest('[data-content-filtered]')) return;
    // Skip user-revealed elements
    if (textNode.parentElement?.closest('[data-user-revealed="true"]')) return;
    if (matchingFilters.some(f => f.blockScope === "paragraph")) {
      const el = blockParagraph(textNode, blurMethod);
      if (el) { appliedElements.push(el); count++; }
    } else {
      const elements = blockWord(textNode, matchingFilters, blurMethod);
      elements.forEach(e => appliedElements.push(e));
      count += elements.length;
    }
  });
  filtersActive = true;
  return count;
};

export const blurContent = (rootElement: HTMLElement, filters: SmartFilter[], blurMethod: string = "blur") => {
  if (!filters || filters.length === 0) return 0;
  const active = filters.filter(f => f.enabled);
  if (active.length === 0) return 0;
  const pwf = active.filter(f => f.blockScope === "page-warning");
  if (pwf.length > 0) {
    const pageText = (rootElement.innerText || "").toLowerCase();
    const matched = pwf.filter(f => pageText.includes(f.blockTerm.toLowerCase()) && (!f.exceptWhen || !pageText.includes(f.exceptWhen.toLowerCase()))).map(f => f.blockTerm);
    if (matched.length > 0) {
      const warnCount = showPageWarning(matched, blurMethod);
      const rem = active.filter(f => f.blockScope !== "page-warning");
      return warnCount + (rem.length > 0 ? processInlineFilters(rootElement, rem, blurMethod) : 0);
    }
  }
  return processInlineFilters(rootElement, active.filter(f => f.blockScope !== "page-warning"), blurMethod);
};

export const clearTranslations = () => {
  translatedElements.forEach((orig, el) => { if (el.parentNode) el.parentNode.replaceChild(document.createTextNode(orig), el); });
  translatedElements.clear();
  isTranslationActive = false;
};

export const translatePage = async (rootElement: HTMLElement, targetLang: string): Promise<number> => {
  if (isTranslationActive) clearTranslations();
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  const nodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    const tn = node as Text;
    if (tn.textContent?.trim().length! > 3 && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(tn.parentElement?.tagName!)) nodes.push(tn);
  }
  let count = 0;
  for (let i = 0; i < nodes.length; i += 5) {
    const batch = nodes.slice(i, i + 5);
    const texts = batch.map(n => n.textContent || "");
    const resp = await safeSendMessage({ action: "TRANSLATE_TEXT", text: texts, targetLang });
    if (resp?.success && resp.translatedTexts) {
      batch.forEach((n, idx) => {
        const t = resp.translatedTexts[idx];
        if (t && t !== texts[idx]) {
          const span = document.createElement("span");
          span.textContent = t;
          span.dataset.originalText = texts[idx];
          span.dataset.translated = "true";
          translatedElements.set(span, texts[idx]);
          n.replaceWith(span);
          count++;
        }
      });
    }
  }
  isTranslationActive = true;
  return count;
};

const syncState = (protection: any, filters: SmartFilter[], method: string, isFilteringActive: boolean) => {
  if (globalThis.window === undefined || globalThis.location.protocol === "chrome-extension:") return;
  
  // Both Master Activation AND Adblock toggle must be on
  const shouldAdBlock = (protection?.isActive ?? false) && (protection?.adblockEnabled ?? false);
  if (shouldAdBlock) enableAdBlocking(); else disableAdBlocking();
  
  // Content filters: only re-apply if the filter config actually changed
  const filterHash = JSON.stringify({ filters, method, isFilteringActive, isActive: protection?.isActive });
  
  if (protection?.isActive && isFilteringActive && filters?.length > 0) {
    if (filterHash !== lastAppliedFilterHash) {
      // Filters changed — clear (preserving user-revealed) and re-apply
      clearBlurContent();
      blurContent(globalThis.document.body, filters, method as any);
      setupContentObserver(filters, method);
      lastAppliedFilterHash = filterHash;
    }
    // If filter hash is the same, do nothing — preserve user-revealed state
  } else {
    if (lastAppliedFilterHash !== "") {
      // Filters were active but now deactivated — clear
      clearBlurContent();
      if (contentMutationObserver) contentMutationObserver.disconnect();
      lastAppliedFilterHash = "";
    }
  }
};

// --- INITIALIZATION (at the bottom) ---

if (globalThis.window !== undefined) {
  if (globalThis.location.hostname.includes("youtube.com")) setTimeout(() => initYouTubeAdBlocker(), 1000);
  if (globalThis.chrome !== undefined && globalThis.chrome.storage) {
    chrome.storage.local.get(["protectionState", "filters", "blurMethod", "isFilteringActive"], (res) => 
      syncState(res.protectionState, (res.filters as SmartFilter[]) || [], (res.blurMethod as string) || "blur", !!res.isFilteringActive)
    );
    
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          chrome.storage.local.get(["protectionState", "filters", "blurMethod", "isFilteringActive"], (res) => 
            syncState(res.protectionState, (res.filters as SmartFilter[]) || [], (res.blurMethod as string) || "blur", !!res.isFilteringActive)
          );
        }
      });
    }
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((req, sender, resp) => {
        if (req.action === "PING") { resp({ success: true, pong: true }); }
        else if (req.action === "TRANSLATE_PAGE") translatePage(globalThis.document.body, req.targetLang).then(c => resp({ success: true, count: c }));
        else if (req.action === "CLEAR_TRANSLATIONS") { clearTranslations(); resp({ success: true }); }
        else if (req.action === "APPLY_FILTERS") { 
          clearBlurContent(); 
          if (req.isFilteringActive !== false) {
            blurContent(globalThis.document.body, req.filters, req.blurMethod); 
            setupContentObserver(req.filters, req.blurMethod); 
          }
          resp({ success: true }); 
        }
        else if (req.action === "CLEAR_FILTERS") { clearBlurContent(); resp({ success: true }); }
        else if (req.action === "ENABLE_ADBLOCK") { enableAdBlocking(); resp({ success: true }); }
        else if (req.action === "DISABLE_ADBLOCK") { disableAdBlocking(); resp({ success: true }); }
        else if (req.action === "GET_PAGE_TEXT") {
          // Extract visible text for AI summary (cap at 15K chars)
          const text = (globalThis.document.body.innerText || "").substring(0, 15000);
          resp({ success: true, text });
        }
        else if (req.action === "SCAN_PAGE_LINKS") {
          // Only scan user-facing links (<a> tags), NOT internal resources like <script>, <embed>, etc.
          const links = Array.from(globalThis.document.querySelectorAll<HTMLAnchorElement>("a[href]"))
            .filter(el => {
              const href = el.href;
              return href && href.startsWith("http");
            }).slice(0, 100);

          const malicious: any[] = [];
          const safe: any[] = [];
          
          (async () => {
             for (const link of links) {
               const url = (link as any).href || (link as any).src;
               try {
                 const s = scanUrl(url);
                  if (s.isSafe) {
                    safe.push(s);
                  } else {
                    malicious.push(s);
                    (link as HTMLElement).style.outline = "3px solid red";
                    (link as HTMLElement).style.outlineOffset = "2px";
                    (link as HTMLElement).title = `Threat Detected: ${s.threatType}`;
                  }
               } catch (e) {
                 console.warn("[Content] Failed to scan link:", url, e);
               }
             }
             resp({ type: "WEB", success: true, linkCount: links.length, maliciousCount: malicious.length, maliciousLinks: malicious, safeLinks: safe });
          })().catch(e => {
            console.error("[Content] SCAN_PAGE_LINKS failed:", e);
            resp({ success: false, error: e.message });
          });
        }
        return true;
      });
    }
  }
}
