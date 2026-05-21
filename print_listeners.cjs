const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('.addEventListener(')) {
    console.log(`--- Line ${idx + 1}: ${line.trim()} ---`);
    console.log(lines.slice(idx, idx + 10).join('\n'));
  }
});
