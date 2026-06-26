import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function testFleetLaunchDebt() {
  console.log("Running Fleet Launch Debt Limit Test...");

  // Test Case 1: Player owns homeworld, has 0 credits (can go into debt up to -1000).
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalShips = 0;
    player.planetCount = 1;
    game.allPlayers = [player];

    // Homeworld owned by the player
    const homeworld = new Planet('p-1', 100, 100, 30, player, 20);
    homeworld.homeworldOf = player.id;
    game.planets = [homeworld];

    const targetPlanet = new Planet('p-2', 200, 200, 30, null, 10);
    game.planets.push(targetPlanet);

    // Launch cost should be 10 + 1 (planetCount) - 0 = 11.
    // Credits available: 0 - (-1000) = 1000.
    // So player can pay the full 11 credits and go to -11 credits.
    // Expected ships sent: 20 / 2 = 10 ships.
    // Remaining planet ships: 20 - 10 = 10 (no ship launch cost deducted).
    
    game.sendShips(homeworld, targetPlanet, false, null, false, null, false, false);

    if (player.credits !== -11) {
      console.error(`FAIL Case 1: Player credits should be -11, got ${player.credits}`);
      process.exit(1);
    }
    if (homeworld.ships !== 10) {
      console.error(`FAIL Case 1: Planet ships should be 10, got ${homeworld.ships}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 1: Paid launch cost with credits down to debt limit (-11 credits).");
  }

  // Test Case 2: Player does not own homeworld, has 0 credits (cannot go into debt).
  {
    const game = new Game();
    const player = new Player('human-1', '#ff0000', false);
    player.isAlive = true;
    player.credits = 0;
    player.totalShips = 0;
    player.planetCount = 1;
    game.allPlayers = [player];

    // Regular planet (NOT homeworld) owned by player
    const regularPlanet = new Planet('p-1', 100, 100, 30, player, 20);
    game.planets = [regularPlanet];

    const targetPlanet = new Planet('p-2', 200, 200, 30, null, 10);
    game.planets.push(targetPlanet);

    // Launch cost should be 11.
    // Credits available: 0.
    // So player cannot pay with credits.
    // Ship launch cost: 11.
    // tempShips: 20 - 11 = 9.
    // standardShipsToSend: 9 / 2 = 4.
    // Remaining planet ships: 20 - 11 (launch cost) - 4 (sent) = 5.

    game.sendShips(regularPlanet, targetPlanet, false, null, false, null, false, false);

    if (player.credits !== 0) {
      console.error(`FAIL Case 2: Player credits should remain 0, got ${player.credits}`);
      process.exit(1);
    }
    if (regularPlanet.ships !== 5) {
      console.error(`FAIL Case 2: Planet ships should be 5, got ${regularPlanet.ships}`);
      process.exit(1);
    }
    console.log("SUCCESS Case 2: Paid launch cost with ships because no homeworld is owned.");
  }

  console.log("ALL TESTS PASSED!");
  process.exit(0);
}

testFleetLaunchDebt();
