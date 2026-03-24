export type Theme = "dark" | "light" | "vaporwave" | "frutiger-aero" | "cyberpunk";
export type Platform = "extension" | "mobile" | "desktop";
export type BlurMethod = "blackbar" | "blur" | "kitten" | "warning";
export type BlockScope = "word" | "paragraph" | "page-warning";

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
  | "PROXY_COMMAND"
  | "GET_PDF_ALLOWED"
  | "ALLOW_PDF_ONCE"
  | "CHECK_PAGE_WARNING";

export interface BackgroundMessage {
  action: MessageAction;
  requestId?: number;
  [key: string]: any;
}

export interface SmartFilter {
  id: string;
  name?: string;
  blockTerm: string;
  exceptWhen: string;
  enabled: boolean;
  blockScope?: BlockScope; // 'word' = just the word, 'paragraph' = entire paragraph, 'page-warning' = warn before entering
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
