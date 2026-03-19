export interface VpnServer {
  id: string;
  country: string;
  ip: string;
  publicKey: string; // For WireGuard
  proxyPort: number; // For Extension (SOCKS5)
  status: "off" | "starting" | "active";
}

// Fixed list of supported locations (dynamic provisioning IDs)
export const VPN_SERVERS: Omit<VpnServer, "ip" | "publicKey" | "proxyPort" | "status">[] = [
  { id: "uk", country: "United Kingdom" },
  { id: "us", country: "United States" },
  { id: "aws-eu-1", country: "Germany" },
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
  } catch (error) {
    console.error("[VPN Client Error]:", error);
    throw error;
  }
};

