import fs from 'fs';

const code = fs.readFileSync('src/game.js', 'utf8');
const lines = code.split('\n');

let depth = 0;
for (let i = 2720; i < 4236; i++) {
  const line = lines[i];
  const oldDepth = depth;
  
  let cleaned = line.replace(/\/\/.*$/g, '');
  cleaned = cleaned.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');

  for (let char of cleaned) {
    if (char === '{') depth++;
    else if (char === '}') depth--;
  }
  
  if (i + 1 >= 3043 && i + 1 <= 3130) {
    console.log(`Line ${i + 1}: Depth: ${depth} (diff: ${depth - oldDepth}) | ${line.trim()}`);
  }
}
