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

// Create a Cruiser for player 'p1' (needs fuel)
const cruiser = new Ship('c1', 500, 500, null, owner, 500, 500);
cruiser.isCruiser = true;
cruiser.maxHealth = 25;
cruiser.health = 25;
cruiser.fuel_tanker = 1; // Gives +5 fuel capacity, +15 max supplies
cruiser.maxsupplies = 15;
cruiser.supplies = 10; // Has supplies, but shouldn't use them for self-refueling
cruiser.cruiserRadarRange = () => 500;

// Test case 1: Verify self-refueling is BLOCKED
cruiser.fuel = 5.0; // Needs fuel (max is 10)
game.ships = [cruiser];
cruiser.update(1000, game.ships, [], game.planets, [], [], 1000, game);

console.log("Test Case 1: Self-Refueling Block Check");
console.log(`- Cruiser supplies: ${cruiser.supplies}`);
console.log(`- Cruiser isSelfRefueling: ${cruiser.isSelfRefueling}`);
console.log(`- Cruiser fuel: ${cruiser.fuel.toFixed(3)}`);

if (cruiser.supplies === 10 && cruiser.isSelfRefueling === false && cruiser.fuel < 5.0) {
  console.log("-> PASSED: Cruiser did not use its own supplies for self-refueling");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

// Test case 2: Verify refueling from ANOTHER supply ship works
console.log("\nTest Case 2: Refueling from Another Supply Ship");

// Create another cruiser with supplies
const otherCruiser = new Ship('c2', 510, 500, null, owner, 510, 500);
otherCruiser.isCruiser = true;
otherCruiser.maxHealth = 25;
otherCruiser.health = 25;
otherCruiser.fuel_tanker = 1;
otherCruiser.maxsupplies = 15;
otherCruiser.supplies = 10; // Other cruiser has supplies
otherCruiser.cruiserRadarRange = () => 500;

game.ships = [cruiser, otherCruiser];

// Set cruiser fuel low so it wants fuel
cruiser.fuel = 5.0;
const initialOtherSupplies = otherCruiser.supplies;

// Run game updates to let otherCruiser refuel cruiser
// Ship.js update: fuel is consumed by default cruiser update (1.0/60 per second)
// Then it should refuel using supplies from otherCruiser.
cruiser.update(1000, game.ships, [], game.planets, [], [], 1000, game);

console.log(`- Cruiser fuel after update: ${cruiser.fuel.toFixed(3)}`);
console.log(`- Other Cruiser supplies after update: ${otherCruiser.supplies.toFixed(3)}`);

// In 1 second:
// Cruiser fuel consumption: 1/60 = 0.0167
// Refueling rate: 1.0 fuel per second, consuming supplies = 1.0 * costMultiplier
// Since fuel is low, it should get refueled, and otherCruiser's supplies should decrease.
if (cruiser.fuel > 5.0 && otherCruiser.supplies < initialOtherSupplies) {
  console.log("-> PASSED: Cruiser successfully refueled using other cruiser's supplies");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

console.log("\nAll cruiser self-refueling restriction checks passed!");
