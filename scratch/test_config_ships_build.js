import { Game } from '../src/game.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Configuration Build Garrison Cost tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  const planet = game.planets[0];
  const player1 = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];

  game.planets = [planet];
  game.pendingAIs = [];
  game.aiControllers = [];

  planet.owner = player1;
  planet.ships = 100;
  planet.maxShips = 150;
  planet.isMilitary = false;
  planet.homeworldOf = player1.id;

  // Define a configuration for destroyer:
  // Base destroyer costShips = 100
  const config = {
    name: "Heavy Lab Destroyer",
    classType: "destroyer",
    upgrades: {
      labs: 3,
      armor: 3
    }
  };

  // Give player enough credits
  player1.credits = 1000;
  
  // Mark destroyer as already built so it has no first-build cost scaling multiplier:
  player1.builtClasses = { corvette: true, destroyer: true };
  player1.buildCounts = { corvette: 1, destroyer: 1 };

  console.log("Before build attempt:");
  console.log("Player credits:", player1.credits);
  console.log("Planet ships:", planet.ships);

  // Call buildCapitalShipConfig with correct argument order:
  // buildCapitalShipConfig(source, classType, upgrades, configName)
  game.buildCapitalShipConfig(planet, config.classType, config.upgrades, config.name);

  // Assert that a ship was built!
  const cruiser = game.ships.find(s => s.isCruiser && s.classType === config.classType);
  assert.ok(cruiser, "Cruiser configuration build failed to spawn a ship!");
  console.log("Successfully built configuration ship!");
  console.log("Cruiser name:", cruiser.name);
  console.log("Remaining planet ships:", planet.ships);
  console.log("Remaining player credits:", player1.credits);

  console.log("\nAll Cruiser Configuration Build tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
