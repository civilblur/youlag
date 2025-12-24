// Package Youlag for distribution. Outputs files in the `dist` folder.
// `npm run package`
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const metadata = require('../metadata.json');
const version = metadata.version;
const distDir = path.resolve(__dirname, '../dist');
const extensionFiles = [
  { src: '../static/script.min.js', dest: 'static/script.min.js' },
  { src: '../static/theme.min.css', dest: 'static/theme.min.css' },
  { src: '../extension.php', dest: 'extension.php' },
  { src: '../configure.phtml', dest: 'configure.phtml' },
  { src: '../metadata.json', dest: 'metadata.json' }
];

fs.mkdirSync(path.join(distDir, 'static'), { recursive: true });

extensionFiles.forEach(({ src, dest }) => {
  const srcPath = path.resolve(__dirname, src);
  const destPath = path.join(distDir, dest);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
});

const zipName = `youlag-${version}.zip`;
const zipPath = path.join(distDir, zipName);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
  console.log('\x1b[32m%s\x1b[0m', `v${version} build ready at: ${zipPath} (${sizeMB} MB)`);
});

archive.on('error', err => { throw err; });
archive.pipe(output);

extensionFiles.forEach(({ dest }) => {
  archive.file(path.join(distDir, dest), { name: path.join('xExtension-Youlag', dest) });
});

archive.finalize();
