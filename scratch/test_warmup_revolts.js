import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

global.requestAnimationFrame = () => {};

console.log("=== Testing Revolt Warmup & Consequences (Neutral Planet) ===");

const game = new Game();
const challenger = new Player('ai1', '#f00', true);
challenger.name = "SubvertingChallenger";

game.allPlayers = [challenger];

// Override checkSinglePlanetSympathyRevolt to print details
const origCheck = game.checkSinglePlanetSympathyRevolt.bind(game);
game.checkSinglePlanetSympathyRevolt = (p) => {
  console.log("-> checkSinglePlanetSympathyRevolt called!");
  console.log("   - p.inRevolt:", p.inRevolt);
  console.log("   - p.sympathy:", p.sympathy);
  console.log("   - isBeingInvaded:", p.isBeingInvaded(game));
  const res = origCheck(p);
  console.log("   - result of check:", p.inRevolt);
  return res;
};

// Create a neutral planet (owner = null) with 90 ships
const planet = new Planet(1, 100, 100, 30, null, 90);
planet.sympathy = {
  'ai1': 50 // Challenger has 50 sympathy
};
game.planets = [planet];

console.log("Initial state:");
console.log(`- Ships: ${planet.ships}`);
console.log(`- Owner: Neutral`);
console.log(`- Challenger Sympathy: ${planet.sympathy['ai1']}`);

// Calling update: planet.update(deltaTime, allPlanets, settings, game)
planet.update(60000, game.planets, game.settings, game);
console.log(`\nAfter 1 minute (60,000ms):`);
console.log(`- revoltWarmup: ${planet.revoltWarmup} (expected 20)`);
console.log(`- revoltWarmupMax: ${planet.revoltWarmupMax} (expected 90)`);

if (planet.revoltWarmup === 20 && planet.revoltWarmupMax === 90) {
  console.log("-> 1 Minute Warmup Rate Check: PASSED");
} else {
  console.log("-> 1 Minute Warmup Rate Check: FAILED");
}

// Let's run update for 3.5 more minutes (210,000ms) to trigger the revolt (revoltWarmup reaches 90)
planet.update(210000, game.planets, game.settings, game);
console.log(`\nAfter 4.5 minutes total:`);
console.log(`- revoltWarmup: ${planet.revoltWarmup}`);
console.log(`- inRevolt: ${planet.inRevolt}`);
console.log(`- revoltTimer: ${planet.revoltTimer}`);

if (planet.inRevolt) {
  console.log("-> Revolt Trigger Check: PASSED");
} else {
  console.log("-> Revolt Trigger Check: FAILED");
}

// Resolve revolt where challenger wins by mocking Math.random
console.log("\nCompetitors in revolt:");
console.log(planet.revoltCompetitors);

const originalRandom = Math.random;
let randCount = 0;
Math.random = () => {
  randCount++;
  if (randCount === 1) return 0.01; // neutral roll will be small
  if (randCount === 2) return 0.99; // ai1 roll will be large
  return originalRandom();
};

game.resolveRevolt(planet);

// Restore Math.random
Math.random = originalRandom;

console.log(`\nAfter successful revolt resolution:`);
console.log(`- New Owner: ${planet.owner ? planet.owner.name : 'None'}`);
console.log(`- Ships (expected between 35 and 45): ${planet.ships}`);
console.log(`- Challenger Sympathy (expected 25): ${planet.sympathy['ai1']}`);
console.log(`- revoltWarmup (expected 0): ${planet.revoltWarmup}`);

if (planet.owner === challenger && planet.ships >= 35 && planet.ships <= 45 && planet.sympathy['ai1'] === 25 && planet.revoltWarmup === 0) {
  console.log("-> Consequences (Ships & Sympathy Halved + Extra Revolt Loss) Check: PASSED");
} else {
  console.log("-> Consequences (Ships & Sympathy Halved + Extra Revolt Loss) Check: FAILED");
}
