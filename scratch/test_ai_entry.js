import { Game } from '../src/game.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing AI Entry Cooldown ===");

// Helper to run a test case
function runTestCase(name, settings, expectedCooldownMs) {
  console.log(`Running case: ${name}`);
  const game = new Game({ width: 1920, height: 1620 });
  game.settings = settings;
  game.isRunning = true;
  game.pendingAIs = [game.aiPlayers[0]];
  game.aiSpawnInterval = 10000;
  game.aiSpawnTimer = 0;
  
  // Stub assignPlanet
  let assignCalled = false;
  game.assignPlanet = () => {
    assignCalled = true;
    return true;
  };

  // If cooldown is > 0, update before cooldown should NOT spawn
  if (expectedCooldownMs > 0) {
    // Tick up to just before cooldown
    game.update(expectedCooldownMs - 1);
    assert(!assignCalled, "Should NOT spawn AI before cooldown elapsed");
    assert(game.aiSpawnTimer === 0, "Spawn timer should not accumulate before cooldown");
    
    // Tick exactly past the cooldown
    game.update(1);
    // Still shouldn't spawn yet because aiSpawnTimer hasn't reached aiSpawnInterval (10000)
    assert(!assignCalled, "Should not spawn immediately on cooldown end if interval not reached");
    assert(game.aiSpawnTimer === 1, "Spawn timer should start accumulating after cooldown");

    // Tick the remaining interval time
    game.update(10000);
    assert(assignCalled, "Should spawn AI after cooldown + spawn interval elapsed");
  } else {
    // Start case: should start accumulating immediately
    game.update(1);
    assert(game.aiSpawnTimer === 1, "Spawn timer should start accumulating immediately");
    game.update(10000);
    assert(assignCalled, "Should spawn AI after spawn interval elapsed");
  }
  console.log(`-> Case ${name} Passed!`);
}

// Case 1: Start (0 cooldown)
runTestCase('Start', { aiEntry: 'start', timedGameLimit: '3600' }, 0);

// Case 2: Early (20% of 1 hour = 720000ms)
runTestCase('Early (Timed)', { aiEntry: 'early', timedGameLimit: '3600' }, 720000);

// Case 3: Early (Unlimited game time -> 20 minutes = 1200000ms)
runTestCase('Early (Unlimited)', { aiEntry: 'early', timedGameLimit: 'unlimited' }, 1200000);

// Case 4: Mid (40% of 1 hour = 1440000ms)
runTestCase('Mid (Timed)', { aiEntry: 'mid', timedGameLimit: '3600' }, 1440000);

// Case 5: Mid (Unlimited -> 40 minutes = 2400000ms)
runTestCase('Mid (Unlimited)', { aiEntry: 'mid', timedGameLimit: 'unlimited' }, 2400000);

// Case 6: Late (60% of 1 hour = 2160000ms)
runTestCase('Late (Timed)', { aiEntry: 'late', timedGameLimit: '3600' }, 2160000);

// Case 7: Late (Unlimited -> 60 minutes = 3600000ms)
runTestCase('Late (Unlimited)', { aiEntry: 'late', timedGameLimit: 'unlimited' }, 3600000);

// Case 8: Custom (e.g. 5 minutes = 300000ms)
runTestCase('Custom 5 min', { aiEntry: 'custom', customAiEntryMin: 5, timedGameLimit: 'unlimited' }, 300000);

console.log("\nAll AI Entry Cooldown tests PASSED!");
