import { Game } from '../src/game.js';
import { Ship } from '../src/entities/Ship.js';
import assert from 'assert';

function runTest() {
  console.log("Starting Cruiser Upgrade Credit Priority tests...");

  // 1. Initialize Game
  const game = new Game({ width: 1600, height: 1600 });
  game.initMap();

  // Pick a planet and assign to player
  const planet = game.planets[0];
  const player = game.allPlayers.find(p => p.id === 'p1') || game.allPlayers[0];
  
  planet.owner = player;
  player.totalShips = 100;
  
  // Set up homeworld status to test minAllowedCredits / debt limit
  planet.homeworldOf = player.id;
  // minAllowedCredits = -(1000 + Math.floor(100)) = -1100

  // Spawn a cruiser owned by player p1 near that planet
  const cruiser = new Ship('c1', planet.x + 10, planet.y + 10, null, player);
  cruiser.isCruiser = true;
  cruiser.maxHealth = 40;
  cruiser.health = 40;
  game.ships.push(cruiser);

  // Set player credits to be in debt, but above debt limit
  // minAllowedCredits = -1100. Let's set credits to -1080 (available = 20)
  player.credits = -1080;
  player.useCredits = false; // verify that useCredits toggle is ignored

  // Get upgrade cost
  const cost = game.getUpgradeCost(cruiser, 'shield');
  console.log(`Upgrade cost: ${cost}`);

  // Let's manually trigger the progressive upgrade starting state (just like server.js does)
  cruiser.isUpgrading = true;
  cruiser.upgradeTimer = cost * 0.2;
  cruiser.upgradeProp = 'shields';
  cruiser.upgradeType = 'shield';
  cruiser.upgradePlanetId = planet.id;
  cruiser.upgradeShipsPaid = 0;
  cruiser.upgradeAccumulator = 0;

  console.log(`cruiser.upgradePlanetId: ${cruiser.upgradePlanetId}`);
  console.log(`planet.id: ${planet.id}`);
  console.log(`planet.owner.id: ${planet.owner ? planet.owner.id : 'none'}`);
  console.log(`cruiser.owner.id: ${cruiser.owner ? cruiser.owner.id : 'none'}`);
  
  // Let's print out what the update function evaluates
  let minAllowedCredits = 0;
  if (cruiser.owner && game && game.planets) {
    const ownsHomeworld = game.planets.some(p => p.homeworldOf === cruiser.owner.id && p.owner && p.owner.id === cruiser.owner.id);
    if (ownsHomeworld) {
      minAllowedCredits = -(1000 + (cruiser.owner.totalShips || 0));
    }
  }
  const creditsAvailable = (cruiser.owner && cruiser.owner.credits !== undefined) ? (cruiser.owner.credits - minAllowedCredits) : 0;
  console.log(`minAllowedCredits: ${minAllowedCredits}`);
  console.log(`creditsAvailable: ${creditsAvailable}`);
  console.log(`planet.ships: ${planet.ships}`);

  // Simulate updating the ship over multiple frames
  const deltaTime = 200; // 200 ms
  
  for (let i = 0; i < 30; i++) {
    cruiser.update(deltaTime, game.ships, game.explosions, game.planets, game.lasers, game.ionStorms, game.width, game);
  }

  console.log(`Credits after 30 updates: ${player.credits}`);
  console.log(`Upgrade ships paid: ${cruiser.upgradeShipsPaid}`);
  console.log(`Cruiser shields level: ${cruiser.shields || 0}`);

  assert.strictEqual(player.credits, -1100, "Credits should have been paid down to the debt limit of -1100");
  
  console.log("All Cruiser Upgrade Credit tests passed successfully!");
}

try {
  runTest();
} catch (error) {
  console.error("Test failed!", error);
  process.exit(1);
}
