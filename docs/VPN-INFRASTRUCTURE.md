# Privacy Sentinel VPN Infrastructure Documentation

**Last Updated:** April 21, 2026  
**Version:** v5.1 (Direct-to-Spoke with WARP)  
**Status:** ✅ Production

---

## 🌐 Architecture Overview

Privacy Sentinel uses a **Direct-to-Spoke** architecture where clients connect directly to regional VPN servers (spokes) without a central hub relay.

```
Client Device (Desktop/Mobile/Extension)
    ↓ [WireGuard Tunnel - UDP 443]
Regional Spoke (EC2 Instance)
    ↓ [WARP Tunnel]
Cloudflare Network
    ↓
Internet (IP Masked)
```

### Key Components

1. **WireGuard (wg0)**: Client VPN tunnel on port 443
2. **WARP (wg-warp)**: Cloudflare egress tunnel using `wgcf`
3. **microsocks**: SOCKS5 proxy on port 1080 for browser extensions
4. **dnsmasq**: DNS server for VPN clients (172.16.10.1)

---

## 📍 Regional Servers

All servers run **Ubuntu 24.04 ARM64** on **t4g.small** instances.

### Current Deployment

| Region | Name | Instance ID | Last Known IP | Status |
|--------|------|-------------|---------------|--------|
| **US** (us-east-1) | VPN-US | i-0d4fe8f00bee265ee | 18.212.225.114 | ✅ Running |
| **UK** (eu-west-2) | VPN-UK | i-01efdc64f934f2303 | 13.135.103.67 | ✅ Running |
| **Germany** (eu-central-1) | VPN-Germany | i-0ecc5ca8442e0c3ce | 18.196.108.117 | ✅ Running |
| **Japan** (ap-northeast-1) | VPN-Japan | i-0841ba747fa8cadd2 | 54.249.201.97 | ✅ Running |
| **Australia** (ap-southeast-2) | VPN-Sydney | i-097b269d2afd8669b | 3.107.97.52 | ✅ Running |

**Note:** IPs are dynamic and change on stop/start. Clients discover current IPs via EC2 DescribeInstances API.

---

## 🔐 WireGuard Configuration

### Server Keys

**Server Private Key** (consistent across all spokes):
```
+CRQdaltQlLWXqSuv3PD6ePXdxEuwKsuZPNl0Qj7x0Y=
```

**Server Public Key** (derived):
```
doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=
```

### Client Configuration

**Client Private Key** (stored in `.env.local` as `WG_CLIENT_PRIVATE_KEY`):
```
ry5mCDxXlLO1maEl4vW7i5p+mT/JLVXgsvis9pk5x7s=
```

**Client Public Key** (derived):
```
zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI=
```

**Client IP Assignment**: `172.16.10.2/32`

### Server wg0.conf Structure

```ini
[Interface]
Address = 172.16.10.1/24
ListenPort = 443
PrivateKey = <server-private-key>
FwMark = 51820
MTU = 1240

PostUp = [iptables rules + routing setup]
PostDown = [cleanup rules]

[Peer]
PublicKey = zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI=
AllowedIPs = 172.16.10.2/32
PersistentKeepalive = 25
```

---

## 🚀 Services Running on Each Spoke

### 1. WireGuard (wg0)
- **Port**: UDP 443
- **Interface IP**: 172.16.10.1/24
- **Service**: `wg-quick@wg0.service`
- **Status Command**: `sudo systemctl status wg-quick@wg0`

### 2. WARP (wg-warp)
- **Tool**: wgcf (WireGuard Cloudflare)
- **Interface**: `wg-warp` in routing table 1000
- **Service**: `wg-quick@wg-warp.service`
- **Purpose**: Routes VPN client traffic through Cloudflare's network
- **Status Command**: `sudo systemctl status wg-quick@wg-warp`

### 3. Microsocks (SOCKS5 Proxy)
- **Port**: TCP 1080
- **User**: `proxyuser` (for routing isolation)
- **Service**: `microsocks.service`
- **Purpose**: Browser extension proxy support
- **Status Command**: `sudo systemctl status microsocks`
- **Test**: `curl -x socks5://SERVER_IP:1080 https://ifconfig.me`

### 4. dnsmasq (DNS)
- **Listen Address**: 172.16.10.1 (wg0), 127.0.0.1 (localhost)
- **Upstream DNS**: 8.8.8.8, 1.1.1.1
- **Service**: `dnsmasq.service`
- **Purpose**: DNS resolution for VPN clients

### 5. Peer Registration API
- **Port**: TCP 8443
- **Service**: `peer-api.service`
- **Purpose**: Dynamic peer registration (future use)
- **Endpoint**: `POST /register` with `X-PS-Auth` header

---

## 🛡️ Security Groups

### VPN-SG-v5 Rules

| Protocol | Port | Source | Description |
|----------|------|--------|-------------|
| UDP | 443 | 0.0.0.0/0 | WireGuard VPN |
| TCP | 1080 | 0.0.0.0/0 | SOCKS5 Proxy |
| TCP | 22 | 0.0.0.0/0 | SSH Access |
| TCP | 8443 | 0.0.0.0/0 | Peer API |
| ICMP | -1 | 0.0.0.0/0 | Connectivity checks |

**Egress**: All traffic allowed (0.0.0.0/0)

---

## 🔄 Routing & NAT

### Traffic Flow

1. **Client → wg0** (172.16.10.2 → 172.16.10.1)
2. **NAT via iptables** (MASQUERADE)
3. **wg0 → wg-warp** (routing table 1000)
4. **wg-warp → Cloudflare** (encrypted)
5. **Cloudflare → Internet** (client IP masked)

### Key iptables Rules

```bash
# Forward traffic from wg0
iptables -A FORWARD -i wg0 -j ACCEPT
iptables -A FORWARD -o wg0 -j ACCEPT

# NAT traffic from VPN subnet through WARP
iptables -t nat -A POSTROUTING -s 172.16.10.0/24 -o wg-warp -j MASQUERADE

# Mark VPN client traffic for special routing
iptables -t mangle -A PREROUTING -i wg0 -j MARK --set-mark 1000
```

### Routing Tables

- **Table main** (default): Direct system traffic
- **Table 1000** (WARP): VPN client traffic via `wg-warp`

```bash
ip rule add from 172.16.10.0/24 lookup 1000 priority 100
ip route add default dev wg-warp table 1000
```

---

## 💾 Auto-Shutdown & Lifecycle

**Idle Timeout**: 30 minutes  
**Behavior**: Instances automatically stop after 30 minutes of inactivity  
**Cost Savings**: ~$0.02/hour when running, $0.00/hour when stopped

### Starting Stopped Servers

```bash
# Start a specific server
aws ec2 start-instances --region <region> --instance-ids <instance-id>

# Wait for running state
aws ec2 wait instance-running --region <region> --instance-ids <instance-id>

# Get new IP
aws ec2 describe-instances --region <region> --instance-ids <instance-id> \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
```

---

## 🛠️ Maintenance Scripts

### Global Reset Script
**Path**: `EXTREME_WORKING_VERSION_1.sh`  
**Purpose**: Finds all active spokes and force-reinstalls configuration  
**Usage**:
```bash
bash EXTREME_WORKING_VERSION_1.sh
```

### Rebuild VPN Script
**Path**: `tools/rebuild_vpn.sh`  
**Purpose**: Complete from-scratch rebuild on a single spoke  
**Deploys**: WireGuard, WARP (wgcf), microsocks, dnsmasq, peer-api

### Add Client Peer
**Path**: `tools/fix-microsocks-all.sh`  
**Purpose**: Add client peer and restart microsocks  
**Usage**:
```bash
ssh -i keysETC/PrivacyShield-Key.pem ubuntu@SERVER_IP 'bash' < tools/fix-microsocks-all.sh
```

---

## 🐛 Troubleshooting

### Issue: "Handshake Timeout" on Desktop Client

**Symptoms**: Client can't ping 172.16.10.1  
**Causes**:
1. Client peer not registered on server
2. WireGuard service not running
3. WARP not initialized (breaking PostUp rules)

**Fix**:
```bash
# On server
sudo wg set wg0 peer <CLIENT_PUBLIC_KEY> allowed-ips 172.16.10.2/32 persistent-keepalive 25
sudo systemctl restart wg-quick@wg0
```

### Issue: Extension SOCKS5 Fails

**Symptoms**: "SOCKS5 proxy connectivity failed"  
**Causes**:
1. microsocks not running
2. Port 1080 not open in security group
3. Client trying to connect to old IP

**Fix**:
```bash
# On server
sudo systemctl restart microsocks
sudo systemctl status microsocks
sudo ss -tlnp | grep 1080  # Should show LISTEN
```

### Issue: No Internet Through VPN

**Symptoms**: Tunnel connects but no internet  
**Causes**:
1. WARP not connected
2. Routing table 1000 not configured
3. NAT rules missing

**Fix**:
```bash
# Check WARP status
sudo wg show wg-warp
sudo ip route show table 1000  # Should show: default dev wg-warp

# Restart WARP
sudo systemctl restart wg-quick@wg-warp
```

### Issue: DNS Not Working

**Symptoms**: Can ping but can't resolve domains  
**Causes**: dnsmasq not running or misconfigured

**Fix**:
```bash
sudo systemctl restart dnsmasq
sudo systemctl status dnsmasq
dig @172.16.10.1 google.com  # Test DNS from VPN subnet
```

---

## 📊 Performance Optimization

### Current MTU Settings
- **wg0**: 1240 bytes (conservative for AWS)
- **wg-warp**: 1280 bytes

### Recommended for Speed
- **wg0**: 1420 bytes (if no fragmentation issues)
- **wg-warp**: 1420 bytes

**Update Command**:
```bash
sudo sed -i 's/MTU = 1240/MTU = 1420/' /etc/wireguard/wg0.conf
sudo wg-quick down wg0 && sudo wg-quick up wg0
```

### Persistent Keepalive
- **Client → Server**: 25 seconds
- **Purpose**: Maintains NAT traversal through firewalls

---

## 🔒 Security Best Practices

1. **Keys**: Never commit private keys to git (use `.env.local`)
2. **SSH**: Key-based auth only (in `keysETC/PrivacyShield-Key.pem`)
3. **Firewall**: Security groups properly configured
4. **Updates**: Ubuntu unattended-upgrades enabled
5. **Monitoring**: CloudWatch metrics enabled on all instances

---

## 📞 Emergency Contacts & Resources

- **Terraform Config**: `keysETC/main.tf`
- **Client Keys**: `.env.local` (not in git)
- **Server Keys**: `keysETC/variables.tf`
- **AWS Console**: https://console.aws.amazon.com/ec2/
- **Cloudflare WARP Docs**: https://developers.cloudflare.com/warp-client/

---

## 📝 Change Log

### v5.1 (April 21, 2026)
- Fixed DNS toggle to not restart VPN tunnel
- Added tutorial flash behavior (no auto-show)
- Fixed microsocks not starting after rebuild
- Documented all current server IPs

### v5.0 (April 20, 2026)
- Migrated to Direct-to-Spoke architecture (no hub)
- Integrated WARP via wgcf for Cloudflare egress
- Simplified routing (all clients → 172.16.10.2)
- Added auto-shutdown lifecycle (30min timeout)
- Deployed 5 regional spokes across US/UK/DE/JP/AU

### v4.x (Prior)
- Hub-and-spoke relay architecture (deprecated)
- Used commercial WARP client (replaced with wgcf)
