import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

console.log('Testing out-of-bounds cruiser damage with friendly gravity well protection...');

{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player = game.humanPlayer;
  player.isAlive = true;
  
  // Clean planets
  for (const p of game.planets) {
    p.owner = null;
  }
  
  // Set up a friendly planet near the left border (x = 50, y = 200)
  const planet = game.planets[0];
  planet.owner = player;
  planet.x = 50;
  planet.y = 200;
  planet.dead = false;
  planet.ships = 100;
  planet.maxShips = 100;
  
  const gravityRadius = planet.getGravityRadius();
  console.log(`Friendly planet gravity radius: ${gravityRadius}`);
  
  // Create a cruiser just outside the left border (x = -10, y = 200)
  // Distance to planet is 60px, which is well within gravityRadius + 50
  const cruiser = new Ship(game.nextShipId++, -10, 200, null, player, -10, 200);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 20;
  cruiser.health = 20;
  cruiser.active = true;
  
  // Clear and push to preserve custom array methods on game.ships
  game.ships.length = 0;
  game.ships.push(cruiser);
  
  // Update game multiple times - cruiser should NOT take damage
  console.log('Case 1: Cruiser is out-of-bounds but within 50px of friendly gravity well...');
  for (let i = 0; i < 10; i++) {
    game.update(1000); // 10 seconds of updates
  }
  
  console.log(`Cruiser health: ${cruiser.health} (Expected: 20)`);
  assert.strictEqual(cruiser.health, 20, 'Cruiser should not take boundary damage while near a friendly gravity well');
  
  // Move cruiser far away from the friendly planet (x = -300, y = 200)
  // Distance to planet is 350px, which is outside gravityRadius + 50
  cruiser.x = -300;
  cruiser.y = 200;
  
  console.log('Case 2: Cruiser is out-of-bounds and far from any friendly gravity well...');
  // Update game - cruiser should take damage eventually
  let tookDamage = false;
  for (let i = 0; i < 10; i++) {
    game.update(1000);
    if (cruiser.health < 20) {
      tookDamage = true;
      break;
    }
  }
  
  console.log(`Cruiser health: ${cruiser.health} (Expected: < 20)`);
  assert.ok(tookDamage, 'Cruiser should take boundary damage when far from any friendly gravity well');
  
  console.log('Out-of-bounds friendly gravity well protection tests passed successfully!');
}

process.exit(0);
