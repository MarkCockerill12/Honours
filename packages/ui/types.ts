export type Theme = "dark" | "light" | "vaporwave" | "frutiger-aero"
export type Platform = "extension" | "mobile" | "desktop"
export type BlurMethod = "blackbar" | "blur" | "kitten" | "warning"

export interface ThemeColors {
  bg: string
  bgSecondary: string
  text: string
  textSecondary: string
  accent: string
  accentSecondary: string
  border: string
  success: string
  warning: string
  danger: string
}

export interface TrackerStats {
  bandwidthSaved: number
  timeSaved: number
  dataValueReclaimed: number
}

export interface SmartFilter {
  id: string
  blockTerm: string
  exceptWhen: string
  enabled: boolean
}

export interface ServerLocation {
  id: string
  name: string
  country: string
  flag: string
  ping: number
  load: number
  x: number
  y: number
}

export interface ProtectionState {
  isActive: boolean
  vpnEnabled: boolean
  adblockEnabled: boolean
}
