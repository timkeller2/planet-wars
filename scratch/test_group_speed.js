import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running group speed limit logic unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1];

// 1. Create two cruisers, one fast, one slow, close to each other (< 150px)
const shipFast = new Ship(1, 100, 100, null, p1);
shipFast.active = true;
shipFast.isCruiser = true;
shipFast.speed = 20;

const shipSlow = new Ship(2, 120, 100, null, p1);
shipSlow.active = true;
shipSlow.isCruiser = true;
shipSlow.speed = 10;

game.ships = [shipFast, shipSlow];

// Trigger moveShipsToSpace (should trigger group speed cap at 10)
game.moveShipsToSpace(p1, [shipFast.id, shipSlow.id], 500, 500, false, null, false);

assert(shipFast.groupSpeedLimit === 10, `Expected shipFast speed limit to be 10, got ${shipFast.groupSpeedLimit}`);
assert(shipSlow.groupSpeedLimit === 10, `Expected shipSlow speed limit to be 10, got ${shipSlow.groupSpeedLimit}`);

// 2. Trigger new move order for shipFast alone (should clear speed limit)
game.moveShipsToSpace(p1, [shipFast.id], 600, 600, false, null, false);
assert(shipFast.groupSpeedLimit === null, `Expected shipFast speed limit to be cleared (null), got ${shipFast.groupSpeedLimit}`);
assert(shipSlow.groupSpeedLimit === 10, `Expected shipSlow speed limit to remain 10, got ${shipSlow.groupSpeedLimit}`);

// 3. Move ships far apart (> 150px) and trigger group move
shipFast.x = 100;
shipSlow.x = 300; // 200px apart

game.moveShipsToSpace(p1, [shipFast.id, shipSlow.id], 700, 700, false, null, false);
assert(shipFast.groupSpeedLimit === null, `Expected shipFast speed limit to be null (dispersed group), got ${shipFast.groupSpeedLimit}`);
assert(shipSlow.groupSpeedLimit === null, `Expected shipSlow speed limit to be null (dispersed group), got ${shipSlow.groupSpeedLimit}`);

console.log("All group speed limit unit tests passed successfully!");
