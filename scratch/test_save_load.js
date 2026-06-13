import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Save & Load State Logic ===");

const game = new Game();

// 1. Set up players with Set and Map properties and upgrades
const human = new Player('p1', '#0ff', false);
human.techScore = 5;
human.expScore = 12;
human.upgradeModifiers = {
  sensorarray: 0.1,
  lab: 0.2,
  armor: 0.3,
  shield: 0.4,
  engine: 0.5,
  munitions: 0.6,
  targeting: 0.7,
  damagecontrol: 0.8,
  fueltanker: 0.9,
  diplomat: 1.0,
  marines: 1.1
};
human.resources.dilithium = 42;
human.resources.merculite = 3;
human.discoveredPlanets = new Set([1, 2, 3]);
human.attackedPlanets = new Map([['ai1', 12345], ['ai2', 67890]]);
human.spyRootedEvents = new Set(['event1', 'event2']);
game.allPlayers = [human, game.monsterPlayer];

// 2. Set up planets with stats
const planet = new Planet(1, 500, 500, 30, human, 100);
planet.disposition = { 'ai1': 0.8, 'ai2': -0.4 };
planet.expScore = 3;
planet.expProgress = 15;
planet.productionProgress = 0.75;
planet.capacityProgress = 0.25;
planet.sacrificedShips = 5;
game.planets = [planet];

// 3. Set up ships with Sets
const ship = new Ship('s1', 500, 500, planet, human);
ship.insideHazards = new Set(['storm1', 'nebula2']);
game.ships.push(ship);

console.log("Saving state...");
const savedState = game.saveState();

console.log("Serializing to JSON and parsing back...");
const json = JSON.stringify(savedState);
const parsedState = JSON.parse(json);

console.log("Loading state into a new game instance...");
const newGame = new Game();
newGame.loadState(parsedState);

console.log("Verifying loaded state...");

// Verify Player Upgrades, Sets, Maps, and Resources
const loadedHuman = newGame.allPlayers.find(p => p.id === 'p1');
assert(loadedHuman, "Human player 'p1' must be loaded");
assert(loadedHuman.techScore === 5, "techScore must be 5");
assert(loadedHuman.expScore === 12, "expScore must be 12");
assert(loadedHuman.resources.dilithium === 42, "dilithium must be 42");
assert(loadedHuman.resources.merculite === 3, "merculite must be 3");
assert(loadedHuman.upgradeModifiers.engine === 0.5, "upgradeModifiers.engine must be 0.5");
assert(loadedHuman.discoveredPlanets instanceof Set, "discoveredPlanets must be a Set");
assert(loadedHuman.discoveredPlanets.has(1), "discoveredPlanets must contain planet ID 1");
assert(loadedHuman.discoveredPlanets.has(2), "discoveredPlanets must contain planet ID 2");
assert(loadedHuman.discoveredPlanets.has(3), "discoveredPlanets must contain planet ID 3");
assert(loadedHuman.attackedPlanets instanceof Map, "attackedPlanets must be a Map");
assert(loadedHuman.attackedPlanets.get('ai1') === 12345, "attackedPlanets mapping for ai1 must be 12345");
assert(loadedHuman.spyRootedEvents instanceof Set, "spyRootedEvents must be a Set");
assert(loadedHuman.spyRootedEvents.has('event1'), "spyRootedEvents must contain 'event1'");

// Verify Planet stats
const loadedPlanet = newGame.planets.find(p => p.id === 1);
assert(loadedPlanet, "Planet 1 must be loaded");
assert(loadedPlanet.expScore === 3, "Planet expScore must be 3");
assert(loadedPlanet.expProgress === 15, "Planet expProgress must be 15");
assert(loadedPlanet.productionProgress === 0.75, "Planet productionProgress must be 0.75");
assert(loadedPlanet.capacityProgress === 0.25, "Planet capacityProgress must be 0.25");
assert(loadedPlanet.sacrificedShips === 5, "Planet sacrificedShips must be 5");
assert(loadedPlanet.disposition['ai1'] === 0.8, "Planet disposition for ai1 must be 0.8");

// Verify Ship insideHazards Set
const loadedShip = newGame.ships.find(s => s.id === 's1');
assert(loadedShip, "Ship s1 must be loaded");
assert(loadedShip.insideHazards instanceof Set, "insideHazards must be a Set");
assert(loadedShip.insideHazards.has('storm1'), "insideHazards must contain 'storm1'");
assert(loadedShip.insideHazards.has('nebula2'), "insideHazards must contain 'nebula2'");

console.log("Running a single update tick to ensure no crashes...");
newGame.update(100);

console.log("All Save & Load State verification tests passed successfully!");
process.exit(0);
