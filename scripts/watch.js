// Sync Youlag extension files to local FreshRSS development folder based on .env configuration.
// The automatic syncing of files allows for easier development and testing.
// `npm run watch`

const debug = true; // Disable minification

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const util = require('util');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const metadata = require('../metadata.json');
const version = metadata.version;

const tempDir = path.resolve(__dirname, '../.tmp');
fs.mkdirSync(tempDir, { recursive: true });


const srcFiles = [
  '../src/global.js',
  '../src/utilities.js',
  '../src/helpers.js',
  '../src/ui.js',
  '../src/ui-modals.js',
  '../src/ui-modes.js',
   '../src/forms.js',
   '../src/events.js',
];
const minScriptPath = path.resolve(__dirname, '../static/script.min.js');
const scriptTempDest = path.join(tempDir, 'script.min.js');

async function minifyAndInjectVersion() {
  const terser = require('terser');
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../metadata.json'), 'utf8'));
  const version = metadata.version;
  let srcContent = srcFiles.map(f => fs.readFileSync(path.resolve(__dirname, f), 'utf8')).join('\n');
  srcContent = srcContent.replace(/(app\.metadata\s*=\s*\{[^}]*version:\s*)['\"][^'\"]*['\"]/, `$1'${version}'`);
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    let code;
    if (debug) {
      code = srcContent; // Output unminified for debugging
    }
    else {
      const result = await terser.minify(srcContent, {
        compress: true
      });
      if (result.error || !result.code) throw result.error || new Error('No code output');
      code = result.code;
    }
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

async function syncFiles() {
  if (!folderSync) {
    console.log('\x1b[34m%s\x1b[0m', 'Skipping file sync, enable it in .env');
    return;
  }
  // Always minify and inject version before syncing
  await minifyAndInjectVersion();
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
      await syncFiles();
    }
    if (folderSync) {
      const scriptWatcher = chokidar.watch(srcFiles.map(f => path.resolve(__dirname, f)), { ignoreInitial: true });
      const metaWatcher = chokidar.watch(path.resolve(__dirname, '../metadata.json'), { ignoreInitial: true });
      const configureWatcher = chokidar.watch(path.resolve(__dirname, '../configure.phtml'), { ignoreInitial: true });
      const extensionWatcher = chokidar.watch(path.resolve(__dirname, '../extension.php'), { ignoreInitial: true });

      const onScriptOrMetaChange = async () => {
        if (await minifyAndInjectVersion()) {
          await syncFiles();
          console.log('\x1b[32m%s\x1b[0m', 'Script/minified version/metadata synced to dev folder.');
        } else {
          console.log('\x1b[31m%s\x1b[0m', 'Minification failed, skipping sync.');
        }
      };

      const onConfigureOrExtensionChange = async (file) => {
        await syncFiles();
        console.log('\x1b[32m%s\x1b[0m', `${path.basename(file)} synced to dev folder.`);
      };

      scriptWatcher.on('change', onScriptOrMetaChange);
      metaWatcher.on('change', onScriptOrMetaChange);
      configureWatcher.on('change', (file) => onConfigureOrExtensionChange(file));
      extensionWatcher.on('change', (file) => onConfigureOrExtensionChange(file));

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
