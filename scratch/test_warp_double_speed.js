import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Warp Double Speed tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  game.isRunning = true;

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  player.techScore = 0; // Tech = 0

  const friendlyPlanet = game.planets[0];
  friendlyPlanet.owner = player;

  // Spawn player fleet: baseSpeed = 15
  const fleet1 = new Ship('f1', friendlyPlanet.x + 10, friendlyPlanet.y + 10, null, player);
  fleet1.speed = 15;
  
  // Test fleet1 without warp
  fleet1.isWarp = false;
  let maxSp = fleet1.getMaxSpeed();
  assert.strictEqual(maxSp, 15, `Fleet speed without warp should be 15, got ${maxSp}`);
  
  // Test fleet1 with warp: warp bonus should double the speed (so +15, since base is 15 > 10). Total = 30
  fleet1.isWarp = true;
  let maxSpWarp = fleet1.getMaxSpeed();
  assert.strictEqual(maxSpWarp, 30, `Fleet speed with warp should be 30, got ${maxSpWarp}`);
  assert.strictEqual(fleet1.getWarpBonus(), 15, `Warp bonus should be 15, got ${fleet1.getWarpBonus()}`);

  // Spawn player fleet with extremely low base speed (e.g. 5) to verify the minimum +10 bonus
  const fleetLow = new Ship('f_low', friendlyPlanet.x + 10, friendlyPlanet.y + 10, null, player);
  fleetLow.speed = 5;
  fleetLow.isWarp = true;
  let maxSpLowWarp = fleetLow.getMaxSpeed();
  assert.strictEqual(maxSpLowWarp, 15, `Fleet with base speed 5 in warp should get min +10 bonus, total 15, got ${maxSpLowWarp}`);
  assert.strictEqual(fleetLow.getWarpBonus(), 10, `Warp bonus for base speed 5 should be 10 (minimum), got ${fleetLow.getWarpBonus()}`);

  // Spawn player cruiser: engine level 2 (engineBonus = +6), techScore = 0
  const cruiser = new Ship('cr1', friendlyPlanet.x + 10, friendlyPlanet.y + 10, null, player);
  cruiser.isCruiser = true;
  cruiser.speed = 15;
  cruiser.engine = 2; // +6 speed
  
  // Cruiser speed without warp: 15 + 6 = 21
  cruiser.isWarp = false;
  let cruiserSp = cruiser.getMaxSpeed();
  assert.strictEqual(cruiserSp, 21, `Cruiser speed without warp should be 21, got ${cruiserSp}`);
  
  // Cruiser speed with warp: warp bonus should be 21. Total speed = 42
  cruiser.isWarp = true;
  let cruiserSpWarp = cruiser.getMaxSpeed();
  assert.strictEqual(cruiserSpWarp, 42, `Cruiser speed with warp should be 42, got ${cruiserSpWarp}`);
  assert.strictEqual(cruiser.getWarpBonus(), 21, `Cruiser warp bonus should be 21, got ${cruiser.getWarpBonus()}`);

  // Verify that applyWarpToShip assigns the correct warpBonus property
  player.resources.tritanium = 0;
  cruiser.fuel = 10;
  cruiser.isWarp = false;
  game.applyWarpToShip(cruiser, player);
  assert.strictEqual(cruiser.isWarp, true, "Cruiser should now be in warp");
  assert.strictEqual(cruiser.warpBonus, 21, `applyWarpToShip should have saved warpBonus as 21, got ${cruiser.warpBonus}`);

  console.log("All Warp Double Speed tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
