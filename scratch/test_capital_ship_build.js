import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Capital Ship Build and Duration tests under new build requirement...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  const planet = game.planets[0];
  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];

  game.planets = [planet];
  game.allPlayers = [player];
  game.pendingAIs = [];
  game.aiControllers = [];

  planet.owner = player;
  planet.ships = 500;
  planet.maxShips = 500;
  player.totalShips = 500;
  player.credits = 1000;

  // Mark prev classes as built so Destroyer/Battlecruiser unlock requirements are met
  player.builtClasses = {
    corvette: true,
    destroyer: true,
    battlecruiser: true,
    titan: true,
    mammoth: true
  };

  // Test Case A: Second cruiser of the same class (isFirst = false) uses credits first
  console.log("Test Case A: Checking credits usage for subsequent builds...");
  
  // Set isFirst = false for battlecruiser
  player.builtClasses['battlecruiser'] = true;
  player.credits = 500; // Above debt limit
  
  // Clear any existing ships
  game.ships = [];
  
  // Trigger build (Battlecruiser costs 175 ships)
  planet.ships = 500;
  planet.maxShips = 500;
  game.buildCapitalShip(planet, 'battlecruiser');
  
  assert.strictEqual(game.ships.length, 1, "A capital ship should have spawned");
  const spawnedShip = game.ships[0];
  
  console.log(`Spawned ship buildCostCreditsTotal: ${spawnedShip.buildCostCreditsTotal}`);
  console.log(`Spawned ship buildCostShipsTotal: ${spawnedShip.buildCostShipsTotal}`);
  
  assert.ok(spawnedShip.buildCostCreditsTotal > 0, "Should have paid with credits because they were available");
  assert.strictEqual(spawnedShip.buildCostShipsTotal, 0, "Should not pay any ships since credits covered it completely");

  // Test Case B: Build time/duration scaled by ships% (lower ships ratio means longer to build)
  console.log("Test Case B: Checking build duration scaling by planet ships percentage...");
  
  // Reset game ships
  game.ships = [];
  
  // B1: High ships percentage (100% capacity)
  planet.ships = 1000;
  planet.maxShips = 1000;
  game.buildCapitalShip(planet, 'battlecruiser');
  const shipAt100 = game.ships[0];
  
  // B2: Low ships percentage (approx 10% capacity)
  game.ships = [];
  planet.ships = 400; // meets double requirement of 350
  planet.maxShips = 4000;
  game.buildCapitalShip(planet, 'battlecruiser');
  const shipAt10 = game.ships[0];
  
  // Expected values:
  // B1: finalMaxHealth = 39. baseDuration = 19.5. shipPct = 1000/993 = 1.0 (clamped). Duration = 19.5s.
  // B2: finalMaxHealth = 39 (extraShips = 400, so bonusHp = 4). baseDuration = 19.5. shipPct = 400/3993 = 0.100175. Duration = 19.5 / 0.100175 = 194.66s.
  
  console.log(`Duration at 100% ships capacity: ${shipAt100.materializeDuration}s (Expected: 19.5s)`);
  console.log(`Duration at 10% ships capacity: ${shipAt10.materializeDuration}s (Expected: ~194.66s)`);
  
  assert.ok(Math.abs(shipAt100.materializeDuration - 19.5) < 0.1, "Duration at 100% capacity should be 19.5s");
  assert.ok(Math.abs(shipAt10.materializeDuration - 194.66) < 0.2, "Duration at ~10% capacity should be ~194.66s");
  
  console.log("All Capital Ship Build and Duration tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
