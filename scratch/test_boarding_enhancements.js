import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Boarding Actions and Cooldowns test...");

  // Initialize Game
  const game = new Game({ width: 2000, height: 2000 });
  game.isRunning = true; // MUST set to true so systems update
  game.planets = []; // Clear planets for isolation

  // Players
  const player1 = game.allPlayers[0];
  const player2 = game.allPlayers[1];

  // 1. Test Direct Boarding Trigger and Cooldown setup
  console.log("Phase 1: Test Direct Boarding Trigger & Cooldown Initial Value");
  
  // Defender cruiser
  const defender = new Ship('c_def', 1000, 1000, null, player1);
  defender.isCruiser = true;
  defender.maxHealth = 40;
  defender.health = 1; // Disabled
  defender.marineCount = 5;
  defender.crew = 5;

  // Attacker cruiser
  const attacker = new Ship('c_atk', 1020, 1000, null, player2);
  attacker.isCruiser = true;
  attacker.maxHealth = 40;
  attacker.health = 40;
  attacker.marineCount = 10;
  attacker.scoutAttackEnabled = true;

  game.ships = [defender, attacker];

  // Run game update step (this handles cruiser systems)
  const dt = 1.0; // 1 second
  game.updateCustomCruiserSystems(dt);

  // Assertions
  assert.strictEqual(defender.isUnderBoarding, true, "Defender should be under boarding");
  assert.strictEqual(defender.boardingCooldown, 60.0, "Boarding cooldown should be set to 60.0 seconds");
  assert.strictEqual(defender.boardingTimer, 4.0, "Boarding timer should start at 5.0 seconds and decrement to 4.0 in first update frame");
  assert.strictEqual(defender.boardingSourceId, 'c_atk', "Boarding source ship ID should be c_atk");
  assert.deepStrictEqual(defender.boardingSourceContributions, [{ shipId: 'c_atk', contributed: 10 }], "Boarding contributions should be recorded");

  console.log("Phase 1 Passed.");

  // 2. Test Cooldown Decrement
  console.log("Phase 2: Test Cooldown Decrement over updates");
  game.updateCustomCruiserSystems(dt);
  assert.strictEqual(defender.boardingCooldown, 59.0, "Boarding cooldown should decrement by dt");

  // Let's manually expire boarding combat
  defender.isUnderBoarding = false;
  defender.boardingTimer = 0;
  defender.boardingCooldown = 30.0; // 30 seconds remaining

  console.log("Phase 2 Passed.");

  // 3. Test Boarding Trigger Blocked by Cooldown
  console.log("Phase 3: Test boarding trigger is blocked while cooldown is active");
  
  // Try triggering direct boarding again (defender health remains 1, attacker still has marines)
  attacker.marineCount = 10; // Reset attacker marines
  game.updateCustomCruiserSystems(dt);

  assert.ok(!defender.isUnderBoarding, "Defender should NOT start boarding while cooldown is active");
  assert.strictEqual(defender.boardingCooldown, 29.0, "Boarding cooldown should still decrement correctly");

  console.log("Phase 3 Passed.");

  // 4. Test Marine Fleet Impact on Cooldown vs No Cooldown
  console.log("Phase 4: Test Marine Fleet Collision behavior");

  // Case A: Target cruiser on cooldown
  const targetOnCooldown = new Ship('c_tgt_cd', 1500, 1500, null, player1);
  targetOnCooldown.isCruiser = true;
  targetOnCooldown.boardingCooldown = 15.0;

  const marineFleet1 = new Ship('m_pod_1', 1490, 1500, null, player2);
  marineFleet1.isMarineFleet = true;
  marineFleet1.targetShipId = 'c_tgt_cd';
  marineFleet1.count = 5;

  game.ships = [targetOnCooldown, marineFleet1];

  // Perform movement / collision step
  marineFleet1.update(1000, game.ships, [], [], [], [], 2000, game);

  assert.strictEqual(marineFleet1.active, false, "Marine fleet should be consumed on collision");
  assert.ok(!targetOnCooldown.isUnderBoarding, "Boarding should NOT trigger when target is on cooldown");
  assert.strictEqual(targetOnCooldown.boardingCooldown, 15.0, "Cooldown should remain unchanged");

  // Case B: Target cruiser NOT on cooldown
  const targetNoCooldown = new Ship('c_tgt_no_cd', 1500, 1500, null, player1);
  targetNoCooldown.isCruiser = true;

  const marineFleet2 = new Ship('m_pod_2', 1490, 1500, null, player2);
  marineFleet2.isMarineFleet = true;
  marineFleet2.targetShipId = 'c_tgt_no_cd';
  marineFleet2.count = 5;

  game.ships = [targetNoCooldown, marineFleet2];

  // Perform movement / collision step
  marineFleet2.update(1000, game.ships, [], [], [], [], 2000, game);

  assert.strictEqual(marineFleet2.active, false, "Marine fleet should be consumed on collision");
  assert.strictEqual(targetNoCooldown.isUnderBoarding, true, "Boarding should trigger when target is not on cooldown");
  assert.strictEqual(targetNoCooldown.boardingCooldown, 60.0, "Boarding cooldown should be set to 60.0 on trigger");

  console.log("Phase 4 Passed.");

  console.log("All Boarding Action Enhancements tests passed successfully!");
}

runTest();
