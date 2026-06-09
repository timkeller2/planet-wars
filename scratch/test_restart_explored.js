import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Starting game exploration restart test...");

const game = new Game({ width: 1000, height: 1000 });
game.settings = { mapSize: 1000, aiCount: 0 };
game.initMap();

const player = new Player('p1', '#0ff', false);
game.allPlayers = [player];

// Verify initially exploredGrid is empty
console.log("Initial exploredGrid keys count:", Object.keys(game.exploredGrid).length);
assert(Object.keys(game.exploredGrid).length === 0, "Initially exploredGrid should be empty");

// Create a ship and explore a cell
console.log("Simulating exploration...");
const ship = new Ship(game.nextShipId++, 150, 150, null, player);
game.ships.push(ship);

// Run ship update to trigger exploration logging
ship.update(0.1, game.ships, game.explosions, game.planets, game.lasers, game.ionStorms, game.width, game);

console.log("exploredGrid keys after exploration:", Object.keys(game.exploredGrid));
assert(Object.keys(game.exploredGrid).length > 0, "exploredGrid should have keys after ship update");

// Now restart the game / call initMap
console.log("Calling game.initMap() to restart...");
game.initMap();

console.log("exploredGrid keys count after restart:", Object.keys(game.exploredGrid).length);
assert(Object.keys(game.exploredGrid).length === 0, "exploredGrid should be empty after restart/initMap");

console.log("Test passed successfully!");
