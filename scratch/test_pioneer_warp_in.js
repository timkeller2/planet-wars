import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

console.log("Starting Pioneer Corvette Staggered Spawning and Warp-in Test...");

const game = new Game({ width: 1920, height: 1620 });
game.isRunning = true;

const player = new Player('p1', '#00ff00', false);
game.allPlayers = [player];

// Define target position inside the map
const targetX = 500;
const targetY = 500;

// Initialize spawn queue simulating Pioneers setup
const potentialUpgrades = ['sensorarrays', 'armor', 'shields', 'engine', 'munitions', 'targeting', 'damagecontrol', 'fuel_tanker', 'marines', 'command'];
let upgrades = {};
for (const up of potentialUpgrades) {
  upgrades[up] = 0;
}

for (let i = 0; i < 5; i++) {
  game.pendingPioneerSpawns.push({
    ownerId: player.id,
    x: targetX + i * 50, // offset by 50px to prevent cruiser bumping
    y: targetY + i * 50,
    upgrades: upgrades,
    timer: i * 30000,
    isAdditional: i > 0
  });
}

game.nextShipId = 2;

// 1. Initial tick (t = 0)
// First ship should spawn immediately at its destination
game.update(0);
assert.strictEqual(game.ships.length, 1, "First ship should spawn immediately");
const ship1 = game.ships[0];
assert.strictEqual(ship1.x, targetX, "First ship should spawn directly at destination");
assert.strictEqual(ship1.y, targetY, "First ship should spawn directly at destination");
assert.ok(!ship1.pioneerWarpIn, "First ship should not have pioneerWarpIn active");
assert.strictEqual(ship1.speed, 14, "First ship speed should be normal (14)");

console.log("✓ First ship spawned instantly at destination");

// 2. Tick forward by 29.9 seconds (timer has 100ms remaining)
game.update(29900);
assert.strictEqual(game.ships.length, 1, "Second ship should not spawn yet");

// Tick another 100ms to spawn the second ship
game.update(100);
assert.strictEqual(game.ships.length, 2, "Second ship should spawn now");
console.log("All ships in game:", game.ships.map(s => ({ id: s.id, x: s.x, y: s.y, pioneerWarpIn: s.pioneerWarpIn })));
const ship2 = game.ships.find(s => s !== ship1);
assert.ok(ship2, "Second ship should exist");

// It has just spawned at (-200, 510) and was updated for 100ms.
// At speed 70, it moves 7px in 100ms, so x should be around -193.
console.log(`Ship 2 spawned at X: ${ship2.x.toFixed(2)}, Y: ${ship2.y.toFixed(2)}, warpIn: ${ship2.pioneerWarpIn}`);
assert.ok(ship2.pioneerWarpIn, "Second ship should have pioneerWarpIn active");
assert.strictEqual(ship2.isWarp, true, "Second ship isWarp flag should be true");
assert.ok(ship2.x < 0, "Second ship should have spawned outside the left map boundary");

console.log(`✓ Second ship spawned outside the map and started warping`);

// 3. Tick by another 100ms tick to watch the movement
// Speed is 70px/s. So moveDistance per 100ms is 7px.
let prevX = ship2.x;
let prevY = ship2.y;
game.update(100);

const distMoved = Math.sqrt((ship2.x - prevX)**2 + (ship2.y - prevY)**2);
// Should move approximately 7px (70px/s * 0.1s)
assert.ok(Math.abs(distMoved - 7) < 0.1, `Should move at speed 70 (moved ${distMoved.toFixed(2)}px in 100ms, expected 7px)`);

console.log("✓ Second ship moved towards target at speed 70");

// 4. Fast forward until ship 2 arrives at the destination
// Distance to cover is roughly 710px. At 70px/s, it should take ~10.1 seconds (10100ms).
let safetyCounter = 0;
while (ship2.pioneerWarpIn && safetyCounter < 200) {
  game.update(100);
  safetyCounter++;
}

assert.ok(!ship2.pioneerWarpIn, "Warp-in flag should be cleared upon arrival");
assert.ok(!ship2.isWarp, "isWarp flag should be cleared upon arrival");
assert.strictEqual(ship2.speed, 14, "Speed should reset to 14 upon arrival");
assert.strictEqual(ship2.x, 550, "Position should be snapped to target X");
assert.strictEqual(ship2.y, 550, "Position should be snapped to target Y");

console.log("✓ Second ship successfully warped in, snapped to destination, and reset speed");

console.log("All Pioneer Spawning and Warp-in tests passed successfully!");
process.exit(0);
