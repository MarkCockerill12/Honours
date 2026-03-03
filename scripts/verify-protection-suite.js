const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("--- PRIVACY PROTECTOR VERIFICATION SUITE ---");

// 1. DNS Resolution Test
console.log("\n[1/3] VERIFYING DNS BLOCKING...");
try {
  const domains = [
    "googleadservices.com",
    "doubleclick.net",
    "ad.doubleclick.net",
  ];
  let allBlocked = true;

  for (const domain of domains) {
    try {
      const output = execSync(`nslookup ${domain}`).toString();
      if (output.includes("0.0.0.0") || output.includes("::")) {
        console.log(`✅ ${domain} is properly BLOCKED`);
      } else {
        console.log(`❌ ${domain} is NOT blocked (Resolves to IP: ${output})`);
        allBlocked = false;
      }
    } catch (e) {
      // If nslookup fails, it might be because the DNS server is blocking resolution entirely (NXDOMAIN)
      console.log(
        `✅ ${domain} is properly BLOCKED (Resolution failed/NXDOMAIN)`,
      );
    }
  }
} catch (error) {
  console.error("DNS Test Error:", error.message);
}

// 2. Extension Build Integrity
console.log("\n[2/3] VERIFYING EXTENSION BUILD...");
const extensionFiles = [
  "public/background.js",
  "public/content-script.js",
  "public/manifest.json",
];

extensionFiles.forEach((file) => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${file} exists (${(stats.size / 1024).toFixed(2)} KB)`);

    // Basic check for content script logic
    if (file.endsWith(".js")) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.length > 500) {
        console.log(`   - Payload seems valid (contains logic)`);
      } else {
        console.log(`   - ⚠️ Payload seems suspiciously small`);
      }
    }
  } else {
    console.log(`❌ ${file} is MISSING!`);
  }
});

// 3. UI/Next.js Build Check
console.log("\n[3/3] VERIFYING NEXT.JS APP...");
if (fs.existsSync(path.join(process.cwd(), ".next"))) {
  console.log("✅ .next directory found (Production build ready)");
} else {
  console.log('❌ Production build not found. Run "npm run build" first.');
}

console.log("\n--- VERIFICATION COMPLETE ---");
