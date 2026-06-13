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

  // 4. Retrieval Test (Amoeba Core Anomaly)
  console.log("\n--- Part 4: Wreckage Retrieval (Amoeba Anomaly) ---");
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

  console.log("\nALL WRECKAGE TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
};

runTests();
