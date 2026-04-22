export type Theme = "dark" | "light" | "vaporwave" | "frutiger-aero" | "cyberpunk";
export type Platform = "extension" | "mobile" | "desktop";
export type BlurMethod = "blackbar" | "blur" | "kitten" | "warning";
export type FilterScope = "word" | "paragraph" | "page-warning";
export type FilterStyle = "blur" | "redact" | "highlight" | "kitten";
// Legacy alias kept for backwards compatibility
export type BlockScope = FilterStyle | "page-warning";

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentSecondary: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

export interface TrackerStats {
  totalBlocked: number;
  bandwidthSaved: number; // in bytes
  timeSaved: number; // in seconds
  moneySaved: number; // in GBP
}

export interface BlockStats extends TrackerStats {
  blockedByType: {
    ads: number;
    trackers: number;
    analytics: number;
    social: number;
    youtube: number;
    pdf: number;
  };
  lastUpdated: number;
}

export type MessageAction = 
  | "GET_PROTECTION_STATE"
  | "SET_PROTECTION_STATE"
  | "GET_FILTERS"
  | "SET_FILTERS"
  | "INIT_ENGINE"
  | "RECORD_STATS"
  | "TRANSLATE_TEXT"
  | "SCAN_PAGE_LINKS"
  | "GET_PDF_ALLOWED"
  | "ALLOW_PDF_ONCE"
  | "CHECK_PAGE_WARNING";

export interface BackgroundMessage {
  action: MessageAction;
  requestId?: number;
  [key: string]: unknown;
}

export interface SmartFilter {
  id: string;
  name?: string;
  blockTerm: string;
  unlessWord: string;   // if this word exists in the same paragraph, skip filtering
  exceptWhen: string;   // domain exclusion list (comma-separated) — kept for legacy
  enabled: boolean;
  blockScope?: FilterScope;  // what to match: word | paragraph | page-warning
  filterStyle?: FilterStyle; // how to render: blur | redact | highlight | kitten
}

export interface ServerLocation {
  id: string;
  name: string;
  country: string;
  flag: string;
  ping: number;
  load: number;
  x: number;
  y: number;
  lat: number;
  lng: number;
  status?: "off" | "starting" | "active";
  ip?: string;
  publicKey?: string;
  proxyPort?: number;
}

export interface ProtectionState {
  isActive: boolean;
  vpnEnabled: boolean;
  adblockEnabled: boolean;
  filteringEnabled: boolean;
}
