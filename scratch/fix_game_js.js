import fs from 'fs';

let content = fs.readFileSync('src/game.js', 'utf8');

// Target section to find and replace
const targetText = `// AI planets gaining knowledge from overlapping hazards (1 knowledge every 3 minutes)
    for (const storm of this.ionStorms) {
      for (const planet of this.planets) {
        if (planet.owner && planet.owner.isAI) {
          const dx = planet.x - storm.x;
          const dy = planet.y - storm.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const gravityRadius = planet.getGravityRadius();
          if (dist <= gravityRadius + storm.radius) {
            const aiId = planet.owner.id;
            if (!storm.knowledge[aiId]) storm.knowledge[aiId] = 0;
            storm.knowledge[aiId] += deltaTime / 180000;
          }
        }
      }`;

// Let's replace everything from the AI planets comment down to ionStormDamageTimer
// We will search for a regex pattern that ignores Carriage Returns (\r) specifically.
const pattern = /\/\/ AI planets gaining knowledge from overlapping hazards[\s\S]*?this\.ionStormDamageTimer \+= deltaTime;/;

const replacement = `// AI planets gaining knowledge from overlapping hazards (1 knowledge every 3 minutes)
    for (const storm of this.ionStorms) {
      for (const planet of this.planets) {
        if (planet.owner && planet.owner.isAI) {
          const dx = planet.x - storm.x;
          const dy = planet.y - storm.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const gravityRadius = planet.getGravityRadius();
          if (dist <= gravityRadius + storm.radius) {
            const aiId = planet.owner.id;
            if (!storm.knowledge[aiId]) storm.knowledge[aiId] = 0;
            storm.knowledge[aiId] += deltaTime / 180000;
          }
        }
      }
    }

    // Ion Storm / Minefield ship damage (every second) ... skip nebulae
    this.ionStormDamageTimer += deltaTime;`;

if (pattern.test(content)) {
  content = content.replace(pattern, replacement);
  fs.writeFileSync('src/game.js', content, 'utf8');
  console.log("Successfully fixed the AI knowledge loop in game.js!");
} else {
  console.error("Pattern not found in game.js!");
}
