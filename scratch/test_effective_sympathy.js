import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { getEffectiveSympathy } from '../src/game.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running effective sympathy logic unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';

const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1, p2];

// 1. Test Neutral Planet
const planetNeutral = new Planet('planetNeutral', 400, 400, 25, null, 10);
planetNeutral.maxShips = 100;
planetNeutral.sympathy = { 'p1': 5 };

// Ship inside gravity well (getGravityRadius for neutral = 100 * 1.5 * 0.5 = 75)
const ship1 = new Ship(1, 420, 400, null, p1);
ship1.active = true;
ship1.count = 10;
ship1.isCruiser = false;

game.ships = [ship1];

const sym1 = getEffectiveSympathy(planetNeutral, 'p1', game.ships, p1, game);
assert(sym1 === 10, `Expected sympathy for p1 on neutral planet to be 10 (5 base + 5 ship HP), got ${sym1}`);

// 2. Test Enemy Planet (Owned by p2)
const planetEnemy = new Planet('planetEnemy', 800, 800, 25, p2, 10);
planetEnemy.maxShips = 100;
planetEnemy.sympathy = { 'p1': 5 };

const ship2 = new Ship(2, 820, 800, null, p1);
ship2.active = true;
ship2.count = 10;
ship2.isCruiser = false;

game.ships = [ship2];

// Before our change, ship presence on enemy planet was NOT counted.
// Now, it should count p1's ships in p2's gravity well since player p1 does not own it.
const sym2 = getEffectiveSympathy(planetEnemy, 'p1', game.ships, p1, game);
assert(sym2 === 10, `Expected sympathy for p1 on enemy planet to be 10 (5 base + 5 ship HP), got ${sym2}`);

// 3. Test Owned Planet (Owned by p1)
const planetOwned = new Planet('planetOwned', 1200, 1200, 25, p1, 10);
planetOwned.maxShips = 100;
planetOwned.sympathy = { 'p1': 5 };

const ship3 = new Ship(3, 1220, 1200, null, p1);
ship3.active = true;
ship3.count = 10;
ship3.isCruiser = false;

game.ships = [ship3];

// Sympathy for own planet should NOT count own ships (they own it already, so they shouldn't count it).
const sym3 = getEffectiveSympathy(planetOwned, 'p1', game.ships, p1, game);
assert(sym3 === 5, `Expected sympathy for p1 on own planet to be 5 (5 base + 0 ship HP), got ${sym3}`);

console.log("All effective sympathy unit tests passed successfully!");
