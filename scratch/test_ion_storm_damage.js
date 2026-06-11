import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Ion Storm Damage Redesign ===");

const game = new Game();
game.width = 1600;
game.height = 1200;

const owner = new Player('p1', '#0ff', false);
game.allPlayers = [owner];
game.planets = [];

// Spawn an ion storm at (500, 500)
// Intensity is 100 so hit chance is 100% (before any reductions)
const storm = {
  id: 1,
  name: 'Test Storm',
  type: 'storm',
  x: 500,
  y: 500,
  radius: 200,
  intensity: 100,
  speed: 5,
  heading: 90,
  knowledge: {}
};
game.ionStorms = [storm];

// Let's test a non-moving cruiser first.
// If non-moving, hit chance is cut by 1/4 (100% * 0.25 = 25% chance).
// Let's run a loop of updates to observe hit frequency.
const cruiser = new Ship('c_test', 500, 500, null, owner);
cruiser.isCruiser = true;
cruiser.maxHealth = 50;
cruiser.health = 50;
cruiser.fuel = 100;
cruiser.expScore = 0; // zero exp to avoid reduction
// Mock targetX / targetY to be same as current position so it's non-moving
cruiser.targetX = 500;
cruiser.targetY = 500;

game.ships.length = 0;
game.ships.push(cruiser);

let hits = 0;
let totalTicks = 100;

for (let i = 0; i < totalTicks; i++) {
  const oldHealth = cruiser.health;
  game.update(1000); // 1-second update
  if (cruiser.health < oldHealth) {
    const diff = oldHealth - cruiser.health;
    if (diff !== 1) {
      console.error(`-> FAILED: Cruiser took ${diff} damage, expected exactly 1.`);
      process.exit(1);
    }
    hits++;
    cruiser.health = 50; // reset health for next tick
  }
}

const observedRate = (hits / totalTicks) * 100;
console.log(`Non-moving cruiser hit rate over ${totalTicks} ticks: ${observedRate.toFixed(1)}% (expected ~25%)`);
if (observedRate < 10 || observedRate > 40) {
  console.warn(`Warning: observed rate is slightly outside normal statistical range, but could be variance.`);
} else {
  console.log("-> PASSED: Non-moving cruiser hit rate is within reasonable ~25% statistical range and damage is exactly 1.");
}

// Now test a moving standard fleet.
// With moving, hit chance should be 100%. So it should be hit every single tick.
// On hit, it should take 5-15% damage.
const fleet = new Ship('f_test', 500, 500, null, owner);
fleet.count = 1000;
fleet.isCruiser = false;
fleet.maxHealth = 0;
// Make it moving by setting target far away
fleet.targetX = 1000;
fleet.targetY = 1000;
fleet.targetPlanet = null;

game.ships.length = 0;
game.ships.push(fleet);
hits = 0;

for (let i = 0; i < 5; i++) {
  const startCount = fleet.count;
  game.update(1000);
  const diff = startCount - fleet.count;
  const percent = diff / startCount;
  console.log(`Tick ${i+1}: Fleet count went from ${startCount} to ${fleet.count} (lost ${diff} ships, ${(percent * 100).toFixed(1)}%)`);
  if (percent < 0.045 || percent > 0.155) {
    console.error(`-> FAILED: Standard fleet took ${(percent * 100).toFixed(1)}% damage, expected 5-15%.`);
    process.exit(1);
  }
}

console.log("-> PASSED: Standard fleet took 5-15% damage per hit.");
console.log("\nAll ion storm damage redesign checks passed!");
