import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Cruiser-to-Cruiser Refueling Requirements ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
game.allPlayers = [owner];
game.planets = [];

// Receiver cruiser (needs fuel)
const receiver = new Ship('c_rec', 500, 500, null, owner);
receiver.isCruiser = true;
receiver.maxHealth = 50;
receiver.health = 50;
receiver.fuel = 6.0; // Needs fuel (max = 10)
receiver.cruiserRadarRange = () => 500;

// Source cruiser (has fuel)
const source = new Ship('c_src', 510, 500, null, owner);
source.isCruiser = true;
source.maxHealth = 50;
source.health = 50;

game.ships = [receiver, source];

// Helper to run updates
const runUpdate = () => {
  receiver.update(1000, game.ships, [], [], [], [], 1000, game);
};

// Test Case 1: Source has less than 2 more fuel than receiver (source = 7.0, receiver = 6.0)
source.fuel = 7.0;
receiver.fuel = 6.0;
runUpdate();
console.log(`Test Case 1 (Source fuel = 7.0, Receiver fuel = 6.0):`);
console.log(`- Receiver fuel after update: ${receiver.fuel.toFixed(3)}`);
console.log(`- Source fuel after update: ${source.fuel.toFixed(3)}`);
if (receiver.fuel <= 6.0 && source.fuel === 7.0) {
  console.log("-> PASSED: Receiver did not refuel from source because source is not > 2 fuel units higher");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

// Test Case 2: Source has more than 2 more fuel than receiver (source = 9.0, receiver = 6.0)
source.fuel = 9.0;
receiver.fuel = 6.0;
runUpdate();
console.log(`\nTest Case 2 (Source fuel = 9.0, Receiver fuel = 6.0):`);
console.log(`- Receiver fuel after update: ${receiver.fuel.toFixed(3)}`);
console.log(`- Source fuel after update: ${source.fuel.toFixed(3)}`);
if (receiver.fuel > 6.0 && source.fuel < 9.0) {
  console.log("-> PASSED: Receiver refueled from source successfully");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

console.log("\nAll cruiser-to-cruiser refueling checks passed!");
