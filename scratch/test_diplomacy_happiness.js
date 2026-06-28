import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

console.log('Testing diplomacy event success reward and chance calculation...');

{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player = game.humanPlayer;
  player.isAlive = true;
  player.expScore = 100; // High expScore should NOT affect the chance anymore
  player.happinessScore = 0; // Low happiness
  
  const planet = game.planets[0];
  planet.owner = null;
  planet.dead = false;
  planet.ships = 50;
  planet.maxShips = 100;
  planet.preferredResource = null; // No preferred resource to keep math simple
  
  // Set up a diplomat cruiser
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
  
  // Force a failure to inspect the calculated success chance
  const originalRandom = Math.random;
  Math.random = () => 0.999999; // roll will be 100
  
  try {
    // Scenario A: Happiness = 0, expScore = 100.
    // Base chance = 30 + disposition (0) + sympathy (5 due to cruiser presence) + MathSquareBase (sqrt(happiness=0) + shipExpBonus(0)) = 35.
    game.triggerDiplomacyEvent(ship, planet);
    const chanceA = ship.diplomatFailureChance;
    console.log(`Success chance with Happiness=0, XP=100: ${chanceA}% (Expected: 35%)`);
    assert.strictEqual(chanceA, 35, 'Success chance should be 35% when happiness is 0');
    
    // Scenario B: Happiness = 16 (sqrt = 4), expScore = 100.
    // The ship gained 1 XP from the first attempt, so shipExpBonus is now 1.
    // Base chance = 30 + disposition (0) + sympathy (5 due to cruiser presence) + MathSquareBase (sqrt(happiness=16)=4 + shipExpBonus(1)) = 40.
    player.happinessScore = 16;
    game.triggerDiplomacyEvent(ship, planet);
    const chanceB = ship.diplomatFailureChance;
    console.log(`Success chance with Happiness=16, XP=100: ${chanceB}% (Expected: 40%)`);
    assert.strictEqual(chanceB, 40, 'Success chance should be 40% when happiness is 16 and ship has 1 XP');
    
    // Now test success reward: when it succeeds, it should reward happiness
    Math.random = () => 0.0; // force success
    player.happinessScore = 5;
    player.expScore = 10;
    
    console.log('Triggering successful diplomacy event...');
    game.triggerDiplomacyEvent(ship, planet);
    
    console.log(`Player expScore: ${player.expScore} (Expected: 10)`);
    console.log(`Player happinessScore: ${player.happinessScore} (Expected: 6)`);
    
    assert.strictEqual(player.expScore, 10, 'Player expScore should NOT have increased');
    assert.strictEqual(player.happinessScore, 6, 'Player happinessScore should have increased by 1');
    
    console.log('Diplomacy happiness reward and chance tests passed successfully!');
  } finally {
    Math.random = originalRandom;
  }
}

process.exit(0);
