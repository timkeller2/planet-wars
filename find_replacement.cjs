const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\tim\\.gemini\\antigravity\\brain\\2d3a686c-bf5b-47db-93f7-ebc4fe1e0e9e\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('multi_replace_file_content')) {
    try {
      const obj = JSON.parse(line);
      console.log(`Step ${obj.step_index} has multi_replace_file_content.`);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'multi_replace_file_content') {
            fs.writeFileSync(`multi_replace_step_${obj.step_index}.json`, JSON.stringify(tc, null, 2));
            console.log(`Wrote multi_replace_step_${obj.step_index}.json`);
          }
        }
      }
    } catch (e) {
      console.log('Error parsing line:', e.message);
    }
  }
});
