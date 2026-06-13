import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

console.log("=== Testing Pioneers Startup Location Rules ===");

const runTests = () => {
  const game = new Game();
  game.width = 3000;
  game.height = 3000;
  game.settings = {
    homeworldSize: 'pioneers'
  };

  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // 1. Create one very high-economy planet at the center (1500, 1500)
  const pCenter = new Planet(1, 1500, 1500, 50, null, 0, game.width, game.height);
  pCenter.maxShips = 100; // local economy ~ 100
  pCenter.homeworldOf = null;
  game.planets.push(pCenter);

  // 2. Create 10 low-economy planets scattered around the corners/edges
  // These will keep the average economy low so the center is > 3 * average
  for (let i = 2; i <= 11; i++) {
    // Put them in corners
    const x = i <= 6 ? 200 + i * 50 : game.width - 200 - i * 50;
    const y = i <= 6 ? 200 + i * 50 : game.height - 200 - i * 50;
    const p = new Planet(i, x, y, 15, null, 0, game.width, game.height);
    p.maxShips = 2; // local economy ~ 2
    p.homeworldOf = null;
    game.planets.push(p);
  }

  // Run the starting position assignment
  game.assignPlanet(human);

  // The starting position was used to spawn player ships
  const spawnedShips = game.ships.filter(s => s.owner.id === 'human');
  console.log(`Spawned ships count: ${spawnedShips.length}`);
  if (spawnedShips.length === 0) {
    console.error("FAILED: No ships spawned for human player!");
    process.exit(1);
  }

  // Calculate the center of the spawned ships
  const startX = spawnedShips[0].x;
  const startY = spawnedShips[0].y;
  console.log(`Generated starting location: (${startX.toFixed(1)}, ${startY.toFixed(1)})`);

  // Assertion 1: Must be near the map edge (within 300px of left/right or top/bottom border)
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

  // Assertion 2: Must be at least 300px from any planet
  for (const p of game.planets) {
    const dx = p.x - startX;
    const dy = p.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 300) {
      console.error(`FAILED: Starting location is too close to Planet ${p.id} (${dist.toFixed(1)}px < 300px)!`);
      process.exit(1);
    }
  }
  console.log("Passed: Location is at least 300px from all planets.");

  // Assertion 3: Must be far away (>= 500px) from the high-economy area (the center planet)
  const distToCenter = Math.sqrt((pCenter.x - startX) ** 2 + (pCenter.y - startY) ** 2);
  console.log(`Distance to high-economy center planet: ${distToCenter.toFixed(1)}px`);
  if (distToCenter < 500) {
    console.error(`FAILED: Starting location is too close to high-economy planet (${distToCenter.toFixed(1)}px < 500px)!`);
    process.exit(1);
  }
  console.log("Passed: Location is far away from high-economy areas.");

  console.log("\nALL PIONEERS STARTUP TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
};

runTests();
