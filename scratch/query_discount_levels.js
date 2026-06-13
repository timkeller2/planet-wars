import { io } from 'socket.io-client';

const socket = io('http://localhost:5173');

socket.on('connect', () => {
  // Request game state if needed, or wait for the tick broadcast
});

socket.on('gameStateUpdate', (state) => {
  if (state && state.globalUpgradeModifiers) {
    console.log(JSON.stringify(state.globalUpgradeModifiers));
    socket.disconnect();
    process.exit(0);
  }
});

// Set a timeout in case the server is not running or responsive
setTimeout(() => {
  console.log('Error: Timeout waiting for game state update');
  socket.disconnect();
  process.exit(1);
}, 5000);
