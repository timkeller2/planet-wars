import { Game } from '../src/game.js';
import assert from 'assert';

console.log('Testing 1-cruiser building limit per planet...');

// Test: Verify that a planet cannot build a second cruiser if it is already building one,
// but can build another once the first one is completed.
{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const planet = game.planets[0];
  const player = game.humanPlayer;
  
  // Clean all planets' owners and isolate our test planet
  for (const p of game.planets) {
    p.owner = null;
  }
  
  planet.owner = player;
  planet.ships = 500;
  planet.maxShips = 500;
  player.totalShips = 500;
  player.credits = 1000;
  player.builtClasses = {
    corvette: true
  };
  
  game.ships = [];
  
  // 1. Build the first cruiser (corvette)
  console.log('Building first cruiser...');
  game.buildCapitalShip(planet, 'corvette');
  assert.strictEqual(game.ships.length, 1, 'First cruiser should have spawned');
  
  const firstShip = game.ships[0];
  assert.strictEqual(firstShip.isMaterializing, true, 'First cruiser should be under construction (materializing)');
  assert.strictEqual(firstShip.sourcePlanet, planet, 'First cruiser source planet should be our test planet');
  
  // 2. Try to build a second cruiser while the first is still materializing
  console.log('Attempting to build second cruiser on the same planet...');
  game.buildCapitalShip(planet, 'corvette');
  assert.strictEqual(game.ships.length, 1, 'Second cruiser build should have been blocked');
  
  // 3. Mark the first cruiser as completed (materialized)
  console.log('Completing construction of first cruiser...');
  firstShip.isMaterializing = false;
  
  // 4. Try to build a second cruiser now that the first is completed
  console.log('Building second cruiser now that the first is completed...');
  game.buildCapitalShip(planet, 'corvette');
  assert.strictEqual(game.ships.length, 2, 'Second cruiser should have successfully spawned');
  
  const secondShip = game.ships[1];
  assert.strictEqual(secondShip.isMaterializing, true, 'Second cruiser should be under construction (materializing)');
  
  console.log('Cruiser building limit tests passed successfully!');
}

process.exit(0);
