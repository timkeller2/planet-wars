const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');

// The replacementStr has 263 lines.
// Let's just find the first occurrence of replacementStr (or parts of it) and remove/replace it.
const keyIndex = content.indexOf(`  canvas.addEventListener('mousedown', (event) => {\r\n    const cPos = getCanvasPos(event.clientX, event.clientY);`);
const keyIndexLF = content.indexOf(`  canvas.addEventListener('mousedown', (event) => {\n    const cPos = getCanvasPos(event.clientX, event.clientY);`);

const idx = keyIndex !== -1 ? keyIndex : keyIndexLF;

if (idx !== -1) {
  console.log(`Found insertion at char index ${idx}`);
  // Let's print out 500 characters around it
  console.log(content.slice(idx, idx + 500));
} else {
  console.log('Could not find insertion!');
}
