import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Wreckage Features ===");

const runTests = () => {
  // 1. Wreckage Generation & Accumulation Test
  console.log("\n--- Part 1: Wreckage Generation & Accumulation ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  const cruiser1 = new Ship('c1', 100, 100, null, human);
  cruiser1.isCruiser = true;
  cruiser1.health = 100;
  cruiser1.maxHealth = 100;
  cruiser1.update = () => {};
  game.ships.push(cruiser1);

  // Tick 1: Initial check, cache health
  game.update(100);
  console.log(`Initial cached health: ${cruiser1.lastTotalHealth}`);

  // Deal 20 damage to cruiser
  cruiser1.health = 80;
  game.update(100);

  console.log(`Wreckages count: ${game.wreckages.length}`);
  if (game.wreckages.length !== 1) {
    console.error("FAILED: Wreckage was not generated!");
    process.exit(1);
  }
  
  const w = game.wreckages[0];
  console.log(`Wreckage cruiserDamage: ${w.cruiserDamage}, amoebaDamage: ${w.amoebaDamage}`);
  if (w.cruiserDamage !== 20 || w.amoebaDamage !== 0) {
    console.error("FAILED: Incorrect damage accumulated in wreckage!");
    process.exit(1);
  }

  // Deal another 15 damage nearby (within 200px)
  cruiser1.health = 65;
  game.update(100);

  console.log(`Wreckages count after second damage: ${game.wreckages.length}`);
  if (game.wreckages.length !== 1) {
    console.error("FAILED: Damage did not merge into existing wreckage!");
    process.exit(1);
  }
  console.log(`Wreckage cruiserDamage after merge: ${w.cruiserDamage}`);
  if (w.cruiserDamage !== 35) {
    console.error("FAILED: Damage was not accumulated!");
    process.exit(1);
  }

  // 2. Lockout Cooldown Test
  console.log("\n--- Part 2: Combat Lockout Cooldown ---");
  // Set lastTimeAttacking recently on cruiser
  cruiser1.lastTimeAttacking = Date.now();
  // Tick game. Wreckage should update lastFightingTime because of combat within 200px
  game.update(100);
  
  const isLocked = (Date.now() - w.lastFightingTime) < 30000;
  console.log(`Wreckage is locked: ${isLocked}`);
  if (!isLocked) {
    console.error("FAILED: Wreckage was not locked in combat!");
    process.exit(1);
  }

  // 3. Retrieval Test (Credits Reward)
  console.log("\n--- Part 3: Wreckage Retrieval (Credits) ---");
  // Move combat time to past to unlock wreckage
  w.lastFightingTime = Date.now() - 35000;
  cruiser1.lastTimeAttacking = 0;
  cruiser1.lastTimeAttacked = 0;

  // Let cruiser retrieve wreckage. Radar range check.
  cruiser1.cruiserRadarRange = () => 150;
  cruiser1.labs = 0; // not researching anything else
  
  // Tick game by 1500ms
  game.update(1500);
  console.log(`Wreckage scanTimeLeft: ${w.scanTimeLeft}`);
  if (w.scanTimeLeft > 1500) {
    console.error("FAILED: Wreckage is not being scanned!");
    process.exit(1);
  }

  // Complete scan (another 1600ms)
  const initialCredits = human.credits || 0;
  game.update(1600);
  console.log(`Wreckages count after scan complete: ${game.wreckages.length}`);
  console.log(`Credits after retrieval: ${human.credits}`);
  if (game.wreckages.length !== 0) {
    console.error("FAILED: Wreckage was not removed after scan completion!");
    process.exit(1);
  }
  if (human.credits <= initialCredits) {
    console.error("FAILED: No credits rewarded!");
    process.exit(1);
  }

  // 4. Retrieval Test (Amoeba Core Anomaly Coexistence)
  console.log("\n--- Part 4: Wreckage Retrieval (Amoeba Anomaly Coexistence) ---");
  // Create an amoeba ship
  const amoeba = new Ship('a1', 300, 300, null, game.monsterPlayer);
  amoeba.isAmoeba = true;
  amoeba.health = 50;
  amoeba.maxHealth = 10;
  amoeba.update = () => {};
  game.ships.push(amoeba);

  // Initialize amoeba lastTotalHealth
  game.update(100);

  // Deal 15 damage to amoeba
  amoeba.health = 35;
  game.update(100);

  if (game.wreckages.length !== 1) {
    console.error("FAILED: Amoeba damage did not spawn wreckage!");
    process.exit(1);
  }

  const w2 = game.wreckages[0];
  console.log(`Amoeba wreckage amoebaDamage: ${w2.amoebaDamage}`);
  if (w2.amoebaDamage !== 15) {
    console.error("FAILED: Amoeba damage not tracked!");
    process.exit(1);
  }

  // Move combat time back
  w2.lastFightingTime = Date.now() - 35000;

  // Let cruiser retrieve it
  cruiser1.x = 300;
  cruiser1.y = 300;
  cruiser1.isActivelyResearching = false;
  
  // Tick to complete scan
  game.update(3100);

  // Deep space anomalies should have spawned one anomaly
  const deepSpaceAnoms = game.planets.filter(p => p.isDeepSpaceAnomaly);
  console.log(`Deep Space Anomalies count: ${deepSpaceAnoms.length}`);
  if (deepSpaceAnoms.length !== 1) {
    console.error("FAILED: Deep Space Anomaly was not spawned for amoeba wreckage!");
    process.exit(1);
  }
  console.log(`Spawned anomaly difficulty: ${deepSpaceAnoms[0].anomaly.difficulty}`);
  if (deepSpaceAnoms[0].anomaly.difficulty !== 1) { // 15 / 10 = 1.5 -> floor is 1
    console.error("FAILED: Incorrect anomaly difficulty!");
    process.exit(1);
  }

  // Under the non-exclusivity rule, they can both exist: the wreckage should still be there!
  console.log(`Wreckages count after anomaly spawned: ${game.wreckages.length}`);
  if (game.wreckages.length !== 1) {
    console.error("FAILED: Wreckage was deleted upon spawning anomaly under non-exclusive rule!");
    process.exit(1);
  }
  console.log(`Wreckage amoebaDamage after anomaly spawned: ${w2.amoebaDamage}`);
  if (w2.amoebaDamage !== 0) {
    console.error("FAILED: Wreckage amoebaDamage was not reset to 0!");
    process.exit(1);
  }

  // 5. Cleanup Low-Damage Wreckage Test
  console.log("\n--- Part 5: Cleanup Low-Damage Wreckages ---");
  // The wreckage w2 now has amoebaDamage = 0 and cruiserDamage = 0 (which is < 5).
  // Currently, it is locked because w2.lastFightingTime was set to Date.now() when anomaly was spawned.
  // Wait, let's fast-forward w2.lastFightingTime to the past (unlocking it).
  w2.lastFightingTime = Date.now() - 35000;
  // Next tick should delete it!
  game.update(100);
  console.log(`Wreckages count after cooldown: ${game.wreckages.length}`);
  if (game.wreckages.length !== 0) {
    console.error("FAILED: Low-damage wreckage was not cleaned up after cooldown!");
    process.exit(1);
  }

  // Let's test a wreckage with 6 cruiserDamage (should NOT be cleaned up after cooldown)
  const cruiser2 = new Ship('c2', 500, 500, null, human);
  cruiser2.isCruiser = true;
  cruiser2.health = 100;
  cruiser2.maxHealth = 100;
  cruiser2.update = () => {};
  game.ships.push(cruiser2);
  game.update(100);

  cruiser2.health = 94; // 6 damage
  game.update(100);

  if (game.wreckages.length !== 1) {
    console.error("FAILED: 6-damage wreckage not spawned!");
    process.exit(1);
  }
  const w3 = game.wreckages[0];
  w3.lastFightingTime = Date.now() - 35000;
  game.update(100);
  console.log(`Wreckages count (6-damage, unlocked): ${game.wreckages.length}`);
  if (game.wreckages.length !== 1) {
    console.error("FAILED: 6-damage wreckage was incorrectly cleaned up!");
    process.exit(1);
  }

  // 6. Cruiser Shields and Armor Damage Wreckage Exclusion Test
  console.log("\n--- Part 6: Cruiser Shields and Armor Exclusion ---");
  // Set up a new cruiser
  const cruiser3 = new Ship('c3', 700, 700, null, human);
  cruiser3.isCruiser = true;
  cruiser3.health = 100;
  cruiser3.maxHealth = 100;
  cruiser3.shieldPoints = 50;
  cruiser3.armorPoints = 50;
  cruiser3.update = () => {};
  game.ships.push(cruiser3);
  game.update(100);

  // Deal shield/armor damage (reduce shield/armor from 50 to 30)
  cruiser3.shieldPoints = 30;
  cruiser3.armorPoints = 30;
  // Clear any existing wreckages to isolate this check
  game.wreckages = [];
  game.update(100);

  console.log(`Wreckages count after shield/armor damage: ${game.wreckages.length}`);
  if (game.wreckages.length !== 0) {
    console.error("FAILED: Shield/armor damage incorrectly spawned wreckage!");
    process.exit(1);
  }

  // Now deal health damage
  cruiser3.health = 80;
  game.update(100);
  console.log(`Wreckages count after health damage: ${game.wreckages.length}`);
  if (game.wreckages.length !== 1) {
    console.error("FAILED: Cruiser health damage did not spawn wreckage!");
    process.exit(1);
  }

  console.log("\nALL WRECKAGE TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
};

runTests();
