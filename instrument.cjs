const fs = require('fs');
let c = fs.readFileSync('src/game.js', 'utf8');
c = c.replace('update(deltaTime) {', `update(deltaTime) {
  const _t0 = performance.now();
  let _tLast = _t0;
  const perfLog = (label) => {
    const _t = performance.now();
    if (_t - _t0 > 50) {
      console.log(\`[PERF game.update] \${label}: \${(_t - _tLast).toFixed(2)}ms\`);
    }
    _tLast = _t;
  };
`);
c = c.replace(/for \(const ai of this\.aiControllers\) \{/g, 'perfLog("Before AI");\n    for (const ai of this.aiControllers) {');
c = c.replace(/for \(const p of this\.planets\) \{/g, 'perfLog("Before planet loop");\n    for (const p of this.planets) {');
c = c.replace(/for \(const ship of this\.ships\) \{/g, 'perfLog("Before ship loop");\n    for (const ship of this.ships) {');
fs.writeFileSync('src/game.js', c);
