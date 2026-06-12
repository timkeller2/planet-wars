// Test getSelectedCruiserUpgradeQualifiers logic
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=== Testing getSelectedCruiserUpgradeQualifiers on garrison world ===");

// Mocking getUpgradeCostForShip
function getUpgradeCostForShip(ship, prop) {
  return 100; // Mocked upgrade cost
}

// Mocking hazardSensorReductionPct
function hazardSensorReductionPct(x, y, ownerId) {
  return 1.0;
}

// The client-side function to test (copied from src/main.js and adapted slightly for test harnesses)
function getSelectedCruiserUpgradeQualifiers(serverState, localPlayer, selectedShips, minCostOverride = 100) {
  if (!serverState || !localPlayer) return null;
  if (selectedShips.length !== 1) return null;
  const ship = serverState.ships.find(s => s.id === selectedShips[0].id);
  if (!ship || !ship.isCruiser || ship.ownerId !== localPlayer.id) return null;

  const minCost = minCostOverride;
  const myPlayer = serverState.players.find(pl => pl.id === localPlayer.id);
  const creditsAvailable = (myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0;

  let closestPlanet = null;
  let closestDistSq = Infinity;

  for (const p of serverState.planets) {
    if (p.ownerId === localPlayer.id && (p.ships + creditsAvailable) >= minCost) {
      const techBonus = 0.01 * Math.sqrt(localPlayer.techScore || 0);
      const expBonus = 0.01 * Math.sqrt(localPlayer.expScore || 0);
      let baseRadius = p.maxShips * 1.5;
      if (p.isMilitary && p.ships >= p.maxShips) {
        baseRadius *= 1.5;
      }
      if (p.focusMode === 'garrison' && p.ships >= p.maxShips) {
        baseRadius += (p.ships / 2);
      }
      const gravityRadius = baseRadius * (1 + techBonus + expBonus);
      const pct = hazardSensorReductionPct(p.x, p.y, p.ownerId);
      const effGravity = Math.max(10, gravityRadius * pct);

      const dx = ship.x - p.x;
      const dy = ship.y - p.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= effGravity * effGravity) {
        // Rule: Limit such a garrison world from paying upgrade costs unless the upgrading ship is within 25px of the garrison world.
        // Exception: If the player has enough credits to cover the cost of the upgrade.
        const isSuchGarrisonWorld = (p.isMilitary || p.focusMode === 'garrison') && (p.ships >= p.maxShips * 2 - 10);
        const hasEnoughCredits = myPlayer && myPlayer.useCredits !== false && (myPlayer.credits || 0) >= minCost;
        if (isSuchGarrisonWorld && distSq > 25 * 25 && !hasEnoughCredits) {
          continue;
        }
        
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closestPlanet = p;
        }
      }
    }
  }

  if (closestPlanet) {
    return { ship, planet: closestPlanet };
  }
  return null;
}

// Test case 1: Player has enough credits. Upgrade should be ALLOWED.
{
  const localPlayer = { id: 'p1', techScore: 0, expScore: 0 };
  const myPlayer = { id: 'p1', useCredits: true, credits: 150 }; // 150 credits, enough for 100 cost
  
  const planet = {
    id: 1,
    x: 100,
    y: 100,
    ownerId: 'p1',
    maxShips: 50,
    ships: 100, // Fully loaded garrison world (50 * 2 = 100)
    focusMode: 'garrison',
    isMilitary: false
  };

  const ship = {
    id: 10,
    x: 200, // Distance is 100px away (which is > 25px, but within gravity radius of ~125px)
    y: 100,
    isCruiser: true,
    ownerId: 'p1'
  };

  const serverState = {
    players: [myPlayer],
    planets: [planet],
    ships: [ship]
  };

  const res = getSelectedCruiserUpgradeQualifiers(serverState, localPlayer, [{ id: 10 }]);
  console.log("Test 1 Result:", res ? "Allowed" : "Blocked");
  assert(res !== null, "Upgrade should be allowed when player has enough credits");
}

// Test case 2: Player has credits toggled off. Upgrade should be BLOCKED.
{
  const localPlayer = { id: 'p1', techScore: 0, expScore: 0 };
  const myPlayer = { id: 'p1', useCredits: false, credits: 150 };
  
  const planet = {
    id: 1,
    x: 100,
    y: 100,
    ownerId: 'p1',
    maxShips: 50,
    ships: 100,
    focusMode: 'garrison',
    isMilitary: false
  };

  const ship = {
    id: 10,
    x: 200,
    y: 100,
    isCruiser: true,
    ownerId: 'p1'
  };

  const serverState = {
    players: [myPlayer],
    planets: [planet],
    ships: [ship]
  };

  const res = getSelectedCruiserUpgradeQualifiers(serverState, localPlayer, [{ id: 10 }]);
  console.log("Test 2 Result:", res ? "Allowed" : "Blocked");
  assert(res === null, "Upgrade should be blocked when player has credits toggled off");
}

// Test case 3: Player has credits toggled on but not enough credits. Upgrade should be BLOCKED.
{
  const localPlayer = { id: 'p1', techScore: 0, expScore: 0 };
  const myPlayer = { id: 'p1', useCredits: true, credits: 20 }; // Only 20 credits, not enough for 100 cost
  
  const planet = {
    id: 1,
    x: 100,
    y: 100,
    ownerId: 'p1',
    maxShips: 50,
    ships: 100,
    focusMode: 'garrison',
    isMilitary: false
  };

  const ship = {
    id: 10,
    x: 200,
    y: 100,
    isCruiser: true,
    ownerId: 'p1'
  };

  const serverState = {
    players: [myPlayer],
    planets: [planet],
    ships: [ship]
  };

  const res = getSelectedCruiserUpgradeQualifiers(serverState, localPlayer, [{ id: 10 }]);
  console.log("Test 3 Result:", res ? "Allowed" : "Blocked");
  assert(res === null, "Upgrade should be blocked when player has insufficient credits");
}

console.log("All getSelectedCruiserUpgradeQualifiers tests PASSED successfully!");
