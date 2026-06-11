import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running cruiser combat distance behavior unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';
const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1, p2];

// Helper to run cruiser update tick
const updateCruiser = (cruiser, ships) => {
  cruiser.update(0.0, ships, [], [], [], [], 2000, game);
};

// --- Test 1: Standard Cruiser vs Single Weaker Enemy ---
// Cruiser health = 100, target fleet size = 50 (weaker)
const cruiser = new Ship(1, 100, 100, null, p1);
cruiser.isCruiser = true;
cruiser.maxHealth = 100;
cruiser.health = 100;
cruiser.package = 'ranged';
cruiser.cruiserTargetType = 'ship';

const enemy1 = new Ship(2, 150, 100, null, p2);
enemy1.count = 50; // Weaker (50 < 100)
cruiser.cruiserTargetId = enemy1.id;

let ships = [cruiser, enemy1];
updateCruiser(cruiser, ships);

// Should close in, so targetX should be enemy1.x (approach target coordinate 150)
console.log(`Test 1 Target: ${cruiser.targetX}`);
assert(cruiser.targetX === enemy1.x, "Standard cruiser should close in on a weaker enemy");


// --- Test 2: Standard Cruiser vs Single Stronger Enemy ---
// Enemy fleet size = 120 (stronger than 100)
enemy1.count = 120;
updateCruiser(cruiser, ships);

// Should stay at range. Front arc range for maxHealth=100 is:
// baseRange = 40 * 1.10 = 44px
// maxFrontRange = 44 * 1.3 = 57.2px
// Since dist is 50px (which is <= maxFrontRange - 5 = 52.2px) and target is in front (angle=0, diff=0):
// It should stop moving: targetX should be cruiser's current x (100)
console.log(`Test 2 Target: ${cruiser.targetX}`);
assert(cruiser.targetX === cruiser.x, "Standard cruiser should stay at range against a stronger enemy");


// --- Test 3: Standard Cruiser vs Weaker Target but Stronger Local Sum ---
// Target size = 50, but another enemy fleet of size 80 is 200px away (total sum = 130 > 100)
enemy1.count = 50;
const enemy2 = new Ship(3, 200, 100, null, p2);
enemy2.count = 80; // Total local enemy strength is 130
ships = [cruiser, enemy1, enemy2];

updateCruiser(cruiser, ships);
console.log(`Test 3 Target: ${cruiser.targetX}`);
assert(cruiser.targetX === cruiser.x, "Standard cruiser should stay at range when local sum is stronger");


// --- Test 4: Brute Cruiser vs Single Stronger Enemy (< 150%) ---
// Brute strength = 100. Target strength = 140 (stronger than brute, but <= 150% of brute strength)
const brute = new Ship(4, 100, 100, null, p1);
brute.isCruiser = true;
brute.maxHealth = 100;
brute.health = 100;
brute.package = 'brute';
brute.cruiserTargetType = 'ship';
brute.cruiserTargetId = enemy1.id;

enemy1.count = 140; // 140 <= 150% of 100
ships = [brute, enemy1];

updateCruiser(brute, ships);
console.log(`Test 4 Target: ${brute.targetX}`);
assert(brute.targetX === enemy1.x, "Brute cruiser should close in on enemy <= 150% strength");


// --- Test 5: Brute Cruiser vs Single Massively Stronger Enemy (> 150%) ---
// Target strength = 160 (> 150% of brute strength)
enemy1.count = 160;

updateCruiser(brute, ships);
console.log(`Test 5 Target: ${brute.targetX}`);
// For brute package, effectiveRange is halved (baseRange=44 * 0.5 = 22, maxFrontRange=22*1.3=28.6)
// Since dist is 50px (which is > maxFrontRange), it is out of range, so it approaches (targetX = enemy1.x)
// Let's place the brute closer, e.g. at 135 (dist = 15px, within maxFrontRange - 5 = 23.6px)
brute.x = 135;
updateCruiser(brute, ships);
console.log(`Test 5 (Closer) Target: ${brute.targetX}`);
assert(brute.targetX === brute.x, "Brute cruiser should stay at range when enemy is > 150% strength");

console.log("All cruiser combat distance behavior unit tests completed successfully!");
