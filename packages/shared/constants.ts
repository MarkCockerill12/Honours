export const APP_NAME = "Privacy Shield";
export const APP_VERSION = "1.0.43-STABLE";

import { SmartFilter, ProtectionState } from "@/components/types";

export const DEFAULT_PROTECTION_STATE: ProtectionState = {
  isActive: false, // OFF by default as requested in initial design
  vpnEnabled: true,
  adblockEnabled: true,
  filteringEnabled: true,
};

export const DEFAULT_FILTERS: SmartFilter[] = [
  {
    id: "1",
    blockTerm: "facebook",
    exceptWhen: "",
    enabled: true,
    blockScope: "word",
  },
  {
    id: "2",
    blockTerm: "advertisement",
    exceptWhen: "",
    enabled: true,
    blockScope: "paragraph",
  },
  {
    id: "3",
    blockTerm: "malware",
    exceptWhen: "",
    enabled: true,
    blockScope: "page-warning",
  },
  {
    id: "4",
    blockTerm: "doubleclick",
    exceptWhen: "",
    enabled: true,
    blockScope: "word",
  },
];

export const VPN_REGIONS = [
  { id: "uk", name: "United Kingdom", emoji: "🇬🇧" },
  { id: "us", name: "United States", emoji: "🇺🇸" },
  { id: "de", name: "Germany", emoji: "🇩🇪" },
  { id: "jp", name: "Japan", emoji: "🇯🇵" },
  { id: "au", name: "Australia", emoji: "🇦🇺" },
  { id: "sg", name: "Singapore", emoji: "🇸🇬" },
  { id: "nl", name: "Netherlands", emoji: "🇳🇱" },
  { id: "ca", name: "Canada", emoji: "🇨🇦" },
];

// AdGuard DNS servers for ad blocking
export const ADGUARD_DNS = {
  primary: "94.140.14.14",
  secondary: "94.140.15.15",
  ipv6: ["2a10:50c0::ad1:ff", "2a10:50c0::ad2:ff"],
  dns_over_https: "https://dns.adguard.com/dns-query",
  dns_over_tls: "dns.adguard.com",
};

// UK mobile data cost: ~£5 per GB = £0.0048828125 per MB
export const COST_PER_MB = 0.0048828125;
export const COST_PER_GB = 7.5; // Average UK mobile data cost in GBP

export const AD_SELECTORS = [
  // Generic ad containers
  '[class*="ad-container"]',
  '[id*="ad-container"]',
  '[class*="advert"]',
  '[id*="advert"]',
  '[class*="sponsored"]',
  '[id*="sponsored"]',
  '[class*="promotion"]',
  '[id*="promotion"]',
  ".ad",
  "#ad",
  ".ads",
  "#ads",
  ".advertisement",
  ".advertising",

  // YouTube specific (Removed aggressive overlays that cover the player)
  ".video-ads",
  ".ytp-ad-module",
  "#player-ads",
  ".ytp-ad-image-overlay",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-ad-slot-renderer",
  "ytd-banner-promo-renderer",

  // Social media ads
  "[data-ad-preview]",
  "[data-ad-comet-preview]",
  'div[data-testid*="ad"]',
  'div[data-testid*="sponsored"]',

  // Common patterns
  'iframe[src*="ad"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="amazon-adsystem"]',
  "ins.adsbygoogle",
  ".ad-slot",
  ".ad-unit",
  ".ad-box",
  ".ad-label",
  ".ad-text",
  ".ad-wrap",
  ".ads-container",
  ".ads-wrapper",
  ".sponsor-container",
  ".sponsored-post",
  'div[class*="truste"]',
  'div[id*="taboola"]',
  'div[id*="outbrain"]',
  'div[class*="outbrain"]',
  'div[class*="taboola"]'
];

export const COMPREHENSIVE_DOMAINS = [
  // Google & DoubleClick
  "doubleclick.net", "googleadservices.com", "googlesyndication.com",
  "adservice.google.com", "google-analytics.com", "analytics.google.com",
  "tpc.googlesyndication.com", "pagead2.googlesyndication.com",

  // Facebook / Meta
  "connect.facebook.net", "pixel.facebook.com", "graph.facebook.com",
  "facebook.net", "fbcdn.net", "facebook.com/tr", "instagram.com/logging",

  // Amazon Ads
  "amazon-adsystem.com", "aax-eu.amazon-adsystem.com", "aax-us-east.amazon-adsystem.com",

  // Programmatic & Native Ads
  "taboola.com", "outbrain.com", "criteo.com",
  "rubiconproject.com", "pubmatic.com", "advertising.com", "adnxs.com",
  "scorecardresearch.com", "quantserve.com", "adform.net", "casalemedia.com",
  "openx.net", "bidswitch.net", "smartadserver.com", "teads.tv",
  "exponential.com", "sharethis.com", "addthis.com", "zedo.com",

  // Analytics & Trackers
  "hotjar.com", "mixpanel.com", "segment.com", "fullstory.com",
  "mouseflow.com", "crazyegg.com", "optimizely.com", "clicktale.net",
  "newrelic.com", "sentry.io", "bugsnag.com", "appsflyer.com",
  "branch.io", "kochava.com", "adjust.com", "singular.net",
  
  // Video & Other Ads
  "vungle.com", "unity3d.com/ads", "chartboost.com", "applovin.com",
  "inmobi.com", "supersonicads.com", "adcolony.com", "flurry.com",
  "moatads.com", "iasds01.com", "doubleverify.com", "integralads.com",

  // Yahoo & Microsoft
  "ads.yahoo.com", "bingads.microsoft.com", "bat.bing.com",

  // TikTok & ByteDance
  "ads.tiktok.com", "analytics.tiktok.com",

  // Twitter
  "ads.twitter.com", "analytics.twitter.com", "syndication.twitter.com",
  
  // Criteo & other major trackers
  "criteo.net", "casalemedia.com", "rubiconproject.com", "mathtag.com",
  "googletagmanager.com", "googletagservices.com", "quantcast.com",
  "scorecardresearch.com", "zemanta.com", "adroll.com", "moatads.com",
  "adsrvr.org", "rlcdn.com", "adtechus.com", "specificclick.net",
  "tribalfusion.com", "yieldmanager.com", "yieldmanager.com", "clarity.ms", "statcounter.com",
  "mc.yandex.ru", "metrika.yandex.ru", "yandex.ru/ads", "ad.mail.ru",
  "ad.turn.com", "ad.foxnetworks.com", "s.amazon-adsystem.com",
  "securepubads.g.doubleclick.net"
];

/**
 * A4: Centralized stats computation
 * Computes saved bandwidth, time, and money based on blocked resource size.
 */
export function computeBlockDelta(size: number) {
  const bandwidthSaved = size; // bytes
  const timeSaved = size / (1.25 * 1024 * 1024); // seconds (based on 10Mbps / 1.25MB/s avg speed)
  const moneySaved = (size / (1024 * 1024)) * COST_PER_MB; // GBP
  
  return {
    bandwidthSaved,
    timeSaved,
    moneySaved
  };
}
