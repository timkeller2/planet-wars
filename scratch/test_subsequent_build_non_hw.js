import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Subsequent Ship Builds on Non-Homeworld/Non-Military Planets ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
owner.credits = 1000;
owner.useCredits = true;
owner.builtClasses = {};
game.allPlayers = [owner];
game.players = [owner];

// Create a non-homeworld, non-military planet
// Planet constructor: constructor(id, x, y, radius, owner, initialShips)
const planet = new Planet(1, 100, 100, 15, owner, 20);
planet.isMilitary = false;
planet.homeworldOf = null;
planet.maxShips = 60;
game.planets = [planet];

// Helper to tick the game state
const tickGame = (seconds) => {
  const dt = 1000;
  for (let i = 0; i < seconds; i++) {
    const currentShips = [...game.ships];
    for (const ship of currentShips) {
      ship.update(dt, currentShips, [], [], [], [], 1000, game);
    }
  }
};

// 1. Test first build (Prototype)
console.log("Test Case 1: Building Prototype Corvette on Non-HW/Non-Mil Planet using Credits");
game.buildCapitalShip(planet, 'corvette');
tickGame(10); // Corvette max health is 15 -> materializeDuration is 7.5s
const initialCorvetteSpanned = game.ships.some(s => s.classType === 'corvette');
console.log(`- Corvette spawned: ${initialCorvetteSpanned}`);
console.log(`- Player credits: ${owner.credits}`);
console.log(`- Planet ships: ${planet.ships}`);
if (initialCorvetteSpanned && Math.round(owner.credits) === 900) {
  console.log("-> PASSED: Prototype built successfully using credits");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

// 2. Test second build (Subsequent build) on Non-HW/Non-Mil planet
console.log("\nTest Case 2: Building Subsequent Corvette on Non-HW/Non-Mil Planet using Credits");
// Reset planet ships to 20
planet.ships = 20;
// Trigger subsequent build
game.buildCapitalShip(planet, 'corvette');
tickGame(10);
const secondCorvetteSpanned = game.ships.filter(s => s.classType === 'corvette').length >= 2;
console.log(`- Second corvette spawned: ${secondCorvetteSpanned}`);
console.log(`- Player credits: ${owner.credits}`);
console.log(`- Planet ships: ${planet.ships}`);
if (secondCorvetteSpanned && Math.round(owner.credits) === 800) {
  console.log("-> PASSED: Subsequent build succeeded on non-HW/non-Mil planet using credits");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

// 3. Test subsequent build on Homeworld planet (should fail if not enough ships, since credits shouldn't count for affordability)
console.log("\nTest Case 3: Building Subsequent Corvette on Homeworld Planet (should fail without enough ships)");
const hwPlanet = new Planet(2, 200, 200, 15, owner, 20);
hwPlanet.isMilitary = false;
hwPlanet.homeworldOf = owner.id;
hwPlanet.maxShips = 300;
game.planets.push(hwPlanet);

const countBefore = game.ships.filter(s => s.classType === 'corvette').length;
game.buildCapitalShip(hwPlanet, 'corvette');
tickGame(10);
const countAfter = game.ships.filter(s => s.classType === 'corvette').length;
console.log(`- Corvette count before: ${countBefore}, after: ${countAfter}`);
if (countBefore === countAfter) {
  console.log("-> PASSED: Subsequent build correctly blocked on Homeworld because credits do not count for affordability check");
} else {
  console.log("-> FAILED");
  process.exit(1);
}

console.log("\nAll subsequent build tests passed!");
