/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const WG_EXE = path.join(BIN_DIR, 'wg.exe');
const WIREGUARD_EXE = path.join(BIN_DIR, 'wireguard.exe');

// Reliable mirror for portable WireGuard binaries (example versions)
const BINARY_URLS = {
  'wg.exe': [
    'https://github.com/DrEm-s/wireguard-windows-portable/releases/download/v1.0.2/wg.exe',
    'https://github.com/WireGuard/wireguard-windows/raw/0.5.3/embeddable-dll-service/x86_64/wg.exe'
  ],
  'wireguard.exe': [
    'https://github.com/DrEm-s/wireguard-windows-portable/releases/download/v1.0.2/wireguard.exe'
  ]
};

async function downloadFile(urls, dest) {
  if (typeof urls === 'string') urls = [urls];
  
  for (const url of urls) {
    console.log(`📡 Attempting download from: ${url}`);
    try {
      await new Promise((resolve, reject) => {
        https.get(url, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            if (fs.statSync(dest).size === 0) {
              fs.unlinkSync(dest);
              reject(new Error("File is empty"));
            } else {
              resolve();
            }
          });
        }).on('error', (err) => {
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(err);
        });
      });
      return; 
    } catch (err) {
      console.warn(`⚠️ Failed to download from ${url}: ${err.message}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
  }
  throw new Error("All mirrors failed for " + path.basename(dest));
}

async function main() {
  if (process.platform !== 'win32') {
    console.log("ℹ️ Skipping WireGuard binary download on Non-Windows platform. Ensure 'wg-quick' is installed via package manager.");
    return;
  }

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  console.log("🔍 Checking for WireGuard binaries...");

  const filesToDownload = [
    { name: 'wg.exe', path: WG_EXE, urls: BINARY_URLS['wg.exe'] },
    { name: 'wireguard.exe', path: WIREGUARD_EXE, urls: BINARY_URLS['wireguard.exe'] }
  ];

  for (const file of filesToDownload) {
    if (fs.existsSync(file.path) && fs.statSync(file.path).size > 0) {
      console.log(`✅ ${file.name} already exists.`);
    } else {
      console.log(`📥 Downloading ${file.name}...`);
      try {
        await downloadFile(file.urls, file.path);
        console.log(`✅ ${file.name} downloaded successfully.`);
      } catch (error) {
        console.warn(`⚠️ Automatic download failed for ${file.name}: ${error.message}`);
      }
    }
  }

  if (fs.existsSync(WG_EXE) && fs.existsSync(WIREGUARD_EXE)) {
    console.log("🚀 WireGuard environment ready.");
  } else {
    console.warn("⚠️ environment incomplete. wireguard.exe may be missing.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
