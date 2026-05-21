const fs = require('fs');
let c = fs.readFileSync('src/main.js', 'utf8');

const mousedownTarget = `  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const posX = event.clientX - rect.left;
    const posY = event.clientY - rect.top;`;

const mousedownReplacement = `  canvas.addEventListener('mousedown', (event) => {
    const cPos = getCanvasPos(event);
    const posX = cPos.x;
    const posY = cPos.y;`;

const mousemoveTarget = `    // Always update hover state and lasso
    const rect = canvas.getBoundingClientRect();
    handlePointerMove(event.clientX - rect.left, event.clientY - rect.top);`;

const mousemoveReplacement = `    // Always update hover state and lasso
    const cPos = getCanvasPos(event);
    handlePointerMove(cPos.x, cPos.y);`;

c = c.replace(mousedownTarget, mousedownReplacement);
c = c.replace(mousemoveTarget, mousemoveReplacement);
fs.writeFileSync('src/main.js', c);
console.log('done');
