import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Captured Monster Ship Speed Restoration ===");

const game = new Game();
const human = new Player('human', '#0ff', false);
human.name = 'Human';
human.isAlive = true;

const monsterPlayer = new Player('monsters', '#006400', true);
monsterPlayer.name = 'Monsters';
monsterPlayer.isAlive = true;

game.allPlayers = [human, monsterPlayer];
game.ships.length = 0;
game.isRunning = true;

// 1. Create a monster pirate ship (with speed = 12)
const monsterShip = new Ship(1, 500, 500, null, monsterPlayer);
monsterShip.speed = 12; // 22 - 10
monsterShip.isCruiser = true;
monsterShip.maxHealth = 30;
monsterShip.health = 30;
monsterShip.crew = 0; // boarding succeeds immediately when defenders <= 0
monsterShip.marineCount = 0;
monsterShip.isUnderBoarding = true;
monsterShip.boardingPlayer = human;
monsterShip.boardingSourceId = 999;
monsterShip.boardingMarines = 10; // survivors will capture

game.ships.push(monsterShip);

console.log(`Before capture: owner = ${monsterShip.owner.id}, speed = ${monsterShip.speed}`);

// 2. Run update to trigger boarding resolution in game.js
// Boarding resolution is evaluated in game.update()
// Let's call game.update(1000)
game.update(1000);

console.log(`After capture: owner = ${monsterShip.owner.id}, speed = ${monsterShip.speed}`);

if (monsterShip.owner !== human) {
  console.error(`-> FAILED: Expected owner to be human, got: ${monsterShip.owner.id}`);
  process.exit(1);
}

if (monsterShip.speed !== 22) {
  console.error(`-> FAILED: Expected captured speed to be restored to 22, got: ${monsterShip.speed}`);
  process.exit(1);
}

console.log("-> PASSED: Captured monster ship speed was successfully restored to player default (22).");
console.log("\nAll checks passed successfully!");
