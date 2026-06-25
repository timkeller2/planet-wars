import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Research Planet Soft-Capped Modifier tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  const planet = game.planets[0];
  const player1 = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];

  game.planets = [planet];
  game.pendingAIs = [];
  game.aiControllers = [];

  planet.owner = player1;
  planet.focusMode = 'research';
  planet.maxShips = 50; // Ensure that isFull is always true when ships >= 100

  // Override Math.random to guarantee that the success check passes
  const originalRandom = Math.random;
  Math.random = () => 0; // 0% roll is always <= success check (Math.random() * 100 >= failChance)

  try {
    // --- Test Case 1: Planet has exactly 100 ships (100% cap limit) on a Regular Planet ---
    console.log("\nRunning Test Case 1: 100 ships, regular planet...");
    planet.ships = 100;
    player1.techScore = 0;
    planet.isResearch = false;
    planet.capacityProgress = 0;

    planet.update(10000, game.planets, game.settings, game);

    // Expected multiplier: 1.0. Tech points: base (1) * 1.0 = 1.0
    assert.ok(Math.abs(player1.techScore - 1.0) < 0.0001, `Expected techScore to be 1.0, got ${player1.techScore}`);
    console.log(`Test Case 1 Passed! Gained: ${player1.techScore} Tech Points`);

    // --- Test Case 2: Planet has 250 ships (above cap limit) on a Science Planet ---
    console.log("\nRunning Test Case 2: 250 ships, science planet...");
    planet.ships = 250;
    player1.techScore = 0;
    planet.isResearch = true;
    planet.capacityProgress = 0;

    planet.update(10000, game.planets, game.settings, game);

    // Expected multiplier: 1.0 + (2.5 - 1.0) / 3 = 1.5. Tech points: base (2) * 1.5 = 3.0
    assert.ok(Math.abs(player1.techScore - 3.0) < 0.0001, `Expected techScore to be 3.0, got ${player1.techScore}`);
    console.log(`Test Case 2 Passed! Gained: ${player1.techScore} Tech Points`);

    // --- Test Case 3: Planet has 400 ships (above cap limit) on a Regular Planet ---
    console.log("\nRunning Test Case 3: 400 ships, regular planet...");
    planet.ships = 400;
    player1.techScore = 0;
    planet.isResearch = false;
    planet.capacityProgress = 0;

    planet.update(10000, game.planets, game.settings, game);

    // Expected multiplier: 1.0 + (4.0 - 1.0) / 3 = 2.0. Tech points: base (1) * 2.0 = 2.0
    assert.ok(Math.abs(player1.techScore - 2.0) < 0.0001, `Expected techScore to be 2.0, got ${player1.techScore}`);
    console.log(`Test Case 3 Passed! Gained: ${player1.techScore} Tech Points`);

  } finally {
    // Restore original Math.random
    Math.random = originalRandom;
  }

  console.log("\nAll Research Planet Soft-Capped Modifier tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
