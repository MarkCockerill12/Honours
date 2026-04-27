const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');

/**
 * Robustly renames directories and files starting with _ or __ to comply with Chrome Extension rules.
 * Also removes internal Next.js meta files (.txt) and updates references in code.
 */

// Helper to handle Windows file locking (EPERM) during rename
function robustMoveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  try {
    // Try rename first (fastest)
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EXDEV') {
      console.warn(`⚠️ Rename failed for ${src} (${err.code}), falling back to copy+delete...`);
      try {
        // Copy directory or file
        fs.cpSync(src, dest, { recursive: true });
        // Delete original
        fs.rmSync(src, { recursive: true, force: true });
      } catch (copyErr) {
        console.error(`❌ Robust move failed: ${copyErr.message}`);
        throw copyErr;
      }
    } else {
      throw err;
    }
  }
}

function processDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    // 1. Handle Directories
    if (stat.isDirectory()) {
      if (item.startsWith('_')) {
        const targetName = item.replace(/^_+/, ''); // Remove all leading underscores
        const newPath = path.join(dir, targetName);
        
        // Handle potential collisions (though unlikely in Next.js export)
        if (fs.existsSync(newPath) && newPath !== fullPath) {
          console.warn(`⚠️ Collision detected: ${newPath} already exists. Merging...`);
          // Basic merge: move contents and delete old
          fs.readdirSync(fullPath).forEach(sub => {
            robustMoveSync(path.join(fullPath, sub), path.join(newPath, sub));
          });
          fs.rmdirSync(fullPath);
        } else {
          robustMoveSync(fullPath, newPath);
        }
        processDirRecursive(newPath);
      } else {
        processDirRecursive(fullPath);
      }
    } 
    // 2. Handle Files
    else {
      // Remove internal meta files (.txt) starting with __next or _not-found
      if (item.endsWith('.txt') && (item.startsWith('__next') || item.startsWith('_not-found'))) {
        fs.unlinkSync(fullPath);
        continue;
      }

      if (item.startsWith('_')) {
        const targetName = item.replace(/^_+/, '');
        const newPath = path.join(dir, targetName);
        robustMoveSync(fullPath, newPath);
      }

      // 3. Update references in relevant file types
      const ext = path.extname(item).toLowerCase();
      if (['.html', '.js', '.css', '.json', '.map', '.txt'].includes(ext)) {
        const currentPath = item.startsWith('_') ? path.join(dir, item.replace(/^_+/, '')) : fullPath;
        updateReferencesInFile(currentPath);
      }
    }
  }
}

function updateReferencesInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Replace /_next/ with /next/
    // Replace /_not-found/ with /not-found/
    // Handle both / prefix and relative ./ or ../ prefixes
    // Added more patterns to be safe
    content = content
      .replace(/\/_next\//g, '/next/')
      .replace(/(_next\/)/g, 'next/')
      .replace(/\/_not-found\//g, '/not-found/')
      .replace(/(_not-found\/)/g, 'not-found/')
      .replace(/_not-found\.html/g, 'not-found.html')
      .replace(/\/_next_/g, '/next_') // Catch cases like /_next_data/
      .replace(/_next_/g, 'next_');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  } catch (err) {
    console.error(`❌ Failed to update references in ${filePath}:`, err.message);
  }
}

console.log("🚀 Starting aggressive Next.js compliance cleanup for Chrome Extension...");
if (fs.existsSync(outDir)) {
  processDirRecursive(outDir);
  console.log("✅ Cleanup complete. All forbidden underscores removed.");
} else {
  console.error("❌ 'out' directory not found. Run 'next build' first.");
}
