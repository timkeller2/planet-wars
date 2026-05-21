const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('const keysDown = {};')) {
    console.log(`keysDown found at line ${idx + 1}`);
  }
});
