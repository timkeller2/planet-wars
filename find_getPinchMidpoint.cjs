const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('getPinchMidpoint')) {
    console.log(`getPinchMidpoint found at line ${idx + 1}`);
    console.log(lines.slice(idx - 2, idx + 10).join('\n'));
  }
});
