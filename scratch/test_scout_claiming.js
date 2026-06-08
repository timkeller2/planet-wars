import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running scout claiming mechanic tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';

const game = new Game({ width: 1000, height: 1000 });
game.allPlayers = [p1];

const scout1 = new Ship(1, 150, 150, null, p1);
scout1.isCruiser = true;
scout1.isScouting = true;
scout1.scoutTargetX = 450;
scout1.scoutTargetY = 450; // targets cell (4, 4)
scout1.maxHealth = 100;
scout1.health = 100;
scout1.fuel = 100;

const scout2 = new Ship(2, 50, 50, null, p1);
scout2.isCruiser = true;
scout2.isScouting = true;
scout2.maxHealth = 100;
scout2.health = 100;
scout2.fuel = 100;
// scout2 needs a new target
scout2.scoutTargetX = null;
scout2.scoutTargetY = null;

// Initialize exploredGrid
game.exploredGrid = {};
const cellSize = 100;
const numCells = 10;
const now = Date.now();
const fiveMinutesAgo = now - 300000;

for (let cx = 0; cx < numCells; cx++) {
  for (let cy = 0; cy < numCells; cy++) {
    const key = `p1_${cx}_${cy}`;
    if ((cx === 4 && cy === 4) || (cx === 5 && cy === 5)) {
      game.exploredGrid[key] = 0; // Unexplored
    } else {
      game.exploredGrid[key] = now; // Recently explored
    }
  }
}

// Update scout2. It should choose cell (5, 5) instead of (4, 4) because (4, 4) is claimed by scout1!
scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);

console.log(`scout2 target: (${scout2.scoutTargetX}, ${scout2.scoutTargetY})`);
const targetCx = Math.floor(scout2.scoutTargetX / cellSize);
const targetCy = Math.floor(scout2.scoutTargetY / cellSize);
assert(targetCx === 5 && targetCy === 5, `scout2 should have chosen (5, 5) because (4, 4) is claimed. Got (${targetCx}, ${targetCy})`);

console.log("Scout claiming and avoidance test passed!");

// --- Test 2: Fallback to claimed cell if no unclaimed cells exist ---
// Mark (5, 5) as recently explored as well
game.exploredGrid[`p1_5_5`] = now;
// Now only (4, 4) is unexplored, but it is claimed by scout1.
// scout2 should fall back and target (4, 4) because no other unexplored/unclaimed cells exist.
scout2.scoutTargetX = null;
scout2.scoutTargetY = null;
scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);

console.log(`scout2 fallback target: (${scout2.scoutTargetX}, ${scout2.scoutTargetY})`);
const fallbackCx = Math.floor(scout2.scoutTargetX / cellSize);
const fallbackCy = Math.floor(scout2.scoutTargetY / cellSize);
assert(fallbackCx === 4 && fallbackCy === 4, `scout2 should have fallen back to (4, 4). Got (${fallbackCx}, ${fallbackCy})`);

console.log("Scout fallback to claimed cell test passed!");

// --- Test 3: Scout continues scouting when fuel is above 97% ---
scout2.scoutFuelRetreating = true;
scout2.fuel = 19.0; // below 97% of 20 (19.4)
scout2.scoutTargetX = null;
scout2.scoutTargetY = null;
scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);
assert(scout2.scoutFuelRetreating === true, "Scout should remain in refueling state when fuel is below 97%");

scout2.fuel = 19.6; // above 97% of 20 (19.4)
scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);
assert(scout2.scoutFuelRetreating === false, "Scout should resume scouting when fuel is above 97%");

console.log("Scout fuel continuation check test passed!");

// --- Test 4: Scout target coordinates are cleared when entering general retreat mode ---
scout2.isRetreating = false;
scout2.scoutTargetX = 550;
scout2.scoutTargetY = 550;
scout2.fuel = 2; // Very low fuel, triggers normal lowFuel retreat
// Trigger general retreat update
scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);
assert(scout2.isRetreating === true, "Scout should enter general retreat mode");
assert(scout2.scoutTargetX === null, "Scout target X should be cleared upon entering retreat mode");
assert(scout2.scoutTargetY === null, "Scout target Y should be cleared upon entering retreat mode");

console.log("Scout target clearing on general retreat test passed!");

// --- Test 5: Cruiser experience score is incremented when scanning unexplored tiles ---
scout2.isRetreating = false;
scout2.scoutFuelRetreating = false;
scout2.fuel = 20;
scout2.expScore = 0;
// Set scout2 position
scout2.x = 50;
scout2.y = 50;

// Set up exploredGrid so only key `p1_0_0` is unexplored
const pId = scout2.owner.id; // 'p1'
game.exploredGrid = {};
// Pre-fill cells in radar scan area as explored
const radarRange = scout2.cruiserRadarRange();
const cellRadius = Math.max(1, Math.ceil(radarRange / 100));
for (let dx = -cellRadius; dx <= cellRadius; dx++) {
  for (let dy = -cellRadius; dy <= cellRadius; dy++) {
    game.exploredGrid[`${pId}_${dx}_${dy}`] = Date.now();
  }
}
// Set cell 0,0 to unexplored for p1. No other player has explored it either.
game.exploredGrid[`${pId}_0_0`] = 0;

scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);
// Because scout2 (p1) is the first player to explore cell 0,0, they should get 2 XP (doubled)
assert(scout2.expScore === 2, `Cruiser should gain 2 XP (doubled) for being the first to scan unexplored cell 0,0. Got ${scout2.expScore}`);

// Subsequent update should not award XP again because 0,0 is now explored by player 1
scout2.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);
assert(scout2.expScore === 2, "Experience score should remain 2");

// Now test that if player 2's cruiser scans cell 0,0 (already explored by player 1), player 2 gets only 1 XP
const p2 = new Player('p2', '#f0f', false);
game.allPlayers.push(p2);
scout1.owner = p2;
scout1.isCruiser = true; // Make scout1 a cruiser
scout1.x = 50;
scout1.y = 50;
scout1.expScore = 0;
// Reset player 2's grid but pre-fill so only 0,0 is scanned
const pId2 = scout1.owner.id; // 'p2'
for (let dx = -cellRadius; dx <= cellRadius; dx++) {
  for (let dy = -cellRadius; dy <= cellRadius; dy++) {
    game.exploredGrid[`${pId2}_${dx}_${dy}`] = Date.now();
  }
}
game.exploredGrid[`${pId2}_0_0`] = 0; // Unexplored for p2

// Ensure player 1 has indeed explored cell 0,0
game.exploredGrid[`p1_0_0`] = Date.now();

scout1.update(0.1, [scout1, scout2], [], [], [], [], 1000, game);
// Because player 1 has already explored cell 0,0, player 2 should get only 1 XP
assert(scout1.expScore === 1, `Cruiser should gain only 1 XP for scanning cell 0,0 already explored by another player. Got ${scout1.expScore}`);

console.log("Scout experience points award test passed!");
console.log("All claiming and fuel unit tests completed successfully!");
