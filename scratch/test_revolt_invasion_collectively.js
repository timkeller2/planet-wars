import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Revolt Group Marine Invasion tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  const planet = game.planets[0];
  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  
  // Set up planet in revolt
  planet.inRevolt = true;
  planet.revoltTimer = 5000; // <= 7500
  planet.ships = 100; // 50% threshold is 50 marines
  planet.x = 800;
  planet.y = 800;

  // Clear any existing ships in the game
  game.ships = [];

  // Spawn 3 friendly cruisers within the planet's gravity radius
  // Gravity radius = p.getGravityRadius(), usually 150px
  const gr = planet.getGravityRadius();
  console.log(`Planet gravity radius: ${gr}`);

  const cruiser1 = new Ship('cr1', planet.x + 30, planet.y + 30, null, player);
  cruiser1.isCruiser = true;
  cruiser1.maxHealth = 40;
  cruiser1.health = 40;
  cruiser1.scoutAttackEnabled = true;
  cruiser1.marineCount = 20;

  const cruiser2 = new Ship('cr2', planet.x - 30, planet.y - 30, null, player);
  cruiser2.isCruiser = true;
  cruiser2.maxHealth = 40;
  cruiser2.health = 40;
  cruiser2.scoutAttackEnabled = true;
  cruiser2.marineCount = 20;

  const cruiser3 = new Ship('cr3', planet.x + 40, planet.y - 40, null, player);
  cruiser3.isCruiser = true;
  cruiser3.maxHealth = 40;
  cruiser3.health = 40;
  cruiser3.scoutAttackEnabled = true;
  cruiser3.marineCount = 20;

  game.ships.push(cruiser1, cruiser2, cruiser3);

  // Mock queueMarineLaunch to count launches
  let launchCalls = [];
  game.queueMarineLaunch = (ship, order) => {
    launchCalls.push({ shipId: ship.id, order });
  };

  // Run updateCustomCruiserSystems (with running = true)
  game.isRunning = true;
  game.updateCustomCruiserSystems(100); // 100ms delta

  console.log(`Number of launch calls: ${launchCalls.length}`);
  assert.strictEqual(launchCalls.length, 3, "All 3 cruisers should have launched their marines");
  
  // Verify that all 3 cruisers launched their marines and set cooldown
  assert.strictEqual(cruiser1.marineCount, 0, "cruiser1 marineCount should be 0");
  assert.strictEqual(cruiser1.marineLaunchCooldown, 15.0, "cruiser1 cooldown should be 15.0");

  assert.strictEqual(cruiser2.marineCount, 0, "cruiser2 marineCount should be 0");
  assert.strictEqual(cruiser2.marineLaunchCooldown, 15.0, "cruiser2 cooldown should be 15.0");

  assert.strictEqual(cruiser3.marineCount, 0, "cruiser3 marineCount should be 0");
  assert.strictEqual(cruiser3.marineLaunchCooldown, 15.0, "cruiser3 cooldown should be 15.0");

  console.log("All Revolt Group Marine Invasion tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
