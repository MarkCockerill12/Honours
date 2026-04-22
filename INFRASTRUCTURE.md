# Privacy Sentinel — Integrated Infrastructure & Security Documentation (v5.3)

**Last Updated:** April 21, 2026  
**Project Status:** ✅ Production Ready  
**Architecture Version:** v5.2 (High-Performance Direct-to-Spoke)

---

## 🌐 1. Architecture Overview

Privacy Sentinel utilizes a **Direct-to-Spoke** model. Clients (Desktop, Mobile, or Extension) connect directly to regional "spoke" servers hosted on AWS, bypassing the need for a central hub and reducing latency.

### Traffic Flow
```
Client Device (Desktop/Mobile/Extension)
    ↓ [WireGuard Tunnel - UDP 443] OR [SOCKS5 - TCP 1080]
Regional Spoke (EC2 Instance)
    ↓ [Direct NAT via ens5]
Internet (IP Masked by AWS Regional IP)
```

### Key Infrastructure Components
1.  **WireGuard (wg0)**: Primary VPN tunnel on port 443. Optimized with **MTU 1420** and **TCP MSS 1380** for maximum AWS throughput.
2.  **microsocks**: Authenticated-at-network-layer SOCKS5 proxy on port 1080 for browser extensions.
3.  **dnsmasq**: Local DNS resolver on each spoke (172.16.10.1) providing split-horizon DNS.
4.  **Auto-Shutdown Watchdog**: Server-side bash script running via cron to terminate idle instances after 30 minutes, ensuring cost-efficiency.

---

## 🛡️ 2. Security Configuration

### 2.1 Cryptographic Standards
-   **VPN Protocol**: WireGuard (ChaCha20-Poly1305 AEAD, Curve25519 ECDH, BLAKE2s).
-   **Transport**: UDP 443 (Firewall-friendly, masquerades as HTTPS-like traffic).
-   **Privacy**: Zero-logs policy. No traffic inspection or metadata collection is performed on regional spokes.

### 2.2 Key Management & Obfuscation
Keys and credentials are never hardcoded in plaintext. They are protected via a multi-stage pipeline:
1.  **At Rest**: Raw keys stored in `.env.local` (git-ignored).
2.  **Obfuscation**: Build scripts apply XOR encoding using the mask `B4ST10N_PR0T0C0L`.
3.  **In-Flight**: Electron and React Native decoders recover keys in memory at runtime.
4.  **Safety**: Validated as safe for GitHub push as all sensitive identifiers remain in local environment variables.

### 2.3 Network Security (Firewall Rules)
| Protocol | Port | Service | Access Control |
|----------|------|---------|----------------|
| UDP | 443 | WireGuard VPN | Security Group Restricted |
| TCP | 1080 | SOCKS5 Proxy | Security Group + Network Layer Isolation |
| TCP | 22 | SSH | Key-based Auth + IP Whitelisting |
| ICMP | -1 | Ping | Enabled for latency analytics |

---

## 📍 3. Regional Deployments

All servers run **Ubuntu 24.04 ARM64** on **t4g.small** instances with `SourceDestCheck` disabled to permit NAT routing.

| Region | Name | Instance ID | Status |
|--------|------|-------------|--------|
| **us-east-1** | VPN-US | i-0d4fe8f00bee265ee | ✅ Operational |
| **eu-west-2** | VPN-UK | i-01efdc64f934f2303 | ✅ Operational |
| **eu-central-1** | VPN-Germany | i-0ecc5ca8442e0c3ce | ✅ Operational |
| **ap-northeast-1** | VPN-Japan | i-0841ba747fa8cadd2 | ✅ Operational |
| **ap-southeast-2** | VPN-Sydney | i-097b269d2afd8669b | ✅ Operational |

---

## 🚀 4. AdBlock & Content Filtering

### 4.1 Implementation
The system supports system-wide ad-blocking via **AdGuard DNS** (`94.140.14.14`). 

**Technical Note**: To bypass Windows Filtering Platform (WFP) restrictions, the Desktop app performs a seamless **1.5-second micro-restart** of the VPN tunnel when toggling AdBlock. This ensures WireGuard kernel rules are correctly updated with the new DNS endpoints.

### 4.2 Content Filter Architecture
-   **Core**: DOM-based text matching using `MutationObserver`.
-   **Security**: Heuristic scoring (0-10) for phishing detection and URL obfuscation.
-   **Ad Blocking**: Integrated Ghostery engine active in Electron sessions.

---

## 💾 5. Lifecycle & Cost Optimization

### 5.1 Server-Side Auto-Shutdown
Instances are programmed to self-terminate after 30 minutes of inactivity. The logic is enforced by `/usr/local/bin/auto-shutdown.sh` which checks for:
-   Active WireGuard handshakes.
-   System uptime vs. network activity.

### 5.2 Dynamic Discovery
Client frontends do not use hardcoded IPs. They utilize the AWS SDK to dynamically fetch the `PublicIpAddress` of the target spoke, allowing for seamless rotation and recovery of instances.

---

## 📝 6. Version History & Changes

### v5.3 (Current)
-   **Merged Documentation**: Consolidated Infrastructure, Security, and Status reports into a unified handbook.
-   **Performance**: Locked MTU at 1420 for all platforms.
-   **Stability**: Removed client-side timers; transitioned to server-side watchdog.
-   **Multi-User**: Pre-provisioned 50 peer slots for scalability.

### v5.2
-   Optimized connection handshake speeds.
-   Fixed AdGuard DNS resolution blackout on Windows.
-   Successfully implemented Direct NAT egress (dropped failing WARP relay).
