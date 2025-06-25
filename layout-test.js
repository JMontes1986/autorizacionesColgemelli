const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const hasLink = /<link\s+rel="stylesheet"\s+href="styles\.css"\s*>/i.test(html);
const headerMatch = /<div class="header">[\s\S]*?<h1>(.*?)<\/h1>/i.exec(html);

if (!hasLink) {
  console.error('Stylesheet link tag not found');
  process.exit(1);
}
if (!headerMatch) {
  console.error('Header h1 not found inside .header div');
  process.exit(1);
}
console.log('Layout test passed: header and stylesheet found');
