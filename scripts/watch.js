// Sync Youlag extension files to local FreshRSS development folder based on .env configuration.
// The automatic syncing of files allows for easier development and testing.
// `npm run watch`

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const util = require('util');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const metadata = require('../metadata.json');
const version = metadata.version;

const tempDir = path.resolve(__dirname, '../.tmp');
fs.mkdirSync(tempDir, { recursive: true });

const srcScriptPath = path.resolve(__dirname, '../src/script.js');
const minScriptPath = path.resolve(__dirname, '../static/script.min.js');
const scriptTempDest = path.join(tempDir, 'script.min.js');

async function minifyAndInjectVersion() {
  const terser = require('terser');
  let srcContent = fs.readFileSync(srcScriptPath, 'utf8')
    .replace(/let YOULAG_VERSION\s*=\s*['"].*?['"];?/, `let YOULAG_VERSION = '${version}';`);
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    const { code, error } = await terser.minify(srcContent, {
      compress: true,
      mangle: { reserved: ['YOULAG_VERSION'] }
    });
    if (error || !code) throw error || new Error('No code output');
    fs.writeFileSync(minScriptPath, code);
    fs.writeFileSync(scriptTempDest, code);
    return true;
  } catch (err) {
    console.error('Terser error:', err);
    return false;
  }
}

(async () => {
  await minifyAndInjectVersion();
})();

const extensionFiles = [
  { src: path.relative(__dirname, scriptTempDest), dest: 'static/script.min.js' },
  { src: '../static/theme.min.css', dest: 'static/theme.min.css' },
  { src: '../extension.php', dest: 'extension.php' },
  { src: '../configure.phtml', dest: 'configure.phtml' },
  { src: '../metadata.json', dest: 'metadata.json' }
];

const freshrssDevFolder = process.env.FRESHRSS_DEV_FOLDER;
const folderSync = process.env.FRESHRSS_DEV_FOLDER_FILE_SYNC === 'true';

function syncFiles() {
  if (!folderSync) {
    console.log('\x1b[34m%s\x1b[0m', 'Skipping file sync, enable it in .env');
    return;
  }
  // Ensure .tmp exists before copying any files from it
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  extensionFiles.forEach(({ src, dest }) => {
    const srcPath = path.resolve(__dirname, src);
    const destPath = path.join(freshrssDevFolder, dest);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log('\x1b[32m%s\x1b[0m', `Synced: ${path.basename(srcPath)}`);
    } else {
      console.log('\x1b[33m%s\x1b[0m', `Skipped: ${path.basename(srcPath)} (not found)`);
    }
  });
}

if (require.main === module) {
  (async () => {
    // Only sync if minification succeeded
    if (await minifyAndInjectVersion()) {
      syncFiles();
    }
    if (folderSync) {
      // Watch `src/script.js` for changes
      const watcher = chokidar.watch(srcScriptPath, { ignoreInitial: true });
      watcher.on('change', async () => {
        if (await minifyAndInjectVersion()) {
          syncFiles();
          console.log('\x1b[32m%s\x1b[0m', 'Script synced to dev folder.');
        } else {
          console.log('\x1b[31m%s\x1b[0m', 'Minification failed, skipping sync.');
        }
      });
      // Watch `static/theme.min.css` for changes and sync
      const cssWatcher = chokidar.watch(path.resolve(__dirname, '../static/theme.min.css'), { ignoreInitial: true });
      cssWatcher.on('change', () => {
        syncFiles();
        console.log('\x1b[32m%s\x1b[0m', 'CSS synced to dev folder.');
      });
      process.on('exit', () => {
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
    }
  })();
}

module.exports = syncFiles;
