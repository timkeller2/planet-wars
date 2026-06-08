import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

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

// Base Range: 25 + 2 * maxHealth = 125.
// level 0: 125 * 1.0 (no upgrades) * 1.10 (tech bonus) = 137.5
let range0 = cruiser.cruiserRadarRange();
console.log(`Level 0 Range: ${range0} (Expected: 137.5)`);
assert(Math.abs(range0 - 137.5) < 1e-5, `Level 0 range mismatch, got ${range0}`);

// level 1: (125 + 10 * 1) * (1 + 0.25 * 1) = 135 * 1.25 = 168.75. With tech bonus: 168.75 * 1.1 = 185.625
cruiser.sensorarrays = 1;
let range1 = cruiser.cruiserRadarRange();
console.log(`Level 1 Range: ${range1} (Expected: 185.625)`);
assert(Math.abs(range1 - 185.625) < 1e-5, `Level 1 range mismatch, got ${range1}`);

// level 2: (125 + 10 * 2) * (1 + 0.25 * 2) = 145 * 1.50 = 217.5. With tech bonus: 217.5 * 1.1 = 239.25
cruiser.sensorarrays = 2;
let range2 = cruiser.cruiserRadarRange();
console.log(`Level 2 Range: ${range2} (Expected: 239.25)`);
assert(Math.abs(range2 - 239.25) < 1e-5, `Level 2 range mismatch, got ${range2}`);

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

// Call initMap, which should reset autoBuyOrders to default orders for all 7 resources
game.initMap();
assert(p1.autoBuyOrders.length === 7, "Restarting game must initialize autoBuyOrders with default resource orders");

console.log("Game restart auto-buy reset test passed!");

// --- 4. Test Planet Radius Cap to Size Class ---
import { Planet } from '../src/entities/Planet.js';
const testPlanet = new Planet('tp1', 100, 100, 20, p1, 10);
testPlanet.sizeClass = 100;
testPlanet.maxShips = 150; // 150 / 4 = 37.5, which is > sizeClass / 4 (25)
testPlanet.increaseMaxShips(10);
console.log(`Planet maxShips: ${testPlanet.maxShips}, radius: ${testPlanet.radius} (Expected radius cap: 25)`);
assert(testPlanet.radius === 25, "Planet radius should be capped at sizeClass / 4");

console.log("Planet radius size class cap test passed!");

// --- 5. Test Homeworld Weapon Accuracy Resource Matching ---
const mockPlayers = [
  { id: 'player_fed', cruiserStyle: 'Federation', name: 'Fed', resources: {} },
  { id: 'player_gorn', cruiserStyle: 'Gorn', name: 'Gorn', resources: {} },
  { id: 'player_rom', cruiserStyle: 'Romulan', name: 'Romulan', resources: {} },
  { id: 'player_kling', cruiserStyle: 'Klingon', name: 'Klingon', resources: {} },
  { id: 'player_tholian', cruiserStyle: 'Tholian', name: 'Tholian', resources: {} },
  { id: 'player_lyran', cruiserStyle: 'Lyran', name: 'Lyran', resources: {} }
];

for (const mp of mockPlayers) {
  // Clear any existing planets for a clean slate
  game.planets = [];
  // Add a candidate neutral planet
  const candidate = new Planet('cand_' + mp.id, 200, 200, 20, null, 10);
  game.planets.push(candidate);
  
  game.assignPlanet(mp);
  
  const assigned = game.planets.find(p => p.homeworldOf === mp.id);
  assert(assigned !== undefined, "Planet should be assigned as homeworld");
  assert(assigned.resources.length === 1, "Homeworld should have exactly 1 assigned resource");
  
  const assignedRes = assigned.resources[0];
  if (mp.cruiserStyle === 'Federation' || mp.cruiserStyle === 'Klingon') {
    assert(assignedRes === 'merculite', `Expected merculite for ${mp.cruiserStyle}. Got ${assignedRes}`);
  } else if (mp.cruiserStyle === 'Romulan' || mp.cruiserStyle === 'Gorn') {
    assert(assignedRes === 'antimatter', `Expected antimatter for ${mp.cruiserStyle}. Got ${assignedRes}`);
  } else if (mp.cruiserStyle === 'Tholian' || mp.cruiserStyle === 'Lyran') {
    assert(assignedRes === 'dilithium', `Expected dilithium for ${mp.cruiserStyle}. Got ${assignedRes}`);
  }
  
  assert(assigned.preferredResource !== assignedRes, `Preferred resource ${assigned.preferredResource} must not be the same as assigned accuracy resource ${assignedRes}`);
}

console.log("Homeworld weapon accuracy resource matching test passed!");
console.log("All unit tests completed successfully!");
