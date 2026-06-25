import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Supply-Fuel Drain tests...");

  const player = new Player('p1', '#00e5ff', false);

  // 1. Create a Cruiser ship
  const ship = new Ship(1, 100, 100, null, player, 500, 500);
  ship.isCruiser = true;
  ship.classType = 'corvette';
  ship.maxHealth = 25;
  ship.health = 25;
  ship.fuel = 50;
  ship.supplies = 50;
  ship.shields = 0; // disable shields initially to test movement only

  console.log(`Initial fuel: ${ship.fuel}, supplies: ${ship.supplies}`);

  const deltaTime = 1000;
  const allShips = [ship];
  const explosions = [];
  const allPlanets = [];
  const lasers = [];
  const ionStorms = [];

  // Update ship movement only
  ship.update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, 1600, null);

  console.log(`After 1s travel (no shields): fuel: ${ship.fuel}, supplies: ${ship.supplies}`);
  
  assert.strictEqual(ship.fuel, 50, "Fuel should not have been drained because supplies were available");
  assert.ok(ship.supplies < 50, "Supplies should have been drained");
  const suppliesAfterTravel = ship.supplies;

  // Now enable shields, set shieldPoints to 0, and run update again to test shield regen energy drain
  ship.shields = 1;
  ship.shieldPoints = 0;

  ship.update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, 1600, null);

  console.log(`After shield regen: fuel: ${ship.fuel}, supplies: ${ship.supplies}, shields: ${ship.shieldPoints}`);
  assert.strictEqual(ship.fuel, 50, "Fuel should still be 50 after shield regeneration because supplies were available");
  assert.ok(ship.supplies < suppliesAfterTravel, "Supplies should have been further reduced by shield regeneration");

  // Let's run down supplies to 0 and verify that it starts draining fuel
  ship.supplies = 0;
  ship.shieldPoints = 0; // need more regen
  
  ship.update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, 1600, null);
  
  console.log(`After running out of supplies: fuel: ${ship.fuel}, supplies: ${ship.supplies}`);
  assert.ok(ship.fuel < 50, "Fuel should now start draining when supplies are 0");
  assert.strictEqual(ship.supplies, 0, "Supplies should remain 0");

  console.log("All Cruiser Supply-Fuel Drain tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
