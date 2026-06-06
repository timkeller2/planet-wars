import { Game } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/game.js';
import { Ship } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Ship.js';
import { Player } from 'file:///s:/Dist/AntiGravity/Planet Wars/src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running standardized cruiser retreat logic unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1];

// Mock friendly planet
const planet1 = {
  id: 'planet1',
  x: 400,
  y: 400,
  owner: p1,
  getGravityRadius: () => 100
};
game.planets = [planet1];

// Helper to update ship
const updateShip = (ship, dt = 1.0) => {
  ship.update(dt * 1000, [ship], [], game.planets, [], [], 2000, game);
};

// --- Test 1: Fuel Retreat Trigger and Exit ---
const ship1 = new Ship(1, 500, 500, null, p1);
ship1.isCruiser = true;
ship1.maxHealth = 100;
ship1.health = 100;
const maxFuel = ship1.getMaxFuel(); // maxHealth / 5 = 20
ship1.fuel = maxFuel;
ship1.bombs = ship1.getMaxBombs();
ship1.isPatrolling = true;

// Fuel at 51% (10.2) - should not retreat
ship1.fuel = maxFuel * 0.51;
updateShip(ship1);
assert(ship1.isRetreating === false, "Cruiser at 51% fuel should not retreat");

// Fuel at 49% (9.8) - should trigger retreat
ship1.fuel = maxFuel * 0.49;
updateShip(ship1);
assert(ship1.isRetreating === true, "Cruiser at 49% fuel should trigger retreat");

// Replenish fuel partially (99% / 19.8) - should still retreat
ship1.fuel = maxFuel * 0.99;
updateShip(ship1);
assert(ship1.isRetreating === true, "Cruiser with partial fuel restore should remain in retreat");

// Replenish fully (20) - should exit retreat (using dt = 0 to prevent fuel decay)
ship1.fuel = maxFuel;
updateShip(ship1, 0.0);
assert(ship1.isRetreating === false, "Cruiser fully replenished should exit retreat");


// --- Test 2: Bombs Trigger and Exit ---
const ship2 = new Ship(2, 500, 500, null, p1);
ship2.isCruiser = true;
ship2.maxHealth = 100;
ship2.health = 100;
ship2.fuel = ship2.getMaxFuel();
ship2.bombs = 10;
ship2.isPatrolling = true;

// Bombs at 1 - should not retreat
ship2.bombs = 1;
updateShip(ship2);
assert(ship2.isRetreating === false, "Cruiser with 1 bomb left should not retreat");

// Bombs at 0 - should trigger retreat
ship2.bombs = 0;
updateShip(ship2);
assert(ship2.isRetreating === true, "Cruiser with empty bombs should trigger retreat");

// Reload fully - should exit retreat (using dt = 0 to prevent fuel decay)
ship2.bombs = ship2.getMaxBombs();
ship2.fuel = ship2.getMaxFuel(); // reset fuel to max
updateShip(ship2, 0.0);
assert(ship2.isRetreating === false, "Cruiser fully rearmed should exit retreat");


// --- Test 3: Standby (Not Moved) health retreat vs Active health retreat ---
const ship3 = new Ship(3, 500, 500, null, p1);
ship3.isCruiser = true;
ship3.maxHealth = 100;
ship3.health = 49; // health below 50%
ship3.fuel = ship3.getMaxFuel();
ship3.bombs = 10;

// Not in active mode, not standby for 1 minute (timeNotMoved = 0)
updateShip(ship3);
assert(ship3.isRetreating === false, "Cruiser at 49% health without active mode and not standby should not retreat");

// Standard active mode - should trigger retreat immediately
ship3.isPatrolling = true;
updateShip(ship3);
assert(ship3.isRetreating === true, "Cruiser at 49% health in active mode should retreat");
ship3.isRetreating = false;
ship3.isPatrolling = false;

// Standby mode - increment timeNotMoved to 61s
ship3.x = 500; ship3.y = 500;
ship3.lastX = 500; ship3.lastY = 500;
ship3.timeNotMoved = 61;
updateShip(ship3);
assert(ship3.isRetreating === true, "Cruiser at 49% health on standby for > 60s should retreat");


// --- Test 4: Health Recovery Thresholds (75% vs 100%) ---
// Patrol (Other mode) -> recovers at 75%
const ship4 = new Ship(4, 500, 500, null, p1);
ship4.isCruiser = true;
ship4.maxHealth = 100;
ship4.health = 49;
ship4.fuel = ship4.getMaxFuel();
ship4.bombs = ship4.getMaxBombs();
ship4.isPatrolling = true;

updateShip(ship4);
assert(ship4.isRetreating === true, "Patrol cruiser triggers health retreat");

// Heal to 74% - remains in retreat
ship4.health = 74;
updateShip(ship4);
assert(ship4.isRetreating === true, "Patrol cruiser at 74% health should stay in retreat");

// Heal to 75% - exits retreat (using dt = 0 to prevent fuel decay)
ship4.health = 75;
ship4.fuel = ship4.getMaxFuel(); // reset fuel to max
updateShip(ship4, 0.0);
assert(ship4.isRetreating === false, "Patrol cruiser at 75% health should exit retreat");

// Scout mode -> recovers at 100% only
const ship5 = new Ship(5, 500, 500, null, p1);
ship5.isCruiser = true;
ship5.maxHealth = 100;
ship5.health = 49;
ship5.fuel = ship5.getMaxFuel();
ship5.bombs = ship5.getMaxBombs();
ship5.isScouting = true;

updateShip(ship5);
assert(ship5.isRetreating === true, "Scout cruiser triggers health retreat");

// Heal to 75% - remains in retreat
ship5.health = 75;
updateShip(ship5);
assert(ship5.isRetreating === true, "Scout cruiser at 75% health should remain in retreat");

// Heal to 99% - remains in retreat
ship5.health = 99;
updateShip(ship5);
assert(ship5.isRetreating === true, "Scout cruiser at 99% health should remain in retreat");

// Heal to 100% - exits retreat (using dt = 0 to prevent fuel decay)
ship5.health = 100;
ship5.fuel = ship5.getMaxFuel(); // reset fuel to max
updateShip(ship5, 0.0);
assert(ship5.isRetreating === false, "Scout cruiser at 100% health should exit retreat");


console.log("All retreat unit tests completed successfully!");
