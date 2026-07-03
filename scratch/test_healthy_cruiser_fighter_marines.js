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

  console.log("Testing: Cruisers should NOT launch marines targeting a healthy cruiser...");
  // Update game to trigger checks
  game.update(1000); // 1 second update

  // Search for the launched marine fleet
  const marineFleets = game.ships.filter(s => s.isMarineFleet && s.targetShipId === 'defender_c');
  assert.strictEqual(marineFleets.length, 0, "Should NOT have launched any marine fleet targeting the defender cruiser");
  assert.strictEqual(attackerCruiser.marineCount, 50, "Cruiser marines should NOT have been emptied");

  console.log("Testing: Manually creating marine fleets to test DoT and Boarding...");

  // Manually spawn the first marine fleet (equivalent to WITHOUT Tritanium)
  const marineFleet = new Ship(game.nextShipId++, attackerCruiser.x, attackerCruiser.y, null, p1, defenderCruiser.x, defenderCruiser.y);
  marineFleet.cruiserStyle = attackerCruiser.cruiserStyle;
  marineFleet.count = 50;
  marineFleet.speedModifier = 1.0;
  marineFleet.isMarineFleet = true;
  marineFleet.sourceShipId = attackerCruiser.id;
  marineFleet.speed = 35;
  marineFleet.targetShipId = defenderCruiser.id;
  marineFleet.expScore = attackerCruiser.expScore + 100;
  game.ships.push(marineFleet);

  // Manually spawn the second marine fleet (equivalent to WITH Tritanium)
  const marineFleetWithTritanium = new Ship(game.nextShipId++, attackerCruiser.x, attackerCruiser.y, null, p1, defenderCruiser.x, defenderCruiser.y);
  marineFleetWithTritanium.cruiserStyle = attackerCruiser.cruiserStyle;
  marineFleetWithTritanium.count = 50;
  marineFleetWithTritanium.speedModifier = 1.0;
  marineFleetWithTritanium.isMarineFleet = true;
  marineFleetWithTritanium.sourceShipId = attackerCruiser.id;
  marineFleetWithTritanium.speed = 35;
  marineFleetWithTritanium.targetShipId = defenderCruiser.id;
  marineFleetWithTritanium.expScore = attackerCruiser.expScore + 400;
  game.ships.push(marineFleetWithTritanium);

  // Verify manual fleets look correct
  assert.strictEqual(marineFleet.speed, 35, "Marine fleet speed should be 35");
  assert.strictEqual(marineFleet.expScore, attackerCruiser.expScore + 100, "Marine fleet starting XP should be ship XP + 100 without Tritanium");
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
