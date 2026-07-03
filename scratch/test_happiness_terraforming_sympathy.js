import { Game } from '../src/game.js';
import assert from 'assert';

console.log('Testing sympathy gain for terraforming planets on high population happiness check...');

{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player = game.humanPlayer;
  player.isAlive = true;
  player.happinessScore = 0;
  player.techScore = 10000; // High tech score so capVal is > 100 and focusMode remains 'terraforming'
  
  for (const p of game.planets) {
    p.owner = null;
  }
  
  const planet = game.planets[0];
  planet.owner = player;
  planet.dead = false;
  planet.maxShips = 100;
  planet.ships = 98; // high population
  planet.habitability = 100;
  planet.focusMode = 'terraforming';
  planet.sympathy = {
    [player.id]: 0
  };
  
  // Set up Math.random to make the 50% chance succeed (roll < 0.5)
  const originalRandom = Math.random;
  Math.random = () => 0.25;
  
  try {
    game.happinessEvents = [];
    game.happinessTimer = 60000;
    game.update(0);
    
    console.log(`Planet sympathy for player after successful roll:`, planet.sympathy[player.id]);
    assert.strictEqual(planet.sympathy[player.id], 1, 'Sympathy should have increased to 1 on successful 50% roll');
  } finally {
    Math.random = originalRandom;
  }
}

{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player = game.humanPlayer;
  player.isAlive = true;
  player.happinessScore = 0;
  player.techScore = 10000;
  
  for (const p of game.planets) {
    p.owner = null;
  }
  
  const planet = game.planets[0];
  planet.owner = player;
  planet.dead = false;
  planet.maxShips = 100;
  planet.ships = 98; // high population
  planet.habitability = 100;
  planet.focusMode = 'terraforming';
  planet.sympathy = {
    [player.id]: 0
  };
  
  // Set up Math.random to make the 50% chance fail (roll >= 0.5)
  const originalRandom = Math.random;
  Math.random = () => 0.75;
  
  try {
    game.happinessEvents = [];
    game.happinessTimer = 60000;
    game.update(0);
    
    console.log(`Planet sympathy for player after failed roll:`, planet.sympathy[player.id]);
    assert.strictEqual(planet.sympathy[player.id], 0, 'Sympathy should remain 0 on failed 50% roll');
  } finally {
    Math.random = originalRandom;
  }
}

console.log('ALL TERRAFORMING SYMPATHY TESTS PASSED!');
process.exit(0);
