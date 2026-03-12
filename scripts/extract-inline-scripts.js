const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = path.join(__dirname, '..', 'out');

function extractInlineScripts(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  
  let match;
  let modifiedHtml = html;
  let scriptCount = 0;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const scriptContent = match[1].trim();

    // Skip scripts that already have src attributes or are empty
    if (fullMatch.includes(' src=') || !scriptContent) {
      continue;
    }

    scriptCount++;
    const hash = crypto.createHash('sha256').update(scriptContent).digest('hex').slice(0, 10);
    const scriptFileName = `inline-script-${hash}.js`;
    const scriptFilePath = path.join(path.dirname(htmlPath), scriptFileName);

    fs.writeFileSync(scriptFilePath, scriptContent, 'utf8');

    // Replace the inline script with an external script tag
    // Copy the original attributes except for those we don't need
    const attrsMatch = fullMatch.match(/<script([^>]*)>/i);
    const attrs = attrsMatch ? attrsMatch[1] : '';
    const newScriptTag = `<script${attrs} src="${scriptFileName}"></script>`;
    
    modifiedHtml = modifiedHtml.replace(fullMatch, newScriptTag);
  }

  if (html !== modifiedHtml) {
    fs.writeFileSync(htmlPath, modifiedHtml, 'utf8');
    console.log(`Extracted ${scriptCount} inline scripts from ${path.basename(htmlPath)}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.html')) {
      extractInlineScripts(fullPath);
    }
  }
}

function restoreManifest() {
  const manifestPath = path.join(outDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // reset csp
    if (manifest.content_security_policy && manifest.content_security_policy.extension_pages) {
      delete manifest.content_security_policy;
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('Restored manifest CSP.');
  }
}

if (fs.existsSync(outDir)) {
  console.log("Extracting inline scripts from Next.js HTML to comply with MV3 CSP...");
  processDirectory(outDir);
  restoreManifest();
  console.log("Inline script extraction complete.");
} else {
  console.log("out directory not found.");
}
