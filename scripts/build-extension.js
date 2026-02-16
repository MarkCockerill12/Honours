// A simple script to watch and compile your background/content scripts
const { build } = require('esbuild');
const chokidar = require('chokidar'); // You might need to npm install chokidar

const watchMode = process.argv.includes('--watch');

const buildConfig = {
  entryPoints: [
    './apps/extension/Utils/content.ts', // Your Blocker Logic
    './apps/extension/Utils/background.ts' // Make sure you create this if needed
  ],
  bundle: true,
  outdir: 'public', // Dumps compiled JS into public/
  platform: 'browser',
  target: ['chrome100'],
  logLevel: 'info',
};

if (watchMode) {
  // Watch for changes and rebuild
  chokidar.watch(['./apps/extension/Utils/**/*.ts', './packages/**/*.ts']).on('change', async () => {
    console.log('⚡ Rebuilding Extension Scripts...');
    await build(buildConfig);
  });
} else {
  build(buildConfig);
}