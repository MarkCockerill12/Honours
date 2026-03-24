import { ServerLocation } from "../components/types";

export type VpnServer = ServerLocation;

// Fixed list of supported locations (dynamic provisioning IDs) - v2.1 Verified
export const VPN_SERVERS: ServerLocation[] = [
  { id: "us", name: "New York", country: "United States", flag: "🇺🇸", ping: 78, load: 45, x: 25, y: 30, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "uk", name: "London", country: "United Kingdom", flag: "🇬🇧", ping: 12, load: 32, x: 48, y: 28, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "de", name: "Frankfurt", country: "Germany", flag: "🇩🇪", ping: 24, load: 55, x: 52, y: 27, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "jp", name: "Tokyo", country: "Japan", flag: "🇯🇵", ping: 180, load: 28, x: 82, y: 30, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
  { id: "au", name: "Sydney", country: "Australia", flag: "🇦🇺", ping: 220, load: 18, x: 85, y: 70, status: "off", ip: "", publicKey: "", proxyPort: 1080 },
];

export const getVpnConfig = async (serverId: string) => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/vpn/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch VPN config: ${response.statusText}`);
    }

    const data = await response.json();
    return data.config;
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      console.error("[VPN Client Error] Backend orchestrator unreachable. Ensure 'npm run backend' is active on port 8080.");
      throw new Error("Backend orchestrator unreachable. Please ensure the backend service is running.");
    }
    console.error("[VPN Client Error]:", error);
    throw error;
  }
};

