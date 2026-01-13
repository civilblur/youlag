// Package Youlag for distribution. Outputs files in the `dist` folder.
// `npm run build`

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const metadata = require('../metadata.json');
const version = metadata.version;
const distDir = path.resolve(__dirname, '../dist');
const tempDir = path.resolve(__dirname, '../.tmp');
fs.mkdirSync(tempDir, { recursive: true });

const srcScriptPath = path.resolve(__dirname, '../src/script.js');
const scriptTempDest = path.join(tempDir, 'script.min.js');
const minifyAndInjectVersion = async () => {
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
    fs.writeFileSync(scriptTempDest, code);
    return true;
  } catch (err) {
    console.error('Terser error:', err);
    return false;
  }
};

(async () => {
  await minifyAndInjectVersion();

  const extensionFiles = [
    { src: path.relative(__dirname, scriptTempDest), dest: 'static/script.min.js' },
    { src: '../static/theme.min.css', dest: 'static/theme.min.css' },
    { src: '../extension.php', dest: 'extension.php' },
    { src: '../configure.phtml', dest: 'configure.phtml' },
    { src: '../metadata.json', dest: 'metadata.json' }
  ];

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
})();