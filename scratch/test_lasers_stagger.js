import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Minefield Laser & Explosion Staggering ===");

const game = new Game();
const human = new Player('human', '#0ff', false);
human.isAlive = true;
game.allPlayers = [human];

// Mock Math.random to always return 0.5
global.Math.random = () => 0.5;

const minefield = {
  id: 1,
  name: "Test Minefield",
  type: "minefield",
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
global.hazardSensorReduction = () => 0;

// Setup cruiser
const cruiser = new Ship('c_human', 500, 710, null, human);
cruiser.isCruiser = true;
cruiser.maxHealth = 50;
cruiser.health = 50;
cruiser.labs = 9;
cruiser.fuel = 100;
cruiser.isResearching = true;
cruiser.scoutAttackEnabled = true;
cruiser.cruiserRadarRange = () => 150;
game.ships.length = 0;
game.ships.push(cruiser);

console.log("Running first update (100ms with damage timer ready)...");
game.minefieldDamageTimer = 999;
cruiser.accumulatedTech = 1.0;
game.update(100);

game.minefieldDamageTimer = 0;

console.log("After update(100):");
console.log("scheduledEvents:", game.scheduledEvents.map(e => e.delay));

console.log("Ticking by 900ms...");
game.update(900);
game.minefieldDamageTimer = 0;
console.log("After update(900):");
console.log("scheduledEvents:", game.scheduledEvents.map(e => e.delay));

console.log("Ticking by 110ms...");
game.update(110);
game.minefieldDamageTimer = 0;
console.log("After update(110):");
console.log("scheduledEvents:", game.scheduledEvents.map(e => e.delay));

const blueExplosions = game.explosions.filter(e => e.color === '#44f');
const blueLasers = game.lasers.filter(l => l.color === '#44f');

console.log("Blue explosions count:", blueExplosions.length);
console.log("Blue lasers count:", blueLasers.length);

if (blueExplosions.length !== 16 || blueLasers.length !== 16) {
  console.error(`FAILED: Expected 16 blue explosions and 16 blue lasers, got: explosions=${blueExplosions.length}, lasers=${blueLasers.length}`);
  process.exit(1);
}

// Verify laser start coordinates are close to the cruiser's position (within 10px tolerance for drift)
for (const laser of blueLasers) {
  const dist = Math.sqrt((laser.startX - cruiser.x) ** 2 + (laser.startY - cruiser.y) ** 2);
  if (dist > 10) {
    console.error(`FAILED: Laser start coords (${laser.startX}, ${laser.startY}) are too far from cruiser coords (${cruiser.x}, ${cruiser.y}), dist: ${dist}`);
    process.exit(1);
  }
}

console.log("PASSED: Staggered lasers and blue explosions verified successfully!");
