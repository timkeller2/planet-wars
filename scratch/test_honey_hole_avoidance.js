import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import assert from 'assert';

console.log("Starting Honey Hole Avoidance and Default Starting Credits Test...");

// 1. Verify that a new player is constructed with 0 credits by default.
const player = new Player('p1', '#00ff00', false);
assert.strictEqual(player.credits, 0, "Default Player credits must be 0");
console.log("✓ Player default credits is 0");

// 2. Setup game and mock planets.
const game = new Game({ width: 2000, height: 2000 });
game.settings = {
  homeworldSize: "120",
  startingCredits: 0
};
game.isRunning = true;
game.planets = [];

// Create a honey hole of non-homeworld planets at (200, 200)
// High maxShips (e.g. 500) within 400px of (200, 200).
for (let i = 0; i < 5; i++) {
  const x = 200 + i * 20;
  const y = 200 + i * 20;
  const planet = new Planet(i + 1, x, y, 40, null, 100, 2000, 2000);
  planet.maxShips = 500;
  game.planets.push(planet);
}

// Create some isolated low-economy planets at (1500, 1500)
for (let i = 0; i < 5; i++) {
  const x = 1500 + i * 20;
  const y = 1500 + i * 20;
  const planet = new Planet(i + 10, x, y, 20, null, 20, 2000, 2000);
  planet.maxShips = 30;
  game.planets.push(planet);
}

// 3. Test assignPlanet for a new player (this will try to create a new homeworld)
// It should place the homeworld far from the (200, 200) cluster since that's a honey hole.
game.allPlayers = [player];
game.assignPlanet(player);

const createdPlanet = game.planets.find(p => p.owner === player);
assert.ok(createdPlanet, "Homeworld planet should be created and owned by player");

// Calculate distance to (200, 200)
const distToHoneyHole = Math.sqrt((createdPlanet.x - 200) ** 2 + (createdPlanet.y - 200) ** 2);
console.log(`Created Homeworld at (${createdPlanet.x.toFixed(1)}, ${createdPlanet.y.toFixed(1)})`);
console.log(`Distance to Honey Hole center: ${distToHoneyHole.toFixed(1)}px`);
assert.ok(distToHoneyHole > 400, "Homeworld must not be placed within 400px of the honey hole!");
console.log("✓ Homeworld placed successfully away from honey hole");

// 4. Test assignPlanet to existing neutral planet (noNatural = true)
game.settings.homeworldSize = "natural"; // forces existing neutral planet assignment
const p2 = new Player('p2', '#ff0000', false);
game.allPlayers.push(p2);
game.assignPlanet(p2);

const assignedPlanet = game.planets.find(p => p.owner === p2);
assert.ok(assignedPlanet, "An existing planet should be assigned to p2");
const distToHoneyHole2 = Math.sqrt((assignedPlanet.x - 200) ** 2 + (assignedPlanet.y - 200) ** 2);
console.log(`Assigned planet at (${assignedPlanet.x.toFixed(1)}, ${assignedPlanet.y.toFixed(1)})`);
console.log(`Distance to Honey Hole center: ${distToHoneyHole2.toFixed(1)}px`);
assert.ok(distToHoneyHole2 > 400, "Assigned planet must not be within the honey hole!");
console.log("✓ Neutral planet assigned successfully away from honey hole");

console.log("All tests passed!");
