const fs = require('fs');
const glob = require('fs').readdirSync('.');

glob.forEach(file => {
  if (file.startsWith('step_') && file.endsWith('_main_js.txt')) {
    const content = fs.readFileSync(file, 'utf8');
    const firstLines = content.split('\n').slice(0, 10).join('\n');
    console.log(`=== File: ${file} ===`);
    console.log(firstLines);
    console.log('=====================\n');
  }
});
