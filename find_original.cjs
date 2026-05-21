const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logPath = 'C:\\Users\\tim\\.gemini\\antigravity\\brain\\2d3a686c-bf5b-47db-93f7-ebc4fe1e0e9e\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const obj = JSON.parse(line);
    // Look for tool_calls containing view_file on src/main.js or view_file response
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.endsWith('main.js')) {
          console.log(`Found view_file tool call in step ${obj.step_index}`);
        }
      }
    }
    if (obj.type === 'VIEW_FILE' && obj.content && obj.content.includes('File Path:') && obj.content.includes('main.js')) {
      console.log(`Found VIEW_FILE content in step ${obj.step_index}`);
      // Let's write the content to a file to examine
      fs.writeFileSync(`step_${obj.step_index}_main_js.txt`, obj.content);
    }
    // Also look for replace_file_content or multi_replace_file_content inputs
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && tc.args && tc.args.TargetFile && tc.args.TargetFile.endsWith('main.js')) {
          console.log(`Found ${tc.name} in step ${obj.step_index}`);
          fs.writeFileSync(`step_${obj.step_index}_tool_call.json`, JSON.stringify(tc, null, 2));
        }
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
});

rl.on('close', () => {
  console.log('Finished scanning log.');
});
