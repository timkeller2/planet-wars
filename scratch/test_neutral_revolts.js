import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

global.requestAnimationFrame = () => {};

const game = new Game();
const challenger = new Player('ai1', '#f00', true);
challenger.name = "SubvertingPlayer";
game.allPlayers = [challenger];

// Create a neutral planet with no owner, containing 9 ships
const planet = new Planet(1, 100, 100, 30, null, 9);
planet.sympathy = {
  'ai1': 10 // Challenger has 10 sympathy. Threshold is 9 / 3 = 3. Challenger qualifies.
};
game.planets = [planet];

console.log("Running checkSinglePlanetSympathyRevolt test on Neutral Planet...");

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
console.log(`Owner: ${planet.owner ? planet.owner.name : 'Neutral'}`);
console.log(`revoltCooldown: ${planet.revoltCooldown}`);
console.log(`maxRevoltCooldown: ${planet.maxRevoltCooldown}`);
console.log(`revoltAttemptEvent: ${planet.revoltAttemptEvent}`);
