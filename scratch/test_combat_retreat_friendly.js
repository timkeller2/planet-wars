import { Game } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/game.js';
import { Ship } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Ship.js';
import { Player } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Player.js';
import { Planet } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running combat retreat friendly space override unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';
const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1, p2];

// Mock friendly planet at (100, 100)
const planet = new Planet('p1', 100, 100, 20, p1);
planet.id = 'p1';
game.planets = [planet];

// --- Test 1: Inside Friendly Well, Low Health, NOT in combat (should NOT retreat) ---
const cruiser = new Ship(1, 100, 100, null, p1);
cruiser.isCruiser = true;
cruiser.maxHealth = 100;
cruiser.health = 40; // low health (< 50%)
cruiser.fuel = 100;
cruiser.isPatrolling = true; // flight mode

game.ships = [cruiser];

cruiser.update(0.0, game.ships, [], game.planets, [], [], 2000, game);
assert(cruiser.inFriendlyWell === true, "Cruiser should be inside friendly well");
assert(cruiser.isRetreating === false, "Cruiser inside friendly well not in combat should NOT trigger retreat");


// --- Test 2: Inside Friendly Well, Low Health, recently attacked (should trigger retreat) ---
const cruiser2 = new Ship(2, 100, 100, null, p1);
cruiser2.isCruiser = true;
cruiser2.maxHealth = 100;
cruiser2.health = 40;
cruiser2.fuel = 100;
cruiser2.isPatrolling = true;

const attacker = new Ship(3, 150, 100, null, p2);
attacker.active = true;

// Simulate attacker damaging cruiser2
cruiser2.takeDamage([], attacker, false, 'side');
assert(Date.now() - cruiser2.lastTimeAttacked < 2000, "lastTimeAttacked should be recently set");

game.ships = [cruiser2, attacker];

cruiser2.update(0.0, game.ships, [], game.planets, [], [], 2000, game);
assert(cruiser2.inFriendlyWell === true, "Cruiser should be inside friendly well");
assert(cruiser2.isRetreating === true, "Cruiser inside friendly well that was attacked should trigger retreat");


// --- Test 3: Inside Friendly Well, Depleted Bombs, recently attacking (should trigger retreat) ---
const cruiser3 = new Ship(4, 100, 100, null, p1);
cruiser3.isCruiser = true;
cruiser3.maxHealth = 100;
cruiser3.health = 100;
cruiser3.fuel = 100;
cruiser3.bombs = 0; // empty bombs
cruiser3.bombPlanetsEnabled = true;

const targetShip = new Ship(5, 120, 100, null, p2);
targetShip.active = true;
targetShip.maxHealth = 100;
targetShip.health = 100;

cruiser3.cruiserTargetType = 'ship';
cruiser3.cruiserTargetId = targetShip.id;

game.ships = [cruiser3, targetShip];

// Guarantee attack on first update frame
cruiser3.fireCooldown = 0;

// Trigger attack to update lastTimeAttacking
cruiser3.update(100.0, game.ships, [], game.planets, [], [], 2000, game);
assert(Date.now() - cruiser3.lastTimeAttacking < 2000, "lastTimeAttacking should be recently set");

// Run update a second time so retreat trigger sees lastTimeAttacking
cruiser3.update(100.0, game.ships, [], game.planets, [], [], 2000, game);
assert(cruiser3.isRetreating === true, "Cruiser inside friendly well that is attacking and out of bombs should trigger retreat");

console.log("All combat retreat friendly space override unit tests completed successfully!");
