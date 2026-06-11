import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Fleet Costs (Command Limit Overage) ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
owner.credits = 1000;

game.players = [owner];
game.allPlayers = [owner];

// 1. Establish player planets to compute commandLimit
// Base: 1 + ceil(Planet Count / 3) = 1 + ceil(1 / 3) = 2.
// With garrison worlds/etc = 0, commandLimit = 2.
game.planets = [];
const p = new Planet(0, 100, 100, 15, owner, 0);
p.isMilitary = false;
p.homeworldOf = null;
game.planets.push(p);

// 2. Add 4 active cruisers owned by owner (excess of 2)
game.ships.length = 0;
for (let i = 0; i < 4; i++) {
  const ship = new Ship(i, 100, 100, null, owner, 100, 100);
  ship.active = true;
  ship.isCruiser = true;
  game.ships.push(ship);
}

// Set player resources (dilithium = 2, which is under stockpile capacity of 6, so no storage fee is charged)
owner.resources = {
  dilithium: 2,
  merculite: 0,
  duranium: 0,
  tritanium: 0,
  antimatter: 0,
  deuterium: 0,
  latinum: 0
};

// Tick game for 1 second (1000ms) to trigger storage/fleet fee accumulator processing
// game.update(deltaTime)
game.update(1000);

console.log(`- Command Limit: ${owner.commandLimit}`);
console.log(`- Cruiser Count: ${owner.cruiserCount}`);
console.log(`- Fleet Cost Rate per Minute: ${owner.fleetCostRate}`);
console.log(`- Player Credits: ${owner.credits}`);

// Under new formula: excess = 4 - 2 = 2.
// commandLimit = 2.
// fleetCost = (2 * 5) / (2 * 8) = 5/8 = 0.625 credits per second.
// fleetCostRate = (5/8) * 60 = 37.5 per minute.
// Credits after interest and fee: 1000 + (1000 * 0.005 / 60000 * 1000) - (5/8)
// = 1000 + (1/12) - (5/8) = 1000 - 13/24 = 999.45833333
const expectedRate = 37.5;
const expectedCredits = 1000 - (13 / 24);

const rateMatch = Math.abs(owner.fleetCostRate - expectedRate) < 0.0001;
const creditsMatch = Math.abs(owner.credits - expectedCredits) < 0.0001;

if (rateMatch && creditsMatch) {
  console.log(`-> PASSED: Fleet cost rate and credit deduction are correct (${owner.fleetCostRate.toFixed(4)}/min, ${owner.credits.toFixed(4)} credits)`);
} else {
  console.log(`-> FAILED: Expected rate ${expectedRate}, got ${owner.fleetCostRate}; Expected credits ${expectedCredits}, got ${owner.credits}`);
  process.exit(1);
}

// 3. Test resource deduction when credits are 0
owner.credits = 0;
// We now expect 5/8 = 0.625 units of dilithium to be deducted from stockpile
game.update(1000);

console.log(`- Player Credits after zero check: ${owner.credits}`);
console.log(`- Player Dilithium: ${owner.resources.dilithium}`);

// Remaining fee = 0.625. Deducted from dilithium: 2 - 0.625 = 1.375
const expectedDilithium = 1.375;
const dilithiumMatch = Math.abs(owner.resources.dilithium - expectedDilithium) < 0.0001;

if (dilithiumMatch && owner.credits === 0) {
  console.log(`-> PASSED: Resource deduction under insufficient credits is correct (${owner.resources.dilithium.toFixed(4)} dilithium)`);
} else {
  console.log(`-> FAILED: Expected dilithium ${expectedDilithium}, got ${owner.resources.dilithium}`);
  process.exit(1);
}

console.log("\nAll fleet cost tests passed!");
