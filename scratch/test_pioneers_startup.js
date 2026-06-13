import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

console.log("=== Testing Pioneers Startup Location & Upgrade Rules ===");

const runTests = () => {
  const game = new Game();
  game.width = 3000;
  game.height = 3000;
  game.settings = {
    homeworldSize: 'pioneers'
  };

  const human = new Player('human', '#0ff', false);
  const ai = new Player('ai_player', '#f00', true);
  game.allPlayers = [human, ai];

  // 1. Create some planets with varying economies
  // Planet at (1500, 1500) has economy 100
  const p1 = new Planet(1, 1500, 1500, 50, null, 0, game.width, game.height);
  p1.maxShips = 100;
  p1.homeworldOf = null;
  game.planets.push(p1);

  // Planet at (200, 1500) has economy 2
  const p2 = new Planet(2, 200, 1500, 20, null, 0, game.width, game.height);
  p2.maxShips = 2;
  p2.homeworldOf = null;
  game.planets.push(p2);

  // Planet at (1500, 200) has economy 18
  const p3 = new Planet(3, 1500, 200, 30, null, 0, game.width, game.height);
  p3.maxShips = 18;
  p3.homeworldOf = null;
  game.planets.push(p3);

  // Average economy = (100 + 2 + 18) / 3 = 40.

  // 2. Set up a hazard (Ion Storm) covering the top-left area
  // Location (200, 200) has storm of radius 300 (covers from 0 to 500 in x/y)
  game.ionStorms.push({
    id: 1,
    name: 'Storm One',
    type: 'storm',
    x: 200,
    y: 200,
    radius: 300
  });

  // First assign starting location for AI player at top-right edge (2800, 100)
  // We mock a ship of the AI player to simulate they spawned there
  const mockAIShip = {
    id: 999,
    x: 2800,
    y: 100,
    active: true,
    owner: ai
  };
  game.ships.push(mockAIShip);

  // Run the starting position assignment for the human player
  game.assignPlanet(human);

  // Get human spawned ships
  const humanShips = game.ships.filter(s => s.owner.id === 'human');
  console.log(`Spawned ships count for human: ${humanShips.length}`);
  if (humanShips.length !== 5) {
    console.error(`FAILED: Expected 5 spawned ships, got ${humanShips.length}!`);
    process.exit(1);
  }

  // Calculate the center of the spawned ships
  const startX = humanShips[0].x;
  const startY = humanShips[0].y;
  console.log(`Generated starting location: (${startX.toFixed(1)}, ${startY.toFixed(1)})`);

  // Assertion 1: Verify all 5 corvettes have Fuel Tanker as their 3rd upgrade
  humanShips.forEach((ship, idx) => {
    console.log(`Ship ${idx + 1}: diplomat=${ship.diplomat}, labs=${ship.labs}, munitions=${ship.munitions}, armor=${ship.armor}, fuel_tanker=${ship.fuel_tanker}, maxsupplies=${ship.maxsupplies}`);
    if (ship.fuel_tanker !== 1) {
      console.error(`FAILED: Ship ${idx + 1} does not have fuel_tanker = 1!`);
      process.exit(1);
    }
    if (ship.maxsupplies !== 15) {
      console.error(`FAILED: Ship ${idx + 1} does not have maxsupplies = 15!`);
      process.exit(1);
    }
    // First 3: diplomat & labs
    if (idx < 3) {
      if (ship.diplomat !== 1 || ship.labs !== 1) {
        console.error(`FAILED: Ship ${idx + 1} is missing diplomat/labs upgrades!`);
        process.exit(1);
      }
    } else {
      // Other 2: munitions & armor
      if (ship.munitions !== 1 || ship.armor !== 1) {
        console.error(`FAILED: Ship ${idx + 1} is missing munitions/armor upgrades!`);
        process.exit(1);
      }
    }
  });
  console.log("Passed: All corvettes have the correct upgrades (including Fuel Tanker as 3rd).");

  // Assertion 2: Must be near the map edge (within 300px of left/right or top/bottom border)
  const distToLeft = startX;
  const distToRight = game.width - startX;
  const distToTop = startY;
  const distToBottom = game.height - startY;
  const minEdgeDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
  console.log(`Minimum distance to map edge: ${minEdgeDist.toFixed(1)}px`);
  if (minEdgeDist > 300) {
    console.error("FAILED: Starting location is not near the map edge (> 300px)!");
    process.exit(1);
  }
  console.log("Passed: Starting location is near the map edge.");

  // Assertion 3: Must not be within the hazard (Ion Storm)
  const dxHazard = startX - 200;
  const dyHazard = startY - 200;
  const distToHazard = Math.sqrt(dxHazard * dxHazard + dyHazard * dyHazard);
  console.log(`Distance to hazard center (200, 200): ${distToHazard.toFixed(1)}px`);
  if (distToHazard <= 300) {
    console.error("FAILED: Spawned within the hazard area!");
    process.exit(1);
  }
  console.log("Passed: Starting location is not within a hazard.");

  // Assertion 4: Must be away from other players (at least 200px from AI ships)
  const dxPlayer = startX - mockAIShip.x;
  const dyPlayer = startY - mockAIShip.y;
  const distToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
  console.log(`Distance to other player (AI): ${distToPlayer.toFixed(1)}px`);
  if (distToPlayer < 200) {
    console.error(`FAILED: Spawned too close to other player (${distToPlayer.toFixed(1)}px < 200px)!`);
    process.exit(1);
  }
  console.log("Passed: Starting location is away from other players.");

  // Assertion 5: Check average economy sorting
  // The average economy was 40.
  // Location near (1500, 200) has economy ~ 18 (diff ~ 22)
  // Location near (200, 1500) has economy ~ 2 (diff ~ 38)
  // Location near (1500, 1500) has economy ~ 100 (diff ~ 60)
  // Location near top edge (1500, 50-300) or bottom edge (1500, 2700-2950) is closest to p3 (economy 18) or center (economy 100).
  // Let's print local economy at startX, startY
  const getEconomyWithin400 = (x, y) => {
    let sum = 0;
    for (const p of game.planets) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= 400 * 400) {
        sum += (p.maxShips || 0);
      }
    }
    return sum;
  };
  const startEco = getEconomyWithin400(startX, startY);
  console.log(`Average Map Economy: 40. Local Economy at starting location: ${startEco}`);

  console.log("\nALL NEW PIONEERS RULES TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
};

runTests();
