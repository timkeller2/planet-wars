import { Game } from '../src/game.js';
import assert from 'assert';

console.log('Testing Hard Labor happiness penalty...');

// Test 1: Planet in high production mode applies -1 penalty and generates a broken heart event
{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player = game.humanPlayer;
  player.isAlive = true;
  player.happinessScore = 10;
  
  // Clean all planets' owners first
  for (const p of game.planets) {
    p.owner = null;
  }
  
  // Set up a single planet owned by player in high production mode
  const planet = game.planets[0];
  planet.owner = player;
  planet.dead = false;
  planet.maxShips = 150;
  planet.ships = 50;
  planet.habitability = 100;
  planet.homeworldOf = player.id; // makes rate > 1.0
  
  console.log('--- Before Update ---');
  console.log('Player happiness:', player.happinessScore);
  console.log('Planet ships:', planet.ships, 'maxShips:', planet.maxShips);
  console.log('Planet production rate:', planet.getFinalProductionRate(game.settings));
  
  // Trigger happiness check immediately by setting timer to 60000 and updating with 0
  game.happinessEvents = [];
  game.happinessTimer = 60000;
  game.update(0);
  
  console.log('--- After Update ---');
  console.log('Player happiness:', player.happinessScore);
  console.log('Planet ships:', planet.ships);
  console.log('Happiness events:', JSON.stringify(game.happinessEvents, null, 2));
  
  assert.strictEqual(player.happinessScore, 7, 'Happiness score should be reduced by 3');
  
  assert.ok(game.happinessEvents && game.happinessEvents.length > 0, 'Should have generated happiness events');
  const event = game.happinessEvents.find(e => e.planetId === planet.id);
  assert.ok(event, 'Should have event for our planet');
  assert.ok(event.isBrokenHeart, 'Event should be a broken heart');
  assert.strictEqual(event.amount, -3, 'Event amount should be -3');
  
  console.log('Test 1 Passed: Hard Labor penalty and broken heart animation event verified successfully.');
}

// Test 2: Happiness score should not drop below 0
{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player = game.humanPlayer;
  player.isAlive = true;
  player.happinessScore = 0;
  
  for (const p of game.planets) {
    p.owner = null;
  }
  
  const planet = game.planets[0];
  planet.owner = player;
  planet.dead = false;
  planet.maxShips = 150;
  planet.ships = 50;
  planet.habitability = 100;
  planet.homeworldOf = player.id;
  
  game.happinessEvents = [];
  game.happinessTimer = 60000;
  game.update(0);
  
  console.log('Player happiness score (should be clamped to 0):', player.happinessScore);
  assert.strictEqual(player.happinessScore, 0, 'Happiness score should be clamped to 0');
  console.log('Test 2 Passed: Happiness score clamping verified.');
}

console.log('ALL HARD LABOR TESTS PASSED!');
process.exit(0);
