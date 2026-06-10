import { Game } from '../src/game.js';
import { Player } from '../src/entities/Player.js';
import { Ship } from '../src/entities/Ship.js';

// Setup mock environment
global.requestAnimationFrame = () => {};

console.log("=== Testing Cruiser Refuel/Resupply Beams ===");

const game = new Game();
const owner = new Player('p1', '#0ff', false);
game.allPlayers = [owner];
game.planets = [];

// Cruiser 1: The Donor (has supplies)
const donor = new Ship('donor', 500, 500, null, owner, 500, 500);
donor.isCruiser = true;
donor.maxHealth = 25;
donor.health = 25;
donor.fuel_tanker = 1;
donor.maxsupplies = 15;
donor.supplies = 10;
donor.cruiserRadarRange = () => 500;

// Cruiser 2: Needs Healing/Resupply (Armor/Health)
const recipientHeal = new Ship('recipientHeal', 510, 510, null, owner, 510, 510);
recipientHeal.isCruiser = true;
recipientHeal.maxHealth = 25;
recipientHeal.health = 10;
recipientHeal.damagecontrol = 1;
recipientHeal.cruiserRadarRange = () => 500;

// Cruiser 3: Needs Refuel
const recipientRefuel = new Ship('recipientRefuel', 510, 500, null, owner, 510, 500);
recipientRefuel.isCruiser = true;
recipientRefuel.maxHealth = 25;
recipientRefuel.health = 25;
recipientRefuel.fuel = 5;
recipientRefuel.cruiserRadarRange = () => 500;

// Cruiser 4: Needs Bomb Rearm
const recipientBombs = new Ship('recipientBombs', 500, 510, null, owner, 500, 510);
recipientBombs.isCruiser = true;
recipientBombs.maxHealth = 25;
recipientBombs.health = 25;
recipientBombs.bombs = 0;
recipientBombs.getMaxBombs = () => 5;
recipientBombs.cruiserRadarRange = () => 500;

game.ships = [donor, recipientHeal, recipientRefuel, recipientBombs];
game.ships.getShipsInRadiusSq = (x, y, radiusSq) => {
  return game.ships;
};

const lasersList = [];

// Loop multiple ticks to allow random trigger chance (10%) to hit
for (let tick = 0; tick < 100; tick++) {
  // Keep health/fuel/bombs low and supplies high to ensure ongoing transfer
  recipientHeal.health = 10;
  recipientRefuel.fuel = 5;
  recipientBombs.bombs = 0;
  recipientBombs.bombReloadTimer = 5; // Ready to reload
  donor.supplies = 10;

  // Update recipientHeal to trigger resupply beam for healing
  recipientHeal.update(1000, game.ships, [], game.planets, lasersList, [], 1000, game);

  // Update recipientRefuel to trigger refuel beam
  recipientRefuel.update(1000, game.ships, [], game.planets, lasersList, [], 1000, game);

  // Update recipientBombs to trigger bomb rearm resupply beam
  recipientBombs.update(1000, game.ships, [], game.planets, lasersList, [], 1000, game);
}

let resupplyBeamsFound = 0;
let refuelBeamsFound = 0;
let bombBeamsFound = 0;

// Inspect triggered lasers
for (const laser of lasersList) {
  if (laser.color === 'resupply-beam') {
    if (laser.duration === 0.6) {
      bombBeamsFound++;
    } else {
      resupplyBeamsFound++;
    }
  } else if (laser.color === 'refuel-beam') {
    refuelBeamsFound++;
  }
}

console.log(`\nResults:`);
console.log(`- Resupply Beams (Healing): ${resupplyBeamsFound} (expected > 0)`);
console.log(`- Refuel Beams: ${refuelBeamsFound} (expected > 0)`);
console.log(`- Resupply Beams (Bombs): ${bombBeamsFound} (expected > 0)`);

if (resupplyBeamsFound > 0 && refuelBeamsFound > 0 && bombBeamsFound > 0) {
  console.log("\n-> Cruiser Refuel/Resupply Beams: PASSED");
} else {
  console.log("\n-> Cruiser Refuel/Resupply Beams: FAILED");
}
