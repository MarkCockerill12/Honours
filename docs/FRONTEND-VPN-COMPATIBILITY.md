# Frontend VPN Compatibility Guide

**Last Updated:** April 21, 2026  
**VPN Infrastructure Version:** v5.1

---

## 📱 Platform Support Matrix

| Platform | VPN Method | SOCKS5 Proxy | Ad Blocking | Status |
|----------|------------|--------------|-------------|--------|
| **Desktop** (Electron) | WireGuard (native) | N/A | System DNS | ✅ Working |
| **Mobile** (Expo) | WireGuard (native) | N/A | Manual DNS Config | ✅ Working |
| **Extension** (Chrome) | SOCKS5 Proxy | microsocks:1080 | PAC Script | ⚠️ Needs microsocks fix |

---

## 🖥️ Desktop App (Electron + Next.js)

### VPN Connection

**Method**: Direct WireGuard tunnel using `wireguard.exe` (Windows) or `wg-quick` (macOS/Linux)

**Configuration**:
- **Endpoint**: Dynamic EC2 IP discovered via AWS SDK
- **Port**: UDP 443
- **Client IP**: 172.16.10.2/32
- **DNS**: Configurable (Standard: 1.1.1.1, Protected: AdGuard 94.140.14.14)

**Files**:
- `apps/desktop/electron/main.js` - Main VPN logic
- `apps/desktop/electron/ipc/vpnHandlers.js` - EC2 provisioning
- Config written to: `C:\Users\Public\PrivacyShield\ps-{region}.conf`

**Flow**:
1. User clicks server location (e.g., "US")
2. Desktop provisions EC2 instance via AWS SDK
3. Waits for instance running + IP allocation
4. Generates WireGuard config with client private key
5. Installs tunnel via `wireguard.exe /installtunnelservice`
6. Polls 172.16.10.1 for handshake (max 60s)
7. Verifies internet connectivity (ping 8.8.8.8)

**Recent Fixes**:
- ✅ DNS toggle no longer restarts tunnel (uses `netsh` to update adapter DNS)
- ✅ Tutorial changed from auto-show to icon pulse (5s)

### Ad Blocking

**Method**: System-wide DNS override using Ghostery engine + AdGuard DNS

**Files**:
- `apps/desktop/electron/ipc/adblockHandlers.js`

**Modes**:
- **Standard**: Uses 1.1.1.1 (Cloudflare) for DNS
- **Protected**: Uses 94.140.14.14 (AdGuard) + Ghostery filter engine

---

## 📱 Mobile App (React Native + Expo)

### VPN Connection

**Method**: Native WireGuard via `react-native-wireguard-vpn` library

**Configuration**:
- Same as desktop (172.16.10.2, UDP 443)
- Provisions EC2 dynamically via AWS SDK

**Files**:
- `apps/mobile/services/vpnService.ts` - VPN connection logic
- `apps/mobile/App.tsx` - Main UI

**Flow**:
1. User taps shield button
2. App provisions server via EC2 SDK
3. Waits for IP (max 30 attempts × 5s = 150s)
4. Configures WireGuard tunnel
5. Connects and verifies with status updates

**Status Updates**:
- `IDLE` → `STARTING` → `WAITING_IP` → `CONFIGURING` → `VERIFYING` → `CONNECTED`

**Recent Fixes**:
- ✅ Tutorial icon now pulses for 5s instead of auto-showing
- ✅ Uses Animated.View with pulseAnim for flash effect

### Ad Blocking

**Method**: Manual DNS configuration (user must set in phone settings)

**UI**:
- "CONFIG" button next to "Adblock Protocol"
- Shows step-by-step DNS config instructions
- Displays AdGuard DNS addresses (94.140.14.14, 94.140.15.15)
- Copy-to-clipboard for easy setup

---

## 🌐 Browser Extension (Chrome/Edge)

### VPN Connection

**Method**: SOCKS5 proxy via microsocks running on VPN server

**Configuration**:
- **Proxy**: `SOCKS5 <server-ip>:1080`
- **Fallback Chain**: `SOCKS5 172.16.10.1:1080; SOCKS5 <public-ip>:1080; DIRECT`
- **PAC Script**: Hybrid mode (important sites proxied, local traffic direct)

**Files**:
- `apps/extension/utils/background.ts` - Background service worker
- Uses Chrome `chrome.proxy` API with PAC script

**Flow**:
1. Extension provisions EC2 instance
2. Opens port 1080 in security group (if not already open)
3. Waits for server ready
4. Applies SOCKS5 proxy via PAC script
5. Verifies connectivity (probes cloudflare.com, detectportal.firefox.com)

**Current Issue**: ⚠️ microsocks not running on servers after rebuild

**Fix Required**:
```bash
# On each server:
sudo systemctl enable microsocks
sudo systemctl restart microsocks
sudo ss -tlnp | grep 1080  # Verify LISTEN
```

**Verification**:
```bash
# Test SOCKS5 from client:
curl -x socks5://<server-ip>:1080 https://ifconfig.me
```

### Ad Blocking

**Method**: Integrated into SOCKS5 proxy via Ghostery engine

**Files**:
- `apps/extension/utils/ghostery.ts` - Filter engine
- Blocks ads at network level before proxy

---

## 🔑 Shared Client Configuration

### WireGuard Keys (All Platforms)

**Client Private Key** (stored in `.env.local`):
```
WG_CLIENT_PRIVATE_KEY=ry5mCDxXlLO1maEl4vW7i5p+mT/JLVXgsvis9pk5x7s=
```

**Client Public Key** (derived, registered on servers):
```
zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI=
```

**Client IP**: `172.16.10.2/32`

**Server Public Key** (consistent across all regions):
```
doHe8ztAe206A848cE8MP6A6OVpbEDv65IlMUhfRVjw=
```

### Server Discovery

All platforms use the same EC2 instance discovery:

```typescript
const SERVER_REGION_MAP = {
  us: "us-east-1",
  uk: "eu-west-2",
  de: "eu-central-1",
  jp: "ap-northeast-1",
  au: "ap-southeast-2",
};

const EC2_TAG_NAMES = {
  us: "VPN-US",
  uk: "VPN-UK",
  de: "VPN-Germany",
  jp: "VPN-Japan",
  au: "VPN-Sydney",
};
```

**Discovery Flow**:
1. Find instance by tag name in specified region
2. Check state (stopped → start instance)
3. Wait for running state
4. Get PublicIpAddress from DescribeInstances
5. Use IP for WireGuard endpoint or SOCKS5 proxy

---

## 🔄 Common Issues & Solutions

### Issue: Client Can't Connect After Server Restart

**Cause**: Dynamic IP changed, peer not registered

**Fix**:
```bash
# Run this script to add peer to all servers:
bash tools/add-peer-to-all.sh
```

### Issue: Desktop VPN Slow

**Cause**: Low MTU (1240) causing fragmentation

**Solution**: Increase MTU to 1420
```bash
# On server:
sudo sed -i 's/MTU = 1240/MTU = 1420/' /etc/wireguard/wg0.conf
sudo wg-quick down wg0 && sudo wg-quick up wg0
```

**Desktop side**: No change needed, MTU auto-negotiated

### Issue: Extension Proxy Fails

**Cause**: microsocks not running on server

**Fix**:
```bash
ssh -i keysETC/PrivacyShield-Key.pem ubuntu@<server-ip> \
  "sudo systemctl enable microsocks && sudo systemctl restart microsocks"
```

### Issue: DNS Not Working with VPN

**Cause**: DNS not configured in WireGuard tunnel

**Desktop**: Check `generateWgConfig()` in `main.js` includes `DNS = ...`  
**Mobile**: User must manually configure DNS in phone settings

### Issue: Ad Blocking Restarts VPN

**Status**: ✅ Fixed in v5.1

**Previous Behavior**: Toggling ad-block called `restartVpnIfActive()`  
**Current Behavior**: Uses `updateVpnDnsIfActive()` with `netsh` to change DNS on-the-fly

---

## 🧪 Testing Checklist

### Desktop VPN
- [ ] Connect to US server (check handshake)
- [ ] Toggle ad-block (DNS should update without reconnect)
- [ ] Verify internet works (visit ifconfig.me, should show VPN IP)
- [ ] Switch servers (should provision new instance)
- [ ] Disconnect and reconnect

### Mobile VPN
- [ ] Tap shield to connect
- [ ] Check status updates (STARTING → CONNECTED)
- [ ] Open CONFIG for DNS setup
- [ ] Copy DNS addresses to clipboard
- [ ] Verify internet through VPN

### Extension Proxy
- [ ] Enable VPN in extension
- [ ] Check background logs for "Force-Shield Proxy Applied"
- [ ] Verify probe results (2/2 endpoints reachable)
- [ ] Test browsing (should route through SOCKS5)
- [ ] Check ifconfig.me shows VPN IP

---

## 📚 Related Documentation

- [VPN Infrastructure](./VPN-INFRASTRUCTURE.md) - Server architecture
- [Testing Guide](./TESTING-GUIDE.md) - Comprehensive testing procedures
- [Status Report](./STATUS-REPORT.md) - Current implementation status

---

## 🛠️ Development Commands

### Desktop
```bash
cd apps/desktop
pnpm dev  # Start Next.js
pnpm electron  # Start Electron
```

### Mobile
```bash
cd apps/mobile
pnpm start  # Start Expo
pnpm android  # Run on Android
pnpm ios  # Run on iOS
```

### Extension
```bash
cd apps/extension
pnpm build  # Build for production
pnpm dev  # Build with watch mode
# Then load dist/ folder in chrome://extensions
```

---

## ✅ Current Compatibility Status

| Feature | Desktop | Mobile | Extension |
|---------|---------|--------|-----------|
| WireGuard VPN | ✅ | ✅ | N/A |
| SOCKS5 Proxy | N/A | N/A | ⚠️ (microsocks needs fix) |
| DNS Toggle (No Restart) | ✅ | N/A | N/A |
| Tutorial Flash | ✅ | ✅ | N/A |
| Server Auto-Discovery | ✅ | ✅ | ✅ |
| Multi-Region Support | ✅ (5) | ✅ (5) | ✅ (5) |
| Ad Blocking | ✅ | Manual | ✅ |

**Legend**:
- ✅ Working
- ⚠️ Needs fix
- N/A Not applicable
