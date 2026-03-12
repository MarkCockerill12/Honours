const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = path.join(__dirname, '..', 'out');
const manifestPath = path.join(outDir, 'manifest.json');

function hashString(s) {
  return "sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64');
}

function extractHashes(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Match script tags with content inside
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const hashes = new Set();

  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const scriptContent = match[1].trim();
    // Skip external script tags or empty script tags
    if (fullMatch.includes(' src=') || !scriptContent) {
      continue;
    }
    const hash = hashString(match[1]);
    hashes.add(`'${hash}'`);
  }
  return [...hashes];
}

function walkDir(dir) {
  let hashes = new Set();
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const subHashes = walkDir(fullPath);
      for (const h of subHashes) hashes.add(h);
    } else if (fullPath.endsWith('.html')) {
      const hList = extractHashes(fullPath);
      for (const h of hList) hashes.add(h);
    }
  }
  return hashes;
}

if (fs.existsSync(outDir) && fs.existsSync(manifestPath)) {
  console.log("Hashing inline script tags in HTML to generate CSP...");
  const allHashes = [...walkDir(outDir)];
  
  if (allHashes.length > 0) {
    console.log(`Discovered ${allHashes.length} unique inline scripts. Updating manifest CSP.`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Default Chrome Extension MV3 CSP + Hashes + wasm eval (turbopack/next sometimes uses wasm or eval in dev)
    const csp = `script-src 'self' 'wasm-unsafe-eval' ${allHashes.join(' ')}; object-src 'self'`;
    
    manifest.content_security_policy = manifest.content_security_policy || {};
    manifest.content_security_policy.extension_pages = csp;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log("Manifest V3 CSP generated successfully!");
  } else {
    console.log("No inline scripts found to hash.");
  }
} else {
  console.log("out directory or manifest.json not found.");
}
