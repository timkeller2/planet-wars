import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Upgrade Modifier Cap tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  
  // Spawn a cruiser
  const cruiser = new Ship('c_test', 500, 500, null, player);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;

  // With 0 upgrades: totalUpgrades = 0
  // baseCost = Math.min(150, Math.round(25 + 40 * (3 + 0))) = Math.min(150, 145) = 145
  const baseCost = 145;

  // Let's verify baseCost first (when globalMod = 0, playerMod = 0)
  game.globalUpgradeModifiers = { shield: 0 };
  player.upgradeModifiers = { shield: 0 };
  
  let cost = game.getUpgradeCost(cruiser, 'shield');
  assert.strictEqual(cost, baseCost, `Base cost should be ${baseCost}, got ${cost}`);

  // Test 1: Combined modifier at -0.50 (old cap, now allowed to go to -0.75)
  // Let's set global = -0.20, player = -0.30 -> sum = -0.50
  game.globalUpgradeModifiers = { shield: -0.20 };
  player.upgradeModifiers = { shield: -0.30 };
  cost = game.getUpgradeCost(cruiser, 'shield');
  // Cost should be Math.round(145 * 0.50) = 73
  assert.strictEqual(cost, 73, `Cost with -50% discount should be 73, got ${cost}`);

  // Test 2: Combined modifier at exactly -0.75 (new cap)
  // Let's set global = -0.35, player = -0.40 -> sum = -0.75
  game.globalUpgradeModifiers = { shield: -0.35 };
  player.upgradeModifiers = { shield: -0.40 };
  cost = game.getUpgradeCost(cruiser, 'shield');
  // Cost should be Math.round(145 * 0.25) = 36
  assert.strictEqual(cost, 36, `Cost with -75% discount should be 36, got ${cost}`);

  // Test 3: Combined modifier exceeds cap: global = -0.35, player = -0.50 -> sum = -0.85
  // It should be clamped to -0.75, so cost remains 36
  game.globalUpgradeModifiers = { shield: -0.35 };
  player.upgradeModifiers = { shield: -0.50 };
  cost = game.getUpgradeCost(cruiser, 'shield');
  assert.strictEqual(cost, 36, `Cost exceeding 75% cap should clamp to -75% discount (cost 36), got ${cost}`);

  console.log("All Upgrade Modifier Cap tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
