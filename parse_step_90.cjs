const fs = require('fs');
let content = fs.readFileSync('replace_step_90_0.json', 'utf8');

// The string has bad control characters (literal newlines inside quotes).
// Let's replace literal newlines with \n or just use eval after wrapping in parentheses.
// Wait, we can parse it as a JavaScript object by evaluating it!
let obj;
try {
  obj = eval('(' + content + ')');
  console.log('Successfully evaluated step 90!');
} catch (e) {
  console.log('Eval failed:', e.message);
}

if (obj) {
  const chunksStr = obj.args.ReplacementChunks;
  console.log('Type of ReplacementChunks in obj:', typeof chunksStr);
  
  let chunks;
  try {
    chunks = JSON.parse(chunksStr);
  } catch (e) {
    console.log('JSON.parse of ReplacementChunks failed:', e.message);
    try {
      chunks = eval('(' + chunksStr + ')');
      console.log('Successfully evaluated ReplacementChunks!');
    } catch (ee) {
      console.log('Eval of ReplacementChunks failed:', ee.message);
    }
  }
  
  if (chunks) {
    console.log(`Found ${chunks.length} chunks.`);
    chunks.forEach((chunk, idx) => {
      console.log(`=== Chunk ${idx} ===`);
      console.log(`Start: ${chunk.StartLine}, End: ${chunk.EndLine}`);
      fs.writeFileSync(`chunk_${idx}_target.txt`, chunk.TargetContent || '');
      fs.writeFileSync(`chunk_${idx}_replacement.txt`, chunk.ReplacementContent || '');
      console.log(`Wrote chunk_${idx}_target.txt and chunk_${idx}_replacement.txt`);
    });
  }
}
