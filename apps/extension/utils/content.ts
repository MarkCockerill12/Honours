import { SmartFilter, DEFAULT_PROTECTION_STATE, DEFAULT_FILTERS } from "@privacy-shield/core";
import { initYouTubeAdBlocker, enableYouTubeAdBlocker, disableYouTubeAdBlocker } from "./youtubeAdBlocker";
import { scanUrl } from "./security";

// Guard against duplicate injections
if ((window as any).__PS_CONTENT_SCRIPT_LOADED) {
  console.log("[Privacy Shield] Content script already active in this tab.");
} else {
  (window as any).__PS_CONTENT_SCRIPT_LOADED = true;

  let _isProtectionActive = false;
  let _isFilteringEnabled = false;
  let _filters: SmartFilter[] = [];
  let _filterDomainExclusions: string[] = [];
  let _isAutoScanEnabled = false;
  let _isAutoTranslate = false;

  let _manualTargetLang = "en";
  let _autoTargetLang = "en";

  let _isApplying = false;
  let _isTempBypass = false;
  let _isScanInProgress = false;
  let _lastScanTime = 0; // Cooldown tracker

  const originalTexts = new WeakMap<Node, string>();
  let _isTranslationActive = false;
  let _translationStartTime = 0;
  let _cachedWordlists: Record<string, string[]> = {};
  let _translationCacheMap = new Map<string, string>();

  let _compiledRegex: RegExp | null = null;
  let _filterMap = new Map<string, SmartFilter>();

  const compileFilters = () => {
    const activeFilters = _filters.filter(f => f.enabled && (f.blockTerm.trim().length > 0 || (f.wordlistCategories && f.wordlistCategories.length > 0)));
    if (activeFilters.length === 0) { _compiledRegex = null; return; }
    const terms: string[] = []; _filterMap.clear();
    activeFilters.forEach(f => {
      let filterTerms: string[] = [];
      if (f.blockTerm.trim().length > 0 && !f.isPreset) {
        const term = f.blockTerm.toLowerCase(); filterTerms.push(term);
        _translationCacheMap.forEach((trans, key) => { if (key.includes(`:${term}`)) filterTerms.push(trans.toLowerCase()); });
      }
      if (f.wordlistCategories) f.wordlistCategories.forEach(cat => { if (_cachedWordlists[cat]) filterTerms = filterTerms.concat(_cachedWordlists[cat]); });
      filterTerms.forEach(t => {
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        terms.push(`\\b${escaped}\\b`); _filterMap.set(t.toLowerCase(), f);
      });
    });
    const uniqueTerms = Array.from(new Set(terms));
    _compiledRegex = uniqueTerms.length > 0 ? new RegExp(`(${uniqueTerms.join('|')})`, "gi") : null;
  };

  const applyFiltering = (root: Node = document.body, force: boolean = false) => {
    if (_isApplying || _isTempBypass || !_isProtectionActive || !_isFilteringEnabled || !_compiledRegex) return;
    const currentDomain = window.location.hostname.toLowerCase();
    if (_filterDomainExclusions.some(d => currentDomain === d || currentDomain.endsWith('.' + d))) return;
    
    _isApplying = true; 
    if (force) {
      // Clear existing filters to allow instant style switching
      const existing = document.querySelectorAll('[data-ps-filtered]');
      existing.forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.removeAttribute('data-ps-filtered');
        htmlEl.style.filter = "";
        htmlEl.style.backgroundColor = "";
        htmlEl.style.color = "";
        htmlEl.style.position = "";
        htmlEl.style.display = "";
        htmlEl.querySelector('.ps-kitten-cover')?.remove();
      });
    }

    observer.disconnect();
    try {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let node; const textNodes: Text[] = [];
      while ((node = walk.nextNode())) textNodes.push(node as Text);
      for (const textNode of textNodes) {
        const text = textNode.textContent; const parent = textNode.parentElement;
        if (!text || !parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.hasAttribute("data-ps-filtered")) continue;
        const matches = text.match(_compiledRegex!);
        if (matches && matches.length > 0) {
          const matchedTerm = matches[0].toLowerCase();
          const filter = _filterMap.get(matchedTerm) || { ..._filters[0], blockScope: 'word' };
          if (filter.blockScope === "page-warning") { showBlockOverlay(matchedTerm, filter.blockTerm || "Smart Filters"); break; }
          const style = filter.filterStyle || "blur";
          if (filter.blockScope === "paragraph") {
            parent.style.filter = style === "blur" ? "blur(12px)" : "none";
            if (style === "redact") { parent.style.backgroundColor = "#000"; parent.style.color = "#000"; }
            if (style === "highlight") { parent.style.backgroundColor = "#fef08a"; parent.style.color = "#854d0e"; }
            if (style === "kitten") {
              parent.style.position = "relative";
              if (getComputedStyle(parent).display === 'inline') parent.style.display = 'inline-block';
              const cover = document.createElement("div");
              // Use a viewBox-based SVG and dynamic background-size (80% of line height) to prevent clipping
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="75" font-size="80" text-anchor="middle">🐈</text></svg>`;
              const encodedSvg = encodeURIComponent(svg);
              cover.style.cssText = `position:absolute;inset:0;width:100%;height:100%;z-index:10;border-radius:inherit;background-color:#fdf2f8;background-image:url("data:image/svg+xml,${encodedSvg}");background-repeat:repeat;background-size:auto 80%;background-position:center;border:1px solid #f9a8d4;pointer-events:auto;`;
              cover.className = "ps-kitten-cover";
              parent.appendChild(cover);
            }
            parent.style.cursor = "pointer"; parent.setAttribute("data-ps-filtered", "true");
            const unblurHandler = (e: MouseEvent) => { 
              e.preventDefault(); e.stopPropagation(); 
              parent.style.filter = "none"; parent.style.backgroundColor = ""; parent.style.color = ""; parent.style.cursor = "default"; 
              parent.querySelector(".ps-kitten-cover")?.remove();
              parent.removeEventListener("click", unblurHandler, true); 
            };
            parent.addEventListener("click", unblurHandler, true);
          } else {
            const escaped = matchedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, "gi");
            const parts = text.split(regex); const fragment = document.createDocumentFragment();
            parts.forEach(part => {
              if (part.toLowerCase() === matchedTerm) {
                const span = document.createElement("span"); span.textContent = part; span.setAttribute("data-ps-filtered", "true"); span.style.cursor = "pointer";
                if (style === "blur") span.style.filter = "blur(6px)"; 
                else if (style === "redact") { span.style.backgroundColor = "#000"; span.style.color = "#000"; }
                else if (style === "highlight") { span.style.backgroundColor = "#fef08a"; span.style.color = "#854d0e"; }
                else if (style === "kitten") { span.textContent = "🐈"; span.style.backgroundColor = "#fdf2f8"; span.style.borderRadius = "4px"; span.style.padding = "0 2px"; }

                const unblurWord = (e: MouseEvent) => { 
                  e.preventDefault(); e.stopPropagation(); 
                  span.style.filter = "none"; span.style.backgroundColor = ""; span.style.color = ""; span.style.cursor = "default"; 
                  if (style === "kitten") span.textContent = part;
                  span.removeEventListener("click", unblurWord, true); 
                };
                span.addEventListener("click", unblurWord, true); fragment.appendChild(span);
              } else if (part.length > 0) fragment.appendChild(document.createTextNode(part));
            });
            parent.replaceChild(fragment, textNode);
          }
        }
      }
    } finally { _isApplying = false; observer.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  };

  const showBlockOverlay = (term: string, category: string) => {
    if (document.getElementById("ps-block-overlay")) return;
    const overlay = document.createElement("div"); overlay.id = "ps-block-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:#020617;color:#fafafa;display:flex;align-items:center;justify-content:center;z-index:2147483647;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:40px;";
    overlay.innerHTML = `
        <div style="margin-bottom:32px;padding:24px;background:rgba(129,236,255,0.1);border-radius:100%;border:2px solid rgba(129,236,255,0.2);"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#81ecff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <h1 style="color:#81ecff;margin-bottom:16px;font-size:36px;font-weight:900;">Privacy Sentinel Active</h1>
        <p style="font-size:18px;opacity:0.7;max-width:500px;margin-bottom:32px;">Page blocked due to restricted content: <b>${category}</b></p>
        <button id="ps-ignore-btn" style="padding:16px 48px;background:#81ecff;color:#020617;border:none;border-radius:14px;font-weight:900;cursor:pointer;">Continue Anyway</button>
    `;
    document.body.appendChild(overlay);
    document.getElementById("ps-ignore-btn")?.addEventListener("click", () => { _isTempBypass = true; document.getElementById("ps-block-overlay")?.remove(); document.body.style.overflow = "auto"; });
  };

  function injectAutoScanBanner(isSafe: boolean, details?: string, stats?: { total: number, warnings: number, threats: number }) {
    const existing = document.getElementById("ps-scan-banner"); if (existing) existing.remove();
    const container = document.createElement("div"); container.id = "ps-scan-banner"; container.style.cssText = "position:fixed;top:0;left:0;width:100%;z-index:2147483647;pointer-events:none;";
    const shadow = container.attachShadow({ mode: "open" });
    const banner = document.createElement("div"); banner.style.cssText = "padding:6px 20px;font-size:10px;font-weight:900;font-family:sans-serif;display:flex;align-items:center;justify-content:center;gap:16px;pointer-events:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:all 0.4s;transform:translateY(-100%);text-transform:uppercase;letter-spacing:0.08em;backdrop-filter:blur(12px);";
    
    const isScanning = details === "Scanning Page...";
    if (isScanning) {
      banner.style.backgroundColor = "rgba(15, 23, 42, 0.9)"; banner.style.color = "#81ecff"; banner.style.borderBottom = "1px solid #81ecff33";
      banner.innerHTML = `<span>Scanning Content...</span>`;
    } else if (isSafe && (!stats || stats.threats === 0)) {
      banner.style.backgroundColor = "rgba(15, 23, 42, 0.9)"; banner.style.color = "#81ecff";
      banner.innerHTML = `<span>🛡️ Connection Secure | ${stats?.total} Links Scanned</span>`;
    } else {
      const hasThreats = stats && stats.threats > 0;
      banner.style.backgroundColor = hasThreats ? "#ef4444" : "#f59e0b"; banner.style.color = "#fff";
      banner.innerHTML = `<span>⚠️ ${hasThreats ? 'CRITICAL THREATS' : 'Risks'} Found | ${stats?.threats} Unique Threats | ${stats?.warnings} Trackers</span>`;
      if (hasThreats) flashScreenRed();
    }

    const closeBtn = document.createElement("button"); closeBtn.innerText = "✕"; closeBtn.style.cssText = "background:none;border:none;color:inherit;cursor:pointer;font-weight:bold;margin-left:10px;";
    closeBtn.onclick = () => { banner.style.transform = "translateY(-100%)"; setTimeout(() => container.remove(), 400); };
    banner.appendChild(closeBtn); shadow.appendChild(banner); document.documentElement.appendChild(container);
    setTimeout(() => { banner.style.transform = "translateY(0)"; }, 100);
    if (!isScanning && (!stats || stats.threats === 0)) setTimeout(() => { banner.style.transform = "translateY(-100%)"; setTimeout(() => container.remove(), 400); }, 4000);
  }

  function flashScreenRed() {
    const flash = document.createElement("div"); flash.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:rgba(239,68,68,0.2);transition:opacity 0.8s;";
    document.body.appendChild(flash); setTimeout(() => { flash.style.opacity = "0"; setTimeout(() => flash.remove(), 800); }, 100);
  }

  async function runAutoScan() {
    const now = Date.now();
    // ENFORCE COOL-DOWN: Min 5s between auto-scans to prevent UI thrashing
    if (!_isAutoScanEnabled || _isScanInProgress || (now - _lastScanTime < 5000)) return;
    
    _isScanInProgress = true;
    _lastScanTime = now;
    injectAutoScanBanner(true, "Scanning Page...");

    const rawLinks = Array.from(document.querySelectorAll("a")).map(a => a.href).filter(h => h.startsWith('http'));
    const uniqueLinks = Array.from(new Set(rawLinks));
    const results = uniqueLinks.map(l => scanUrl(l));
    const currentUrlResult = scanUrl(window.location.href);
    
    const stats = {
      total: uniqueLinks.length,
      warnings: results.filter(r => r.threatType === 'tracker' || r.threatType === 'redirect').length,
      threats: results.filter(r => r.threatType === 'phishing' || r.threatType === 'malware').length + (!currentUrlResult.isSafe ? 1 : 0)
    };

    setTimeout(() => {
      injectAutoScanBanner(currentUrlResult.isSafe && stats.threats === 0, undefined, stats);
      _isScanInProgress = false;
    }, 1000);
  }

  let _taskTimeout: any = null;
  const observer = new MutationObserver((mutations) => {
    const isInternal = mutations.some(m => {
      const target = m.target as HTMLElement;
      return target.id?.startsWith("ps-") || (target.parentElement && target.parentElement.id?.startsWith("ps-"));
    });
    if (isInternal) return;

    clearTimeout(_taskTimeout);
    _taskTimeout = setTimeout(() => {
      if (_isProtectionActive && _isFilteringEnabled) applyFiltering();
      if (_isProtectionActive && _isAutoTranslate) runAutoTranslate();
      if (_isAutoScanEnabled) runAutoScan();
    }, 200);
  });

  async function runAutoTranslate() {
    if (!_isAutoTranslate || !_isProtectionActive || _isTranslationActive) return;

    // Enhanced language detection
    const htmlLang = (document.documentElement.lang || "").toLowerCase().split("-")[0];
    const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.getAttribute("content") || 
                     document.querySelector('meta[name="language"]')?.getAttribute("content") || "";
    const pageLang = (htmlLang || metaLang.toLowerCase().split("-")[0]);
    const targetLang = (_autoTargetLang || "en").toLowerCase().split("-")[0];
    
    if (pageLang && pageLang === targetLang) return;

    const sampleNodes = Array.from(document.querySelectorAll('p, h1, h2, h3, span, div.VwiC3b')).slice(0, 40);
    const sampleText = sampleNodes.map(n => n.textContent).join(" ").slice(0, 2000);
    if (sampleText.length > 50) performTranslation(_autoTargetLang);
  }

  const init = async () => {
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (!chrome.runtime?.id) return; // Context invalidated
        chrome.storage.local.get(["protectionState", "filters", "cachedWordlists", "isAutoTranslate", "translatorTargetLang", "translatorAutoLang", "autoscan_enabled"]).then(data => {
          _isProtectionActive = data.protectionState?.isActive ?? false;
          _isFilteringEnabled = data.protectionState?.filteringEnabled ?? false;
          _filters = data.filters ?? DEFAULT_FILTERS;
          _cachedWordlists = data.cachedWordlists ?? {};
          _isAutoTranslate = data.isAutoTranslate ?? false;
          _isAutoScanEnabled = data.autoscan_enabled === "true";
          _manualTargetLang = data.translatorTargetLang ?? "en";
          _autoTargetLang = data.translatorAutoLang ?? "en";
          compileFilters();
          if (_isProtectionActive && _isFilteringEnabled) applyFiltering(document.body, true);
          if (_isProtectionActive && _isAutoTranslate) runAutoTranslate();
          if (_isAutoScanEnabled) runAutoScan();
        });
      });
    }
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const data = await chrome.storage.local.get(["protectionState", "filters", "filterDomainExclusions", "isAutoTranslate", "translatorTargetLang", "translatorAutoLang", "cachedWordlists", "translation_cache", "autoscan_enabled"]);
      _isProtectionActive = data.protectionState?.isActive ?? false;
      _isFilteringEnabled = data.protectionState?.filteringEnabled ?? false;
      _filters = data.filters ?? DEFAULT_FILTERS;
      _isAutoTranslate = data.isAutoTranslate ?? false;
      _isAutoScanEnabled = data.autoscan_enabled === "true";
      _manualTargetLang = data.translatorTargetLang ?? "en";
      _autoTargetLang = data.translatorAutoLang ?? "en";
      _cachedWordlists = data.cachedWordlists ?? {};
      if (data.translation_cache) Object.entries(data.translation_cache).forEach(([k, v]) => _translationCacheMap.set(k, v as string));
      compileFilters();
      initYouTubeAdBlocker();
      if (_isProtectionActive && data.protectionState?.adblockEnabled) enableYouTubeAdBlocker();
      if (_isProtectionActive && _isAutoTranslate) runAutoTranslate();
      if (_isProtectionActive && _isFilteringEnabled) applyFiltering();
      if (_isAutoScanEnabled) runAutoScan();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    chrome.runtime.onMessage.addListener((request, _sender, resp) => {
      if (!chrome.runtime?.id) return false; // Context invalidated
      
      if (request.action === "TRANSLATE_PAGE") { performTranslation(request.targetLang).then(resp); return true; }
      if (request.action === "CLEAR_TRANSLATIONS") {
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node; while ((node = walk.nextNode())) { if (originalTexts.has(node)) node.textContent = originalTexts.get(node)!; if (node.parentElement?.hasAttribute("data-ps-translated")) node.parentElement.removeAttribute("data-ps-translated"); }
        _isTranslationActive = false; resp({ success: true }); return true;
      }
      if (request.action === "SCAN_PAGE_LINKS") {
        const rawLinks = Array.from(document.querySelectorAll("a")).map(a => a.href).filter(h => h.startsWith('http'));
        const uniqueLinks = Array.from(new Set(rawLinks));
        if (!uniqueLinks.includes(window.location.href)) uniqueLinks.unshift(window.location.href);
        const resultsMap = new Map<string, any>();
        uniqueLinks.forEach(l => resultsMap.set(l, scanUrl(l)));
        const allResults = Array.from(resultsMap.values());
        const threats = allResults.filter(r => !r.isSafe);
        const safe = allResults.filter(r => r.isSafe).slice(0, 50);
        resp({ type: "WEB", linkCount: uniqueLinks.length, maliciousCount: threats.length, maliciousLinks: threats.slice(0, 20), safeLinks: safe });
        return true;
      }
      if (request.action === "GET_PAGE_TEXT") { resp({ success: true, text: document.body.innerText.slice(0, 5000) }); return true; }
      if (request.action === "APPLY_FILTERS") {
        if (_isProtectionActive && _isFilteringEnabled) applyFiltering();
        resp({ success: true });
        return true;
      }
      return false;
    });
  };

  const performTranslation = async (targetLang: string) => {
    if (!chrome.runtime?.id) {
      console.warn("[Translation] Context invalidated. Please refresh the page.");
      return { success: false, error: "Please refresh the page." };
    }

    const now = Date.now();
    // Reduced lockout to 5s instead of 30s
    if (_isTranslationActive && (now - _translationStartTime < 5000)) {
      console.warn("[Translation] Already active, skipping.");
      return { success: false, error: "Active" };
    }
    
    _isTranslationActive = true; 
    _translationStartTime = now;

    try {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node; const textNodes: { node: Text; text: string }[] = []; const uniqueTexts = new Set<string>();
      while ((node = walk.nextNode())) {
        const text = node.textContent?.trim(); const parent = node.parentElement;
        if (!text || text.length < 2 || !parent || parent.tagName === "SCRIPT" || parent.tagName === "STYLE") continue;
        const currentTransLang = parent.getAttribute("data-ps-translated");
        if (currentTransLang === targetLang) continue;
        const sourceText = originalTexts.get(node) || text;
        textNodes.push({ node: node as Text, text: sourceText }); uniqueTexts.add(sourceText);
      }
      
      const uniqueTextList = Array.from(uniqueTexts); 
      const batchSize = 15;
      const translationMap = new Map<string, string>();
      
      console.log(`[Translation] Found ${uniqueTextList.length} unique texts to translate.`);
      
      for (let i = 0; i < uniqueTextList.length; i += batchSize) {
        if (!chrome.runtime?.id) break;
        const batch = uniqueTextList.slice(i, i + batchSize);
        try {
          const response = await chrome.runtime.sendMessage({ action: "TRANSLATE_TEXT", text: batch, targetLang });
          if (response?.success) {
            batch.forEach((orig, idx) => { 
              if (response.translatedTexts[idx]) translationMap.set(orig, response.translatedTexts[idx]); 
            });
          }
        } catch (err: any) { 
          if (err.message?.includes("context invalidated")) {
             injectAutoScanBanner(false, "Extension updated. Please refresh the page.");
             break;
          }
          console.error(`[Translation] Batch error:`, err.message);
        }
      }
      
      let count = 0;
      textNodes.forEach(item => {
        const trans = translationMap.get(item.text); const parent = item.node.parentElement;
        if (trans && trans !== item.text && parent) {
          if (!originalTexts.has(item.node)) originalTexts.set(item.node, item.text);
          item.node.textContent = trans; 
          parent.setAttribute("data-ps-translated", targetLang); 
          count++;
        }
      });
      
      console.log(`[Translation] Finished. Translated ${count} items.`);
      return { success: true, count };
    } finally {
      _isTranslationActive = false;
    }
  };

  init();
}
