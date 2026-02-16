"use strict";
(() => {
  // apps/extension/Utils/background.ts
  console.log("Privacy Protector: Background Service Worker Running");
  chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension Installed Successfully");
  });
})();
