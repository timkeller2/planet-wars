import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { Ship } from '../src/entities/Ship.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing sendShips Tritanium & Capacity Costs ===");

// Helper to set up a clean game state
function createTestState() {
  const game = new Game();
  const p1 = new Player('p1', '#0ff', false);
  const p2 = new Player('p2', '#f00', false);
  game.allPlayers.push(p1, p2);
  
  const source = new Planet(1, 100, 100, 30, p1, 100);
  source.maxShips = 100;
  
  const friendly = new Planet(2, 500, 100, 30, p1, 10);
  friendly.maxShips = 100;
  
  const enemy = new Planet(3, 500, 500, 30, p2, 10);
  enemy.maxShips = 100;

  const neutral = new Planet(4, 200, 200, 30, null, 10);
  neutral.maxShips = 100;
  
  game.planets.push(source, friendly, enemy, neutral);
  return { game, p1, p2, source, friendly, enemy, neutral };
}

// Test 1: Reinforcing friendly planet (should NOT consume tritanium, should deduct maxShips)
{
  console.log("\n--- Test 1: Reinforcing friendly planet ---");
  const { game, p1, source, friendly } = createTestState();
  p1.resources.tritanium = 10.0;
  p1.tradeLimitToggle = true;
  source.useResources = true;
  source.ships = 100;
  source.maxShips = 100;

  game.sendShips(source, friendly, false, null, false, 50);

  console.log("Tritanium remaining:", p1.resources.tritanium);
  console.log("Source max ships:", source.maxShips);

  assert(p1.resources.tritanium === 10.0, "Tritanium should NOT be consumed for reinforcing friendly planets");
  assert(source.maxShips === 99, "maxShips should decrease by floor(50/50) = 1");
  console.log("-> Test 1 Passed!");
}

// Test 2: Attacking neutral planet (should consume tritanium, should NOT deduct maxShips)
{
  console.log("\n--- Test 2: Attacking neutral planet ---");
  const { game, p1, source, neutral } = createTestState();
  p1.resources.tritanium = 10.0;
  p1.tradeLimitToggle = true;
  source.useResources = true;
  source.ships = 100;
  source.maxShips = 100;

  game.sendShips(source, neutral, false, null, false, 50);

  console.log("Tritanium remaining:", p1.resources.tritanium);
  console.log("Source max ships:", source.maxShips);

  assert(p1.resources.tritanium === 9.5, "Tritanium should be consumed (50 * 0.01 = 0.5)");
  assert(source.maxShips === 100, "maxShips should NOT decrease when paying with Tritanium");
  console.log("-> Test 2 Passed!");
}

// Test 3: Attacking enemy planet (should consume tritanium, should NOT deduct maxShips)
{
  console.log("\n--- Test 3: Attacking enemy planet ---");
  const { game, p1, source, enemy } = createTestState();
  p1.resources.tritanium = 10.0;
  p1.tradeLimitToggle = true;
  source.useResources = true;
  source.ships = 100;
  source.maxShips = 100;

  game.sendShips(source, enemy, false, null, false, 50);

  console.log("Tritanium remaining:", p1.resources.tritanium);
  console.log("Source max ships:", source.maxShips);

  assert(p1.resources.tritanium === 9.5, "Tritanium should be consumed (50 * 0.01 = 0.5)");
  assert(source.maxShips === 100, "maxShips should NOT decrease when paying with Tritanium");
  console.log("-> Test 3 Passed!");
}

// Test 4: Launching to space (should consume tritanium, should NOT deduct maxShips)
{
  console.log("\n--- Test 4: Launching to space ---");
  const { game, p1, source } = createTestState();
  p1.resources.tritanium = 10.0;
  p1.tradeLimitToggle = true;
  source.useResources = true;
  source.ships = 100;
  source.maxShips = 100;

  game.sendShipsToSpace(source, 200, 200, false, null, false, false, false);

  console.log("Tritanium remaining:", p1.resources.tritanium);
  console.log("Source max ships:", source.maxShips);

  // Default send size is floor(tempShips / 2) = floor(100 / 2) = 50.
  // Wait, in sendShipsToSpace:
  // let shipsToSend = scoutMode ? Math.max(3, Math.floor(source.ships * 0.1)) : Math.floor(source.ships / 2);
  // since source.ships = 100, shipsToSend is 50.
  // Tritanium cost = 50 * 0.01 = 0.5.
  assert(p1.resources.tritanium === 9.5, "Tritanium should be consumed for deep space launch");
  assert(source.maxShips === 100, "maxShips should NOT decrease when paying with Tritanium");
  console.log("-> Test 4 Passed!");
}

// Test 5: Standard launch capacity death check
{
  console.log("\n--- Test 5: Capacity death check ---");
  const { game, p1, source, friendly } = createTestState();
  // Reinforcing, so no Tritanium used.
  source.ships = 100;
  source.maxShips = 10; // Low maxShips

  // Launching 50 ships will deduct floor(50/50) = 1 maxShips.
  // maxShips will drop to 9, which is < 10, so it should die.
  game.sendShips(source, friendly, false, null, false, 50);

  console.log("Source max ships:", source.maxShips);
  console.log("Source planet dead:", source.dead);

  assert(source.maxShips === 9, "maxShips should decrease to 9");
  assert(source.dead === true, "Source planet should be dead (maxShips < 10)");
  console.log("-> Test 5 Passed!");
}

console.log("\nAll sendShips Tritanium & Capacity tests PASSED successfully!");
process.exit(0);
