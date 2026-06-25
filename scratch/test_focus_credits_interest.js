import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Focus Credits & Halved Interest tests...");

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
  planet.ships = 0;
  player.totalShips = 0;

  // 2. Verify interest rate is 2.5% (0.025)
  player.credits = -100;
  game.update(60000); // 1 minute
  
  const expectedCredits = -100 - (100 * 0.025);
  // Allow for slight floating point variations
  assert.ok(Math.abs(player.credits - expectedCredits) < 0.1, `Expected credits around ${expectedCredits}, got ${player.credits}`);
  console.log("Interest rate test passed! Charged: ", player.credits - (-100));

  // --- Test Case 1: Pay 100% with credits down to debt limit ---
  console.log("\nRunning Test Case 1: Pay 100% with credits...");
  player.totalShips = 100;
  planet.homeworldOf = player.id;
  planet.ships = 20;
  planet.maxShips = 100; // cost = 50
  planet.productionProgress = -999999; // Disable production growth

  player.credits = -80; // minAllowedCredits = -1100, available = 1020

  let minAllowedCredits = -(1000 + Math.floor(player.totalShips || 0));
  let creditsAvailable = Math.max(0, (player.credits || 0) - minAllowedCredits);
  let cost = Math.floor(planet.maxShips / 2);

  assert.ok(creditsAvailable >= cost, `Credits available ${creditsAvailable} should be >= cost ${cost}`);

  planet.focusTransition = {
    targetMode: 'research',
    totalCost: cost,
    costRemaining: cost,
    elapsed: 0,
    playerId: player.id
  };

  let initialShips = planet.ships;
  let initialCredits = player.credits;

  for (let i = 0; i < 15; i++) {
    game.update(1000);
  }

  console.log(`Test Case 1 Final Credits: ${player.credits}`);
  console.log(`Test Case 1 Final Ships: ${planet.ships}`);
  console.log(`Test Case 1 Final Focus Mode: ${planet.focusMode}`);

  let actualCreditsReduction = initialCredits - player.credits;
  assert.ok(actualCreditsReduction >= 50, "Credits reduction should be at least 50");
  assert.ok(actualCreditsReduction < 55, "Credits reduction should be close to 50");
  assert.strictEqual(planet.ships, initialShips, "No ships should have been consumed");
  assert.strictEqual(planet.focusMode, 'research', "Focus mode should have transitioned to research");
  console.log("Test Case 1 passed!");

  // --- Test Case 2: Pay with a mix of credits and ships (credits capped at debt limit) ---
  console.log("\nRunning Test Case 2: Pay with mix of credits and ships...");
  planet.focusTransition = null;
  planet.focusMode = 'research';
  planet.ships = 40;
  planet.productionProgress = -999999; // Disable production growth

  player.credits = -1030; // minAllowedCredits = -1040 (since ships = 40), available = 10
  initialCredits = player.credits;
  initialShips = planet.ships;

  cost = Math.floor(planet.maxShips / 2); // 50

  planet.focusTransition = {
    targetMode: 'economy',
    totalCost: cost,
    costRemaining: cost,
    elapsed: 0,
    playerId: player.id
  };

  for (let i = 0; i < 15; i++) {
    game.update(1000);
  }

  console.log(`Test Case 2 Final Credits: ${player.credits}`);
  console.log(`Test Case 2 Final Ships: ${planet.ships}`);
  console.log(`Test Case 2 Final Focus Mode: ${planet.focusMode}`);

  // Expected: credits pays 10 (bringing it to -1040), remaining 40 paid in ships
  // Since interest is active, final credits will be slightly below -1040
  assert.ok(player.credits <= -1040, "Credits should have hit the debt limit");
  assert.strictEqual(planet.ships, initialShips - 40, "40 ships should have been consumed");
  assert.strictEqual(planet.focusMode, 'economy', "Focus mode should have transitioned to economy");
  console.log("Test Case 2 passed!");

  console.log("\nAll Focus Credits & Halved Interest tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
