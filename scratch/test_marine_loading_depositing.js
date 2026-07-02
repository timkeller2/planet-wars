import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Marine Loading/Depositing tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  game.isRunning = true;

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  player.techScore = 0;
  player.expScore = 0;

  // Set up a friendly planet manually
  const friendlyPlanet = game.planets[0];
  friendlyPlanet.owner = player;
  assert.ok(friendlyPlanet, "Must have a friendly planet for testing");

  // Configure friendly planet
  friendlyPlanet.maxShips = 100;
  friendlyPlanet.ships = 80; // Above 50% capacity, so we can load from it

  // Spawn a cruiser with marine capacity
  const cruiser = new Ship('c_marine_test', friendlyPlanet.x + 10, friendlyPlanet.y + 10, null, player);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;
  cruiser.fuel = cruiser.getMaxFuel();
  cruiser.marines = 2; // Capacity is 2 * 40 = 80 marines
  cruiser.marineCount = 0;
  cruiser.scoutAttackEnabled = false; // Scout attack mode disabled initially
  cruiser.inFriendlyWell = true;

  game.ships.push(cruiser);

  // Run update loop with scoutAttackEnabled = false. It should NOT load marines.
  console.log("Testing: Should NOT load marines if scoutAttackEnabled is false...");
  game.update(1000); // 1 second update
  console.log(`Cruiser marineCount: ${cruiser.marineCount}, Planet ships: ${friendlyPlanet.ships}`);
  assert.strictEqual(cruiser.marineCount, 0, "Marines should not be loaded when scout attack mode is disabled");

  // Enable Scout Attack Mode. It should load marines.
  console.log("Testing: Should load marines if scoutAttackEnabled is true...");
  cruiser.scoutAttackEnabled = true;
  console.log(`Before update: inFriendlyWell = ${cruiser.inFriendlyWell}, dist = ${Math.sqrt(Math.pow(friendlyPlanet.x - cruiser.x, 2) + Math.pow(friendlyPlanet.y - cruiser.y, 2))}, gravityRadius = ${friendlyPlanet.getGravityRadius()}`);
  game.update(1000); // 1 second update
  console.log(`After update: inFriendlyWell = ${cruiser.inFriendlyWell}, marineCount = ${cruiser.marineCount}, Planet ships = ${friendlyPlanet.ships}`);
  assert.ok(cruiser.marineCount > 0, "Marines should be loaded when scout attack mode is enabled");
  const loadedMarines = cruiser.marineCount;

  // Disable Scout Attack Mode, and verify depositing works even with targetPlanet = null.
  console.log("Testing: Should deposit marines to friendly planet if scoutAttackEnabled is false...");
  cruiser.scoutAttackEnabled = false;
  cruiser.targetPlanet = null; // Test the bug condition where target is null but cruiser is in gravity well

  // Let's set planet ships to 95, so there is room for 5 ships (planet capacity 100)
  friendlyPlanet.ships = 95;
  const initialPlanetShips = friendlyPlanet.ships;
  const initialCruiserMarines = cruiser.marineCount;

  game.update(1000); // 1 second update
  console.log(`Cruiser marineCount: ${cruiser.marineCount}, Planet ships: ${friendlyPlanet.ships}`);
  assert.ok(cruiser.marineCount < initialCruiserMarines, "Cruiser marines should have decreased");
  assert.ok(friendlyPlanet.ships > initialPlanetShips, "Planet ships should have increased");
  assert.ok(friendlyPlanet.ships <= friendlyPlanet.maxShips, "Planet ships should not exceed maxShips");

  console.log("All Marine Loading/Depositing tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
