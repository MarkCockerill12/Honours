import { ServerLocation } from "./types";

// NOTE: All spokes share the same WireGuard server keypair.
// The ip field is a fallback/hint only — clients always query EC2 for the live IP.
// Real server public key (verified live 2026-04-19): doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=
const SPOKE_PUBLIC_KEY = "doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=";

export const VPN_SERVERS: ServerLocation[] = [
  { id: "us", name: "Virginia", country: "United States", flag: "🇺🇸", ping: 0, load: 0, x: 25, y: 30, lat: 38.9072, lng: -77.0369, status: "off", ip: "", publicKey: SPOKE_PUBLIC_KEY, proxyPort: 1080 },
  { id: "uk", name: "London", country: "United Kingdom", flag: "🇬🇧", ping: 0, load: 0, x: 45, y: 25, lat: 51.5074, lng: -0.1278, status: "off", ip: "", publicKey: SPOKE_PUBLIC_KEY, proxyPort: 1080 },
  { id: "de", name: "Frankfurt", country: "Germany", flag: "🇩🇪", ping: 0, load: 0, x: 50, y: 28, lat: 50.1109, lng: 8.6821, status: "off", ip: "", publicKey: SPOKE_PUBLIC_KEY, proxyPort: 1080 },
  { id: "jp", name: "Tokyo", country: "Japan", flag: "🇯🇵", ping: 0, load: 0, x: 82, y: 35, lat: 35.6762, lng: 139.6503, status: "off", ip: "", publicKey: SPOKE_PUBLIC_KEY, proxyPort: 1080 },
  { id: "au", name: "Sydney", country: "Australia", flag: "🇦🇺", ping: 0, load: 0, x: 85, y: 70, lat: -33.8688, lng: 151.2093, status: "off", ip: "", publicKey: SPOKE_PUBLIC_KEY, proxyPort: 1080 },
];
