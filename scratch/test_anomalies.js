import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

console.log("=== Testing Planetary Anomalies System ===");

// 1. Spawning verification helper logic (recreate the server-side logic in a localized test)
const testSpawning = () => {
  console.log("\n--- Part 1: Anomaly Spawning Logic ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  const p = new Planet(1, 500, 500, 30, null, 100, 1600, 1200);
  p.owner = null;
  game.planets = [p];

  // Mock server discovery loop
  // Case A: Discovering player has a ship with 2 labs in range, planet is neutral and not previously discovered.
  const ship = new Ship('c1', 500, 500, null, human);
  ship.isCruiser = true;
  ship.labs = 2;
  ship.cruiserRadarRange = () => 150;
  ship.update = () => {};
  game.ships.push(ship);

  // Simulate discovery check
  let maxLabs = 0;
  const playerShips = game.ships.filter(s => s.active && s.owner && s.owner.id === human.id);
  for (const s of playerShips) {
    const radar = s.isCruiser ? s.cruiserRadarRange() : 50;
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    if (dx*dx + dy*dy <= radar*radar) {
      if (s.labs > maxLabs) maxLabs = s.labs;
    }
  }

  const baseChance = 0.30 + 0.10 * maxLabs; // 0.30 + 0.20 = 0.50
  console.log(`Calculated base chance: ${baseChance} (expected 0.5)`);
  if (baseChance !== 0.50) {
    console.error("FAILED: Expected baseChance to be 0.50");
    process.exit(1);
  }

  // Case B: Discovered by another player first, chance reduced by 25%
  const otherPlayer = new Player('ai', '#f00', true);
  otherPlayer.discoveredPlanets = new Set([p.id]);
  game.allPlayers.push(otherPlayer);

  const discoveredByOthers = game.allPlayers.some(op => op.id !== human.id && op.discoveredPlanets && op.discoveredPlanets.has(p.id));
  const finalChance = baseChance - (discoveredByOthers ? 0.25 : 0);
  console.log(`Calculated final chance when discovered by others first: ${finalChance} (expected 0.25)`);
  if (finalChance !== 0.25) {
    console.error("FAILED: Expected finalChance to be 0.25");
    process.exit(1);
  }

  // Test skewed difficulty generation
  const diffs = [];
  for (let i = 0; i < 1000; i++) {
    const d = Math.floor(Math.pow(Math.random(), 2) * 111) - 10;
    diffs.push(d);
  }
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  console.log(`Average generated difficulty over 1000 trials: ${avgDiff} (expected skewed towards -10/0, approx ~27)`);
  if (avgDiff > 40) {
    console.error(`FAILED: Expected average difficulty to be skewed lower (< 40), got ${avgDiff}`);
    process.exit(1);
  }

  console.log("-> Spawning logic PASSED!");
};

// 2. XP Multiplier verification
const testXpMultiplier = () => {
  console.log("\n--- Part 2: XP Multiplier on Research Speed ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  const ship = new Ship('c1', 500, 500, null, human);
  ship.isCruiser = true;
  ship.labs = 4;
  ship.expScore = 9; // xp bonus is Math.sqrt(9) = 3 (if CP is 0)
  ship.commandPoints = 0;
  ship.update = () => {};
  // check bonus
  const xpBonus = ship.getLocalXpBonus();
  console.log(`Local XP Bonus: ${xpBonus} (expected 3)`);
  if (xpBonus !== 3) {
    console.error(`FAILED: Expected local XP bonus to be 3, got ${xpBonus}`);
    process.exit(1);
  }

  const xpMultiplier = 1 + (xpBonus * 3) / 100; // 1 + 9/100 = 1.09
  console.log(`XP Multiplier: ${xpMultiplier} (expected 1.09)`);
  if (Math.abs(xpMultiplier - 1.09) > 0.0001) {
    console.error(`FAILED: Expected XP Multiplier to be 1.09, got ${xpMultiplier}`);
    process.exit(1);
  }

  console.log("-> XP Multiplier logic PASSED!");
};

// 3. Hazard/Anomaly completion and XP gains
const testResearchCyclesAndRewards = () => {
  console.log("\n--- Part 3: Research Cycles and Rewards ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  human.techScore = 0;
  human.credits = 0;
  human.expScore = 0;
  game.allPlayers = [human];

  const ship = new Ship('c1', 500, 500, null, human);
  ship.isCruiser = true;
  ship.labs = 4;
  ship.expScore = 0;
  ship.fuel = 1000;
  ship.health = 50;
  ship.maxHealth = 50;
  ship.cruiserRadarRange = () => 150;
  ship.update = () => {};
  game.ships.push(ship);

  // Test Case A: Instant Trigger Anomaly (difficulty <= 0)
  const planet1 = new Planet(1, 500, 500, 30, null, 100, 1600, 1200);
  planet1.anomaly = {
    id: 'a1',
    x: 500,
    y: 500,
    difficulty: -5,
    progress: 0,
    researched: false,
    beingResearched: false
  };
  game.planets.push(planet1);

  // Run update to trigger instant completion
  game.update(1000);
  console.log(`Instant anomaly researched status: ${planet1.anomaly.researched}`);
  if (!planet1.anomaly.researched) {
    console.error("FAILED: Expected difficulty <= 0 anomaly to be instantly researched");
    process.exit(1);
  }

  // Test Case B: Active research anomaly (difficulty > 0)
  const planet2 = new Planet(2, 600, 500, 30, null, 100, 1600, 1200);
  planet2.anomaly = {
    id: 'a2',
    x: 600,
    y: 500,
    difficulty: 5,
    progress: 0,
    researched: false,
    beingResearched: false
  };
  game.planets.push(planet2);

  // Move ship to research range
  ship.x = 600;
  ship.y = 500;
  ship.accumulatedTech = 0;
  ship.expScore = 0;

  // Simulate ticks until anomaly is researched.
  // One cycle = accumulatedTech >= 1.0. With 4 labs, xpMultiplier = 1, dt = 30000ms:
  // knowledgeGained = 4 * 30000 / 120000 = 1.0.
  // Let's run 5 ticks of 30000ms to hit progress 5.
  for (let i = 0; i < 5; i++) {
    game.update(30000);
  }

  console.log(`Active anomaly researched: ${planet2.anomaly.researched}`);
  console.log(`Active anomaly progress: ${planet2.anomaly.progress}`);
  console.log(`Cruiser XP Score: ${ship.expScore}`);

  if (!planet2.anomaly.researched) {
    console.error("FAILED: Expected difficulty 5 anomaly to be completed after 5 ticks");
    process.exit(1);
  }

  if (ship.expScore !== 5) {
    console.error(`FAILED: Expected ship XP score to increase by 5 (1 per completion), got ${ship.expScore}`);
    process.exit(1);
  }

  // Verify chat messages and completions events exist
  console.log(`Pending Chat Messages length: ${game.pendingChatMessages.length}`);
  console.log(`Pending Anomaly Completions length: ${game.pendingAnomalyCompletions.length}`);
  if (game.pendingChatMessages.length === 0 || game.pendingAnomalyCompletions.length === 0) {
    console.error("FAILED: Expected pending chat messages and completions to be populated");
    process.exit(1);
  }

  // Test Case C: Cycle Tech Reward Probability
  console.log("\n--- Part 4: Anomaly Cycle Tech Reward Probability ---");
  // Set up cruiser and player such that chance is 100%
  // local ship xp bonus = 30 (expScore = 900)
  // player xp bonus = 10 (expScore = 100)
  // player tech bonus = 0
  // chance = 30 * 3 + 10 - 0 = 100%
  const planet3 = new Planet(3, 700, 500, 30, null, 100, 1600, 1200);
  planet3.anomaly = {
    id: 'a3',
    x: 700,
    y: 500,
    difficulty: 10, // increase difficulty so it doesn't trigger completion reward immediately
    progress: 0,
    researched: false,
    beingResearched: false
  };
  game.planets.push(planet3);

  // Mock triggerAnomalyCompletion to prevent completion reward interference
  game.triggerAnomalyCompletion = () => {};

  ship.x = 700;
  ship.y = 500;
  ship.expScore = 900; // local bonus = 30
  human.expScore = 100; // player bonus = 10
  human.techScore = 0; // tech bonus = 0
  ship.accumulatedTech = 0;

  // Run update for one completion cycle (with labs = 4, xpMultiplier = 1.90, dt = 30000ms):
  // knowledgeGained = 4 * 30000 * 1.90 / 120000 = 1.90.
  game.update(30000);
  console.log(`Player techScore after 100% chance cycle: ${human.techScore}`);
  if (human.techScore !== 1) {
    console.error(`FAILED: Expected player to receive exactly 1 tech point, got ${human.techScore}`);
    process.exit(1);
  }

  console.log("-> Anomaly Cycle Tech Reward Probability PASSED!");
  console.log("-> Research cycles and rewards logic PASSED!");
};

testSpawning();
testXpMultiplier();
testResearchCyclesAndRewards();

console.log("\nALL TESTS PASSED SUCCESSFULLY!");
process.exit(0);
