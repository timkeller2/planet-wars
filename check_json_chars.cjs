const fs = require('fs');
const content = fs.readFileSync('replace_step_90_0.json', 'utf8');

console.log('Total length:', content.length);
console.log('Substring around 2048:');
console.log(content.slice(2000, 2200));
