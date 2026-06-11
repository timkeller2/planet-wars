import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running friendly space retreat trigger unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1];

// Mock friendly planet at (100, 100). Gravity radius = 20 * 4 = 80px (approx)
const planet = new Planet('p1', 100, 100, 20, p1);
planet.id = 'p1';
game.planets = [planet];

// --- Test 1: Inside Friendly Well (Should NOT trigger retreat) ---
// Cruiser at (100, 100) (inside gravity well). Low health = 40 (max 100), low fuel = 10 (max 100)
const cruiser = new Ship(1, 100, 100, null, p1);
cruiser.isCruiser = true;
cruiser.maxHealth = 100;
cruiser.health = 40;
cruiser.fuel = 10;
cruiser.isPatrolling = true; // active flight mode

game.ships = [cruiser];

cruiser.update(0.0, game.ships, [], game.planets, [], [], 2000, game);
assert(cruiser.inFriendlyWell === true, "Cruiser should be inside friendly well");
assert(cruiser.isRetreating === false, "Cruiser inside friendly well should NOT trigger retreat");


// --- Test 2: Outside Friendly Well (Should trigger retreat) ---
// Move cruiser to (300, 100) (outside gravity well)
const cruiser2 = new Ship(2, 300, 100, null, p1);
cruiser2.isCruiser = true;
cruiser2.maxHealth = 100;
cruiser2.health = 40;
cruiser2.fuel = 10;
cruiser2.isPatrolling = true;

game.ships = [cruiser2];

cruiser2.update(0.0, game.ships, [], game.planets, [], [], 2000, game);
assert(cruiser2.inFriendlyWell === false, "Cruiser should be outside friendly well");
assert(cruiser2.isRetreating === true, "Cruiser outside friendly well should trigger retreat");

console.log("All friendly space retreat trigger unit tests completed successfully!");
