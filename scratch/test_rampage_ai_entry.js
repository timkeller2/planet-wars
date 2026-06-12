import { Game } from '../src/game.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Rampage Event AI Entry Delay ===");

function testRampageDelay(aiEntry, customMin, expectedDelayMs) {
  const game = new Game({ width: 1600, height: 1600 });
  game.settings = {
    aiEntry: aiEntry,
    customAiEntryMin: customMin
  };
  game.initMap();
  
  // Base rampage interval for width 1600 is 1800000 ms
  const expectedTotal = 1800000 + expectedDelayMs;
  console.log(`AI Entry: ${aiEntry}${customMin ? ' (custom=' + customMin + ')' : ''} -> nextRampageTime: ${game.nextRampageTime} (expected: ${expectedTotal})`);
  assert(game.nextRampageTime === expectedTotal, `Expected nextRampageTime to be ${expectedTotal}, got ${game.nextRampageTime}`);
  
  const expectedSelection = expectedTotal - 180000;
  assert(game.nextRampageSelectionTime === expectedSelection, `Expected nextRampageSelectionTime to be ${expectedSelection}, got ${game.nextRampageSelectionTime}`);
}

// 1. Start: 0 minutes extra
testRampageDelay('start', null, 0);

// 2. Early: 10 minutes extra
testRampageDelay('early', null, 10 * 60 * 1000);

// 3. Mid: 20 minutes extra
testRampageDelay('mid', null, 20 * 60 * 1000);

// 4. Late: 30 minutes extra
testRampageDelay('late', null, 30 * 60 * 1000);

// 5. Custom 20 minutes: 20 / 4 = 5 minutes extra
testRampageDelay('custom', 20, 5 * 60 * 1000);

// 6. Custom 80 minutes: 80 / 4 = 20 minutes extra
testRampageDelay('custom', 80, 20 * 60 * 1000);

console.log("\nAll Rampage AI Entry Delay tests PASSED successfully!");
process.exit(0);
