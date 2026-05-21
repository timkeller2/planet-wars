const fs = require('fs');
const glob = fs.readdirSync('.');

glob.forEach(file => {
  if (file.startsWith('step_') && file.endsWith('_main_js.txt')) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    console.log(`${file}: ${lines.length} lines`);
  }
});
