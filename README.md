# Privacy Shield

Privacy Shield is a comprehensive, multi-platform privacy suite designed to secure user connections and block intrusive trackers. It consists of three distinct frontends—a Browser Extension, a Desktop App, and a Mobile App—all managed within a unified monorepo architecture.

## 🚀 Functionality
- **Ad & Tracker Blocking:** Integrated with Ghostery's AdBlocker engine to block ads and trackers at the network/browser level.
- **Virtual Private Network (VPN):** Native WireGuard VPN integration across platforms.
- **On-Demand Cloud Infrastructure:** Uses AWS EC2 SDKs to programmatically spin up and configure VPN servers (e.g., in `us`, `uk`, `de`, `jp`, `au`) on the fly to protect user traffic.

## 💻 Tech Stack
- **Package Manager:** `pnpm` (v10) with Turborepo workspaces.
- **Frameworks & Libraries:** React 19, Next.js 16, Expo (React Native), Electron.
- **Styling & UI:** Tailwind CSS v4, Radix UI primitives, Lucide React (Icons), Anime.js for animations.
- **VPN / Core logic:** `@ghostery/adblocker`, `react-native-wireguard-vpn`, AWS SDK (`@aws-sdk/client-ec2`).

## 📁 Project Structure (Monorepo)
- `apps/desktop/` - The Desktop App (Electron + Next.js)
- `apps/extension/` - The Browser Extension (Next.js Export + Ghostery WebExtension)
- `apps/mobile/` - The Mobile App (React Native via Expo)
- `packages/core/` - Shared UI components and configurations

## 🏃 How to Run the Applications

### 1. Browser Extension
To build the browser extension:
```bash
pnpm --filter @privacy-shield/extension run build
```
Once the build completes, open your browser's extension management page (e.g., `chrome://extensions`), enable "Developer mode", and load the generated `apps/extension/out` folder as an unpacked extension.

### 2. Desktop Application (Electron)
The desktop app utilizes Electron wrapping a Next.js frontend.
```bash
cd apps/desktop
pnpm run dev
```
*(You can also use the root command `pnpm run dev:desktop`)*

### 3. Mobile Application (React Native / Expo)
The mobile app uses a custom native module (`react-native-wireguard-vpn`) and therefore **cannot be run in the standard Expo Go app**. Since you are testing on a physical device via cable and may not have a local Android SDK, the best approach is to use **EAS (Expo Application Services)** to build a custom "Development Client" in the cloud.

**Step 1: Build the Custom Development Client (Cloud Build)**
This creates an APK specifically for your project that includes the native WireGuard code. You only need to do this once (or whenever native dependencies change).
1. `npm install -g eas-cli` (if not installed)
2. `cd apps/mobile`
3. `eas build --profile development --platform android`
4. Download the resulting APK from the link provided by EAS and install it on your phone.

**Step 2: Run and Develop**
Once the custom app is installed on your phone, you can develop with hot-reloading just like Expo Go:
1. `cd apps/mobile`
2. `npx expo start --dev-client`
3. Open the "Privacy Shield" app on your phone and it will connect to your local dev server.

**Building a Standalone Installable APK (For Any Device):**
To generate a final, shareable `.apk` file:
```bash
cd apps/mobile
eas build -p android --profile preview
```

## ⚙️ Backend & Infrastructure (AWS EC2)
Instead of a traditional persistent backend, Privacy Shield interacts directly with AWS EC2 using the AWS SDK (`@aws-sdk/client-ec2`). When a user activates the VPN, the client authenticates and issues a command to boot an EC2 instance in the desired region (e.g., `VPN-US` for `us-east-1`). The instance runs WireGuard to securely tunnel traffic.

## 🛠 Prerequisites
- Node.js 22+
- `pnpm` (`npx only-allow pnpm`)
- Bun (used for some internal build scripts)
- Android Studio / Android SDK (for mobile compilation)
