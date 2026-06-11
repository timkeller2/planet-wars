import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';
import { Ship } from '../src/entities/Ship.js';

console.log("=== Testing Pirate Activity and Pirate Income Calculations ===");

const game = new Game();

const p1 = new Player('p1', '#0ff', false);
p1.name = "Federation";
p1.credits = 1000;

const p2 = new Player('p2', '#f00', false);
p2.name = "Klingon";
p2.credits = 1000;

game.players = [p1, p2];
game.allPlayers = [p1, p2];

// Planet owned by p1
const planet = new Planet(1, 100, 100, 15, p1, 0);
planet.ships = 20; // effShips = 20
planet.isMilitary = false;
planet.homeworldOf = null;
game.planets = [planet];

// Cruiser owned by p2 inside gravity well
const cruiser = new Ship(1, 105, 100, null, p2);
cruiser.isCruiser = true;
cruiser.maxHealth = 10;
cruiser.active = true;
game.ships = [cruiser];
game.ships.updateGrid = function() {};

// Run update tick
const initialP1Credits = p1.credits;
const initialP2Credits = p2.credits;

game.update(1000);

console.log(`- P1 Pirate Activity: ${p1.pirateActivity}`);
console.log(`- P2 Pirate Income: ${p2.pirateIncome}`);
console.log(`- P1 Credits: ${p1.credits}`);
console.log(`- P2 Credits: ${p2.credits}`);

// Detailed breakdown of actual credits changes
const p1Diff = p1.credits - initialP1Credits;
const p2Diff = p2.credits - initialP2Credits;
console.log(`- P1 Diff: ${p1Diff}`);
console.log(`- P2 Diff: ${p2Diff}`);

const expectedActivity = 20;
const expectedIncome = 20;
const expectedP1Credits = 1000.0833333333334; // 1000 + interest (0.083333) - pirateActivity (0.013333) + domesticTrade (0.013333)
const expectedP2Credits = 1000.0980000000001; // 1000 + interest (0.083333) + pirateIncome (0.013333) + tradeWithFederation (0.0013333)

const activityMatch = Math.abs(p1.pirateActivity - expectedActivity) < 0.0001;
const incomeMatch = Math.abs(p2.pirateIncome - expectedIncome) < 0.0001;
const p1CreditsMatch = Math.abs(p1.credits - expectedP1Credits) < 0.0001;
const p2CreditsMatch = Math.abs(p2.credits - expectedP2Credits) < 0.0001;

console.log(`- activityMatch: ${activityMatch} (actual: ${p1.pirateActivity})`);
console.log(`- incomeMatch: ${incomeMatch} (actual: ${p2.pirateIncome})`);
console.log(`- p1CreditsMatch: ${p1CreditsMatch} (actual: ${p1.credits}, expected: ${expectedP1Credits})`);
console.log(`- p2CreditsMatch: ${p2CreditsMatch} (actual: ${p2.credits}, expected: ${expectedP2Credits})`);

if (activityMatch && incomeMatch && p1CreditsMatch && p2CreditsMatch) {
  console.log("-> PASSED: Pirate activity and income computed and applied correctly!");
} else {
  console.log("-> FAILED");
  process.exit(1);
}
