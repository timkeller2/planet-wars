import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Cruiser Resource Conversion ===");

// Helper to create a player and cruiser
function setupCruiser(style = 'Federation') {
  const owner = new Player('p1', '#0ff', false);
  owner.cruiserStyle = style;
  owner.resources = {
    deuterium: 0,
    tritanium: 0,
    duranium: 0,
    merculite: 0,
    antimatter: 0,
    dilithium: 0,
    latinum: 0
  };

  const ship = new Ship(1, 100, 100, null, owner, 1000, 1000);
  ship.active = true;
  ship.isCruiser = true;
  ship.maxHealth = 20;
  ship.health = 20;

  return { owner, ship };
}

// Test 1: No conversion occurs if basic <= special
{
  const { owner, ship } = setupCruiser();
  owner.resources.duranium = 1.0;
  ship.armorPoints = 0;
  ship.specialduranium = 0;

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialduranium === 0, "Should not convert armor when armorPoints <= specialduranium");
  assert(owner.resources.duranium === 1.0, "Should not consume resources when no conversion occurs");
  console.log("-> Test 1 Passed: No conversion when basic <= special");
}

// Test 2: No conversion occurs if player doesn't have resources
{
  const { owner, ship } = setupCruiser();
  ship.armorPoints = 5;
  ship.specialduranium = 0;
  owner.resources.duranium = 0.01; // Less than 1/36 (0.0278)

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialduranium === 0, "Should not convert armor when resources are insufficient");
  assert(owner.resources.duranium === 0.01, "Resources should remain unchanged");
  console.log("-> Test 2 Passed: No conversion when resources are insufficient");
}

// Test 3: Conversion of Armor -> Special Duranium
{
  const { owner, ship } = setupCruiser();
  ship.armorPoints = 5;
  ship.specialduranium = 0;
  owner.resources.duranium = 1.0;

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialduranium === 1, "Should convert 1 armor point to specialduranium");
  const expectedDuranium = 1.0 - (1/36);
  assert(Math.abs(owner.resources.duranium - expectedDuranium) < 1e-6, `Expected duranium ${expectedDuranium}, got ${owner.resources.duranium}`);
  assert(ship.resourceConsumeEvents.duranium === 1, "Should trigger the duranium consume event");
  console.log("-> Test 3 Passed: Armor to Special Duranium conversion and animation trigger");
}

// Test 4: Conversion of Fuel -> Special Fuel
{
  const { owner, ship } = setupCruiser();
  ship.fuel = 10;
  ship.specialfuel = 0;
  owner.resources.deuterium = 1.0;

  // First check 15 seconds - no conversion should occur
  ship.update(15000, [], [], [], [], [], 1920);
  assert(ship.specialfuel === 0, "Should not convert after only 15 seconds");

  // Next 15 seconds (total 30) - conversion should occur
  ship.update(15000, [], [], [], [], [], 1920);
  assert(ship.specialfuel === 1, "Should convert to special fuel after 30 seconds");
  const expectedDeuterium = 1.0 - (1/36);
  assert(Math.abs(owner.resources.deuterium - expectedDeuterium) < 1e-6, `Expected deuterium ${expectedDeuterium}, got ${owner.resources.deuterium}`);
  assert(ship.resourceConsumeEvents.deuterium === 1, "Should trigger the deuterium consume event");
  console.log("-> Test 4 Passed: Fuel to Special Fuel conversion and 30-second interval check");
}

// Test 5: Fuel -> Special Fuel with fuel_tanker discount costMultiplier
{
  const { owner, ship } = setupCruiser();
  ship.fuel = 10;
  ship.specialfuel = 0;
  ship.fuel_tanker = 2; // Discount = 0.50 + 0.10 * 2 = 0.70; costMultiplier = 0.30
  owner.resources.deuterium = 1.0;

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialfuel === 1, "Should convert to special fuel");
  const costMultiplier = 0.30;
  const expectedDeuterium = 1.0 - (1/36) * costMultiplier;
  assert(Math.abs(owner.resources.deuterium - expectedDeuterium) < 1e-6, `Expected deuterium ${expectedDeuterium}, got ${owner.resources.deuterium}`);
  console.log("-> Test 5 Passed: Fuel to Special Fuel conversion respects tanker discounts");
}

// Test 6: Conversion of Bombs -> Special Bombs (Federation - Merculite)
{
  const { owner, ship } = setupCruiser('Federation');
  ship.bombs = 5;
  ship.specialbombs = 0;
  owner.resources.merculite = 1.0;

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialbombs === 1, "Should convert 1 bomb to specialbomb");
  const expectedMerculite = 1.0 - (1/36);
  assert(Math.abs(owner.resources.merculite - expectedMerculite) < 1e-6, `Expected merculite ${expectedMerculite}, got ${owner.resources.merculite}`);
  assert(ship.resourceConsumeEvents.merculite === 1, "Should trigger the merculite consume event");
  console.log("-> Test 6 Passed: Bombs to Special Bombs (Merculite)");
}

// Test 7: Conversion of Bombs -> Special Bombs (Romulan - Antimatter)
{
  const { owner, ship } = setupCruiser('Romulan');
  ship.bombs = 5;
  ship.specialbombs = 0;
  owner.resources.antimatter = 1.0;

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialbombs === 1, "Should convert 1 bomb to specialbomb");
  const expectedAntimatter = 1.0 - (1/36);
  assert(Math.abs(owner.resources.antimatter - expectedAntimatter) < 1e-6, `Expected antimatter ${expectedAntimatter}, got ${owner.resources.antimatter}`);
  assert(ship.resourceConsumeEvents.antimatter === 1, "Should trigger the antimatter consume event");
  console.log("-> Test 7 Passed: Bombs to Special Bombs (Antimatter)");
}

// Test 8: Conversion of Bombs -> Special Bombs (Tholian - Dilithium)
{
  const { owner, ship } = setupCruiser('Tholian');
  ship.bombs = 5;
  ship.specialbombs = 0;
  owner.resources.dilithium = 1.0;

  ship.update(30000, [], [], [], [], [], 1920);

  assert(ship.specialbombs === 1, "Should convert 1 bomb to specialbomb");
  const expectedDilithium = 1.0 - (1/36);
  assert(Math.abs(owner.resources.dilithium - expectedDilithium) < 1e-6, `Expected dilithium ${expectedDilithium}, got ${owner.resources.dilithium}`);
  assert(ship.resourceConsumeEvents.dilithium === 1, "Should trigger the dilithium consume event");
  console.log("-> Test 8 Passed: Bombs to Special Bombs (Dilithium)");
}

// Test 9: Only 1 item upgraded per 30-second tick (Priority check: Armor, then Fuel, then Bombs)
{
  const { owner, ship } = setupCruiser('Federation');
  ship.armorPoints = 5;
  ship.specialduranium = 0;
  ship.fuel = 10;
  ship.specialfuel = 0;
  ship.bombs = 5;
  ship.specialbombs = 0;

  owner.resources.duranium = 1.0;
  owner.resources.deuterium = 1.0;
  owner.resources.merculite = 1.0;

  ship.update(30000, [], [], [], [], [], 1920);

  // Since armor has higher priority in sequence, only armor should convert in the first tick
  assert(ship.specialduranium === 1, "Armor should convert");
  assert(ship.specialfuel === 0, "Fuel should NOT convert in the same tick");
  assert(ship.specialbombs === 0, "Bombs should NOT convert in the same tick");
  assert(Math.abs(owner.resources.duranium - (1.0 - (1/36))) < 1e-6, "Duranium should be consumed");
  assert(owner.resources.deuterium === 1.0, "Deuterium should NOT be consumed");
  assert(owner.resources.merculite === 1.0, "Merculite should NOT be consumed");

  // Run another 30 seconds. Now that specialduranium === armorPoints (no, wait! 1 < 5 so armorPoints > specialduranium is still true!)
  // Since armorPoints (5) > specialduranium (1), armor should convert AGAIN!
  ship.update(30000, [], [], [], [], [], 1920);
  assert(ship.specialduranium === 2, "Armor should convert again");
  assert(ship.specialfuel === 0, "Fuel should still NOT convert");

  // Let's make armorPoints <= specialduranium by setting specialduranium to 5
  ship.specialduranium = 5;
  // Now armor is not eligible. Fuel should convert on the next tick!
  ship.update(30000, [], [], [], [], [], 1920);
  assert(ship.specialfuel === 1, "Fuel should convert now");
  assert(ship.specialbombs === 0, "Bombs should still NOT convert");

  // Let's make fuel <= specialfuel
  ship.specialfuel = 10;
  // Now only bombs should convert on the next tick!
  ship.update(30000, [], [], [], [], [], 1920);
  assert(ship.specialbombs === 1, "Bombs should convert now");

  console.log("-> Test 9 Passed: Priority and single-item-per-tick constraint checked successfully");
}

console.log("\nAll Cruiser Resource Conversion tests PASSED!");
