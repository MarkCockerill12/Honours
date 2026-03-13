const fs = require("fs");
const path = require("path");

const dirsToClean = [
  ".next",
  "out",
  "public/background.js",
  "public/content-script.js",
  "public/background.js.map",
  "public/content-script.js.map",
];

console.log("🧹 Cleaning project caches and build artifacts...");

dirsToClean.forEach((dir) => {
  const fullPath = path.resolve(__dirname, "..", dir);
  if (fs.existsSync(fullPath)) {
    try {
      if (fs.lstatSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`✅ Removed directory: ${dir}`);
      } else {
        fs.unlinkSync(fullPath);
        console.log(`✅ Removed file: ${dir}`);
      }
    } catch (err) {
      console.error(`❌ Error removing ${dir}:`, err.message);
    }
  }
});

console.log("✨ Cleanup complete.");
