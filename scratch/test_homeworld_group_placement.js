import { Game } from '../src/game.js';
import { Planet } from '../src/entities/Planet.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Homeworld Group Placement ===");

// Helper to calculate distance to the 3rd closest non-homeworld planet
function getGroupDist(game, pos) {
  const others = game.planets.filter(p => p !== pos && !p.homeworldOf);
  const dists = others.map(p => Math.sqrt((p.x - pos.x)**2 + (p.y - pos.y)**2)).sort((a, b) => a - b);
  return dists.length >= 3 ? dists[2] : (dists.length >= 2 ? dists[1] : (dists[0] || Infinity));
}

// Test Case 1: Non-Natural placement (creates a new planet)
{
  console.log("Running Case 1: Non-Natural Placement (New Planet)");
  const game = new Game({ width: 2000, height: 2000 });
  game.planets = [];
  game.settings = { homeworldSize: "120" }; // Not 'natural'

  // Let's seed a group of 3 planets close to each other in one corner
  // Group A (around 400, 400)
  game.planets.push(new Planet(1, 400, 400, 20, null, 10, 2000, 2000));
  game.planets.push(new Planet(2, 450, 400, 20, null, 10, 2000, 2000));
  game.planets.push(new Planet(3, 400, 450, 20, null, 10, 2000, 2000));

  // Let's seed a single isolated planet at (1500, 1500)
  game.planets.push(new Planet(4, 1500, 1500, 20, null, 10, 2000, 2000));

  const player = new Player(1, "Player 1", "#ff0000", false);
  player.needsPlanet = true;

  const success = game.assignPlanet(player);
  assert(success !== false, "assignPlanet should succeed");

  // Find the created homeworld
  const hw = game.planets.find(p => p.homeworldOf === player.id);
  assert(hw !== undefined, "Should have created a homeworld planet");

  const gDist = getGroupDist(game, hw);
  console.log(`Created Homeworld at (${Math.round(hw.x)}, ${Math.round(hw.y)}). Distance to 3rd closest planet: ${gDist.toFixed(1)}`);
  assert(gDist <= 350, "Homeworld should be placed not too far away from the group of planets");
  console.log("-> Case 1 Passed!");
}

// Test Case 2: Natural placement (selects an existing planet)
{
  console.log("\nRunning Case 2: Natural Placement (Select Existing Planet)");
  const game = new Game({ width: 2000, height: 2000 });
  game.planets = [];
  game.settings = { homeworldSize: "natural" };

  // Set up:
  // Group A (planets 1, 2, 3, 4 close to each other)
  // Planet 1 is part of Group A
  const p1 = new Planet(1, 400, 400, 30, null, 10, 2000, 2000);
  p1.maxShips = 120; // meets size > 115 criterion
  game.planets.push(p1);
  game.planets.push(new Planet(2, 450, 400, 20, null, 10, 2000, 2000));
  game.planets.push(new Planet(3, 400, 450, 20, null, 10, 2000, 2000));
  game.planets.push(new Planet(4, 450, 450, 20, null, 10, 2000, 2000));

  // Isolated candidate planet 5 (very far from any groups, only has 1 neighbor within 1000 units)
  const p5 = new Planet(5, 1500, 1500, 30, null, 10, 2000, 2000);
  p5.maxShips = 120; // meets size > 115 criterion
  game.planets.push(p5);

  const player = new Player(1, "Player 1", "#ff0000", false);
  player.needsPlanet = true;

  const success = game.assignPlanet(player);
  assert(success !== false, "assignPlanet should succeed");

  const hw = game.planets.find(p => p.homeworldOf === player.id);
  assert(hw !== undefined, "Should have selected a homeworld planet");
  console.log(`Selected Homeworld at (${Math.round(hw.x)}, ${Math.round(hw.y)}) [ID: ${hw.id}].`);
  assert(hw.id === 1, "Should select planet 1 (which is part of/near the group) over the isolated planet 5");
  console.log("-> Case 2 Passed!");
}

console.log("\nAll Homeworld Placement tests PASSED!");
