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
  console.log("After 100ms update:", { active: cruiser.active, health: cruiser.health, fuel: cruiser.fuel, cooldown: cruiser.anomalyDiscoveryCooldown });

  Math.random = originalRandom;

  const deepSpacePlanets = game.planets.filter(p => p.isDeepSpaceAnomaly);
  console.log(`Spanned deep space anomalies count under cooldown: ${deepSpacePlanets.length} (expected 0)`);
  if (deepSpacePlanets.length !== 0) {
    console.error("FAILED: Deep space anomaly spawned while cruiser was on cooldown!");
    process.exit(1);
  }

  // Tick down cooldown by 30000ms
  Math.random = () => 1.0;
  cruiser.update(30000, game.ships, [], game.planets, [], [], 2000, game);
  Math.random = originalRandom;
  console.log("After 30s update:", { active: cruiser.active, health: cruiser.health, fuel: cruiser.fuel, cooldown: cruiser.anomalyDiscoveryCooldown });
  console.log(`Cruiser cooldown after 30s update: ${cruiser.anomalyDiscoveryCooldown}ms (expected 0)`);
  if (cruiser.anomalyDiscoveryCooldown !== 0) {
    console.error("FAILED: Cooldown did not decrement correctly!");
    process.exit(1);
  }

  console.log("-> Discovery Cooldown PASSED!");
};

const testDiplomacyLinkBreak = () => {
  console.log("\n--- Part 4: Break Diplomat Planet Link On Parley Consumption ---");

  const game = new Game();
  game.isRunning = true;
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  const planet = new Planet(1, 100, 100, 30, null, 10, 2000, 2000);
  planet.disposition = { human: 50 };
  game.planets = [planet];

  const cruiser = new Ship('c1', 100, 100, null, human);
  cruiser.isCruiser = true;
  cruiser.diplomat = 1;
  cruiser.parley = 1.5;
  cruiser.isDiplomacy = true;
  cruiser.cruiserRadarRange = () => 150;
  cruiser.checkSurvivalRoll = () => true;
  game.ships.push(cruiser);

  // First update sets targetPlanet.activeDiplomatId = ship.id and ship.diplomatTargetPlanetId = targetPlanet.id
  // and starts the timer
  game.update(100);

  console.log(`Active diplomat target ID: ${cruiser.diplomatTargetPlanetId} (expected 1)`);
  console.log(`Planet active diplomat ID: ${planet.activeDiplomatId} (expected c1)`);
  if (cruiser.diplomatTargetPlanetId !== 1 || planet.activeDiplomatId !== 'c1') {
    console.error("FAILED: Did not establish diplomat link initially!");
    process.exit(1);
  }

  // Set the warmup timer near completion (29.9 seconds)
  planet.diplomacyWarmupTimer = 29.9;

  // Next update (100ms) will push timer to 30.0s, trigger consumption, and break link
  game.update(100);

  console.log(`Active diplomat target ID after parley consumed: ${cruiser.diplomatTargetPlanetId} (expected null)`);
  console.log(`Planet active diplomat ID after parley consumed: ${planet.activeDiplomatId} (expected null)`);
  if (cruiser.diplomatTargetPlanetId !== null || planet.activeDiplomatId !== null) {
    console.error("FAILED: Link was not broken after parley consumption!");
    process.exit(1);
  }

  console.log("-> Diplomacy Link Break PASSED!");
};

const testSpecialFuelConsumption = () => {
  console.log("\n--- Part 5: Special Fuel Consumption Rate ---");

  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // 1. Test movement fuel consumption
  const cruiser = new Ship('c1', 100, 100, null, human);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 20;
  cruiser.health = 20;
  cruiser.fuel = 10;
  cruiser.specialfuel = 5;
  cruiser.checkSurvivalRoll = () => true;
  game.ships.push(cruiser);

  // Trigger movement update (cruiser not in friendly well, so it drains fuel)
  // Let's run a 10s (10000ms) update
  const oldFuel = cruiser.fuel;
  const oldSpecialFuel = cruiser.specialfuel;
  
  cruiser.update(10000, game.ships, [], [], [], [], 2000, game);

  const fuelConsumed = oldFuel - cruiser.fuel;
  const specialFuelConsumed = oldSpecialFuel - cruiser.specialfuel;

  console.log(`Fuel consumed in 10s movement: ${fuelConsumed.toFixed(6)}`);
  console.log(`Special fuel consumed in 10s movement: ${specialFuelConsumed.toFixed(6)}`);

  if (fuelConsumed <= 0) {
    console.error("FAILED: No fuel was consumed during movement!");
    process.exit(1);
  }

  // Expect special fuel consumed to be exactly half of normal fuel consumed
  const ratio = specialFuelConsumed / fuelConsumed;
  console.log(`Consumption ratio: ${ratio.toFixed(4)} (expected 0.5000)`);
  if (Math.abs(ratio - 0.5) > 1e-4) {
    console.error("FAILED: Special fuel was not consumed at half the rate of standard fuel!");
    process.exit(1);
  }

  // 2. Test warp jump consumption
  cruiser.fuel = 10;
  cruiser.specialfuel = 5;

  const originalRandom = Math.random;
  Math.random = () => 1.0;

  // Warp jump consumes 1 standard fuel
  game.applyWarpToShip(cruiser, human);

  Math.random = originalRandom;

  console.log(`Fuel after warp jump: ${cruiser.fuel} (expected 9)`);
  console.log(`Special fuel after warp jump: ${cruiser.specialfuel} (expected 4.5)`);

  if (cruiser.fuel !== 9 || cruiser.specialfuel !== 4.5) {
    console.error("FAILED: Warp jump fuel/special fuel consumption incorrect!");
    process.exit(1);
  }

  console.log("-> Special Fuel Consumption PASSED!");
};

const testSpecialDuraniumConsumption = () => {
  console.log("\n--- Part 6: Special Duranium Consumption Rate ---");

  const game = new Game();
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  const cruiser = new Ship('c1', 100, 100, null, human);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 20;
  cruiser.health = 20;
  cruiser.armorPoints = 10;
  cruiser.specialduranium = 5;
  cruiser.checkSurvivalRoll = () => true;
  game.ships.push(cruiser);

  const originalRandom = Math.random;
  // Mock Math.random to return 1.0 (fails shrug check)
  Math.random = () => 1.0;

  // 1. Normal hit: damage = 1
  cruiser.takeDamage([], null, false, 'front');

  console.log(`Special Duranium after normal hit: ${cruiser.specialduranium} (expected 4.5)`);
  if (cruiser.specialduranium !== 4.5) {
    console.error("FAILED: Normal hit did not consume 0.5 Special Duranium!");
    process.exit(1);
  }

  // 2. Hazard hit: mock Math.random to return 0.5 (so Math.floor(Math.random() * 6) + 1 = 4)
  let callCount = 0;
  Math.random = () => {
    callCount++;
    if (callCount === 1) return 1.0; // Shrug check (fail shrug)
    return 0.5; // Hazard damage: Math.floor(0.5 * 6) + 1 = 4
  };

  cruiser.takeDamage([], null, true, 'front');

  console.log(`Special Duranium after hazard hit: ${cruiser.specialduranium} (expected 2.5)`);
  if (cruiser.specialduranium !== 2.5) {
    console.error("FAILED: Hazard hit did not consume 2.0 (4 * 0.5) Special Duranium!");
    process.exit(1);
  }

  Math.random = originalRandom;
  console.log("-> Special Duranium Consumption PASSED!");
};

const testDiplomatTargetSelection = () => {
  console.log("\n--- Part 7: Diplomat Target Selection ---");

  const game = new Game();
  game.isRunning = true;
  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // Planet 1: disposition = 20
  const planet1 = new Planet(1, 150, 100, 30, null, 10, 2000, 2000);
  planet1.disposition = { human: 20 };
  
  // Planet 2: no disposition
  const planet2 = new Planet(2, 100, 150, 30, null, 10, 2000, 2000);
  planet2.disposition = {};

  game.planets = [planet1, planet2];

  // Diplomat cruiser in range of both
  const diplomat = new Ship('c1', 100, 100, null, human);
  diplomat.isCruiser = true;
  diplomat.maxHealth = 20;
  diplomat.health = 20;
  diplomat.diplomat = 1; // enable diplomat module
  diplomat.isDiplomacy = true;
  diplomat.parley = 3;
  game.ships.push(diplomat);

  // Run game update to select diplomat target
  game.update(100);

  console.log(`Diplomat target planet ID: ${diplomat.diplomatTargetPlanetId} (expected 2)`);
  if (diplomat.diplomatTargetPlanetId !== 2) {
    console.error("FAILED: Diplomat did not prioritize planet without disposition!");
    process.exit(1);
  }

  // 2. Both planets have disposition: A=40, B=20.
  // Should prioritize Planet 1 (A) because we don't sort by lower disposition once set (defaults to higher/original).
  planet1.disposition = { human: 40 };
  planet2.disposition = { human: 20 };
  diplomat.diplomatTargetPlanetId = null;

  game.update(100);

  console.log(`Diplomat target planet ID (both set): ${diplomat.diplomatTargetPlanetId} (expected 1)`);
  if (diplomat.diplomatTargetPlanetId !== 1) {
    console.error("FAILED: Diplomat prioritized lower disposition when both were set!");
    process.exit(1);
  }

  console.log("-> Diplomat Target Selection PASSED!");
};

const testMarketPricingMinimumConstraint = () => {
  console.log("\n--- Part 8: Market Pricing Minimum Constraint ---");

  const game = new Game();
  game.isRunning = true;
  game.nextNeutralTradeTime = 120000;
  
  // 1. Record market sales for 'dilithium'
  game.recordMarketSale('dilithium', 10);
  game.recordMarketSale('dilithium', 20); // max sold price is 20
  
  // 2. Validate max sold price logic
  const maxSold = game.getMaxSoldPriceInLast5Minutes('dilithium');
  console.log(`Max sold price in last 5 mins: ${maxSold} (expected 20)`);
  if (maxSold !== 20) {
    console.error("FAILED: Max sold price calculation incorrect!");
    process.exit(1);
  }

  // 3. Trigger neutral trade post
  // Mock random to select 'dilithium' (index 0 in resourcesList)
  const originalRandom = Math.random;
  let callCount = 0;
  Math.random = () => {
    callCount++;
    if (callCount === 1) return 0; // nextNeutralTradeTime random offset in update loop
    if (callCount === 2) return 0.001; // resourcesList index for 'dilithium'
    if (callCount === 3) return 0.001; // d3 = 1
    return 0.5;
  };

  game.neutralTradeTimer = 120000;
  game.update(100);

  Math.random = originalRandom;

  // Expected price: max(basePrice, 20 * 1.35) -> max(8, 27) = 27
  const postedOrder = game.sellOrders.find(o => o.ownerId === 'neutral' && o.resource === 'dilithium');
  console.log(`Posted neutral order price: ${postedOrder ? postedOrder.price : 'none'} (expected 27)`);
  if (!postedOrder || postedOrder.price !== 27) {
    console.error("FAILED: Market starting price constraint not applied correctly!");
    process.exit(1);
  }

  console.log("-> Market Pricing Minimum Constraint PASSED!");
};

testPlanetarySpawnChance();
testDeepSpaceDiscovery();
testDiscoveryCooldown();
testDiplomacyLinkBreak();
testSpecialFuelConsumption();
testSpecialDuraniumConsumption();
testDiplomatTargetSelection();
testMarketPricingMinimumConstraint();

console.log("\nALL NEW ANOMALY TESTS PASSED SUCCESSFULLY!");
process.exit(0);
