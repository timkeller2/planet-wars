import fs from 'fs';

// Mock global variables that src/main.js expects or defines
global.window = {};
global.document = {
  addEventListener: () => {},
  getElementById: () => ({ addEventListener: () => {} }),
  querySelector: () => ({ addEventListener: () => {} }),
  querySelectorAll: () => []
};

// We will read getEffectiveSympathyClient directly from src/main.js
const mainContent = fs.readFileSync('src/main.js', 'utf8');

// Extract getEffectiveSympathyClient function code
const funcMatch = mainContent.match(/function getEffectiveSympathyClient[\s\S]*?\n\}/);
if (!funcMatch) {
  console.error("Could not find getEffectiveSympathyClient in src/main.js");
  process.exit(1);
}

const getEffectiveSympathyClientStr = funcMatch[0];
console.log("Found function:\n", getEffectiveSympathyClientStr);

// Evaluate the function in current context
const getEffectiveSympathyClient = new Function('pl', 'playerId', 'serverState', `
  ${getEffectiveSympathyClientStr}
  return getEffectiveSympathyClient(pl, playerId);
`);

// Mocks
const pl = {
  id: 1,
  ownerId: null,
  maxShips: 100,
  ships: 0,
  sympathy: { 'player_1': 5 }
};

const serverState = {
  settings: { fogOfWar: false },
  players: [
    { id: 'player_1', techScore: 0, expScore: 0, discoveredPlanetsArray: [1] }
  ],
  ships: [
    {
      active: true,
      ownerId: 'player_1',
      x: 100,
      y: 100,
      count: 10,
      isCruiser: false
    }
  ]
};

// Test with ship far away
pl.x = 1000;
pl.y = 1000;
const resFar = getEffectiveSympathyClient(pl, 'player_1', serverState);
console.log("Result far (expected 5):", resFar);

// Test with ship close (inside gravity well of 100 * 1.5 * 0.5 = 75 pixels)
pl.x = 120;
pl.y = 100; // distance = 20
const resClose = getEffectiveSympathyClient(pl, 'player_1', serverState);
console.log("Result close (expected 10):", resClose);
