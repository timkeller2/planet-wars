import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Cruiser Target Bump Stopping Distance ===");

const runTests = () => {
  const game = new Game();
  game.width = 1000;
  game.height = 1000;

  const human = new Player('human', '#0ff', false);
  game.allPlayers = [human];

  // Spawn human cruiser 1 at (100, 100)
  const ship1 = new Ship(1, 100, 100, null, human, 100, 100);
  ship1.isCruiser = true;
  ship1.maxHealth = 100;
  ship1.health = 100;
  ship1.speed = 15;
  ship1.package = 'brute'; // Forces shouldCloseIn = true so it attempts to close within 23px
  ship1.angle = Math.PI / 2; // point directly down at ship2
  ship1.active = true;
  game.ships.push(ship1);

  // Spawn human cruiser 2 at (100, 180) - friendly so they don't fight
  const ship2 = new Ship(2, 100, 180, null, human, 100, 180);
  ship2.isCruiser = true;
  ship2.maxHealth = 100;
  ship2.health = 100;
  ship2.speed = 0;
  ship2.active = true;
  game.ships.push(ship2);

  // Issue target order: ship1 targets ship2
  ship1.orderQueue = [{
    type: 'target',
    targetType: 'ship',
    targetId: ship2.id
  }];
  ship1.executeNextOrder(game.planets, game.ships, game);

  console.log(`Initial: cruiserTargetType=${ship1.cruiserTargetType}, cruiserTargetId=${ship1.cruiserTargetId}`);

  // Run updates and track distance
  let stopped = false;
  for (let tick = 0; tick < 100; tick++) {
    game.update(1000); // 1000ms ticks
    const dist = Math.sqrt((ship1.x - ship2.x)**2 + (ship1.y - ship2.y)**2);
    console.log(`[Tick ${tick}] ship1.x=${ship1.x.toFixed(2)}, ship1.y=${ship1.y.toFixed(2)}, speed=${ship1.currentSpeed?.toFixed(2)}, dist=${dist.toFixed(2)}`);
    
    if (ship1.currentSpeed === 0) {
      console.log(`Stopped at tick ${tick}. Distance: ${dist.toFixed(2)}px`);
      if (dist < 15 || dist > 24.0) {
        console.error(`FAILED: Expected stop distance close to 23px, got ${dist.toFixed(2)}px`);
        process.exit(1);
      }
      stopped = true;
      break;
    }
  }

  if (!stopped) {
    console.error("FAILED: Cruiser did not stop!");
    process.exit(1);
  }

  console.log("Passed: Cruiser stopped short of target cruiser bump area.");
  process.exit(0);
};

runTests();
