import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

// Setup mock environment
global.requestAnimationFrame = () => {};
Array.prototype.updateGrid = () => {};

console.log("=== Testing Cruiser Command Upgrade ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
game.allPlayers = [owner];
game.planets = [];

// Create commander 1: Cruiser with command upgrade level 3, expScore 64 (xp bonus = 8)
const cmd1 = new Ship('cmd1', 100, 100, null, owner, 100, 100);
cmd1.isCruiser = true;
cmd1.maxHealth = 25;
cmd1.health = 25;
cmd1.command = 3;
cmd1.expScore = 64; // sqrt(64) = 8
cmd1.cruiserRadarRange = () => 200;

// Create commander 2: Cruiser with command upgrade level 2, expScore 16 (xp bonus = 4)
const cmd2 = new Ship('cmd2', 150, 100, null, owner, 150, 100);
cmd2.isCruiser = true;
cmd2.maxHealth = 25;
cmd2.health = 25;
cmd2.command = 2;
cmd2.expScore = 16; // sqrt(16) = 4
cmd2.cruiserRadarRange = () => 200;

// Create target ship: Standard ship within range of both commanders, expScore 9 (xp bonus = 3)
const target = new Ship('target', 120, 100, null, owner, 120, 100);
target.expScore = 9; // sqrt(9) = 3
target.speed = 10;

game.ships = [cmd1, cmd2, target];

// Run update tick
game.update(1.0);

// Verify Calculations
// Contribution 1: (8 * 3) / 4 = 6 command points
// Contribution 2: (4 * 2) / 4 = 2 command points
// Sum CP = 6 + 2 = 8 command points
// Cap: 1.5 * max(8, 4) = 1.5 * 8 = 12 command points
// Expected target command points: min(8, 12) = 8
console.log(`- Expected Target Command Points: 8`);
console.log(`- Actual Target Command Points: ${target.commandPoints}`);

const targetXpBonus = target.getLocalXpBonus();
const expectedXpBonus = Math.sqrt(9) + 8; // 3 + 8 = 11
console.log(`- Expected Target Local XP Bonus: 11`);
console.log(`- Actual Target Local XP Bonus: ${targetXpBonus}`);

const targetMaxSpeed = target.getMaxSpeed();
// Base speed 10, no tech bonus on p1. Speed bonus = 8 * 0.5 = 4. Total = 14
console.log(`- Expected Target Max Speed: 14`);
console.log(`- Actual Target Max Speed: ${targetMaxSpeed}`);

let passed = true;
if (Math.abs(target.commandPoints - 8) > 0.001) {
  console.log("FAIL: Target command points mismatch!");
  passed = false;
}
if (Math.abs(targetXpBonus - 11) > 0.001) {
  console.log("FAIL: Target local XP bonus mismatch!");
  passed = false;
}
if (Math.abs(targetMaxSpeed - 14) > 0.001) {
  console.log("FAIL: Target max speed mismatch!");
  passed = false;
}

// Test capping: Increase cmd2 level to 5, and expScore to 100 (xp bonus = 10)
// cmd1 contribution: (8 * 3) / 4 = 6
// cmd2 contribution: (10 * 5) / 4 = 12.5
// Sum CP = 6 + 12.5 = 18.5
// Cap: 1.5 * max(8, 10) = 1.5 * 10 = 15
// Expected target command points: min(18.5, 15) = 15
cmd2.command = 5;
cmd2.expScore = 100;

game.update(1.0);

const cp1 = (Math.sqrt(cmd1.expScore || 0) * cmd1.command) / 4;
const cp2 = (Math.sqrt(cmd2.expScore || 0) * cmd2.command) / 4;
const sumCP = cp1 + cp2;
const maxXPBonus = Math.max(Math.sqrt(cmd1.expScore || 0), Math.sqrt(cmd2.expScore || 0));
const expectedCapped = Math.min(sumCP, 1.5 * maxXPBonus);

console.log(`\n- Expected Target Command Points (Capped): ${expectedCapped}`);
console.log(`- Actual Target Command Points (Capped): ${target.commandPoints}`);

if (Math.abs(target.commandPoints - expectedCapped) > 0.001) {
  console.log("FAIL: Capping target command points mismatch!");
  passed = false;
}

if (passed) {
  console.log("\n-> Cruiser Command Upgrade tests: PASSED");
  process.exit(0);
} else {
  console.log("\n-> Cruiser Command Upgrade tests: FAILED");
  process.exit(1);
}
