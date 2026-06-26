import { Ship } from '../src/entities/Ship.js';

// Mock simple game/environment classes
class MockPlayer {
  constructor() {
    this.resources = {
      duranium: 10,
      deuterium: 10,
      merculite: 10,
      antimatter: 10,
      dilithium: 10
    };
    this.tradeLimitToggle = true;
  }
}

// Test basic alternation
function testAlternation() {
  console.log("Running Cruiser Resource Conversion Alternation Test...");

  const player = new MockPlayer();
  const ship = new Ship('test-cruiser', 0, 0, null, player);

  // Configure ship to be a cruiser and require all three types of resources
  ship.isCruiser = true;
  ship.inFriendlyWell = true;
  ship.useResources = true;

  // Set limits / requirements:
  // Needs duranium: max armorPoints = 10, specialduranium = 0
  ship.maxArmor = 10;
  ship.armorPoints = 10;
  ship.specialduranium = 0;

  // Needs deuterium: fuel = 10, specialfuel = 0
  ship.maxfuel = 10;
  ship.fuel = 10;
  ship.specialfuel = 0;
  ship.getMaxFuel = () => 10;

  // Needs bombs: bombs = 10, specialbombs = 0
  ship.maxbombs = 10;
  ship.bombs = 10;
  ship.specialbombs = 0;

  // Track the order of conversions
  const conversionSequence = [];

  for (let i = 0; i < 9; i++) {
    const prevDuranium = ship.specialduranium;
    const prevFuel = ship.specialfuel;
    const prevBombs = ship.specialbombs;

    ship.tryAutoResourceConversion();

    if (ship.specialduranium > prevDuranium) {
      conversionSequence.push('duranium');
    } else if (ship.specialfuel > prevFuel) {
      conversionSequence.push('deuterium');
    } else if (ship.specialbombs > prevBombs) {
      conversionSequence.push('bombs');
    } else {
      conversionSequence.push('none');
    }
  }

  console.log("Conversion sequence observed:", conversionSequence.join(' -> '));

  // We expect: duranium -> deuterium -> bombs -> duranium -> deuterium -> bombs -> duranium -> deuterium -> bombs
  const expected = ['duranium', 'deuterium', 'bombs', 'duranium', 'deuterium', 'bombs', 'duranium', 'deuterium', 'bombs'];
  let passed = true;
  for (let i = 0; i < expected.length; i++) {
    if (conversionSequence[i] !== expected[i]) {
      passed = false;
      break;
    }
  }

  if (passed) {
    console.log("SUCCESS: Alternation operates in perfect round-robin order!");
    process.exit(0);
  } else {
    console.error("FAIL: Expected sequence: " + expected.join(' -> ') + " but got: " + conversionSequence.join(' -> '));
    process.exit(1);
  }
}

testAlternation();
