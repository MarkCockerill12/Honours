export interface VpnServer {
  id: string;
  country: string;
  ip: string;
  publicKey: string; // For WireGuard
  proxyPort: number; // For Extension (SOCKS5)
}

// TODO: Fetch server configurations from the management API instead of hardcoding
export const VPN_SERVERS: VpnServer[] = [
  {
    id: "aws-eu-1",
    country: "Germany",
    ip: "3.123.45.67", // Your EC2 IP
    publicKey: "G+....your_wireguard_key...",
    proxyPort: 1080, // The Dante SOCKS5 port
  },
];

export const getVpnConfig = (serverId: string) => {
  return VPN_SERVERS.find((s) => s.id === serverId) || VPN_SERVERS[0];
};
