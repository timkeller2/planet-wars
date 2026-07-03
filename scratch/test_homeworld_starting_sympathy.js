import { Game } from '../src/game.js';
import { Planet } from '../src/entities/Planet.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Homeworld Starting Sympathy tests...");

  // 1. Initialize Game
  const game = new Game({ width: 2000, height: 2000 });
  game.isRunning = true;

  const player1 = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];

  // 2. Test initial homeworld assignment sympathy
  console.log("Phase 1: Testing initial homeworld assignment...");
  game.assignPlanet(player1);

  const homeworld = game.planets.find(p => p.homeworldOf === player1.id);
  assert.ok(homeworld, "Homeworld should have been created");
  assert.ok(homeworld.sympathy, "Sympathy dictionary should exist");
  assert.strictEqual(homeworld.sympathy[player1.id], homeworld.maxShips, `Sympathy should equal planet's maxShips (${homeworld.maxShips})`);
  console.log("Phase 1 Passed.");

  // 3. Test focus transition to homeworld sympathy
  console.log("Phase 2: Testing homeworld focus transition completion...");
  const newPlanet = new Planet(999, 1200, 1200, 25, player1, 10, 2000, 2000);
  newPlanet.sizeClass = 120;
  newPlanet.maxShips = 100;
  game.planets.push(newPlanet);

  // Set up the focus transition to homeworld
  newPlanet.focusTransition = {
    targetMode: 'homeworld',
    totalCost: 10,
    costRemaining: 0,
    elapsed: 15000, // fully elapsed
    playerId: player1.id
  };

  // Run update to trigger transition completion
  newPlanet.update(0.1, game.settings, game.ships, game.planets);

  assert.strictEqual(newPlanet.focusMode, 'homeworld', "Planet focus should have transitioned to homeworld");
  assert.strictEqual(newPlanet.homeworldOf, player1.id, "Planet should have become player1's homeworld");
  assert.strictEqual(newPlanet.sympathy[player1.id], newPlanet.maxShips, `New homeworld sympathy should equal planet's maxShips (${newPlanet.maxShips})`);
  console.log("Phase 2 Passed.");

  console.log("All Homeworld Starting Sympathy tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
