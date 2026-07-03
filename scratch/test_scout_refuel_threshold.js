import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Scout Refuel Threshold tests...");

  const player = new Player('p1', '#00e5ff', false);

  // 1. Create a Cruiser ship in Scout mode
  const ship = new Ship(1, 100, 100, null, player, 500, 500);
  ship.isCruiser = true;
  ship.classType = 'corvette';
  ship.maxHealth = 40;
  ship.health = 40;
  ship.isScouting = true;
  ship.supplies = 0; // no supplies to force fuel check
  
  // Set up mock method for getMaxFuel (base is 50, but let's make it 100 for easy percentage math)
  ship.getMaxFuel = () => 100;

  const deltaTime = 100;
  const allShips = [ship];
  const explosions = [];
  const allPlanets = [];
  const lasers = [];
  const ionStorms = [];

  // Test 1: Fuel at 35% (35 / 100). Should NOT trigger retreat.
  ship.fuel = 35;
  ship.scoutFuelRetreating = false;
  
  // Call update
  ship.update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, 1600, null);
  
  console.log(`At 35% fuel: scoutFuelRetreating = ${ship.scoutFuelRetreating}`);
  assert.strictEqual(ship.scoutFuelRetreating, false, "Cruiser should not retreat at 35% fuel");

  // Test 2: Fuel at 30% (30 / 100). Should trigger retreat.
  ship.fuel = 30;
  ship.scoutFuelRetreating = false;

  // Call update
  ship.update(deltaTime, allShips, explosions, allPlanets, lasers, ionStorms, 1600, null);

  console.log(`At 30% fuel: scoutFuelRetreating = ${ship.scoutFuelRetreating}`);
  assert.strictEqual(ship.scoutFuelRetreating, true, "Cruiser should retreat at 30% fuel");

  console.log("All Cruiser Scout Refuel Threshold tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
