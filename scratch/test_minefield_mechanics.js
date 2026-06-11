import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

global.Math.random = () => 0.1;

console.log("=== Testing Minefield Mechanics Redesign ===");

const game = new Game();
game.width = 1600;
game.height = 1200;

const human = new Player('human', '#0ff', false);
human.isAlive = true;
const aiPlayer = new Player('ai', '#f00', false);
aiPlayer.isAI = true;
aiPlayer.isAlive = true;

game.allPlayers = [human, aiPlayer];
game.planets = [];

// Spawn a minefield at (500, 500)
const minefield = {
  id: 1,
  name: 'Test Minefield',
  type: 'minefield',
  x: 500,
  y: 500,
  radius: 200,
  initialRadius: 200,
  mines: 20,
  initialMines: 20,
  intensity: 50,
  knowledge: {}
};
game.ionStorms = [minefield];

// Helper to calculate hazardSensorReduction
// (Mock global function since it's defined in game.js or global scope)
global.hazardSensorReduction = () => 0;

console.log("\n--- Part 1: Testing Lab Research Mining ---");
// Human cruiser at (500, 710) using labs, researching, attack mode
const cruiser = new Ship('c_human', 500, 710, null, human);
cruiser.isCruiser = true;
cruiser.maxHealth = 50;
cruiser.health = 50;
cruiser.fuel = 100;
cruiser.labs = 3;
cruiser.isResearching = true;
cruiser.scoutAttackEnabled = true;
// Mock cruiserRadarRange method
cruiser.cruiserRadarRange = () => 150;

game.ships.length = 0;
game.ships.push(cruiser);

const startCredits = human.credits || 0;
const startMines = minefield.mines;

cruiser.accumulatedTech = 1.0;
game.update(1000); // Trigger 1 second update
const minesDiff = startMines - minefield.mines;
cruiser.isResearching = false; // Disable research so second update doesn't sweep more mines
game.update(1000); // Trigger second update to process scheduled events (laser/explosion animations)

const creditsDiff = (human.credits || 0) - startCredits;

console.log(`Mines destroyed by research: ${minesDiff}`);
console.log(`Credits gained by research: ${creditsDiff}`);
if (minesDiff !== 16) {
  console.error(`-> FAILED: Expected 16 mines destroyed (volley size 16, all hitting), got ${minesDiff}`);
  process.exit(1);
}
if (Math.round(creditsDiff) !== minesDiff) {
  console.error(`-> FAILED: Expected credits gained to equal mines destroyed (${minesDiff}), got ${creditsDiff}`);
  process.exit(1);
}
// Verify dollar sign explosions were pushed
const dollarExplosions = game.explosions.filter(e => e.isDollarSign);
if (dollarExplosions.length !== minesDiff) {
  console.error(`-> FAILED: Expected ${minesDiff} dollar sign explosions, got ${dollarExplosions.length}`);
  process.exit(1);
}
if (dollarExplosions.some(e => e.amount !== 1)) {
  console.error(`-> FAILED: Expected all dollar sign explosions to have amount 1`);
  process.exit(1);
}
console.log("-> PASSED: Lab research mining correctly destroys mines, awards credits, and triggers animations.");

console.log("\n--- Part 2: Testing Minefield Damage & Depletion ---");
// Let's test cruiser damage (human vs AI)
// Reset minefield to 50 mines
minefield.mines = 50;
minefield.initialMines = 50;
game.ionStorms = [minefield];
game.explosions.length = 0;

// Human cruiser inside minefield (not researching)
cruiser.y = 500;
cruiser.isResearching = false;
cruiser.scoutAttackEnabled = false;
cruiser.health = 50;
cruiser.targetX = 500;
cruiser.targetY = 600;

const startCruiserMines = minefield.mines;
game.update(1000);

const cruiserDamage = 50 - cruiser.health;
console.log(`Human cruiser took ${cruiserDamage} damage.`);
if (cruiserDamage !== 1) {
  console.error(`-> FAILED: Human cruiser should take exactly 1 damage in minefield.`);
  process.exit(1);
}
if (minefield.mines !== startCruiserMines - 1) {
  console.error(`-> FAILED: Exactly 1 mine should be removed from minefield, got: ${startCruiserMines - minefield.mines}`);
  process.exit(1);
}

// AI cruiser inside minefield
const aiCruiser = new Ship('c_ai', 500, 500, null, aiPlayer);
aiCruiser.isCruiser = true;
aiCruiser.maxHealth = 50;
aiCruiser.health = 50;
aiCruiser.fuel = 100;
aiCruiser.cruiserRadarRange = () => 150;
aiCruiser.targetX = 500;
aiCruiser.targetY = 600;

game.ships.length = 0;
game.ships.push(aiCruiser);

game.update(1000);
const aiCruiserDamage = 50 - aiCruiser.health;
console.log(`AI cruiser took ${aiCruiserDamage} damage.`);
if (aiCruiserDamage !== 0.25) {
  console.error(`-> FAILED: AI cruiser should take exactly 1/4 (0.25) damage in minefield.`);
  process.exit(1);
}

console.log("-> PASSED: Cruiser damage and mine depletion are correct.");

// Test standard fleet damage (human vs AI)
console.log("\n--- Part 3: Testing Standard Fleet Damage ---");
const fleet = new Ship('f_human', 500, 500, null, human);
fleet.count = 1000;
fleet.isCruiser = false;
fleet.maxHealth = 0;
fleet.targetX = 500;
fleet.targetY = 600;

game.ships.length = 0;
game.ships.push(fleet);
minefield.mines = 50;

const startFleetMines = minefield.mines;
game.update(1000);

const fleetMinesRemoved = startFleetMines - minefield.mines;
const fleetLoss = 1000 - fleet.count;
const fleetPctLoss = (fleetLoss / 1000) * 100;
console.log(`Human standard fleet lost ${fleetLoss} ships (${fleetPctLoss.toFixed(1)}%).`);
console.log(`Mines removed: ${fleetMinesRemoved}`);

if (fleetPctLoss < 3 || fleetPctLoss > 18) {
  console.error(`-> FAILED: Human fleet percentage loss should be 3d6% (3-18%), got ${fleetPctLoss.toFixed(1)}%`);
  process.exit(1);
}
if (fleetMinesRemoved !== 1) {
  console.error(`-> FAILED: Exactly 1 mine should be removed per hit on fleet.`);
  process.exit(1);
}

// AI fleet
const aiFleet = new Ship('f_ai', 500, 500, null, aiPlayer);
aiFleet.count = 1000;
aiFleet.isCruiser = false;
aiFleet.maxHealth = 0;
aiFleet.targetX = 500;
aiFleet.targetY = 600;

game.ships.length = 0;
game.ships.push(aiFleet);
minefield.mines = 50;

game.update(1000);
const aiFleetLoss = 1000 - aiFleet.count;
const aiFleetPctLoss = (aiFleetLoss / 1000) * 100;
console.log(`AI standard fleet lost ${aiFleetLoss} ships (${aiFleetPctLoss.toFixed(1)}%).`);
// Expected AI damage is 1/4 of human damage, i.e., (3-18)% / 4 = 0.75% to 4.5%
if (aiFleetPctLoss < 0.7 || aiFleetPctLoss > 4.6) {
  console.error(`-> FAILED: AI fleet percentage loss should be 1/4 of 3d6% (0.75-4.5%), got ${aiFleetPctLoss.toFixed(1)}%`);
  process.exit(1);
}

console.log("-> PASSED: Standard fleet damage (3d6% for human, 1/4 for AI) is correct.");

console.log("\n--- Part 4: Testing Minefield Removal ---");
// If a minefield is reduced below 8 mines, remove it from the map.
minefield.mines = 8;
game.ships.length = 0;
game.ships.push(fleet); // Fleet inside minefield to trigger hit and reduce mines to 7

game.update(1000);
console.log(`Mines remaining: ${minefield.mines}`);
console.log(`Active ion storms count: ${game.ionStorms.length}`);

if (game.ionStorms.length !== 0) {
  console.error(`-> FAILED: Minefield should be removed from the map when mines count falls below 8.`);
  process.exit(1);
}
console.log("-> PASSED: Minefield is successfully removed when mines drop below 8.");

console.log("\nAll minefield mechanics redesign checks passed!");
