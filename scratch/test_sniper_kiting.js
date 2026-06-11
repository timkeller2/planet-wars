import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running sniper kiting behavior unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';
const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1, p2];

// Mock sniper cruiser (owner = p1)
const sniper = new Ship(1, 100, 100, null, p1);
sniper.isCruiser = true;
sniper.maxHealth = 100;
sniper.health = 100;
sniper.package = 'sniper';

// Mock enemy cruiser (owner = p2)
const enemy = new Ship(2, 135, 100, null, p2);
enemy.isCruiser = true;
enemy.maxHealth = 100;
enemy.health = 100; // 100% health

game.ships = [sniper, enemy];

// Target lock on enemy ship
sniper.cruiserTargetType = 'ship';
sniper.cruiserTargetId = enemy.id;

// Helper to update ship with dt = 0 to prevent actual movement during test checks
const updateSniper = (dt = 0.0) => {
  sniper.update(dt * 1000, game.ships, [], [], [], [], 2000, game);
};

// --- Test 1: Trigger Sniper Kiting ---
// Sniper is at (100, 100), Enemy is at (135, 100). Distance = 35px.
// Front arc range of sniper: maxFrontRange = effectiveRange * 1.3
// For maxHealth = 100, effectiveRange = 40 * (1 + 0) * (1 + 10 * 0.10) * 1.50 (sniper)
// Wait! Let's check effectiveRange calculation in Ship.js:
// effectiveRange = 40 * (1 + laserTechBonus) * (1 + healthBonus * 0.10) * 1.5 (sniper)
// Here, health = 100, so healthBonus = Math.floor(100) = 100?!
// Wait! Line 786 in Ship.js:
// const healthBonus = Math.floor(this.health);
// Wait, if health = 100, healthBonus = 100, so (1 + 100 * 0.1) = 11!
// So effectiveRange = 40 * 11 * 1.5 = 660px!
// maxFrontRange = 660 * 1.3 = 858px!
// 50% range is 429px.
// Distance (80px) is well within 429px (50% range).
// Enemy health is 100% (> 75%).
// This should trigger kiting!
updateSniper(0.0);
assert(sniper.isSniperKiting === true, "Sniper should trigger kiting state");

// Kiting destination should be in opposite direction from enemy (which is to the right at 180, 100)
// Opposite direction from (180, 100) relative to (100, 100) is left (-x direction)
// Distance is 100px away, so targetX should be around 100 - 100 = 0
console.log(`Kite target: (${sniper.targetX}, ${sniper.targetY})`);
assert(Math.abs(sniper.targetX - 0) < 1e-5 && Math.abs(sniper.targetY - 100) < 1e-5, "Kite destination should be 100px away in opposite direction");


// --- Test 2: Destination Lock during Movement ---
// Sniper moves towards (50, 100) (closer to the kite target).
// We update its position manually to (50, 100).
sniper.x = 50;
sniper.y = 100;
updateSniper(0.0);
// It should still have the kiting state active and target should remain (0, 100) (not recalculated relative to (50, 100)!)
assert(sniper.isSniperKiting === true, "Sniper should maintain kiting state");
assert(Math.abs(sniper.targetX - 0) < 1e-5 && Math.abs(sniper.targetY - 100) < 1e-5, "Kite destination should remain locked to (0, 100)");


// --- Test 3: Arrival and Retargeting ---
// Sniper moves exactly to the kiting target (0, 100).
sniper.x = 0;
sniper.y = 100;
updateSniper(0.0);
// It should arrive and clear the kiting state
assert(sniper.isSniperKiting === false, "Sniper should clear kiting state upon arrival");
// And it should retarget the enemy (which is at 180, 100)
assert(Math.abs(sniper.targetX - enemy.x) < 1e-5 && Math.abs(sniper.targetY - enemy.y) < 1e-5, "Sniper should retarget the enemy");


// --- Test 4: High Health Enemy Filter ---
// Let's reset the sniper and decrease enemy health to 74%
const sniper2 = new Ship(3, 100, 100, null, p1);
sniper2.isCruiser = true;
sniper2.maxHealth = 100;
sniper2.health = 100;
sniper2.package = 'sniper';
sniper2.cruiserTargetType = 'ship';
sniper2.cruiserTargetId = enemy.id;

enemy.health = 74; // less than 75%

sniper2.update(0.0, game.ships, [], [], [], [], 2000, game);
// It should NOT trigger the 50% range kiting because enemy health is too low
assert(sniper2.isSniperKiting === false, "Sniper should not trigger kiting if enemy health is <= 75%");

console.log("All sniper kiting unit tests completed successfully!");
