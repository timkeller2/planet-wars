import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running cruiser patrol targeting override test...");

const p1 = new Player('p1', '#0ff', false);
const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1];

const p1Planet = {
  id: 'p1Planet',
  x: 400,
  y: 400,
  owner: p1,
  radius: 30,
  getGravityRadius: () => 100
};

const enemyPlanet = {
  id: 'enemyPlanet',
  x: 800,
  y: 800,
  owner: null,
  radius: 30,
  getGravityRadius: () => 100
};

game.planets = [p1Planet, enemyPlanet];

// Mock ship setup
const ship = new Ship(1, 400, 400, null, p1);
ship.isCruiser = true;
ship.isPatrolling = true;
ship.patrolStationX = 400;
ship.patrolStationY = 400;

// Mimicking server.js targeting handler logic for click in empty space
function handleTarget(ship, targetType, targetId, tx, ty) {
  const isAttackingAndInjured = ship.isPatrolling && (ship.combatCooldown > 0) && (ship.health < ship.maxHealth);
  if (ship.isPatrolling && targetType !== 'ship' && targetType !== 'planet' && !isAttackingAndInjured) {
    ship.patrolStationX = tx;
    ship.patrolStationY = ty;
    ship.targetX = tx;
    ship.targetY = ty;
    ship.targetPlanet = null;
    ship.cruiserTargetType = null;
    ship.cruiserTargetId = null;
  } else {
    ship.isPatrolling = false;
    ship.patrolReloading = false;
    ship.cruiserTargetType = targetType;
    ship.cruiserTargetId = targetId;
    ship.cruiserTargetClickX = tx;
    ship.cruiserTargetClickY = ty;
  }
}

// 1. Relocating patrol to empty space should NOT disable patrol
handleTarget(ship, null, null, 500, 500);
assert(ship.isPatrolling === true, "Relocating to empty space should keep patrol mode enabled");
assert(ship.patrolStationX === 500, "Patrol station X should update to 500");
assert(ship.cruiserTargetType === null, "Cruiser target type should remain null");

// 2. Targeting a planet should disable patrol and target the planet
handleTarget(ship, 'planet', 'enemyPlanet', 800, 800);
assert(ship.isPatrolling === false, "Targeting a planet should disable patrol mode");
assert(ship.cruiserTargetType === 'planet', "Cruiser target type should become 'planet'");
assert(ship.cruiserTargetId === 'enemyPlanet', "Cruiser target ID should become 'enemyPlanet'");

console.log("Cruiser patrol targeting override test passed successfully!");
