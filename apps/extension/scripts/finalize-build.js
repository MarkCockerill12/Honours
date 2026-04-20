const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const distDir = path.join(__dirname, '..', 'extension-dist');

console.log("🏁 Finalizing extension build...");

if (!fs.existsSync(outDir)) {
    console.error("❌ 'out' directory not found. Run 'next build' first.");
    process.exit(1);
}

// 1. Rename index.html to extension.html (as expected by manifest.json)
const indexPath = path.join(outDir, 'index.html');
const extensionPath = path.join(outDir, 'extension.html');

if (fs.existsSync(indexPath)) {
    console.log("📄 Renaming index.html to extension.html...");
    fs.renameSync(indexPath, extensionPath);
} else {
    console.warn("⚠️ index.html not found in 'out' folder.");
}

// 2. Copy scripts from extension-dist to out
const scripts = ['background.js', 'content-script.js'];
scripts.forEach(script => {
    const src = path.join(distDir, script);
    const dest = path.join(outDir, script);
    
    if (fs.existsSync(src)) {
        console.log(`📦 Copying ${script} to 'out' folder with cache-buster...`);
        let content = fs.readFileSync(src, 'utf8');
        // Append cache-buster comment
        content += `\n// Build Time: ${new Date().toISOString()}\n`;
        fs.writeFileSync(dest, content);
    } else {
        console.error(`❌ ${script} not found in 'extension-dist' folder. Run 'node scripts/build-extension.js' first.`);
    }
});

console.log("✅ Extension build finalized.");
