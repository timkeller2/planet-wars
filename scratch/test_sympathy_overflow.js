// Scratch test to verify Planet.addSympathy overflow math
import { Planet } from '../src/entities/Planet.js';

// Mock Player
const playerA = { id: 'A', name: 'Player A' };
const playerB = { id: 'B', name: 'Player B' };
const playerC = { id: 'C', name: 'Player C' };

function runTests() {
  console.log("=== Testing Sympathy Overflow Math ===");

  // Setup Planet: maxShips = 60
  const planet = new Planet(1, 100, 100, 15, null, 10);
  planet.maxShips = 60;
  
  // Test Scenario 1:
  // Player A: 40, Player B: 15, Player C: 5 (Total = 60, spaceRemaining = 0)
  // Gain 10 for Player A.
  planet.sympathy = {
    'A': 40,
    'B': 15,
    'C': 5
  };
  
  console.log("Scenario 1 Initial State:", JSON.stringify(planet.sympathy));
  let increase = planet.addSympathy('A', 10);
  console.log("Scenario 1 Increase Dealt:", increase);
  console.log("Scenario 1 Final State (Expected A:45, B:12, C:3):", JSON.stringify(planet.sympathy));

  if (planet.sympathy['A'] === 45 && planet.sympathy['B'] === 12 && planet.sympathy['C'] === 3) {
    console.log(" Scenario 1 PASS!");
  } else {
    console.error(" Scenario 1 FAIL!");
  }

  // Test Scenario 2:
  // Player A: 30, Player B: 15, Player C: 5 (Total = 50, spaceRemaining = 10)
  // Gain 15 for Player A.
  // Gaining 15:
  // - 10 used to reach 60 (A becomes 40). Remaining: 5.
  // - Halved rounded up: reduction = Math.ceil(5/2) = 3, remaining = 2.
  // - Top two enemies (B:15, C:5) get reduced by 2 split: B by 1, C by 1.
  // - A gains 2. Final A: 42, B: 14, C: 4.
  planet.sympathy = {
    'A': 30,
    'B': 15,
    'C': 5
  };
  console.log("\nScenario 2 Initial State:", JSON.stringify(planet.sympathy));
  increase = planet.addSympathy('A', 15);
  console.log("Scenario 2 Increase Dealt:", increase);
  console.log("Scenario 2 Final State (Expected A:42, B:14, C:4):", JSON.stringify(planet.sympathy));

  if (planet.sympathy['A'] === 42 && planet.sympathy['B'] === 14 && planet.sympathy['C'] === 4) {
    console.log(" Scenario 2 PASS!");
  } else {
    console.error(" Scenario 2 FAIL!");
  }

  // Test Scenario 3:
  // Player A already has sympathy equal to economy (60)
  // Should discard and return 0
  planet.sympathy = {
    'A': 60,
    'B': 0
  };
  console.log("\nScenario 3 Initial State:", JSON.stringify(planet.sympathy));
  increase = planet.addSympathy('A', 10);
  console.log("Scenario 3 Increase Dealt:", increase);
  console.log("Scenario 3 Final State (Expected A:60, B:0):", JSON.stringify(planet.sympathy));
  if (planet.sympathy['A'] === 60 && increase === 0) {
    console.log(" Scenario 3 PASS!");
  } else {
    console.error(" Scenario 3 FAIL!");
  }
}

runTests();
