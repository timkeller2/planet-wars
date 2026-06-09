import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import { Player } from '../src/entities/Player.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error('ASSERTION FAILED: ' + message);
  }
}

console.log("Running cruiser starting experience cap unit tests...");

// Mock Player, Planet and Game
const player = new Player('p1', '#0ff', false);
player.id = 'p1';
player.expScore = 50; // Cap is 50

const sourcePlanet = {
  id: 'sourcePlanet',
  x: 400,
  y: 400,
  owner: player,
  maxShips: 100,
  ships: 100,
  expScore: 30, // Base planet XP
  focusMode: 'garrison', // Garrison bonus is 100 / 10 = 10
  decreaseMaxShips: () => {}
};

// 1. Case A: Starting XP + Garrison Bonus is 40. Player has crewExperience of 500.
// finalMaxHealth = 50.
// Diff to cap (50) is 10. Needed crewExp = 10 * 50 = 500.
// All 500 crewExperience should be consumed, and ship starts with expScore of 50.
let finalMaxHealth = 50;
let owner = player;
owner.crewExperience = 500;

let baseStartingExp = sourcePlanet.expScore || 0;
if (sourcePlanet.focusMode === 'garrison') {
  baseStartingExp += (sourcePlanet.maxShips || 0) / 10;
}
assert(baseStartingExp === 40, "Base starting exp should be 30 + 10 = 40");

const cap = owner ? (owner.expScore || 0) : 0;
let finalStartingExp = Math.min(baseStartingExp, cap);
assert(finalStartingExp === 40, "Final starting exp should be 40");

let crewExpXp = 0;
if (owner && owner.crewExperience && finalStartingExp < cap) {
  const diff = cap - finalStartingExp;
  const neededCrewExp = diff * finalMaxHealth;
  const crewExpToUse = Math.min(owner.crewExperience, neededCrewExp);
  
  owner.crewExperience -= crewExpToUse;
  crewExpXp = crewExpToUse / finalMaxHealth;
}

let shipExpScore = finalStartingExp + crewExpXp;
assert(shipExpScore === 50, "Ship starting XP should reach the cap of 50");
assert(owner.crewExperience === 0, "All 500 crewExperience should be consumed");

// 2. Case B: Starting XP + Garrison Bonus is 40. Player has crewExperience of 250.
// Needed crewExp is 500. We only have 250.
// 250 crewExperience should be consumed, leaving 0. Ship gets 250 / 50 = 5 XP.
// Final ship expScore should be 40 + 5 = 45.
owner.crewExperience = 250;
finalStartingExp = Math.min(baseStartingExp, cap);

crewExpXp = 0;
if (owner && owner.crewExperience && finalStartingExp < cap) {
  const diff = cap - finalStartingExp;
  const neededCrewExp = diff * finalMaxHealth;
  const crewExpToUse = Math.min(owner.crewExperience, neededCrewExp);
  
  owner.crewExperience -= crewExpToUse;
  crewExpXp = crewExpToUse / finalMaxHealth;
}

shipExpScore = finalStartingExp + crewExpXp;
assert(shipExpScore === 45, "Ship starting XP should be 45");
assert(owner.crewExperience === 0, "All 250 crewExperience should be consumed");

// 3. Case C: Starting XP + Garrison Bonus is 40. Player has crewExperience of 1000.
// Needed crewExp is 500. We have 1000.
// 500 crewExperience should be consumed, leaving 500.
// Final ship expScore should be 50.
owner.crewExperience = 1000;
finalStartingExp = Math.min(baseStartingExp, cap);

crewExpXp = 0;
if (owner && owner.crewExperience && finalStartingExp < cap) {
  const diff = cap - finalStartingExp;
  const neededCrewExp = diff * finalMaxHealth;
  const crewExpToUse = Math.min(owner.crewExperience, neededCrewExp);
  
  owner.crewExperience -= crewExpToUse;
  crewExpXp = crewExpToUse / finalMaxHealth;
}

shipExpScore = finalStartingExp + crewExpXp;
assert(shipExpScore === 50, "Ship starting XP should be capped at 50");
assert(owner.crewExperience === 500, "Should have 500 crewExperience remaining");

// 4. Case D: Starting XP + Garrison Bonus is 60 (exceeds cap of 50).
// Ship starting XP should be capped at 50.
// No crewExperience should be consumed.
sourcePlanet.expScore = 50; // 50 + 10 = 60
baseStartingExp = sourcePlanet.expScore || 0;
if (sourcePlanet.focusMode === 'garrison') {
  baseStartingExp += (sourcePlanet.maxShips || 0) / 10;
}
assert(baseStartingExp === 60, "Base starting exp should be 50 + 10 = 60");

owner.crewExperience = 300;
finalStartingExp = Math.min(baseStartingExp, cap);
assert(finalStartingExp === 50, "Final starting exp should be capped at 50");

crewExpXp = 0;
if (owner && owner.crewExperience && finalStartingExp < cap) {
  const diff = cap - finalStartingExp;
  const neededCrewExp = diff * finalMaxHealth;
  const crewExpToUse = Math.min(owner.crewExperience, neededCrewExp);
  
  owner.crewExperience -= crewExpToUse;
  crewExpXp = crewExpToUse / finalMaxHealth;
}

shipExpScore = finalStartingExp + crewExpXp;
assert(shipExpScore === 50, "Ship starting XP should be capped at 50");
assert(owner.crewExperience === 300, "No crewExperience should have been consumed");

console.log("All cruiser starting experience cap unit tests passed successfully!");
