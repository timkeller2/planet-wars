import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import assert from 'assert';

console.log("Starting Metered Starting Credits Homeworld Placement Test...");

// 1. Verify Player credit initialization
const player = new Player('p1', '#00ff00', false);
assert.strictEqual(player.credits, 0, "Default Player credits must be 0");
console.log("✓ Player default credits is 0");

// 2. Setup game and mock planets.
// We will place 3 groups of planets to test metered honey hole thresholds:
// - Group A (Honey Hole) at (200, 200): 5 planets with maxShips = 500 (total local economy ~2500)
// - Group B (Mid Economy) at (800, 800): 5 planets with maxShips = 120 (total local economy ~600)
// - Group C (Low Economy) at (1500, 1500): 5 planets with maxShips = 20 (total local economy ~100)
function setupTestGame(startingCredits) {
  const game = new Game({ width: 2000, height: 2000 });
  game.settings = {
    homeworldSize: "natural", // forces existing neutral planet assignment to test selecting a candidate
    startingCredits: startingCredits
  };
  game.isRunning = true;
  game.planets = [];

  // Group A (Honey Hole)
  for (let i = 0; i < 5; i++) {
    const p = new Planet(i + 1, 200 + i * 10, 200 + i * 10, 30, null, 100, 2000, 2000);
    p.maxShips = 500;
    game.planets.push(p);
  }

  // Group B (Mid Economy)
  for (let i = 0; i < 5; i++) {
    const p = new Planet(i + 6, 800 + i * 10, 800 + i * 10, 25, null, 60, 2000, 2000);
    p.maxShips = 120;
    game.planets.push(p);
  }

  // Group C (Low Economy)
  for (let i = 0; i < 5; i++) {
    const p = new Planet(i + 11, 1500 + i * 10, 1500 + i * 10, 15, null, 10, 2000, 2000);
    p.maxShips = 20;
    game.planets.push(p);
  }

  return game;
}

// TEST CASE 1: startingCredits = 0
// maxAllowedEconomy = avgEconomy * 2
// avgEconomy is around 1066. maxAllowedEconomy = ~2133.
// Honey hole (~2500) is ABOVE threshold (excluded).
// Mid economy (~600) is BELOW threshold.
// Low economy (~100) is BELOW threshold.
// Highest economy below threshold is Mid economy, so it should select a planet from Group B.
{
  const game0 = setupTestGame(0);
  const p1 = new Player('p1', '#00ff00', false);
  game0.allPlayers = [p1];
  game0.assignPlanet(p1);

  const assigned = game0.planets.find(p => p.owner === p1);
  assert.ok(assigned, "Planet must be assigned to player");
  console.log(`With 0 credits, assigned planet maxShips: ${assigned.maxShips} at (${assigned.x.toFixed(1)}, ${assigned.y.toFixed(1)})`);
  
  // It should be one of the Group B planets (around x = 800)
  assert.ok(assigned.x >= 700 && assigned.x <= 900, "Should select from Mid Economy (Group B) when 0 credits");
  console.log("✓ Correctly selected Mid Economy planet, avoiding Honey Hole");
}

// TEST CASE 2: startingCredits = 250
// maxAllowedEconomy = avgEconomy * 3
// avgEconomy is around 1066. maxAllowedEconomy = ~3200.
// Honey hole (~2500) is BELOW threshold.
// Highest economy below threshold is Honey Hole, so it should select a planet from Group A.
{
  const game250 = setupTestGame(250);
  const p1 = new Player('p1', '#00ff00', false);
  game250.allPlayers = [p1];
  game250.assignPlanet(p1);

  const assigned = game250.planets.find(p => p.owner === p1);
  assert.ok(assigned, "Planet must be assigned to player");
  console.log(`With 250 credits, assigned planet maxShips: ${assigned.maxShips} at (${assigned.x.toFixed(1)}, ${assigned.y.toFixed(1)})`);
  
  // It should be one of the Group A planets (around x = 200)
  assert.ok(assigned.x >= 100 && assigned.x <= 300, "Should select from Honey Hole (Group A) when 250 credits");
  console.log("✓ Correctly selected Honey Hole planet because starting credits allows it");
}

console.log("All tests passed successfully!");
