import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Starting verification tests...");

// 1. Verify homeworld economy capacity growth doubling
{
  const player = new Player('player1', '#0ff', false);
  player.id = 'player1';
  player.credits = 100;

  // Non-homeworld planet in economy mode
  const normalPlanet = new Planet('p1', 100, 100, 25, player, 100);
  normalPlanet.focusMode = 'economy';
  normalPlanet.habitability = 100;
  normalPlanet.sizeClass = 1000;

  normalPlanet.capacityProgress = 0;
  // Let's call update to trigger capacity growth
  // capacityProgress threshold is maxShips / 10 = 10. So let's run it with deltaTime = 10000ms (10 seconds)
  normalPlanet.update(10000, null, [], player);
  assert(normalPlanet.maxShips === 101, "Normal planet maxShips should increase by 1. Got: " + normalPlanet.maxShips);

  // Homeworld planet in economy mode
  const homeworldPlanet = new Planet('p2', 200, 200, 25, player, 100);
  homeworldPlanet.focusMode = 'economy';
  homeworldPlanet.homeworldOf = player.id; // Mark as homeworld
  homeworldPlanet.habitability = 100;
  homeworldPlanet.sizeClass = 1000;

  homeworldPlanet.capacityProgress = 0;
  homeworldPlanet.update(10000, null, [], player);
  assert(homeworldPlanet.maxShips === 102, "Homeworld planet maxShips should increase by 2. Got: " + homeworldPlanet.maxShips);

  console.log("Pass: Homeworld economy capacity growth is doubled.");
}

// 2. Verify isCruiserMoving() and handlePlayerMoveOrder canceling diplomacy
{
  const player = new Player('player1', '#0ff', false);
  player.id = 'player1';
  const game = new Game({ width: 2000, height: 2000 });
  game.allPlayers = [player];

  const targetPlanet = new Planet('p1', 500, 500, 25, player, 100);
  game.planets = [targetPlanet];

  const cruiser = new Ship('c1', 100, 100, null, player);
  cruiser.isCruiser = true;
  cruiser.isDiplomacy = true;

  // It is not moving yet
  assert(cruiser.isCruiserMoving() === false, "Cruiser should not be moving initially");

  // Manual move order to target planet (distance is 565px, targetPlanet.radius + 45 = 70px, so it's far away and moving)
  cruiser.targetPlanet = targetPlanet;
  cruiser.handlePlayerMoveOrder({ planet: targetPlanet, x: targetPlanet.x, y: targetPlanet.y }, game);
  assert(cruiser.isCruiserMoving() === true, "Cruiser should be moving now");
  assert(cruiser.isDiplomacy === false, "Cruiser diplomacy mode should be disabled on manual move order");

  // Manually enable diplomacy mode and move it very close to target planet
  cruiser.isDiplomacy = true;
  cruiser.x = targetPlanet.x;
  cruiser.y = targetPlanet.y;
  assert(cruiser.isCruiserMoving() === false, "Cruiser should not be moving when close to targetPlanet");

  // Move to a coordinate target far away
  cruiser.targetPlanet = null;
  cruiser.targetX = 300;
  cruiser.targetY = 300;
  assert(cruiser.isCruiserMoving() === true, "Cruiser should be moving to coordinate target");

  console.log("Pass: isCruiserMoving() and manual move cancel diplomacy logic.");
}

// 3. Verify diplomacy tick / sympathy generation checks
{
  const player = new Player('player1', '#0ff', false);
  player.id = 'player1';
  const enemy = new Player('player2', '#f00', false);
  enemy.id = 'player2';

  const game = new Game({ width: 2000, height: 2000 });
  game.allPlayers = [player, enemy];
  game.isRunning = true;

  const p1 = new Planet('p1', 100, 100, 25, enemy, 50);
  p1.sympathy = { player1: 0 };
  p1.disposition = { player1: 0 };
  game.planets = [p1];

  // Diplomat cruiser
  const cruiser = new Ship('c1', 100, 100, null, player);
  cruiser.isCruiser = true;
  cruiser.active = true;
  cruiser.maxHealth = 100;
  cruiser.health = 100;
  cruiser.diplomat = 1;
  cruiser.parley = 3;
  cruiser.isDiplomacy = true;

  game.ships = [cruiser];

  // Tick the game update (cruiser is stationary at the planet and in diplomacy mode)
  game.updateCustomCruiserSystems(0.1);
  assert(p1.activeDiplomatId === cruiser.id, "Cruiser should claim the planet for diplomacy");

  // Now, make the cruiser move and lower its parley to 1
  cruiser.targetX = 500;
  cruiser.targetY = 500;
  cruiser.parley = 1;
  assert(cruiser.isCruiserMoving() === true, "Cruiser should be moving");

  // Tick the game update again. The moving diplomat should be invalidated, claim released, but parley increases!
  game.updateCustomCruiserSystems(10.0);
  assert(p1.activeDiplomatId === null, "Claim should be released when diplomat is moving");
  assert(cruiser.parley > 1, "Parley should increase while moving. Got: " + cruiser.parley);

  // Put it back close
  cruiser.targetX = 100;
  cruiser.targetY = 100;
  assert(cruiser.isCruiserMoving() === false, "Cruiser is no longer moving");

  // Enter scout mode and lower parley to 1
  cruiser.isScouting = true;
  cruiser.parley = 1;
  game.updateCustomCruiserSystems(10.0);
  assert(p1.activeDiplomatId === null, "Claim should be released when diplomat is in scout mode");
  assert(cruiser.parley > 1, "Parley should increase while scouting. Got: " + cruiser.parley);

  console.log("Pass: Diplomat sympathy generation checks.");
}

// 4. Verify retreating cruiser does not exclude supply ships in danger
{
  const player = new Player('player1', '#0ff', false);
  player.id = 'player1';
  const enemy = new Player('player2', '#f00', false);
  enemy.id = 'player2';

  const game = new Game({ width: 2000, height: 2000 });
  game.allPlayers = [player, enemy];

  // A friendly planet far away
  const farPlanet = new Planet('p1', 1000, 1000, 25, player, 100);
  game.planets = [farPlanet];

  // A friendly cruiser needing repairs
  const cruiser = new Ship('c1', 100, 100, null, player);
  cruiser.isCruiser = true;
  cruiser.active = true;
  cruiser.maxHealth = 100;
  cruiser.health = 40; // Needs repairs!
  cruiser.fuel = 10;
  cruiser.bombs = 0;
  cruiser.isPatrolling = true;
  cruiser.isRetreating = true; // Force retreating mode

  // A friendly supply ship at (300, 300)
  const supplyShip = new Ship('c2', 300, 300, null, player);
  supplyShip.isCruiser = true;
  supplyShip.active = true;
  supplyShip.supplies = 50;
  supplyShip.maxHealth = 100;
  supplyShip.health = 100;

  // An enemy ship close to the supply ship at (350, 300) -> 50px away (within danger zone of 300px)
  const enemyShip = new Ship('e1', 350, 300, null, enemy);
  enemyShip.active = true;

  const allShips = [cruiser, supplyShip, enemyShip];

  // Tick the update
  cruiser.update(100, allShips, [], game.planets, [], [], 2000, game);

  assert(cruiser.retreatTargetShipId === supplyShip.id, "Cruiser should retreat to the supply ship despite the enemy nearby");
  console.log("Pass: Retreating cruiser does not exclude supply ships because of danger.");
}

console.log("All verification tests passed successfully!");
