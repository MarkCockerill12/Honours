export const APP_NAME = " Blocker"
export const APP_VERSION = "1.0.0-prototype"

// API Endpoints (to be configured for production)
export const API_ENDPOINTS = {
  // AdGuard integration
  ADGUARD_API: process.env.NEXT_PUBLIC_ADGUARD_API || "https://api.adguard.com",
  
  // VPN server list
  VPN_SERVERS: process.env.NEXT_PUBLIC_VPN_API || "/api/vpn/servers",
  
  // NLP processing
  NLP_ANALYZE: process.env.NEXT_PUBLIC_NLP_API || "/api/nlp/analyze",
  
  // Stats tracking
  STATS_API: process.env.NEXT_PUBLIC_STATS_API || "/api/stats",
}

// Default filter presets
export const FILTER_PRESETS = {
  violence: {
    blockTerm: "violence",
    exceptWhen: "news report",
  },
  profanity: {
    blockTerm: "profanity",
    exceptWhen: "",
  },
  politics: {
    blockTerm: "political",
    exceptWhen: "educational",
  },
  spoilers: {
    blockTerm: "spoiler",
    exceptWhen: "",
  },
  nsfw: {
    blockTerm: "nsfw",
    exceptWhen: "",
  },
}

// VPN server regions
export const VPN_REGIONS = [
  { id: "uk", name: "United Kingdom", emoji: "🇬🇧" },
  { id: "us", name: "United States", emoji: "🇺🇸" },
  { id: "de", name: "Germany", emoji: "🇩🇪" },
  { id: "jp", name: "Japan", emoji: "🇯🇵" },
  { id: "au", name: "Australia", emoji: "🇦🇺" },
  { id: "sg", name: "Singapore", emoji: "🇸🇬" },
  { id: "nl", name: "Netherlands", emoji: "🇳🇱" },
  { id: "ca", name: "Canada", emoji: "🇨🇦" },
]

// DNS providers
export const DNS_PROVIDERS = {
  cloudflare: {
    name: "Cloudflare",
    doh: "https://cloudflare-dns.com/dns-query",
    ipv4: "1.1.1.1",
  },
  google: {
    name: "Google",
    doh: "https://dns.google/dns-query",
    ipv4: "8.8.8.8",
  },
  quad9: {
    name: "Quad9",
    doh: "https://dns.quad9.net/dns-query",
    ipv4: "9.9.9.9",
  },
}
