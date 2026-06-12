import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

console.log("=== Testing Anomaly Research Exclusivity and Difficulty Scaling ===");

// 1. Exclusivity Verification
const testExclusivity = () => {
  console.log("\n--- Part 1: Research Exclusivity ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // Spawn an anomaly
  const planet = new Planet(1, 500, 500, 30, null, 100, 1600, 1200);
  planet.anomaly = {
    id: 'a1',
    x: 500,
    y: 500,
    difficulty: 50,
    progress: 0,
    researched: false,
    beingResearched: false,
    rewardType: 'credits'
  };
  game.planets = [planet];

  // Spawn two cruiser research ships at the anomaly
  const ship1 = new Ship('c1', 500, 500, null, human);
  ship1.isCruiser = true;
  ship1.labs = 2;
  ship1.cruiserRadarRange = () => 150;
  ship1.update = () => {};
  game.ships.push(ship1);

  const ship2 = new Ship('c2', 500, 500, null, human);
  ship2.isCruiser = true;
  ship2.labs = 2;
  ship2.cruiserRadarRange = () => 150;
  ship2.update = () => {};
  game.ships.push(ship2);

  // Run a single update cycle (30000ms)
  game.update(30000);

  // Assert only one ship is actively researching and accumulating progress
  console.log(`Ship 1 actively researching: ${ship1.isActivelyResearching}`);
  console.log(`Ship 2 actively researching: ${ship2.isActivelyResearching}`);
  
  if (ship1.isActivelyResearching && ship2.isActivelyResearching) {
    console.error("FAILED: Both ships are researching the anomaly simultaneously!");
    process.exit(1);
  }
  
  if (!ship1.isActivelyResearching && !ship2.isActivelyResearching) {
    console.error("FAILED: Neither ship is researching the anomaly!");
    process.exit(1);
  }

  console.log("-> Exclusivity logic PASSED!");
};

// 2. Anomaly Completion with pre-generated rewardType
const testCompletionReward = () => {
  console.log("\n--- Part 2: Pre-generated Reward Completion ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  human.credits = 100;
  human.techScore = 0;
  game.allPlayers = [human];

  const planet = new Planet(1, 500, 500, 30, null, 100, 1600, 1200);
  planet.anomaly = {
    id: 'a1',
    x: 500,
    y: 500,
    difficulty: 5,
    progress: 5,
    researched: false,
    beingResearched: false,
    rewardType: 'credits' // We force credits
  };
  game.planets = [planet];

  // Complete anomaly
  game.triggerAnomalyCompletion(planet, human);

  console.log(`Player credits after completion: ${human.credits} (expected > 100)`);
  if (human.credits <= 100) {
    console.error("FAILED: Credits reward was not granted based on the pre-generated rewardType!");
    process.exit(1);
  }

  console.log("-> Pre-generated reward completion PASSED!");
};

testExclusivity();
testCompletionReward();
console.log("\nALL NEW TESTS PASSED SUCCESSFULLY!");
process.exit(0);
