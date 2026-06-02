const { Game } = require('./src/game.js');

const game = new Game({ width: 1920, height: 1620 });
game.initMap();
game.isRunning = true;

const human = game.humanPlayer;
human.isAlive = true;
human.needsPlanet = true;
const success = game.tryAssignPlanet(human);

// Run game update tick
game.update(50);

// Inspect human player object and its serialization
console.log('--- Human Player Fields ---');
console.log('id:', human.id);
console.log('isAlive:', human.isAlive);
console.log('totalCapacity:', human.totalCapacity);
console.log('tradingBonus:', human.tradingBonus);
console.log('credits:', human.credits);

const serialized = JSON.parse(JSON.stringify(human));
console.log('\n--- Serialized Fields ---');
console.log(serialized);
