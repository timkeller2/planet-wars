import fs from 'fs';

const code = fs.readFileSync('src/game.js', 'utf8');
const lines = code.split('\n');

let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // check if this is a method signature (starts with some spaces followed by alphanumeric name and parenthesis)
  const isMethod = /^\s{2}[a-zA-Z0-9_]+\([^)]*\)\s*\{/.test(line);
  if (isMethod) {
    console.log(`Line ${i + 1}: Found method declaration "${line.trim()}" (current depth: ${depth})`);
  }
  
  // Basic token scanning for braces, ignoring strings/comments
  let cleaned = line.replace(/\/\/.*$/g, ''); // remove single line comments
  
  // Remove string literals to avoid confusing braces inside quotes
  cleaned = cleaned.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');

  for (let char of cleaned) {
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
    }
  }
}

console.log(`Final brace depth: ${depth}`);
