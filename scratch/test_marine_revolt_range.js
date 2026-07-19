/**
 * Regression: revolt marine dumps must only fire while the cruiser is
 * inside the target planet's gravity well. Leaving the well mid-queue
 * must cancel remaining batches and refund marines (no cross-map pods).
 */
import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log('Starting marine revolt range regression...');

  const game = new Game({ width: 4000, height: 4000 });
  game.initMap();
  game.isRunning = true;

  const planet = game.planets[0];
  const player = game.allPlayers[0];
  assert.ok(planet && player, 'need planet + player');

  planet.inRevolt = true;
  planet.revoltTimer = 10000;
  planet.ships = 80;
  planet.maxShips = 100;
  planet.x = 500;
  planet.y = 500;
  // Ensure someone else owns it so we can dump
  const enemy = game.allPlayers.find(p => p.id !== player.id) || null;
  if (enemy) planet.owner = enemy;

  const gr = planet.getGravityRadius();
  assert.ok(gr > 20, `gravity radius should be positive, got ${gr}`);

  // Cruiser starts INSIDE the well with a large marine load (multi-batch)
  const cruiser = new Ship('cr_range', planet.x + 10, planet.y + 10, null, player);
  cruiser.isCruiser = true;
  cruiser.active = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;
  cruiser.scoutAttackEnabled = true; // not peace
  cruiser.marineCount = 55; // > 20 so pending batches are created
  cruiser.marines = 2;
  game.ships = [cruiser];

  // In-range helper
  assert.strictEqual(
    game.isCruiserInMarineLaunchRange(cruiser, planet.id, 'revolt'),
    true,
    'cruiser should be in revolt launch range at start'
  );

  // One tick: should queue dump (first batch of 20 + pending 35)
  game.updateCustomCruiserSystems(100);

  assert.ok(
    (cruiser.pendingMarineLaunches || []).length > 0 ||
      game.ships.some(s => s.isMarineFleet),
    'should have launched or queued marines while in well'
  );

  const pendingBefore = (cruiser.pendingMarineLaunches || []).reduce((n, l) => n + (l.count || 0), 0);
  const flyingBefore = game.ships.filter(s => s.isMarineFleet).reduce((n, s) => n + (s.count || 0), 0);
  const onBoardAfterFirst = cruiser.marineCount || 0;
  console.log(`After in-well tick: onBoard=${onBoardAfterFirst} pending=${pendingBefore} flying=${flyingBefore}`);

  assert.ok(pendingBefore > 0, 'expected remaining batches queued (marineCount > 20)');
  assert.ok(flyingBefore > 0, 'expected first batch already in flight');

  // Move cruiser FAR outside the gravity well (across the map)
  cruiser.x = planet.x + gr + 800;
  cruiser.y = planet.y + gr + 800;
  assert.strictEqual(
    game.isCruiserInMarineLaunchRange(cruiser, planet.id, 'revolt'),
    false,
    'cruiser must be out of revolt range after move'
  );

  // Advance enough time for pending batch timer (2s) to fire
  for (let t = 0; t < 30; t++) {
    game.updateCustomCruiserSystems(100); // 3s total
  }

  const pendingAfter = (cruiser.pendingMarineLaunches || []).reduce((n, l) => n + (l.count || 0), 0);
  const flyingAfter = game.ships.filter(s => s.isMarineFleet).reduce((n, s) => n + (s.count || 0), 0);
  const onBoardAfter = cruiser.marineCount || 0;

  console.log(`After out-of-well ticks: onBoard=${onBoardAfter} pending=${pendingAfter} flying=${flyingAfter}`);

  assert.strictEqual(pendingAfter, 0, 'pending revolt batches must be cancelled out of well');
  assert.strictEqual(
    flyingAfter,
    flyingBefore,
    'no additional marine fleets may spawn after leaving the well'
  );
  assert.ok(
    onBoardAfter >= pendingBefore - 0.001,
    `remaining marines should be refunded (expected >= ${pendingBefore}, got ${onBoardAfter})`
  );

  // Far-away cruiser must not start a fresh revolt dump either
  cruiser.marineCount = 40;
  cruiser.marineLaunchCooldown = 0;
  cruiser.pendingMarineLaunches = [];
  const fleetCountBefore = game.ships.filter(s => s.isMarineFleet).length;
  game.updateCustomCruiserSystems(100);
  const fleetCountAfter = game.ships.filter(s => s.isMarineFleet).length;
  assert.strictEqual(
    fleetCountAfter,
    fleetCountBefore,
    'out-of-well cruiser must not open a new revolt marine dump'
  );
  assert.strictEqual(cruiser.marineCount, 40, 'marines stay on board when out of well');

  console.log('All marine revolt range regression tests passed.');
}

try {
  runTest();
} catch (error) {
  console.error('Test failed!', error);
  process.exit(1);
}
