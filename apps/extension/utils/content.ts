import { SmartFilter, DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@privacy-shield/core";
import { initYouTubeAdBlocker, enableYouTubeAdBlocker, disableYouTubeAdBlocker } from "./youtubeAdBlocker";
import { scanUrl } from "./security";

let _isProtectionActive = false;
let _isFilteringEnabled = false;
let _filters: SmartFilter[] = [];
let _filterDomainExclusions: string[] = [];
let _blurMethod: "blur" | "blackbar" | "kitten" | "warning" = "blur";
let _isAutoScanEnabled = false;
let _isAutoTranslate = false;
let _targetLang = "es";

// RECURSION & BYPASS STATE
let _isApplying = false;
let _isTempBypass = false;

// TRACKING STATE
const translatedElements = new Map<HTMLElement, string>();
let _isTranslationActive = false;

const applyFiltering = (root: Node = document.body) => {
  if (_isApplying || _isTempBypass || !_isProtectionActive || !_isFilteringEnabled || _filters.length === 0) return;
  const currentDomain = window.location.hostname.toLowerCase();
  if (_filterDomainExclusions.some(d => currentDomain === d || currentDomain.endsWith('.' + d))) return;
  if (document.getElementById("ps-block-overlay")) return;

  const activeFilters = _filters.filter(f => f.enabled && f.blockTerm.trim().length > 0);
  if (activeFilters.length === 0) return;

  _isApplying = true;
  
  // Temporary stop observation to prevent recursion during replacement
  observer.disconnect();

  try {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let node;
    let pageBlocked = false;

    // Collect all text nodes upfront so DOM mutations during processing don't invalidate the walker
    const textNodes: Text[] = [];
    while ((node = walk.nextNode())) textNodes.push(node as Text);

    for (let ni = 0; ni < textNodes.length && !pageBlocked; ni++) {
      node = textNodes[ni];
      const text = node.textContent;
      const parent = node.parentElement;
      if (!text || !parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.hasAttribute("data-ps-filtered")) continue;

      for (const filter of activeFilters) {
        if (filter.exceptWhen) {
          const currentDomain = window.location.hostname.toLowerCase();
          const safeDomains = filter.exceptWhen.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
          if (safeDomains.some(domain => currentDomain === domain || currentDomain.endsWith('.' + domain))) continue;
        }
        if (filter.unlessWord?.trim()) {
          const paragraphText = (parent?.textContent || text).toLowerCase();
          if (paragraphText.includes(filter.unlessWord.trim().toLowerCase())) continue;
        }
        if (text.toLowerCase().includes(filter.blockTerm.toLowerCase())) {
          // page-warning scope or page-warning style both trigger block
          if (filter.blockScope === "page-warning") {
            const overlay = document.createElement("div");
            overlay.id = "ps-block-overlay";
            overlay.style.cssText = "position:fixed;inset:0;background:#020617;color:#fafafa;display:flex;align-items:center;justify-content:center;z-index:2147483647;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:40px;";
            overlay.innerHTML = `
                <div style="margin-bottom:32px;padding:24px;background:rgba(129,236,255,0.1);border-radius:100%;border:2px solid rgba(129,236,255,0.2);box-shadow:0 0 40px rgba(129,236,255,0.1);">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#81ecff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h1 style="color:#81ecff;margin-bottom:16px;font-size:36px;font-weight:900;letter-spacing:0.02em;text-transform:uppercase;">Privacy Sentinel Active</h1>
                <p style="font-size:18px;opacity:0.7;max-width:500px;line-height:1.6;margin-bottom:32px;">This page has been blocked because it contains content restricted by your Smart Filters.</p>
                
                <div style="margin-bottom:40px;padding:16px 32px;background:rgba(129,236,255,0.05);border:1px solid rgba(129,236,255,0.15);border-radius:16px;display:inline-block;">
                  <span style="font-size:11px;text-transform:uppercase;font-weight:800;color:#81ecff;opacity:0.6;display:block;margin-bottom:6px;letter-spacing:0.1em;">Detection Match</span>
                  <span style="font-size:20px;font-weight:bold;color:#fff;">"${filter.blockTerm}"</span>
                </div>

                <div style="display:flex;gap:16px;width:100%;max-width:440px;justify-content:center;">
                  <button id="ps-ignore-btn" style="padding:16px 48px;background:#81ecff;color:#020617;border:none;border-radius:14px;font-weight:900;cursor:pointer;text-transform:uppercase;letter-spacing:0.05em;transition:all 0.2s;font-size:14px;box-shadow:0 8px 20px rgba(129,236,255,0.2);">Continue Anyway</button>
                </div>
            `;
            document.body.appendChild(overlay);
            document.body.style.overflow = "hidden";
            
            document.getElementById("ps-ignore-btn")?.addEventListener("click", () => {
              _isTempBypass = true;
              document.getElementById("ps-block-overlay")?.remove();
              document.body.style.overflow = "auto";
              observer.observe(document.body, { childList: true, subtree: true });
            });

            pageBlocked = true;
            break;
          } else if (filter.blockScope === "paragraph") {
            // Paragraph scope: blur/redact/kitten the parent element
            const style = filter.filterStyle || "blur";
            if (style === "blur") {
              parent.style.filter = "blur(8px)";
              parent.style.cursor = "pointer";
              parent.addEventListener("click", () => {
                parent.style.filter = "none";
                parent.style.cursor = "default";
              }, { once: true });
            } else if (style === "redact") {
              parent.style.backgroundColor = "#000";
              parent.style.color = "#000";
              parent.style.cursor = "pointer";
              parent.addEventListener("click", () => {
                parent.style.backgroundColor = "transparent";
                parent.style.color = "inherit";
                parent.style.cursor = "default";
              }, { once: true });
            } else if (style === "kitten") {
              const originalHtml = parent.innerHTML;
              const catCount = Math.max(3, Math.round((parent.textContent?.length || 20) / 4));
              parent.setAttribute("data-ps-original-html", originalHtml);
              parent.textContent = "🐱".repeat(catCount);
              parent.style.cursor = "pointer";
              parent.title = "Click to reveal";
              parent.addEventListener("click", () => {
                parent.innerHTML = parent.getAttribute("data-ps-original-html") || originalHtml;
                parent.removeAttribute("data-ps-original-html");
                parent.style.cursor = "default";
                parent.title = "";
              }, { once: true });
            }
            parent.setAttribute("data-ps-filtered", "true");
          } else {
            // Word scope (default)
            const style = filter.filterStyle || (filter.blockScope as string) || "blur";
            const escaped = filter.blockTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, "gi");
            const parts = text.split(regex);
            const fragment = document.createDocumentFragment();
            let hasMatch = false;

            parts.forEach(part => {
              if (part.toLowerCase() === filter.blockTerm.toLowerCase()) {
                hasMatch = true;
                const span = document.createElement("span");
                span.textContent = part;
                span.setAttribute("data-ps-filtered", "true");
                span.style.cursor = "pointer";
                span.style.transition = "all 0.3s ease";
                span.title = "Click to reveal";

                if (style === "blur") {
                  span.style.filter = "blur(4px)";
                } else if (style === "redact") {
                  span.style.backgroundColor = "#000";
                  span.style.color = "#000";
                  span.style.padding = "1px 4px";
                  span.style.borderRadius = "2px";
                } else if (style === "kitten") {
                  const catCount = Math.max(1, Math.round(part.length / 3));
                  span.textContent = "🐱".repeat(catCount);
                  span.setAttribute("data-ps-original", part);
                  span.style.cursor = "pointer";
                  span.title = "Click to reveal";
                } else if (style === "highlight") {
                  span.style.backgroundColor = "#fbbf24";
                  span.style.color = "#000";
                  span.style.padding = "1px 2px";
                  span.style.borderRadius = "2px";
                  span.style.fontWeight = "bold";
                  span.style.cursor = "default";
                }

                if (style !== "highlight") {
                  span.addEventListener("click", () => {
                    if (style === "kitten") {
                      span.textContent = span.getAttribute("data-ps-original") || part;
                    } else {
                      span.style.filter = "none";
                      span.style.backgroundColor = "transparent";
                      span.style.color = "inherit";
                      span.style.background = "none";
                    }
                    span.style.cursor = "default";
                    span.title = "";
                  }, { once: true });
                }

                fragment.appendChild(span);
              } else if (part.length > 0) {
                fragment.appendChild(document.createTextNode(part));
              }
            });

            if (hasMatch) {
              parent.replaceChild(fragment, node);
            }
          }
          break;
        }
      }
    }
  } finally {
    _isApplying = false;
    // Resume observation if page wasn't blocked
    if (!document.getElementById("ps-block-overlay")) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
};

const observer = new MutationObserver((mutations) => {
  if (!_isProtectionActive || !_isFilteringEnabled) return;
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        applyFiltering(node);
      }
    }
  }
});

function injectAutoScanBanner(isSafe: boolean, details?: string, stats?: { total: number, warnings: number, threats: number }) {
  const existing = document.getElementById("ps-scan-banner");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "ps-scan-banner";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.zIndex = "2147483647";
  container.style.pointerEvents = "none";

  const shadow = container.attachShadow({ mode: "open" });
  
  const banner = document.createElement("div");
  banner.style.padding = "6px 20px";
  banner.style.fontSize = "10px";
  banner.style.fontWeight = "900";
  banner.style.fontFamily = "system-ui, -apple-system, sans-serif";
  banner.style.display = "flex";
  banner.style.alignItems = "center";
  banner.style.justifyContent = "center";
  banner.style.gap = "16px";
  banner.style.pointerEvents = "auto";
  banner.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
  banner.style.transition = "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
  banner.style.transform = "translateY(-100%)";
  banner.style.textTransform = "uppercase";
  banner.style.letterSpacing = "0.08em";
  banner.style.backdropFilter = "blur(12px)";

  const isScanning = details === "Scanning Page...";

  if (isScanning) {
    banner.style.backgroundColor = "rgba(15, 23, 42, 0.9)";
    banner.style.color = "#81ecff";
    banner.style.borderBottom = "1px solid rgba(129, 236, 255, 0.2)";
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation: ps-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span>Scanning Content...</span>
      </div>
    `;
  } else if (isSafe && (!stats || stats.threats === 0)) {
    banner.style.backgroundColor = "rgba(15, 23, 42, 0.9)";
    banner.style.color = "#81ecff";
    banner.style.borderBottom = "1px solid rgba(129, 236, 255, 0.2)";
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Connection Secure</span>
        </div>
        <div style="width:1px;height:12px;background:rgba(129,236,255,0.2);"></div>
        <div style="display:flex;gap:10px;opacity:0.8;">
          <span>${stats?.total} Links</span>
          <span style="color:${stats?.warnings ? '#fbbf24' : 'inherit'}">${stats?.warnings} Trackers</span>
        </div>
      </div>
    `;
  } else {
    const hasThreats = stats && stats.threats > 0;
    banner.style.backgroundColor = hasThreats ? "rgba(239, 68, 68, 0.95)" : "rgba(129, 236, 255, 0.95)";
    banner.style.color = hasThreats ? "#ffffff" : "#020617";
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>${hasThreats ? 'CRITICAL THREATS FOUND' : 'Potential Risks'}</span>
        </div>
        <div style="width:1px;height:12px;background:rgba(0,0,0,0.1);"></div>
        <div style="display:flex;gap:10px;">
          <span>${stats?.total} Scanned</span>
          <span style="font-weight:900;">${stats?.threats} Threats</span>
          <span>${stats?.warnings} Trackers</span>
        </div>
      </div>
    `;

    if (hasThreats) {
      flashScreenRed();
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    @keyframes ps-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes ps-flash-red { 
      0% { background: transparent; }
      20% { background: rgba(239, 68, 68, 0.4); }
      100% { background: transparent; }
    }
  `;
  shadow.appendChild(style);

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "✕";
  closeBtn.style.background = "none";
  closeBtn.style.border = "none";
  closeBtn.style.color = "inherit";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.fontSize = "12px";
  closeBtn.style.fontWeight = "bold";
  closeBtn.style.marginLeft = "10px";
  closeBtn.onclick = () => { banner.style.transform = "translateY(-100%)"; setTimeout(() => container.remove(), 400); };
  banner.appendChild(closeBtn);

  shadow.appendChild(banner);
  document.documentElement.appendChild(container);

  setTimeout(() => {
    banner.style.transform = "translateY(0)";
  }, 100);

  if (!isScanning && (!stats || stats.threats === 0)) {
    setTimeout(() => {
      banner.style.transform = "translateY(-100%)";
      setTimeout(() => container.remove(), 400);
    }, 5000);
  }
}

function flashScreenRed() {
  const flash = document.createElement("div");
  flash.style.position = "fixed";
  flash.style.inset = "0";
  flash.style.zIndex = "2147483646";
  flash.style.pointerEvents = "none";
  flash.style.animation = "ps-flash-red 0.8s ease-out forwards";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1000);
}

async function runAutoScan() {
  if (!_isAutoScanEnabled || !_isProtectionActive) return;
  
  injectAutoScanBanner(true, "Scanning Page...");
  
  // Collect and scan links
  const links = Array.from(document.querySelectorAll("a")).map(a => a.href).filter(h => h.startsWith('http'));
  const results = links.map(l => scanUrl(l));
  const currentUrlResult = scanUrl(window.location.href);
  
  const stats = {
    total: links.length,
    warnings: results.filter(r => r.threatType === 'tracker' || r.threatType === 'redirect').length,
    threats: results.filter(r => r.threatType === 'phishing' || r.threatType === 'malware').length + (!currentUrlResult.isSafe && currentUrlResult.isMalicious ? 1 : 0)
  };
  
  const isPageSafe = currentUrlResult.isSafe && stats.threats === 0;

  setTimeout(() => {
    injectAutoScanBanner(isPageSafe, isPageSafe ? undefined : currentUrlResult.details, stats);
  }, 1200);
}

async function runAutoTranslate() {
  if (!_isAutoTranslate || !_isProtectionActive) return;
  
  const docLang = document.documentElement.lang?.toLowerCase().split('-')[0];
  if (docLang && docLang !== _targetLang && docLang !== "und") {
    console.log(`[Content] Auto-translating from ${docLang} to ${_targetLang}`);
    performTranslation(_targetLang);
  }
}

// MAIN INITIALIZATION
const init = async () => {
  // Listen for storage changes
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.autoscan_enabled) {
        _isAutoScanEnabled = changes.autoscan_enabled.newValue === "true";
        if (_isAutoScanEnabled && _isProtectionActive) runAutoScan();
      }
      if (changes.protectionState) {
        const oldState = _isFilteringEnabled;
        _isProtectionActive = changes.protectionState.newValue?.isActive ?? false;
        _isFilteringEnabled = changes.protectionState.newValue?.filteringEnabled ?? false;
        
        // Handle instant toggle reaction
        if (_isProtectionActive && _isFilteringEnabled) {
          applyFiltering(document.body);
          observer.observe(document.body, { childList: true, subtree: true });
        } else if (oldState && !_isFilteringEnabled) {
          document.getElementById("ps-block-overlay")?.remove();
          document.body.style.overflow = "auto";
          observer.disconnect();
        }
      }
      if (changes.filters) {
        _filters = changes.filters.newValue || [];
        if (_isProtectionActive && _isFilteringEnabled) applyFiltering(document.body);
      }
      if (changes.filterDomainExclusions) {
        _filterDomainExclusions = changes.filterDomainExclusions.newValue || [];
      }
    });
  }

  // Sync state from storage
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    const data = await chrome.storage.local.get(["protectionState", "filters", "filterDomainExclusions", "blurMethod", "autoscan_enabled", "isAutoTranslate", "translatorAutoLang", "translatorTargetLang"]);
    _isProtectionActive = data.protectionState?.isActive ?? false;
    _isFilteringEnabled = data.protectionState?.filteringEnabled ?? false;
    _filters = data.filters ?? DEFAULT_FILTERS;
    _filterDomainExclusions = data.filterDomainExclusions ?? [];
    _blurMethod = data.blurMethod ?? "blur";
    _isAutoScanEnabled = data.autoscan_enabled === "true";
    _isAutoTranslate = data.isAutoTranslate ?? false;
    _targetLang = data.translatorAutoLang ?? data.translatorTargetLang ?? "es";

    if (_isProtectionActive) {
      initYouTubeAdBlocker();
      if (data.protectionState?.adblockEnabled) enableYouTubeAdBlocker();
      runAutoScan();
      runAutoTranslate();
      if (_isFilteringEnabled) {
        applyFiltering();
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  }

  const handleMessage = (request: any, _sender: any, resp: any) => {
    if (request.action === "PING") {
      resp({ pong: true });
      return;
    }

    if (request.action === "APPLY_FILTERS") {
      _isProtectionActive = request.isActive;
      _isFilteringEnabled = request.filteringEnabled;
      _filters = request.filters || _filters;
      _blurMethod = request.blurMethod || _blurMethod;
      
      if (_isProtectionActive && _isFilteringEnabled) {
        applyFiltering(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.getElementById("ps-block-overlay")?.remove();
        document.body.style.overflow = "auto";
        observer.disconnect();
      }
      
      resp({ success: true });
      return;
    }

    if (request.action === "GET_PAGE_TEXT") {
      resp({ success: true, text: document.body.innerText });
      return;
    }

    if (request.action === "TRANSLATE_PAGE") {
      performTranslation(request.targetLang).then(resp);
      return true;
    }

    if (request.action === "CLEAR_TRANSLATIONS") {
      clearTranslations(resp);
      return true;
    }

    if (request.action === "SCAN_PAGE_LINKS") {
      const links = Array.from(document.querySelectorAll("a")).map(a => a.href);
      const results = links.map(l => scanUrl(l));
      resp({
        type: "WEB",
        linkCount: results.length,
        maliciousCount: results.filter(r => !r.isSafe).length,
        maliciousLinks: results.filter(r => !r.isSafe),
        safeLinks: results.filter(r => r.isSafe)
      });
      return;
    }
  };

  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(handleMessage);
  }
};

const performTranslation = async (targetLang: string) => {
  if (_isTranslationActive) {
    // Allow manual re-translation to override a previous auto-translate
    if (_isAutoTranslate) {
      translatedElements.clear();
      _isTranslationActive = false;
    } else {
      return { success: false, error: "Already active" };
    }
  }
  _isTranslationActive = true;

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node;
  const textNodes: { node: Node; text: string }[] = [];

  while ((node = walk.nextNode())) {
    const text = node.textContent?.trim();
    if (text && text.length > 3 && node.parentElement?.tagName !== "SCRIPT" && node.parentElement?.tagName !== "STYLE") {
      textNodes.push({ node, text });
    }
  }

  const batchSize = 10;
  let count = 0;
  for (let i = 0; i < textNodes.length; i += batchSize) {
    const batch = textNodes.slice(i, i + batchSize);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "TRANSLATE_TEXT",
        text: batch.map(b => b.text),
        targetLang
      });

      if (response?.success) {
        batch.forEach((b, idx) => {
          if (response.translatedTexts[idx]) {
            translatedElements.set(b.node as any, b.text);
            b.node.textContent = response.translatedTexts[idx];
            count++;
          }
        });
      }
    } catch (err) {
      console.error("Translation failed", err);
    }
  }

  return { success: true, count };
};

const clearTranslations = (resp: any) => {
  translatedElements.forEach((originalText, element) => { element.textContent = originalText; });
  translatedElements.clear();
  _isTranslationActive = false;
  resp({ success: true });
};

init();
