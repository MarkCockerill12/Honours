const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');
const nextDir = path.join(outDir, '_next');
const newNextDir = path.join(outDir, 'next');
const notFoundDir = path.join(outDir, '_not-found');
const newNotFoundDir = path.join(outDir, 'not-found');
const notFoundHtml = path.join(outDir, '_not-found.html');
const newNotFoundHtml = path.join(outDir, 'not-found.html');

// Rename directories
if (fs.existsSync(nextDir)) fs.renameSync(nextDir, newNextDir);
if (fs.existsSync(notFoundDir)) fs.renameSync(notFoundDir, newNotFoundDir);
if (fs.existsSync(notFoundHtml)) fs.renameSync(notFoundHtml, newNotFoundHtml);

// Delete text files that start with _
const filesToRemove = [
  '_not-found.txt',
  '__next.__PAGE__.txt',
  '__next._full.txt',
  '__next._head.txt',
  '__next._index.txt',
  '__next._tree.txt'
];

for (const file of filesToRemove) {
  const filePath = path.join(outDir, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Function to replace strings in files
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content
    .replace(/\/_next\//g, '/next/')
    .replace(/_next\//g, 'next/')
    .replace(/\/_not-found\//g, '/not-found/')
    .replace(/_not-found\//g, 'not-found/')
    .replace(/_not-found\.html/g, 'not-found.html');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
}

// Recursively walk through files and update
function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else {
      if (
        fullPath.endsWith('.html') ||
        fullPath.endsWith('.js') ||
        fullPath.endsWith('.css') ||
        fullPath.endsWith('.json') ||
        fullPath.endsWith('.txt') ||
        fullPath.endsWith('.map')
      ) {
        replaceInFile(fullPath);
      }
    }
  }
}

if (fs.existsSync(outDir)) {
  walkDir(outDir);
  console.log("Renamed Next.js system directories successfully for Chrome Extension.");
} else {
  console.log("out directory not found.");
}
