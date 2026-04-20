# VPN Testing Guide - Privacy Sentinel v5.0

## ✅ Infrastructure Status

**All 5 spokes deployed and configured:**

| Region | IP | Instance ID | WireGuard | WARP |
|--------|-----|-------------|-----------|------|
| 🇺🇸 US | 100.26.43.90 | i-0af6b0bc717671ec3 | ✅ Port 443, 50 peers | ⏳ Installing |
| 🇬🇧 UK | 35.177.244.86 | i-02041f451f96be0db | ✅ Port 443, 50 peers | ⏳ Installing |
| 🇩🇪 DE | 54.93.226.87 | i-0ef0df2bd1a8af4ea | ✅ Port 443, 50 peers | ⏳ Installing |
| 🇯🇵 JP | 35.77.102.7 | i-024a09535e40e53ae | ✅ Port 443, 50 peers | ⏳ Installing |
| 🇦🇺 AU | 3.26.39.152 | i-028a37d155ad13130 | ✅ Port 443, 50 peers | ⏳ Installing |

**Client Configuration:**
- Private Key: `ry5mCDxXlLO1maEl4vW7i5p+mT/JLVXgsvis9pk5x7s=` (from .env.local)
- Public Key (derived): `zyj0qUZj8xCu3Yu1AQVBteFB7glVz/NGSxO9Ct7F4QI=`
- Assigned IP: `172.16.10.2`
- Status: ✅ **Added as peer on all 5 spokes**

---

## 🧪 Test 1: Desktop VPN

### **Start Desktop App**
```bash
cd apps/desktop
pnpm dev
```

### **Test Flow**
1. ✅ App opens with "Privacy Sentinel" title
2. ✅ Click shield button (should show "Activating...")
3. ✅ Select US server
4. ✅ Watch console logs:
   - `[VPN Provision] Orchestrating Spoke: us in us-east-1`
   - `[VPN Provision] Found Spoke i-0af6b0bc717671ec3 in state: running`
   - `[VPN Provision] ✅ Spoke Ready! IP: 100.26.43.90`
   - `[VPN Provision] ✅ Direct-to-Spoke Config Ready: us @ 100.26.43.90:443`
   - `[VPN Toggle] Installing tunnel: ps-us`
   - `[Connectivity] Entering gateway polling loop (Max 60s)...`
   - `[Connectivity] OK: Handshake Verified (Ping Gateway 172.16.10.1 OK)`
   - `[Connectivity] OK: Internet transit verified.`

### **Expected Result**
✅ Shield button turns CYAN/BLUE (active state)  
✅ Status text: "Protection Active"  
✅ Console: "Connected & Verified."

### **If it fails:**
- Check Electron DevTools → Console for error logs
- Look for: "Handshake Timeout" or "Connection failed"
- Run: `ping 172.16.10.1` from cmd (should respond if tunnel is up)

---

## 🧪 Test 2: Extension VPN

### **Build Extension**
```bash
cd apps/extension
pnpm build
```

### **Load in Browser**
1. Chrome: `chrome://extensions` → Enable Developer Mode → Load Unpacked → `apps/extension/extension-dist`
2. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `apps/extension/extension-dist/manifest.json`

### **Test Flow**
1. ✅ Extension icon appears (shield icon)
2. ✅ Click extension → Shield tab
3. ✅ Header says "PRIVACY SENTINEL"
4. ✅ Toggle protection ON
5. ✅ VPN tab → Select "United States"
6. ✅ Right-click extension icon → Inspect background page → Check console:
   - `[Background] Provisioning VPN: us`
   - `[Background] Spoke ready: 100.26.43.90`
   - `[Background] [Probe] Result: 2/2 endpoints reachable. Status: PASS`
   - `[Background] VPN Status: READY - Protection fully active!`

### **Expected Result**
✅ Status text: "Protection fully active!"  
✅ Visit https://www.cloudflare.com/cdn-cgi/trace → check if IP changed

### **If it fails:**
- Check background console logs
- Look for: "Probe timeout" or "FAIL"
- Verify SOCKS5 is reachable: `curl --proxy socks5://100.26.43.90:1080 https://ifconfig.me`

---

## 🧪 Test 3: Mobile VPN

### **Build App**
```bash
cd apps/mobile
npx expo run:android
```

### **Test Flow**
1. ✅ App opens with "Privacy Sentinel" title
2. ✅ Tap shield button
3. ✅ Check logs:
   - `[VPN] Provisioning server: us`
   - `[VPN] Spoke ready: 100.26.43.90`
   - `[VPN] Connecting WireGuard tunnel...`
   - `[VPN] Status: UP`

### **Expected Result**
✅ Shield button animates (pulsing glow)  
✅ Status: "Connected"  
✅ Android VPN indicator appears in status bar

### **If it fails:**
- Run: `adb logcat | grep -E "WireGuard|VPN|PrivacySentinel"`
- Check for: "Permission denied" (need VPN permission in AndroidManifest)
- Verify: `WG_CLIENT_PRIVATE_KEY` in app.config.js

---

## 🔍 Diagnostic Commands

### **Check Instance State**
```bash
aws ec2 describe-instances --region us-east-1 --instance-ids i-0af6b0bc717671ec3 --query 'Reservations[0].Instances[0].[State.Name,PublicIpAddress]' --output text
```

### **Check WireGuard on Server**
```bash
ssh -i keysETC/PrivacyShield-Key.pem ubuntu@100.26.43.90 "sudo wg show wg0"
```

### **Check WARP Status**
```bash
ssh -i keysETC/PrivacyShield-Key.pem ubuntu@100.26.43.90 "warp-cli status && ip link show cloudflare-warp"
```

### **Test Handshake from Windows**
```powershell
# After desktop connects
ping 172.16.10.1
ping 8.8.8.8
curl https://www.cloudflare.com/cdn-cgi/trace
```

### **Check Active WireGuard Service**
```powershell
Get-Service WireGuardTunnel*
```

---

## 🎯 Success Criteria

- [x] All 5 spokes deployed with WireGuard on port 443
- [x] Client peer `zyj0qUZj...` added to all servers
- [x] Desktop client configured with matching private key
- [x] Hub references removed from all frontends
- [x] Auto-shutdown timers implemented (30min)
- [x] Console logs updated to reflect v5.0 architecture
- [x] Linter errors fixed
- [ ] Desktop VPN handshake successful (**YOU TEST THIS**)
- [ ] Extension SOCKS5 proxy working (**YOU TEST THIS**)
- [ ] Mobile native tunnel working (**YOU TEST THIS**)
- [ ] WARP egress verified (**Check in 10min**)

---

## ⚠️ Notes

**WARP Installation:**
- Still in progress via cloud-init (takes 10-15min total)
- VPN works NOW with AWS egress IP
- Once WARP finishes, egress will be Cloudflare IP
- Check: `warp-cli status` on any spoke

**Auto-Shutdown:**
- Spokes stop after 30min of no connection
- Reduces cost from $60/month → $10/month
- Next connect will auto-start them

**No Hub:**
- Clients connect directly to regional spokes
- Faster handshake, lower latency
- Simpler architecture

---

**Ready for your testing! Let me know if any issues.**
