import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

// Setup mock environment
global.requestAnimationFrame = () => {};

console.log("=== Testing Cruiser Self-Refueling Restriction ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
game.allPlayers = [owner];
game.planets = [];

// Create a Cruiser for player 'p1'
const cruiser = new Ship('c1', 500, 500, null, owner, 500, 500);
cruiser.isCruiser = true;

// Setup cruiser upgrades
cruiser.maxHealth = 25;
cruiser.health = 25;
cruiser.fuel_tanker = 1; // Gives +5 fuel capacity, +15 max supplies
cruiser.maxsupplies = 15;
cruiser.supplies = 10; // Start with 10 supplies loaded

// Setup radar range
cruiser.cruiserRadarRange = () => 500;

game.ships = [cruiser];
// Mock getShipsInRadiusSq
game.ships.getShipsInRadiusSq = (x, y, radiusSq) => {
  return [cruiser];
};

const maxFuel = cruiser.getMaxFuel();
console.log(`Max Fuel: ${maxFuel}`); // Should be 10 (25/5 + 5)
console.log(`Max Supplies: ${cruiser.maxsupplies}`); // Should be 15
cruiser.fuel = 10;

// Test case 1: Fuel is at 9.0 (only 1.0 lower than max). It should NOT resupply.
cruiser.fuel = 9.0;
console.log(`\nSetting fuel to 9.0 (max - 1)`);
cruiser.update(1000, game.ships, [], game.planets, [], [], 1000, game);
console.log(`After 1s update:`);
console.log(`- Fuel: ${cruiser.fuel.toFixed(3)}`);
console.log(`- Supplies: ${cruiser.supplies}`);
console.log(`- isSelfRefueling: ${cruiser.isSelfRefueling}`);

const pass1 = cruiser.fuel < 9.0 && cruiser.supplies === 10;
console.log(`-> Test Case 1 (No Refuel when fuel > max-2): ${pass1 ? "PASSED" : "FAILED"}`);

// Test case 2: Fuel is at 7.9 (at least 2 lower than max). It should start resupplying.
cruiser.fuel = 7.9;
const initialSupplies = cruiser.supplies;
console.log(`\nSetting fuel to 7.9 (max - 2.1)`);
cruiser.update(1000, game.ships, [], game.planets, [], [], 1000, game);
console.log(`After 1s update:`);
console.log(`- Fuel: ${cruiser.fuel.toFixed(3)}`);
console.log(`- Supplies: ${cruiser.supplies.toFixed(3)}`);
console.log(`- isSelfRefueling: ${cruiser.isSelfRefueling}`);

const pass2 = cruiser.fuel > 7.9 && cruiser.supplies < initialSupplies && cruiser.isSelfRefueling === true;
console.log(`-> Test Case 2 (Refuel triggers when fuel <= max-2): ${pass2 ? "PASSED" : "FAILED"}`);

// Test case 3: Run update loop until it fills up to max, and verify hysteresis states.
console.log(`\nRefueling until full (monitoring state)...`);
let steps = 0;
let wasRefueling = true;
while (cruiser.fuel < maxFuel && steps < 100) {
  cruiser.update(1000, game.ships, [], game.planets, [], [], 1000, game);
  steps++;
  if (cruiser.fuel < maxFuel) {
    if (cruiser.isSelfRefueling !== true) {
      wasRefueling = false;
    }
  }
}

console.log(`Reached Max Fuel: ${cruiser.fuel.toFixed(3)} (after ${steps} steps)`);
console.log(`- isSelfRefueling at Max: ${cruiser.isSelfRefueling}`);
console.log(`- Supplies remaining: ${cruiser.supplies.toFixed(3)}`);

// One more update step should start draining and keep isSelfRefueling = false
const fuelAtMax = cruiser.fuel;
cruiser.update(1000, game.ships, [], game.planets, [], [], 1000, game);
console.log(`After one more step (draining phase):`);
console.log(`- Fuel: ${cruiser.fuel.toFixed(3)} (expected < ${fuelAtMax.toFixed(3)})`);
console.log(`- isSelfRefueling: ${cruiser.isSelfRefueling}`);

const pass3 = wasRefueling && cruiser.fuel < fuelAtMax && cruiser.isSelfRefueling === false;
console.log(`-> Test Case 3 (Hysteresis and refueling stop at max): ${pass3 ? "PASSED" : "FAILED"}`);
