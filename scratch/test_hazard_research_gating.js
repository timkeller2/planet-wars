import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Hazard Research Gating tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  player.techScore = 0;
  player.expScore = 0;

  // 2. Spawn a cruiser with labs at (200, 200)
  const cruiser = new Ship('c1', 200, 200, null, player);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;
  cruiser.labs = 2; // Cruisers need labs to research hazards
  cruiser.sensorarrays = 2; // Ensure good radar range
  game.ships.push(cruiser);

  // Clear randomly generated storms/minefields/planets/wreckages to make the test deterministic
  game.ionStorms = [];
  game.planets = [];
  game.wreckages = [];

  // 3. Spawn an ion storm at (210, 210) with intensity 10
  const storm = {
    id: 1,
    x: 210,
    y: 210,
    radius: 100,
    intensity: 10,
    type: 'storm',
    speed: 0,
    heading: 0,
    knowledge: { [player.id]: 0 }
  };
  game.ionStorms.push(storm);

  console.log("Game ships count:", game.ships.length);
  console.log("Game ships[0] isCruiser:", game.ships[0].isCruiser);
  console.log("Game ships[0] active:", game.ships[0].active);
  console.log("Game ships[0] owner:", game.ships[0].owner ? game.ships[0].owner.id : 'none');
  console.log("Game ships[0] labs:", game.ships[0].labs);

  // Run update loop to trigger hazard research
  console.log("Testing research when player effective intensity is > 0...");
  const initialTechScore = player.techScore || 0;
  game.update(1000); // 1 second update

  console.log("Cruiser isActivelyResearching:", cruiser.isActivelyResearching);
  console.log("Player techScore:", player.techScore);
  console.log("Storm knowledge:", storm.knowledge);

  assert.ok(cruiser.isActivelyResearching, "Cruiser should be actively researching the storm");
  assert.ok(player.techScore > initialTechScore, "Player techScore should have increased");
  assert.ok(storm.knowledge[player.id] > 0, "Storm knowledge should have increased");

  // Now, increase player knowledge to reduce effective intensity to 0
  // Formula: Math.max(0, storm.intensity - k - (tR + eR)/2)
  // Set k = 10 (storm.intensity is 10)
  storm.knowledge[player.id] = 10;
  cruiser.isActivelyResearching = false; // reset flag
  const techScoreAfterFirstPhase = player.techScore;

  console.log("Testing research when player effective intensity is 0...");
  game.update(1000); // Another 1 second update

  assert.strictEqual(cruiser.isActivelyResearching, false, "Cruiser should NOT be actively researching the storm when effective intensity is 0");
  assert.strictEqual(player.techScore, techScoreAfterFirstPhase, "Player techScore should NOT have increased");

  // 4. Test Nebula
  console.log("Testing Nebula research gating...");
  game.ionStorms = []; // clear old storms
  
  const nebula = {
    id: 2,
    x: 210,
    y: 210,
    radius: 100,
    intensity: 15,
    type: 'nebula',
    speed: 0,
    heading: 0,
    knowledge: { [player.id]: 0 }
  };
  game.ionStorms.push(nebula);
  cruiser.isActivelyResearching = false;
  
  // Test nebula research when intensity > 0
  const techScoreBeforeNebula = player.techScore;
  game.update(1000);
  assert.ok(cruiser.isActivelyResearching, "Cruiser should be actively researching the nebula when effective intensity is > 0");
  assert.ok(player.techScore > techScoreBeforeNebula, "Player techScore should have increased from nebula research");

  // Set knowledge to 15 (nebula intensity is 15)
  nebula.knowledge[player.id] = 15;
  cruiser.isActivelyResearching = false;
  const techScoreNebulaGated = player.techScore;

  game.update(1000);
  assert.strictEqual(cruiser.isActivelyResearching, false, "Cruiser should NOT be actively researching the nebula when effective intensity is 0");
  assert.strictEqual(player.techScore, techScoreNebulaGated, "Player techScore should NOT have increased when nebula is gated");

  console.log("All Hazard Research Gating tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
