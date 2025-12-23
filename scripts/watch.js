// Sync Youlag extension files to local FreshRSS development folder based on .env configuration.
// The automatic syncing of files allows for easier development and testing.
// `npm run watch`
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const extensionFiles = [
  { src: '../static/theme.css', dest: 'static/theme.css' },
  { src: '../static/script.js', dest: 'static/script.js' },
  { src: '../extension.php', dest: 'extension.php' }
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
    // Ensure destination directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log('\x1b[32m%s\x1b[0m', `Synced: ${srcPath} -> ${destPath}`);
  });
}

if (require.main === module) {
  syncFiles();
}

module.exports = syncFiles;
