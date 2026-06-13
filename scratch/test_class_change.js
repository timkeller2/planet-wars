import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { getHabName } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Habitability Class Change Event Queueing ===");

const game = new Game();
const player = new Player('p1', '#0ff', false);
game.allPlayers.push(player);

const planet = new Planet(1, 100, 100, 30, player, 100);
planet.focusMode = 'terraforming';
game.planets.push(planet);

// Set habitability right before Swamp -> Jungle (threshold is 80)
planet.habitability = 79;
planet.ships = 200; // Ensure the planet is full so capacityProgress accumulates
player.techScore = 500; // Ensure techScore is high so habitability (79) doesn't exceed 6 * sqrt(techScore) (which is 132)
planet.capacityProgress = 31 * 1000; // Force update step to trigger (timeToIncrease is ~30 seconds, and we pass deltaTime in milliseconds)
console.log("Initial habitability:", planet.habitability, "Name:", getHabName(planet.habitability));

// Update the planet (simulate a frame or tick with deltaTime in ms)
planet.update(1.0, game.planets, {}, game);

console.log("Updated habitability:", planet.habitability, "Name:", getHabName(planet.habitability));
console.log("Pending changes:", game.pendingHabClassChanges);

assert(planet.habitability === 100, "Habitability should have jumped to 100");
assert(getHabName(planet.habitability) === 'Terran', "New name should be Terran");
assert(game.pendingHabClassChanges && game.pendingHabClassChanges.length === 1, "Should have queued 1 class change event");
assert(game.pendingHabClassChanges[0].oldClass === 'Jungle', "Old class should be Jungle");
assert(game.pendingHabClassChanges[0].newClass === 'Terran', "New class should be Terran");

console.log("\nHabitability class change tests PASSED!");
