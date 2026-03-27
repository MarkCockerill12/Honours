import type { ServerLocation } from "./types";

export type VpnServer = ServerLocation;

// Fixed list of supported locations (dynamic provisioning IDs)
// Ping and load values are placeholders — they are not displayed to users
export const VPN_SERVERS: ServerLocation[] = [
  { id: "us", name: "New York", country: "United States", flag: "🇺🇸", ping: 0, load: 0, x: 25, y: 30, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "uk", name: "London", country: "United Kingdom", flag: "🇬🇧", ping: 0, load: 0, x: 48, y: 28, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "de", name: "Frankfurt", country: "Germany", flag: "🇩🇪", ping: 0, load: 0, x: 52, y: 27, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "jp", name: "Tokyo", country: "Japan", flag: "🇯🇵", ping: 0, load: 0, x: 82, y: 30, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "au", name: "Sydney", country: "Australia", flag: "🇦🇺", ping: 0, load: 0, x: 85, y: 70, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
];
