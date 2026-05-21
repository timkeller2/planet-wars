const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\tim\\.gemini\\antigravity\\brain\\2d3a686c-bf5b-47db-93f7-ebc4fe1e0e9e\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.endsWith('main.js')) {
          console.log(`Step ${obj.step_index}: StartLine=${tc.args.StartLine}, EndLine=${tc.args.EndLine}`);
        }
      }
    }
  } catch (e) {}
});
