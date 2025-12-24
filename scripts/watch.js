// Sync Youlag extension files to local FreshRSS development folder based on .env configuration.
// The automatic syncing of files allows for easier development and testing.
// `npm run watch`

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const extensionFiles = [
  { src: '../static/theme.min.css', dest: 'static/theme.min.css' },
  { src: '../static/script.min.js', dest: 'static/script.min.js' },
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
  extensionFiles.forEach(({ src, dest }) => {
    const srcPath = path.resolve(__dirname, src);
    const destPath = path.join(freshrssDevFolder, dest);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log('\x1b[32m%s\x1b[0m', `Synced: ${path.basename(srcPath)}`);
  });
}

if (require.main === module) {
  syncFiles();
  if (folderSync) {
    const watcher = chokidar.watch(extensionFiles.map(f => path.resolve(__dirname, f.src)), {
      ignoreInitial: true
    });
    watcher.on('change', (changedPath) => {
      const file = extensionFiles.find(f => path.resolve(__dirname, f.src) === changedPath);
      if (file) {
        const srcPath = path.resolve(__dirname, file.src);
        const destPath = path.join(freshrssDevFolder, file.dest);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        console.log('\x1b[32m%s\x1b[0m', `Synced: ${path.basename(srcPath)}`);
      }
    });
  }
}

module.exports = syncFiles;
