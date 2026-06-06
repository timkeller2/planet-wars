import { Game } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/game.js';
import { Ship } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Ship.js';
import { Player } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running new sensor range, patrol health retreat, and auto-buy restart reset tests...");

// --- 1. Test Sensor Range Calculations ---
const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';
p1.techScore = 100; // sqrt(100) = 10, so +10% tech bonus (factor of 1.10)

const cruiser = new Ship(1, 100, 100, null, p1);
cruiser.isCruiser = true;
cruiser.maxHealth = 50;

// Base Range: 50 + 2 * maxHealth = 150.
// level 0: 150 * 1.0 (no upgrades) * 1.10 (tech bonus) = 165
let range0 = cruiser.cruiserRadarRange();
console.log(`Level 0 Range: ${range0} (Expected: 165)`);
assert(Math.abs(range0 - 165) < 1e-5, `Level 0 range mismatch, got ${range0}`);

// level 1: (150 + 10 * 1) * (1 + 0.25 * 1) = 160 * 1.25 = 200. With tech bonus: 200 * 1.1 = 220
cruiser.sensorarrays = 1;
let range1 = cruiser.cruiserRadarRange();
console.log(`Level 1 Range: ${range1} (Expected: 220)`);
assert(Math.abs(range1 - 220) < 1e-5, `Level 1 range mismatch, got ${range1}`);

// level 2: (150 + 10 * 2) * (1 + 0.25 * 2) = 170 * 1.50 = 255. With tech bonus: 255 * 1.1 = 280.5
cruiser.sensorarrays = 2;
let range2 = cruiser.cruiserRadarRange();
console.log(`Level 2 Range: ${range2} (Expected: 280.5)`);
assert(Math.abs(range2 - 280.5) < 1e-5, `Level 2 range mismatch, got ${range2}`);

console.log("Cruiser sensor range calculations test passed!");


// --- 2. Test Patrol Health Retreat Behavior ---
const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1];

const patrolShip = new Ship(2, 450, 450, null, p1);
patrolShip.isCruiser = true;
patrolShip.maxHealth = 100;
patrolShip.health = 100;
patrolShip.bombs = 10;
patrolShip.fuel = 100;
patrolShip.isPatrolling = true;

// Mock friendly planet for refueling/rearming/healing
const planet = {
  id: 'planet1',
  x: 400,
  y: 400,
  owner: p1,
  getGravityRadius: () => 100
};
game.planets = [planet];

// Initialize with healthy cruiser. It should not retreat.
patrolShip.update(0.1, [patrolShip], [], game.planets, [], [], 2000, game);
assert(patrolShip.patrolReloading === false, "Cruiser at 100% health should not trigger reload/repair state");

// Damage cruiser to 50% health. It should still not retreat.
patrolShip.health = 50;
patrolShip.update(0.1, [patrolShip], [], game.planets, [], [], 2000, game);
assert(patrolShip.patrolReloading === false, "Cruiser at 50% health should not trigger reload/repair state");

// Damage cruiser to 49% health. It should trigger repair retreat!
patrolShip.health = 49;
patrolShip.update(0.1, [patrolShip], [], game.planets, [], [], 2000, game);
assert(patrolShip.patrolReloading === true, "Cruiser at 49% health should trigger repair retreat");

// Heal to 90% health, but still has not reached 100%. It should remain in retreat/reloading state.
patrolShip.health = 90;
patrolShip.update(0.1, [patrolShip], [], game.planets, [], [], 2000, game);
assert(patrolShip.patrolReloading === true, "Cruiser at 90% health (partial heal) should remain in reloading state");

// Heal to 100% health and ensure bombs are full. It should exit the reload/repair state.
patrolShip.health = 100;
patrolShip.bombs = patrolShip.getMaxBombs();
patrolShip.update(0.1, [patrolShip], [], game.planets, [], [], 2000, game);
assert(patrolShip.patrolReloading === false, "Cruiser at 100% health and full bombs should exit reloading state");

console.log("Patrol health retreat behavior test passed!");


// --- 3. Test Game Restart Auto-Buy Reset ---
p1.autoBuyOrders = [{ id: 'order1', resource: 'dilithium', price: 5 }];
assert(p1.autoBuyOrders.length === 1, "Should have 1 active auto-buy order before restart");

// Call initMap, which should clear autoBuyOrders on allPlayers
game.initMap();
assert(p1.autoBuyOrders.length === 0, "Restarting game must clear autoBuyOrders on players");

console.log("Game restart auto-buy reset test passed!");
console.log("All unit tests completed successfully!");
