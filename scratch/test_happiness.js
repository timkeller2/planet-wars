import { io } from 'socket.io-client';

const socket = io('http://localhost:5173', {
  query: {
    playerId: 'p1'
  }
});

socket.on('connect', () => {
  console.log('Connected to server!');
});

socket.on('assignedPlayer', (player) => {
  console.log('Assigned player:', player.id);
});

let startTime = Date.now();
socket.on('gameStateUpdate', (state) => {
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`[${elapsed.toFixed(1)}s] Game State Tick. Planets: ${state.planets.length}, Ships count: ${state.flatShips.length / 19}`);
  if (state.happinessEvents && state.happinessEvents.length > 0) {
    console.log('SUCCESS: RECEIVED HAPPINESS EVENTS:', JSON.stringify(state.happinessEvents, null, 2));
    socket.disconnect();
    process.exit(0);
  }
});

// Set a timeout of 30 seconds
setTimeout(() => {
  console.error('FAILED: Timed out waiting for happiness events.');
  socket.disconnect();
  process.exit(1);
}, 30000);
