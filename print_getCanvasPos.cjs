const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

console.log('--- Lines 770 to 800 ---');
console.log(lines.slice(770, 800).join('\n'));
