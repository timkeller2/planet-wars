import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';
import { Planet } from '../src/entities/Planet.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing Anomaly Refinements & Rare Resource Cache ===");

// Scenario 1: Base Value Formula & Discount Announcements
{
  console.log("\n--- Scenario 1: Base Value and Upgrade Discount Announcement ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  human.id = 'human';
  game.allPlayers = [human];

  const planet = new Planet(1, 500, 500, 30, null, 100);
  planet.anomaly = {
    id: 'a1',
    x: 500,
    y: 500,
    difficulty: 20,
    progress: {},
    researched: false,
    beingResearched: false,
    rewardType: 'discount'
  };
  game.planets = [planet];

  // Trigger completion
  // difficulty = 20
  // baseVal should be 40 + 20 * 3 = 100
  // Discount category upgrades should get announced by name.
  game.triggerAnomalyCompletion(planet, human);

  const lastChat = game.pendingChatMessages[game.pendingChatMessages.length - 1];
  console.log("Announcement:", lastChat.text);
  assert(lastChat.text.includes("upgrade discount(s) for"), "Announcement must list upgrades");
}

// Scenario 2: Rare Resource Cache Reward Logic
{
  console.log("\n--- Scenario 2: Rare Resource Cache Payout ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  human.id = 'human';
  game.allPlayers = [human];

  const planet = new Planet(2, 500, 500, 30, null, 100);
  planet.anomaly = {
    id: 'a2',
    x: 500,
    y: 500,
    difficulty: 20, // baseVal = 100, creditsValueEquivalent = 100 to 200
    progress: {},
    researched: false,
    beingResearched: false,
    rewardType: 'rare_resource_cache'
  };
  game.planets = [planet];

  // Set up mock resource rarities. Recalculate will populate them.
  // We can mock this.resourceRarities directly
  game.resourceRarities = {
    dilithium: 'exotic',
    merculite: 'rare',
    duranium: 'normal',
    tritanium: 'common',
    antimatter: 'common',
    deuterium: 'common',
    latinum: 'common'
  };

  // Prevent recalculateResourceRarities from overwriting our mocked rarities for the test
  game.recalculateResourceRarities = () => {};

  game.triggerAnomalyCompletion(planet, human);

  const lastChat = game.pendingChatMessages[game.pendingChatMessages.length - 1];
  console.log("Announcement:", lastChat.text);
  
  // It must select dilithium or merculite (exotic or rare)
  const resourceChoices = ['Dilithium', 'Merculite'];
  const matched = resourceChoices.some(res => lastChat.text.includes(res));
  assert(matched, "Must award an exotic or rare resource when available");

  // Verify resources stock was incremented
  const dilQty = human.resources.dilithium || 0;
  const mercQty = human.resources.merculite || 0;
  console.log(`Resources: dilithium=${dilQty}, merculite=${mercQty}`);
  assert(dilQty > 0 || mercQty > 0, "Resource Cache must credit resources to the player");
}

// Scenario 3: Per-player Progress Tracking
{
  console.log("\n--- Scenario 3: Per-player Progress Tracking ---");
  const game = new Game();
  const player1 = new Player('p1', '#0ff', false);
  player1.id = 'p1';
  const player2 = new Player('p2', '#f00', false);
  player2.id = 'p2';
  game.allPlayers = [player1, player2];

  const planet = new Planet(3, 500, 500, 30, null, 100);
  planet.anomaly = {
    id: 'a3',
    x: 500,
    y: 500,
    difficulty: 100,
    progress: {},
    researched: false,
    beingResearched: false,
    rewardType: 'credits'
  };
  game.planets = [planet];

  // Ship 1 (p1)
  const ship1 = new Ship('s1', 500, 500, null, player1);
  ship1.isCruiser = true;
  ship1.labs = 2;
  ship1.cruiserRadarRange = () => 150;
  ship1.update = () => {};
  ship1.checkSurvivalRoll = () => true;
  game.ships.push(ship1);

  // Ship 2 (p2)
  const ship2 = new Ship('s2', 500, 500, null, player2);
  ship2.isCruiser = true;
  ship2.labs = 2;
  ship2.cruiserRadarRange = () => 150;
  ship2.update = () => {};
  ship2.checkSurvivalRoll = () => true;
  game.ships.push(ship2);

  // Run updates. Because they are on the same planet, they both research.
  // Wait, the code breaks out of the ship loop for a planet once a ship researches it?
  // Let's verify line 3822 in src/game.js: "break;" is present inside the research loop!
  // So only one ship can research an anomaly at a time per tick.
  // Let's research with ship1 first (by having only ship1 on the planet)
  ship2.x = 9999; // move ship2 away

  // threshold = (2 + 0 + 0 + 0) * 3 = 6. difficulty - progress = 100. Untripled speed:
  // 2 * 60000 / 120000 = 1.0 completions per update.
  game.update(60000);

  // Now move ship1 away and ship2 in
  ship1.x = 9999;
  ship2.x = 500;

  game.update(60000);

  console.log("Planet anomaly progress object:", planet.anomaly.progress);
  assert(planet.anomaly.progress['p1'] === 1, "Player 1 progress should be 1");
  assert(planet.anomaly.progress['p2'] === 1, "Player 2 progress should be 1");
}

// Scenario 4: Progress tripling rate near completion
{
  console.log("\n--- Scenario 4: Progress rate-tripling near completion ---");
  const game = new Game();
  const human = new Player('human', '#0ff', false);
  human.id = 'human';
  game.allPlayers = [human];

  const planet = new Planet(4, 500, 500, 30, null, 100);
  planet.anomaly = {
    id: 'a4',
    x: 500,
    y: 500,
    difficulty: 10,
    progress: {},
    researched: false,
    beingResearched: false,
    rewardType: 'credits'
  };
  game.planets = [planet];

  const ship = new Ship('c1', 500, 500, null, human);
  ship.isCruiser = true;
  ship.labs = 2;
  ship.cruiserRadarRange = () => 150;
  ship.update = () => {};
  ship.checkSurvivalRoll = () => true;
  ship.gainXp = () => {};
  game.ships.push(ship);

  // Threshold = (labs + shipXp + playerTech + playerXp) * 3 = (2 + 0 + 0 + 0) * 3 = 6.
  // Current remaining progress: 10 - 0 = 10. Since 10 >= 6, rate is NOT tripled.
  // Standard speed: 2 * 60000 / 120000 = 1.0 completion.
  game.update(60000);
  console.log("Progress after 1 tick (expected 1):", planet.anomaly.progress['human']);
  assert(planet.anomaly.progress['human'] === 1, "Should have 1 progress without tripling");

  // Remaining progress: 10 - 1 = 9. Since 9 >= 6, rate is still NOT tripled.
  game.update(60000);
  console.log("Progress after 2 ticks (expected 2):", planet.anomaly.progress['human']);
  assert(planet.anomaly.progress['human'] === 2, "Should have 2 progress without tripling");

  // Remaining progress: 10 - 2 = 8. Since 8 >= 6, rate is still NOT tripled.
  game.update(60000);
  console.log("Progress after 3 ticks (expected 3):", planet.anomaly.progress['human']);
  assert(planet.anomaly.progress['human'] === 3, "Should have 3 progress without tripling");

  // Remaining progress: 10 - 3 = 7. Since 7 >= 6, rate is still NOT tripled.
  game.update(60000);
  console.log("Progress after 4 ticks (expected 4):", planet.anomaly.progress['human']);
  assert(planet.anomaly.progress['human'] === 4, "Should have 4 progress without tripling");

  // Remaining progress: 10 - 4 = 6. Since 6 >= 6, rate is still NOT tripled.
  game.update(60000);
  console.log("Progress after 5 ticks (expected 5):", planet.anomaly.progress['human']);
  assert(planet.anomaly.progress['human'] === 5, "Should have 5 progress without tripling");

  // Remaining progress: 10 - 5 = 5. Since 5 < 6, rate MUST BE TRIPLED!
  // Tripled speed: 3 * 1.0 = 3.0 completions per update.
  game.update(60000);
  console.log("Progress after 6 ticks (expected 8 due to tripling):", planet.anomaly.progress['human']);
  assert(planet.anomaly.progress['human'] === 8, "Rate should have tripled to add +3 progress");
}

console.log("\nAll anomaly refinement scenario tests passed successfully!");
process.exit(0);
