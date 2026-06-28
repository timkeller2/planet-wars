import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import assert from 'assert';

function testWreckageCooldown() {
  console.log("Running Wreckage Cooldown and Conditional Deletion Tests...");

  const game = new Game();
  
  // Test Scenario 1: Wreckage with cruiserDamage = 3, amoebaDamage = 0 (under threshold)
  const now = Date.now();
  const w1 = {
    id: 'w1',
    x: 100,
    y: 100,
    cruiserDamage: 3,
    amoebaDamage: 0,
    lastFightingTime: now // 0s elapsed, under 5s cooldown
  };
  game.wreckages = [w1];
  
  // Run update. w1 is under cooldown, so it should not be deleted.
  game.update(100);
  assert.strictEqual(game.wreckages.length, 1, "w1 should not be deleted during cooldown");
  
  // Set lastFightingTime to 6 seconds ago (past the 5s cooldown)
  w1.lastFightingTime = now - 6000;
  game.update(100);
  assert.strictEqual(game.wreckages.length, 0, "w1 should be deleted after cooldown because cruiserDamage < 4 and amoebaDamage = 0");

  console.log("Scenario 1 passed: low-damage wreckage deleted after cooldown.");

  // Test Scenario 2: Wreckage with cruiserDamage = 4, amoebaDamage = 0 (exactly on threshold)
  const w2 = {
    id: 'w2',
    x: 100,
    y: 100,
    cruiserDamage: 4,
    amoebaDamage: 0,
    lastFightingTime: now
  };
  game.wreckages = [w2];
  
  // Run update under cooldown -> retained
  game.update(100);
  assert.strictEqual(game.wreckages.length, 1);
  
  // Set past cooldown -> should still be retained because cruiserDamage >= 4
  w2.lastFightingTime = now - 6000;
  game.update(100);
  assert.strictEqual(game.wreckages.length, 1, "w2 should be retained because cruiserDamage >= 4");
  
  console.log("Scenario 2 passed: cruiser damage >= 4 is retained after cooldown.");

  // Test Scenario 3: Wreckage with cruiserDamage = 3, amoebaDamage = 1 (amoeba residue present)
  const w3 = {
    id: 'w3',
    x: 100,
    y: 100,
    cruiserDamage: 3,
    amoebaDamage: 1,
    lastFightingTime: now
  };
  game.wreckages = [w3];
  
  // Run update under cooldown -> retained
  game.update(100);
  assert.strictEqual(game.wreckages.length, 1);
  
  // Set past cooldown -> should still be retained because amoebaDamage > 0
  w3.lastFightingTime = now - 6000;
  game.update(100);
  assert.strictEqual(game.wreckages.length, 1, "w3 should be retained because amoebaDamage > 0");

  console.log("Scenario 3 passed: amoeba damage > 0 is retained after cooldown.");
  console.log("All Wreckage Cooldown and Conditional Deletion Tests passed successfully!");
}

testWreckageCooldown();
