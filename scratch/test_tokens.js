import { Game } from '../src/game.js';
import { Planet } from '../src/entities/Planet.js';
import { Ship } from '../src/entities/Ship.js';

console.log('--- STARTING UPGRADE TOKEN TESTS ---');

// 1. Setup game in pioneers mode
const game = new Game({ width: 2000, height: 2000 });
game.settings = {
  aiCount: 0,
  fogOfWar: false,
  mapScale: 1.0,
  homeworldSize: 'pioneers',
  startingCredits: '0',
  timedGameLimit: 'unlimited'
};

game.initMap();
game.isRunning = true;

const human = game.humanPlayer;
human.isAlive = true;

// Verify starting planet setup for pioneers mode
const success = game.tryAssignPlanet(human);
console.log('Assigned planet success:', success);

const startingPlanet = game.planets.find(p => p.owner && p.owner.id === human.id);
console.log('Starting planet maxShips (should be 20 for pioneers):', startingPlanet ? startingPlanet.maxShips : 'none');

// Verify initial fleet spawns
console.log('Number of ships immediately spawned:', game.ships.length);

console.log('Pending pioneer spawns count (should be 3):', game.pendingPioneerSpawns.length);
game.pendingPioneerSpawns.forEach((spawn, idx) => {
  console.log(`Spawn ${idx + 1}: classType=${spawn.classType}, timer=${spawn.timer}, upgradeTokens=${spawn.upgradeTokens}`);
});

// Advance time by 31 seconds (31000 ms) to spawn the first queued destroyer and corvette
console.log('Advancing time by 31 seconds...');
game.update(31000);
console.log('Number of ships after 31s:', game.ships.length);
const humanShipsAfter31 = Array.from(game.ships).filter(s => s.owner && s.owner.id === human.id);
console.log('Human ships after 31s:', humanShipsAfter31.map(s => `${s.classType} (tokens: ${s.upgradeTokens}, speed: ${s.speed})`));

const destroyerShip = Array.from(game.ships).find(s => s.owner && s.owner.id === human.id && s.classType === 'destroyer');
if (destroyerShip) {
  console.log('Destroyer ship successfully spawned!');
  console.log('Destroyer upgradeTokens:', destroyerShip.upgradeTokens);
} else {
  console.error('ERROR: Destroyer ship not found!');
}

// Advance time by another 30 seconds (30000 ms) to spawn the second queued corvette
console.log('Advancing time by another 30 seconds...');
game.update(30000);
console.log('Number of ships after 61s:', game.ships.length);
const humanShipsAfter61 = Array.from(game.ships).filter(s => s.owner && s.owner.id === human.id);
console.log('Human ships after 61s:', humanShipsAfter61.map(s => `${s.classType} (tokens: ${s.upgradeTokens}, speed: ${s.speed})`));

// 2. Test Anomaly Upgrade Token Reward
console.log('\n--- Testing Anomaly Upgrade Token Reward ---');
const testPlanet = new Planet(9999, 500, 500, 50, human, 100, 2000, 2000);
testPlanet.anomaly = {
  id: 'test_anomaly_id',
  x: 500,
  y: 500,
  difficulty: 80, // high difficulty -> higher creditsValueEquivalent
  progress: {},
  researched: false,
  beingResearched: false,
  rewardType: 'upgrade_token',
  completingShipId: destroyerShip ? destroyerShip.id : 999
};

const oldTokens = destroyerShip ? destroyerShip.upgradeTokens : 0;
console.log(`Cruiser tokens before anomaly: ${oldTokens}`);

// Trigger completion
game.triggerAnomalyCompletion(testPlanet, human);

const newTokens = destroyerShip ? destroyerShip.upgradeTokens : 0;
console.log(`Cruiser tokens after anomaly: ${newTokens}`);
console.log(`Tokens gained: ${newTokens - oldTokens}`);

console.log('--- ALL TESTS COMPLETED ---');
process.exit(0);
