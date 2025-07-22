const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = require('../package.json');

let count = '0';
try {
  count = execSync('git rev-list --count HEAD').toString().trim();
} catch (err) {
  console.error('Failed to get commit count:', err);
}

const content = `window.APP_VERSION = { version: "${pkg.version}", build: "${count}" };\n`;
const outPath = path.join(__dirname, '..', 'version.js');
fs.writeFileSync(outPath, content);
console.log(`version.js generado con v${pkg.version} build ${count}`);
