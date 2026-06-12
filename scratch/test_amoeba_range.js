// Test Space Amoeba dynamic range calculation
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Space Amoeba Dynamic Weapon Range ===");

const monsterPlayer = new Player('monsters', '#0f0', false);
monsterPlayer.isMonster = true;
monsterPlayer.techScore = 0;
monsterPlayer.expScore = 0;

// Scenario 1: Small newly spawned amoeba (maxHealth = 4), 0 tech, 0 exp, 0 bombs
{
  const amoeba = new Ship('a1', 500, 500, null, monsterPlayer);
  amoeba.isAmoeba = true;
  amoeba.maxHealth = 4;
  amoeba.health = 4;
  amoeba.bombs = 0;

  const range = amoeba.getWeaponRange();
  console.log("Scenario 1 Range:", range);
  // displayedMaxHealth = 4 + (4 * 3) / 2 = 10
  // baseAmoebaRange = (40 + 10) * (1 + 0 + 0) = 50
  assert(range === 50, "Expected range to be 50");
}

// Scenario 2: Small newly spawned amoeba with 2 bombs
{
  const amoeba = new Ship('a2', 500, 500, null, monsterPlayer);
  amoeba.isAmoeba = true;
  amoeba.maxHealth = 4;
  amoeba.health = 4;
  amoeba.bombs = 2;

  const range = amoeba.getWeaponRange();
  console.log("Scenario 2 Range:", range);
  // baseAmoebaRange = 50. effectiveRange = 50 + 50 * 0.1 = 55
  assert(range === 55, "Expected range to be 55");
}

// Scenario 3: Large cheat-spawned amoeba (maxHealth = 15), 0 tech, 0 exp, 0 bombs
{
  const amoeba = new Ship('a3', 500, 500, null, monsterPlayer);
  amoeba.isAmoeba = true;
  amoeba.maxHealth = 15;
  amoeba.health = 15;
  amoeba.bombs = 0;

  const range = amoeba.getWeaponRange();
  console.log("Scenario 3 Range:", range);
  // displayedMaxHealth = 15 + (15 * 14) / 2 = 120
  // baseAmoebaRange = (40 + 120) * (1 + 0 + 0) = 160
  assert(range === 160, "Expected range to be 160");
}

// Scenario 4: Large cheat-spawned amoeba with 5 bombs and monster player with some tech & exp
{
  const upgradedMonster = new Player('monsters', '#0f0', false);
  upgradedMonster.isMonster = true;
  upgradedMonster.techScore = 100; // sqrt(100) = 10 -> laserTechBonus = 0.10
  upgradedMonster.expScore = 16;   // sqrt(16) = 4 -> expBonus = 4

  const amoeba = new Ship('a4', 500, 500, null, upgradedMonster);
  amoeba.isAmoeba = true;
  amoeba.maxHealth = 15;
  amoeba.health = 15;
  amoeba.bombs = 5;
  amoeba.expScore = 25; // sqrt(25) = 5 -> shipExpBonus = 5
  // xpRangeBonus = (4 + 5) * 0.10 = 0.90

  const range = amoeba.getWeaponRange();
  console.log("Scenario 4 Range:", range);
  // displayedMaxHealth = 15 + (15 * 14) / 2 = 120
  // baseAmoebaRange = (40 + 120) * (1 + 0.10 + 0.90) = 160 * 2.0 = 320
  // with bombs: 320 * 1.10 = 352
  assert(range === 352, "Expected range to be 352");
}

console.log("All Space Amoeba range tests passed successfully!");
process.exit(0);
