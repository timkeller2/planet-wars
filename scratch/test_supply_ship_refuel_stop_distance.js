import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Supply Ship Refuel Stop Distance tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  
  // Clear map so we can set up exactly what we need
  game.planets = [];
  game.ships = [];

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];

  // 2. Spawn Needy Cruiser (maxHealth = 30, fuel = 1)
  const needy = new Ship(1, 100, 100, null, player, 100, 100);
  needy.isCruiser = true;
  needy.maxHealth = 30;
  needy.health = 30;
  needy.fuel = 1;
  needy.isPatrolling = true; // Cruiser AI retreat only triggers when patrolling or scouting
  needy.isRetreating = true; // force retreat mode active

  // 3. Spawn Supply Cruiser (maxHealth = 40, supplies = 10, located at 300, 100)
  const supplier = new Ship(2, 300, 100, null, player, 300, 100);
  supplier.isCruiser = true;
  supplier.maxHealth = 40;
  supplier.health = 40;
  supplier.supplies = 10;

  game.ships.push(needy);
  game.ships.push(supplier);

  // Set the retreat target of the needy cruiser to the supplier ship
  needy.retreatTargetShipId = supplier.id;

  // Run Ship update to calculate targetX and targetY
  // update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth, game = null)
  needy.update(100, game.ships, [], game.planets, [], [], 1600, game);

  console.log("Needy ship position: (", needy.x, ",", needy.y, ")");
  console.log("Supplier ship position: (", supplier.x, ",", supplier.y, ")");
  console.log("Target coordinates calculated: (", needy.targetX, ",", needy.targetY, ")");

  // Calculate distance between target position and supplier position
  const dx = needy.targetX - supplier.x;
  const dy = needy.targetY - supplier.y;
  const stopDist = Math.sqrt(dx * dx + dy * dy);
  console.log("Calculated stop distance:", stopDist);

  // Expected bump range is max(30, 40) = 40.
  // Expected stop distance is bumpRange + 10 = 50.
  assert.ok(Math.abs(stopDist - 50) < 0.01, `Stop distance should be 50, but got ${stopDist}`);

  console.log("All Supply Ship Refuel Stop Distance tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
