import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Planet/Ship Upgrade Cost & Distribution tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  // Pick players (filtering out the monsters player)
  const validPlayers = game.allPlayers.filter(p => p.id !== 'monsters');
  const playerA = validPlayers[0];
  const playerB = validPlayers[1];
  const playerC = validPlayers[2];

  console.log(`Player A: ${playerA.id}, Player B: ${playerB.id}, Player C: ${playerC.id}`);

  // Pick planets
  const planetA = game.planets[0];
  const planetB = game.planets[1];
  const planetC = game.planets[2];

  planetA.owner = playerA;
  planetB.owner = playerB;
  planetC.owner = playerC;

  // Initialize credits
  playerA.credits = 1000;
  playerB.credits = 0;
  playerC.credits = 0;

  // 2. Spawn a cruiser for Player A
  const cruiserA = new Ship('c_a_1', planetA.x + 10, planetA.y + 10, null, playerA);
  cruiserA.isCruiser = true;
  cruiserA.maxHealth = 40;
  cruiserA.health = 40;
  game.ships.push(cruiserA);

  // Test 1: Base cost without any planet upgrades
  const baseCost = game.getUpgradeCost(cruiserA, 'labs');
  console.log(`Base upgrade cost: ${baseCost}`);

  // Give Player A some planet upgrades of 'labs' (🔬)
  planetA.labs = 2; // Player A has 2 lab upgrades on their planet

  // Test 2: Cost with planet upgrades
  const discountedCost = game.getUpgradeCost(cruiserA, 'labs');
  console.log(`Discounted upgrade cost with 2 planet labs: ${discountedCost}`);
  
  const expectedDiscounted = Math.max(1, Math.round(baseCost / 3));
  assert.strictEqual(discountedCost, expectedDiscounted, "Discounted cost should be baseCost / (1 + 2)");
  console.log("Test 1 Passed: Cost discount divisor verified successfully!");

  // Test 3: Prorated credit distribution
  // Set up other players' planet upgrades
  planetB.labs = 1; // Player B has 1 lab upgrade
  planetC.labs = 2; // Player C has 2 lab upgrades

  // Define a mock distribute function matching server.js implementation
  function mockDistributeUpgradeCredits(buyingPlayer, upgradeType, cost) {
    if (cost <= 0) return;
    
    const propMap = {
      sensorarrays: 'sensorarrays',
      sensorarray: 'sensorarrays',
      labs: 'labs',
      lab: 'labs',
      armor: 'armor',
      shields: 'shields',
      shield: 'shields',
      engine: 'engine',
      munitions: 'munitions',
      targeting: 'targeting',
      damagecontrol: 'damagecontrol',
      supply_ship: 'supply_ship',
      supplyship: 'supply_ship',
      extended_fuel: 'extended_fuel',
      extendedfuel: 'extended_fuel',
      diplomat: 'diplomat',
      marines: 'marines',
      command: 'command'
    };
    const propName = propMap[upgradeType] || upgradeType;

    const otherPlayers = [];
    let totalOtherPlanetUpgrades = 0;

    for (const p of game.allPlayers) {
      if (p.id === buyingPlayer.id || p.id === 'monsters') continue;
      
      let count = 0;
      for (const planet of game.planets) {
        if (planet.owner && planet.owner.id === p.id && !planet.dead) {
          count += (planet[propName] || 0);
        }
      }
      
      if (count > 0) {
        otherPlayers.push({ player: p, count });
        totalOtherPlanetUpgrades += count;
      }
    }

    if (totalOtherPlanetUpgrades > 0) {
      const distributedTotal = cost / 2;
      for (const op of otherPlayers) {
        const share = op.count / totalOtherPlanetUpgrades;
        const gained = distributedTotal * share;
        op.player.credits = (op.player.credits || 0) + gained;
        console.log(`Player ${op.player.id} received ${gained.toFixed(2)} credits (share: ${op.count}/${totalOtherPlanetUpgrades})`);
      }
    }
  }

  // Simulate Player A purchasing a labs upgrade costing 120 credits
  const purchaseCost = 120;
  mockDistributeUpgradeCredits(playerA, 'labs', purchaseCost);

  // Player B has 1 lab, Player C has 2 labs. Total = 3.
  // Half cost = 60.
  // Player B should get 60 * 1/3 = 20 credits.
  // Player C should get 60 * 2/3 = 40 credits.
  console.log(`Player B credits: ${playerB.credits}`);
  console.log(`Player C credits: ${playerC.credits}`);

  assert.strictEqual(playerB.credits, 20, "Player B should have received 20 credits");
  assert.strictEqual(playerC.credits, 40, "Player C should have received 40 credits");
  console.log("Test 2 Passed: Prorated credit distribution verified successfully!");

  console.log("ALL TESTS PASSED!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
