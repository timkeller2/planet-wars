const fs = require('fs');
const content = fs.readFileSync('src/game.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('new Ship') || line.includes('this.angle =')) {
    console.log(`${index + 1}: ${line}`);
  }
});
