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

  // Let's test buildCapitalShip for subsequent build (non-prototype)
  // Even with credits available, subsequent corvette build should pay 100% in ships (50 ships on homeworld)
  player.credits = 200;
  const oldShips = planet.ships;
  game.buildCapitalShip(planet, 'corvette');
  
  const spawnedShip2 = game.ships[game.ships.length - 1];
  console.log(`Second ship (non-prototype) cost credits: ${spawnedShip2.buildCostCreditsTotal}`);
  console.log(`Second ship (non-prototype) cost ships: ${spawnedShip2.buildCostShipsTotal}`);
  
  assert.strictEqual(spawnedShip2.buildCostCreditsTotal, 0, "Subsequent corvette should cost 0 credits");
  assert.strictEqual(spawnedShip2.buildCostShipsTotal, 50, "Subsequent corvette should cost 50 ships");

  // Let's test buildCapitalShipConfig for a prototype of a new class (destroyer)
  // Since destroyer is not built yet (prototype), it should pay with credits
  player.credits = 200;
  game.buildCapitalShipConfig(planet, 'destroyer', { shields: 1 }, "Custom Destroyer");
  
  const spawnedShip3 = game.ships[game.ships.length - 1];
  console.log(`Custom prototype destroyer cost credits: ${spawnedShip3.buildCostCreditsTotal}`);
  console.log(`Custom prototype destroyer cost ships: ${spawnedShip3.buildCostShipsTotal}`);
  
  assert.ok(spawnedShip3.buildCostCreditsTotal > 0, "Custom prototype ship should have paid with credits");
  assert.strictEqual(spawnedShip3.buildCostShipsTotal, 0, "Custom prototype ship should have paid 0 ships since credits were sufficient");

  console.log("All tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
