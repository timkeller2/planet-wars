import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Construction Credit Priority tests...");

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
  // minAllowedCredits = -(1000 + Math.floor(100)) = -1100

  // Ensure planet has enough ships and maxShips room to build
  planet.ships = 200;
  planet.maxShips = 300;

  // Let's test buildCapitalShip with enough credits and useCredits = false
  player.credits = 200;
  player.useCredits = false; // should be ignored

  // Config for Corvette
  const corvetteCostShips = 50; // default cost is 50, but let's check
  console.log(`Initial Credits: ${player.credits}`);
  console.log(`Initial Planet Ships: ${planet.ships}`);
  
  const initialShipCount = game.ships.length;
  game.buildCapitalShip(planet, 'corvette');
  
  const newShipCount = game.ships.length;
  assert.strictEqual(newShipCount, initialShipCount + 1, "A new ship should have been built");
  
  const spawnedShip = game.ships[game.ships.length - 1];
  console.log(`Spawned ship cost credits: ${spawnedShip.buildCostCreditsTotal}`);
  console.log(`Spawned ship cost ships: ${spawnedShip.buildCostShipsTotal}`);
  
  assert.strictEqual(spawnedShip.buildCostCreditsTotal, 50, "Corvette should have cost 50 credits");
  assert.strictEqual(spawnedShip.buildCostShipsTotal, 0, "Corvette should have cost 0 ships");

  // Let's test buildCapitalShip when near debt limit
  // Set credits to -1080. Since minAllowedCredits is -1100, available credits is 20.
  player.credits = -1080;
  game.buildCapitalShip(planet, 'corvette');
  
  const spawnedShip2 = game.ships[game.ships.length - 1];
  console.log(`Second ship (near debt limit) cost credits: ${spawnedShip2.buildCostCreditsTotal}`);
  console.log(`Second ship (near debt limit) cost ships: ${spawnedShip2.buildCostShipsTotal}`);
  
  assert.strictEqual(spawnedShip2.buildCostCreditsTotal, 20, "Should only pay 20 credits (bringing credits down to -1100 limit)");
  assert.strictEqual(spawnedShip2.buildCostShipsTotal, 30, "Remaining 30 cost should be paid in ships");

  // Let's test buildCapitalShipConfig likewise
  player.credits = 200;
  player.useCredits = false;
  game.buildCapitalShipConfig(planet, 'corvette', { shields: 1 }, "Custom Corvette");
  
  const spawnedShip3 = game.ships[game.ships.length - 1];
  console.log(`Custom ship cost credits: ${spawnedShip3.buildCostCreditsTotal}`);
  console.log(`Custom ship cost ships: ${spawnedShip3.buildCostShipsTotal}`);
  
  // Custom Corvette with shields will cost slightly more than 50
  assert.ok(spawnedShip3.buildCostCreditsTotal > 0, "Custom ship should have paid with credits");
  assert.strictEqual(spawnedShip3.buildCostShipsTotal, 0, "Custom ship should have paid 0 ships since credits were sufficient");

  console.log("All tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
