const fs = require('fs');
const path = require('path');

function searchFile(filename, query) {
  const filepath = path.join(__dirname, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    return;
  }
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  let found = false;
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      console.log(`${filename}:${index + 1}: ${line.trim()}`);
      found = true;
    }
  });
  if (!found) {
    console.log(`Query "${query}" not found in ${filename}`);
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node search.cjs <filename> <query>');
} else {
  searchFile(args[0], args[1]);
}
