#!/bin/bash
# ------------------------------------------------------------------
# PRIVACY SHIELD VPN - FROM SCRATCH REBUILD (v2 - Fixed 2026-04-19)
# ------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y wireguard iptables iptables-persistent make gcc git wget curl jq

# 1. Enable IP Forwarding
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-custom.conf
sysctl -p /etc/sysctl.d/99-custom.conf

# 2. Rebuild wg0.conf
# VERIFIED KEYPAIR (2026-04-19):
# Server privkey derives to: doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=
# Client privkey (ry5mCD...) derives to: zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI=
SERVER_PRIV_KEY="+CRQdaltQlLWXqSuv3PD6ePXdxEuwKsuZPNl0Qj7x0Y="
CLIENT_PUB_KEY="zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI="

IFACE=$(ip route get 8.8.8.8 | awk '{print $5; exit}')
if [ -z "$IFACE" ]; then IFACE="ens5"; fi

# Ensure clean state
# Flush all routing rules and restore defaults
ip rule flush
ip rule add from all lookup local priority 0
ip rule add from all lookup main priority 32766
ip rule add from all lookup default priority 32767

wg-quick down wg0 2>/dev/null || true
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
iptables -F
iptables -t nat -F
iptables -t mangle -F

cat <<EOF > /etc/wireguard/wg0.conf
[Interface]
Address = 172.16.10.1/24
ListenPort = 443
PrivateKey = $SERVER_PRIV_KEY
FwMark = 51820
MTU = 1240

PostUp = sysctl -w net.ipv4.ip_forward=1; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -s 172.16.10.0/24 -o wg-warp -j MASQUERADE; iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1200; ip rule add to 172.16.10.0/24 lookup main priority 80 2>/dev/null || true; ip rule add fwmark 51820 lookup main priority 90 2>/dev/null || true; ip rule add from 172.16.10.0/24 lookup 1000 priority 100 2>/dev/null || true
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -s 172.16.10.0/24 -o wg-warp -j MASQUERADE; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1200; ip rule del to 172.16.10.0/24 lookup main priority 80 2>/dev/null || true; ip rule del fwmark 51820 lookup main priority 90 2>/dev/null || true; ip rule del from 172.16.10.0/24 lookup 1000 priority 100 2>/dev/null || true
EOF

chmod 600 /etc/wireguard/wg0.conf

# 2.5 Install and configure Cloudflare WARP via wgcf
echo "Installing wgcf and setting up WARP..."
if [ ! -f "/usr/local/bin/wgcf" ]; then
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    WGCF_URL="https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_amd64"
  elif [ "$ARCH" = "aarch64" ]; then
    WGCF_URL="https://github.com/ViRb3/wgcf/releases/download/v2.2.22/wgcf_2.2.22_linux_arm64"
  else
    echo "Unsupported architecture: $ARCH"
    exit 1
  fi
  curl -fsSL "$WGCF_URL" -o /usr/local/bin/wgcf
  chmod +x /usr/local/bin/wgcf
fi

cd /etc/wireguard
if [ ! -f "wgcf-account.toml" ]; then
  wgcf register --accept-tos
fi
if [ ! -f "wgcf-profile.conf" ]; then
  wgcf generate
fi

# Convert wgcf-profile.conf to wg-warp.conf and adjust for routing
if [ -f "wgcf-profile.conf" ]; then
  cat wgcf-profile.conf > wg-warp.conf
  # Remove DNS line to prevent resolvconf errors
  sed -i '/^DNS/d' wg-warp.conf
  # Remove IPv6 Address and AllowedIPs lines specifically
  sed -i '/^Address.*:/d' wg-warp.conf
  sed -i '/^AllowedIPs.*:/d' wg-warp.conf
  # Ensure MTU and Routing are set
  # Use Table 1000 for WARP to isolate it from the main routing table
  sed -i '/\[Interface\]/a Table = 1000' wg-warp.conf
  # Set MTU to 1280 to prevent fragmentation over AWS/WARP
  sed -i '/\[Interface\]/a MTU = 1280' wg-warp.conf
  # Add FwMark to prevent routing loops (encrypted packets must use 'main' table)
  sed -i '/\[Interface\]/a FwMark = 51821' wg-warp.conf
fi

# 3. Start WireGuard interfaces
# Force total cleanup of interfaces to prevent systemd conflicts
wg-quick down wg-warp 2>/dev/null || true
ip link delete dev wg-warp 2>/dev/null || true
wg-quick down wg0 2>/dev/null || true
ip link delete dev wg0 2>/dev/null || true

if [ -f "/etc/wireguard/wg-warp.conf" ]; then
  # Ensure the fwmark rule for WARP exists to prevent loops
  ip rule add fwmark 51821 lookup main priority 90 2>/dev/null || true
  systemctl enable wg-quick@wg-warp
  systemctl restart wg-quick@wg-warp
  sleep 2
  # Ensure Table 1000 has a clean default route
  ip route flush table 1000
  ip route add default dev wg-warp table 1000 2>/dev/null || true
fi

systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0

# 4. Install microsocks as a persistent systemd service (survives reboots)
if [ ! -f "/usr/local/bin/microsocks" ]; then
  rm -rf /tmp/microsocks
  git clone https://github.com/rofl0r/microsocks.git /tmp/microsocks
  cd /tmp/microsocks && make && cp microsocks /usr/local/bin/
fi

# Create dedicated user for microsocks to allow routing isolation
id -u proxyuser >/dev/null 2>&1 || useradd -r -s /bin/false proxyuser

cat > /etc/systemd/system/microsocks.service <<'SVCEOF'
[Unit]
Description=microsocks SOCKS5 Proxy
After=network.target wg-quick@wg-warp.service

[Service]
User=proxyuser
ExecStart=/usr/local/bin/microsocks -p 1080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# 5. Install and Configure dnsmasq for VPN Clients and Host
apt-get install -y dnsmasq
systemctl stop systemd-resolved
systemctl disable systemd-resolved

cat > /etc/dnsmasq.conf <<EOF
interface=wg0
interface=lo
listen-address=172.16.10.1
listen-address=127.0.0.1
bind-interfaces
server=8.8.8.8
server=1.1.1.1
domain-needed
bogus-priv
EOF

# Ensure host uses local dnsmasq
echo "nameserver 127.0.0.1" > /etc/resolv.conf

# 6. Finalize Firewall and Routing
# Allow SOCKS5 port explicitly
iptables -A INPUT -p tcp --dport 1080 -j ACCEPT

# Asymmetric Routing Fix: Ensure traffic to eth0 port 1080 (Proxy) is replied via eth0
iptables -t mangle -A PREROUTING -p tcp --dport 1080 -j CONNMARK --set-mark 0x1080
iptables -t mangle -A OUTPUT -p tcp --sport 1080 -j CONNMARK --restore-mark
ip rule add fwmark 0x1080 lookup main priority 50 2>/dev/null || true

# Route proxyuser traffic (Extension Proxy) through WARP Table 1000
iptables -t mangle -A OUTPUT -m owner --uid-owner proxyuser -j MARK --set-mark 1000
ip rule add fwmark 1000 lookup 1000 priority 95 2>/dev/null || true

# Aggressive Traffic Marking: Everything arriving on wg0 is forced into WARP
# This is more reliable than 'from subnet' rules on some kernel versions
iptables -t mangle -A PREROUTING -i wg0 -j MARK --set-mark 1000

# Relax Reverse-Path Filtering and Enable MTU Probing
sysctl -w net.ipv4.conf.all.rp_filter=2
sysctl -w net.ipv4.conf.wg0.rp_filter=2
sysctl -w net.ipv4.conf.wg-warp.rp_filter=2
sysctl -w net.ipv4.tcp_mtu_probing=1

systemctl daemon-reload
systemctl enable microsocks
systemctl restart microsocks
systemctl enable dnsmasq
systemctl restart dnsmasq

# 7. Install Dynamic Peer Registration API
apt-get install -y python3 2>/dev/null || true
mkdir -p /opt/privacysentinel

cat > /opt/privacysentinel/peer-api.py <<'PYEOF'
#!/usr/bin/env python3
import json, subprocess, os
from http.server import HTTPServer, BaseHTTPRequestHandler

PEERS_FILE = "/etc/wireguard/peers.json"
WG_INTERFACE = "wg0"
SUBNET_PREFIX = "172.16.10"
AUTH_SECRET = "PS_PEER_REG_2026"

def load_peers():
    if os.path.exists(PEERS_FILE):
        with open(PEERS_FILE, "r") as f:
            return json.load(f)
    return {}

def save_peers(peers):
    with open(PEERS_FILE, "w") as f:
        json.dump(peers, f, indent=2)

def find_next_ip(peers):
    used = set(peers.values())
    for i in range(2, 255):
        ip = f"{SUBNET_PREFIX}.{i}"
        if ip not in used:
            return ip
    return None

def add_wg_peer(pub_key, ip):
    try:
        subprocess.run(["wg", "set", WG_INTERFACE, "peer", pub_key, "allowed-ips", f"{ip}/32", "persistent-keepalive", "20"], check=True, capture_output=True)
        return True
    except Exception as e:
        print(f"[PeerAPI] wg set failed: {e}")
        return False

class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a): print(f"[PeerAPI] {a[0]} {a[1]} {a[2]}")
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-PS-Auth")
        self.end_headers()
    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-PS-Auth")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "ok", "peers": len(load_peers())})
        else: self.send_error(404)
    def do_POST(self):
        if self.path != "/register":
            self.send_error(404); return
        if self.headers.get("X-PS-Auth","") != AUTH_SECRET:
            self.send_error(403); return
        length = int(self.headers.get("Content-Length", 0))
        if length > 4096:
            self.send_error(413); return
        try: data = json.loads(self.rfile.read(length))
        except: self.send_error(400); return
        pk = data.get("publicKey","").strip()
        if not pk or len(pk) < 40:
            self.send_error(400, "Invalid key"); return
        peers = load_peers()
        if pk in peers:
            add_wg_peer(pk, peers[pk])
            self._respond(200, {"success": True, "ip": peers[pk], "existing": True}); return
        if len(peers) >= 250:
            self.send_error(503, "Full"); return
        ip = find_next_ip(peers)
        if not ip:
            self.send_error(503); return
        if not add_wg_peer(pk, ip):
            self.send_error(500); return
        peers[pk] = ip
        save_peers(peers)
        print(f"[PeerAPI] New peer: {pk[:20]}... -> {ip}")
        self._respond(200, {"success": True, "ip": ip, "existing": False})

if __name__ == "__main__":
    if not os.path.exists(PEERS_FILE): save_peers({})
    print("[PeerAPI] Listening on :8443")
    HTTPServer(("0.0.0.0", 8443), H).serve_forever()
PYEOF

chmod +x /opt/privacysentinel/peer-api.py

cat > /etc/systemd/system/peer-api.service <<'SVCEOF'
[Unit]
Description=Privacy Sentinel Peer Registration API
After=network.target wg-quick@wg0.service

[Service]
ExecStart=/usr/bin/python3 /opt/privacysentinel/peer-api.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# Open port 8443 for peer registration
iptables -A INPUT -p tcp --dport 8443 -j ACCEPT

# Load existing peers from peers.json into wg0 on startup
if [ -f "/etc/wireguard/peers.json" ]; then
  python3 -c "
import json, subprocess
peers = json.load(open('/etc/wireguard/peers.json'))
for pk, ip in peers.items():
    subprocess.run(['wg', 'set', 'wg0', 'peer', pk, 'allowed-ips', f'{ip}/32', 'persistent-keepalive', '20'], capture_output=True)
print(f'Loaded {len(peers)} peers from peers.json')
"
fi

systemctl daemon-reload
systemctl enable peer-api
systemctl restart peer-api

echo "REBUILD_COMPLETE"
wg show

