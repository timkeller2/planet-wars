import { Game } from '../src/game.js';
import { Planet } from '../src/entities/Planet.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Anomaly Habitability Reward Skip tests...");

  // Mock Math.random to be deterministic (returns 0.5)
  // This results in:
  // factor = 1.0 + 0.5 = 1.5
  // difficulty = 10 -> baseVal = 70
  // creditsValueEquivalent = 70 * 1.5 = 105
  // habReward = Math.round(105 / 5) = 21
  const originalRandom = Math.random;
  Math.random = () => 0.5;

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  
  // Clear map so we can set up exactly what we need
  game.planets = [];
  game.ships = [];

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];

  // Test 1: Jungle -> Ocean transition (crosses 80, should skip to 100 + remainder)
  {
    console.log("Testing Jungle -> Ocean skip (79 + 21)...");
    const planet = new Planet('p_test1', 200, 200, 30, player);
    planet.habitability = 79; // Jungle
    planet.anomaly = {
      difficulty: 10,
      rewardType: 'hab'
    };
    game.planets.push(planet);

    game.triggerAnomalyCompletion(planet, player);
    console.log("Resulting habitability:", planet.habitability);
    assert.strictEqual(planet.habitability, 120, "Should be 120 (79 -> 80 skips to 100, + 20 remaining)");
  }

  // Test 2: Desert -> Tundra transition (crosses 50, should skip to 90 + remainder)
  {
    console.log("Testing Desert -> Tundra skip (49 + 21)...");
    game.planets = [];
    const planet = new Planet('p_test2', 200, 200, 30, player);
    planet.habitability = 49; // Desert
    planet.anomaly = {
      difficulty: 10,
      rewardType: 'hab'
    };
    game.planets.push(planet);

    game.triggerAnomalyCompletion(planet, player);
    console.log("Resulting habitability:", planet.habitability);
    assert.strictEqual(planet.habitability, 110, "Should be 110 (49 -> 50 skips to 90, + 20 remaining)");
  }

  // Test 3: Ocean -> Arid transition (crosses 90, should skip to 100 + remainder)
  {
    console.log("Testing Ocean -> Arid skip (89 + 21)...");
    game.planets = [];
    const planet = new Planet('p_test3', 200, 200, 30, player);
    planet.habitability = 89; // Ocean
    planet.anomaly = {
      difficulty: 10,
      rewardType: 'hab'
    };
    game.planets.push(planet);

    game.triggerAnomalyCompletion(planet, player);
    console.log("Resulting habitability:", planet.habitability);
    assert.strictEqual(planet.habitability, 120, "Should be 120 (89 -> 90 skips to 100, + 20 remaining)");
  }

  // Restore Math.random
  Math.random = originalRandom;

  console.log("All Anomaly Habitability Reward Skip tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
