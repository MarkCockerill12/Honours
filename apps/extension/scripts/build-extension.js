const { build } = require("esbuild");
const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");

// Load .env and .env.local manually if they exist
try {
  const envPaths = [
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../../.env.local"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../.env.local")
  ];
  
  envPaths.forEach(envPath => {
    if (fs.existsSync(envPath)) {
      console.log(`📝 Loading environment variables from ${path.basename(envPath)}...`);
      const envContent = fs.readFileSync(envPath, "utf-8");
      envContent.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          // Don't overwrite existing env vars to respect hierarchy (.env.local > .env)
          if (!process.env[key]) {
            process.env[key] = value.trim();
          }
        }
      });
    }
  });
} catch (err) {
  console.warn("⚠️ Failed to load environment files:", err.message);
}

const watchMode = process.argv.includes("--watch");

// Groq Key Obfuscation
function obfuscateKey(key) {
  if (!key) return { cipher: '', nonce: '' };
  const nonce = [];
  for (let i = 0; i < key.length; i++) {
    nonce.push((i * 37 + 42) % 256);
  }
  const cipher = [];
  for (let i = 0; i < key.length; i++) {
    cipher.push(key.charCodeAt(i) ^ nonce[i]);
  }
  return {
    cipher: Buffer.from(cipher).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  };
}

// SHIELD Obfuscation (XOR matching core/security.ts)
const SHIELD_MASK = "B4ST10N_PR0T0C0L";
const PREFIX = "SHIELD:";

function encodeShieldKey(input) {
  if (!input) return "";
  const cleanInput = input.trim();
  if (cleanInput.startsWith(PREFIX)) return cleanInput;
  const hex = cleanInput.split('').map((char, i) => {
    const code = char.charCodeAt(0) ^ SHIELD_MASK.charCodeAt(i % SHIELD_MASK.length);
    return code.toString(16).padStart(2, '0');
  }).join('');
  return PREFIX + hex;
}

const groqObf = obfuscateKey(process.env.GROQ_API_KEY || "");

const buildConfig = {
  entryPoints: {
    "content-script": "./utils/content.ts",
    background: "./utils/background.ts",
  },
  bundle: true,
  outdir: "extension-dist",
  platform: "browser",
  target: ["chrome100"],
  logLevel: "info",
  define: {
    "process.env.GEMINI_API_KEY": JSON.stringify(process.env.GEMINI_API_KEY || ""),
    "process.env.GROQ_API_KEY": JSON.stringify(process.env.GROQ_API_KEY || ""),
    "process.env.GROQ_CIPHER": JSON.stringify(groqObf.cipher),
    "process.env.GROQ_NONCE": JSON.stringify(groqObf.nonce),
    "process.env.AWS_ACCESS_KEY_ID": JSON.stringify(encodeShieldKey(process.env.AWS_ACCESS_KEY_ID || "")),
    "process.env.AWS_SECRET_ACCESS_KEY": JSON.stringify(encodeShieldKey(process.env.AWS_SECRET_ACCESS_KEY || "")),
  },
  alias: {
    "@privacy-shield/core": path.resolve(__dirname, "../../../packages/core/src/index.ts"),
    "@privacy-shield/core/shared": path.resolve(__dirname, "../../../packages/core/src/shared/index.ts"),
  },
  tsconfig: path.resolve(__dirname, "../tsconfig.json"),
};

if (watchMode) {
  console.log("👁️  Watching for changes in extension files...");
  chokidar
    .watch([
      "./utils/**/*.ts",
      "./utils/**/*.tsx",
      "./components/**/*.tsx",
    ])
    .on("change", async (path) => {
      console.log("⚡ File changed:", path);
      console.log("⚡ Rebuilding Extension Scripts...");
      await build(buildConfig);
      console.log("✓ Extension scripts rebuilt");
    });
} else {
  // Clean legacy files in public directory to prevent API key exposure
  const legacyFiles = ["background.js", "content-script.js"];
  legacyFiles.forEach(file => {
    const filePath = path.join(__dirname, "../public", file);
    if (fs.existsSync(filePath)) {
      console.log(`🧹 Removing legacy file: ${file}`);
      fs.unlinkSync(filePath);
    }
  });

  build(buildConfig);
}
