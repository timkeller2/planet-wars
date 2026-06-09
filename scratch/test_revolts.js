import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

// Setup mock environment
global.requestAnimationFrame = () => {};

const game = new Game();
const owner = new Player('p1', '#0ff', false);
const challenger = new Player('ai1', '#f00', true);

game.allPlayers = [owner, challenger];

const planet = new Planet(1, 100, 100, 30, owner, 50); // 50 ships
planet.sympathy = {
  'p1': 0,
  'ai1': 20 // Challenger is underdog (20 sympathy vs 50 ships)
};
game.planets = [planet];

let ownerWins = 0;
let challengerWins = 0;
const iterations = 10000;

for (let i = 0; i < iterations; i++) {
  // Reset cooldown so check runs every time
  planet.revoltCooldown = 0;
  planet.owner = owner;

  // Run the check manually or simulate the logic
  const threshold = planet.ships / 3; // 50 / 3 = 16.67
  const eligibleNonOwners = [];
  for (const [pId, symVal] of Object.entries(planet.sympathy)) {
    const isNotOwner = !planet.owner || pId !== planet.owner.id;
    if (isNotOwner && symVal > threshold) {
      eligibleNonOwners.push({ id: pId, sympathy: symVal });
    }
  }

  if (eligibleNonOwners.length > 0) {
    const competitors = [];

    if (planet.owner) {
      const ownerSym = planet.sympathy[planet.owner.id] || 0;
      const maxRoll = planet.ships + ownerSym;
      const rollVal = Math.floor(Math.random() * (maxRoll + 1));
      competitors.push({ id: planet.owner.id, roll: rollVal, isOwner: true });
    }

    for (const competitor of eligibleNonOwners) {
      const maxRoll = competitor.sympathy;
      const rollVal = Math.floor(Math.random() * (maxRoll + 1));
      competitors.push({ id: competitor.id, roll: rollVal, isOwner: false });
    }

    competitors.sort((a, b) => b.roll - a.roll);
    const winner = competitors[0];

    if (winner && !winner.isOwner) {
      challengerWins++;
    } else {
      ownerWins++;
    }
  }
}

console.log(`Simulation complete over ${iterations} runs:`);
console.log(`Owner wins: ${ownerWins} (${(ownerWins / iterations * 100).toFixed(2)}%)`);
console.log(`Challenger wins: ${challengerWins} (${(challengerWins / iterations * 100).toFixed(2)}%)`);
