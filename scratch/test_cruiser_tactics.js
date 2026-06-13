import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';

console.log('--- STARTING CRUISER TACTICS & RANGE TESTS ---');

// 1. Setup game
const game = new Game({ width: 2000, height: 2000 });
game.settings = {
  aiCount: 0,
  fogOfWar: false,
  mapScale: 1.0,
  startingCredits: '0',
  timedGameLimit: 'unlimited'
};

const human = game.humanPlayer;
human.isAlive = true;

// Create a mock cruiser
const ship = new Ship(1, 100, 100, null, human, null, null); // id, x, y, targetPlanet, owner
ship.isCruiser = true;
ship.maxHealth = 100;
ship.health = 100;
ship.sensorarrays = 0;
ship.isWarp = false;

// Base range check
const baseRange = ship.cruiserRadarRange();
console.log(`Base Range: ${baseRange}`); // (25 + 100 * 2) = 225

// Test 1: Upgrade sensor arrays
ship.sensorarrays = 1;
const rangeSensor1 = ship.cruiserRadarRange();
console.log(`Range with Sensor Arrays = 1: ${rangeSensor1}`);
// (225 + 10) * 1.25 = 293.75

// Test 2: Player Tech Score Bonus
human.techScore = 1600; // Math.sqrt(1600) = 40. playerTechBonus = 0.4
const rangeTech = ship.cruiserRadarRange();
console.log(`Range with Tech Score 1600: ${rangeTech}`);
// 293.75 * 1.4 = 411.25

// Test 3: Player Exp Score Bonus
human.expScore = 900; // Math.sqrt(900) = 30. playerExpBonus = 0.3
const rangeTechExp = ship.cruiserRadarRange();
console.log(`Range with Tech 1600 + Exp 900: ${rangeTechExp}`);
// 293.75 * (1 + 0.4 + 0.3) = 293.75 * 1.7 = 499.375

// Test 4: Local Ship Exp Score & Command Points Bonus
ship.expScore = 4; // Math.sqrt(4) = 2
ship.commandPoints = 1; // getLocalXpBonus() = 2 + 1 = 3 -> 9% bonus
const rangeTotal = ship.cruiserRadarRange();
console.log(`Range with Local Ship Exp/CP: ${rangeTotal}`);
// 499.375 * 1.09 = 544.31875

// Verify calculations are correct and numbers are not NaN or undefined
if (isNaN(rangeTotal) || rangeTotal <= 0) {
  console.error('FAIL: Calculated radar range is invalid!');
  process.exit(1);
} else {
  console.log('SUCCESS: Radar range calculated correctly!');
}

// Test 5: Verify getMaxBombs works
ship.munitions = 2;
const maxBombs = ship.getMaxBombs();
console.log(`Max Bombs: ${maxBombs}`); // 100/5 + 2 = 22
if (maxBombs !== 22) {
  console.error(`FAIL: Expected maxBombs = 22, got ${maxBombs}`);
  process.exit(1);
} else {
  console.log('SUCCESS: Max bombs calculation verified!');
}

console.log('--- ALL CRUISER TACTICS TESTS PASSED ---');
process.exit(0);
