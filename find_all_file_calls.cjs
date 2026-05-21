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
    // Look for any tool call
    let calls = [];
    if (obj.tool_calls) calls = obj.tool_calls;
    
    calls.forEach((tc, idx) => {
      if (tc.name && (tc.name.includes('file') || tc.name.includes('write') || tc.name.includes('replace'))) {
        console.log(`Step ${obj.step_index}: Tool ${tc.name} on target: ${JSON.stringify(tc.args.TargetFile || tc.args.AbsolutePath || tc.args.Target || '')}`);
      }
    });
  } catch (e) {}
});
