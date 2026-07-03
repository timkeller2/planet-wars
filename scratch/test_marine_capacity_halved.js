import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Marine Capacity Halving tests...");

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
  friendlyPlanet.maxShips = 1000;
  friendlyPlanet.ships = 800; // Keep it very high so we can load many marines

  // Spawn a cruiser with marine level = 1, maxHealth = 40
  const cruiser1 = new Ship('c_m1', friendlyPlanet.x + 10, friendlyPlanet.y + 10, null, player);
  cruiser1.isCruiser = true;
  cruiser1.maxHealth = 40;
  cruiser1.health = 40;
  cruiser1.marines = 1; 
  cruiser1.marineCount = 0;
  cruiser1.scoutAttackEnabled = true;
  cruiser1.inFriendlyWell = true;

  // Capacity should be ceil(1 * 40 / 2) + 5 = 25
  game.ships.push(cruiser1);
  for (let i = 0; i < 30; i++) {
    game.update(1000);
  }
  console.log(`Cruiser 1 (Level 1, maxHealth 40) loaded marines count: ${cruiser1.marineCount}`);
  assert.strictEqual(cruiser1.marineCount, 25, "Marine capacity for Level 1, maxHealth 40 should be exactly 25");

  // Spawn a cruiser with marine level = 1, maxHealth = 15
  const cruiser2 = new Ship('c_m2', friendlyPlanet.x + 10, friendlyPlanet.y + 10, null, player);
  cruiser2.isCruiser = true;
  cruiser2.maxHealth = 15;
  cruiser2.health = 15;
  cruiser2.marines = 1; 
  cruiser2.marineCount = 0;
  cruiser2.scoutAttackEnabled = true;
  cruiser2.inFriendlyWell = true;

  // Capacity should be ceil(1 * 15 / 2) + 5 = 13
  game.ships.push(cruiser2);
  for (let i = 0; i < 15; i++) {
    game.update(1000);
  }
  console.log(`Cruiser 2 (Level 1, maxHealth 15) loaded marines count: ${cruiser2.marineCount}`);
  assert.strictEqual(cruiser2.marineCount, 13, "Marine capacity for Level 1, maxHealth 15 should be exactly 13 (ceil(7.5) + 5)");

  console.log("All Marine Capacity Halving tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
