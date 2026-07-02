import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Healthy Cruiser Fighter Marines tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();
  game.isRunning = true;

  const p1 = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  const p2 = game.allPlayers.find(p => p.id === 'p2') || game.allPlayers[1];

  p1.techScore = 0;
  p1.expScore = 0;
  p2.techScore = 0;
  p2.expScore = 0;

  // 2. Spawn player cruiser with marines and Scout Attack mode enabled
  const attackerCruiser = new Ship('attacker_c', 100, 100, null, p1);
  attackerCruiser.isCruiser = true;
  attackerCruiser.maxHealth = 40;
  attackerCruiser.health = 40;
  attackerCruiser.fuel = attackerCruiser.getMaxFuel();
  attackerCruiser.marineCount = 50;
  attackerCruiser.scoutAttackEnabled = true;
  attackerCruiser.cruiserTargetType = 'ship';
  attackerCruiser.cruiserTargetId = 'defender_c';

  // 3. Spawn healthy enemy cruiser
  const defenderCruiser = new Ship('defender_c', 120, 120, null, p2);
  defenderCruiser.isCruiser = true;
  defenderCruiser.maxHealth = 40;
  defenderCruiser.health = 40;
  defenderCruiser.fuel = defenderCruiser.getMaxFuel();
  defenderCruiser.marineCount = 0;
  defenderCruiser.scoutAttackEnabled = false;

  attackerCruiser.expScore = 50;

  game.ships.push(attackerCruiser);
  game.ships.push(defenderCruiser);

  console.log("Testing: Launching marines targeting healthy cruiser WITHOUT Tritanium...");
  // Update game to trigger the launch check
  game.update(1000); // 1 second update

  // Search for the launched marine fleet
  const marineFleets = game.ships.filter(s => s.isMarineFleet && s.targetShipId === 'defender_c');
  assert.strictEqual(marineFleets.length, 1, "Should have launched exactly one marine fleet targeting the defender cruiser");

  const marineFleet = marineFleets[0];
  console.log(`Marine fleet launched: count=${marineFleet.count}, speed=${marineFleet.speed}, expScore=${marineFleet.expScore}`);
  
  assert.strictEqual(marineFleet.speed, 35, "Marine fleet speed should be 35");
  assert.strictEqual(marineFleet.expScore, attackerCruiser.expScore + 100, "Marine fleet starting XP should be ship XP + 100 without Tritanium");
  assert.strictEqual(attackerCruiser.marineCount, 0, "Attacker cruiser marines should be fully launched/emptied");

  // Record cruiser XP at this point
  const cruiserXpBeforeSecondLaunch = attackerCruiser.expScore;

  // Reset attacker cruiser's marines and target, and give Tritanium resources
  attackerCruiser.marineCount = 50;
  attackerCruiser.marineLaunchCooldown = 0;
  p1.resources = { tritanium: 10 };
  attackerCruiser.useResources = true;

  console.log("Testing: Launching marines targeting healthy cruiser WITH Tritanium...");
  game.update(1000);

  const marineFleets2 = game.ships.filter(s => s.isMarineFleet && s.targetShipId === 'defender_c' && s.active);
  // There should be two fleets active/inactive. Let's find the newly launched one.
  const marineFleetWithTritanium = marineFleets2.find(s => s.id !== marineFleet.id);
  assert.ok(marineFleetWithTritanium, "Should have launched a second marine fleet targeting the defender cruiser");
  console.log(`Marine fleet launched with Tritanium: count=${marineFleetWithTritanium.count}, speed=${marineFleetWithTritanium.speed}, expScore=${marineFleetWithTritanium.expScore}`);
  assert.strictEqual(marineFleetWithTritanium.expScore, attackerCruiser.expScore + 400, "Marine fleet starting XP should be ship XP + 400 with Tritanium");

  // 4. Test Fighter Squadron Damage Over Time (using the Tritanium boosted fleet)
  console.log("Testing: Fighter squadron dealing damage over time...");
  
  // Deactivate the first fleet so it doesn't interfere
  marineFleet.active = false;
  
  // Give defender cruiser extra health so it doesn't die during the DoT test
  defenderCruiser.maxHealth = 200;
  defenderCruiser.health = 200;

  // Position marine fleet right next to the defender cruiser
  marineFleetWithTritanium.x = defenderCruiser.x + 5;
  marineFleetWithTritanium.y = defenderCruiser.y + 5;
  
  const initialHealth = defenderCruiser.health;
  const initialMarinesCount = marineFleetWithTritanium.count;

  // Let's run a few seconds of updates (e.g. 5 seconds, in 1-second ticks)
  for (let i = 0; i < 5; i++) {
    // Explicitly update the marine fleet in the test context
    marineFleetWithTritanium.update(1000, game.ships, game.explosions, game.planets, [], [], 1600, game);
  }

  console.log(`After 5 seconds: Defender health=${defenderCruiser.health} (initial=${initialHealth}), Marine count=${marineFleetWithTritanium.count} (initial=${initialMarinesCount})`);
  assert.ok(defenderCruiser.health < initialHealth, "Defender cruiser should have taken damage from the marine fleet");
  assert.ok(marineFleetWithTritanium.count < initialMarinesCount, "Marine fleet count should have decreased due to attrition");

  // 5. Test Boarding Trigger when health drops below 2
  console.log("Testing: Boarding trigger when health drops below 2...");
  defenderCruiser.health = 1.5; // disabled state
  marineFleetWithTritanium.x = defenderCruiser.x;
  marineFleetWithTritanium.y = defenderCruiser.y;

  // Update marine fleet one more time to trigger collision/boarding
  marineFleetWithTritanium.update(1000, game.ships, game.explosions, game.planets, [], [], 1600, game);

  console.log(`After disabled collision: defender.isUnderBoarding=${defenderCruiser.isUnderBoarding}, marineFleetWithTritanium.active=${marineFleetWithTritanium.active}`);
  assert.strictEqual(defenderCruiser.isUnderBoarding, true, "Defender cruiser should be under boarding now");
  assert.strictEqual(marineFleetWithTritanium.active, false, "Marine fleet should be consumed/inactive");

  console.log("All Healthy Cruiser Fighter Marines tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
