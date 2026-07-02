import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Tritanium XP Boost tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  game.isRunning = true;

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  player.resources.tritanium = 50; // Give plenty of Tritanium

  // Find a friendly planet
  const friendlyPlanet = game.planets[0];
  friendlyPlanet.owner = player;
  friendlyPlanet.ships = 100;
  friendlyPlanet.maxShips = 100;
  friendlyPlanet.useResources = true; // Enable resource usage

  // Find a second planet to launch to
  const targetPlanet = game.planets[1];

  // 2. Launch fleet without Tritanium payment (temporarily zero out player tritanium)
  player.resources.tritanium = 0;
  
  // Save current ships count to find the spawned ship
  const initialShipCount = game.ships.length;
  game.sendShips(friendlyPlanet, targetPlanet, false, null, false, 50, false, false);
  
  // Find the launched fleet
  game.update(100);
  const regularFleet = game.ships[game.ships.length - 1];
  assert.ok(regularFleet, "A fleet should have been launched");
  console.log(`Regular Fleet startingExp: ${regularFleet.expScore}`);
  assert.strictEqual(regularFleet.expScore, friendlyPlanet.expScore || 0, "Regular fleet should start with default planet XP");

  // 3. Launch fleet WITH Tritanium payment
  player.resources.tritanium = 50;
  friendlyPlanet.ships = 100;
  
  game.sendShips(friendlyPlanet, targetPlanet, false, null, false, 50, false, false);
  
  game.update(100);
  const boostedFleet = game.ships[game.ships.length - 1];
  assert.ok(boostedFleet && boostedFleet !== regularFleet, "A new fleet should have been launched");
  console.log(`Boosted Fleet startingExp: ${boostedFleet.expScore}`);
  assert.strictEqual(boostedFleet.expScore, (friendlyPlanet.expScore || 0) + 400, "Boosted fleet should start with +400 XP");

  console.log("All Tritanium XP Boost tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
