const fs = require('fs');
const lines = fs.readFileSync('src/main.js', 'utf8').split('\n');
lines.splice(1989, 195);
fs.writeFileSync('src/main.js', lines.join('\n'));
