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

let youtubeObserver: MutationObserver | null = null;

// Initialize YouTube ad blocking
export const initYouTubeAdBlocker = () => {
  if (!window.location.hostname.includes("youtube.com")) return;

  console.log("[YouTube AdBlock] Initializing safe YouTube ad skipper...");

  const checkState = async () => {
    try {
      const res = await chrome.storage.local.get(["protectionState"]);
      const state = res.protectionState as any;
      if (state?.isActive && state?.adblockEnabled) {
        setupAutoSkip();
        console.log("[YouTube AdBlock] Safe auto-skip activated");
      }
    } catch (e) {
      console.error("[YouTube AdBlock] Error checking state:", e);
    }
  };
  
  checkState();
};

export const cleanupYouTubeAdBlocker = () => {
  if (youtubeObserver) {
    youtubeObserver.disconnect();
    youtubeObserver = null;
  }
};

const setupAutoSkip = () => {
  const player = document.querySelector(".html5-video-player");
  if (!player) {
    // Retry if player is not yet in DOM
    setTimeout(setupAutoSkip, 1000);
    return;
  }

  if (youtubeObserver) youtubeObserver.disconnect();

  youtubeObserver = new MutationObserver(() => {
    const video = document.querySelector("video.video-stream") as HTMLVideoElement;
    if (!video) return;

    // Is an ad playing?
    const adShowing = player.classList.contains("ad-showing") || 
                      player.classList.contains("ad-interrupting") || 
                      document.querySelector(".ytp-ad-player-overlay");
    
    const skipButton = document.querySelector(".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-slot") as HTMLButtonElement | null;

    if (adShowing) {
      if (skipButton) {
        skipButton.click();
        recordBlockedRequest("video", globalThis.location.href, "youtube");
      } else if (video.duration && video.duration > 0 && isFinite(video.duration)) {
        // Robust skipping: seek to the end AND accelerate
        // Using video.duration - 0.1 ensure it actually triggers the 'ended' or transition event
        if (video.currentTime < video.duration - 0.5) {
          video.currentTime = video.duration - 0.1;
          video.playbackRate = 16;
          video.muted = true;
          recordBlockedRequest("video", globalThis.location.href, "youtube");
        }
      }
    } else {
      // Failsafe: Reset playback rate if ad finishes but rate remained stuck
      if (video.playbackRate > 2) {
        video.playbackRate = 1;
        video.muted = false;
      }
    }

    // Safety check: close static banner ads over the player
    const overlayClose = document.querySelector(".ytp-ad-overlay-close-button") as HTMLButtonElement | null;
    if (overlayClose) overlayClose.click();
  });

  youtubeObserver.observe(player, { 
    attributes: true, 
    attributeFilter: ["class"],
    childList: true, 
    subtree: true 
  });
};
