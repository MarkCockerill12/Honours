# Privacy Sentinel — Deployment & Security Manual (v5.3)

**Date:** April 21, 2026  
**Status:** ✅ Production Certified  
**Architecture:** Direct-to-Spoke (v5.2)

---

## 🛡️ 1. Security & Key Integrity

This project is **Safe for GitHub**. All sensitive credentials follow the "Privacy Sentinel Key Lifecycle":

1.  **Strict Exclusion**: All `.env`, `.env.local`, and `.pem` keys are listed in `.gitignore`.
2.  **XOR Obfuscation**: Keys used in build artifacts are encoded with the `B4ST10N_PR0T0C0L` mask.
3.  **No Plaintext Leaks**: Server private keys are confined to the `keysETC/` directory and Terraform state, which are excluded from public source distribution.
4.  **Forward Secrecy**: The system uses WireGuard (Curve25519), ensuring that even if a server key were compromised, past traffic remains encrypted.

---

## 🏗️ 2. Infrastructure Summary

### Core Components
- **WireGuard**: Port 443, Subnet `172.16.10.0/24`.
- **NAT**: Direct MASQUERADE via `ens5`.
- **MTU**: 1420 (Optimized for AWS Global Accelerator).
- **DNS**: Choice of Cloudflare (`1.1.1.1`) or AdGuard (`94.140.14.14`).

### Management
- **Deployment**: Terraform (`keysETC/main.tf`).
- **Global Recovery**: `EXTREME_WORKING_VERSION_1.sh`.
- **Watchdog**: Server-side auto-shutdown (30min idle).

---

## ✅ 3. Platform Status

| Platform | VPN Tunnel | Ad Blocking | Status |
|----------|------------|-------------|--------|
| **Desktop** | WireGuard | System-Wide | ✅ Functional |
| **Extension** | SOCKS5 | Browser-Only | ✅ Functional |
| **Mobile** | Native WireGuard | In-App / System | ✅ Functional |

---

## 🔧 4. Common Maintenance

### Adding a New Peer
To add a user without a full rebuild:
```bash
bash tools/add-peer-to-all.sh
```

### Force Reset Fleet
To recover from a corrupted server state:
```bash
bash EXTREME_WORKING_VERSION_1.sh
```

### Checking Latency
Latency is calculated via regional AWS DynamoDB endpoints to provide real-world transit metrics rather than ICMP echo times.

---

**End of Combined Documentation.**
