import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running retreat prioritization unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';
const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1, p2];

// Mock planets
const planetA = new Planet('pA', 300, 100, 20, p1); // Center (300, 100). Gravity radius = 20 * 4 = 80px (approx)
planetA.id = 'pA';
const planetB = new Planet('pB', 700, 100, 20, p1); // Center (700, 100)
planetB.id = 'pB';

game.planets = [planetA, planetB];

// Mock cruiser at (100, 100)
const cruiser = new Ship(1, 100, 100, null, p1);
cruiser.isCruiser = true;
cruiser.maxHealth = 100;
cruiser.health = 40; // Trigger retreat on health < 50%
cruiser.fuel = 100;
cruiser.isRetreating = true; // explicitly trigger retreat mode
cruiser.retreatTargetPlanetId = null;

// Mock enemy at (1000, 100) (very far, so both planets are safe)
const enemy = new Ship(2, 1000, 100, null, p2);
enemy.active = true;
enemy.count = 10;

game.ships = [cruiser, enemy];

// Helper to run cruiser update
const updateCruiser = () => {
  cruiser.update(0.0, game.ships, [], game.planets, [], [], 2000, game);
};

// --- Test 1: Prioritize Planet within 400px ---
// Planet A center is 300 (distance = 200px, within 400px limit)
// Planet B center is 700 (distance = 600px, outside 400px limit)
// Both are friendly and safe (enemy is at 1000).
// Cruiser should choose a coordinate inside Planet A gravity well.
updateCruiser();

console.log(`Retreat Target coordinate: (${cruiser.targetX}, ${cruiser.targetY}), Planet ID: ${cruiser.retreatTargetPlanetId}`);
assert(cruiser.retreatTargetPlanetId === 'pA', "Cruiser should retreat to Planet A (within 400px) instead of Planet B");


// --- Test 2: Choose Closest Safe Point Overall if none within 400px ---
// Move Planet A further away (e.g. to (600, 100), distance = 500px)
// Move Planet B to (800, 100) (distance = 700px)
// Now both are outside 400px, but Planet A is closer than Planet B.
planetA.x = 600;
planetB.x = 800;
cruiser.retreatTargetPlanetId = null; // reset

updateCruiser();
console.log(`Retreat Target Planet ID: ${cruiser.retreatTargetPlanetId}`);
assert(cruiser.retreatTargetPlanetId === 'pA', "Cruiser should choose closest safe planet overall (Planet A)");

console.log("All retreat prioritization unit tests completed successfully!");
