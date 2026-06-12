import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { SHIP_NAMES } from '../src/entities/ShipNames.js';
import assert from 'assert';

console.log('--- Running Ship Names Tests ---');

// 1. Setup mock environment
const game = new Game({ width: 1000, height: 1000 });
const player = new Player('p1', '#0ff', false);
player.cruiserStyle = 'Romulan';
const planet = new Planet('pl1', 100, 100, 30, player, 100, 1000, 1000);
planet.racialAffinity = 'Romulan';

// Test 1: Assigning a name to a small Romulan Cruiser
const ship1 = new Ship(1, 100, 100, null, player);
ship1.isCruiser = true;
ship1.classType = 'corvette';
ship1.cruiserStyle = 'Romulan';

game.assignRandomShipName(ship1);
console.log(`Ship 1 Name (small Romulan): ${ship1.name}`);
assert(ship1.name !== null, 'Ship 1 should have a name');
assert(SHIP_NAMES.Romulan.small.includes(ship1.name), 'Ship 1 name should be from the Romulan small pool');
assert(game.usedShipNames.has(ship1.name), 'Ship 1 name should be registered in usedShipNames');

// Test 2: Assigning a name to a medium Romulan Cruiser
const ship2 = new Ship(2, 100, 100, null, player);
ship2.isCruiser = true;
ship2.classType = 'battlecruiser';
ship2.cruiserStyle = 'Romulan';

game.assignRandomShipName(ship2);
console.log(`Ship 2 Name (medium Romulan): ${ship2.name}`);
assert(ship2.name !== null, 'Ship 2 should have a name');
assert(SHIP_NAMES.Romulan.medium.includes(ship2.name), 'Ship 2 name should be from the Romulan medium pool');
assert(game.usedShipNames.has(ship2.name), 'Ship 2 name should be registered in usedShipNames');

// Test 3: Assigning a name to a large Romulan Cruiser
const ship3 = new Ship(3, 100, 100, null, player);
ship3.isCruiser = true;
ship3.classType = 'titan';
ship3.cruiserStyle = 'Romulan';

game.assignRandomShipName(ship3);
console.log(`Ship 3 Name (large Romulan): ${ship3.name}`);
assert(ship3.name !== null, 'Ship 3 should have a name');
assert(SHIP_NAMES.Romulan.large.includes(ship3.name), 'Ship 3 name should be from the Romulan large pool');
assert(game.usedShipNames.has(ship3.name), 'Ship 3 name should be registered in usedShipNames');

// Test 4: Exhausting names (Romulan large pool has 25 names)
console.log('Exhausting Romulan large ship names...');
const romulanLargeNamesCount = SHIP_NAMES.Romulan.large.length;
const testShips = [];

// Fill up all but 1 remaining Romulan large name (we already used 1: ship3)
for (let i = 0; i < romulanLargeNamesCount - 1; i++) {
  const ts = new Ship(100 + i, 100, 100, null, player);
  ts.isCruiser = true;
  ts.classType = 'titan';
  ts.cruiserStyle = 'Romulan';
  game.assignRandomShipName(ts);
  testShips.push(ts);
}

// Check that all assigned names are unique
const nameSet = new Set(testShips.map(s => s.name));
nameSet.add(ship3.name);
console.log(`Unique large Romulan names assigned: ${nameSet.size}/${romulanLargeNamesCount}`);
assert.strictEqual(nameSet.size, romulanLargeNamesCount, 'All large Romulan names assigned should be unique');

// Test 5: Recycling pool upon exhaustion
const overflowShip = new Ship(999, 100, 100, null, player);
overflowShip.isCruiser = true;
overflowShip.classType = 'titan';
overflowShip.cruiserStyle = 'Romulan';
game.assignRandomShipName(overflowShip);
console.log(`Overflow Ship Name: ${overflowShip.name}`);
assert(overflowShip.name !== null, 'Overflow ship should get a name');
assert(SHIP_NAMES.Romulan.large.includes(overflowShip.name), 'Overflow ship name should be from the Romulan large pool');

console.log('All Ship Name tests passed successfully!');
