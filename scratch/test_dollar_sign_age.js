import { Game } from '../src/game.js';

console.log("=== Testing Dollar Sign Max Age ===");

const game = new Game();

// Push two explosions: one normal, one dollar sign
game.explosions.push({
  x: 100,
  y: 100,
  age: 0
});

game.explosions.push({
  x: 200,
  y: 200,
  isDollarSign: true,
  age: 0
});

console.log("Initial count:", game.explosions.length);

// Tick by 1.5 seconds (deltaTime = 1500)
game.update(1500);

console.log("After 1.5 seconds, remaining count:", game.explosions.length);
if (game.explosions.length !== 1 || !game.explosions[0].isDollarSign) {
  console.error("FAILED: Normal explosion should be removed, dollar sign should remain.");
  process.exit(1);
}

// Tick by another 4.0 seconds (deltaTime = 4000)
game.update(4000);

console.log("After another 4.0 seconds, remaining count:", game.explosions.length);
if (game.explosions.length !== 0) {
  console.error("FAILED: All explosions should be removed.");
  process.exit(1);
}

console.log("PASSED: Dollar sign max age (5.0s) and normal max age (1.0s) verified successfully.");
