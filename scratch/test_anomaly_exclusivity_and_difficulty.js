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

// 3. Scattered anomalies at map creation verification
const testScatteredAnomalies = () => {
  console.log("\n--- Part 3: Scattered Anomalies at Map Creation ---");
  const game = new Game();
  // Set width to 1600 so we expect exactly 16 scattered anomalies
  game.width = 1600;
  game.height = 1600;
  game.settings = { planetCount: 10, aiCount: 0 };
  
  game.initMap();
  
  const deepSpaceAnomalies = game.planets.filter(p => p.isDeepSpaceAnomaly);
  console.log(`Scattered anomalies count: ${deepSpaceAnomalies.length} (expected 16)`);
  
  if (deepSpaceAnomalies.length !== 16) {
    console.error(`FAILED: Expected exactly 16 scattered anomalies, got ${deepSpaceAnomalies.length}`);
    process.exit(1);
  }
  
  for (const p of deepSpaceAnomalies) {
    if (p.radius !== 0 || p.ships !== 0 || p.maxShips !== 0) {
      console.error(`FAILED: Deep space anomaly planet has invalid radius/ships: radius=${p.radius}, ships=${p.ships}, maxShips=${p.maxShips}`);
      process.exit(1);
    }
    if (!p.anomaly || p.anomaly.difficulty < -10 || p.anomaly.difficulty > 100) {
      console.error(`FAILED: Anomaly difficulty out of range: ${p.anomaly ? p.anomaly.difficulty : 'none'}`);
      process.exit(1);
    }
    if (!p.anomaly.rewardType) {
      console.error("FAILED: Anomaly has no pre-generated rewardType");
      process.exit(1);
    }
  }
  
  console.log("-> Scattered anomalies map creation PASSED!");
};

// 4. Deep Space Anomaly Hab Reward nearest planet logic verification
const testDeepSpaceHabReward = () => {
  console.log("\n--- Part 4: Deep Space Anomaly Hab Reward Nearest Planet ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // Create two regular planets
  const planetFar = new Planet(1, 100, 100, 30, null, 10, 1600, 1200);
  planetFar.habitability = 50;
  const planetNear = new Planet(2, 500, 500, 30, null, 10, 1600, 1200);
  planetNear.habitability = 50;
  
  // Create a deep space anomaly close to planetNear
  const dsPlanet = new Planet(3, 510, 510, 0, null, 0, 1600, 1200);
  dsPlanet.isDeepSpaceAnomaly = true;
  dsPlanet.radius = 0;
  dsPlanet.maxShips = 0;
  dsPlanet.ships = 0;
  dsPlanet.anomaly = {
    id: 'ds_a',
    x: 510,
    y: 510,
    difficulty: 50,
    progress: 50,
    researched: false,
    beingResearched: false,
    rewardType: 'hab'
  };

  game.planets = [planetFar, planetNear, dsPlanet];

  // Trigger anomaly completion
  game.triggerAnomalyCompletion(dsPlanet, human);

  console.log(`Planet Near Hab: ${planetNear.habitability} (expected > 50)`);
  console.log(`Planet Far Hab: ${planetFar.habitability} (expected 50)`);

  if (planetNear.habitability <= 50) {
    console.error("FAILED: Planet near did not receive the hab reward!");
    process.exit(1);
  }
  if (planetFar.habitability !== 50) {
    console.error("FAILED: Planet far unexpectedly received the hab reward!");
    process.exit(1);
  }

  console.log("-> Deep Space Hab Reward nearest planet PASSED!");
};

testExclusivity();
testCompletionReward();
testScatteredAnomalies();
testDeepSpaceHabReward();
console.log("\nALL NEW TESTS PASSED SUCCESSFULLY!");
process.exit(0);
