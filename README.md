# Privacy Sentinel — Integrated Security Suite

Privacy Sentinel is a high-performance, multi-platform digital defence suite designed to restore digital sovereignty. It provides a unified security framework across Desktop, Mobile, and Browser environments, featuring WireGuard-based regional tunneling, AI-driven content filtering, and heuristic phishing detection.

## 🚀 Key Features

-   **Direct-to-Spoke VPN:** Low-latency WireGuard tunneling across 5 global regions (US, UK, Germany, Japan, Sydney).
-   **AI Guardian (Groq LPU):** Real-time website summarisation and automated Trigger Warning detection.
-   **Intelligent Content Filter:** DOM-level blurring and redaction with "Kitten Mode" for mental well-being.
-   **CyberScanner:** Heuristic-based analysis of suspicious domains and phishing links.
-   **Dynamic Orchestration:** Automated "Wake-up" and "Auto-shutdown" of AWS Graviton infrastructure to balance cost and availability.
-   **B4ST10N Protocol:** Build-time XOR obfuscation for sensitive infrastructure credentials.

## 💻 Technical Stack

-   **Package Manager:** `pnpm` (v10) with Turborepo.
-   **Runtime:** `Bun` (v1.2) for ultra-fast compilation and script execution.
-   **Desktop:** `Electron` (v40) + `Next.js`.
-   **Extension:** `Next.js` Static Export (MV3 compatible).
-   **Mobile:** `Expo` (React Native) with native WireGuard modules.
-   **Infrastructure:** `Terraform` (IaC) on `AWS Graviton (ARM64)`.
-   **AI Engine:** `Groq LPU` (Multi-model fallback chain).

## 📁 Project Structure

```bash
apps/
├── desktop/      # Electron Dashboard (System-wide VPN/AdBlock)
├── extension/    # Web Extension (AI Guardian/Smart Filters)
└── mobile/       # React Native App (Native Android Tunneling)
packages/
└── core/         # Shared Logic, Types, and Security Decoders
tools/            # Infrastructure scripts and Auto-shutdown watchdog
```

## 🛠 Installation and Setup

### 1. Prerequisites
Ensure you have the following installed:
-   **Bun 1.2+** (`curl -fsSL https://bun.sh/install | bash`)
-   **pnpm 10** (`npm install -g pnpm`)
-   **AWS CLI** (configured with IAM permissions for EC2)

### 2. Dependencies
Install the monorepo dependencies:
```bash
pnpm install
```

### 3. Environment Configuration
Create a `.env` file in the root with your regional identifiers and AWS keys. The build pipeline will automatically encode these using the XOR mask to ensure safety in public repositories.

## 🏃 Running the Suite

### Desktop Dashboard
```bash
pnpm run dev:desktop
```

### Web Extension
```bash
pnpm --filter @privacy-sentinel/extension run build
# Load apps/extension/out as an unpacked extension in Chrome/Edge
```

### Mobile App (Physical Device)
```bash
cd apps/mobile
eas build --profile development --platform android
# Install the resulting APK and run with:
npx expo start --dev-client
```

## 🛡 Security and Integrity

Privacy Sentinel is built with a **Privacy-by-Design** philosophy. 
- **Zero-Logs:** No traffic metadata or DNS queries are recorded on the spokes.
- **Data Minimization:** No user accounts or personal identifiable information (PII) required.
- **Resilience:** Daily encrypted backups to OneDrive and build-time obfuscation of all infrastructure secrets.
