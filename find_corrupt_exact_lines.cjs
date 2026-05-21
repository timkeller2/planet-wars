const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

const mousedownIdx = lines.findIndex(l => l.includes("canvas.addEventListener('mousedown'"));
const warpIdx = lines.findIndex(l => l.includes("document.getElementById('btn-warp').addEventListener('click'"));

console.log(`Mousedown line index (1-based): ${mousedownIdx + 1}`);
console.log(`Warp line index (1-based): ${warpIdx + 1}`);

// Let's print out lines from mousedownIdx to warpIdx to make sure
console.log('=== Lines in between ===');
console.log(lines.slice(mousedownIdx, warpIdx).join('\n'));
