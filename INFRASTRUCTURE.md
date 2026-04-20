# Privacy Sentinel - VPN Infrastructure Documentation (v5.0)

**Last Updated:** 2026-04-20  
**Architecture:** Direct-to-Spoke (No Hub)  
**Deployment Tool:** Terraform  
**Auto-Shutdown:** 30 minutes idle

---

## Architecture Overview

### **Direct-to-Spoke Model**

```
┌─────────────┐
│   Client    │  (Desktop / Extension / Mobile)
│  WireGuard  │
└──────┬──────┘
       │ UDP 443
       │ TLS-like port (firewall-friendly)
       ↓
┌──────────────────┐
│  Regional Spoke  │  (5 locations: US, UK, DE, JP, AU)
│   WireGuard      │  Server: 172.16.10.1/24
│   172.16.10.0/24 │  Clients: 172.16.10.2-51 (50 slots)
└──────┬───────────┘
       │ Routing via policy-based routing
       ↓
┌──────────────────┐
│ Cloudflare WARP  │  Clean egress IP
│   wg-warp iface  │  Routes to table 100
└──────┬───────────┘
       ↓
    Internet
```

**Key Changes from v4:**
- ✅ **Removed Hub** - Clients connect directly to regional spokes
- ✅ **No Peer Registration API needed** - Static 50-slot pool hardcoded
- ✅ **Unified Subnet** - All spokes use 172.16.10.0/24 (simpler routing)
- ✅ **Auto-Shutdown** - Instances stop after 30 minutes idle (cost optimization)
- ✅ **Dynamic IP Discovery** - Clients query EC2 API for current spoke IPs

---

## Infrastructure Components

### **1. EC2 Instances (5 Regional Spokes)**

| Region | Name | Instance Type | AMI | IP Address (Dynamic) |
|--------|------|---------------|-----|----------------------|
| **us-east-1** | VPN-US | t4g.small | ami-061a2405535cb6378 | Retrieved via EC2 API |
| **eu-west-2** | VPN-UK | t4g.small | ami-0ff17e504a9a3883f | Retrieved via EC2 API |
| **eu-central-1** | VPN-Germany | t4g.small | ami-0b85c63d2279ba39b | Retrieved via EC2 API |
| **ap-northeast-1** | VPN-Japan | t4g.small | ami-0bb917e58cd2de9db | Retrieved via EC2 API |
| **ap-southeast-2** | VPN-Sydney | t4g.small | ami-0659beb2f263c5040 | Retrieved via EC2 API |

**OS:** Ubuntu 24.04 LTS ARM64  
**Instance Configuration:**
- `source_dest_check = false` (Required for NAT/routing)
- Tags: `AutoShutdown = true`, `Project = PrivacySentinel`

---

### **2. Security Groups**

**Name:** `VPN-SG-v5`  
**Purpose:** Firewall rules for all 5 regional spokes

| Protocol | Port | Direction | Purpose |
|----------|------|-----------|---------|
| UDP | 443 | Ingress | WireGuard VPN (firewall-friendly) |
| TCP | 1080 | Ingress | SOCKS5 Proxy (for browser extensions) |
| TCP | 22 | Ingress | SSH Management |
| ICMP | All | Ingress | Connectivity checks (ping) |
| All | All | Egress | Outbound traffic |

---

### **3. WireGuard Configuration**

#### **Server (Spoke) Config:**
```ini
[Interface]
PrivateKey = +CRQdaltQlLWXqSuv3PD6ePXdxEuwKsuZPNl0Qj7x0Y=
Address = 172.16.10.1/24
ListenPort = 443
MTU = 1280
FwMark = 51820

PostUp = iptables -t nat -A POSTROUTING -s 172.16.10.0/24 -o cloudflare-warp -j MASQUERADE; \
         ip rule add from 172.16.10.0/24 table 100; \
         ip route add default dev cloudflare-warp table 100

[Peer]  # Slot 2
PublicKey = tq/Vmp8dKA383tx/2dQZZGjXZEhqgq2JszFvPD7bRRc=
AllowedIPs = 172.16.10.2/32

# ... (50 total peer slots: 172.16.10.2-51)
```

**Derived Public Key:** `doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=`

#### **Client Config (Example):**
```ini
[Interface]
PrivateKey = <client_private_key>
Address = 172.16.10.2/32
DNS = 94.140.14.14, 94.140.15.15  # AdGuard DNS if enabled
MTU = 1280

[Peer]
PublicKey = doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=
Endpoint = <spoke_ip>:443
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

---

### **4. Cloudflare WARP Integration**

**Interface:** `cloudflare-warp`  
**Routing:** Policy-based routing via `table 100`

**Exclusions (Prevent Lockout):**
- `169.254.169.254/32` (AWS Metadata Service)
- `172.16.0.0/12` (RFC1918 Private)
- `<gateway>/32` (Physical gateway IP)

**Traffic Flow:**
```
Client → WireGuard (172.16.10.2) 
       → Spoke NAT (172.16.10.1) 
       → WARP Interface (cloudflare-warp) 
       → Internet (Clean Cloudflare IP)
```

---

### **5. SOCKS5 Proxy (microsocks)**

**Port:** 1080  
**Purpose:** Extension browser traffic routing  
**Systemd Service:** `microsocks.service`

```bash
ExecStart=/usr/local/bin/microsocks -p 1080
Restart=always
```

---

## Deployment & Management

### **Initial Deployment**

```bash
cd keysETC/
terraform init
terraform apply -auto-approve
```

**Output:** IPs and Instance IDs for all 5 spokes

---

### **Get Current IPs (Dynamic Discovery)**

Since instances may be stopped/started, IPs change. Use EC2 API:

```bash
# US
aws ec2 describe-instances --region us-east-1 \
  --filters "Name=tag:Name,Values=VPN-US" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

# UK
aws ec2 describe-instances --region eu-west-2 \
  --filters "Name=tag:Name,Values=VPN-UK" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

# Germany
aws ec2 describe-instances --region eu-central-1 \
  --filters "Name=tag:Name,Values=VPN-Germany" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

# Japan
aws ec2 describe-instances --region ap-northeast-1 \
  --filters "Name=tag:Name,Values=VPN-Japan" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

# Australia
aws ec2 describe-instances --region ap-southeast-2 \
  --filters "Name=tag:Name,Values=VPN-Sydney" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
```

**Client Implementation:** All 3 frontends (Desktop/Extension/Mobile) use `vpnHandlers.js` which automatically queries EC2 API on connect.

---

### **Manual Instance Control**

**Start Instance:**
```bash
aws ec2 start-instances --region <region> --instance-ids <instance-id>
```

**Stop Instance:**
```bash
aws ec2 stop-instances --region <region> --instance-ids <instance-id>
```

**Reboot Instance:**
```bash
aws ec2 reboot-instances --region <region> --instance-ids <instance-id>
```

---

### **Auto-Shutdown Behavior**

**Trigger:** 30 minutes after last client disconnects  
**Implementation:** JavaScript timeout in `vpnHandlers.js`

```javascript
shutdownTimers[spokeInstance.InstanceId] = setTimeout(async () => {
  console.log(`[Lifecycle] Auto-shutdown: Stopping idle spoke ${spokeInstance.InstanceId}`);
  await client.send(new StopInstancesCommand({ InstanceIds: [spokeInstance.InstanceId] }));
}, 30 * 60 * 1000); // 30 minutes
```

**Manual Override:** To keep instance running indefinitely, clear the timer or comment out the shutdown logic.

---

### **SSH Access**

```bash
ssh -i keysETC/PrivacyShield-Key.pem ubuntu@<spoke_ip>
```

**Common Tasks:**
```bash
# Check WireGuard status
sudo wg show wg0

# Check WARP status
warp-cli status

# Check active peers
sudo wg show wg0 peers

# View cloud-init logs
sudo tail -f /var/log/user-data.log

# Check SOCKS5 proxy
sudo systemctl status microsocks
```

---

## Client Integration

### **Desktop (Electron)**

**File:** `apps/desktop/electron/ipc/vpnHandlers.js`

**Flow:**
1. User clicks "Connect" → selects region (e.g., `us`)
2. `vpn:provision` IPC call → queries EC2 for `VPN-US` instance
3. If stopped → starts instance → waits for IP
4. Returns `{ PublicIp, PublicKey, Port: 443 }`
5. `main.js` generates WireGuard config → starts tunnel via `wireguard.exe`
6. Polls gateway `172.16.10.1` for handshake confirmation
7. Verifies internet via `ping 8.8.8.8`

**Auto-Shutdown:** Timer starts when tunnel established, cancelled on disconnect.

---

### **Extension (Chrome/Firefox)**

**File:** `apps/extension/utils/background.ts`

**Flow:**
1. User toggles protection → calls `handleVpnProvisioning()`
2. Same EC2 query → gets spoke IP
3. Creates SOCKS5 proxy PAC script pointing to `<spoke_ip>:1080`
4. Sets Chrome/Firefox proxy via `chrome.proxy.settings` / `browser.proxy.settings`
5. Validates with 3 probes: cloudflare.com/cdn-cgi/trace, detectportal, httpbin.org/ip

---

### **Mobile (React Native)**

**File:** `apps/mobile/services/vpnService.ts`

**Flow:**
1. User taps shield button → `connectVpn(serverId)`
2. EC2 query via AWS SDK → gets spoke IP
3. Calls `WireGuardVpn.connect()` from `react-native-wireguard-vpn`
4. Native VPN tunnel established at OS level
5. Status callback monitors tunnel health every 30s

---

## Cost Optimization

### **Current Setup:**
- **Instance Type:** t4g.small (ARM64, cheaper than x86)
- **Cost:** ~$0.0168/hour per instance = $0.084/hour for 5 spokes
- **Monthly (24/7):** ~$60.48 total
- **With Auto-Shutdown (avg 4h/day usage):** ~$10/month

### **Further Optimizations:**
1. **Use Spot Instances:** 70% cheaper, but can be interrupted
2. **Lambda + Fargate:** Serverless WireGuard (complex setup)
3. **Reserved Instances:** 40% discount if running 24/7

---

## Monitoring & Diagnostics

### **Health Checks**

**From Client:**
```bash
# Ping gateway (verifies handshake)
ping 172.16.10.1

# Ping external (verifies egress)
ping 8.8.8.8

# Check public IP (should show Cloudflare)
curl https://www.cloudflare.com/cdn-cgi/trace
```

**On Spoke:**
```bash
# Active connections
sudo wg show wg0 | grep -c "^peer"

# Latest handshake times
sudo wg show wg0 latest-handshakes

# WARP connectivity
warp-cli status
```

---

### **Common Issues**

#### **Issue: Handshake Timeout**
**Symptom:** Gateway `172.16.10.1` doesn't respond  
**Causes:**
- Instance just started (cloud-init not finished)
- WireGuard service crashed
- WARP not connected

**Fix:**
```bash
# SSH to spoke
ssh -i keysETC/PrivacyShield-Key.pem ubuntu@<spoke_ip>

# Restart services
sudo systemctl restart wg-quick@wg0
sudo warp-cli connect

# Check logs
sudo journalctl -u wg-quick@wg0 -n 50
```

---

#### **Issue: "No route to host"**
**Symptom:** Can't connect to spoke IP  
**Causes:**
- Instance stopped
- Security group misconfigured
- Your IP blocked by ISP

**Fix:**
```bash
# Check instance state
aws ec2 describe-instances --region us-east-1 \
  --instance-ids <id> --query 'Reservations[0].Instances[0].State.Name'

# If stopped, start it
aws ec2 start-instances --region us-east-1 --instance-ids <id>
```

---

#### **Issue: Internet works but wrong IP**
**Symptom:** Tunnel connected but egress IP is AWS, not Cloudflare  
**Causes:**
- WARP disconnected
- Routing rules not applied

**Fix:**
```bash
# Check WARP
warp-cli status
warp-cli connect

# Check routing table 100
sudo ip route show table 100

# Should show: default dev cloudflare-warp
```

---

## Security Considerations

### **Cryptographic Keys**

**WireGuard Keypair:**
- **Server Private:** Stored in Terraform user-data (encrypted at rest)
- **Client Private:** Stored in `.env.local` (XOR-obfuscated for builds)
- **Key Type:** Curve25519 (32 bytes)

**AWS Credentials:**
- **Storage:** `.env.local` with SHIELD: XOR encoding
- **Permissions:** EC2 read/start/stop only (no terminate)
- **Rotation:** Manual, recommended every 90 days

---

### **Network Isolation**

**Firewall Rules:**
- Only ports 443 (UDP), 1080 (TCP), 22 (TCP) exposed
- ICMP allowed for health checks
- No ingress on ephemeral ports

**SourceDestCheck Disabled:**
- Required for NAT functionality
- Instance can route for other IPs (172.16.10.0/24)

---

### **Data Protection**

**Encryption:**
- WireGuard: ChaCha20-Poly1305 (AEAD cipher)
- Perfect Forward Secrecy via ECDH key exchange
- No logs stored on spokes (ephemeral routing)

**Privacy:**
- Cloudflare WARP egress IP rotation
- No traffic inspection on spokes
- Client IPs never logged

---

## Maintenance

### **Monthly Tasks**
- [ ] Rotate AWS credentials
- [ ] Update AMIs (Ubuntu patches)
- [ ] Review CloudWatch logs for errors
- [ ] Check instance utilization (consider downsizing)

### **Terraform Updates**

**Apply Changes:**
```bash
cd keysETC/
terraform plan  # Review changes
terraform apply -auto-approve
```

**Destroy All:**
```bash
terraform destroy -auto-approve
```

**State Management:**
- `terraform.tfstate` tracked in repo (no sensitive data)
- Backup: `terraform.tfstate.backup` auto-created

---

## Troubleshooting Playbook

### **Scenario: VPN won't connect**

1. **Check instance state:**
   ```bash
   aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=VPN-US"
   ```
   - If stopped → Start it and wait 2 minutes

2. **Verify security group:**
   ```bash
   aws ec2 describe-security-groups --region us-east-1 --filters "Name=tag:Name,Values=Privacy-Sentinel-VPN"
   ```
   - Ensure UDP 443 ingress rule exists

3. **Test UDP connectivity:**
   ```bash
   nc -u -v -w 2 <spoke_ip> 443
   ```

4. **Check client logs:**
   - Desktop: Electron DevTools → Console
   - Extension: chrome://extensions → "Privacy Sentinel" → Inspect background page
   - Mobile: `adb logcat | grep WireGuard`

---

### **Scenario: Tunnel connected but no internet**

1. **Ping gateway:**
   ```bash
   ping 172.16.10.1
   ```
   - If fails → WireGuard handshake issue

2. **Check WARP on spoke:**
   ```bash
   ssh ubuntu@<spoke_ip>
   warp-cli status
   ```
   - Should show "Connected"

3. **Test egress:**
   ```bash
   curl --interface wg0 https://www.cloudflare.com/cdn-cgi/trace
   ```
   - Should return Cloudflare IP

---

## Appendix

### **Port Reference**

| Port | Protocol | Service | Purpose |
|------|----------|---------|---------|
| 443 | UDP | WireGuard | VPN tunnel |
| 1080 | TCP | microsocks | SOCKS5 proxy |
| 22 | TCP | SSH | Management |
| 51820 | UDP | WireGuard (fallback) | Not used in v5 |

---

### **File Locations**

**Terraform:**
- `keysETC/main.tf` - Infrastructure definition
- `keysETC/variables.tf` - Input variables (if any)
- `keysETC/terraform.tfstate` - Current state

**Desktop:**
- `apps/desktop/electron/ipc/vpnHandlers.js` - VPN orchestration
- `apps/desktop/electron/main.js` - WireGuard client logic

**Extension:**
- `apps/extension/utils/background.ts` - SOCKS5 proxy setup
- `apps/extension/utils/chromeBridge.ts` - Proxy PAC generation

**Mobile:**
- `apps/mobile/services/vpnService.ts` - Native VPN integration

---

### **References**

- [WireGuard Protocol](https://www.wireguard.com/protocol/)
- [Cloudflare WARP Docs](https://developers.cloudflare.com/warp-client/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 User Guide](https://docs.aws.amazon.com/ec2/)

---

**End of Infrastructure Documentation v5.0**
