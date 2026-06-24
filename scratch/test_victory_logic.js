import { Game } from '../src/game.js';
import assert from 'assert';

console.log('Testing victory conditions logic...');

// Test 1: No settings (Unlimited duration default)
{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player1 = game.humanPlayer;
  const player2 = game.aiPlayers[0];
  
  player1.isAlive = true;
  player2.isAlive = true;
  
  // Set players' active states
  player1.techScore = 224;
  player2.techScore = 0;
  
  // To avoid triggers from Elimination victory, ensure other players have planets
  game.planets[0].owner = player1;
  game.planets[1].owner = player2;
  
  game.checkWinCondition();
  assert.ok(!game.gameOverMessage, 'Should not win with lead < 15');
  
  // Now set tech score to 225 (lead is exactly 15) -> victory!
  player1.techScore = 225;
  game.checkWinCondition();
  assert.ok(game.gameOverMessage && game.gameOverMessage.includes('TECH VICTORY'), `Should win with lead >= 15. Got message: ${game.gameOverMessage}`);
  console.log('Test 1 Passed: Default (unlimited) lead is exactly 15 points.');
}

// Test 2: Timed game with 30 minutes duration (1800 seconds)
{
  const game = new Game({ width: 1000, height: 1000 });
  game.settings = { timedGameLimit: '1800' }; // 1800 seconds = 30 minutes
  game.initMap();
  
  const player1 = game.humanPlayer;
  const player2 = game.aiPlayers[0];
  player1.isAlive = true;
  player2.isAlive = true;
  
  game.planets[0].owner = player1;
  game.planets[1].owner = player2;
  
  // requiredLead = 11 + 30 / 30 = 12.
  // Tech score needed = 12^2 = 144.
  player1.techScore = 143;
  player2.techScore = 0;
  game.checkWinCondition();
  assert.ok(!game.gameOverMessage, 'Should not win with lead < 12 in 30 min game');
  
  player1.techScore = 144;
  game.checkWinCondition();
  assert.ok(game.gameOverMessage && game.gameOverMessage.includes('TECH VICTORY'), 'Should win with lead >= 12 in 30 min game');
  console.log('Test 2 Passed: 30 minutes duration lead is exactly 12 points.');
}

// Test 3: Timed game with 60 minutes duration (3600 seconds)
{
  const game = new Game({ width: 1000, height: 1000 });
  game.settings = { timedGameLimit: '3600' }; // 3600 seconds = 60 minutes
  game.initMap();
  
  const player1 = game.humanPlayer;
  const player2 = game.aiPlayers[0];
  player1.isAlive = true;
  player2.isAlive = true;
  
  game.planets[0].owner = player1;
  game.planets[1].owner = player2;
  
  // requiredLead = 11 + 60 / 30 = 13.
  // Tech score needed = 13^2 = 169.
  player1.techScore = 168;
  player2.techScore = 0;
  game.checkWinCondition();
  assert.ok(!game.gameOverMessage, 'Should not win with lead < 13 in 60 min game');
  
  player1.techScore = 169;
  game.checkWinCondition();
  assert.ok(game.gameOverMessage && game.gameOverMessage.includes('TECH VICTORY'), 'Should win with lead >= 13 in 60 min game');
  console.log('Test 3 Passed: 60 minutes duration lead is exactly 13 points.');
}

console.log('ALL TESTS PASSED SUCCESSFULLY!');
process.exit(0);
