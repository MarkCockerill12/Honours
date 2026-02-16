"use strict";
(() => {
  // apps/extension/Utils/content.ts
  var blurContent = (rootElement, keywords) => {
    if (!keywords || keywords.length === 0) return;
    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_TEXT,
      null
    );
    const nodesToBlur = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent?.toLowerCase();
      const hasKeyword = keywords.some((k) => text?.includes(k.toLowerCase()));
      if (hasKeyword) {
        nodesToBlur.push(node);
      }
    }
    nodesToBlur.forEach((textNode) => {
      const span = document.createElement("span");
      span.innerHTML = textNode.textContent || "";
      span.style.filter = "blur(6px)";
      span.style.cursor = "pointer";
      span.style.transition = "0.3s";
      span.onclick = () => {
        span.style.filter = "none";
      };
      textNode.replaceWith(span);
    });
    return nodesToBlur.length;
  };
})();
