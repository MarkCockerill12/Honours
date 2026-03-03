// YouTube Ad Blocker & Auto-Skipper
// Comprehensive solution for blocking/skipping YouTube ads

import { recordBlockedRequest } from './adBlockEngine';

let observer: MutationObserver | null = null;
let videoCheckInterval: number | null = null;
let adCheckInterval: number | null = null;

// Initialize YouTube ad blocking
export const initYouTubeAdBlocker = () => {
  console.log('[YouTube AdBlock] Initializing YouTube ad blocker...');
  
  // Check if we're on YouTube
  if (!window.location.hostname.includes('youtube.com')) {
    console.log('[YouTube AdBlock] Not on YouTube, skipping initialization');
    return;
  }
  
  console.log('[YouTube AdBlock] YouTube detected, setting up blockers');
  
  // Method 1: Hide ad elements with CSS
  injectAdBlockingCSS();
  
  // Method 2: Monitor DOM for ad elements
  setupDOMObserver();
  
  // Method 3: Auto-skip ads
  setupAutoSkip();
  
  // Method 4: Remove ad overlays
  setupOverlayRemoval();
  
  // Method 5: Speed through ads
  setupAdSpeedControl();
  
  console.log('[YouTube AdBlock] All YouTube ad blocking methods activated');
};

// Cleanup function
export const cleanupYouTubeAdBlocker = () => {
  console.log('[YouTube AdBlock] Cleaning up...');
  
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval);
    videoCheckInterval = null;
  }
  
  if (adCheckInterval) {
    clearInterval(adCheckInterval);
    adCheckInterval = null;
  }
};

// Inject CSS to hide ad elements
const injectAdBlockingCSS = () => {
  console.log('[YouTube AdBlock] Injecting ad-blocking CSS...');
  
  const style = document.createElement('style');
  style.id = 'youtube-adblock-css';
  style.textContent = `
    /* Hide video ads */
    .video-ads, .ytp-ad-module, .ytp-ad-overlay-container,
    .ytp-ad-text, .ytp-ad-player-overlay,
    ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer,
    ytd-ad-slot-renderer, ytd-banner-promo-renderer,
    ytd-player-legacy-desktop-watch-ads-renderer,
    #player-ads, .ad-showing, .ad-interrupting,
    ytd-compact-promoted-video-renderer,
    ytd-promoted-video-renderer {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      opacity: 0 !important;
    }
    
    /* Hide sidebar ads */
    ytd-rich-item-renderer[is-ad],
    ytd-video-renderer[is-ad],
    ytd-promoted-sparkles-text-search-renderer {
      display: none !important;
    }
    
    /* Hide banner ads */
    #masthead-ad, ytd-banner-promo-renderer-background {
      display: none !important;
    }
    
    /* Remove ad spacing */
    .ad-showing .html5-video-container {
      margin: 0 !important;
    }
  `;
  
  // Remove existing style if present
  const existing = document.getElementById('youtube-adblock-css');
  if (existing) existing.remove();
  
  document.head.appendChild(style);
  console.log('[YouTube AdBlock] Ad-blocking CSS injected');
};

// Setup DOM observer to remove ad elements dynamically
const setupDOMObserver = () => {
  console.log('[YouTube AdBlock] Setting up DOM mutation observer...');
  
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          // Check for ad indicators
          if (isAdElement(element)) {
            console.log('[YouTube AdBlock] Detected ad element, removing:', element.className);
            element.remove();
            recordBlockedRequest('other', window.location.href, 'youtube');
          }
          
          // Check children
          const adElements = element.querySelectorAll(
            'ytd-display-ad-renderer, ytd-ad-slot-renderer, ' +
            'ytd-promoted-sparkles-web-renderer, ytd-banner-promo-renderer, ' +
            '[class*="ad-showing"], [class*="video-ads"]'
          );
          
          if (adElements.length > 0) {
            console.log(`[YouTube AdBlock] Found ${adElements.length} ad elements, removing...`);
            adElements.forEach(el => {
              el.remove();
              recordBlockedRequest('other', window.location.href, 'youtube');
            });
          }
        }
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log('[YouTube AdBlock] DOM observer active');
};

// Check if element is an ad
const isAdElement = (element: HTMLElement): boolean => {
  const adIndicators = [
    'ad-showing', 'video-ads', 'ytp-ad-', 'ytd-display-ad',
    'ytd-ad-slot', 'ytd-promoted', 'ytd-banner-promo'
  ];
  
  const className = element.className.toLowerCase();
  const id = element.id.toLowerCase();
  
  return adIndicators.some(indicator => 
    className.includes(indicator) || id.includes(indicator)
  );
};

// Setup auto-skip functionality
const setupAutoSkip = () => {
  console.log('[YouTube AdBlock] Setting up auto-skip...');
  
  adCheckInterval = window.setInterval(() => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (!video) return;
    
    // Check if ad is playing
    const adContainer = document.querySelector('.ad-showing');
    const adModule = document.querySelector('.ytp-ad-module');
    
    if (adContainer || adModule) {
      console.log('[YouTube AdBlock] Ad detected, attempting to skip...');
      
      // Method 1: Click skip button
      const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button') as HTMLButtonElement;
      if (skipButton) {
        console.log('[YouTube AdBlock] Skip button found, clicking...');
        skipButton.click();
        recordBlockedRequest('video', window.location.href, 'youtube');
      }
      
      // Method 2: Fast forward video
      if (video.duration && video.currentTime < video.duration - 0.5) {
        console.log('[YouTube AdBlock] Fast-forwarding ad video...');
        video.currentTime = video.duration - 0.5;
        video.playbackRate = 16; // Max speed
      }
      
      // Method 3: Hide ad overlay
      const overlay = document.querySelector('.ytp-ad-overlay-container') as HTMLElement;
      if (overlay) {
        overlay.style.display = 'none';
      }
    }
  }, 500); // Check every 500ms
  
  console.log('[YouTube AdBlock] Auto-skip active');
};

// Remove ad overlays
const setupOverlayRemoval = () => {
  console.log('[YouTube AdBlock] Setting up overlay removal...');
  
  const removeOverlays = () => {
    const overlays = document.querySelectorAll(
      '.ytp-ad-overlay-container, .ytp-ad-text-overlay, ' +
      '.ytp-ad-image-overlay, .ytp-ad-player-overlay-instream-container'
    );
    
    if (overlays.length > 0) {
      console.log(`[YouTube AdBlock] Removing ${overlays.length} ad overlays...`);
      overlays.forEach(overlay => {
        (overlay as HTMLElement).style.display = 'none';
        recordBlockedRequest('other', window.location.href, 'youtube');
      });
    }
  };
  
  // Remove overlays every second
  setInterval(removeOverlays, 1000);
  
  // Also remove immediately
  removeOverlays();
  
  console.log('[YouTube AdBlock] Overlay removal active');
};

// Speed control for ads (if they somehow play)
const setupAdSpeedControl = () => {
  console.log('[YouTube AdBlock] Setting up ad speed control...');
  
  videoCheckInterval = window.setInterval(() => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (!video) return;
    
    // Check if we're in an ad
    const isAdPlaying = document.querySelector('.ad-showing') !== null;
    
    if (isAdPlaying && video.playbackRate < 16) {
      console.log('[YouTube AdBlock] Ad playing, setting max speed...');
      video.playbackRate = 16;
      video.muted = true;
      video.volume = 0;
    }
  }, 250); // Check every 250ms for responsive skipping
  
  console.log('[YouTube AdBlock] Ad speed control active');
};

// Additional: Block ad requests at network level
export const shouldBlockYouTubeRequest = (url: string): boolean => {
  const adPatterns = [
    '/api/stats/ads',
    '/pagead/',
    '/ptracking',
    '/get_midroll_info',
    'doubleclick.net',
    'googleadservices.com',
    'googlesyndication.com',
    '&ad_type=',
    '&adformat=',
  ];
  
  const urlLower = url.toLowerCase();
  return adPatterns.some(pattern => urlLower.includes(pattern));
};
