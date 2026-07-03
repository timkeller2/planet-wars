import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Boarding Attempt Rounds tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  game.isRunning = true;

  const p1 = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  const p2 = game.allPlayers.find(p => p.id === 'p2') || game.allPlayers[1];

  // 2. Spawn Defender Cruiser (health = 1, i.e., disabled, crew = 10, no cooldown)
  const defender = new Ship('c_def', 100, 100, null, p1);
  defender.isCruiser = true;
  defender.maxHealth = 40;
  defender.health = 1;
  defender.crew = 10;
  defender.marineCount = 0;
  defender.name = "Defiant";

  // 3. Spawn Attacker Cruiser
  const attacker = new Ship('c_atk', 120, 120, null, p2);
  attacker.isCruiser = true;
  attacker.maxHealth = 40;
  attacker.health = 40;
  attacker.marineCount = 100;
  attacker.scoutAttackEnabled = true;

  game.ships.push(defender);
  game.ships.push(attacker);

  // --- FIRST BOARDING ACTION ---
  console.log("Starting first boarding attempt...");
  // Let the direct boarding trigger logic run
  game.updateCustomCruiserSystems(1.0);

  assert.strictEqual(defender.isUnderBoarding, true, "Defender should be under boarding");
  assert.strictEqual(defender.boardingAttempts, undefined, "boardingAttempts should be undefined before resolution");

  // Force timer to 0 to trigger resolution
  defender.boardingTimer = 0;
  game.updateCustomCruiserSystems(0.1);

  assert.strictEqual(defender.isUnderBoarding, false, "Boarding action should have resolved");
  assert.strictEqual(defender.boardingAttempts, 1, "boardingAttempts should be 1 after first resolution");
  assert.strictEqual(game.boardingReplays.length, 1, "Should have 1 replay recorded");
  assert.strictEqual(game.boardingReplays[0].name, "The battle for Defiant", "First attempt name should have no suffix");

  // Clear boarding cooldown and set up the second boarding attempt
  defender.boardingCooldown = 0;
  defender.health = 1; // Keep it disabled
  defender.crew = 10;
  defender.owner = p1; // Reset owner so they are enemies again
  attacker.marineCount = 100; // Give attacker more marines
  
  // --- SECOND BOARDING ACTION ---
  console.log("Starting second boarding attempt...");
  game.updateCustomCruiserSystems(1.0);

  assert.strictEqual(defender.isUnderBoarding, true, "Defender should be under boarding again");
  
  // Force timer to 0 to resolve
  defender.boardingTimer = 0;
  game.updateCustomCruiserSystems(0.1);

  assert.strictEqual(defender.isUnderBoarding, false, "Second boarding action should have resolved");
  assert.strictEqual(defender.boardingAttempts, 2, "boardingAttempts should be 2 after second resolution");
  assert.strictEqual(game.boardingReplays.length, 2, "Should have 2 replays recorded");
  assert.strictEqual(game.boardingReplays[1].name, "The battle for Defiant, Round 2", "Second attempt name should end in ', Round 2'");

  // --- THIRD BOARDING ACTION ---
  console.log("Starting third boarding attempt...");
  defender.boardingCooldown = 0;
  defender.health = 1;
  defender.crew = 10;
  defender.owner = p1; // Reset owner again
  attacker.marineCount = 100;

  game.updateCustomCruiserSystems(1.0);
  assert.strictEqual(defender.isUnderBoarding, true, "Defender should be under boarding a third time");

  defender.boardingTimer = 0;
  game.updateCustomCruiserSystems(0.1);

  assert.strictEqual(defender.isUnderBoarding, false, "Third boarding action should have resolved");
  assert.strictEqual(defender.boardingAttempts, 3, "boardingAttempts should be 3 after third resolution");
  assert.strictEqual(game.boardingReplays.length, 3, "Should have 3 replays recorded");
  assert.strictEqual(game.boardingReplays[2].name, "The battle for Defiant, Round 3", "Third attempt name should end in ', Round 3'");

  console.log("All Boarding Attempt Rounds tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
