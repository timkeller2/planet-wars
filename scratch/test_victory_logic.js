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

// Test 4: Cannot win via Tech Victory while in debt
{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player1 = game.humanPlayer;
  const player2 = game.aiPlayers[0];
  player1.isAlive = true;
  player2.isAlive = true;
  
  game.planets[0].owner = player1;
  game.planets[1].owner = player2;
  
  player1.techScore = 225; // Enough lead
  player2.techScore = 0;
  
  // Set player 1 in debt
  player1.credits = -10;
  game.checkWinCondition();
  assert.ok(!game.gameOverMessage, 'Should not win Tech Victory while in debt.');
  
  // Clear debt
  player1.credits = 0;
  game.checkWinCondition();
  assert.ok(game.gameOverMessage && game.gameOverMessage.includes('TECH VICTORY'), 'Should win Tech Victory when not in debt.');
  console.log('Test 4 Passed: Cannot win Tech Victory while in debt.');
}

// Test 5: Timed Victory selection with debt
{
  const game = new Game({ width: 1000, height: 1000 });
  game.initMap();
  
  const player1 = game.humanPlayer;
  const player2 = game.aiPlayers[0];
  const player3 = game.aiPlayers[1];
  
  for (const p of game.allPlayers) {
    p.isAlive = false;
  }
  player1.isAlive = true;
  player2.isAlive = true;
  player3.isAlive = true;
  player2.isAI = false;
  player3.isAI = false;
  
  // Scores: player 1 (highest), player 2 (second highest), player 3 (lowest)
  player1.techScore = 100; // score = 10
  player2.techScore = 64;  // score = 8
  player3.techScore = 36;  // score = 6
  
  // Case A: Leader in debt, next highest not in debt
  player1.credits = -50;
  player2.credits = 10;
  player3.credits = 100;
  
  game.triggerTimedGameVictory();
  assert.ok(game.gameOverMessage && game.gameOverMessage.includes(player2.id.toUpperCase()), `Next highest not in debt should win. Msg: ${game.gameOverMessage}`);
  
  // Case B: All in debt -> Draw
  game.gameOverMessage = null;
  player2.credits = -10;
  player3.credits = -20;
  game.triggerTimedGameVictory();
  assert.ok(game.gameOverMessage && game.gameOverMessage.includes('DRAW'), `Should end in a draw if all players are in debt. Msg: ${game.gameOverMessage}`);
  
  console.log('Test 5 Passed: Timed victory correctly passes to next non-debt player or ends in a draw.');
}

console.log('ALL TESTS PASSED SUCCESSFULLY!');
process.exit(0);
