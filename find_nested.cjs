const fs = require('fs');
const lines = fs.readFileSync('src/game.js', 'utf8').split('\n');
let inUpdate = false;
let currentLoops = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('update(deltaTime) {')) inUpdate = true;
  if (!inUpdate) continue;
  
  const line = lines[i];
  if (line.match(/for\s*\(/)) {
    currentLoops.push({line: i, txt: line, indent: line.search(/\S/)});
  }
  
  // Try to pop out of loops based on indentation
  const indent = line.search(/\S/);
  if (indent > -1 && line.trim().startsWith('}') && currentLoops.length > 0) {
    if (indent <= currentLoops[currentLoops.length - 1].indent) {
      currentLoops.pop();
    }
  }

  if (currentLoops.length >= 2) {
    const outer = currentLoops[currentLoops.length - 2].txt;
    const inner = currentLoops[currentLoops.length - 1].txt;
    if ((outer.includes('this.planets') || outer.includes('this.ships') || outer.includes('this.allPlayers')) && 
        (inner.includes('this.planets') || inner.includes('this.ships') || inner.includes('this.allPlayers'))) {
      if (!inner.includes('let pass = 0')) {
        console.log('Nested at ' + (i+1) + ': ' + outer.trim() + ' -> ' + inner.trim());
      }
    }
  }
}
