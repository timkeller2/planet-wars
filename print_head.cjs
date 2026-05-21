const fs = require('fs');
const content = fs.readFileSync('src/main.js', 'utf8');
const lines = content.split('\n');

console.log('--- Lines 1 to 70 ---');
console.log(lines.slice(0, 70).join('\n'));
