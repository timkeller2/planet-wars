const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');

const functionDef = `  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }
`;

content = content.replace(
  /function getMouseServerPos\(x, y\) \{/,
  functionDef + '\n  function getMouseServerPos(x, y) {'
);

// We need to replace all clientX references inside mouse and touch listeners to correctly use getCanvasPos.
// But we must NOT replace 'const rect = canvas.getBoundingClientRect()' because getCanvasPos does it itself.
// Since the script might be complex, I'll use multi_replace_file_content on specific blocks.
