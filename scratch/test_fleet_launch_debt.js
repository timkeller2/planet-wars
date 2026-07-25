import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function testFleetLaunchDebt() {
  console.log("Running Fleet Launch Debt Limit Test...");

  // Test Case 1: Player can pay launch fee with credits into trade-ship debt.
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalShips = 0;
    player.totalTradeShips = 1000;
    player.planetCount = 1;
    player.techScore = 0;
    game.allPlayers = [player];

    const homeworld = new Planet('p-1', 100, 100, 30, player, 20);
    homeworld.homeworldOf = player.id;
    game.planets = [homeworld];

    const targetPlanet = new Planet('p-2', 200, 200, 30, null, 10);
    game.planets.push(targetPlanet);

    // Ships launched: floor(20/2) = 10
    // Fee: max(0, 2√10 − √0) ≈ 6.3246, paid fully with credits into debt
    // Remaining planet ships: 20 - 10 = 10
    const expectedFee = Game.computeFleetLaunchCost(10, 0);

    game.sendShips(homeworld, targetPlanet, false, null, false, null, false, false);

    if (Math.abs(player.credits - (-expectedFee)) > 1e-6) {
      console.error(`FAIL Case 1: Player credits should be ${-expectedFee}, got ${player.credits}`);
      process.exit(1);
    }
    if (homeworld.ships !== 10) {
      console.error(`FAIL Case 1: Planet ships should be 10, got ${homeworld.ships}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 1: Paid launch cost with credits (2√ships − √tech).");
  }

  // Test Case 2: No credits / no debt room — fee paid in ships.
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalShips = 0;
    player.totalTradeShips = 0;
    player.planetCount = 1;
    player.techScore = 0;
    player.useCredits = true;
    game.allPlayers = [player];

    const regularPlanet = new Planet('p-1', 100, 100, 30, player, 20);
    game.planets = [regularPlanet];

    const targetPlanet = new Planet('p-2', 200, 200, 30, null, 10);
    game.planets.push(targetPlanet);

    // Ships launched: 10, fee ≈ 6.3246 in ships
    // Remaining: 20 - 6.3246 - 10 ≈ 3.6754
    const expectedFee = Game.computeFleetLaunchCost(10, 0);
    const expectedRemaining = 20 - expectedFee - 10;

    game.sendShips(regularPlanet, targetPlanet, false, null, false, null, false, false);

    if (player.credits !== 0) {
      console.error(`FAIL Case 2: Player credits should remain 0, got ${player.credits}`);
      process.exit(1);
    }
    if (Math.abs(regularPlanet.ships - expectedRemaining) > 1e-6) {
      console.error(`FAIL Case 2: Planet ships should be ${expectedRemaining}, got ${regularPlanet.ships}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 2: Paid launch cost with ships when no credit debt room.");
  }

  // Test Case 3: Tech reduces fee to zero for small fleets
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalTradeShips = 0;
    player.techScore = 100; // √100 = 10; 2√10 ≈ 6.32 → fee 0
    game.allPlayers = [player];

    const planet = new Planet('p-1', 100, 100, 30, player, 20);
    game.planets = [planet];
    const target = new Planet('p-2', 200, 200, 30, null, 10);
    game.planets.push(target);

    game.sendShips(planet, target, false, null, false, null, false, false);

    if (Game.computeFleetLaunchCost(10, 100) !== 0) {
      console.error(`FAIL Case 3: Expected zero fee formula for tech 100 / 10 ships`);
      process.exit(1);
    }
    if (planet.ships !== 10) {
      console.error(`FAIL Case 3: Planet ships should be 10 with free launch, got ${planet.ships}`);
      process.exit(1);
    }
    if (player.credits !== 0) {
      console.error(`FAIL Case 3: Credits should stay 0, got ${player.credits}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 3: High tech zeroes launch fee for a 10-ship fleet.");
  }

  console.log("All fleet launch cost tests passed.");
}

testFleetLaunchDebt();
