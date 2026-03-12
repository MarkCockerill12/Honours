const { build } = require("esbuild");
const chokidar = require("chokidar");
const fs = require("fs");

let geminiKey = process.env.GEMINI_API_KEY || "";
let sbKey = process.env.SAFE_BROWSING_API_KEY || "";

// Parse .env and .env.local manually since dotenv might not be installed
try {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const envFile = fs.readFileSync(file, "utf8");
      envFile.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let val = match[2] ? match[2].replace(/(^['"]|['"]$)/g, '').trim() : "";
          if (match[1] === "GEMINI_API_KEY" && !geminiKey) geminiKey = val;
          if (match[1] === "SAFE_BROWSING_API_KEY" && !sbKey) sbKey = val;
        }
      });
    }
  }
} catch (e) {
  console.warn("Could not read env files", e);
}

const watchMode = process.argv.includes("--watch");

const buildConfig = {
  entryPoints: {
    "content-script": "./apps/extension/Utils/content.ts",
    background: "./apps/extension/Utils/background.ts",
  },
  bundle: true,
  outdir: "public",
  platform: "browser",
  target: ["chrome100"],
  logLevel: "info",
  define: {
    "process.env.GEMINI_API_KEY": JSON.stringify(geminiKey),
    "process.env.SAFE_BROWSING_API_KEY": JSON.stringify(sbKey),
  },
};

if (watchMode) {
  console.log("👁️  Watching for changes in extension files...");
  chokidar
    .watch([
      "./apps/extension/**/*.ts",
      "./apps/extension/**/*.tsx",
      "./packages/**/*.ts",
    ])
    .on("change", async (path) => {
      console.log("⚡ File changed:", path);
      console.log("⚡ Rebuilding Extension Scripts...");
      await build(buildConfig);
      console.log("✓ Extension scripts rebuilt");
    });
} else {
  build(buildConfig);
}
