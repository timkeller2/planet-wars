// Test trade soft cap logic
import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Trade Soft Cap and Money Bags Emoji Condition ===");

const game = new Game({ width: 2000, height: 2000 });
const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';
p1.resources = { tritanium: 100 };
const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

game.allPlayers = [p1, p2];

// Scenario 1: Own planet with commerce focus. Player 1 has 100 ships.
// otherEffectiveShips is 0, playerEffectiveShips is 100.
// Soft cap is not reached.
{
  const ownPlanet = new Planet(1, 100, 100, 25, p1, 100);
  ownPlanet.focusMode = 'commerce';
  ownPlanet.maxShips = 100; // not full (ships = 100, so ships >= maxShips is true, meaning full!)
  // Since ships >= maxShips, eff = ships * 4 = 400.
  
  game.planets = [ownPlanet];

  // Run updateTradingIncome logic on the game
  // Since we want to test game.js logic, let's call the game loop update trading logic.
  // Wait, let's manually run the calculations from src/game.js to verify playerEffectiveShips and otherEffectiveShips are populated correctly.
  
  game.update(50); // call update which calls passive trading income logic

  console.log("P1 playerEffectiveShips:", p1.playerEffectiveShips);
  console.log("P1 otherEffectiveShips:", p1.otherEffectiveShips);
  
  assert(p1.playerEffectiveShips === 400, "playerEffectiveShips should be 400");
  assert(p1.otherEffectiveShips === 0, "otherEffectiveShips should be 0");
  
  const hasMoneyBags = p1.otherEffectiveShips >= p1.playerEffectiveShips && p1.playerEffectiveShips > 0;
  assert(!hasMoneyBags, "Should not show money bags when otherEffectiveShips < playerEffectiveShips");
}

// Scenario 2: Add a friendly/neutral planet with commerce focus.
// Player 2 has a planet with 500 ships.
// otherEffectiveShips = 500 * 4 = 2000.
// playerEffectiveShips = 400.
// Soft cap is reached (2000 >= 400).
{
  const ownPlanet = new Planet(1, 100, 100, 25, p1, 100);
  ownPlanet.focusMode = 'commerce';
  ownPlanet.maxShips = 100;

  const partnerPlanet = new Planet(2, 300, 300, 25, p2, 500);
  partnerPlanet.focusMode = 'commerce';
  partnerPlanet.maxShips = 100; // full

  game.planets = [ownPlanet, partnerPlanet];
  
  // Make sure they are visible/known to p1
  game.isPlanetVisibleTo = () => true;

  game.update(50);

  console.log("P1 playerEffectiveShips:", p1.playerEffectiveShips);
  console.log("P1 otherEffectiveShips:", p1.otherEffectiveShips);

  assert(p1.playerEffectiveShips === 400, "playerEffectiveShips should be 400");
  assert(p1.otherEffectiveShips === 2000, "otherEffectiveShips should be 2000");

  const hasMoneyBags = p1.otherEffectiveShips >= p1.playerEffectiveShips && p1.playerEffectiveShips > 0;
  assert(hasMoneyBags, "Should show money bags when otherEffectiveShips >= playerEffectiveShips");
}

console.log("All trade soft cap tests passed successfully!");
