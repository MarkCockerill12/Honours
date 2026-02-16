const { build } = require('esbuild');
const chokidar = require('chokidar');

const watchMode = process.argv.includes('--watch');

const buildConfig = {
  // CHANGED: Use object syntax to rename output files
  entryPoints: {
    'content-script': './apps/extension/Utils/content.ts', // Outputs public/content-script.js
    'background': './apps/extension/Utils/background.ts'   // Outputs public/background.js
  },
  bundle: true,
  outdir: 'public',
  platform: 'browser',
  target: ['chrome100'],
  logLevel: 'info',
};

if (watchMode) {
  chokidar.watch(['./apps/extension/Utils/**/*.ts', './packages/**/*.ts']).on('change', async () => {
    console.log('⚡ Rebuilding Extension Scripts...');
    await build(buildConfig);
  });
} else {
  build(buildConfig);
}