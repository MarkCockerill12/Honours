// TODO: Implement MutationObserver to handle dynamically loaded content without re-scanning everything
export const blurContent = (rootElement: HTMLElement, keywords: string[]) => {
  if (!keywords || keywords.length === 0) return;

  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToBlur: Text[] = [];
  let node;

  // 1. Scan phase (Performance: Don't modify DOM while walking)
  while ((node = walker.nextNode())) {
    const text = node.textContent?.toLowerCase();
    const hasKeyword = keywords.some(k => text?.includes(k.toLowerCase()));
    if (hasKeyword) {
      nodesToBlur.push(node as Text);
    }
  }

  // 2. Mutation phase
  nodesToBlur.forEach(textNode => {
    const span = document.createElement('span');
    span.innerHTML = textNode.textContent || '';
    
    // Apply the blur style
    span.style.filter = 'blur(6px)';
    span.style.cursor = 'pointer';
    span.style.transition = '0.3s';
    
    // Feature: Click to Reveal
    span.onclick = () => { span.style.filter = 'none'; };
    
    textNode.replaceWith(span);
  });
  
  return nodesToBlur.length; // Return stats for the UI
};




import { scanUrl } from './security';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SCAN_PAGE_LINKS") {
    
    // 1. PDF Handling
    if (document.contentType === 'application/pdf' || window.location.href.endsWith('.pdf')) {
      sendResponse({
        type: 'PDF',
        linkCount: 0,
        maliciousCount: 0,
        maliciousLinks: []
      });
      return; // Stop here for PDFs
    }

    // 2. Web Page Handling
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    const results = [];

    for (const link of links) {
      const scan = scanUrl(link.href);
      if (!scan.isSafe) {
        // Visual Highlight
        link.style.border = "2px solid red";
        link.title = `⚠️ THREAT: ${scan.details}`;
        results.push(scan);
      }
    }

    sendResponse({
      type: 'WEB',
      linkCount: links.length,
      maliciousCount: results.length,
      maliciousLinks: results
    });
  }
});