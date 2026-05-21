const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

const keywords = ['getCanvasPos', 'getMouseServerPos', 'mousedown', 'mousemove', 'wheel', 'touchstart', 'touchmove'];

keywords.forEach(keyword => {
  console.log(`=== Matches for "${keyword}": ===`);
  lines.forEach((line, idx) => {
    if (line.includes(keyword)) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
});
