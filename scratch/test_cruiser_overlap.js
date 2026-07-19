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
  // ship1: maxHealth = 30 (smaller — should scoot more)
  // ship2: maxHealth = 50 (larger — should barely move)
  const ship1StartX = 100;
  const ship2StartX = 105;
  const ship1 = new Ship(1, ship1StartX, 100, null, player, ship1StartX, 100);
  ship1.isCruiser = true;
  ship1.maxHealth = 30;
  ship1.health = 30;
  ship1.stationaryTimer = 1000;

  const ship2 = new Ship(2, ship2StartX, 100, null, player, ship2StartX, 100);
  ship2.isCruiser = true;
  ship2.maxHealth = 50;
  ship2.health = 50;
  ship2.stationaryTimer = 1000;

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
  // Relative scoot is 6 px/s total; size-weighted so smaller moves more.
  // Target distance is max(30,50)*1.30 = 65.
  for (let i = 0; i < 15; i++) {
    // Keep them "stationary" so scoot logic keeps applying
    ship1.stationaryTimer = 1000;
    ship2.stationaryTimer = 1000;
    game.update(1000);
  }

  dx = ship2.x - ship1.x;
  dy = ship2.y - ship1.y;
  const finalDist = Math.sqrt(dx * dx + dy * dy);
  console.log("Final distance between cruisers:", finalDist);
  console.log("ship1 (small) x:", ship1.x, "moved:", Math.abs(ship1.x - ship1StartX));
  console.log("ship2 (large) x:", ship2.x, "moved:", Math.abs(ship2.x - ship2StartX));

  // They should have pushed apart significantly from the initial 5px stack
  assert.ok(finalDist > 30, `Expected final distance > 30, got ${finalDist}`);

  // Smaller ship should have moved more than the larger one (inverse-mass push).
  // With sizes 30 vs 50, ratio should be ~50:30 (smaller moves more).
  const smallMoved = Math.abs(ship1.x - ship1StartX) + Math.abs(ship1.y - 100);
  const largeMoved = Math.abs(ship2.x - ship2StartX) + Math.abs(ship2.y - 100);
  assert.ok(smallMoved > largeMoved,
    `Expected smaller ship to move more (small=${smallMoved}, large=${largeMoved})`);
  assert.ok(smallMoved / largeMoved > 1.4,
    `Expected ~5:3 size ratio of movement, got small/large=${smallMoved / largeMoved}`);
  console.log("SUCCESS: Cruisers spaced out; smaller ship drifted farther than larger ship.");
  process.exit(0);
}

testCruiserOverlap();
