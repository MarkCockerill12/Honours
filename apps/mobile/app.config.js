const dotenv = require('dotenv');
const path = require('path');

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Simple XOR mask to match core/security.ts
const SHIELD_MASK = "B4ST10N_PR0T0C0L";
const PREFIX = "SHIELD:";

function encode(input) {
  if (!input) return "";
  const cleanInput = input.trim();
  if (cleanInput.startsWith(PREFIX)) return cleanInput;
  
  const hex = cleanInput.split('').map((char, i) => {
    const code = char.charCodeAt(0) ^ SHIELD_MASK.charCodeAt(i % SHIELD_MASK.length);
    return code.toString(16).padStart(2, '0');
  }).join('');
  
  return PREFIX + hex;
}

module.exports = {
  expo: {
    name: 'Privacy Sentinel',
    slug: 'privacy-sentinel',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    plugins: [
      "./plugins/withWireGuard",
    ],
    ios: {
      bundleIdentifier: 'com.markcockerill.privacysentinel',
      supportsTablet: true
    },
    android: {
      package: 'com.markcockerill.privacysentinel',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#0f172a'
      },
      predictiveBackGestureEnabled: false
    },
    extra: {
      awsAccessKeyId: encode(process.env.AWS_ACCESS_KEY_ID || 'MISSING'),
      awsSecretAccessKey: encode(process.env.AWS_SECRET_ACCESS_KEY || 'MISSING'),
      wgKeyVersion: '3',
      wgClientPrivateKey: encode(process.env.WG_CLIENT_PRIVATE_KEY || 'MISSING'),
      wgUsPublicKey: encode(process.env.WG_US_PUBLIC_KEY || 'MISSING'),
      wgUkPublicKey: encode(process.env.WG_UK_PUBLIC_KEY || 'MISSING'),
      wgDePublicKey: encode(process.env.WG_DE_PUBLIC_KEY || 'MISSING'),
      wgJpPublicKey: encode(process.env.WG_JP_PUBLIC_KEY || 'MISSING'),
      wgAuPublicKey: encode(process.env.WG_AU_PUBLIC_KEY || 'MISSING'),
    }
  }
};
