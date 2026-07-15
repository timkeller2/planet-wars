import { Game } from '../src/game.js';
import { Planet } from '../src/entities/Planet.js';

const rarityToPrice = {
  common: 4,
  normal: 8,
  rare: 12,
  exotic: 16
};

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

function makePlanet(id, resources, minerals = 4) {
  const p = new Planet(id, 100, 100, 30, null, 10);
  p.resources = resources;
  p.minerals = minerals;
  return p;
}

function pricesMatchRarities(game) {
  for (const [res, rarity] of Object.entries(game.resourceRarities)) {
    const expected = rarityToPrice[rarity];
    if (game.marketPrices[res] !== expected) {
      return `${res}: price=${game.marketPrices[res]} rarity=${rarity} expected=${expected}`;
    }
  }
  return null;
}

console.log('Running rarity ↔ base price association tests...');

// --- 1) While isRunning, recalculate still sets base prices from rarity ---
{
  const game = new Game();
  game.isRunning = true; // mirrors multiplayer server after bootstrap
  game.planets = [
    makePlanet(1, ['dilithium', 'duranium', 'tritanium']),
    makePlanet(2, ['dilithium', 'duranium', 'tritanium']),
    makePlanet(3, ['dilithium', 'duranium']),
    makePlanet(4, ['dilithium']),
    makePlanet(5, ['merculite']), // scarce → rare/exotic
  ];
  game.recalculateResourceRarities();

  const mismatch = pricesMatchRarities(game);
  assert(!mismatch, `isRunning=true should still sync base prices: ${mismatch}`);
  console.log('  OK: base prices sync while isRunning=true');
  console.log('     rarities:', game.resourceRarities);
  console.log('     prices:  ', game.marketPrices);
}

// --- 2) Homeworld-style rarity change updates untouched base prices ---
{
  const game = new Game();
  game.isRunning = true;
  // First: merculite scarce
  game.planets = [
    makePlanet(1, ['dilithium', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum']),
    makePlanet(2, ['dilithium', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum']),
    makePlanet(3, ['merculite']),
  ];
  game.recalculateResourceRarities();
  const merculiteRarityBefore = game.resourceRarities.merculite;
  const merculitePriceBefore = game.marketPrices.merculite;
  assert(
    merculitePriceBefore === rarityToPrice[merculiteRarityBefore],
    `merculite price should match initial rarity (${merculiteRarityBefore})`
  );

  // Flood map with merculite (like many homeworlds adding deposits)
  for (let i = 0; i < 10; i++) {
    game.planets.push(makePlanet(100 + i, ['merculite', 'merculite']));
  }
  game.recalculateResourceRarities();
  const merculiteRarityAfter = game.resourceRarities.merculite;
  assert(
    game.marketPrices.merculite === rarityToPrice[merculiteRarityAfter],
    `after deposit flood, merculite price should track new rarity ` +
      `(${merculiteRarityAfter}, price=${game.marketPrices.merculite})`
  );
  console.log(
    `  OK: rarity change ${merculiteRarityBefore}→${merculiteRarityAfter} ` +
      `updated price ${merculitePriceBefore}→${game.marketPrices.merculite}`
  );
}

// --- 3) Market-moved prices are not overwritten by rarity recalculation ---
{
  const game = new Game();
  game.isRunning = true;
  game.planets = [
    makePlanet(1, ['dilithium', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum', 'merculite']),
    makePlanet(2, ['dilithium', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum']),
  ];
  game.recalculateResourceRarities();
  const rarity = game.resourceRarities.dilithium;
  const base = rarityToPrice[rarity];
  game.marketPrices.dilithium = base + 3; // simulate market buys

  // Change deposits so dilithium rarity would change if recalculated
  game.planets = [makePlanet(1, ['merculite']), makePlanet(2, ['merculite'])];
  game.recalculateResourceRarities();

  assert(
    game.marketPrices.dilithium === base + 3,
    `market-moved dilithium price should be preserved (got ${game.marketPrices.dilithium})`
  );
  console.log('  OK: market-moved prices preserved across rarity recalculation');
}

console.log('All rarity base price tests passed.');
