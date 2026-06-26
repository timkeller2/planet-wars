import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Planet } from '../src/entities/Planet.js';

function testMarketDirectPurchase() {
  console.log("Running Market Direct Purchase & Lifespan Test...");

  const game = new Game();
  const player = new Player('human-1', '#ff0000', false);
  player.isAlive = true;
  player.credits = 100;
  player.resources.duranium = 10;
  player.tradeOptions = 5;
  
  game.allPlayers = [player];

  // Instantiating Planets owned by the player to keep them alive and provide trade capacity
  game.planets = [];
  for (let i = 0; i < 21; i++) {
    game.planets.push(new Planet(`p-${i}`, 100 + i * 10, 100, 30, player, 10));
  }

  // Safely clear other collections
  game.ships.length = 0;
  game.explosions.length = 0;
  game.lasers.length = 0;
  game.ionStorms = [];
  game.aiPlayers = [];
  game.wreckages = [];

  const now = Date.now();

  // Test Case 1: Lifespan should be 30 minutes when posted.
  // We can manually add a sell order mimicking the posting.
  game.sellOrders = [
    {
      id: 'order-1',
      ownerId: player.id,
      ownerName: player.name,
      resource: 'duranium',
      price: 1,
      createdAt: now,
      expiresAt: now + 30 * 60 * 1000 // 30 minutes
    },
    {
      id: 'order-10',
      ownerId: player.id,
      ownerName: player.name,
      resource: 'duranium',
      price: 10,
      createdAt: now,
      expiresAt: now + 30 * 60 * 1000 // 30 minutes
    }
  ];

  // Test Case 2: Check lifespan expiration.
  // If we simulate time passing past 30 minutes:
  const orderExpired = {
    id: 'order-expired',
    ownerId: player.id,
    ownerName: player.name,
    resource: 'duranium',
    price: 1,
    createdAt: now - 35 * 60 * 1000,
    expiresAt: now - 5 * 60 * 1000
  };
  game.sellOrders.push(orderExpired);

  const initialDuranium = player.resources.duranium;
  game.update(1000); // Trigger update

  // order-expired should be removed and 1.0 duranium returned to player
  const hasExpiredOrder = game.sellOrders.some(o => o.id === 'order-expired');
  if (hasExpiredOrder) {
    console.error("FAIL: Expired order was not cleaned up.");
    process.exit(1);
  }
  if (player.resources.duranium < initialDuranium + 0.99) {
    console.error(`FAIL: Resource was not returned to owner upon expiration. Expected ${initialDuranium + 1.0}, got ${player.resources.duranium}`);
    process.exit(1);
  }
  console.log("SUCCESS: Order expired correctly and returned resource to the owner.");

  // Test Case 3: Direct Market Purchase at price 1.
  // Clear player resources to 0 so there are no storage fees
  player.resources.duranium = 0;

  // Price 1 order should be auto-bought in > 15 seconds.
  // Set creation time to 16 seconds ago
  game.sellOrders = [
    {
      id: 'order-price-1',
      ownerId: player.id,
      ownerName: player.name,
      resource: 'duranium',
      price: 1,
      createdAt: now - 16 * 1000,
      expiresAt: now + 30 * 60 * 1000
    },
    {
      id: 'order-price-10',
      ownerId: player.id,
      ownerName: player.name,
      resource: 'duranium',
      price: 10,
      createdAt: now - 16 * 1000, // Only 16s elapsed, needs 25 minutes (1500s)
      expiresAt: now + 30 * 60 * 1000
    }
  ];

  const prevCredits = player.credits;
  game.update(1000);

  // order-price-1 should be bought by market. Player gets +1 credit.
  const hasPrice1 = game.sellOrders.some(o => o.id === 'order-price-1');
  const hasPrice10 = game.sellOrders.some(o => o.id === 'order-price-10');

  if (hasPrice1) {
    console.error("FAIL: Price 1 sell order was not auto-bought after 16 seconds.");
    process.exit(1);
  }
  if (!hasPrice10) {
    console.error("FAIL: Price 10 sell order was incorrectly auto-bought early.");
    process.exit(1);
  }
  if (player.credits < prevCredits + 0.99) {
    console.error(`FAIL: Player did not receive 1 credit from auto-buy. Got ${player.credits}`);
    process.exit(1);
  }
  if (player.tradeOptions !== 5) {
    console.error(`FAIL: Player trade options changed on price=1 purchase. Expected 5, got ${player.tradeOptions}`);
    process.exit(1);
  }
  console.log("SUCCESS: Price 1 order auto-bought correctly at 16 seconds.");

  // Test Case 4: Direct Market Purchase at price 10.
  // Set creation time of price 10 order to 25.1 minutes ago (1506 seconds)
  game.sellOrders = [
    {
      id: 'order-price-10-buy',
      ownerId: player.id,
      ownerName: player.name,
      resource: 'duranium',
      price: 10,
      createdAt: now - 1506 * 1000,
      expiresAt: now + 30 * 60 * 1000
    }
  ];

  // Set tradeOptions to 0 to verify it can go negative
  player.tradeOptions = 0;

  const beforeCredits = player.credits;
  game.update(1000);

  const hasPrice10Buy = game.sellOrders.some(o => o.id === 'order-price-10-buy');
  if (hasPrice10Buy) {
    console.error("FAIL: Price 10 order was not auto-bought after 25.1 minutes.");
    process.exit(1);
  }
  if (player.credits < beforeCredits + 9.99) {
    console.error(`FAIL: Player did not receive 10 credits from auto-buy. Got ${player.credits}`);
    process.exit(1);
  }
  if (player.tradeOptions !== -1) {
    console.error(`FAIL: Player trade options should have decreased to -1, got ${player.tradeOptions}`);
    process.exit(1);
  }
  console.log("SUCCESS: Price 10 order auto-bought correctly after 25 minutes.");
  console.log("ALL TESTS PASSED!");
  process.exit(0);
}

testMarketDirectPurchase();
