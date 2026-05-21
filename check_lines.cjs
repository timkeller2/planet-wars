const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\tim\\.gemini\\antigravity\\brain\\2d3a686c-bf5b-47db-93f7-ebc4fe1e0e9e\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('view_file') && line.includes('main.js')) {
    // Print first 200 characters of the line
    console.log(line.slice(0, 300));
  }
});
