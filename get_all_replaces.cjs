const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\tim\\.gemini\\antigravity\\brain\\2d3a686c-bf5b-47db-93f7-ebc4fe1e0e9e\\.system_generated\\logs\\transcript.jsonl';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('multi_replace_file_content') || line.includes('replace_file_content')) {
    try {
      const obj = JSON.parse(line);
      let tcArray = [];
      if (obj.tool_calls) {
        tcArray = obj.tool_calls;
      } else if (obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
        tcArray = obj.tool_calls;
      }
      
      tcArray.forEach((tc, idx) => {
        if (tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
          const outName = `replace_step_${obj.step_index}_${idx}.json`;
          fs.writeFileSync(outName, JSON.stringify(tc, null, 2));
          console.log(`Saved ${outName}`);
        }
      });
    } catch (e) {
      // In case parsing line fails, let's look for JSON substrings
      console.log(`Failed to parse step line: ${line.slice(0, 100)}... Error: ${e.message}`);
    }
  }
});
