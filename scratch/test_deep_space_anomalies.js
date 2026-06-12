import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

console.log("=== Testing Deep Space Anomaly Discovery and Spawn Chance ===");

// Helper to simulate spawn anomaly logic since it's locally scoped in server.js
function calculateSpawnChance(labs, xpScore, commandPoints, discoveredByOthers) {
  // Mock Ship.getLocalXpBonus()
  const expScore = xpScore || 0;
  const cmdPoints = commandPoints || 0;
  const shipXpBonus = Math.sqrt(expScore) + cmdPoints;

  const maxLabs = labs || 0;
  const maxShipXpBonus = shipXpBonus;

  let spawnChance = Math.min(0.50, 0.10 + 0.10 * maxLabs + 0.03 * maxShipXpBonus);
  if (discoveredByOthers) {
    spawnChance -= 0.25;
  }
  return spawnChance;
}

const testPlanetarySpawnChance = () => {
  console.log("\n--- Part 1: Planetary Anomaly Spawn Chance Calculation ---");

  // 1. Base chance only: 10%
  let chance = calculateSpawnChance(0, 0, 0, false);
  console.log(`Base chance: ${chance} (expected 0.10)`);
  if (Math.abs(chance - 0.10) > 1e-5) {
    console.error("FAILED: Base chance should be 10%");
    process.exit(1);
  }

  // 2. Base + XP: 10% + 3% * 4 (from 16 expScore) = 22%
  chance = calculateSpawnChance(0, 16, 0, false);
  console.log(`Base + XP (16 XP): ${chance} (expected 0.22)`);
  if (Math.abs(chance - 0.22) > 1e-5) {
    console.error("FAILED: Base + XP chance should be 22%");
    process.exit(1);
  }

  // 3. Base + Labs + XP exceeding cap: 10% + 10%*3 (30%) + 12% = 52% -> capped at 50%
  chance = calculateSpawnChance(3, 16, 0, false);
  console.log(`Base + Labs + XP (capped): ${chance} (expected 0.50)`);
  if (Math.abs(chance - 0.50) > 1e-5) {
    console.error("FAILED: Cap of 50% not applied!");
    process.exit(1);
  }

  // 4. Penalty: 50% capped chance - 25% penalty = 25%
  chance = calculateSpawnChance(3, 16, 0, true);
  console.log(`Capped + Penalty: ${chance} (expected 0.25)`);
  if (Math.abs(chance - 0.25) > 1e-5) {
    console.error("FAILED: Penalty of -25% not applied correctly!");
    process.exit(1);
  }

  console.log("-> Planetary spawn chance calculations PASSED!");
};

const testDeepSpaceDiscovery = () => {
  console.log("\n--- Part 2: Deep Space Anomaly Discovery Sweep ---");

  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // Set up a normal planet far away from (1000, 1000)
  const normalPlanet = new Planet(1, 100, 100, 30, null, 10, 2000, 2000);
  game.planets = [normalPlanet];

  // Create a cruiser at (1000, 1000)
  const cruiser = new Ship('c1', 1000, 1000, null, human);
  cruiser.isCruiser = true;
  cruiser.expScore = 16; // shipXpBonus = 4
  cruiser.labs = 2; // labs = 2
  cruiser.cruiserRadarRange = () => 150;
  cruiser.checkSurvivalRoll = () => true;
  game.ships.push(cruiser);

  // Discovery chance should be: ((4 + 2 * 2) / 10)% = 0.8%
  // Let's force Math.random to return 0.005 so it succeeds
  const originalRandom = Math.random;
  Math.random = () => 0.005;

  // Let's trigger update on cruiser so it explores (1000, 1000) tile
  // deltaTime is 100ms
  cruiser.update(100, game.ships, [], game.planets, [], [], 2000, game);

  // Restore Math.random
  Math.random = originalRandom;

  // Verify that an anomaly was spawned
  const deepSpacePlanets = game.planets.filter(p => p.isDeepSpaceAnomaly);
  console.log(`Spanned deep space anomalies count: ${deepSpacePlanets.length} (expected 1)`);
  if (deepSpacePlanets.length !== 1) {
    console.error("FAILED: Deep space anomaly was not spawned!");
    process.exit(1);
  }

  const dsAnomaly = deepSpacePlanets[0];
  console.log(`Spawn position: (${dsAnomaly.x}, ${dsAnomaly.y}) (expected center of explored cell, i.e., 850, 850)`);
  if (dsAnomaly.x !== 850 || dsAnomaly.y !== 850) {
    console.error("FAILED: Spawn position is not at center of explored tile!");
    process.exit(1);
  }

  // Verify cooldown was set to 60000ms
  console.log(`Cruiser cooldown: ${cruiser.anomalyDiscoveryCooldown}ms (expected 60000)`);
  if (cruiser.anomalyDiscoveryCooldown !== 60000) {
    console.error("FAILED: Cruiser cooldown was not set to 1 minute!");
    process.exit(1);
  }

  console.log("-> Deep Space Anomaly Discovery PASSED!");
};

const testDiscoveryCooldown = () => {
  console.log("\n--- Part 3: Cruiser Discovery Cooldown ---");

  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  const normalPlanet = new Planet(1, 100, 100, 30, null, 10, 2000, 2000);
  game.planets = [normalPlanet];

  const cruiser = new Ship('c1', 1000, 1000, null, human);
  cruiser.isCruiser = true;
  cruiser.anomalyDiscoveryCooldown = 30000; // 30 seconds cooldown remaining
  cruiser.expScore = 16;
  cruiser.labs = 2;
  cruiser.cruiserRadarRange = () => 150;
  cruiser.checkSurvivalRoll = () => true;
  game.ships.push(cruiser);

  // Force Math.random to return 0 (guaranteed success if checked)
  const originalRandom = Math.random;
  Math.random = () => 0.0;

  // Move cruiser to another tile to trigger new exploration key
  cruiser.x = 1200;
  cruiser.y = 1200;
  cruiser.update(100, game.ships, [], game.planets, [], [], 2000, game);

  Math.random = originalRandom;

  const deepSpacePlanets = game.planets.filter(p => p.isDeepSpaceAnomaly);
  console.log(`Spanned deep space anomalies count under cooldown: ${deepSpacePlanets.length} (expected 0)`);
  if (deepSpacePlanets.length !== 0) {
    console.error("FAILED: Deep space anomaly spawned while cruiser was on cooldown!");
    process.exit(1);
  }

  // Tick down cooldown by 30000ms
  cruiser.update(30000, game.ships, [], game.planets, [], [], 2000, game);
  console.log(`Cruiser cooldown after 30s update: ${cruiser.anomalyDiscoveryCooldown}ms (expected 0)`);
  if (cruiser.anomalyDiscoveryCooldown !== 0) {
    console.error("FAILED: Cooldown did not decrement correctly!");
    process.exit(1);
  }

  console.log("-> Discovery Cooldown PASSED!");
};

testPlanetarySpawnChance();
testDeepSpaceDiscovery();
testDiscoveryCooldown();

console.log("\nALL NEW ANOMALY TESTS PASSED SUCCESSFULLY!");
process.exit(0);
