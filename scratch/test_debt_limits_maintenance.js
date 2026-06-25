import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function runTest() {
  console.log("Running Storage Fee Debt Limits Test...");

  // Test Case 1: Player owns homeworld, has 0 credits.
  // Capacity: commandLimit + tradeCapacity = 5 + 1 + 2 (controlled HW) + 3 (controls own HW) + 1 (trade) = 12.
  // Stockpile: 18 units. Excess: 6 units.
  // storageFee per sec = 6 / (12 * 8) = 0.0625 credits.
  // minAllowedCredits = -(1000 + 0) = -1000.
  // Expected: credits reduce by 0.0625 to -0.0625. No resource deduction.
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalShips = 0;
    player.planetCount = 1;
    player.resources = { dilithium: 18, merculite: 0, duranium: 0, tritanium: 0, antimatter: 0, deuterium: 0, latinum: 0 };
    game.allPlayers = [player];

    const homeworld = new Planet('p-1', 100, 100, 30, player, 0); // ships = 0
    homeworld.homeworldOf = player.id;
    game.planets = [homeworld];

    game.update(1000); // 1s tick

    const expectedCredits = -0.0625;
    if (Math.abs(player.credits - expectedCredits) > 0.0001) {
      console.error(`FAIL Case 1: Player credits should be ${expectedCredits}, got ${player.credits}`);
      process.exit(1);
    }
    if (player.resources.dilithium !== 18) {
      console.error(`FAIL Case 1: Dilithium should still be 18, got ${player.resources.dilithium}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 1: Paid storage fee using debt credit.");
  }

  // Test Case 2: Player without homeworld, has 0 credits.
  // Capacity: 5 + 1 (planetCount) + 1 (trade) = 7.
  // Stockpile: 18 units. Excess: 11 units.
  // storageFee per sec = 11 / (7 * 8) = 11 / 56 = 0.19642857142857142.
  // minAllowedCredits = 0.
  // Expected: credits remain 0, dilithium reduced by 11 / 56.
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalShips = 0;
    player.planetCount = 1;
    player.resources = { dilithium: 18, merculite: 0, duranium: 0, tritanium: 0, antimatter: 0, deuterium: 0, latinum: 0 };
    game.allPlayers = [player];

    const regularPlanet = new Planet('p-1', 100, 100, 30, player, 0); // ships = 0
    game.planets = [regularPlanet];

    game.update(1000);

    const expectedDilithium = 18 - (11 / 56);
    if (player.credits !== 0) {
      console.error(`FAIL Case 2: Player credits should remain 0, got ${player.credits}`);
      process.exit(1);
    }
    if (Math.abs(player.resources.dilithium - expectedDilithium) > 0.0001) {
      console.error(`FAIL Case 2: Dilithium should be ${expectedDilithium}, got ${player.resources.dilithium}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 2: Deducted storage fee from resources because player cannot borrow.");
  }

  // Test Case 3: Player has homeworld, but is already at the debt limit.
  // Capacity: 12. Excess: 6. storageFee = 0.0625.
  // minAllowedCredits = -1000.
  // player.credits = -1000.
  // Expected: credits remain -1000 - interest, dilithium reduced by 0.0625.
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = -1000;
    player.totalShips = 0;
    player.planetCount = 1;
    player.resources = { dilithium: 18, merculite: 0, duranium: 0, tritanium: 0, antimatter: 0, deuterium: 0, latinum: 0 };
    game.allPlayers = [player];

    const homeworld = new Planet('p-1', 100, 100, 30, player, 0); // ships = 0
    homeworld.homeworldOf = player.id;
    game.planets = [homeworld];

    game.update(1000);

    const expectedDilithium = 18 - 0.0625;
    // Interest per min = -1000 * 2.5% = -25.
    // Interest per second = -25 / 60 = -0.416667.
    // So credits should be -1000 - 0.416667 = -1000.416667.
    const expectedCredits = -1000 - (25 / 60);
    if (Math.abs(player.credits - expectedCredits) > 0.0001) {
      console.error(`FAIL Case 3: Player credits should be ${expectedCredits}, got ${player.credits}`);
      process.exit(1);
    }
    if (Math.abs(player.resources.dilithium - expectedDilithium) > 0.0001) {
      console.error(`FAIL Case 3: Dilithium should be ${expectedDilithium}, got ${player.resources.dilithium}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 3: Deducted storage fee from resources because player is at debt limit.");
  }

  console.log("ALL TESTS PASSED!");
  process.exit(0);
}

runTest();
