const { build } = require("esbuild");
const chokidar = require("chokidar");

const watchMode = process.argv.includes("--watch");

const buildConfig = {
  // CHANGED: Use object syntax to rename output files
  entryPoints: {
    "content-script": "./apps/extension/Utils/content.ts", // Outputs public/content-script.js
    background: "./apps/extension/Utils/background.ts", // Outputs public/background.js
  },
  bundle: true,
  outdir: "public",
  platform: "browser",
  target: ["chrome100"],
  logLevel: "info",
  // Inject API keys from environment at build time
  define: {
    "process.env.GEMINI_API_KEY": JSON.stringify(process.env.GEMINI_API_KEY || ""),
    "process.env.SAFE_BROWSING_API_KEY": JSON.stringify(process.env.SAFE_BROWSING_API_KEY || ""),
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
