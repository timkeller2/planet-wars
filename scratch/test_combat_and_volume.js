import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import assert from 'assert';

async function runTest() {
  console.log("Starting Combat and Armor Repair tests...");

  const player1 = new Player('p1', '#00e5ff', false);
  const player2 = new Player('p2', '#ff00e5', false);

  // 1. Check Cruiser Accuracy and shrug/deflection reduction
  const attacker = new Ship(1, 100, 100, null, player1, 500, 500);
  attacker.isCruiser = true;
  attacker.classType = 'destroyer';
  attacker.maxHealth = 30;
  attacker.health = 30;

  const defender = new Ship(2, 120, 120, null, player2, 500, 500);
  defender.isCruiser = true;
  defender.classType = 'destroyer';
  defender.maxHealth = 30;
  defender.health = 30;
  defender.bombs = 10; // Have bombs to ensure full shrug chance

  console.log("Attacker isCruiser:", attacker.isCruiser, "maxHealth:", attacker.maxHealth);
  console.log("Defender isCruiser:", defender.isCruiser, "maxHealth:", defender.maxHealth);

  const originalRandom = Math.random;

  try {
    // Test Case A: Without roll margin (shrugChance = 0.30)
    // Math.random returns 0.25, which is < 0.30 -> Shrugged off (no health damage)
    let randomVal = 0.25;
    Math.random = () => randomVal;

    const healthBeforeA = defender.health;
    defender.takeDamage(null, attacker, false, null, 0); // hitRollMadeBy = 0
    console.log(`Test Case A: healthBefore=${healthBeforeA}, healthAfter=${defender.health}`);
    assert.strictEqual(defender.health, healthBeforeA, "Damage should be shrugged off when random < shrugChance");

    // Test Case B: With roll margin = 0.45
    // Shrug chance should be reduced by 0.45 / 3 = 0.15 -> shrugChance = 0.30 - 0.15 = 0.15
    // Math.random returns 0.25, which is > 0.15 -> Not shrugged off (damage is applied)
    const healthBeforeB = defender.health;
    defender.takeDamage(null, attacker, false, null, 0.45); // hitRollMadeBy = 0.45
    console.log(`Test Case B: healthBefore=${healthBeforeB}, healthAfter=${defender.health}`);
    assert.ok(defender.health < healthBeforeB, "Damage should NOT be shrugged off because shrugChance was reduced");

    // Test Case C: Attacked by Amoeba (deflection halved)
    // Base deflection = 30 / 100 = 0.30. Since attacker is Amoeba, shrugChance = 0.15.
    // Math.random returns 0.20, which is > 0.15 -> Not shrugged off (damage is applied)
    const amoebaAttacker = new Ship(5, 100, 100, null, player1, 500, 500);
    amoebaAttacker.isAmoeba = true;
    
    defender.health = 30;
    randomVal = 0.20;
    defender.takeDamage(null, amoebaAttacker, false, null, 0);
    console.log(`Test Case C (Amoeba attack): healthBefore=30, healthAfter=${defender.health}`);
    assert.ok(defender.health < 30, "Damage should NOT be shrugged off because shrugChance was halved by Amoeba attack");

  } finally {
    Math.random = originalRandom;
  }

  // 2. Check Cruiser Armor Repair Supply Cost Multiplier (0.3)
  const repairShip = new Ship(3, 200, 200, null, player1, 500, 500);
  repairShip.isCruiser = true;
  repairShip.classType = 'destroyer';
  repairShip.maxHealth = 30;
  repairShip.health = 30;
  repairShip.maxArmor = 20;
  repairShip.armorPoints = 10; // Damaged armor

  // Initialize fuel, supplies, and bombs to max so they don't consume planet supplies
  repairShip.fuel = 100;
  repairShip.maxFuel = 100;
  repairShip.supplies = 100;
  repairShip.maxsupplies = 100;
  repairShip.bombs = 10;
  repairShip.maxbombs = 10;

  // Place planet right at repairShip's location
  const planet = new Planet(1, 200, 200, 50, player1, 0);
  planet.supplies = 100;

  // Run update for 20000ms (20 seconds), which heals (20000 / 60000) * 3 = 1.0 armor unit
  // Cost should be 1.0 * costMultiplier = 1.0 * 0.3 = 0.3 supplies.
  repairShip.update(20000, [repairShip], [], [planet], [], [], 1920, null);

  console.log(`Repaired ship armor: ${repairShip.armorPoints}, Planet supplies remaining: ${planet.supplies}`);
  assert.strictEqual(repairShip.armorPoints, 11, "Armor should heal by exactly 1.0 point");
  assert.ok(Math.abs(planet.supplies - 99.7) < 0.0001, `Planet supplies should be 99.7, got ${planet.supplies}`);

  console.log("All Combat and Armor Repair tests passed successfully!");

  // 3. Check Anomaly Difficulty range low-end floor & halving
  console.log("Starting Anomaly difficulty floor and halving tests...");
  const { Game } = await import('../src/game.js');
  const game = new Game();
  game.gameStartTime = Date.now() - 3600000; // 1 hour ago
  game.settings = { timedGameLimit: 'unlimited' };
  
  // Test basic floor
  for (let i = 0; i < 100; i++) {
    game.spawnNewDeepSpaceAnomaly(100, 100, player1, 'test-ship');
    const spawned = game.planets[game.planets.length - 1];
    assert.ok(spawned.anomaly.difficulty >= 1, `Anomaly difficulty should be >= 1, got ${spawned.anomaly.difficulty}`);
  }

  // Test exact halving using mocked Math.random() = 0.5
  const origRandom = Math.random;
  try {
    Math.random = () => 0.5;
    game.spawnNewDeepSpaceAnomaly(100, 100, player1, 'test-ship');
    const spawned = game.planets[game.planets.length - 1];
    // Expected: maxDiff=100, minDiff=1. Math.pow(0.5, 2) * 100 = 25. Floor(25)+1 = 26. Halved: 26/2 = 13.
    assert.strictEqual(spawned.anomaly.difficulty, 13, `Halved anomaly difficulty with rand=0.5 should be 13, got ${spawned.anomaly.difficulty}`);
  } finally {
    Math.random = origRandom;
  }
  console.log("Anomaly difficulty floor and halving tests passed successfully!");

  // 4. Check Anomaly research triple rate threshold multiplier (*1 instead of *3)
  console.log("Starting Anomaly research rate threshold tests...");
  const testPlanet = new Planet(50, 100, 100, 50, null, 0);
  testPlanet.anomaly = {
    id: 'anom_test',
    x: 100,
    y: 100,
    difficulty: 10,
    progress: {},
    researched: false,
    beingResearched: false,
    rewardType: 'credits'
  };

  const researchShip = new Ship(4, 100, 100, null, player1, 500, 500);
  researchShip.isCruiser = true;
  researchShip.classType = 'destroyer';
  researchShip.labs = 5;
  researchShip.expScore = 0;
  player1.techScore = 0;
  player1.expScore = 0;
  
  // threshold = (5 + 0 + 0 + 0) * 1 = 5.
  // Case A: progress = 4. diff - progress = 10 - 4 = 6 >= 5 -> rateMultiplier = 1.
  testPlanet.anomaly.progress[player1.id] = 4;
  researchShip.accumulatedTech = 0;
  game.researchAnomaly(testPlanet, researchShip, 120000); // 120000ms delta
  // knowledgeGained = (5 * 120000 * 1 * 1) / 120000 = 5. completions = 5. progress should be 4 + 5 = 9.
  assert.strictEqual(testPlanet.anomaly.progress[player1.id], 9, `Expected progress to be 9 (multiplier 1), got ${testPlanet.anomaly.progress[player1.id]}`);

  // Case B: progress = 6. diff - progress = 10 - 6 = 4 < 5 -> rateMultiplier = 3.
  testPlanet.anomaly.progress[player1.id] = 6;
  researchShip.expScore = 0;
  researchShip.accumulatedTech = 0;
  game.researchAnomaly(testPlanet, researchShip, 120000); // 120000ms delta
  // knowledgeGained = (5 * 120000 * 1 * 3) / 120000 = 15. completions = 15. progress should be 6 + 15 = 21.
  assert.strictEqual(testPlanet.anomaly.progress[player1.id], 21, `Expected progress to be 21 (multiplier 3), got ${testPlanet.anomaly.progress[player1.id]}`);

  console.log("Anomaly research rate threshold tests passed successfully!");
}

runTest();
