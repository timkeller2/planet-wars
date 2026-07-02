import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Updated Cruiser Construction Credit-Only & Garrison tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  // Pick a planet and assign to player
  const planet = game.planets[0];
  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  
  planet.owner = player;
  player.totalShips = 100;
  
  // Set up homeworld status to test minAllowedCredits / debt limit
  planet.homeworldOf = player.id;
  planet.isMilitary = false;
  // minAllowedCredits = -(1000 + Math.floor(100)) = -1100

  // Scenario A: Player has enough credits (200) and planet has enough ships (60 >= 50)
  game.ships = [];
  planet.ships = 60;
  planet.maxShips = 300;
  player.credits = 200;
  player.builtClasses = {};
  player.buildCounts = {};

  console.log("Testing Scenario A: Sufficient credits and sufficient ships...");
  let initialShipCount = game.ships.length;
  game.buildCapitalShip(planet, 'corvette');
  
  assert.strictEqual(game.ships.length, initialShipCount + 1, "A new ship should have been built");
  let spawnedShip = game.ships[game.ships.length - 1];
  console.log(`- Credits total: ${spawnedShip.buildCostCreditsTotal}, Ships total: ${spawnedShip.buildCostShipsTotal}`);
  assert.strictEqual(spawnedShip.buildCostCreditsTotal, 50, "Corvette should cost 50 credits");
  assert.strictEqual(spawnedShip.buildCostShipsTotal, 0, "Corvette should cost 0 ships");

  // Scenario B: Player does not have enough credits (-1080 credits, so only 20 above debt limit of -1100)
  game.ships = [];
  player.credits = -1080;
  planet.ships = 60;
  player.builtClasses = {};
  player.buildCounts = {};
  
  console.log("Testing Scenario B: Insufficient credits above debt limit...");
  initialShipCount = game.ships.length;
  game.buildCapitalShip(planet, 'corvette');
  assert.strictEqual(game.ships.length, initialShipCount, "Should NOT build a ship when credits are insufficient");

  // Scenario C: Player has enough credits (200), but planet has insufficient ships (10 < 50)
  game.ships = [];
  player.credits = 200;
  planet.ships = 10;
  player.builtClasses = {};
  player.buildCounts = {};
  
  console.log("Testing Scenario C: Insufficient planet ships...");
  initialShipCount = game.ships.length;
  game.buildCapitalShip(planet, 'corvette');
  assert.strictEqual(game.ships.length, initialShipCount, "Should NOT build a ship when planet ships are insufficient");

  // Scenario D: Player has enough credits (200), planet has 30 ships, planet IS a military world (30 * 2 = 60 >= 50)
  game.ships = [];
  player.credits = 200;
  planet.ships = 30;
  planet.isMilitary = true;
  player.builtClasses = {};
  player.buildCounts = {};
  
  console.log("Testing Scenario D: Military world double ship count...");
  initialShipCount = game.ships.length;
  game.buildCapitalShip(planet, 'corvette');
  assert.strictEqual(game.ships.length, initialShipCount + 1, "Should build a ship on military world with half required ships");
  spawnedShip = game.ships[game.ships.length - 1];
  assert.strictEqual(spawnedShip.buildCostCreditsTotal, 50, "Corvette should cost 50 credits");
  assert.strictEqual(spawnedShip.buildCostShipsTotal, 0, "Corvette should cost 0 ships");

  // Scenario E: Subsequent builds should also pay 100% in credits
  game.ships = [];
  player.credits = 200;
  planet.ships = 60;
  planet.isMilitary = false;
  // Mark Corvette as already built
  player.builtClasses = { corvette: true };
  player.buildCounts = { corvette: 1 };
  
  console.log("Testing Scenario E: Subsequent builds pay in credits...");
  initialShipCount = game.ships.length;
  game.buildCapitalShip(planet, 'corvette');
  
  assert.strictEqual(game.ships.length, initialShipCount + 1, "Subsequent ship should have been built");
  spawnedShip = game.ships[game.ships.length - 1];
  console.log(`- Credits total: ${spawnedShip.buildCostCreditsTotal}, Ships total: ${spawnedShip.buildCostShipsTotal}`);
  assert.strictEqual(spawnedShip.buildCostCreditsTotal, 50, "Subsequent build should also cost 50 credits");
  assert.strictEqual(spawnedShip.buildCostShipsTotal, 0, "Subsequent build should cost 0 ships");

  // Scenario F: Custom configuration build
  game.ships = [];
  player.credits = 200;
  planet.ships = 120;
  planet.isMilitary = false;
  player.builtClasses = {};
  player.buildCounts = {};
  
  console.log("Testing Scenario F: Custom configuration build...");
  initialShipCount = game.ships.length;
  game.buildCapitalShipConfig(planet, 'corvette', { shields: 1 }, "Custom Corvette");
  
  assert.strictEqual(game.ships.length, initialShipCount + 1, "Config ship should have been built");
  spawnedShip = game.ships[game.ships.length - 1];
  console.log(`- Config Credits total: ${spawnedShip.buildCostCreditsTotal}, Config Ships total: ${spawnedShip.buildCostShipsTotal}`);
  assert.ok(spawnedShip.buildCostCreditsTotal > 0, "Config ship should have cost > 0 credits");
  assert.strictEqual(spawnedShip.buildCostShipsTotal, 0, "Config ship should cost 0 ships");

  console.log("All Cruiser Construction tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
