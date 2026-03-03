import { SmartFilter } from '../../../packages/ui/types';
import { initYouTubeAdBlocker } from './youtubeAdBlocker';
import { AD_SELECTORS } from './adBlockEngine';

// Track if filters are currently active
let filtersActive = false;
let appliedElements: HTMLElement[] = [];
let adBlockingActive = false;
let pageWarningOverlay: HTMLElement | null = null;

console.log('[Content] Content script loaded on:', window.location.href);

// Discovery for dev mode
if (window.location.hostname === 'localhost') {
    console.log('[Content] Broadcasting extension ID for dev bridge...');
    window.postMessage({ type: 'SET_EXTENSION_ID', id: chrome.runtime.id }, '*');
}

// Initialize YouTube ad blocker if on YouTube
if (window.location.hostname.includes('youtube.com')) {
  console.log('[Content] YouTube detected, initializing ad blocker...');
  // Delay to let page load
  setTimeout(() => {
    initYouTubeAdBlocker();
  }, 1000);
}

// Clear all applied filters
export const clearBlurContent = () => {
  console.log('[Content] Clearing all content filters...');
  appliedElements.forEach(el => {
    if (el.parentNode) {
      const textNode = document.createTextNode(el.getAttribute('data-original-text') || el.textContent || '');
      el.parentNode.replaceChild(textNode, el);
    }
  });
  appliedElements = [];
  filtersActive = false;
  
  // Remove page warning overlay if present
  if (pageWarningOverlay && pageWarningOverlay.parentNode) {
    pageWarningOverlay.parentNode.removeChild(pageWarningOverlay);
    pageWarningOverlay = null;
  }
  
  console.log('[Content] All filters cleared');
};

// Apply styling to a span based on blur method
const applyBlurMethodToSpan = (span: HTMLElement, originalText: string, blurMethod: string) => {
  span.setAttribute('data-original-text', originalText);
  span.setAttribute('data-content-filtered', 'true');

  switch (blurMethod) {
    case 'blackbar': {
      // Redacted black bar
      span.textContent = '█'.repeat(Math.min(originalText.length, 40));
      span.style.backgroundColor = '#000';
      span.style.color = '#000';
      span.style.cursor = 'pointer';
      span.style.borderRadius = '2px';
      span.style.padding = '0 2px';
      span.title = 'Click to reveal redacted content';
      span.onclick = () => {
        span.textContent = originalText;
        span.style.backgroundColor = 'transparent';
        span.style.color = 'inherit';
      };
      break;
    }
    case 'warning': {
      // Warning label replacement
      span.textContent = '⚠️ [Content Filtered]';
      span.style.backgroundColor = 'rgba(234,179,8,0.15)';
      span.style.color = '#ca8a04';
      span.style.border = '1px solid rgba(234,179,8,0.3)';
      span.style.borderRadius = '4px';
      span.style.padding = '2px 6px';
      span.style.fontSize = '0.85em';
      span.style.fontWeight = 'bold';
      span.style.cursor = 'pointer';
      span.title = 'Click to reveal filtered content';
      span.onclick = () => {
        span.textContent = originalText;
        span.style.backgroundColor = 'transparent';
        span.style.color = 'inherit';
        span.style.border = 'none';
        span.style.fontWeight = 'normal';
        span.style.padding = '0';
      };
      break;
    }
    case 'kitten': {
      // Replace with kitten emoji/text
      span.textContent = '🐱'.repeat(Math.min(Math.ceil(originalText.length / 5), 8)) + ' meow!';
      span.style.cursor = 'pointer';
      span.style.backgroundColor = 'rgba(244,114,182,0.1)';
      span.style.borderRadius = '4px';
      span.style.padding = '2px 4px';
      span.title = 'Click to reveal original content';
      span.onclick = () => {
        span.textContent = originalText;
        span.style.backgroundColor = 'transparent';
      };
      break;
    }
    case 'blur':
    default: {
      // Default blur
      span.textContent = originalText;
      span.style.filter = 'blur(6px)';
      span.style.cursor = 'pointer';
      span.style.transition = 'filter 0.3s';
      span.style.userSelect = 'none';
      span.onclick = () => { 
        span.style.filter = 'none'; 
        span.style.userSelect = 'text';
      };
      break;
    }
  }
};

// Show a full-page warning overlay before allowing the user to see content
const showPageWarning = (matchedTerms: string[], blurMethod: string) => {
  console.log('[Content] Showing page warning for terms:', matchedTerms);
  
  // Remove existing overlay if present
  if (pageWarningOverlay && pageWarningOverlay.parentNode) {
    pageWarningOverlay.parentNode.removeChild(pageWarningOverlay);
  }
  
  pageWarningOverlay = document.createElement('div');
  pageWarningOverlay.id = 'content-filter-page-warning';
  pageWarningOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999999;
    background: rgba(0,0,0,0.92); backdrop-filter: blur(20px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff; text-align: center; padding: 24px;
  `;
  
  const iconSize = blurMethod === 'kitten' ? '🐱' : '⚠️';
  const bgColor = blurMethod === 'kitten' ? 'rgba(244,114,182,0.2)' : 'rgba(234,179,8,0.2)';
  const borderColor = blurMethod === 'kitten' ? 'rgba(244,114,182,0.5)' : 'rgba(234,179,8,0.5)';
  const accentColor = blurMethod === 'kitten' ? '#f472b6' : '#eab308';
  
  pageWarningOverlay.innerHTML = `
    <div style="max-width: 480px; margin: 0 auto;">
      <div style="font-size: 64px; margin-bottom: 16px;">${iconSize}</div>
      <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 8px; color: ${accentColor};">
        Content Warning
      </h1>
      <p style="font-size: 14px; color: #a1a1aa; margin-bottom: 24px; line-height: 1.6;">
        This page contains content matching your filter rules.<br/>
        Detected terms: <strong style="color: #fff;">${matchedTerms.join(', ')}</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button id="page-warning-proceed" style="
          padding: 12px 32px; border-radius: 12px; font-weight: 700; font-size: 14px;
          background: ${bgColor}; color: ${accentColor}; border: 1px solid ${borderColor};
          cursor: pointer; transition: all 0.2s;
        ">Proceed Anyway</button>
        <button id="page-warning-goback" style="
          padding: 12px 32px; border-radius: 12px; font-weight: 700; font-size: 14px;
          background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer; transition: all 0.2s;
        ">Go Back</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(pageWarningOverlay);
  appliedElements.push(pageWarningOverlay);
  
  // Attach event listeners
  const proceedBtn = document.getElementById('page-warning-proceed');
  const goBackBtn = document.getElementById('page-warning-goback');
  
  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      if (pageWarningOverlay && pageWarningOverlay.parentNode) {
        pageWarningOverlay.parentNode.removeChild(pageWarningOverlay);
        pageWarningOverlay = null;
      }
    });
    proceedBtn.addEventListener('mouseenter', () => { proceedBtn.style.transform = 'scale(1.05)'; });
    proceedBtn.addEventListener('mouseleave', () => { proceedBtn.style.transform = 'scale(1)'; });
  }
  if (goBackBtn) {
    goBackBtn.addEventListener('click', () => {
      window.history.back();
    });
    goBackBtn.addEventListener('mouseenter', () => { goBackBtn.style.transform = 'scale(1.05)'; });
    goBackBtn.addEventListener('mouseleave', () => { goBackBtn.style.transform = 'scale(1)'; });
  }
  
  return 1; // One "element" affected (the overlay)
};

// Block an entire paragraph element
const blockParagraph = (textNode: Text, blurMethod: string): HTMLElement | null => {
  // Walk up to find the nearest block-level parent (p, div, li, td, blockquote, etc.)
  let blockParent: HTMLElement | null = textNode.parentElement;
  const blockTags = ['P', 'DIV', 'LI', 'TD', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'FIGCAPTION', 'DD', 'DT'];
  
  while (blockParent && !blockTags.includes(blockParent.tagName)) {
    blockParent = blockParent.parentElement;
  }
  
  if (!blockParent) {
    // Fallback: use immediate parent
    blockParent = textNode.parentElement;
  }
  
  if (!blockParent || blockParent.hasAttribute('data-content-filtered')) return null;
  
  const originalHTML = blockParent.innerHTML;
  const originalText = blockParent.innerText || blockParent.textContent || '';
  blockParent.setAttribute('data-content-filtered', 'true');
  blockParent.setAttribute('data-original-html', originalHTML);
  blockParent.setAttribute('data-original-text', originalText);
  
  switch (blurMethod) {
    case 'blackbar':
      blockParent.style.backgroundColor = '#000';
      blockParent.style.color = '#000';
      blockParent.style.borderRadius = '4px';
      blockParent.style.cursor = 'pointer';
      blockParent.title = 'Click to reveal redacted content';
      blockParent.onclick = () => {
        blockParent!.style.backgroundColor = '';
        blockParent!.style.color = '';
        blockParent!.removeAttribute('data-content-filtered');
      };
      break;
    case 'warning':
      blockParent.innerHTML = '<div style="background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.3);border-radius:8px;padding:12px;color:#ca8a04;font-weight:bold;font-size:0.9em;cursor:pointer;" title="Click to reveal">⚠️ This paragraph has been filtered due to content rules</div>';
      blockParent.querySelector('div')!.onclick = () => {
        blockParent!.innerHTML = originalHTML;
        blockParent!.removeAttribute('data-content-filtered');
      };
      break;
    case 'kitten':
      blockParent.innerHTML = '<div style="background:rgba(244,114,182,0.1);border-radius:8px;padding:12px;cursor:pointer;font-size:1.2em;" title="Click to reveal">🐱🐱🐱 This content has been replaced with kittens! 🐱🐱🐱<br/><span style="font-size:0.7em;color:#f472b6;">Click to reveal original content</span></div>';
      blockParent.querySelector('div')!.onclick = () => {
        blockParent!.innerHTML = originalHTML;
        blockParent!.removeAttribute('data-content-filtered');
      };
      break;
    case 'blur':
    default:
      blockParent.style.filter = 'blur(8px)';
      blockParent.style.cursor = 'pointer';
      blockParent.style.transition = 'filter 0.3s';
      blockParent.style.userSelect = 'none';
      blockParent.onclick = () => {
        blockParent!.style.filter = 'none';
        blockParent!.style.userSelect = '';
        blockParent!.removeAttribute('data-content-filtered');
      };
      break;
  }
  
  return blockParent;
};

// Replace just the matched word within a text node (keeping surrounding text intact)
const blockWord = (textNode: Text, filter: SmartFilter, blurMethod: string): HTMLElement[] => {
  const text = textNode.textContent || '';
  const regex = new RegExp(`(${filter.blockTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  if (parts.length <= 1) return []; // No match
  
  const fragment = document.createDocumentFragment();
  const createdSpans: HTMLElement[] = [];
  
  parts.forEach(part => {
    if (regex.test(part) || part.toLowerCase() === filter.blockTerm.toLowerCase()) {
      const span = document.createElement('span');
      applyBlurMethodToSpan(span, part, blurMethod);
      fragment.appendChild(span);
      createdSpans.push(span);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  });
  
  textNode.replaceWith(fragment);
  return createdSpans;
};

// content script to handle blurring and scanning
export const blurContent = (rootElement: HTMLElement, filters: SmartFilter[], blurMethod: string = 'blur') => {
  console.log('[Content] blurContent called with filters:', filters, 'method:', blurMethod);
  
  if (!filters || filters.length === 0) {
    console.log('[Content] No filters provided');
    return 0;
  }

  const activeFilters = filters.filter(f => f.enabled);
  if (activeFilters.length === 0) {
    console.log('[Content] No active filters');
    return 0;
  }

  console.log('[Content] Active filters:', activeFilters);
  
  // Check for page-warning scope filters first
  const pageWarningFilters = activeFilters.filter(f => f.blockScope === 'page-warning');
  if (pageWarningFilters.length > 0) {
    const pageText = (rootElement.innerText || rootElement.textContent || '').toLowerCase();
    const matchedTerms: string[] = [];
    
    for (const filter of pageWarningFilters) {
      if (pageText.includes(filter.blockTerm.toLowerCase())) {
        let shouldWarn = true;
        if (filter.exceptWhen && pageText.includes(filter.exceptWhen.toLowerCase())) {
          shouldWarn = false;
        }
        if (shouldWarn) {
          matchedTerms.push(filter.blockTerm);
        }
      }
    }
    
    if (matchedTerms.length > 0) {
      const warningCount = showPageWarning(matchedTerms, blurMethod);
      // Also process non-page-warning filters on the page
      const remainingFilters = activeFilters.filter(f => f.blockScope !== 'page-warning');
      if (remainingFilters.length > 0) {
        return warningCount + processInlineFilters(rootElement, remainingFilters, blurMethod);
      }
      return warningCount;
    }
  }
  
  // Process inline filters (word and paragraph scope)
  const inlineFilters = activeFilters.filter(f => f.blockScope !== 'page-warning');
  return processInlineFilters(rootElement, inlineFilters, blurMethod);
};

// Process word-level and paragraph-level filters
const processInlineFilters = (rootElement: HTMLElement, filters: SmartFilter[], blurMethod: string): number => {
  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToProcess: { textNode: Text; filter: SmartFilter }[] = [];
  let node;

  // 1. Scan phase (Performance: Don't modify DOM while walking)
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const textContent = textNode.textContent?.toLowerCase() || '';
    
    // Skip script/style tags
    const parentTag = textNode.parentElement?.tagName;
    if (parentTag && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentTag)) continue;
    
    // Skip already-filtered elements
    if (textNode.parentElement?.hasAttribute('data-content-filtered')) continue;

    for (const filter of filters) {
      if (textContent.includes(filter.blockTerm.toLowerCase())) {
        let shouldBlock = true;
        
        if (filter.exceptWhen) {
          // Check paragraph context (up to 2 levels up to find a container)
          const contextElement = textNode.parentElement;
          const contextText = contextElement?.innerText?.toLowerCase() || contextElement?.textContent?.toLowerCase() || '';
          
          if (contextText.includes(filter.exceptWhen.toLowerCase())) {
            shouldBlock = false;
          }
        }

        if (shouldBlock) {
          nodesToProcess.push({ textNode, filter });
          break;
        }
      }
    }
  }

  console.log(`[Content] Found ${nodesToProcess.length} text nodes to apply ${blurMethod} to`);

  // 2. Mutation phase — apply selected method based on scope
  let affectedCount = 0;
  const processedParagraphs = new Set<HTMLElement>();
  
  nodesToProcess.forEach(({ textNode, filter }) => {
    const scope: string = filter.blockScope || 'word'; // Default to 'word' as the finest grain

    switch (scope) {
      case 'paragraph': {
        const paragraphEl = blockParagraph(textNode, blurMethod);
        if (paragraphEl && !processedParagraphs.has(paragraphEl)) {
          processedParagraphs.add(paragraphEl);
          appliedElements.push(paragraphEl);
          affectedCount++;
        }
        break;
      }
      case 'word': {
        const wordSpans = blockWord(textNode, filter, blurMethod);
        wordSpans.forEach(span => appliedElements.push(span));
        affectedCount += wordSpans.length;
        break;
      }
      default: {
        // Legacy behavior: replace entire text node
        const span = document.createElement('span');
        const originalText = textNode.textContent || '';
        applyBlurMethodToSpan(span, originalText, blurMethod);
        textNode.replaceWith(span);
        appliedElements.push(span);
        affectedCount++;
        break;
      }
    }
  });
  
  filtersActive = true;
  console.log(`[Content] Applied ${blurMethod} (scope-aware) to ${affectedCount} elements`);
  return affectedCount; // Return stats for the UI
};

import { scanUrl } from './security';

// Track translated elements so we can revert if needed
let translatedElements: Map<HTMLElement, string> = new Map();
let isTranslationActive = false;

// Clear all translations and restore original text
export const clearTranslations = () => {
  console.log('[Content] Clearing all translations...');
  translatedElements.forEach((originalText, element) => {
    if (element.parentNode) {
      const textNode = document.createTextNode(originalText);
      element.parentNode.replaceChild(textNode, element);
    }
  });
  translatedElements.clear();
  isTranslationActive = false;
  console.log('[Content] All translations cleared');
};

// Real Translation using Google Translate API (proxied via background)
const translateTextNodeReal = async (textNode: Text, targetLang: string): Promise<boolean> => {
    const text = textNode.textContent;
    if (!text?.trim()) return false;
    
    console.log(`[Content] Translating text: "${text.substring(0, 50)}..." to ${targetLang}`);

    return new Promise((resolve) => {
      // Send to background to fetch from API (avoids CORS in content script)
      chrome.runtime.sendMessage({ 
          action: 'TRANSLATE_TEXT', 
          text: text, 
          targetLang: targetLang 
      }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Content] Translation error:', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          
          if (response?.success) {
              console.log(`[Content] Translation successful: "${response.translatedText.substring(0, 50)}..."`);
              
              // Replace text node with span containing translated text
              const span = document.createElement('span');
              const originalText = text;
              span.textContent = response.translatedText;
              span.dataset.originalText = originalText;
              span.dataset.translated = 'true';
              span.style.display = 'inline';
              span.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
              span.style.borderRadius = '2px';
              span.title = `Original: ${originalText}`;
              
              textNode.replaceWith(span);
              translatedElements.set(span, originalText);
              resolve(true);
          } else {
            console.error('[Content] Translation failed:', response?.error);
            resolve(false);
          }
      });
    });
};

export const translatePage = async (rootElement: HTMLElement, targetLang: string): Promise<number> => {
  console.log(`[Content] Starting page translation to ${targetLang}`);
  console.log('[Content] Root element:', rootElement.tagName);
  
  // Check if it's a PDF
  const isPDF = document.contentType === 'application/pdf' || window.location.href.toLowerCase().endsWith('.pdf');
  console.log('[Content] Is PDF:', isPDF);
  
  if (isPDF) {
    console.log('[Content] PDF detected - attempting to extract text from PDF viewer');
    // Try to find text in PDF.js viewer
    const textLayer = document.querySelector('.textLayer');
    if (textLayer) {
      rootElement = textLayer as HTMLElement;
      console.log('[Content] Found PDF textLayer, using it as root');
    }
  }

  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToTranslate: Text[] = [];
  let nodeEntry;

  while ((nodeEntry = walker.nextNode())) {
    const textNode = nodeEntry as Text;
    // Skip script/style tags and empty specific nodes
    const parentTag = textNode.parentElement?.tagName;
    if (textNode.textContent?.trim() && parentTag && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentTag)) {
        // Limit text length to avoid huge payloads to free API
        if (textNode.textContent.length < 500) {
            nodesToTranslate.push(textNode);
        }
    }
  }

  console.log(`[Content] Found ${nodesToTranslate.length} text nodes to translate`);

  // Iterate and translate (api calls are async)
  let successCount = 0;
  for (let i = 0; i < nodesToTranslate.length; i++) {
    const textNode = nodesToTranslate[i];
    // Stagger requests slightly to avoid instant rate limit
    await new Promise(resolve => setTimeout(resolve, i * 100)); // 100ms delay between requests
    const success = await translateTextNodeReal(textNode, targetLang);
    if (success) successCount++;
  }

  isTranslationActive = true;
  console.log(`[Content] Translation complete. Successfully translated ${successCount}/${nodesToTranslate.length} elements`);
  return successCount;
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Received message:', request.action);
  
  if (request.action === "TRANSLATE_PAGE") {
    console.log('[Content] TRANSLATE_PAGE action triggered with targetLang:', request.targetLang);
    translatePage(document.body, request.targetLang).then(count => {
      console.log(`[Content] Translation completed, count: ${count}`);
      sendResponse({ success: true, count });
    }).catch(error => {
      console.error('[Content] Translation error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "CLEAR_TRANSLATIONS") {
    console.log('[Content] CLEAR_TRANSLATIONS action triggered');
    clearTranslations();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "APPLY_FILTERS") {
    console.log('[Content] APPLY_FILTERS action triggered with filters:', request.filters, 'method:', request.blurMethod);
    const count = blurContent(document.body, request.filters, request.blurMethod || 'blur');
    console.log(`[Content] Applied filters, affected count: ${count}`);
    sendResponse({ success: true, count });
    return true;
  }
  
  if (request.action === "CLEAR_FILTERS") {
    console.log('[Content] CLEAR_FILTERS action triggered');
    clearBlurContent();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "EXTRACT_TEXT") {
    console.log('[Content] EXTRACT_TEXT action triggered');
    const content = document.body.innerText || document.body.textContent;
    const result = { 
      text: content,
      type: document.contentType,
      url: globalThis.location.href
    };
    console.log('[Content] Extracted text, length:', content?.length);
    sendResponse(result);
    return true;
  }

  if (request.action === "SCAN_PAGE_LINKS") {
    console.log('[Content] SCAN_PAGE_LINKS action triggered');
    
    // 1. PDF Handling
    if (document.contentType === 'application/pdf' || globalThis.location.href.endsWith('.pdf')) {
      console.log('[Content] PDF detected, returning PDF scan result');
      sendResponse({
        type: 'PDF',
        linkCount: 0,
        maliciousCount: 0,
        maliciousLinks: [],
        safeLinks: []
      });
      return true;
    }

    // 2. Web Page Handling
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    console.log(`[Content] Found ${links.length} links on page`);
    
    const safeLinks: any[] = [];
    const maliciousLinks: any[] = [];

    // Promisify the scan to handle async chrome.runtime.sendMessage
    const scanLink = (link: HTMLAnchorElement) => {
      return new Promise<void>((resolve) => {
        // 1. Fast Local Heuristic Scan
        const localScan = scanUrl(link.href);
        console.log(`[Content] Local scan for ${link.href}:`, localScan.isSafe ? 'SAFE' : 'THREAT');
        
        if (!localScan.isSafe) {
             maliciousLinks.push(localScan);
             link.style.border = "2px solid red";
             link.style.padding = "2px";
             link.title = `⚠️ THREAT: ${localScan.details}`;
             link.dataset.scanned = 'threat';
             link.dataset.threatType = localScan.threatType;
             link.dataset.threatDetails = localScan.details || '';
             resolve();
             return;
        }

        // 2. Async Background Check (Real DB)
        chrome.runtime.sendMessage({ action: 'CHECK_URL_REAL', url: link.href }, (response) => {
           if (chrome.runtime.lastError || !response) {
               // Fallback if background fails
               console.log(`[Content] Background check failed for ${link.href}, using local scan`);
               safeLinks.push(localScan); 
               link.dataset.scanned = 'safe';
               resolve();
               return;
           }
           
           console.log(`[Content] Background scan for ${link.href}:`, response.isSafe ? 'SAFE' : 'THREAT');
           
           if (response.isSafe) {
               safeLinks.push(response);
               link.dataset.scanned = 'safe';
           } else {
               maliciousLinks.push(response);
               link.style.border = "2px solid red";
               link.style.padding = "2px";
               link.title = `⚠️ THREAT: ${response.details}`;
               link.dataset.scanned = 'threat';
               link.dataset.threatType = response.threatType;
               link.dataset.threatDetails = response.details || '';
           }
           resolve();
        });
      });
    };

    // Execute scans in parallel (limited by browser message passing)
    Promise.all(links.map(scanLink)).then(() => {
        console.log(`[Content] Scan complete - Total: ${links.length}, Safe: ${safeLinks.length}, Threats: ${maliciousLinks.length}`);
        sendResponse({
            type: 'WEB',
            linkCount: links.length,
            maliciousCount: maliciousLinks.length,
            maliciousLinks,
            safeLinks
        });
    });

    return true; // Indicates we will sendResponse asynchronously
  }
  
  // Enable ad blocking (hide ad elements)
  if (request.action === 'ENABLE_ADBLOCK') {
    console.log('[Content] Enabling ad blocking...');
    enableAdBlocking();
    sendResponse({ success: true });
    return true;
  }
  
  // Disable ad blocking
  if (request.action === 'DISABLE_ADBLOCK') {
    console.log('[Content] Disabling ad blocking...');
    disableAdBlocking();
    sendResponse({ success: true });
    return true;
  }
});

// Ad blocking functions
const enableAdBlocking = () => {
  if (adBlockingActive) {
    console.log('[Content] Ad blocking already active');
    return;
  }
  
  console.log('[Content] Hiding ad elements...');
  adBlockingActive = true;
  
  // Hide ad elements using CSS selectors
  hideAdElements();
  
  // Setup mutation observer to hide dynamically loaded ads
  setupAdBlockObserver();
};

const disableAdBlocking = () => {
  if (!adBlockingActive) {
    console.log('[Content] Ad blocking already disabled');
    return;
  }
  
  console.log('[Content] Showing ad elements...');
  adBlockingActive = false;
  
  // Show previously hidden ads (remove data attributes)
  const hiddenAds = document.querySelectorAll('[data-ad-hidden="true"]');
  hiddenAds.forEach(ad => {
    (ad as HTMLElement).style.display = '';
    ad.removeAttribute('data-ad-hidden');
  });
};

let adObserver: MutationObserver | null = null;

const hideAdElements = () => {
  AD_SELECTORS.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`[Content] Found ${elements.length} elements matching ${selector}`);
      elements.forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = 'none';
        htmlEl.setAttribute('data-ad-hidden', 'true');
      });
    } catch (error) {
      console.error(`[Content] Error with selector ${selector}:`, error);
    }
  });
};

const setupAdBlockObserver = () => {
  if (adObserver) {
    adObserver.disconnect();
  }
  
  adObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType === Node.ELEMENT_NODE) {
          const element = addedNode as HTMLElement;
          
          // Check if the new element matches ad selectors
          for (const selector of AD_SELECTORS) {
            try {
              if (element.matches && element.matches(selector)) {
                console.log('[Content] Hiding dynamically added ad element');
                element.style.display = 'none';
                element.setAttribute('data-ad-hidden', 'true');
              }
              
              // Check children too
              const adChildren = element.querySelectorAll(selector);
              if (adChildren.length > 0) {
                console.log(`[Content] Hiding ${adChildren.length} ad children`);
                adChildren.forEach(child => {
                  const htmlChild = child as HTMLElement;
                  htmlChild.style.display = 'none';
                  htmlChild.setAttribute('data-ad-hidden', 'true');
                });
              }
            } catch (error) {
              // Selector might not work with matches(), skip it
            }
          }
        }
      }
    }
  });
  
  adObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log('[Content] Ad block observer active');
};