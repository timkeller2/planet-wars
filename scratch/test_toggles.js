import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Cruiser and Player Toggle Mechanics ===");

function setupCruiser() {
  const owner = new Player('p1', '#0ff', false);
  owner.cruiserStyle = 'Federation';
  owner.resources = {
    deuterium: 1.0,
    tritanium: 1.0,
    duranium: 1.0,
    merculite: 1.0,
    antimatter: 1.0,
    dilithium: 1.0,
    latinum: 1.0
  };

  const ship = new Ship(1, 100, 100, null, owner, 1000, 1000);
  ship.active = true;
  ship.isCruiser = true;
  ship.maxHealth = 100;
  ship.health = 80; // Damaged to trigger duranium repair
  ship.maxArmor = 10;
  ship.armorPoints = 5;
  ship.fuel = 5; // Low fuel to trigger deuterium refuel
  ship.bombs = 1; // Low bombs to trigger bomb reload
  ship.bombReloadTimer = 0; // Initialize reload timer to avoid NaN
  ship.specialduranium = 0;
  ship.specialfuel = 0;
  ship.specialbombs = 0;

  const planet = {
    x: 100,
    y: 100,
    owner: owner,
    getGravityRadius: () => 150,
    ships: 10
  };

  return { owner, ship, planet };
}

// Test 1: Toggles ON (default) - Resources are used for repair, refuel, rearm, and auto-conversion.
{
  const { owner, ship, planet } = setupCruiser();
  owner.tradeLimitToggle = true; // Default
  ship.useResources = false; // Default off

  console.log("Test 1 Initial:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    specialduranium: ship.specialduranium,
    duranium: owner.resources.duranium,
    deuterium: owner.resources.deuterium,
    merculite: owner.resources.merculite
  });

  ship.update(30000, [], [], [planet], [], [], 1920);

  console.log("Test 1 Final:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    specialduranium: ship.specialduranium,
    duranium: owner.resources.duranium,
    deuterium: owner.resources.deuterium,
    merculite: owner.resources.merculite
  });

  // 1. Should have done auto-resource conversion (Armor -> Special Duranium because armorPoints > specialduranium)
  assert(ship.specialduranium > 0, "Should auto-convert armor to special duranium when tradeLimitToggle is true");
  assert(owner.resources.duranium < 1.0, "Duranium resource should be consumed by auto-conversion");

  // 2. Should have healed using duranium since ship.health < ship.maxHealth
  assert(ship.health > 80, "Should heal");
  
  // 3. Should have refueled using deuterium
  assert(ship.fuel > 5, "Should refuel");

  // 4. Should have rearmed bombs using merculite
  assert(ship.bombs > 1, "Should rearm bombs");

  console.log("-> Test 1 Passed: Toggles ON (default) allows resource usage");
}

// Test 2: Toggles OFF (tradeLimitToggle = false, ship.useResources = false) - Resources NOT used!
{
  const { owner, ship, planet } = setupCruiser();
  owner.tradeLimitToggle = false;
  ship.useResources = false;

  const initialDuranium = owner.resources.duranium;
  const initialDeuterium = owner.resources.deuterium;
  const initialMerculite = owner.resources.merculite;

  console.log("Test 2 Initial:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    duranium: owner.resources.duranium,
    deuterium: owner.resources.deuterium,
    merculite: owner.resources.merculite
  });

  ship.update(30000, [], [], [planet], [], [], 1920);

  console.log("Test 2 Final:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    duranium: owner.resources.duranium,
    deuterium: owner.resources.deuterium,
    merculite: owner.resources.merculite
  });

  // 1. Auto-resource conversion should NOT occur
  assert(ship.specialduranium === 0, "Should NOT auto-convert when toggles are OFF");
  assert(owner.resources.duranium === initialDuranium, "Duranium should not change from auto-conversion");

  // 2. Healing should NOT consume duranium (and thus not get specialduranium or go faster)
  // Let's verify duranium is unchanged.
  assert(owner.resources.duranium === initialDuranium, "Duranium should not be consumed for healing");

  // 3. Refuel should NOT consume deuterium
  assert(owner.resources.deuterium === initialDeuterium, "Deuterium should not be consumed for refueling");

  // 4. Rearm should NOT consume merculite
  assert(owner.resources.merculite === initialMerculite, "Merculite should not be consumed for reloading bombs");

  console.log("-> Test 2 Passed: Toggles OFF prevents resource usage");
}

// Test 3: Override ON (tradeLimitToggle = false, ship.useResources = true) - Resources ARE used!
{
  const { owner, ship, planet } = setupCruiser();
  owner.tradeLimitToggle = false;
  ship.useResources = true; // Override enabled

  console.log("Test 3 Initial:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    duranium: owner.resources.duranium,
    deuterium: owner.resources.deuterium,
    merculite: owner.resources.merculite
  });

  ship.update(30000, [], [], [planet], [], [], 1920);

  console.log("Test 3 Final:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    duranium: owner.resources.duranium,
    deuterium: owner.resources.deuterium,
    merculite: owner.resources.merculite
  });

  // 1. Should have done auto-resource conversion
  assert(ship.specialduranium > 0, "Should auto-convert when override is ON");
  assert(owner.resources.duranium < 1.0, "Duranium should be consumed");

  // 2. Should heal using duranium
  assert(ship.health > 80, "Should heal");

  // 3. Should refuel
  assert(ship.fuel > 5, "Should refuel");

  // 4. Should rearm
  assert(ship.bombs > 1, "Should rearm");

  console.log("-> Test 3 Passed: Cruiser override toggle allows resource usage even if global trade toggle is off");
}

// Test 4: Cruiser is OUTSIDE a friendly gravity well, tradeLimitToggle is ON - Resource conversion should NOT occur!
{
  const { owner, ship, planet } = setupCruiser();
  owner.tradeLimitToggle = true; // ON
  ship.useResources = false;
  
  // Move ship far away from the planet so it is outside gravity well
  ship.x = 2000;
  ship.y = 2000;

  const initialDuranium = owner.resources.duranium;

  console.log("Test 4 Initial:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    duranium: owner.resources.duranium,
    inFriendlyWell: ship.inFriendlyWell
  });

  ship.update(30000, [], [], [planet], [], [], 1920);

  console.log("Test 4 Final:", {
    health: ship.health,
    fuel: ship.fuel,
    bombs: ship.bombs,
    duranium: owner.resources.duranium,
    inFriendlyWell: ship.inFriendlyWell
  });

  // Auto-resource conversion should NOT occur because ship is outside friendly gravity well
  assert(ship.specialduranium === 0, "Should NOT auto-convert when outside friendly gravity well");
  assert(owner.resources.duranium === initialDuranium, "Duranium should not change when outside friendly gravity well");

  console.log("-> Test 4 Passed: Cruiser outside friendly gravity well does not convert resources");
}

console.log("\nAll Cruiser/Player Toggle tests PASSED!");
