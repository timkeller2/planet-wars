import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running cruiser player command and retreat override unit tests...");

const p1 = new Player('p1', '#0ff', false);
p1.id = 'p1';

const p2 = new Player('p2', '#f00', false);
p2.id = 'p2';

const game = new Game({ width: 2000, height: 2000 });
game.allPlayers = [p1, p2];

// Mock planets
const safePlanet = {
  id: 'safePlanet',
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
  owner: p2,
  radius: 30,
  getGravityRadius: () => 100
};

const stormPlanet = {
  id: 'stormPlanet',
  x: 1200,
  y: 1200,
  owner: p1,
  radius: 30,
  getGravityRadius: () => 100
};

game.planets = [safePlanet, enemyPlanet, stormPlanet];

// Mock ion storm over stormPlanet
game.ionStorms = [{
  type: 'ion_storm',
  x: 1200,
  y: 1200,
  radius: 150,
  intensity: 20,
  knowledge: { p1: 0, p2: 0 }
}];

// --- Test 1: Non-retreating cruiser exits autonomous modes on player move order ---
const cruiser1 = new Ship(1, 400, 400, null, p1);
cruiser1.isCruiser = true;
cruiser1.isScouting = true;
cruiser1.isResearching = true;
cruiser1.isDiplomacy = true;
cruiser1.bombPlanetsEnabled = true;

// Player issues move order to open space (which is unsafe, but ship is NOT retreating, so it should just exit modes)
cruiser1.handlePlayerMoveOrder({ x: 500, y: 500 }, game);
assert(cruiser1.isScouting === false, "Should exit scouting mode");
assert(cruiser1.isResearching === false, "Should exit researching mode");
assert(cruiser1.isDiplomacy === false, "Should exit diplomacy mode");
assert(cruiser1.bombPlanetsEnabled === false, "Should exit planet bombing");

// --- Test 2: Retreating cruiser exits retreat and modes on unsafe move order ---
const cruiser2 = new Ship(2, 400, 400, null, p1);
cruiser2.isCruiser = true;
cruiser2.isRetreating = true;
cruiser2.retreatTargetPlanetId = 'safePlanet';
cruiser2.isScouting = true;

// Order to open space (unsafe destination)
cruiser2.handlePlayerMoveOrder({ x: 500, y: 500 }, game);
assert(cruiser2.isRetreating === false, "Should exit retreat on unsafe space order");
assert(cruiser2.isScouting === false, "Should exit scouting mode on unsafe space order");

const cruiser3 = new Ship(3, 400, 400, null, p1);
cruiser3.isCruiser = true;
cruiser3.isRetreating = true;
cruiser3.retreatTargetPlanetId = 'safePlanet';
cruiser3.isResearching = true;

// Order to enemy planet (unsafe destination)
cruiser3.handlePlayerMoveOrder(enemyPlanet, game);
assert(cruiser3.isRetreating === false, "Should exit retreat on enemy planet order");
assert(cruiser3.isResearching === false, "Should exit researching mode on enemy planet order");

const cruiser4 = new Ship(4, 400, 400, null, p1);
cruiser4.isCruiser = true;
cruiser4.isRetreating = true;
cruiser4.retreatTargetPlanetId = 'safePlanet';
cruiser4.isDiplomacy = true;

// Order to storm-covered planet (unsafe destination)
cruiser4.handlePlayerMoveOrder(stormPlanet, game);
assert(cruiser4.isRetreating === false, "Should exit retreat on storm planet order");
assert(cruiser4.isDiplomacy === false, "Should exit diplomacy mode on storm planet order");

// --- Test 3: Retreating cruiser stays in retreat and updates destination on safe move order ---
const cruiser5 = new Ship(5, 450, 450, null, p1);
cruiser5.isCruiser = true;
cruiser5.isRetreating = true;
cruiser5.retreatTargetPlanetId = 'safePlanet';
cruiser5.isScouting = true;

// Order to the same safe friendly planet
cruiser5.handlePlayerMoveOrder(safePlanet, game);
assert(cruiser5.isRetreating === true, "Should stay in retreat on safe destination order");
assert(cruiser5.retreatTargetPlanetId === 'safePlanet', "Should make it the new retreat destination");
assert(cruiser5.isScouting === true, "Should not exit scouting mode when staying in retreat");

console.log("All cruiser player command and retreat override unit tests passed successfully!");
