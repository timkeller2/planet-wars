import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

global.Math.random = () => 0.1;

console.log("=== Testing Decoupled Research with Intensity > 0 Constraints ===");

const game = new Game();
game.width = 1600;
game.height = 1200;
game.isRunning = true;

const human = new Player('human', '#0ff', false);
human.isAlive = true;

game.allPlayers = [human];
game.planets = [];
game.ships.length = 0;

// Helper to calculate hazardSensorReduction
global.hazardSensorReduction = () => 0;

// Test Case 1: Minefield Research with Intensity > 0
console.log("\n--- Part 1: Minefield Research with Intensity > 0 ---");
const minefield = {
  id: 1,
  name: 'Test Minefield',
  type: 'minefield',
  x: 500,
  y: 500,
  radius: 200,
  initialRadius: 200,
  mines: 50,
  initialMines: 50,
  intensity: 10,
  knowledge: {}
};
game.ionStorms = [minefield];

const cruiser1 = new Ship('c_human1', 500, 500, null, human);
cruiser1.isCruiser = true;
cruiser1.maxHealth = 50;
cruiser1.health = 50;
cruiser1.fuel = 1000;
cruiser1.labs = 4;
cruiser1.isResearching = true;
cruiser1.scoutAttackEnabled = false;
cruiser1.cruiserRadarRange = () => 150;
cruiser1.checkSurvivalRoll = () => true;

game.ships.length = 0;
game.ships.push(cruiser1);

human.techScore = 0;
cruiser1.accumulatedTech = 0;
cruiser1.beakerIncreaseEvent = 0;

game.update(60000);

console.log(`Knowledge after T1: ${minefield.knowledge[human.id]}`);
console.log(`Cruiser accumulatedTech: ${cruiser1.accumulatedTech}`);
console.log(`Player techScore: ${human.techScore}`);

if (human.techScore !== 2.0) {
  console.error(`-> FAILED: Expected player techScore to increase by 2.0, got ${human.techScore}`);
  process.exit(1);
}

if (minefield.knowledge[human.id] !== 2.0) {
  console.error(`-> FAILED: Expected minefield knowledge to be 2.0, got ${minefield.knowledge[human.id]}`);
  process.exit(1);
}

// T2: Let's cheat and manually raise human knowledge on the minefield to 12.
minefield.knowledge[human.id] = 12;
human.techScore = 0;
cruiser1.accumulatedTech = 0;
cruiser1.beakerIncreaseEvent = 0;

game.update(60000);

console.log(`Knowledge after T2: ${minefield.knowledge[human.id]}`);
console.log(`Player techScore: ${human.techScore}`);

if (human.techScore !== 0) {
  console.error(`-> FAILED: Cruisers should not gain tech once effective intensity drops to 0! Got: ${human.techScore}`);
  process.exit(1);
}
console.log("-> PASSED: Minefield research requires effective intensity > 0, and knowledge accumulation works.");


// Test Case 2: Ion Storm (non-minefield) Research with Intensity > 0
console.log("\n--- Part 2: Ion Storm Research with Intensity > 0 ---");
const storm = {
  id: 2,
  name: 'Test Storm',
  type: 'storm',
  x: 500,
  y: 500,
  radius: 200,
  intensity: 10,
  knowledge: {},
  heading: 0,
  speed: 0
};
game.ionStorms = [storm];

const cruiser2 = new Ship('c_human2', 500, 500, null, human);
cruiser2.isCruiser = true;
cruiser2.maxHealth = 50;
cruiser2.health = 50;
cruiser2.fuel = 1000;
cruiser2.labs = 4;
cruiser2.isResearching = true;
cruiser2.scoutAttackEnabled = false;
cruiser2.cruiserRadarRange = () => 150;
cruiser2.checkSurvivalRoll = () => true;

game.ships.length = 0;
game.ships.push(cruiser2);

console.log("DEBUG BEFORE STORM T1:");
console.log(`cruiser2.active: ${cruiser2.active}`);
console.log(`cruiser2.isCruiser: ${cruiser2.isCruiser}`);
console.log(`cruiser2.labs: ${cruiser2.labs}`);
console.log(`cruiser2.owner.id: ${cruiser2.owner?.id}`);
console.log(`game.ships.length: ${game.ships.length}`);

human.techScore = 0;
cruiser2.accumulatedTech = 0;
cruiser2.beakerIncreaseEvent = 0;

game.update(60000);

console.log("DEBUG AFTER STORM T1:");
console.log(`cruiser2.active: ${cruiser2.active}`);
console.log(`cruiser2.health: ${cruiser2.health}`);
console.log(`cruiser2.fuel: ${cruiser2.fuel}`);

console.log(`Knowledge after Storm T1: ${storm.knowledge[human.id]}`);
console.log(`Player techScore: ${human.techScore}`);

if (human.techScore !== 2.0) {
  console.error(`-> FAILED: Expected player techScore to increase by 2.0 in Storm, got ${human.techScore}`);
  process.exit(1);
}

// Now raise knowledge to 12 to drop effective intensity to 0
storm.knowledge[human.id] = 12;
human.techScore = 0;
cruiser2.accumulatedTech = 0;

game.update(60000);

console.log(`Player techScore after Storm T2: ${human.techScore}`);
if (human.techScore !== 0) {
  console.error(`-> FAILED: Cruisers should not gain tech in Storm once effective intensity is 0! Got: ${human.techScore}`);
  process.exit(1);
}
console.log("-> PASSED: Ion storm research works and respects effective intensity > 0 constraint.");


// Test Case 3: Research Spaces Removed Verification
console.log("\n--- Part 3: Research Spaces Removed Verification ---");
game.ionStorms = [];
const planet = new Planet(1, 500, 500, 30, null, 100, 1600, 1200);
planet.isResearch = true;
planet.owner = human;
game.planets = [planet];

const cruiser3 = new Ship('c_human3', 500, 500, null, human);
cruiser3.isCruiser = true;
cruiser3.maxHealth = 50;
cruiser3.health = 50;
cruiser3.fuel = 1000;
cruiser3.labs = 4;
cruiser3.isResearching = true;
cruiser3.scoutAttackEnabled = false;
cruiser3.cruiserRadarRange = () => 150;
cruiser3.checkSurvivalRoll = () => true;

game.ships.length = 0;
game.ships.push(cruiser3);

human.techScore = 0;
cruiser3.accumulatedTech = 0;

game.update(60000);

console.log(`Player techScore in Research Space: ${human.techScore}`);
if (human.techScore !== 0) {
  console.error(`-> FAILED: Planetary research spaces should no longer award tech points! Got: ${human.techScore}`);
  process.exit(1);
}
console.log("-> PASSED: Planetary research spaces no longer generate tech points.");

console.log("\nAll decoupled research and intensity checks passed successfully!");
