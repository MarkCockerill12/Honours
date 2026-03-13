// YouTube Ad Blocker & Auto-Skipper
// Extremely safe non-destructive skipping

import { recordBlockedRequest } from "./adBlockEngine";

export const shouldBlockYouTubeRequest = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  
  // YouTube specific ad endpoints
  if (urlLower.includes("youtube.com/api/stats/ads") || 
      urlLower.includes("youtube.com/pagead/") ||
      urlLower.includes("youtube.com/ptracking") ||
      urlLower.includes("youtube.com/get_midroll_info")) {
    return true;
  }

  // Major ad networks
  if (urlLower.includes("doubleclick.net") || 
      urlLower.includes("googleadservices.com") ||
      urlLower.includes("googlesyndication.com")) {
    return true;
  }

  // Ad-related query parameters in YouTube URLs
  if (urlLower.includes("youtube.com/watch")) {
    const urlObj = new URL(url);
    if (urlObj.searchParams.has("ad_type") || urlObj.searchParams.has("adformat")) {
      return true;
    }
  }

  return false;
};

let adCheckInterval: number | null = null;

// Initialize YouTube ad blocking
export const initYouTubeAdBlocker = () => {
  console.log("[YouTube AdBlock] Initializing safe YouTube ad skipper...");

  if (!window.location.hostname.includes("youtube.com")) {
    return;
  }

  const checkState = async () => {
    try {
      const res = await chrome.storage.local.get(["protectionState"]);
      const state = res.protectionState as any;
      const isActive = state?.isActive ?? false;
      const adblockEnabled = state?.adblockEnabled ?? false;
      
      if (!isActive || !adblockEnabled) {
        console.log("[YouTube AdBlock] AdBlock toggled OFF.");
        return;
      }
      
      setupAutoSkip();
      console.log("[YouTube AdBlock] Safe auto-skip activated");
    } catch (e) {
      console.error("[YouTube AdBlock] Error checking state:", e);
    }
  };
  
  checkState();
};

export const cleanupYouTubeAdBlocker = () => {
  if (adCheckInterval) {
    clearInterval(adCheckInterval);
    adCheckInterval = null;
  }
};

const setupAutoSkip = () => {
  adCheckInterval = window.setInterval(() => {
    const video = document.querySelector("video.video-stream") as HTMLVideoElement;
    if (!video) return;

    // Is an ad playing?
    const adShowing = document.querySelector(".ad-showing, .ad-interrupting, .ytp-ad-player-overlay");
    const skipButton = document.querySelector(".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot") as HTMLButtonElement | null;

    if (adShowing) {
      // Step 1: Click the skip button instantly if it exists
      if (skipButton) {
        skipButton.click();
        recordBlockedRequest("video", globalThis.location.href, "youtube");
      } 
      // Step 2: If no skip button, accelerate the ad video to maximum speed and mute it
      else if (video.duration && video.duration > 0) {
        // Safe check to make sure it's actually an ad video loaded in the player
        if (video.playbackRate !== 16) {
          video.playbackRate = 16;
          video.muted = true;
          recordBlockedRequest("video", globalThis.location.href, "youtube");
        }
      }
    } 
    // Failsafe: Reset playback rate if ad finishes but rate remained stuck
    else {
      if (video.playbackRate === 16) {
         video.playbackRate = 1;
         video.muted = false;
      }
    }
    // Safety check: close static banner ads over the player
    const overlayClose = document.querySelector(".ytp-ad-overlay-close-button") as HTMLButtonElement | null;
    if (overlayClose) {
      overlayClose.click();
    }
  }, 100);
};
