const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

console.log(`Current main.js lines: ${lines.length}`);

// Let's print out lines around mousedown listener
const mousedownIdx = lines.findIndex(l => l.includes("canvas.addEventListener('mousedown'"));
console.log(`Mousedown listener found at line index: ${mousedownIdx}`);
if (mousedownIdx !== -1) {
  console.log('--- mousedown listener lines ---');
  console.log(lines.slice(mousedownIdx, mousedownIdx + 50).join('\n'));
}

// Let's print out lines from 1000 to 1100 to see what is there
console.log('--- lines 1020 to 1060 ---');
console.log(lines.slice(1020, 1060).join('\n'));
