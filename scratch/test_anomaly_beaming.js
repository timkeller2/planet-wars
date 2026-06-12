// Test anomaly beaming / completion delay logic
import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Anomaly Beaming / Completion Delay ===");

// Scenario 1: Anomaly with difficulty <= 0 (free anomaly)
{
  console.log("\n--- Scenario 1: Difficulty <= 0 Anomaly ---");
  const game = new Game({ width: 2000, height: 2000 });
  const human = new Player('human', '#0ff', false);
  human.id = 'human';
  game.allPlayers = [human];

  const planet = new Planet(1, 500, 500, 30, null, 100);
  planet.anomaly = {
    id: 'a1',
    x: 500,
    y: 500,
    difficulty: 0,
    progress: 0,
    researched: false,
    beingResearched: false,
    rewardType: 'credits'
  };
  game.planets = [planet];

  const ship = new Ship('c1', 500, 500, null, human);
  ship.isCruiser = true;
  ship.labs = 2;
  ship.cruiserRadarRange = () => 150;
  ship.update = () => {};
  game.ships.push(ship);

  // 1. Tick 1 (50ms): Should trigger completing state but NOT complete yet.
  game.update(50);
  console.log("Completing:", planet.anomaly.completing);
  console.log("Completing Time Left:", planet.anomaly.completingTimeLeft);
  console.log("Researched:", planet.anomaly.researched);
  assert(planet.anomaly.completing === true, "Should be in completing state");
  assert(planet.anomaly.completingTimeLeft === 3000, "Should start with 3000ms left");
  assert(planet.anomaly.researched === false, "Should not be completed immediately");

  // 2. Tick 2 (1000ms): Timer should count down to 2000ms.
  game.update(1000);
  console.log("Completing Time Left after 1000ms:", planet.anomaly.completingTimeLeft);
  assert(planet.anomaly.completingTimeLeft === 2000, "Should have 2000ms left");
  assert(planet.anomaly.researched === false, "Should still not be completed");

  // 3. Tick 3 (2000ms): Should complete.
  game.update(2000);
  console.log("Completing after 3000ms total:", planet.anomaly.completing);
  console.log("Researched after 3000ms total:", planet.anomaly.researched);
  assert(planet.anomaly.completing === false, "Should not be completing anymore");
  assert(planet.anomaly.researched === true, "Should be fully completed/researched");
}

// Scenario 2: Anomaly with difficulty > 0 (requires labs)
{
  console.log("\n--- Scenario 2: Difficulty > 0 Anomaly ---");
  const game = new Game({ width: 2000, height: 2000 });
  const human = new Player('human', '#0ff', false);
  human.id = 'human';
  game.allPlayers = [human];

  const planet = new Planet(1, 500, 500, 30, null, 100);
  planet.anomaly = {
    id: 'a2',
    x: 500,
    y: 500,
    difficulty: 5,
    progress: 0,
    researched: false,
    beingResearched: false,
    rewardType: 'credits'
  };
  game.planets = [planet];

  const ship = new Ship('c1', 500, 500, null, human);
  ship.isCruiser = true;
  ship.labs = 100; // high labs to make research progress very fast
  ship.cruiserRadarRange = () => 150;
  ship.update = () => {};
  game.ships.push(ship);

  // 1. Tick 1 (12000ms): 100 * 12000 / 120000 = 10 completions, progress reaches difficulty (5)
  // Should trigger completing state but NOT complete yet.
  game.update(12000);
  console.log("Progress:", planet.anomaly.progress);
  console.log("Completing:", planet.anomaly.completing);
  console.log("Completing Time Left:", planet.anomaly.completingTimeLeft);
  console.log("Researched:", planet.anomaly.researched);
  assert(planet.anomaly.progress >= 5, "Progress should be >= 5");
  assert(planet.anomaly.completing === true, "Should be in completing state");
  assert(planet.anomaly.completingTimeLeft === 3000, "Should start with 3000ms left");
  assert(planet.anomaly.researched === false, "Should not be completed immediately");

  // 2. Tick 2 (1000ms): Timer counts down
  game.update(1000);
  assert(planet.anomaly.completingTimeLeft === 2000, "Should have 2000ms left");
  assert(planet.anomaly.researched === false, "Should still not be completed");

  // 3. Tick 3 (2000ms): Timer finishes, completes!
  game.update(2000);
  assert(planet.anomaly.completing === false, "Should not be completing anymore");
  assert(planet.anomaly.researched === true, "Should be fully completed/researched");
}

console.log("\nAll anomaly beaming/completion delay tests passed successfully!");
process.exit(0);
