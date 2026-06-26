import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function testCruiserOverlap() {
  console.log("Running Cruiser Overlap Distance Test...");

  const game = new Game();
  const player = new Player('human-1', '#ff0000', false);
  player.isAlive = true;
  
  game.allPlayers = [player];
  game.ships.length = 0;
  game.planets = [];

  // Create two cruisers close to each other
  // ship1: maxHealth = 30
  // ship2: maxHealth = 50
  const ship1 = new Ship(1, 100, 100, null, player, 100, 100);
  ship1.isCruiser = true;
  ship1.maxHealth = 30;
  ship1.health = 30;

  const ship2 = new Ship(2, 105, 100, null, player, 105, 100);
  ship2.isCruiser = true;
  ship2.maxHealth = 50;
  ship2.health = 50;

  game.ships.push(ship1);
  game.ships.push(ship2);

  // Verify that they are not moving
  assert.strictEqual(ship1.isCruiserMoving(), false);
  assert.strictEqual(ship2.isCruiserMoving(), false);

  // Initial distance is 5
  let dx = ship2.x - ship1.x;
  let dy = ship2.y - ship1.y;
  let initialDist = Math.sqrt(dx * dx + dy * dy);
  console.log("Initial distance between cruisers:", initialDist);
  assert.ok(initialDist < 20);

  // Run update loop multiple times to allow them to push apart completely.
  // Rate of scooting is 3 pixels/sec per cruiser, so 6 pixels/sec apart.
  // To push apart from 5px to 50px (45px difference), it takes about 45 / 6 = 7.5 seconds of simulation time.
  // Let's run 15 updates of 1000ms.
  for (let i = 0; i < 15; i++) {
    game.update(1000);
  }

  dx = ship2.x - ship1.x;
  dy = ship2.y - ship1.y;
  const finalDist = Math.sqrt(dx * dx + dy * dy);
  console.log("Final distance between cruisers:", finalDist);

  // If the old hardcoded 20 was used, finalDist would be around 20.
  // With the new logic, the target distance is max(30, 50) = 50.
  // So the final distance should be at least 50.
  assert.ok(finalDist >= 50, `Expected final distance to be at least 50, got ${finalDist}`);
  console.log("SUCCESS: Cruisers spaced themselves out beyond the maxHealth of the larger cruiser (50)!");
  process.exit(0);
}

testCruiserOverlap();
