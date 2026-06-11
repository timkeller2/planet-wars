import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

global.Math.random = () => 0.1;

console.log("=== Testing Decoupled Research & Research Spaces ===");

const game = new Game();
game.width = 1600;
game.height = 1200;

const human = new Player('human', '#0ff', false);
human.isAlive = true;

game.allPlayers = [human];
game.planets = [];
game.ships.length = 0;

// Helper to calculate hazardSensorReduction
global.hazardSensorReduction = () => 0;

// Test Case 1: Minefield Research with Attack Mode OFF
console.log("\n--- Part 1: Minefield Research with Attack Mode OFF ---");
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
  intensity: 50,
  knowledge: {}
};
game.ionStorms = [minefield];

const cruiser = new Ship('c_human', 500, 500, null, human);
cruiser.isCruiser = true;
cruiser.maxHealth = 50;
cruiser.health = 50;
cruiser.fuel = 100;
cruiser.labs = 4;
cruiser.isResearching = true;
cruiser.scoutAttackEnabled = false; // ATTACK MODE OFF
cruiser.cruiserRadarRange = () => 150;

game.ships.length = 0;
game.ships.push(cruiser);

// Simulate enough time to trigger completions (completions require accumulatedTech >= 1.0)
// With labs = 4, deltaTime = 60000ms:
// knowledgeGained = (4 * 60000) / 120000 = 2.0
const startCredits = human.credits || 0;
const startMines = minefield.mines;
human.techScore = 0;
cruiser.accumulatedTech = 0;
cruiser.beakerIncreaseEvent = 0;

game.update(60000);

console.log(`Initial mines: ${startMines}, Current mines: ${minefield.mines}`);
console.log(`Cruiser accumulatedTech: ${cruiser.accumulatedTech}`);
console.log(`Cruiser beakerIncreaseEvent: ${cruiser.beakerIncreaseEvent}`);
console.log(`Player techScore: ${human.techScore}`);

if (minefield.mines !== startMines) {
  console.error("-> FAILED: Mines should not be destroyed when attack mode is off!");
  process.exit(1);
}
if (human.techScore !== 2.0) {
  console.error(`-> FAILED: Expected player techScore to increase by 2.0, got ${human.techScore}`);
  process.exit(1);
}
if (cruiser.beakerIncreaseEvent !== 2) {
  console.error(`-> FAILED: Expected cruiser beakerIncreaseEvent to be 2, got ${cruiser.beakerIncreaseEvent}`);
  process.exit(1);
}
console.log("-> PASSED: Cruisers on minefields with attack mode off gain tech points and beakers, but do not destroy mines.");


// Test Case 2: Research Space Tech Generation
console.log("\n--- Part 2: Research Space Tech Generation ---");
// Clear storm, add a research planet
game.ionStorms = [];
const planet = new Planet(1, 800, 600, 30, null, 100, 1600, 1200);
planet.isResearch = true; // Research planet
planet.owner = human; // Friendly
game.planets = [planet];

// Place cruiser in gravity well of the research planet
cruiser.x = 810;
cruiser.y = 610;
cruiser.accumulatedTech = 0;
cruiser.beakerIncreaseEvent = 0;
human.techScore = 0;

// Update again
game.update(60000);

console.log(`Planet gravity radius: ${planet.getGravityRadius()}`);
console.log(`Player techScore: ${human.techScore}`);
console.log(`Cruiser beakerIncreaseEvent: ${cruiser.beakerIncreaseEvent}`);

if (human.techScore !== 2.0) {
  console.error(`-> FAILED: Expected player techScore to increase by 2.0 from friendly research space, got ${human.techScore}`);
  process.exit(1);
}
if (cruiser.beakerIncreaseEvent !== 2) {
  console.error(`-> FAILED: Expected cruiser beakerIncreaseEvent to be 2, got ${cruiser.beakerIncreaseEvent}`);
  process.exit(1);
}

// Check with neutral research planet
console.log("\n--- Part 3: Neutral Research Planet ---");
planet.owner = null; // Neutral
cruiser.accumulatedTech = 0;
cruiser.beakerIncreaseEvent = 0;
human.techScore = 0;

game.update(60000);

if (human.techScore !== 2.0) {
  console.error(`-> FAILED: Expected player techScore to increase by 2.0 from neutral research space, got ${human.techScore}`);
  process.exit(1);
}

// Check that enemy research planet does NOT generate tech points
console.log("\n--- Part 4: Enemy Research Planet (Should Not Generate) ---");
const enemy = new Player('enemy', '#f00', false);
enemy.isAlive = true;
planet.owner = enemy; // Enemy
cruiser.accumulatedTech = 0;
cruiser.beakerIncreaseEvent = 0;
human.techScore = 0;

game.update(60000);

if (human.techScore !== 0) {
  console.error(`-> FAILED: Expected player techScore to remain 0 in enemy research space, got ${human.techScore}`);
  process.exit(1);
}

console.log("-> PASSED: Friendly/neutral research spaces correctly award tech score, and enemy spaces are ignored.");
console.log("\nAll decoupled research and research space checks passed successfully!");
