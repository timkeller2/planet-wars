import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

console.log("=== Testing Stockpile Storage Fee Rate Halving ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
owner.credits = 1000;

game.players = [owner];
game.allPlayers = [owner];

// Add 10 planets owned by owner to establish a capacity of 7
game.planets = [];
for (let i = 0; i < 10; i++) {
  const p = new Planet(i, 100 + i * 20, 100, 15, owner, 0);
  p.isMilitary = false;
  p.homeworldOf = null;
  game.planets.push(p);
}

// Set player resources
owner.resources = {
  dilithium: 15, // Total stockpile = 15, capacity = 7, excess = 8
  merculite: 0,
  duranium: 0,
  tritanium: 0,
  antimatter: 0,
  deuterium: 0,
  latinum: 0
};

// Tick game for 1 second (1000ms) to trigger storage fee accumulator processing
// game.update(deltaTime)
game.update(1000);

console.log(`- Total Stockpile: ${owner.totalStockpile}`);
console.log(`- Stockpile Capacity: ${owner.stockpileCapacity}`);
console.log(`- Storage Fee Rate per Minute: ${owner.storageFeeRate}`);
console.log(`- Player Credits: ${owner.credits}`);

// Under new formula: excess = 8, capacity = 7.
// storageFee = 8 / (7 * 8) = 1/7 credits per second.
// storageFeeRate = (1/7) * 60 = 8.57142857 per minute.
// Credits after interest and fee: 1000 + (1000 * 0.005 / 60000 * 1000) - (1/7)
// = 1000 + (1/12) - (1/7) = 1000 - 5/84 = 999.94047619
const expectedRate = 60 / 7;
const expectedCredits = 1000 - (5 / 84);

const rateMatch = Math.abs(owner.storageFeeRate - expectedRate) < 0.0001;
const creditsMatch = Math.abs(owner.credits - expectedCredits) < 0.0001;

if (rateMatch && creditsMatch) {
  console.log(`-> PASSED: Stockpile storage fee rate is halved correctly (${owner.storageFeeRate.toFixed(4)}/min, ${owner.credits.toFixed(4)} credits)`);
} else {
  console.log("-> FAILED");
  process.exit(1);
}

console.log("\nAll storage fee tests passed!");
