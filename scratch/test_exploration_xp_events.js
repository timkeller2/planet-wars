import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running cruiser exploration event queuing test...");

const p1 = new Player('p1', '#0ff', false);
const game = new Game({ width: 1000, height: 1000 });
game.allPlayers = [p1];
game.exploredGrid = {};

// Create cruiser at 50, 50 (cell 0, 0)
const cruiser = new Ship(1, 50, 50, null, p1);
cruiser.isCruiser = true;
cruiser.maxHealth = 100;
cruiser.health = 100;
cruiser.fuel = 100;

// Set up grid to be explored except for cell 0,0
const radarRange = cruiser.cruiserRadarRange();
const cellRadius = Math.max(1, Math.ceil(radarRange / 100));
for (let dx = -cellRadius; dx <= cellRadius; dx++) {
  for (let dy = -cellRadius; dy <= cellRadius; dy++) {
    game.exploredGrid[`p1_${dx}_${dy}`] = Date.now();
  }
}
game.exploredGrid[`p1_0_0`] = 0; // Unexplored for p1

// Trigger update
cruiser.update(0.1, [cruiser], [], [], [], [], 1000, game);

// Check that game.pendingExplorationEvents has the event
assert(game.pendingExplorationEvents && game.pendingExplorationEvents.length > 0, "Exploration event should be queued in game.pendingExplorationEvents");
const ev = game.pendingExplorationEvents[0];
console.log("Queued Event details:", ev);
assert(ev.playerId === 'p1', "Event should belong to player p1");
assert(ev.x === 50 && ev.y === 50, "Event coordinates should be (50,50)");
assert(ev.xp === 2, "xp should be 2 because it was not explored by anyone else");
assert(ev.shipId === 1, "shipId should match the cruiser's ID");

console.log("Cruiser exploration event queuing test completed successfully!");
