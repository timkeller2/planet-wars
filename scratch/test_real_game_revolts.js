import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

global.requestAnimationFrame = () => {};

const game = new Game();
const owner = new Player('p1', '#0ff', false);
owner.name = "DefendingPlayer";
const challenger = new Player('ai1', '#f00', true);
challenger.name = "SubvertingPlayer";
game.allPlayers = [owner, challenger];

const planet = new Planet(1, 100, 100, 30, owner, 100); // 100 ships
planet.sympathy = {
  'p1': 0,
  'ai1': 35 // Challenger has 35 sympathy, threshold is 100 / 3 = 33.33. Challenger qualifies.
};
game.planets = [planet];

console.log("Running detailed checkSympathyRevolts test...");

planet.owner = owner;
planet.revoltCooldown = 0;

game.checkSympathyRevolts();

console.log("\nQueued Chat Messages:");
if (game.pendingChatMessages) {
  for (const msg of game.pendingChatMessages) {
    console.log(`To Player ID: ${msg.playerId} -> "${msg.text}"`);
  }
} else {
  console.log("No chat messages queued.");
}

console.log(`\nPlanet properties after check:`);
console.log(`revoltCooldown: ${planet.revoltCooldown}`);
console.log(`maxRevoltCooldown: ${planet.maxRevoltCooldown}`);
console.log(`revoltAttemptEvent: ${planet.revoltAttemptEvent}`);
