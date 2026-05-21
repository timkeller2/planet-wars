const fs = require('fs');

const data = JSON.parse(fs.readFileSync('replace_step_90_0.json', 'utf8'));
const chunks = JSON.parse(data.args.ReplacementChunks);

console.log(`Step 90 has ${chunks.length} replacement chunks.`);
chunks.forEach((chunk, i) => {
  console.log(`--- Chunk ${i} ---`);
  console.log(`StartLine: ${chunk.StartLine}, EndLine: ${chunk.EndLine}`);
  console.log(`TargetContent length: ${chunk.TargetContent.length} chars`);
  console.log(`TargetContent lines: ${chunk.TargetContent.split('\n').length}`);
  console.log(`ReplacementContent length: ${chunk.ReplacementContent.length} chars`);
  console.log(`ReplacementContent lines: ${chunk.ReplacementContent.split('\n').length}`);
  
  // print first and last line of target and replacement
  const tLines = chunk.TargetContent.split('\n');
  const rLines = chunk.ReplacementContent.split('\n');
  console.log(`Target First Line:  ${tLines[0]}`);
  console.log(`Target Last Line:   ${tLines[tLines.length - 1]}`);
  console.log(`Replace First Line: ${rLines[0]}`);
  console.log(`Replace Last Line:  ${rLines[rLines.length - 1]}`);
});
