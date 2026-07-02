import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Fuel and Dilithium consumption test (strict deep space vs friendly well)...");

  // 1. Initialize Game
  const game = new Game({ width: 2000, height: 2000 });
  const player = game.allPlayers[0];
  console.log(`Player ID: ${player.id}`);

  // Give player 10 dilithium
  player.resources = {
    dilithium: 10,
    deuterium: 10,
    tritanium: 10,
    duranium: 10,
    merculite: 10,
    antimatter: 10,
    latinum: 10
  };

  // Spawn cruiser in deep space (no planets)
  const cruiser = new Ship('c_test', 1000, 1000, null, player);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;
  cruiser.extended_fuel = 3; // level 3 extended fuel tanks
  cruiser.fuel = 16.5; // Starts just above 50% fuel (16.0)
  cruiser.reactor = 2; // Only 2 reactor points
  cruiser.reactorCooldown = 0; // Ready to trigger
  
  // Set destination far away
  cruiser.targetX = 1800;
  cruiser.targetY = 1800;

  // Let's ensure there are no planets near the cruiser first
  game.planets = [];
  cruiser.inFriendlyWell = false;

  console.log(`Phase 1: Deep Space Movement (Expected: reactor doesn't regenerate, dilithium constant)`);
  
  const deltaTime = 1000; // 1 second
  
  // Step 1 to 5: fuel should drop and reactor shouldn't change
  for (let step = 1; step <= 5; step++) {
    cruiser.update(deltaTime, [cruiser], [], [], [], [], 2000, game);
    console.log(`Step ${step} (Deep Space): Fuel = ${cruiser.fuel.toFixed(4)}, Reactor = ${cruiser.reactor}, Dilithium = ${player.resources.dilithium.toFixed(4)}`);
    assert.strictEqual(cruiser.reactor, 2, "Reactor points should not change in deep space before triggering recovery");
    assert.strictEqual(player.resources.dilithium, 10, "Dilithium should not be consumed in deep space");
  }

  // Step 6: Fuel goes below 50% (16.0), so emergency recovery should trigger and consume reactor points
  cruiser.update(deltaTime, [cruiser], [], [], [], [], 2000, game);
  console.log(`Step 6 (Deep Space Recovery): Fuel = ${cruiser.fuel.toFixed(4)}, Reactor = ${cruiser.reactor}, Dilithium = ${player.resources.dilithium.toFixed(4)}`);
  assert.strictEqual(cruiser.reactor, 0, "Reactor points should drop to 0 after recovery in deep space");
  assert.strictEqual(player.resources.dilithium, 10, "Dilithium should still not be consumed");

  // Step 7: Since reactor points are 0 and it's in deep space, it shouldn't regenerate points
  cruiser.update(deltaTime, [cruiser], [], [], [], [], 2000, game);
  console.log(`Step 7 (Deep Space post-recovery): Fuel = ${cruiser.fuel.toFixed(4)}, Reactor = ${cruiser.reactor}, Dilithium = ${player.resources.dilithium.toFixed(4)}`);
  assert.strictEqual(cruiser.reactor, 0, "Reactor should not regenerate in deep space");
  assert.strictEqual(player.resources.dilithium, 10, "Dilithium should remain at 10");

  // Phase 2: Enter Friendly Gravity Well
  console.log(`\nPhase 2: Enter Friendly Gravity Well (Expected: reactor regenerates, dilithium is consumed)`);
  
  // Spawn a friendly planet right on top of the cruiser
  const friendlyPlanet = {
    id: 'p_friendly',
    x: cruiser.x,
    y: cruiser.y,
    radius: 50,
    owner: player,
    getGravityRadius: () => 150,
    dead: false
  };
  game.planets = [friendlyPlanet];

  // Run update step 8: should recognize the well and regenerate immediately!
  cruiser.update(deltaTime, [cruiser], [], game.planets, [], [], 2000, game);
  console.log(`Step 8 (In Friendly Well): Fuel = ${cruiser.fuel.toFixed(4)}, Reactor = ${cruiser.reactor}, Dilithium = ${player.resources.dilithium.toFixed(4)}, inFriendlyWell = ${cruiser.inFriendlyWell}`);
  
  assert.strictEqual(cruiser.inFriendlyWell, true, "Cruiser should be inside friendly gravity well");
  assert.strictEqual(cruiser.reactor, 1, "Reactor should start regenerating immediately in friendly well");
  assert.strictEqual(player.resources.dilithium, 9.95, "Dilithium should be consumed for regeneration immediately");

  console.log("\nAll Cruiser fuel/dilithium deep space restriction tests passed successfully!");
}

runTest();
