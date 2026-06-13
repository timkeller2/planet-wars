import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

console.log("Starting Cruiser Separation / Stack Avoidance Test...");

const game = new Game({ width: 2000, height: 2000 });
game.isRunning = true;

const player = new Player('p1', '#00ff00', false);
game.allPlayers = [player];

// 1. Create two cruisers at the exact same location (100, 100)
// Both targeting (100, 100) so they are considered not moving (isCruiserMoving returns false)
const ship1 = new Ship(1, 100, 100, null, player, 100, 100);
ship1.isCruiser = true;
ship1.maxHealth = 30;
ship1.health = 30;

const ship2 = new Ship(2, 100, 100, null, player, 100, 100);
ship2.isCruiser = true;
ship2.maxHealth = 30;
ship2.health = 30;

game.ships.push(ship1);
game.ships.push(ship2);
game.ships.updateGrid();

console.log(`Initial position ship1: (${ship1.x}, ${ship1.y})`);
console.log(`Initial position ship2: (${ship2.x}, ${ship2.y})`);

assert.strictEqual(ship1.isCruiserMoving(), false, "ship1 must not be moving initially");
assert.strictEqual(ship2.isCruiserMoving(), false, "ship2 must not be moving initially");

// Calculate distance initially (should be 0)
const initialDist = Math.sqrt((ship1.x - ship2.x)**2 + (ship1.y - ship2.y)**2);
assert.strictEqual(initialDist, 0, "Ships must be perfectly stacked initially");

// 2. Call game.update(50) (deltaTime = 50ms)
// This should trigger the relaxation loop and separate them
game.update(50);

console.log(`After update position ship1: (${ship1.x.toFixed(1)}, ${ship1.y.toFixed(1)})`);
console.log(`After update position ship2: (${ship2.x.toFixed(1)}, ${ship2.y.toFixed(1)})`);

const finalDist = Math.sqrt((ship1.x - ship2.x)**2 + (ship1.y - ship2.y)**2);
console.log(`Distance after update: ${finalDist.toFixed(1)}px`);

// The distance should now be >= 30px (which is minDistance)
assert.ok(finalDist >= 30, "Cruisers must be separated by at least 30px");
console.log("✓ Cruisers successfully separated!");

// 3. Verify that updating again does not keep moving them away infinitely
const prevPos1 = { x: ship1.x, y: ship1.y };
const prevPos2 = { x: ship2.x, y: ship2.y };

game.update(50);

assert.strictEqual(ship1.x, prevPos1.x, "ship1 must remain stationary when not stacked");
assert.strictEqual(ship1.y, prevPos1.y, "ship1 must remain stationary when not stacked");
assert.strictEqual(ship2.x, prevPos2.x, "ship2 must remain stationary when not stacked");
assert.strictEqual(ship2.y, prevPos2.y, "ship2 must remain stationary when not stacked");
console.log("✓ Cruisers remain stable and stationary when not stacked");

console.log("All tests passed!");
