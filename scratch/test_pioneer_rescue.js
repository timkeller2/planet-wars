import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Pioneer Rescue tests...");

  // 1. Initialize Game with Pioneer Mode settings
  const game = new Game({ width: 1600, height: 1600 });
  game.settings = game.settings || {};
  game.settings.homeworldSize = 'pioneers';
  game.initMap();

  // 2. Set up player p1 (who has never owned a planet)
  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  player.hasOwnedPlanet = false;
  player.credits = 250;

  // Clear all p1 ships to start clean
  for (const s of game.ships) {
    if (s.owner && s.owner.id === player.id) {
      s.active = false;
    }
  }
  game.pendingPioneerSpawns = [];

  console.log(`Initial Credits: ${player.credits}`);
  console.log(`Initial Cruisers: ${game.ships.filter(s => s.active && s.owner && s.owner.id === player.id).length}, Pending Spawns: ${game.pendingPioneerSpawns.length}`);

  // 3. First update should trigger a rescue corvette spawn since player has 0 cruisers and 250 credits (>= 200 cost)
  game.update(100);

  console.log(`Credits after first update: ${player.credits}`);
  console.log(`Pending Spawns after first update: ${game.pendingPioneerSpawns.length}`);

  assert.strictEqual(Math.floor(player.credits), 50, "Credits should have been deducted by 200 (modulo interest)");
  assert.strictEqual(game.pendingPioneerSpawns.length, 1, "There should be 1 pending rescue spawn");
  assert.strictEqual(game.pendingPioneerSpawns[0].classType, 'corvette', "The spawn type should be a corvette");
  assert.strictEqual(game.pendingPioneerSpawns[0].upgradeTokens, 3, "The corvette should have 3 upgrade tokens");

  // 4. Update to let the warp-in complete (it has a timer of 1000ms, i.e. 1 second)
  game.update(1000);

  const activeP1Ships = game.ships.filter(s => s.active && s.owner && s.owner.id === player.id);
  console.log(`Active p1 ships after warp-in: ${activeP1Ships.length}`);
  assert.strictEqual(activeP1Ships.length, 1, "The rescue corvette should have successfully warped in as an active ship");
  const warpedShip = activeP1Ships[0];
  assert.strictEqual(warpedShip.classType, 'corvette', "Warped ship should be corvette");
  assert.strictEqual(warpedShip.upgradeTokens, 3, "Warped ship should have 3 upgrade tokens");
  assert.strictEqual(warpedShip.pioneerWarpIn, true, "Warped ship should have pioneerWarpIn enabled");

  // 5. Deactivate/destroy the corvette
  warpedShip.active = false;

  // 6. Verify that it won't spawn another one if credits are below 200
  game.update(100);
  assert.strictEqual(game.pendingPioneerSpawns.length, 0, "Should not spawn another rescue corvette when credits are below 200");

  // 7. Give the player 300 credits (bringing balance to 350)
  player.credits = 350;

  // 8. Verify that it spawns a second rescue corvette
  game.update(100);
  assert.strictEqual(Math.floor(player.credits), 150, "Credits should have been deducted to 150 (modulo interest)");
  assert.strictEqual(game.pendingPioneerSpawns.length, 1, "Should have queued a second rescue corvette");

  // Let the second warp-in complete
  game.update(1000);
  const secondCorvette = game.ships.find(s => s.active && s.owner && s.owner.id === player.id);
  assert.ok(secondCorvette, "A second corvette should be active");

  // 9. Assign a planet to the player (representing gaining a planet)
  const planet = game.planets[0];
  planet.owner = player; // This triggers player.hasOwnedPlanet = true via the setter!
  
  assert.strictEqual(player.hasOwnedPlanet, true, "Player hasOwnedPlanet should now be true");

  // 10. Deactivate/destroy the second corvette
  secondCorvette.active = false;
  player.credits = 300; // give plenty of credits

  // 11. Verify that they do NOT get another rescue corvette because they have owned a planet
  game.update(100);
  assert.strictEqual(game.pendingPioneerSpawns.length, 0, "Should NOT spawn a rescue corvette once the player has owned a planet");
  assert.strictEqual(Math.floor(player.credits), 300, "Credits should remain unchanged (modulo interest)");

  console.log("All Pioneer Rescue tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
