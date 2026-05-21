const fs = require('fs');
const content = fs.readFileSync('step_42_main_js.txt', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('canvas.addEventListener')) {
    console.log(`Original Step 42 Line ${idx + 1}: ${line}`);
    console.log(lines.slice(idx, idx + 20).join('\n'));
  }
});
