// YouTube Ad Blocker & Auto-Skipper (Safety-First Rewrite - Round 16)
import { recordBlockedRequest } from "./adBlockEngine";

export const shouldBlockYouTubeRequest = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("youtube.com/api/stats/ads") || 
      urlLower.includes("youtube.com/pagead/") ||
      urlLower.includes("youtube.com/ptracking") ||
      urlLower.includes("youtube.com/get_midroll_info")) return true;
  if (urlLower.includes("doubleclick.net") || 
      urlLower.includes("googleadservices.com") ||
      urlLower.includes("googlesyndication.com")) return true;
  if (urlLower.includes("youtube.com/watch")) {
    const urlObj = new URL(url);
    if (urlObj.searchParams.has("ad_type") || urlObj.searchParams.has("adformat")) return true;
  }
  return false;
};

let youtubeObserver: MutationObserver | null = null;
let pollingInterval: any = null;
let isProcessingAd = false;
let lastAdCheckTime = 0;

const isContextValid = () => {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
};

const killPlaybackManipulation = (video: HTMLVideoElement) => {
  if (video.playbackRate > 2 || video.muted) {
    console.log("[YouTube AdBlock] Safety Kill: Resetting speed to 1.0x");
    video.playbackRate = 1;
    video.muted = false;
  }
};

const simulateClick = (el: HTMLElement) => {
  if (!isContextValid()) return;
  const opts = { bubbles: true, cancelable: true, view: globalThis.window };
  el.dispatchEvent(new PointerEvent("pointerdown", opts));
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new PointerEvent("pointerup", opts));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.click();
};

const findSkipButtonByText = (player: HTMLElement, isHeavy = false): HTMLElement | null => {
  const selector = isHeavy ? "button, [role='button'], div, span" : "button, [role='button']";
  const elements = player.querySelectorAll(selector);
  for (const el of Array.from(elements)) {
    const text = (el as HTMLElement).textContent || "";
    // Hyper-specific text check for modern skip overlays
    if ((text === "Skip Ad" || text === "Skip" || text === "skip ad") && text.length < 10) {
      return el as HTMLElement;
    }
  }
  return null;
};

const runAdCheck = (player: HTMLElement, isHeavy = false) => {
  if (!isContextValid()) {
    const v = globalThis.document.querySelector("video.video-stream") as HTMLVideoElement;
    if (v) killPlaybackManipulation(v);
    disableYouTubeAdBlocker();
    return;
  }

  const now = Date.now();
  if (now - lastAdCheckTime < 250) return;
  if (isProcessingAd) return;

  const video = globalThis.document.querySelector("video.video-stream") as HTMLVideoElement;
  if (!video) return;

  isProcessingAd = true;
  lastAdCheckTime = now;

  try {
    // 1. AUTHORITATIVE DETECTION (Only speed up if YouTube says it's an ad)
    const officialAdShowing = player.classList.contains("ad-showing") || 
                             player.classList.contains("ad-interrupting");

    // 2. SKIP BUTTON DETECTION (Any button is a target)
    let skipButton = globalThis.document.querySelector(`
       .ytp-ad-skip-button, 
       .ytp-skip-ad-button, 
       .ytp-ad-skip-button-modern, 
       .ytp-ad-skip-button-slot,
       .ytp-ad-skip-button-text,
       [id^="skip-button"] button,
       [aria-label="Skip Ad"],
       [aria-label="Skip"]
    `) as HTMLElement | null;

    if (!skipButton && isHeavy) skipButton = findSkipButtonByText(player, true);

    // 3. EXECUTION
    if (officialAdShowing || skipButton) {
      // IF official ad state: Mute + Speed up
      if (officialAdShowing) {
        video.muted = true;
        if (video.playbackRate < 16) video.playbackRate = 16;
      }

      // IF button found: Just click it (independent of speed-up choice)
      if (skipButton) {
        console.log("[YouTube AdBlock] Verified Skip Button - Clicking");
        simulateClick(skipButton);
      }
      
      recordBlockedRequest("video", globalThis.location.href, "youtube");
    } else {
      // 4. INSTANT RESET: If neither official state NOR button is present, kill any manipulation
      killPlaybackManipulation(video);
    }

    // Safety: close overlays during heavy pass
    if (isHeavy) {
      const bannerClose = globalThis.document.querySelector(".ytp-ad-overlay-close-button") as HTMLElement | null;
      if (bannerClose) simulateClick(bannerClose);
    }
  } catch (e) {
    // Fatal error check: kill speed-up just in case
    killPlaybackManipulation(video);
    console.error("[YouTube AdBlock] Check failed:", e);
  } finally {
    isProcessingAd = false;
  }
};

export const initYouTubeAdBlocker = () => {
  if (!globalThis.location.hostname.includes("youtube.com") || !isContextValid()) return;
  chrome.storage.local.get(["protectionState"], (res) => {
    if (!isContextValid()) return;
    const s = res.protectionState as any;
    if (s?.isActive && s?.adblockEnabled) enableYouTubeAdBlocker();
  });
};

export const disableYouTubeAdBlocker = () => {
  if (youtubeObserver) { youtubeObserver.disconnect(); youtubeObserver = null; }
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
};

export const enableYouTubeAdBlocker = () => {
  if (!globalThis.location.hostname.includes("youtube.com")) return;
  const player = globalThis.document.querySelector(".html5-video-player") as HTMLElement;
  if (!player) { setTimeout(enableYouTubeAdBlocker, 1000); return; }
  if (youtubeObserver && pollingInterval) return;

  console.log("[YouTube AdBlock] Mode: Absolute Safety (Round 16)");

  if (!youtubeObserver) {
    youtubeObserver = new MutationObserver(() => runAdCheck(player, false));
    youtubeObserver.observe(player, { attributes: true, attributeFilter: ["class"] });
  }

  if (!pollingInterval) {
    pollingInterval = setInterval(() => runAdCheck(player, true), 500);
  }
  
  runAdCheck(player, true);
};
