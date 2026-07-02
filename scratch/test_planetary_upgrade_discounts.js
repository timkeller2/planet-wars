import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Planetary Upgrade Discount tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  // 2. Verify starting globalUpgradeModifiers are initialized between -0.1 and 0.1
  console.log("Verifying starting globalUpgradeModifiers are between -0.1 and 0.1...");
  for (const [key, val] of Object.entries(game.globalUpgradeModifiers)) {
    assert.ok(val >= -0.10 && val <= 0.10, `Starting globalUpgradeModifiers for ${key} should be between -0.1 and 0.1, got ${val}`);
  }

  // Verify starting player upgradeModifiers are initialized between -0.1 and 0.1
  console.log("Verifying starting player upgradeModifiers are between -0.1 and 0.1...");
  const p1 = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  for (const [key, val] of Object.entries(p1.upgradeModifiers)) {
    assert.ok(val >= -0.10 && val <= 0.10, `Starting player upgradeModifiers for ${key} should be between -0.1 and 0.1, got ${val}`);
  }

  // 3. Verify getUpgradeCost calculates correctly with 0 planets owned
  const planet = game.planets[0];
  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  planet.owner = player;
  
  const cruiser = new Ship('c1', planet.x + 10, planet.y + 10, null, player);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;
  game.ships.push(cruiser);

  const baseCost = game.getUpgradeCost(cruiser, 'shield');
  console.log(`Base upgrade cost with 0 planetary upgrades: ${baseCost}`);

  // 4. Verify 20% discount per planetary upgrade count
  // Let's add 1 planetary upgrade for 'shields'
  planet.shields = 1;
  const costWith1Planet = game.getUpgradeCost(cruiser, 'shield');
  console.log(`Upgrade cost with 1 planetary upgrade: ${costWith1Planet}`);
  
  // 1 - (1 * 0.20) = 80% of base cost
  const expectedCostWith1 = Math.max(1, Math.round(baseCost * 0.80));
  assert.strictEqual(costWith1Planet, expectedCostWith1, `Expected cost with 1 planet: ${expectedCostWith1}, got ${costWith1Planet}`);

  // Let's add 2 planetary upgrades for 'shields'
  planet.shields = 2;
  const costWith2Planets = game.getUpgradeCost(cruiser, 'shield');
  console.log(`Upgrade cost with 2 planetary upgrades: ${costWith2Planets}`);
  
  // 1 - (2 * 0.20) = 60% of base cost
  const expectedCostWith2 = Math.max(1, Math.round(baseCost * 0.60));
  assert.strictEqual(costWith2Planets, expectedCostWith2, `Expected cost with 2 planets: ${expectedCostWith2}, got ${costWith2Planets}`);

  // Let's add 5 planetary upgrades for 'shields'
  planet.shields = 5;
  const costWith5Planets = game.getUpgradeCost(cruiser, 'shield');
  console.log(`Upgrade cost with 5 planetary upgrades: ${costWith5Planets}`);
  
  // 1 - (5 * 0.20) = 0% of base cost -> min cost is 1
  assert.strictEqual(costWith5Planets, 1, `Expected cost with 5 planets to be clamped to 1, got ${costWith5Planets}`);

  console.log("All Planetary Upgrade Discount tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
