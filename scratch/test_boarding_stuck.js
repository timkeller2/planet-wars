/**
 * Boarding must not start (and leave a permanent ray) when attackers only have
 * fractional marines. Whole marines are required; empty boarding states clear.
 */
import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function run() {
  console.log('Starting boarding stuck-state regression...');

  const game = new Game({ width: 2000, height: 2000 });
  game.initMap();
  game.isRunning = true;
  game.isPaused = false;

  const attacker = game.allPlayers.find(p => p.id !== 'monsters') || game.allPlayers[0];
  const defender = game.allPlayers.find(p => p.id !== attacker.id && p.id !== 'monsters') || game.allPlayers[1];
  assert.ok(attacker && defender, 'need two players');

  // Disabled enemy cruiser
  const victim = new Ship('vic', 500, 500, null, defender);
  victim.isCruiser = true;
  victim.active = true;
  victim.maxHealth = 30;
  victim.health = 1; // disabled
  victim.crew = 10;
  victim.marineCount = 0;
  victim.scoutAttackEnabled = false;

  // Attacker with only fractional marines (< 1 whole)
  const boarder = new Ship('atk', 520, 500, null, attacker);
  boarder.isCruiser = true;
  boarder.active = true;
  boarder.maxHealth = 30;
  boarder.health = 30;
  boarder.marineCount = 0.7; // would previously trigger stuck boarding
  boarder.scoutAttackEnabled = true;
  boarder.marines = 2;

  game.ships = [victim, boarder];
  // cruiserRadarRange uses maxHealth — ensure in range
  game.updateCustomCruiserSystems(0.1);

  assert.ok(!victim.isUnderBoarding, `fractional marines must not start boarding (got isUnderBoarding=${victim.isUnderBoarding})`);
  assert.ok(boarder.marineCount > 0.6, 'fractional marines should remain on attacker');
  console.log('Pass: fractional marines do not start boarding');

  // Stuck state: isUnderBoarding with 0 marines and timer > 0 must clear
  victim.isUnderBoarding = true;
  victim.boardingMarines = 0;
  victim.boardingTimer = 5.0;
  victim.boardingPlayer = attacker;
  game.updateCustomCruiserSystems(0.1);
  assert.ok(!victim.isUnderBoarding, 'empty boarding state must be cleared');
  assert.strictEqual(victim.boardingTimer, 0, 'boardingTimer cleared');
  console.log('Pass: empty boarding state auto-clears');

  // Happy path: whole marines start boarding and resolve after timer
  boarder.marineCount = 5;
  victim.health = 1;
  victim.crew = 2;
  victim.marineCount = 0;
  victim.isUnderBoarding = false;
  victim.boardingCooldown = 0;
  victim.boardingMarines = 0;
  victim.boardingTimer = 0;
  game.updateCustomCruiserSystems(0.05);
  assert.ok(victim.isUnderBoarding, 'boarding should start with whole marines');
  assert.ok(victim.boardingMarines >= 5, 'marines transferred');
  assert.ok(victim.boardingTimer > 0, 'timer running');
  console.log('Pass: boarding starts with whole marines');

  // Finish timer
  for (let i = 0; i < 60; i++) game.updateCustomCruiserSystems(0.1);
  assert.ok(!victim.isUnderBoarding, 'boarding should resolve after timer');
  console.log('Pass: boarding resolves after timer');

  console.log('All boarding stuck-state tests passed.');
}

try {
  run();
} catch (e) {
  console.error('Test failed!', e);
  process.exit(1);
}
