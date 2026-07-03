import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

console.log('Testing diplomacy cruiser sympathy conversion when planet is full of enemy sympathy...');

const game = new Game({ width: 1000, height: 1000 });
game.initMap();

const player = game.humanPlayer;
player.id = 'p1';
player.isAlive = true;
player.happinessScore = 16;
player.resources = { duranium: 100 };

const enemyPlayer = { id: 'p2', name: 'Enemy', isAI: true, color: '#ff3366' };
game.allPlayers.push(enemyPlayer);

const planet = game.planets[0];
planet.owner = null;
planet.dead = false;
planet.ships = 0;
planet.maxShips = 30;
planet.preferredResource = null;

planet.sympathy = {
  [enemyPlayer.id]: 30
};

const ship = new Ship(game.nextShipId++, planet.x, planet.y, null, player, planet.x, planet.y);
ship.isCruiser = true;
ship.diplomat = 1;
ship.parley = 3;
ship.isDiplomacy = true;
ship.maxHealth = 20;
ship.health = 20;
ship.expScore = 0;

game.ships.length = 0;
game.ships.push(ship);

const originalRandom = Math.random;
Math.random = () => 0.0; // Force success

try {
  game.isRunning = true;
  game.isPaused = false;
  
  // First step targets the planet
  game.updateCustomCruiserSystems(1);
  assert.strictEqual(planet.activeDiplomatId, ship.id, 'Cruiser should target the planet');
  
  // Second step advances warmup and completes the event
  game.updateCustomCruiserSystems(30);
  
  const playerSym = planet.sympathy[player.id] || 0;
  const enemySym = planet.sympathy[enemyPlayer.id] || 0;
  
  console.log(`Player sympathy: ${playerSym}`);
  console.log(`Enemy sympathy: ${enemySym}`);
  
  assert.ok(playerSym > 0, 'Player sympathy should have increased');
  assert.ok(enemySym < 30, 'Enemy sympathy should have decreased (converted)');
  assert.strictEqual(playerSym + enemySym, 30, 'Total sympathy should remain capped at limit (30)');
  
  console.log('All tests passed successfully!');
} finally {
  Math.random = originalRandom;
}

process.exit(0);
