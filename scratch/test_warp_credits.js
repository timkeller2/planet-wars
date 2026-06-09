import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running warp credit casualty tests...");

const game = new Game({ width: 2000, height: 2000 });
const player = new Player('player1', '#0ff', false);
player.id = 'player1';
player.techScore = 0; // 0 tech score means 50% explosion risk

// --- TEST 1: Fleet with sufficient credits ---
player.credits = 100;
const fleet1 = new Ship(1, 100, 100, null, player);
fleet1.count = 20;

// Explode chance is 50%, so explodedCount should be round(20 * 0.5) = 10 ships.
// Since we have 100 credits, we should pay 10 credits, credits become 90, and fleet1.count stays 20.
const exploded1 = game.applyWarpToShip(fleet1, player);
console.log(`Test 1: Remaining fleet count = ${fleet1.count} (Expected: 20), Player credits = ${player.credits} (Expected: 90)`);
assert(fleet1.count === 20, "Fleet count should be fully preserved when sufficient credits exist");
assert(player.credits === 90, "10 credits should have been deducted");
assert(exploded1 === false, "Fleet should not be fully exploded");

// --- TEST 2: Fleet with insufficient credits ---
player.credits = 4;
const fleet2 = new Ship(2, 200, 200, null, player);
fleet2.count = 20;

// Explode chance is 50%, so explodedCount should be round(20 * 0.5) = 10 ships.
// Since we have 4 credits, we pay 4 credits, credits become 0.
// Remaining 6 casualties are lost, so fleet2.count becomes 20 - 6 = 14.
const exploded2 = game.applyWarpToShip(fleet2, player);
console.log(`Test 2: Remaining fleet count = ${fleet2.count} (Expected: 14), Player credits = ${player.credits} (Expected: 0)`);
assert(fleet2.count === 14, "Fleet count should be partially reduced when credits are insufficient");
assert(player.credits === 0, "Credits should be completely depleted");
assert(exploded2 === false, "Fleet should not be fully exploded");

// --- TEST 3: Single cruiser with credits (credits should NOT protect it) ---
player.credits = 10;
const cruiser1 = new Ship(3, 300, 300, null, player);
cruiser1.isCruiser = true;
cruiser1.maxHealth = 30;
cruiser1.health = 30;
cruiser1.fuel = 10;
cruiser1.count = 1;

// Force math random mock to ensure explosion chance triggers.
const originalRandom = Math.random;
Math.random = () => 0.1; // less than 0.5 (explodeChance)

const exploded3 = game.applyWarpToShip(cruiser1, player);
console.log(`Test 3: Cruiser fuel = ${cruiser1.fuel} (Expected: 8), Player credits = ${player.credits} (Expected: 10)`);
assert(cruiser1.fuel === 8, "Cruiser fuel should decrease by 2 (1 warp cost + 1 failure penalty) since it is not protected by credits");
assert(player.credits === 10, "Credits should NOT have been deducted");
assert(exploded3 === false, "Cruiser should not be destroyed");

// --- TEST 4: Single cruiser starting with 1 fuel (takes 1d6 damage when safety fails and fuel is depleted) ---
const cruiser2 = new Ship(4, 400, 400, null, player);
cruiser2.isCruiser = true;
cruiser2.maxHealth = 30;
cruiser2.health = 30;
cruiser2.fuel = 1; // Enough to initiate warp, but empty after initiation cost
cruiser2.count = 1;

// Force Math.random mock to fail safety check
const originalRandom2 = Math.random;
Math.random = () => 0.1;

const exploded4 = game.applyWarpToShip(cruiser2, player);
const damageTaken = 30 - cruiser2.health;
console.log(`Test 4: Cruiser health = ${cruiser2.health} (Damage taken: ${damageTaken}, Expected 1d6: 1-6), Player credits = ${player.credits} (Expected: 10)`);
assert(damageTaken >= 1 && damageTaken <= 6, "Cruiser should have taken 1d6 damage");
assert(player.credits === 10, "Credits should NOT have been deducted");
assert(exploded4 === false, "Cruiser should not be destroyed");

// Restore Math.random
Math.random = originalRandom;

console.log("All warp credit casualty tests passed!");
