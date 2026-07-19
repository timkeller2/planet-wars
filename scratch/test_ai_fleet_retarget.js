/**
 * AI fleets that kill a cruiser/fleet should re-task to a friendly planet
 * (preferred) or another nearby enemy — not sit in deep space dissipating.
 */
import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log('Starting AI fleet retarget regression...');

  const game = new Game({ width: 3000, height: 3000 });
  game.initMap();
  game.isRunning = true;

  const ai = game.allPlayers.find(p => p.isAI) || game.allPlayers[0];
  ai.isAI = true;
  const enemy = game.allPlayers.find(p => p.id !== ai.id) || game.allPlayers[1];
  assert.ok(ai && enemy, 'need two players');

  // Friendly planet with room to reinforce
  const friendly = game.planets[0];
  friendly.owner = ai;
  friendly.x = 400;
  friendly.y = 400;
  friendly.ships = 10;
  friendly.maxShips = 80;
  friendly.dead = false;

  // Enemy planet further away (worse choice than reinforce)
  const enemyPlanet = game.planets[1] || game.planets[0];
  if (enemyPlanet === friendly) {
    // fallback coords only
  } else {
    enemyPlanet.owner = enemy;
    enemyPlanet.x = 2000;
    enemyPlanet.y = 2000;
    enemyPlanet.ships = 50;
    enemyPlanet.maxShips = 60;
    enemyPlanet.dead = false;
  }

  // Enemy cruiser that will "die"
  const cruiser = new Ship('enemy_cr', 900, 900, null, enemy);
  cruiser.isCruiser = true;
  cruiser.active = true;
  cruiser.maxHealth = 20;
  cruiser.health = 20;
  cruiser.count = 1;

  // AI fleet currently assigned to that cruiser (as targetPlanet — sendShips pattern)
  const fleet = new Ship('ai_fleet', 880, 880, cruiser, ai);
  fleet.active = true;
  fleet.count = 40;
  fleet.isCruiser = false;
  fleet.maxHealth = 0;
  fleet.timeSinceLastMoved = 0;

  game.ships = [cruiser, fleet];

  // Destroy the cruiser
  cruiser.active = false;
  cruiser.health = 0;

  // update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, mapWidth, game)
  const tick = (ship) => ship.update(100, game.ships, null, game.planets, null, null, 3000, game);

  // One update tick should detect destroyed ship-target and retarget to friendly planet
  tick(fleet);

  assert.ok(fleet.targetPlanet, 'fleet should have a new targetPlanet after cruiser dies');
  assert.strictEqual(
    fleet.targetPlanet.id,
    friendly.id,
    `should prefer friendly reinforce planet, got ${fleet.targetPlanet && fleet.targetPlanet.id}`
  );
  assert.ok(!fleet.pursueTarget || fleet.pursueTarget.active !== false, 'no dead pursue target');
  console.log('Pass: destroyed cruiser → reinforce friendly planet');

  // --- Case 2: idle at space waypoint prefers nearby enemy fleet over distant planet ---
  const fleet2 = new Ship('ai_fleet2', 1000, 1000, null, ai, 1000, 1000);
  fleet2.active = true;
  fleet2.count = 25;
  fleet2.timeSinceLastMoved = 2.5;
  fleet2.lastTimeAttacking = 0;
  fleet2.combatCooldown = 0;

  const enemyFleet = new Ship('enemy_fleet', 1050, 1020, null, enemy);
  enemyFleet.active = true;
  enemyFleet.count = 8;
  enemyFleet.maxHealth = 0;

  // Fill friendly so it is not a reinforce candidate; push other planets far away
  friendly.x = 50;
  friendly.y = 50;
  friendly.ships = friendly.maxShips;
  for (const p of game.planets) {
    if (p !== friendly) {
      p.x = 9000;
      p.y = 9000;
      p.dead = true;
    }
  }

  game.ships = [fleet2, enemyFleet];
  tick(fleet2);

  assert.ok(
    fleet2.pursueTarget === enemyFleet
      || (fleet2.targetX !== null && Math.abs(fleet2.targetX - enemyFleet.x) < 1),
    `idle fleet should chase nearby enemy fleet (pursue=${fleet2.pursueTarget && fleet2.pursueTarget.id}, tx=${fleet2.targetX})`
  );
  console.log('Pass: idle in space → chase nearby enemy fleet');

  // --- Case 3: mid-planet siege must not abandon for idle retarget ---
  const siegePlanet = game.planets.find(p => p !== friendly) || game.planets[0];
  siegePlanet.owner = enemy;
  siegePlanet.x = 1500;
  siegePlanet.y = 1500;
  siegePlanet.ships = 40;
  siegePlanet.maxShips = 50;
  siegePlanet.dead = false;
  siegePlanet.isDeepSpaceAnomaly = false;

  const siegeFleet = new Ship('siege', siegePlanet.x + 5, siegePlanet.y, siegePlanet, ai);
  siegeFleet.active = true;
  siegeFleet.count = 30;
  siegeFleet.timeSinceLastMoved = 5.0;
  siegeFleet.combatCooldown = 0;
  siegeFleet.lastTimeAttacking = 0;

  game.ships = [siegeFleet];
  tick(siegeFleet);

  assert.strictEqual(
    siegeFleet.targetPlanet && siegeFleet.targetPlanet.id,
    siegePlanet.id,
    'sieging fleet must keep its planet target while idle at the planet'
  );
  console.log('Pass: planet siege not abandoned by idle retarget');

  console.log('All AI fleet retarget tests passed.');
}

try {
  runTest();
} catch (err) {
  console.error('Test failed!', err);
  process.exit(1);
}
