// YouTube Ad Blocker & Auto-Skipper
// Extremely safe non-destructive skipping

import { recordBlockedRequest } from "./adBlockEngine";

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
    const adShowing = document.querySelector(".ad-showing");
    const skipButton = document.querySelector(".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern") as HTMLButtonElement | null;

    if (adShowing) {
      // Step 1: Click the skip button instantly if it exists
      if (skipButton) {
        skipButton.click();
        recordBlockedRequest("video", window.location.href, "youtube");
      } 
      // Step 2: If no skip button, accelerate the ad video to maximum speed and mute it
      else if (video.duration && video.duration > 0) {
        // Safe check to make sure it's actually an ad video loaded in the player
        if (video.playbackRate !== 16) {
          video.playbackRate = 16;
          video.muted = true;
          recordBlockedRequest("video", window.location.href, "youtube");
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
    
    // Fallback: forcefully hide the ad banner overlay just in case the close button isn't there
    const adOverlay = document.querySelector(".ytp-ad-overlay-container") as HTMLElement | null;
    if (adOverlay) {
       adOverlay.style.display = "none";
    }

  }, 300);
};
