import { Player } from './entities/Player.js';
import { Planet, getHabName, applyHabTerraformingStep } from './entities/Planet.js';
import { Ship } from './entities/Ship.js';
import { InputHandler } from './systems/InputHandler.js';
import { SHIP_NAMES } from './entities/ShipNames.js';
import { AIController } from './systems/AIController.js';

export function getEffectiveSympathy(planet, playerId, allShips, player = null, game = null) {
  const baseSympathy = planet.sympathy ? (planet.sympathy[playerId] || 0) : 0;
  
  if (planet._tickEffectiveSympathy) {
      return planet._tickEffectiveSympathy.get(playerId) || 0;
  }

  let extraSympathy = 0;
  if (allShips && (!planet.owner || planet.owner.id !== playerId)) {
    let isKnown = false;
    if (game && (!game.settings || !game.settings.fogOfWar)) {
      isKnown = true;
    } else {
      const resolvedPlayer = player || (game && game.allPlayers.find(p => p.id === playerId));
      if (resolvedPlayer) {
        if (resolvedPlayer.discoveredPlanets && resolvedPlayer.discoveredPlanets.has(planet.id)) {
          isKnown = true;
        } else {
          for (const ship of allShips) {
            if (ship.active && ship.owner && ship.owner.id === playerId) {
              const dx = ship.x - planet.x;
              const dy = ship.y - planet.y;
              const distSq = dx * dx + dy * dy;
              let radarRange = 50;
              if (ship.isCruiser || ship.maxHealth > 0) {
                radarRange = ship.cruiserRadarRange ? ship.cruiserRadarRange() : Math.min(250, 5 * (ship.maxHealth || 0));
              }
              const extendedRadar = radarRange * 1.5;
              if (distSq <= extendedRadar * extendedRadar) {
                isKnown = true;
                break;
              }
            }
          }
        }
      } else {
        isKnown = true;
      }
    }

    if (isKnown) {
      const gr = planet.getGravityRadius();
      const maxDistSq = gr * gr;
      for (const ship of allShips) {
        if (ship.active && ship.owner && ship.owner.id === playerId) {
          const dx = ship.x - planet.x;
          const dy = ship.y - planet.y;
          if (dx * dx + dy * dy <= maxDistSq) {
            const shipHp = (ship.isCruiser || ship.maxHealth > 0) ? (5 + ship.maxHealth * 0.5) : ((ship.count || 1) * 0.5);
            extraSympathy += shipHp;
          }
        }
      }
    }
  }

  let finalExtraSympathy = extraSympathy;
  if (extraSympathy > baseSympathy * 2) {
    finalExtraSympathy = baseSympathy * 2 + (extraSympathy - baseSympathy * 2) / 3;
  }
  return baseSympathy + finalExtraSympathy;
}

const SHIP_CLASSES = {
  corvette: { name: 'Corvette', key: 's', hp: 15, costShips: 50, costCap: 2 },
  destroyer: { name: 'Destroyer', key: 'd', hp: 25, costShips: 100, costCap: 4 },
  battlecruiser: { name: 'Battlecruiser', key: 'a', hp: 35, costShips: 175, costCap: 7 },
  titan: { name: 'Titan', key: 't', hp: 45, costShips: 300, costCap: 12 },
  mammoth: { name: 'Mammoth', key: 'm', hp: 55, costShips: 500, costCap: 20 }
};

class RecycledArray extends Array {
  constructor(capacity) {
    super();
    this.pool = Array.from({ length: capacity }, () => ({}));
    this.poolIndex = 0;
  }
  push(item) {
    const recycled = this.pool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.pool.length;
    for (const key in recycled) {
      delete recycled[key];
    }
    Object.assign(recycled, item);
    super.push(recycled);
  }
  clear() {
    this.length = 0;
  }
}

class SpatialGridArray extends Array {
  constructor() {
    super();
    this.grid = new Map();
    this.amoebaCount = 0;
  }
  static get [Symbol.species]() { return Array; }
  updateGrid() {
    this.grid.clear();
    let aCount = 0;
    for (let i = 0; i < this.length; i++) {
      const s = this[i];
      if (!s || !s.active) continue;
      if (s.isAmoeba) {
        aCount++;
      }
      const col = Math.floor(s.x / 100);
      const row = Math.floor(s.y / 100);
      const key = (col << 16) | (row & 0xFFFF);
      let cell = this.grid.get(key);
      if (!cell) {
        cell = [];
        this.grid.set(key, cell);
      }
      cell.push(s);
    }
    this.amoebaCount = aCount;
  }
  getShipsInRadiusSq(x, y, radiusSq) {
    const results = [];
    const radius = Math.sqrt(radiusSq);
    const minCol = Math.floor((x - radius) / 100);
    const maxCol = Math.floor((x + radius) / 100);
    const minRow = Math.floor((y - radius) / 100);
    const maxRow = Math.floor((y + radius) / 100);
    
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = (col << 16) | (row & 0xFFFF);
        const cell = this.grid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const s = cell[i];
            const dx = s.x - x;
            const dy = s.y - y;
            if (dx * dx + dy * dy <= radiusSq) {
              results.push(s);
            }
          }
        }
      }
    }
    return results;
  }
}

class PlanetGrid {
  constructor() {
    this.grid = new Map();
    this.cellSize = 500; // Larger cells for planets since they are sparse
  }
  
  populate(planets) {
    this.grid.clear();
    for (const p of planets) {
      // Include deep-space anomalies so ship sensor/sympathy queries stay spatial
      const col = Math.floor(p.x / this.cellSize);
      const row = Math.floor(p.y / this.cellSize);
      const key = (col << 16) | (row & 0xFFFF);
      let cell = this.grid.get(key);
      if (!cell) {
        cell = [];
        this.grid.set(key, cell);
      }
      cell.push(p);
    }
  }

  add(p) {
    const col = Math.floor(p.x / this.cellSize);
    const row = Math.floor(p.y / this.cellSize);
    const key = (col << 16) | (row & 0xFFFF);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = [];
      this.grid.set(key, cell);
    }
    cell.push(p);
  }

  getPlanetsInRadiusSq(x, y, radiusSq) {
    const results = [];
    const radius = Math.sqrt(radiusSq);
    const minCol = Math.floor((x - radius) / this.cellSize);
    const maxCol = Math.floor((x + radius) / this.cellSize);
    const minRow = Math.floor((y - radius) / this.cellSize);
    const maxRow = Math.floor((y + radius) / this.cellSize);
    
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = (col << 16) | (row & 0xFFFF);
        const cell = this.grid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const p = cell[i];
            const dx = p.x - x;
            const dy = p.y - y;
            if (dx * dx + dy * dy <= radiusSq) {
              results.push(p);
            }
          }
        }
      }
    }
    return results;
  }
}

export class Game {
  addPlanet(p) {
    this.planets.push(p);
    if (this.planetGridPopulated && this.planetGrid && !p.isDeepSpaceAnomaly) {
      this.planetGrid.add(p);
    }
  }

  static getRandomAnomalyRewardType() {
    const roll = Math.random() * 100;
    if (roll < 64) {
      return 'credits';
    } else if (roll < 70) {
      return 'discount';
    } else if (roll < 76) {
      return 'tech';
    } else if (roll < 82) {
      return 'xp';
    } else if (roll < 88) {
      return 'hab';
    } else if (roll < 94) {
      return 'rare_resource_cache';
    } else {
      return 'upgrade_token';
    }
  }

  registerBattleActivity(x, y, timeNow) {
    if (!this.ongoingBattles) return;
    let found = false;
    const searchRadius = 600;

    for (const b of this.ongoingBattles) {
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy < searchRadius * searchRadius) {
        b.lastActivityTime = timeNow;
        found = true;
        break;
      }
    }
    
    if (!found) {
      const planetsInvolved = [];
      if (this.planets) {
        for (const p of this.planets) {
          if (p.isDeepSpaceAnomaly) continue;
          const pdx = p.x - x;
          const pdy = p.y - y;
          if (pdx * pdx + pdy * pdy <= 800 * 800) {
            planetsInvolved.push({
              id: p.id,
              name: p.name,
              x: p.x,
              y: p.y,
              radius: p.radius,
              color: p.owner ? p.owner.color : '#888'
            });
          }
        }
      }

      this.ongoingBattles.push({
        id: 'BTL_' + timeNow + '_' + Math.floor(Math.random()*1000),
        x: x,
        y: y,
        radius: 800,
        startTime: timeNow,
        lastActivityTime: timeNow,
        lastFrameTime: 0,
        frames: [],
        participants: new Set(),
        planets: planetsInvolved,
        totalDamage: 0,
        cruiserDied: false
      });
    }
  }

  constructor(options) {
    if (options && options.getContext) {
      this.canvas = options;
      this.ctx = options.getContext('2d');
      this.width = this.canvas.width;
      this.height = this.canvas.height;
    } else {
      this.canvas = null;
      this.ctx = null;
      this.width = options?.width || 1920;
      this.height = options?.height || 1620;
    }
    
    this.humanPlayer = new Player('p1', '#0ff', false);
    this.monsterPlayer = new Player('monsters', '#006400', true);
    this.monsterPlayer.name = 'The Golden Amoeba';
    
    const allColors = [
      '#f0f', '#ff0', '#f00', '#0f0', '#00f', '#f80', '#80f', // Original 7
      '#08f', '#0f8', '#8f0', '#f08', '#f88', '#8f8', '#88f', '#fff',
      '#a40', '#0a4', '#40a', '#a04', '#4a0', '#04a', '#a44', '#4a4', '#aaa',
      '#cc0000', '#00cc00', '#0000cc', '#cccc00', '#00cccc', '#cc00cc',
      '#ff6666', '#66ff66', '#6666ff', '#ffff66', '#66ffff', '#ff66ff',
      '#993300', '#339900', '#003399', '#990033', '#330099', '#009933',
      '#ff9933', '#33ff99', '#9933ff', '#ff3399', '#99ff33', '#3399ff',
      '#dddddd', '#888888', '#444444'
    ];
    
    const aiNames = [
      'Xylar', 'Vexis', 'Gorg', 'Nekro', 'Kael', 'Zor', 'Ruk', 'Drax',
      'Zephyx', 'Vorath', 'Malakor', 'Thrax', 'Sylph', 'Nyx', 'Kryos',
      'Ignis', 'Aether', 'Onyx', 'Sol', 'Luna', 'Nova', 'Pulsar', 'Quasar',
      'Zorgon', 'Centauri', 'Hyperion', 'Vortex', 'Nebula', 'Andromeda', 'Orion',
      'Sirius', 'Vega', 'Draco', 'Lyra', 'Cygnus', 'Altair', 'Rigel', 'Betelgeuse',
      'Antares', 'Aldebaran', 'Capella', 'Procyon', 'Castor', 'Pollux', 'Arcturus',
      'Spica', 'Regulus', 'Fomalhaut', 'Deneb', 'Polaris', 'Canopus', 'Mizar',
      'Alcor', 'Algol', 'Zubenelgenubi', 'Zubeneschamali', 'Kraz', 'Girtab',
      'Shaula', 'Lesath', 'Sargas', 'Nunki', 'Kaus', 'Rukbat', 'Arkab',
      'Tarazed', 'Alshain', 'Altais', 'Rastaban', 'Eltanin', 'Grumium',
      'Gemma', 'Alphecca', 'Unukalhai', 'Sabik', 'Han', 'Marfik', 'Cheleb',
      'Cebalrai', 'Rasalas', 'Adhafera', 'Chertan', 'Zosma', 'Denebola',
      'Phact', 'Wazn', 'Mirzam', 'Adhara', 'Wezen', 'Aludra', 'Furud',
      'Sirrah', 'Mirach', 'Almach', 'Menkar', 'Baten', 'Acamar', 'Fornacis',
      'Titanus', 'Cronos'
    ];

    // Fisher-Yates Shuffle to guarantee 100% uniqueness of names assigned within the game
    const shuffledNames = [...aiNames];
    for (let i = shuffledNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
    }
    
    this.aiPlayers = [];
    for (let i = 0; i < 46; i++) {
      this.aiPlayers.push(new Player(shuffledNames[i] || `ai${i+1}`, allColors[i], true));
    }
    
    this.allPlayers = [this.humanPlayer, this.monsterPlayer, ...this.aiPlayers];
    
    this.planets = [];
    this.planetGrid = new PlanetGrid();
    this.planetGridPopulated = false;
    this.ships = new SpatialGridArray();
    this.lasers = new RecycledArray(1500);
    const originalLaserPush = this.lasers.push.bind(this.lasers);
    this.lasers.push = (item) => {
      originalLaserPush(item);
      const px = item.startX !== undefined ? item.startX : item.x;
      const py = item.startY !== undefined ? item.startY : item.y;
      if (px !== undefined && py !== undefined) {
        this.registerBattleActivity(px, py, Date.now());
      }
    };
    
    this.explosions = new RecycledArray(1000);
    const originalExplosionPush = this.explosions.push.bind(this.explosions);
    this.explosions.push = (item) => {
      originalExplosionPush(item);
      if (item.x !== undefined && item.y !== undefined) {
        this.registerBattleActivity(item.x, item.y, Date.now());
      }
    };
    
    this.ongoingBattles = [];
    this.completedBattleReplays = [];
    
    this.lastTime = 0;
    this.isRunning = false;
    this.isPaused = false;
    
    // In headless mode, InputHandler won't be initialized this way
    if (this.canvas) {
      this.inputHandler = new InputHandler(this.canvas, this);
    }
    this.aiControllers = this.allPlayers.filter(p => p !== this.monsterPlayer).map(p => new AIController(this, p));
    
    this.selectedPlanet = null;
    
    this.onGameOver = null;
    this.onGameOver = null;
    this.onScoreUpdate = null;
    
    this.pendingAIs = [];
    this.aiSpawnTimer = 0;
    this.aiSpawnInterval = 0;
    this.gameTime = 0;
    this.rampageInterval = 1800000;
    this.nextRampageTime = 1800000;
    this.nextRampageSelectionTime = Math.max(0, this.nextRampageTime - 180000);
    this.incubatingPlanet = null;
    this.rampageIncubationTimeRemaining = 0;
    this.scheduledAttacks = [];
    this.scheduledEvents = [];
    this.ionStorms = [];
    this.nextIonStormId = 0;
    this.ionStormSpawnTimer = 0;
    this.ionStormDamageTimer = 0;
    this.minefieldDamageTimer = 0;
    const getRandDiscount = () => Math.round((-0.35 + Math.random() * 0.45) * 100) / 100;
    this.globalUpgradeModifiers = {
      sensorarray: getRandDiscount(),
      lab: getRandDiscount(),
      armor: getRandDiscount(),
      shield: getRandDiscount(),
      engine: getRandDiscount(),
      munitions: getRandDiscount(),
      targeting: getRandDiscount(),
      damagecontrol: getRandDiscount(),
      supplyship: getRandDiscount(),
      extendedfuel: getRandDiscount(),
      diplomat: getRandDiscount(),
      marines: getRandDiscount(),
      command: getRandDiscount()
    };
    this.upgradeEnhanceEvents = [];
    this.accuracyEvents = [];
    this.happinessEvents = [];
    this.pendingChatMessages = [];
    this.pendingAnomalyCompletions = [];
    this.sellOrders = [];
    this.fulfillOrders = [];
    this.neutralTradeTimer = 0;
    this.nextNeutralTradeTime = 120000 + Math.random() * 60000;
    this.aiMarketTimer = 0;
    this.usedShipNames = new Set();
    this.marketSalesHistory = [];
    // Base market prices track rarity: common=4, normal=8, rare=12, exotic=16
    this.marketPrices = {
      dilithium: 8, merculite: 8, duranium: 8, tritanium: 8,
      antimatter: 8, deuterium: 8, latinum: 8
    };
    this.resourceRarities = {
      dilithium: 'normal', merculite: 'normal', duranium: 'normal', tritanium: 'normal',
      antimatter: 'normal', deuterium: 'normal', latinum: 'normal'
    };
    this.bundleValue = 200;
    this.marketFluctuationTimer = 0;
    this.highestSpeedMilestoneTriggered = 0;
    this.wreckages = [];
    this.pendingPioneerSpawns = [];
    this._gameSpeed = 1.0;
    this.baseGameSpeed = 1.0;
    this.battlecam = 0;
    this._calculatingBattlecamSpeed = false;
    this.shipLastCombatGameTime = new Map();
  }

  get gameSpeed() {
    return this._gameSpeed;
  }

  set gameSpeed(val) {
    this._gameSpeed = val;
    if (!this._calculatingBattlecamSpeed) {
      this.baseGameSpeed = val;
    }
  }

  updateBattlecam() {
    if (!this.shipLastCombatGameTime) {
      this.shipLastCombatGameTime = new Map();
    }

    const now = this.gameTime;

    // 1. Scan active lasers to update combat timestamps for cruisers
    for (const laser of this.lasers) {
      if (!laser || laser.color === 'resupply-beam' || laser.color === 'refuel-beam') {
        continue;
      }
      if (laser.sourceIsCruiser && laser.sourceId) {
        this.shipLastCombatGameTime.set(laser.sourceId, now);
      }
      if (laser.targetIsCruiser && laser.targetId) {
        this.shipLastCombatGameTime.set(laser.targetId, now);
      }
      if (laser.sourceShipId) {
        this.shipLastCombatGameTime.set(laser.sourceShipId, now);
      }
    }

    // Clean up old or inactive ships
    for (const [shipId, lastTime] of this.shipLastCombatGameTime.entries()) {
      if (now - lastTime > 5000) {
        this.shipLastCombatGameTime.delete(shipId);
      }
    }

    // 2. Count active cruisers currently in combat for each player
    const playerCombatCounts = new Map();
    for (const p of this.allPlayers) {
      playerCombatCounts.set(p.id, 0);
    }

    for (const ship of this.ships) {
      if (ship.active && (ship.isCruiser || (ship.maxHealth > 0 && !ship.isAmoeba))) {
        if (this.shipLastCombatGameTime.has(ship.id) && ship.owner) {
          const currentCount = playerCombatCounts.get(ship.owner.id) || 0;
          playerCombatCounts.set(ship.owner.id, currentCount + 1);
        }
      }
    }

    // 3. Find the highest count among all players
    let highestCount = 0;
    for (const count of playerCombatCounts.values()) {
      if (count > highestCount) {
        highestCount = count;
      }
    }

    this.battlecam = highestCount;

    // 4. Calculate game speed reduction
    let speedFactor = 1.0;
    if (this.battlecam > 1) {
      const extra = this.battlecam - 1;
      speedFactor = Math.max(0.3, 1.0 - extra * 0.1);
    }

    this._calculatingBattlecamSpeed = true;
    this.gameSpeed = this.baseGameSpeed * speedFactor;
    this._calculatingBattlecamSpeed = false;
  }

  recordMarketSale(resource, price) {
    this.marketSalesHistory = this.marketSalesHistory || [];
    this.marketSalesHistory.push({
      resource: resource,
      price: price,
      timestamp: Date.now()
    });
  }

  getMaxSoldPriceInLast5Minutes(resource) {
    if (!this.marketSalesHistory) return 0;
    const now = Date.now();
    const cutoff = now - 5 * 60 * 1000; // 5 minutes in ms
    const sales = this.marketSalesHistory.filter(s => s.resource === resource && s.timestamp >= cutoff);
    if (sales.length === 0) return 0;
    return Math.max(...sales.map(s => s.price));
  }

  spawnAmoebaCheat() {
    const spawnX = Math.random() * this.width;
    const spawnY = Math.random() * this.height;
    if (!this.monsterPlayer) return null;
    const amoeba = new Ship(this.nextShipId++, spawnX, spawnY, null, this.monsterPlayer);
    amoeba.isAmoeba = true;
    amoeba.cruiserStyle = 'Romulan';
    amoeba.speed = 10;
    amoeba.maxHealth = 15;
    amoeba.health = 15;
    this.ships.push(amoeba);
    return amoeba;
  }

  spawnGoldenAmoeba() {
    if (!this.monsterPlayer) return null;
    
    let largestPlanet = this.planets[0];
    for (const p of this.planets) {
      if ((p.maxShips || 0) > (largestPlanet.maxShips || 0)) {
        largestPlanet = p;
      }
    }
    
    const spawnX = largestPlanet ? largestPlanet.x + (Math.random() - 0.5) * 100 : this.width / 2;
    const spawnY = largestPlanet ? largestPlanet.y + (Math.random() - 0.5) * 100 : this.height / 2;

    const amoeba = new Ship(this.nextShipId++, spawnX, spawnY, null, this.monsterPlayer);
    amoeba.isAmoeba = true;
    amoeba.isGoldenAmoeba = true;
    amoeba.name = "The Golden Amoeba";
    amoeba.cruiserStyle = 'Romulan';
    amoeba.speed = 10;
    amoeba.maxHealth = 15;
    amoeba.health = 15;
    this.ships.push(amoeba);
    
    if (this.events) {
      this.events.push({
        text: "A strange temporal distortion is detected... The Golden Amoeba has appeared!",
        type: 'diplomacy',
        color: '#ffd700',
        age: 0,
        duration: 8.0
      });
    }
    return amoeba;
  }

  assignRandomShipName(ship) {
    if (!ship.isCruiser || ship.isAmoeba) return;

    let race = ship.cruiserStyle || 'Federation';
    const matchedRaceKey = Object.keys(SHIP_NAMES).find(
      k => k.toLowerCase() === race.toLowerCase()
    );
    race = matchedRaceKey || 'Federation';

    let size = 'small';
    if (ship.classType) {
      const ct = ship.classType.toLowerCase();
      if (ct === 'corvette' || ct === 'destroyer') size = 'small';
      else if (ct === 'battlecruiser') size = 'medium';
      else if (ct === 'titan' || ct === 'mammoth') size = 'large';
    } else {
      const hp = ship.maxHealth || 15;
      if (hp <= 29) size = 'small';
      else if (hp <= 39) size = 'medium';
      else size = 'large';
    }

    const candidates = SHIP_NAMES[race]?.[size] || [];
    if (candidates.length === 0) return;

    if (!this.usedShipNames) {
      this.usedShipNames = new Set();
    }

    let unused = candidates.filter(name => !this.usedShipNames.has(name));

    if (unused.length === 0) {
      console.log(`[Ship Naming] All names for ${race} (${size}) have been used. Recycled name list.`);
      for (const name of candidates) {
        this.usedShipNames.delete(name);
      }
      unused = candidates;
    }

    const chosenName = unused[Math.floor(Math.random() * unused.length)];
    ship.name = chosenName;
    this.usedShipNames.add(chosenName);
  }

  getUpgradeCost(ship, type) {
    const totalUpgrades = (ship.sensorarrays || 0) +
                          (ship.labs || 0) +
                          (ship.armor || 0) +
                          (ship.shields || 0) +
                          (ship.engine || 0) +
                          (ship.munitions || 0) +
                          (ship.targeting || 0) +
                          (ship.damagecontrol || 0) +
                          (ship.supply_ship || 0) +
                          (ship.extended_fuel || 0) +
                          (ship.diplomat || 0) +
                          (ship.marines || 0) +
                          (ship.command || 0);
    const healthVal = (ship.maxHealth !== undefined) ? ship.maxHealth : (ship.maxShips || 100);
    const baseCost = Math.min(150, Math.round(25 + healthVal * (3 + totalUpgrades / 3)));
    
    const typeKeyMap = {
      sensorarrays: 'sensorarray',
      labs: 'lab',
      armor: 'armor',
      shields: 'shield',
      engine: 'engine',
      munitions: 'munitions',
      targeting: 'targeting',
      damagecontrol: 'damagecontrol',
      supply_ship: 'supplyship',
      extended_fuel: 'extendedfuel',
      diplomat: 'diplomat',
      marines: 'marines',
      command: 'command',
      
      sensorarray: 'sensorarray',
      lab: 'lab',
      shield: 'shield',
      supplyship: 'supplyship',
      extendedfuel: 'extendedfuel'
    };
    const normType = typeKeyMap[type] || type;
    
    const globalMod = (this.globalUpgradeModifiers && this.globalUpgradeModifiers[normType] !== undefined)
      ? Math.max(-0.50, this.globalUpgradeModifiers[normType])
      : 0.0;
      
    let playerMod = 0.0;
    if (ship.owner && ship.owner.upgradeModifiers && ship.owner.upgradeModifiers[normType] !== undefined) {
      playerMod = ship.owner.upgradeModifiers[normType];
    }
    
    const modifier = Math.max(-0.75, globalMod + playerMod);
    let finalCost = Math.max(1, Math.round(baseCost * (1 + modifier)));

    // Only apply the planet upgrade divisor if it's a ship upgrade
    const isShip = (ship.maxHealth !== undefined);
    if (isShip && ship.owner) {
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
      const propName = propMap[type] || type;
      let planetUpgradesCount = 0;
      const playerId = ship.owner.id;
      for (const p of this.planets) {
        if (p.owner && p.owner.id === playerId && !p.dead) {
          planetUpgradesCount += (p[propName] || 0);
        }
      }
      const planetDiscount = Math.min(1.0, 0.20 * planetUpgradesCount);
      finalCost = Math.max(1, Math.round(finalCost * (1 - planetDiscount)));
    }

    return finalCost;
  }

  getCruiserTotalUpgradeCost(ship) {
    const upgradeProps = [
      'sensorarrays', 'labs', 'armor', 'shields', 'engine', 
      'munitions', 'targeting', 'damagecontrol', 'supply_ship', 'extended_fuel', 
      'diplomat', 'marines', 'command'
    ];
    let totalSpent = 0;
    
    const levels = {};
    let sumUpgrades = 0;
    for (const prop of upgradeProps) {
      levels[prop] = ship[prop] || 0;
      sumUpgrades += levels[prop];
    }
    
    while (sumUpgrades > 0) {
      let foundProp = null;
      for (const prop of upgradeProps) {
        if (levels[prop] > 0) {
          foundProp = prop;
          break;
        }
      }
      if (!foundProp) break;
      
      const prevSum = sumUpgrades - 1;
      const baseCost = Math.min(150, Math.round(25 + ship.maxHealth * (3 + prevSum / 3)));
      
      const typeKeyMap = {
        sensorarrays: 'sensorarray',
        labs: 'lab',
        armor: 'armor',
        shields: 'shield',
        engine: 'engine',
        munitions: 'munitions',
        targeting: 'targeting',
        damagecontrol: 'damagecontrol',
        supply_ship: 'supplyship',
        extended_fuel: 'extendedfuel',
        diplomat: 'diplomat',
        marines: 'marines'
      };
      const normType = typeKeyMap[foundProp] || foundProp;
      const globalMod = (this.globalUpgradeModifiers && this.globalUpgradeModifiers[normType] !== undefined)
        ? Math.max(-0.50, this.globalUpgradeModifiers[normType])
        : -0.25;
      let playerMod = 0;
      if (ship.owner && ship.owner.upgradeModifiers && ship.owner.upgradeModifiers[normType] !== undefined) {
        playerMod = ship.owner.upgradeModifiers[normType];
      }
      const modifier = Math.max(-0.75, globalMod + playerMod);
      const finalCost = Math.max(1, Math.round(baseCost * (1 + modifier)));
      totalSpent += finalCost;
      
      levels[foundProp]--;
      sumUpgrades--;
    }
    
    return totalSpent;
  }

  isPlanetInHumanGravityWell(p) {
    const humanPlayers = this.allPlayers.filter(pl => pl && !pl.isAI);
    for (const hp of humanPlayers) {
      for (const pl of this.planets) {
        if (pl.owner && pl.owner.id === hp.id) {
          const gr = pl.getGravityRadius();
          const dx = pl.x - p.x;
          const dy = pl.y - p.y;
          if (dx * dx + dy * dy < gr * gr) return true;
        }
      }
    }
    return false;
  }

  isPlanetVisibleToHuman(p) {
    const humanPlayers = this.allPlayers.filter(pl => pl && !pl.isAI);
    if (humanPlayers.length === 0) return false;

    for (const hp of humanPlayers) {
      // 1. Gravity well check
      for (const pl of this.planets) {
        if (pl.owner && pl.owner.id === hp.id) {
          const gr = pl.getGravityRadius();
          const dx = pl.x - p.x;
          const dy = pl.y - p.y;
          if (dx * dx + dy * dy <= gr * gr) return true;
        }
      }
      
      // 2. Sympathy check
      if (getEffectiveSympathy(p, hp.id, this.ships, hp, this) > 0) return true;

      // 3. Ship sensor check
      for (const s of this.ships) {
        if (s.active && s.owner && s.owner.id === hp.id) {
          const radarRange = (s.isCruiser && typeof s.cruiserRadarRange === 'function') ? s.cruiserRadarRange() : 50;
          const dx = s.x - p.x;
          const dy = s.y - p.y;
          if (dx * dx + dy * dy <= radarRange * radarRange) return true;
        }
      }
    }
    return false;
  }

  isPlanetVisibleTo(p, player) {
    if (!player) return false;
    if (player.id === 'monsters') return false;

    if (p._tickVisibleTo) {
        return p._tickVisibleTo.has(player.id);
    }

    if (!this.settings || !this.settings.fogOfWar) {
      return true;
    }

    if (p.owner && p.owner.id === player.id) {
      return true;
    }

    for (const pl of this.planets) {
      if ((pl.owner && pl.owner.id === player.id) || getEffectiveSympathy(pl, player.id, this.ships, player, this) > 0) {
        const gr = pl.getGravityRadius();
        const dx = pl.x - p.x;
        const dy = pl.y - p.y;
        if (dx * dx + dy * dy <= gr * gr) return true;
      }
    }

    if (getEffectiveSympathy(p, player.id, this.ships, player, this) > 0) return true;

    for (const s of this.ships) {
       if (s.active && s.owner && s.owner.id === player.id) {
        const radarRange = (s.isCruiser && typeof s.cruiserRadarRange === 'function') ? s.cruiserRadarRange() : 50;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        if (dx * dx + dy * dy <= radarRange * radarRange) return true;
      }
    }

    return false;
  }

  isShipVisibleTo(s, player) {
    if (!player) return false;
    if (player.id === 'monsters') return false;

    // If fog of war is NOT enabled, everything is visible
    if (!this.settings || !this.settings.fogOfWar) {
      return true;
    }

    // A player can always see their own ships
    if (s.owner && s.owner.id === player.id) {
      return true;
    }

    // 1. Gravity well check
    for (const pl of this.planets) {
      if ((pl.owner && pl.owner.id === player.id) || getEffectiveSympathy(pl, player.id, this.ships, player, this) > 0) {
        const gr = pl.getGravityRadius();
        const dx = pl.x - s.x;
        const dy = pl.y - s.y;
        if (dx * dx + dy * dy <= gr * gr) return true;
      }
    }

    // 2. Ship sensor check
    for (const other of this.ships) {
       if (other.active && other.owner && other.owner.id === player.id) {
        const radarRange = (other.isCruiser && typeof other.cruiserRadarRange === 'function') ? other.cruiserRadarRange() : 50;
        const dx = other.x - s.x;
        const dy = other.y - s.y;
        if (dx * dx + dy * dy <= radarRange * radarRange) return true;
      }
    }

    return false;
  }


  tryAssignPlanet(player) {
    if (player.needsPlanet && this.isRunning && player.isAlive !== undefined) {
      player.needsPlanet = false;
      this.assignPlanet(player);
    }
  }

  assignPlanet(player) {
    const hasHomeworld = this.planets.some(p => p.homeworldOf === player.id);
    if (hasHomeworld) {
      console.log(`[Warning] Attempted to assign homeworld to player ${player.id} who already owns one.`);
      return false;
    }

    const hwSizeSetting = (this.settings && this.settings.homeworldSize) ? this.settings.homeworldSize : "120";
    const isNatural = hwSizeSetting === 'natural' || ((hwSizeSetting === 'pioneers' || hwSizeSetting === 'pioneers-corvettes') && player.isAI);

    let targetPlanet = null;

    // Map-relative homeworld separation: prefer 1/5 of the shorter map edge
    const mapDim = Math.min(this.width || 1920, this.height || 1920);
    const preferredHwSeparation = mapDim / 5;
    const RICHNESS_RADIUS = 750;
    const RICHNESS_RADIUS_SQ = RICHNESS_RADIUS * RICHNESS_RADIUS;
    const SUPER_PLANET_AVOID = 500;
    const isHumanPlayer = !player.isAI && player.id !== 'monsters';

    // Local richness within radius: maxShips * (minerals/4) * ((habitability+50)/150)
    // (excludes existing homeworlds). minerals=4 & habitability=100 ⇒ weight 1.0.
    const getLocalEconomy = (x, y) => {
      let sum = 0;
      for (const p of this.planets) {
        if (!p.homeworldOf) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy <= RICHNESS_RADIUS_SQ) {
            const minerals = (p.minerals != null) ? p.minerals : 4;
            const habitability = (p.habitability != null) ? p.habitability : 100;
            sum += (p.maxShips || 0) * (minerals / 4) * ((habitability + 50) / 150);
          }
        }
      }
      return sum;
    };

    const getMinDistToHomeworlds = (x, y) => {
      let minD = Infinity;
      for (const p of this.planets) {
        if (!p.homeworldOf || p.homeworldOf === player.id) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) minD = d;
      }
      return minD;
    };

    const getMinDistToSuperPlanets = (x, y) => {
      let minD = Infinity;
      for (const p of this.planets) {
        if (!p.isSuperPlanet) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) minD = d;
      }
      return minD;
    };

    /** Prefer candidates far enough from super planets (humans only); relax if needed. */
    const filterAwayFromSuperPlanets = (list, getXY) => {
      if (!isHumanPlayer || list.length === 0) return list;
      const withDist = list.map(c => {
        const { x, y } = getXY(c);
        return { item: c, superDist: getMinDistToSuperPlanets(x, y) };
      });
      let ok = withDist.filter(e => e.superDist >= SUPER_PLANET_AVOID);
      if (ok.length === 0) {
        // Fallback: keep the half farthest from super planets
        withDist.sort((a, b) => b.superDist - a.superDist);
        ok = withDist.slice(0, Math.max(1, Math.floor(withDist.length / 2)));
      }
      return ok.map(e => e.item);
    };

    // Calculate average local economy of all non-homeworld planets
    const nonHwPlanets = this.planets.filter(p => !p.homeworldOf);
    let avgEconomy = 0;
    if (nonHwPlanets.length > 0) {
      let totalEconomySum = 0;
      for (const p of nonHwPlanets) {
        totalEconomySum += getLocalEconomy(p.x, p.y);
      }
      avgEconomy = totalEconomySum / nonHwPlanets.length;
    }

    // Helper to calculate distance from a position/planet to the 3rd closest non-homeworld planet
    const getGroupDist = (pos) => {
      let min1 = Infinity, min2 = Infinity, min3 = Infinity;
      for (let i = 0; i < this.planets.length; i++) {
        const p = this.planets[i];
        if (p === pos || p.homeworldOf) continue;
        const dx = p.x - pos.x;
        const dy = p.y - pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < min1) { min3 = min2; min2 = min1; min1 = distSq; }
        else if (distSq < min2) { min3 = min2; min2 = distSq; }
        else if (distSq < min3) { min3 = distSq; }
      }
      if (min3 !== Infinity) return Math.sqrt(min3);
      if (min2 !== Infinity) return Math.sqrt(min2);
      if (min1 !== Infinity) return Math.sqrt(min1);
      return Infinity;
    };

    if ((hwSizeSetting === 'pioneers' || hwSizeSetting === 'pioneers-corvettes') && !player.isAI) {
      let bestPos = null;
      
      // Spacing options: prefer map/5 from other players/homeworlds, then relax
      const playerSpacingOptions = [
        preferredHwSeparation,
        preferredHwSeparation * 0.66,
        preferredHwSeparation * 0.4,
        preferredHwSeparation * 0.2,
        0
      ];
      const planetSpacingOptions = [300, 200, 100, 50];
      
      // Get starting positions of already spawned human players' cruisers, pending spawns, or homeworlds
      const otherHumanCruiserPositions = [];
      for (const ship of this.ships) {
        if (ship.active && ship.owner && ship.owner.id !== player.id) {
          otherHumanCruiserPositions.push({ x: ship.x, y: ship.y });
        }
      }
      if (this.pendingPioneerSpawns) {
        for (const pSpawn of this.pendingPioneerSpawns) {
          if (pSpawn.ownerId !== player.id) {
            otherHumanCruiserPositions.push({ x: pSpawn.x, y: pSpawn.y });
          }
        }
      }
      for (const p of this.planets) {
        if (p.homeworldOf && p.homeworldOf !== player.id) {
          otherHumanCruiserPositions.push({ x: p.x, y: p.y });
        }
      }
      
      let found = false;
      for (const playerSpacing of playerSpacingOptions) {
        for (const planetSpacing of planetSpacingOptions) {
          // Try first requiring super-planet clearance, then relax
          for (const requireSuperClear of [true, false]) {
          const candidates = [];
          for (let attempt = 0; attempt < 500; attempt++) {
            // Pick a point near the map edge: between 50px and 300px from any border
            const edgeZone = Math.floor(Math.random() * 4);
            let x, y;
            if (edgeZone === 0) { // Left
              x = 50 + Math.random() * 250;
              y = 50 + Math.random() * (this.height - 100);
            } else if (edgeZone === 1) { // Right
              x = this.width - 300 + Math.random() * 250;
              y = 50 + Math.random() * (this.height - 100);
            } else if (edgeZone === 2) { // Top
              x = 50 + Math.random() * (this.width - 100);
              y = 50 + Math.random() * 250;
            } else { // Bottom
              x = 50 + Math.random() * (this.width - 100);
              y = this.height - 300 + Math.random() * 250;
            }
            
            // Boundary enforcement
            x = Math.max(50, Math.min(this.width - 50, x));
            y = Math.max(50, Math.min(this.height - 50, y));

            // Check distance from existing planets
            let tooCloseToPlanet = false;
            for (const p of this.planets) {
              const dx = p.x - x;
              const dy = p.y - y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < Math.max(p.radius + 30, planetSpacing)) {
                tooCloseToPlanet = true;
                break;
              }
            }
            if (tooCloseToPlanet) continue;

            // Check distance from other human players' cruisers / homeworlds
            if (playerSpacing > 0 && otherHumanCruiserPositions.length > 0) {
              let tooCloseToPlayer = false;
              for (const pos of otherHumanCruiserPositions) {
                const dx = pos.x - x;
                const dy = pos.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < playerSpacing) {
                  tooCloseToPlayer = true;
                  break;
                }
              }
              if (tooCloseToPlayer) continue;
            }

            // Prefer staying away from super planets (humans / pioneers)
            if (requireSuperClear && getMinDistToSuperPlanets(x, y) < SUPER_PLANET_AVOID) {
              continue;
            }

            // Check hazard (must not be inside any hazard)
            const isWithinHazard = (px, py) => {
              for (const storm of this.ionStorms) {
                const dx = storm.x - px;
                const dy = storm.y - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= storm.radius) {
                  return true;
                }
              }
              return false;
            };
            if (isWithinHazard(x, y)) continue;

            candidates.push({ x, y });
          }

          if (candidates.length > 0) {
            // Score candidates based on closeness to avgEconomy
            const candidatesWithInfo = candidates.map(c => {
              const localEco = getLocalEconomy(c.x, c.y);
              const ecoDiff = Math.abs(localEco - avgEconomy);
              return {
                x: c.x,
                y: c.y,
                ecoDiff: ecoDiff
              };
            });

            // Sort by closest economy difference ascending
            candidatesWithInfo.sort((a, b) => a.ecoDiff - b.ecoDiff);
            bestPos = candidatesWithInfo[0];
            found = true;
            break;
          }
          } // requireSuperClear
          if (found) break;
        }
        if (found) break;
      }

      if (!bestPos) {
        // Fallback to a random edge location
        const edgeZone = Math.floor(Math.random() * 4);
        let x, y;
        if (edgeZone === 0) {
          x = 75;
          y = 50 + Math.random() * (this.height - 100);
        } else if (edgeZone === 1) {
          x = this.width - 75;
          y = 50 + Math.random() * (this.height - 100);
        } else if (edgeZone === 2) {
          x = 50 + Math.random() * (this.width - 100);
          y = 75;
        } else {
          x = 50 + Math.random() * (this.width - 100);
          y = this.height - 75;
        }
        bestPos = { x, y };
      }

      // Assign player cruiserStyle if not already set
      if (!player.cruiserStyle) {
        const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
        if (!player.isAI) {
          const assignedStyles = this.allPlayers
            .filter(p => !p.isAI && p.cruiserStyle)
            .map(p => p.cruiserStyle);
          const unusedStyles = styles.filter(s => !assignedStyles.includes(s));
          if (unusedStyles.length > 0) {
            player.cruiserStyle = unusedStyles[Math.floor(Math.random() * unusedStyles.length)];
          } else {
            player.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
          }
        } else {
          player.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
        }
        console.log(`Assigned style ${player.cruiserStyle} to player ${player.id}`);
      }

      // Pioneer starting stockpile: 1 primary bomb resource, 0.2 of each other
      if (player.id !== 'monsters') {
        const bombResource = (player.cruiserStyle === 'Romulan' || player.cruiserStyle === 'Gorn') ? 'antimatter' :
                             ((player.cruiserStyle === 'Tholian' || player.cruiserStyle === 'Lyran') ? 'dilithium' : 'merculite');
        player.resources = {
          dilithium: 0.2,
          merculite: 0.2,
          duranium: 0.2,
          tritanium: 0.2,
          antimatter: 0.2,
          deuterium: 0.2,
          latinum: 0.2
        };
        player.resources[bombResource] = 1;
      }

      const potentialUpgrades = ['sensorarrays', 'armor', 'shields', 'engine', 'munitions', 'targeting', 'damagecontrol', 'supply_ship', 'extended_fuel', 'marines', 'command', 'labs', 'diplomat'];

      if (hwSizeSetting === 'pioneers-corvettes') {
        const angles = [0, 120, 240];
        const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
        
        let firstStyle = player.cruiserStyle;
        if (!firstStyle) {
          firstStyle = styles[Math.floor(Math.random() * styles.length)];
          player.cruiserStyle = firstStyle;
        }

        for (let i = 0; i < 3; i++) {
          const angleRad = (angles[i] * Math.PI) / 180;
          const sx = bestPos.x + Math.cos(angleRad) * 20;
          const sy = bestPos.y + Math.sin(angleRad) * 20;

          let upgrades = {};
          for (const up of potentialUpgrades) {
            upgrades[up] = 0;
          }

          let assignedStyle = firstStyle;
          if (i > 0) {
            assignedStyle = styles[Math.floor(Math.random() * styles.length)];
          }

          this.pendingPioneerSpawns.push({
            ownerId: player.id,
            x: sx,
            y: sy,
            classType: 'corvette',
            upgradeTokens: 3,
            upgrades: upgrades,
            timer: i * 30000, // 30 seconds apart: 0s, 30s, 60s
            isAdditional: i > 0,
            Pioneer: true,
            cruiserStyle: assignedStyle
          });
        }

        player.builtClasses = player.builtClasses || {};
        player.builtClasses['corvette'] = true;
        player.buildCounts = player.buildCounts || {};
        player.buildCounts['corvette'] = (player.buildCounts['corvette'] || 0) + 3;
      } else {
        // Spawn 1 Battlecruiser immediately
        let upgrades = {};
        for (const up of potentialUpgrades) {
          upgrades[up] = 0;
        }
        upgrades['supply_ship'] = 2;
        upgrades['diplomat'] = 1;
        upgrades['extended_fuel'] = 1;
        upgrades['sensorarrays'] = 1;
        upgrades['labs'] = 1;
        upgrades['engine'] = 1;

        this.pendingPioneerSpawns.push({
          ownerId: player.id,
          x: bestPos.x,
          y: bestPos.y,
          classType: 'battlecruiser',
          upgradeTokens: 0,
          upgrades: upgrades,
          timer: 0,
          isAdditional: false,
          Pioneer: true
        });

        player.builtClasses = player.builtClasses || {};
        player.builtClasses['battlecruiser'] = true;
        player.buildCounts = player.buildCounts || {};
        player.buildCounts['battlecruiser'] = (player.buildCounts['battlecruiser'] || 0) + 1;
      }

      player.planetCount = 0;
      player.needsPlanet = false;
      player.totalCapacity = 0;
      player.isAlive = true;
      player.isEliminated = false;
      player.lastAttackerPlayerId = null;
      this.recalculateResourceRarities();
      return true;
    }

    if (!isNatural) {
      // Create a new homeworld planet!
      const parsedVal = parseInt(hwSizeSetting, 10);
      const newRadius = (!isNaN(parsedVal) && parsedVal > 0) ? Math.round(parsedVal / 4) : 30;
      
      // Find a position away from other player homeworlds and not on top of any existing planet
      const existingHomeworlds = this.planets.filter(p => p.homeworldOf !== undefined && p.homeworldOf !== null);
      
      let bestPos = null;
      let maxMinDist = -1;
      
      // Try with different spacing values in case map is very crowded
      const spacings = [40, 25, 10];
      for (const spacing of spacings) {
        const candidates = [];
        for (let attempt = 0; attempt < 200; attempt++) {
          const x = newRadius + 50 + Math.random() * (this.width - newRadius * 2 - 100);
          const y = newRadius + 50 + Math.random() * (this.height - newRadius * 2 - 100);
          
          // Check collision with existing planets
          let collision = false;
          for (const p of this.planets) {
            const dx = p.x - x;
            const dy = p.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < p.radius + newRadius + spacing) {
              collision = true;
              break;
            }
          }
          if (!collision) {
            candidates.push({ x, y });
          }
        }
        
        if (candidates.length > 0) {
          // Calculate groupDist for each candidate
          const candidatesWithGroupDist = candidates.map(c => {
            return { x: c.x, y: c.y, groupDist: getGroupDist(c) };
          });

          // Filter/sort candidates to be not too far from a group of 2-3 planets (groupDist <= 320)
          let groupFiltered = candidatesWithGroupDist.filter(c => c.groupDist <= 320);
          if (groupFiltered.length === 0) {
            // Fallback: take top 10% closest to a group of planets
            candidatesWithGroupDist.sort((a, b) => a.groupDist - b.groupDist);
            groupFiltered = candidatesWithGroupDist.slice(0, Math.max(1, Math.floor(candidatesWithGroupDist.length * 0.1)));
          }

          // Honey hole avoidance filter metered by starting credits
          const startingCredits = (this.settings && this.settings.startingCredits !== undefined) ? this.settings.startingCredits : 0;
          const maxAllowedEconomy = avgEconomy * (2 + startingCredits / 250);

          const candidatesWithInfo = groupFiltered.map(c => {
            const minDist = existingHomeworlds.length > 0 ? Math.min(...existingHomeworlds.map(h => {
              const dx = h.x - c.x;
              const dy = h.y - c.y;
              return Math.sqrt(dx * dx + dy * dy);
            })) : Infinity;
            return {
              x: c.x,
              y: c.y,
              groupDist: c.groupDist,
              economy: getLocalEconomy(c.x, c.y),
              minHwDist: minDist,
              superDist: getMinDistToSuperPlanets(c.x, c.y)
            };
          });

          // Prefer map/5 separation from other homeworlds; relax if the map is crowded
          let notNear = candidatesWithInfo;
          if (existingHomeworlds.length > 0) {
            notNear = candidatesWithInfo.filter(c => c.minHwDist >= preferredHwSeparation);
            if (notNear.length === 0) {
              // Fallback: keep top 50% furthest from other homeworlds
              candidatesWithInfo.sort((a, b) => b.minHwDist - a.minHwDist);
              notNear = candidatesWithInfo.slice(0, Math.max(1, Math.floor(candidatesWithInfo.length / 2)));
            }
          }

          // Humans: prefer ≥500px from super planets
          notNear = filterAwayFromSuperPlanets(notNear, c => ({ x: c.x, y: c.y }));

          // Filter for economy <= maxAllowedEconomy
          let economyFiltered = notNear.filter(c => c.economy <= maxAllowedEconomy);
          if (economyFiltered.length === 0) {
            // Fallback: keep bottom 50% with lowest economy
            notNear.sort((a, b) => a.economy - b.economy);
            economyFiltered = notNear.slice(0, Math.max(1, Math.floor(notNear.length / 2)));
          }

          // Sort by economy descending to target the HIGHEST economy below the threshold
          economyFiltered.sort((a, b) => b.economy - a.economy);
          bestPos = economyFiltered[0];
          
          if (bestPos && existingHomeworlds.length > 0) {
            maxMinDist = bestPos.minHwDist;
          }
          break; // Found a position, stop trying smaller spacings
        }
      }
      
      if (bestPos) {
        const newPlanetId = Math.max(...this.planets.map(p => p.id), 0) + 1;
        const initialShips = (!isNaN(parsedVal) && parsedVal > 0) ? parsedVal : 120;
        targetPlanet = new Planet(newPlanetId, bestPos.x, bestPos.y, newRadius, null, initialShips, this.width, this.height);
        this.addPlanet(targetPlanet);
        console.log(`[New Homeworld Created] Created new Planet ${targetPlanet.name} (${targetPlanet.id}) at (${Math.round(bestPos.x)}, ${Math.round(bestPos.y)}) for player ${player.id}. Min dist to other homeworlds: ${maxMinDist.toFixed(1)}`);
      }
    }

    if (!targetPlanet) {
      const neutralPlanets = this.planets.filter(p => p.owner === null && !p.isSuperPlanet);
      if (neutralPlanets.length === 0) return false;

      if (player === this.monsterPlayer) {
        // Monster gets the smallest planet
        let candidates = [...neutralPlanets];
        const nearGroup = candidates.filter(p => getGroupDist(p) <= 320);
        if (nearGroup.length > 0) {
          candidates = nearGroup;
        }
        candidates.sort((a, b) => a.maxShips - b.maxShips);
        targetPlanet = candidates[0];
      } else {
        // Regular players: honey hole avoidance filter for existing planets metered by starting credits
        const startingCredits = (this.settings && this.settings.startingCredits !== undefined) ? this.settings.startingCredits : 0;
        const maxAllowedEconomy = avgEconomy * (2 + startingCredits / 250);

        const occupiedPlanets = this.planets.filter(p => p.owner !== null);
        const avoidancePositions = occupiedPlanets.map(op => ({ x: op.x, y: op.y }));
        for (const ship of this.ships) {
          if (ship.active && ship.owner && ship.owner.id !== player.id) {
            avoidancePositions.push({ x: ship.x, y: ship.y });
          }
        }
        if (this.pendingPioneerSpawns) {
          for (const pSpawn of this.pendingPioneerSpawns) {
            if (pSpawn.ownerId !== player.id) {
              avoidancePositions.push({ x: pSpawn.x, y: pSpawn.y });
            }
          }
        }

        const candidatesWithInfo = neutralPlanets.map(p => {
          const minOccupiedDist = avoidancePositions.length > 0 ? Math.min(...avoidancePositions.map(op => {
            const dx = op.x - p.x;
            const dy = op.y - p.y;
            return Math.sqrt(dx * dx + dy * dy);
          })) : Infinity;
          return {
            planet: p,
            economy: getLocalEconomy(p.x, p.y),
            minOccupiedDist,
            minHwDist: getMinDistToHomeworlds(p.x, p.y),
            superDist: getMinDistToSuperPlanets(p.x, p.y)
          };
        });

        // Prefer map/5 from other homeworlds; also stay clear of occupied starts
        let notNear = candidatesWithInfo;
        const hasOtherHomeworlds = this.planets.some(p => p.homeworldOf && p.homeworldOf !== player.id);
        if (hasOtherHomeworlds) {
          notNear = candidatesWithInfo.filter(c => c.minHwDist >= preferredHwSeparation);
          if (notNear.length === 0) {
            candidatesWithInfo.sort((a, b) => b.minHwDist - a.minHwDist);
            notNear = candidatesWithInfo.slice(0, Math.max(1, Math.floor(candidatesWithInfo.length / 2)));
          }
        } else if (avoidancePositions.length > 0) {
          // No homeworlds yet — keep a modest buffer from any occupied position
          const softSep = Math.min(250, preferredHwSeparation);
          notNear = candidatesWithInfo.filter(c => c.minOccupiedDist >= softSep);
          if (notNear.length === 0) {
            candidatesWithInfo.sort((a, b) => b.minOccupiedDist - a.minOccupiedDist);
            notNear = candidatesWithInfo.slice(0, Math.max(1, Math.floor(candidatesWithInfo.length / 2)));
          }
        }

        // Humans: prefer ≥500px from super planets
        notNear = filterAwayFromSuperPlanets(notNear, c => ({ x: c.planet.x, y: c.planet.y }));

        // Filter for economy <= maxAllowedEconomy
        let economyFiltered = notNear.filter(c => c.economy <= maxAllowedEconomy);
        if (economyFiltered.length === 0) {
          // Fallback: keep bottom 50% with lowest economy
          notNear.sort((a, b) => a.economy - b.economy);
          economyFiltered = notNear.slice(0, Math.max(1, Math.floor(notNear.length / 2)));
        }

        // Sort by economy descending to target the HIGHEST economy below the threshold
        economyFiltered.sort((a, b) => b.economy - a.economy);
        targetPlanet = economyFiltered[0].planet;
      }
    }

    if (targetPlanet) {
      targetPlanet.owner = player;
      if (!player.cruiserStyle) {
        const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
        if (!player.isAI) {
          const assignedStyles = this.allPlayers
            .filter(p => !p.isAI && p.cruiserStyle)
            .map(p => p.cruiserStyle);
          const unusedStyles = styles.filter(s => !assignedStyles.includes(s));
          if (unusedStyles.length > 0) {
            player.cruiserStyle = unusedStyles[Math.floor(Math.random() * unusedStyles.length)];
          } else {
            player.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
          }
        } else {
          player.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
        }
        console.log(`Assigned style ${player.cruiserStyle} to player ${player.id}`);
      }
      targetPlanet.racialAffinity = player.cruiserStyle;
      const hwSizeSetting = (this.settings && this.settings.homeworldSize) ? this.settings.homeworldSize : "120";
      if (hwSizeSetting !== 'natural') {
        const parsedVal = parseInt(hwSizeSetting, 10);
        if (!isNaN(parsedVal) && parsedVal > 0) {
          targetPlanet.sizeClass = parsedVal;
        }
      }
      targetPlanet.maxShips = Math.max(15, targetPlanet.sizeClass - 20);
      targetPlanet.sympathy = targetPlanet.sympathy || {};
      targetPlanet.sympathy[player.id] = targetPlanet.maxShips;
      targetPlanet.supplies = targetPlanet.maxShips;
      targetPlanet.ships = targetPlanet.maxShips;
      targetPlanet.radius = targetPlanet.sizeClass / 4;
      targetPlanet.habitability = 100;
      targetPlanet.justAssigned = true;
      targetPlanet.justAssignedTimer = 0;
      targetPlanet.homeworldOf = player.id;
      targetPlanet.minerals = 5;
      targetPlanet.focusMode = 'economy';
      
      // Ensure homeworld has a preferred resource
      const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      if (!targetPlanet.preferredResource) {
        targetPlanet.preferredResource = resourcesList[Math.floor(Math.random() * resourcesList.length)];
      }

      // Ensure homeworld has a random starting resource
      const startingResource = resourcesList[Math.floor(Math.random() * resourcesList.length)];
      targetPlanet.resources = [startingResource];

      // Ensure preferred resource is not the same as the mined starting resource
      if (targetPlanet.preferredResource === startingResource) {
        const otherPreferredList = resourcesList.filter(r => r !== startingResource);
        targetPlanet.preferredResource = otherPreferredList[Math.floor(Math.random() * otherPreferredList.length)];
      }

      // Give each player 3 of their bomb resource in their stockpile starting out
      if (player.id !== 'monsters') {
        const bombResource = (player.cruiserStyle === 'Romulan' || player.cruiserStyle === 'Gorn') ? 'antimatter' :
                             ((player.cruiserStyle === 'Tholian' || player.cruiserStyle === 'Lyran') ? 'dilithium' : 'merculite');
        player.resources = player.resources || {
          dilithium: 0,
          merculite: 0,
          duranium: 0,
          tritanium: 0,
          antimatter: 0,
          deuterium: 0,
          latinum: 0
        };
        player.resources[bombResource] = 3;
      }
      
      // Clear hazards from newly assigned planet
      for (const storm of this.ionStorms) {
        if (storm.type === 'minefield' || storm.type === 'nebula') {
          const dx = targetPlanet.x - storm.x;
          const dy = targetPlanet.y - storm.y;
          if (dx * dx + dy * dy <= storm.radius * storm.radius) {
            storm.knowledge[player.id] = (storm.knowledge[player.id] || 0) + 20;
          }
        }
      }
      
      let assignedCount = 1;
      let totalCapacity = targetPlanet.maxShips;
      
      if (player !== this.monsterPlayer && this.settings && this.settings.smallEmpires) {
        const remainingNeutral = this.planets.filter(p => 
          p !== targetPlanet && 
          p.owner === null && 
          !p.isSuperPlanet && 
          !p.isResearch && 
          !p.isMilitary && 
          !p.isSpeedPlanet
        );
        remainingNeutral.sort((a, b) => a.maxShips - b.maxShips);
        
        const smallPlanetsCount = Math.max(1, Math.round(this.planets.length / 20));
        const extraPlanets = remainingNeutral.slice(0, smallPlanetsCount);
        for (const ep of extraPlanets) {
          ep.owner = player;
          ep.ships = ep.maxShips;
          ep.justAssigned = true;
          ep.justAssignedTimer = 0;
          
          // Clear hazards from newly assigned planet
          for (const storm of this.ionStorms) {
            if (storm.type === 'minefield' || storm.type === 'nebula') {
              const dx = ep.x - storm.x;
              const dy = ep.y - storm.y;
              if (dx * dx + dy * dy <= storm.radius * storm.radius) {
                storm.knowledge[player.id] = (storm.knowledge[player.id] || 0) + 20;
              }
            }
          }
          assignedCount++;
          totalCapacity += ep.maxShips;
        }
      }
      
      player.planetCount = assignedCount;
      player.needsPlanet = false;
      player.totalCapacity = totalCapacity;
      player.isAlive = true;
      player.isEliminated = false;
      player.lastAttackerPlayerId = null;
      this.recalculateResourceRarities();
      return true;
    }
    return false;
  }

  recalculateResourceRarities(options = {}) {
    const forceBasePrices = !!(options && options.forceBasePrices);
    const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
    const counts = {};
    for (const r of resourcesList) {
      counts[r] = 0;
    }
    
    let totalDeposits = 0;
    for (const planet of this.planets) {
      if (planet.dead) continue;
      if (planet.resources) {
        for (const res of planet.resources) {
          if (resourcesList.includes(res)) {
            const weight = (planet.minerals || 4) / 4;
            counts[res] += weight;
            totalDeposits += weight;
          }
        }
      }
    }
    
    const average = totalDeposits / 7;
    // Preserve previous rarities so we can keep base prices in sync with rarity
    // until the market has moved a resource off its rarity base price.
    const previousRarities = this.resourceRarities || {};
    this.resourceRarities = {};
    const rarityToPrice = {
      'common': 4,
      'normal': 8,
      'rare': 12,
      'exotic': 16
    };
    const rarityBases = new Set([4, 8, 12, 16]);
    // Legacy constructor defaults that never matched rarity bases
    const legacyDefaults = new Set([5, 10, 15, 20]);
    for (const r of resourcesList) {
      if (average === 0) {
        this.resourceRarities[r] = 'normal';
      } else {
        const count = counts[r];
        const ratio = count / average;
        if (ratio < 0.25) {
          this.resourceRarities[r] = 'exotic';
        } else if (ratio <= 0.50) {
          this.resourceRarities[r] = 'rare';
        } else if (ratio > 1.50) {
          this.resourceRarities[r] = 'common';
        } else {
          this.resourceRarities[r] = 'normal';
        }
      }
      // Base prices should track rarity (common=4, normal=8, rare=12, exotic=16).
      // On a live multiplayer server isRunning is true as soon as the map boots, while
      // homeworlds (and thus rarities) keep changing as players join — so we cannot
      // gate this on !isRunning. Instead, update a resource's base price whenever it
      // is still at the previous rarity's base (or has no prior rarity). Once trades
      // move the price off that base, leave market-driven prices alone.
      if (this.marketPrices) {
        const newRarity = this.resourceRarities[r];
        const oldRarity = previousRarities[r];
        const newBase = rarityToPrice[newRarity];
        const oldBase = oldRarity ? rarityToPrice[oldRarity] : undefined;
        const current = this.marketPrices[r];
        const stillAtTrackedBase = (current === oldBase)
          || (oldBase === undefined && (current === undefined || rarityBases.has(current) || legacyDefaults.has(current)));
        if (forceBasePrices || current === undefined || stillAtTrackedBase) {
          this.marketPrices[r] = newBase;
        }
      }
    }
    console.log(`[Rarities] Recalculated. Average: ${average.toFixed(2)}, Counts:`, counts, `Rarities:`, this.resourceRarities);
  }

  saveState() {
    const state = {
      version: "1.0.0",
      width: this.width,
      height: this.height,
      gameTime: this.gameTime,
      timeRemaining: this.timeRemaining,
      nextShipId: this.nextShipId,
      rampageInterval: this.rampageInterval,
      nextRampageTime: this.nextRampageTime,
      nextRampageSelectionTime: this.nextRampageSelectionTime,
      incubatingPlanetId: this.incubatingPlanet ? this.incubatingPlanet.id : null,
      rampageIncubationTimeRemaining: this.rampageIncubationTimeRemaining,
      settings: this.settings,
      globalUpgradeModifiers: this.globalUpgradeModifiers,
      marketPrices: this.marketPrices,
      bundleValue: this.bundleValue,
      marketFluctuationTimer: this.marketFluctuationTimer,
      resourceRarities: this.resourceRarities,
      exploredGrid: this.exploredGrid,
      gameSpeed: this.gameSpeed || 1.0,
      baseGameSpeed: this.baseGameSpeed || 1.0,
      battlecam: this.battlecam || 0,
      highestSpeedMilestoneTriggered: this.highestSpeedMilestoneTriggered || 0,
      nextIonStormId: this.nextIonStormId,
      ionStormSpawnTimer: this.ionStormSpawnTimer,
      happinessTimer: this.happinessTimer,
      ionStormDamageTimer: this.ionStormDamageTimer,
      minefieldDamageTimer: this.minefieldDamageTimer,
      ionStorms: this.ionStorms.map(storm => ({
        id: storm.id,
        name: storm.name,
        x: storm.x,
        y: storm.y,
        radius: storm.radius,
        intensity: storm.intensity,
        speed: storm.speed,
        heading: storm.heading,
        knowledge: storm.knowledge,
        mines: storm.mines,
        type: storm.type || 'storm'
      })),
      players: this.allPlayers.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isAI: p.isAI,
        techScore: p.techScore,
        expScore: p.expScore,
        expProgress: p.expProgress,
        happinessScore: p.happinessScore,
        lastTechMilestoneTier: p.lastTechMilestoneTier || 0,
        lastExpMilestoneTier: p.lastExpMilestoneTier || 0,
        lastHappinessMilestoneTier: p.lastHappinessMilestoneTier || 0,
        eliminationXpAwarded: !!p.eliminationXpAwarded,
        isEliminated: !!p.isEliminated,
        credits: p.credits,
        tradingBonus: p.tradingBonus,
        useCredits: p.useCredits,
        atWarWith: p.atWarWith ? { ...p.atWarWith } : {},
        builtClasses: p.builtClasses ? { ...p.builtClasses } : {},
        buildCounts: p.buildCounts,
        autoBuyOrders: p.autoBuyOrders,
        clientPlayerId: p.clientPlayerId,
        lastCommandTime: p.lastCommandTime,
        isAFK: p.isAFK,
        afkTimer: p.afkTimer,
        totalCapacity: p.totalCapacity,
        prevTechBonus: p.prevTechBonus,
        cruiserStyle: p.cruiserStyle,
        afkWarningSent: p.afkWarningSent,
        storageFeeAccumulator: p.storageFeeAccumulator,
        tradeOptions: p.tradeOptions,
        tradeRegenAccumulator: p.tradeRegenAccumulator,
        
        upgradeModifiers: p.upgradeModifiers,
        resources: p.resources,
        targetStockpile: p.targetStockpile,
        offerPrice: p.offerPrice,
        buyPrice: p.buyPrice,
        sellToggled: p.sellToggled,
        tradeLimitToggle: p.tradeLimitToggle,
        discoveredPlanets: p.discoveredPlanets ? Array.from(p.discoveredPlanets) : [],
        attackedPlanets: p.attackedPlanets ? Array.from(p.attackedPlanets.entries()) : [],
        spyRootedEvents: p.spyRootedEvents ? Array.from(p.spyRootedEvents) : [],
        lastKnownPlanets: p.lastKnownPlanets || {},
        lastBundleSaleTime: p.lastBundleSaleTime
      })),
      planets: this.planets.map(p => ({
        id: p.id,
        name: p.name,
        isDeepSpaceAnomaly: p.isDeepSpaceAnomaly || false,
        x: p.x,
        y: p.y,
        radius: p.radius,
        sizeClass: p.sizeClass,
        maxShips: p.maxShips,
        sensorarrays: p.sensorarrays,
        labs: p.labs,
        armor: p.armor,
        shields: p.shields,
        engine: p.engine,
        munitions: p.munitions,
        targeting: p.targeting,
        damagecontrol: p.damagecontrol,
        supply_ship: p.supply_ship,
        extended_fuel: p.extended_fuel,
        diplomat: p.diplomat,
        marines: p.marines,
        command: p.command,
        supplies: p.supplies,
        ships: p.ships,
        ownerId: p.owner ? p.owner.id : null,
        focusMode: p.focusMode,
        habitability: p.habitability,
        isResearch: p.isResearch,
        isMilitary: p.isMilitary,
        isSpeedPlanet: p.isSpeedPlanet,
        isSuperPlanet: p.isSuperPlanet,
        isCapitalShipyard: p.isCapitalShipyard,
        preferredResource: p.preferredResource,
        resources: p.resources,
        sympathy: p.sympathy,
        garrisonFocusTriggered: p.garrisonFocusTriggered,
        retainedShips: p.retainedShips,
        garrisonMaxShipsDouble: p.garrisonMaxShipsDouble,
        hasCapitalShipyard: p.hasCapitalShipyard,
        capitalShipProgress: p.capitalShipProgress,
        dead: p.dead,
        homeworldOf: p.homeworldOf,
        racialAffinity: p.racialAffinity,
        inRevolt: p.inRevolt,
        revoltTimer: p.revoltTimer,
        revoltCompetitors: p.revoltCompetitors,
        revoltWarmup: p.revoltWarmup,
        revoltWarmupMax: p.revoltWarmupMax,
        diplomacyWarmupTimer: p.diplomacyWarmupTimer,
        activeDiplomatId: p.activeDiplomatId,
        revoltShipsToDestroy: p.revoltShipsToDestroy,
        revoltShipsDestroyedSoFar: p.revoltShipsDestroyedSoFar,

        disposition: p.disposition,
        dispositionTimers: p.dispositionTimers,
        expScore: p.expScore,
        expProgress: p.expProgress,
        sacrificedShips: p.sacrificedShips,
        focusChanges: p.focusChanges,
        preferredResourceWantedEvent: p.preferredResourceWantedEvent,
        anomaly: p.anomaly ? {
          id: p.anomaly.id,
          x: p.anomaly.x,
          y: p.anomaly.y,
          radius: p.anomaly.radius,
          type: p.anomaly.type || 'anomaly',
          beingResearched: p.anomaly.beingResearched || false,
          difficulty: p.anomaly.difficulty || 0,
          initialDifficulty: p.anomaly.initialDifficulty || 0,
          progress: p.anomaly.progress || {},
          completing: p.anomaly.completing || false,
          completingTimeLeft: p.anomaly.completingTimeLeft || 0,
          completingShipId: p.anomaly.completingShipId || null,
          completingPlayerId: p.anomaly.completingPlayerId || null,
          researchingShipId: p.anomaly.researchingShipId || null,
          researchingShipIds: p.anomaly.researchingShipIds || [],
          rewardType: p.anomaly.rewardType,
          researched: p.anomaly.researched || false
        } : null
      })),
      ships: this.ships.map(s => {
        const sData = {};
        for (const [k, v] of Object.entries(s)) {
          if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Planet') {
            sData[`${k}Id`] = v.id;
          } else if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'Player') {
            sData[`${k}Id`] = v.id;
          } else if (k === 'insideHazards') {
            sData.insideHazards = v ? Array.from(v) : [];
          } else if (typeof v !== 'function') {
            sData[k] = v;
          }
        }
        return sData;
      }),
      wreckages: this.wreckages.map(w => ({
        id: w.id,
        x: w.x,
        y: w.y,
        amoebaDamage: w.amoebaDamage,
        cruiserDamage: w.cruiserDamage,
        lastFightingTime: w.lastFightingTime,
        beingScanned: w.beingScanned,
        scanningShipId: w.scanningShipId,
        scanningPlayerId: w.scanningPlayerId,
      })),
      chunks: []
    };
    return state;
  }

  loadState(state) {
    this.width = state.width;
    this.height = state.height;
    this.gameTime = state.gameTime;
    this.timeRemaining = state.timeRemaining;
    this.nextShipId = state.nextShipId;
    this.rampageInterval = state.rampageInterval;
    this.nextRampageTime = state.nextRampageTime;
    this.nextRampageSelectionTime = state.nextRampageSelectionTime;
    this.rampageIncubationTimeRemaining = state.rampageIncubationTimeRemaining;
    this.settings = state.settings;
    this.globalUpgradeModifiers = state.globalUpgradeModifiers;
    this.marketPrices = state.marketPrices || {
      dilithium: 8, merculite: 8, duranium: 8, tritanium: 8,
      antimatter: 8, deuterium: 8, latinum: 8
    };
    this.bundleValue = state.bundleValue || 200;
    this.marketFluctuationTimer = state.marketFluctuationTimer || 0;
    this.resourceRarities = state.resourceRarities || {
      dilithium: 'normal', merculite: 'normal', duranium: 'normal', tritanium: 'normal',
      antimatter: 'normal', deuterium: 'normal', latinum: 'normal'
    };
    this._needsMarketRarityResync = !state.resourceRarities;
    this.exploredGrid = state.exploredGrid;
    this.baseGameSpeed = state.baseGameSpeed !== undefined ? state.baseGameSpeed : (state.gameSpeed !== undefined ? state.gameSpeed : 1.0);
    this.gameSpeed = state.gameSpeed !== undefined ? state.gameSpeed : 1.0;
    this.battlecam = state.battlecam !== undefined ? state.battlecam : 0;
    this.highestSpeedMilestoneTriggered = state.highestSpeedMilestoneTriggered !== undefined ? state.highestSpeedMilestoneTriggered : 0;
    this.nextIonStormId = state.nextIonStormId !== undefined ? state.nextIonStormId : 0;
    this.ionStormSpawnTimer = state.ionStormSpawnTimer !== undefined ? state.ionStormSpawnTimer : 0;
    this.ionStormDamageTimer = state.ionStormDamageTimer !== undefined ? state.ionStormDamageTimer : 0;
    this.minefieldDamageTimer = state.minefieldDamageTimer !== undefined ? state.minefieldDamageTimer : 0;
    this.happinessTimer = state.happinessTimer !== undefined ? state.happinessTimer : 0;

    // Restore players
    const playersMap = new Map();
    this.allPlayers = state.players.map(pData => {
      const p = new Player(pData.id, pData.color, pData.isAI);
      p.name = pData.name;
      p.techScore = pData.techScore;
      p.expScore = pData.expScore;
      p.expProgress = pData.expProgress;
      p.happinessScore = pData.happinessScore !== undefined ? pData.happinessScore : 0;
      // Don't re-announce milestones already earned before the load
      p.lastTechMilestoneTier = pData.lastTechMilestoneTier !== undefined
        ? pData.lastTechMilestoneTier
        : Math.floor(Math.sqrt(p.techScore || 0) / 3);
      p.lastExpMilestoneTier = pData.lastExpMilestoneTier !== undefined
        ? pData.lastExpMilestoneTier
        : Math.floor(Math.sqrt(p.expScore || 0) / 3);
      p.lastHappinessMilestoneTier = pData.lastHappinessMilestoneTier !== undefined
        ? pData.lastHappinessMilestoneTier
        : Math.floor(Math.sqrt(p.happinessScore || 0) / 3);
      p.eliminationXpAwarded = !!pData.eliminationXpAwarded;
      p.isEliminated = !!pData.isEliminated;
      p.credits = pData.credits;
      p.tradingBonus = pData.tradingBonus;
      p.useCredits = pData.useCredits;
      p.atWarWith = pData.atWarWith || {};
      p.builtClasses = pData.builtClasses || {};
      p.buildCounts = pData.buildCounts || p.buildCounts;
      p.clientPlayerId = pData.clientPlayerId;
      p.lastCommandTime = pData.lastCommandTime;
      p.isAFK = pData.isAFK;
      p.afkTimer = pData.afkTimer;
      p.totalCapacity = pData.totalCapacity;
      p.prevTechBonus = pData.prevTechBonus;
      p.cruiserStyle = pData.cruiserStyle;
      p.afkWarningSent = pData.afkWarningSent;
      p.storageFeeAccumulator = pData.storageFeeAccumulator;
      p.tradeOptions = pData.tradeOptions;
      p.tradeRegenAccumulator = pData.tradeRegenAccumulator;

      p.upgradeModifiers = pData.upgradeModifiers || p.upgradeModifiers;
      p.resources = pData.resources || p.resources;
      p.targetStockpile = pData.targetStockpile || p.targetStockpile;
      p.offerPrice = pData.offerPrice || p.offerPrice;
      p.buyPrice = pData.buyPrice || p.buyPrice;
      p.sellToggled = pData.sellToggled || p.sellToggled;
      p.tradeLimitToggle = pData.tradeLimitToggle !== undefined ? pData.tradeLimitToggle : p.tradeLimitToggle;
      p.discoveredPlanets = new Set(pData.discoveredPlanets || []);
      p.attackedPlanets = new Map(pData.attackedPlanets || []);
      p.spyRootedEvents = new Set(pData.spyRootedEvents || []);
      p.lastKnownPlanets = pData.lastKnownPlanets || {};
      p.lastBundleSaleTime = pData.lastBundleSaleTime !== undefined ? pData.lastBundleSaleTime : null;

      if (p.id === 'p1') this.humanPlayer = p;
      if (p.id === 'monsters') this.monsterPlayer = p;

      playersMap.set(p.id, p);
      return p;
    });
    this.aiPlayers = this.allPlayers.filter(p => p.isAI && p.id !== 'monsters');

    // Restore planets
    const planetsMap = new Map();
    this.planets = state.planets.map(pData => {
      const owner = pData.ownerId ? playersMap.get(pData.ownerId) : null;
      const p = new Planet(pData.id, pData.x, pData.y, pData.radius, owner, pData.ships, this.width, this.height);
      
      if (pData.name) {
        p.name = pData.name;
      }
      p.isDeepSpaceAnomaly = pData.isDeepSpaceAnomaly || false;
      p.sizeClass = pData.sizeClass;
      p.maxShips = pData.maxShips;
      p.supplies = Math.min(p.maxShips, pData.supplies !== undefined ? pData.supplies : (Math.random() * p.maxShips));
      p.focusMode = pData.focusMode;
      p.habitability = pData.habitability;
      p.isResearch = pData.isResearch;
      p.isMilitary = pData.isMilitary;
      p.isSpeedPlanet = pData.isSpeedPlanet;
      p.isSuperPlanet = pData.isSuperPlanet;
      p.radius = pData.radius; // Restore the radius because the constructor overwrote it!
      p.isCapitalShipyard = pData.isCapitalShipyard;
      p.preferredResource = pData.preferredResource;
      p.resources = pData.resources || [];
      p.sympathy = pData.sympathy || {};
      p.garrisonFocusTriggered = pData.garrisonFocusTriggered;
      p.retainedShips = pData.retainedShips;
      p.garrisonMaxShipsDouble = pData.garrisonMaxShipsDouble;
      p.hasCapitalShipyard = pData.hasCapitalShipyard;
      p.capitalShipProgress = pData.capitalShipProgress;
      p.dead = pData.dead;
      p.homeworldOf = pData.homeworldOf;
      p.racialAffinity = pData.racialAffinity;
      p.inRevolt = pData.inRevolt;
      p.revoltTimer = pData.revoltTimer;
      p.revoltCompetitors = pData.revoltCompetitors || {};
      p.revoltWarmup = pData.revoltWarmup || 0;
      p.revoltWarmupMax = pData.revoltWarmupMax || 1;
      p.diplomacyWarmupTimer = pData.diplomacyWarmupTimer || 0;
      p.activeDiplomatId = pData.activeDiplomatId || null;
      p.revoltShipsToDestroy = pData.revoltShipsToDestroy || 0;
      p.revoltShipsDestroyedSoFar = pData.revoltShipsDestroyedSoFar || 0;

      p.disposition = pData.disposition || {};
      p.dispositionTimers = pData.dispositionTimers || {};
      p.expScore = pData.expScore !== undefined ? pData.expScore : 0;
      p.expProgress = pData.expProgress !== undefined ? pData.expProgress : 0;
      p.sacrificedShips = pData.sacrificedShips !== undefined ? pData.sacrificedShips : 0;
      p.focusChanges = pData.focusChanges !== undefined ? pData.focusChanges : 0;
      p.productionProgress = pData.productionProgress !== undefined ? pData.productionProgress : 0;
      p.capacityProgress = pData.capacityProgress !== undefined ? pData.capacityProgress : 0;
      p.preferredResourceWantedEvent = pData.preferredResourceWantedEvent !== undefined ? pData.preferredResourceWantedEvent : false;
      p.anomaly = pData.anomaly ? {
        id: pData.anomaly.id || Math.random().toString(36).substr(2, 9),
        x: pData.anomaly.x,
        y: pData.anomaly.y,
        radius: pData.anomaly.radius,
        type: pData.anomaly.type || 'anomaly',
        beingResearched: pData.anomaly.beingResearched || false,
        difficulty: pData.anomaly.difficulty || 0,
        initialDifficulty: pData.anomaly.initialDifficulty || 0,
        progress: pData.anomaly.progress || {},
        completing: pData.anomaly.completing || false,
        completingTimeLeft: pData.anomaly.completingTimeLeft || 0,
        completingShipId: pData.anomaly.completingShipId || null,
        completingPlayerId: pData.anomaly.completingPlayerId || null,
        researchingShipId: pData.anomaly.researchingShipId || null,
        researchingShipIds: pData.anomaly.researchingShipIds || [],
        rewardType: pData.anomaly.rewardType,
        researched: pData.anomaly.researched || false
      } : null;

      planetsMap.set(p.id, p);
      return p;
    });

    this.incubatingPlanet = state.incubatingPlanetId ? planetsMap.get(state.incubatingPlanetId) : null;

    // Restore ships
    this.ships = new SpatialGridArray();
    this.usedShipNames = new Set();
    if (state.ships) {
      for (const sData of state.ships) {
        const owner = sData.ownerId ? playersMap.get(sData.ownerId) : null;
        const targetPlanet = sData.targetPlanetId ? planetsMap.get(sData.targetPlanetId) : null;
        const s = new Ship(sData.id, sData.x, sData.y, targetPlanet, owner, sData.targetX, sData.targetY);

        for (const [k, v] of Object.entries(sData)) {
          if (k !== 'targetPlanetId' && k !== 'ownerId' && k !== 'boardingPlayerId' && k !== 'sourcePlanetId') {
            if (k === 'insideHazards') {
              if (Array.isArray(v)) {
                s.insideHazards = new Set(v);
              } else if (v && typeof v === 'object') {
                s.insideHazards = new Set(Object.keys(v));
              } else {
                s.insideHazards = new Set();
              }
            } else if (k.endsWith('PlanetId') && k !== 'planetBombardTimer') {
              const propName = k.slice(0, -2);
              s[propName] = planetsMap.get(v) || null;
              s[k] = v;
            } else if (k.endsWith('PlayerId')) {
              const propName = k.slice(0, -2);
              s[propName] = playersMap.get(v) || null;
              s[k] = v;
            } else {
              s[k] = v;
            }
          }
        }
        s.owner = owner;
        s.targetPlanet = targetPlanet;
        if (sData.sourcePlanetId) {
          s.sourcePlanet = planetsMap.get(sData.sourcePlanetId) || null;
        }
        if (sData.boardingPlayerId) {
          s.boardingPlayer = playersMap.get(sData.boardingPlayerId) || null;
        }
        if (s.name) {
          this.usedShipNames.add(s.name);
        }
        this.ships.push(s);
      }
    }
    this.ships.updateGrid();

    // Rebuild active AI controllers list
    this.aiControllers = this.allPlayers
      .filter(p => p !== this.monsterPlayer && p.isAI)
      .map(p => new AIController(this, p));

    // Restore ion storms
    this.ionStorms = [];
    if (state.ionStorms) {
      for (const stormData of state.ionStorms) {
        this.ionStorms.push({
          id: stormData.id,
          name: stormData.name,
          x: stormData.x,
          y: stormData.y,
          radius: stormData.radius,
          intensity: stormData.intensity,
          speed: stormData.speed,
          heading: stormData.heading,
          knowledge: stormData.knowledge || {},
          mines: stormData.mines || 0,
          type: stormData.type || 'storm'
        });
      }
    }

    // Clear lasers and explosions
    this.lasers.clear();
    this.explosions.clear();

    // Restore wreckages and chunks
    this.wreckages = [];
    if (state.wreckages) {
      for (const wData of state.wreckages) {
        this.wreckages.push({
          id: wData.id,
          x: wData.x,
          y: wData.y,
          amoebaDamage: wData.amoebaDamage,
          cruiserDamage: wData.cruiserDamage,
          lastFightingTime: wData.lastFightingTime,
          beingScanned: wData.beingScanned || false,
          scanningShipId: wData.scanningShipId || null,
          scanningPlayerId: wData.scanningPlayerId || null,
          scanTimeLeft: wData.scanTimeLeft || 0
        });
      }
    }
    this.chunks = [];

    // Old saves without resourceRarities: recompute and force base prices to match
    if (this._needsMarketRarityResync) {
      this._needsMarketRarityResync = false;
      this.recalculateResourceRarities({ forceBasePrices: true });
    }
  }

  initMap() {
    this.planets = [];
    this.planetGrid = new PlanetGrid();
    this.planetGridPopulated = false;
    this.ships = new SpatialGridArray();
    this.explosions.clear();
    this.lasers.clear();
    this.ionStorms = [];

    this.fulfillOrders = [];
    this.boardingReplays = [];
    this.exploredGrid = {};
    this.wreckages = [];
    this.pendingPioneerSpawns = [];
    if (this.usedShipNames) this.usedShipNames.clear();
    this.marketSalesHistory = [];
    // Fresh map = fresh market. Without this, restart keeps traded prices from the
    // previous game while rarities recompute, so prices no longer match rarities.
    this.resourceRarities = {};
    this.marketPrices = {
      dilithium: 8, merculite: 8, duranium: 8, tritanium: 8,
      antimatter: 8, deuterium: 8, latinum: 8
    };
    this.bundleValue = 200;
    this.marketFluctuationTimer = 0;
    this.highestSpeedMilestoneTriggered = 0;
    this.ionStormSpawnTimer = 0;
    this.ionStormDamageTimer = 0;
    this.minefieldDamageTimer = 0;
    this.ionStormsCreated = 0;
    this.nextShipId = Math.max(this.nextShipId || 1000000, 1000000);
    this.gameTime = 0;
    this.timeRemaining = null;
    let rampageDelayMultiple = 1.0;
    if (this.width < 1600) {
      rampageDelayMultiple = 1600 / this.width;
    }
    this.rampageInterval = Math.round(1800000 * rampageDelayMultiple);
    
    let rampageDelayAddMs = 0;
    if (this.settings) {
      const aiEntry = this.settings.aiEntry || 'mid';
      if (aiEntry === 'start') {
        rampageDelayAddMs = 0;
      } else if (aiEntry === 'early') {
        rampageDelayAddMs = 10 * 60 * 1000;
      } else if (aiEntry === 'mid') {
        rampageDelayAddMs = 20 * 60 * 1000;
      } else if (aiEntry === 'late') {
        rampageDelayAddMs = 30 * 60 * 1000;
      } else if (aiEntry === 'custom') {
        const customMin = this.settings.customAiEntryMin !== undefined ? parseFloat(this.settings.customAiEntryMin) : 5;
        const customDelayMin = (isNaN(customMin) ? 5 : customMin) / 4;
        rampageDelayAddMs = customDelayMin * 60 * 1000;
      }
    }
    
    this.nextRampageTime = this.rampageInterval + rampageDelayAddMs;
    this.nextRampageSelectionTime = Math.max(0, this.nextRampageTime - 180000);
    this.incubatingPlanet = null;
    this.rampageIncubationTimeRemaining = 0;
    this.scheduledAttacks = [];
    
    // Reset player states
    for (const player of this.allPlayers) {
      player.isAlive = false;
      player.wasAlive = false;
      player.isEliminated = false;
      player.eliminationXpAwarded = false;
      player.lastAttackerPlayerId = null;
      player.hasOwnedPlanet = false;
      player.aiPhantomShipBank = 0;
      player.aiPhantomBuyTimer = 0;
      player.discoveredPlanets = new Set();
      player.attackedPlanets = new Map();
      player.spyRootedEvents = new Set();
      player.disconnectTime = null;
      
      player.techScore = 0;
      player.expScore = 0;
      player.expProgress = 0;
      player.happinessScore = 0;
      player.lastTechMilestoneTier = 0;
      player.lastExpMilestoneTier = 0;
      player.lastHappinessMilestoneTier = 0;
      player.cruiserStyle = null;
      player.prevTechBonus = 0;
      player.tradeLimitToggle = true;
      player.credits = this.settings && this.settings.startingCredits !== undefined ? this.settings.startingCredits : 0;
      player.tradingBonus = 0;
      player.useCredits = true;
      player.atWarWith = {};
      player.builtClasses = {};
      player.buildCounts = {
        corvette: 0,
        destroyer: 0,
        battlecruiser: 0,
        titan: 0,
        mammoth: 0
      };
      const getRandDiscount = () => Math.round((-0.10 + Math.random() * 0.20) * 100) / 100;
      player.upgradeModifiers = {
        sensorarray: getRandDiscount(),
        lab: getRandDiscount(),
        armor: getRandDiscount(),
        shield: getRandDiscount(),
        engine: getRandDiscount(),
        munitions: getRandDiscount(),
        targeting: getRandDiscount(),
        damagecontrol: getRandDiscount(),
        supplyship: getRandDiscount(),
        extendedfuel: getRandDiscount(),
        diplomat: getRandDiscount(),
        marines: getRandDiscount(),
        command: getRandDiscount()
      };
      player.resources = {
        dilithium: 0,
        merculite: 0,
        duranium: 0,
        tritanium: 0,
        antimatter: 0,
        deuterium: 0,
        latinum: 0
      };
      player.targetStockpile = {
        dilithium: 0,
        merculite: 0,
        duranium: 0,
        tritanium: 0,
        antimatter: 0,
        deuterium: 0,
        latinum: 0
      };
      player.offerPrice = {
        dilithium: 3,
        merculite: 3,
        duranium: 3,
        tritanium: 3,
        antimatter: 3,
        deuterium: 3,
        latinum: 3
      };
      player.buyPrice = {
        dilithium: 2,
        merculite: 2,
        duranium: 2,
        tritanium: 2,
        antimatter: 2,
        deuterium: 2,
        latinum: 2
      };
      player.sellToggled = {
        dilithium: false,
        merculite: false,
        duranium: false,
        tritanium: false,
        antimatter: false,
        deuterium: false,
        latinum: false
      };
      player.tradeCapacity = 5;
      player.tradeOptions = undefined;
      player.tradeRegenAccumulator = 0;
      player.sellPriceSetting = 1;
      player.discoveredPlanets = new Set();
      player.attackedPlanets = new Map();
      player.lastKnownPlanets = {};
      player.spyRootedEvents = new Set();
      player.lastBundleSaleTime = null;
      const resources = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      player.autoBuyOrders = resources.map(res => ({
        id: "autobuy_" + Math.random().toString(36).substring(2, 9),
        isAutoBuy: true,
        ownerId: player.id,
        ownerName: player.name,
        resource: res,
        price: 1
      }));
    }

    // Reset global upgrade modifiers
    const getRandDiscount = () => Math.round((-0.35 + Math.random() * 0.45) * 100) / 100;
    this.globalUpgradeModifiers = {
      sensorarray: getRandDiscount(),
      lab: getRandDiscount(),
      armor: getRandDiscount(),
      shield: getRandDiscount(),
      engine: getRandDiscount(),
      munitions: getRandDiscount(),
      targeting: getRandDiscount(),
      damagecontrol: getRandDiscount(),
      supplyship: getRandDiscount(),
      extendedfuel: getRandDiscount(),
      diplomat: getRandDiscount(),
      marines: getRandDiscount(),
      command: getRandDiscount()
    };
    
    const width = this.width;
    const height = this.height;
    
    // Create random planets
    const numPlanets = this.settings && this.settings.planetCount ? this.settings.planetCount : 100;
    
    let countMegaSuper = width >= 3000 ? 1 : 0;
    let countSuper = width >= 3000 ? 3 : 1;
    let countLarge = Math.round(numPlanets * 0.05);
    let countMedium = Math.round(numPlanets * 0.15);
    let countSmall = Math.round(numPlanets * 0.6667);
    let countTiny = numPlanets - (countMegaSuper + countSuper + countLarge + countMedium + countSmall);
    
    // Ensure at least some planets exist if math goes wonky with very small numbers
    if (countTiny < 0) { countSmall += countTiny; countTiny = 0; }
    if (countSmall < 0) { countMedium += countSmall; countSmall = 0; }

    // Build size-class queues, then interleave so we don't place all supers (etc.) first.
    // Mega-super and super share one queue for turn-taking; megas are still generated first within that queue.
    const pushSpec = (queue, generatedMaxShips, isSuperPlanet) => {
      queue.push({
        maxShips: generatedMaxShips,
        radius: generatedMaxShips / 4,
        isSuperPlanet: !!isSuperPlanet
      });
    };
    const queues = { super: [], large: [], medium: [], small: [], tiny: [] };
    for (let i = 0; i < countMegaSuper; i++) {
      pushSpec(queues.super, 260, true);
    }
    for (let i = 0; i < countSuper; i++) {
      const generatedMaxShips = width < 1600
        ? (160 + Math.floor(Math.random() * 21))
        : 210;
      pushSpec(queues.super, generatedMaxShips, true);
    }
    for (let i = 0; i < countLarge; i++) {
      pushSpec(queues.large, 110 + Math.floor(Math.random() * 31), false);
    }
    for (let i = 0; i < countMedium; i++) {
      pushSpec(queues.medium, 80 + Math.floor(Math.random() * 31), false);
    }
    for (let i = 0; i < countSmall; i++) {
      pushSpec(queues.small, 35 + Math.floor(Math.random() * 41), false);
    }
    for (let i = 0; i < countTiny; i++) {
      pushSpec(queues.tiny, 13 + Math.floor(Math.random() * 22), false);
    }

    const classOrder = ['super', 'large', 'medium', 'small', 'tiny'];
    const planetSpecs = [];
    let nextId = 0;
    while (classOrder.some(cls => queues[cls].length > 0)) {
      for (const cls of classOrder) {
        if (queues[cls].length === 0) continue;
        const spec = queues[cls].shift();
        spec.id = nextId++;
        planetSpecs.push(spec);
      }
    }

    const createPlanetFromSpec = (spec, px, py) => {
      const maxShips = spec.maxShips;
      const expectedPercentage = maxShips / 100;
      let expectedShips = maxShips * expectedPercentage;
      let variance = maxShips * 0.4;

      if (maxShips > 150) {
        expectedShips *= 2;
        variance = expectedShips * 0.15;
      }

      let initialShips = Math.floor(expectedShips + (Math.random() * 2 - 1) * variance);
      initialShips = Math.max(1, initialShips);
      const newPlanet = new Planet(spec.id, px, py, spec.radius, null, initialShips, this.width, this.height);
      if (spec.isSuperPlanet) {
        newPlanet.isSuperPlanet = true;
        newPlanet.sizeClass = 200;
        newPlanet.habitability = 150;
        newPlanet.maxShips = spec.maxShips;
        newPlanet.supplies = Math.random() * newPlanet.maxShips;
        newPlanet.radius = newPlanet.sizeClass / 4;
      }
      return newPlanet;
    };

    const isClustersOff = !this.settings || !this.settings.clusters || this.settings.clusters === 0;

    if (isClustersOff) {
      // Specs already interleaved by size class (super/large/medium/small/tiny).
      let currentIndex = 0;
      while (currentIndex < planetSpecs.length) {
        const spec = planetSpecs[currentIndex];
        let x, y;
        
        // Find 3 possible locations, pick the one furthest from other worlds
        let bestPos = null;
        let maxMinDist = -1;
        
        for (let c = 0; c < 3; c++) {
          let candX, candY;
          let candValid = false;
          let candAttempts = 0;
          while (!candValid && candAttempts < 100) {
            candX = spec.radius + Math.random() * (width - spec.radius * 2);
            candY = spec.radius + Math.random() * (height - spec.radius * 2);
            candValid = true;
            
            const minDistPadding = (this.settings && this.settings.graphicalMode) ? 40 : 25;
            for (const p of this.planets) {
              const dx = p.x - candX;
              const dy = p.y - candY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < p.radius + spec.radius + minDistPadding) {
                candValid = false;
                break;
              }
            }
            candAttempts++;
          }
          
          if (candValid) {
            let minDist = Infinity;
            if (this.planets.length === 0) {
              minDist = 999999;
            } else {
              for (const p of this.planets) {
                const dx = p.x - candX;
                const dy = p.y - candY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) {
                  minDist = dist;
                }
              }
            }
            
            if (minDist > maxMinDist) {
              maxMinDist = minDist;
              bestPos = { x: candX, y: candY };
            }
          }
        }
        
        // Fallback to random if 3 candidates search failed
        if (!bestPos) {
          let valid = false;
          let attempts = 0;
          while (!valid && attempts < 100) {
            x = spec.radius + Math.random() * (width - spec.radius * 2);
            y = spec.radius + Math.random() * (height - spec.radius * 2);
            valid = true;
            
            const minDistPadding = (this.settings && this.settings.graphicalMode) ? 40 : 25;
            for (const p of this.planets) {
              const dx = p.x - x;
              const dy = p.y - y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < p.radius + spec.radius + minDistPadding) {
                valid = false;
                break;
              }
            }
            attempts++;
          }
          if (valid) {
            bestPos = { x, y };
          }
        }
        
        if (bestPos) {
          x = bestPos.x;
          y = bestPos.y;
          
          const newPlanet = createPlanetFromSpec(spec, x, y);
          this.addPlanet(newPlanet);
          currentIndex++;
          
          // Try to place up to 3 more planets nearby in little groups (1 to 4 total)
          let prevX = x;
          let prevY = y;
          let prevRadius = spec.radius;
          const groupChances = [0.60, 0.40, 0.20];
          
          for (let g = 0; g < groupChances.length; g++) {
            if (currentIndex >= planetSpecs.length) break;
            
            if (Math.random() < groupChances[g]) {
              const nextSpec = planetSpecs[currentIndex];
              
              let nearbyValid = false;
              let nearbyAttempts = 0;
              let nearbyX, nearbyY;
              while (!nearbyValid && nearbyAttempts < 100) {
                const gap = 30 + Math.random() * 80;
                const D = prevRadius + nextSpec.radius + gap;
                const angle = Math.random() * Math.PI * 2;
                nearbyX = prevX + Math.cos(angle) * D;
                nearbyY = prevY + Math.sin(angle) * D;
                
                if (nearbyX >= nextSpec.radius && nearbyX <= width - nextSpec.radius &&
                    nearbyY >= nextSpec.radius && nearbyY <= height - nextSpec.radius) {
                  
                  nearbyValid = true;
                  const minDistPadding = (this.settings && this.settings.graphicalMode) ? 40 : 25;
                  for (const p of this.planets) {
                    const dx = p.x - nearbyX;
                    const dy = p.y - nearbyY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < p.radius + nextSpec.radius + minDistPadding) {
                      nearbyValid = false;
                      break;
                    }
                  }
                }
                nearbyAttempts++;
              }
              
              if (nearbyValid) {
                const nearbyPlanet = createPlanetFromSpec(nextSpec, nearbyX, nearbyY);
                this.addPlanet(nearbyPlanet);
                currentIndex++;
                
                prevX = nearbyX;
                prevY = nearbyY;
                prevRadius = nextSpec.radius;
              } else {
                break;
              }
            } else {
              break;
            }
          }
        } else {
          // Skip if unable to find space
          currentIndex++;
        }
      }
    } else {
      // Clusters ON: independent random placement, but still use interleaved size-class order
      for (let i = 0; i < planetSpecs.length; i++) {
        const spec = planetSpecs[i];
        let x, y;
        let valid = false;
        let attempts = 0;

        while (!valid && attempts < 100) {
          x = spec.radius + Math.random() * (width - spec.radius * 2);
          y = spec.radius + Math.random() * (height - spec.radius * 2);
          valid = true;
          const minDistPadding = 50;
          for (const p of this.planets) {
            const dx = p.x - x;
            const dy = p.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < p.radius + spec.radius + minDistPadding) {
              valid = false;
              break;
            }
          }
          attempts++;
        }

        if (valid) {
          this.addPlanet(createPlanetFromSpec(spec, x, y));
        }
      }
    }
    
    // Scatter random unique upgrades to 1/10 of neutral planets
    const availableUpgrades = ['sensorarrays', 'labs', 'armor', 'shields', 'engine', 'munitions', 'targeting', 'damagecontrol', 'supply_ship', 'extended_fuel', 'diplomat', 'marines', 'command'];
    const numToUpgrade = Math.min(availableUpgrades.length, Math.floor(this.planets.length / 10));
    const shuffledPlanets = [...this.planets].sort(() => 0.5 - Math.random());
    const shuffledUpgrades = [...availableUpgrades].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < numToUpgrade; i++) {
      const p = shuffledPlanets[i];
      const upgrade = shuffledUpgrades[i];
      p[upgrade] = 1;
    }
    
    // Clear discovered/attacked planets for all players
    for (const player of this.allPlayers) {
      player.discoveredPlanets = new Set();
      player.attackedPlanets = new Map();
      player.spyRootedEvents = new Set();
      player.lastBundleSaleTime = null;
      if (!player.isAI) {
        player.needsPlanet = true;
      }
    }
    const availableAIs = this.aiPlayers.filter(p => p.isAI);
    
    // Calculate how many AIs needed to reach 12 core players
    const defaultAiCount = this.settings && this.settings.aiCount !== undefined ? this.settings.aiCount : 8;
    const aiCountToSpawn = Math.max(0, defaultAiCount);
    this.pendingAIs = availableAIs.slice(0, aiCountToSpawn);
    
    if (Math.random() < 0.5) {
      this.assignPlanet(this.monsterPlayer);
      const monsterHomeworld = this.planets.find(p => p.owner && p.owner.id === this.monsterPlayer.id);
      if (monsterHomeworld) {
         monsterHomeworld.name = "Amoeba Hive";
         monsterHomeworld.isAmoebaHive = true;
         monsterHomeworld.ships = 50;
         monsterHomeworld.amoebaSpawnTimer = 0;
      }
    }
    
    
    this.aiSpawnTimer = 0;
    this.aiSpawnInterval = this.pendingAIs.length > 0 ? 240000 / this.pendingAIs.length : 0;
    
    const startPlanets = [];

    const hazardScale = this.width / 1600;
    
    // Create Amoebas
    const numAmoebas = Math.max(1, Math.floor(numPlanets / 10));
    for (let i = 0; i < numAmoebas; i++) {
      const amoeba = new Ship(this.nextShipId++, Math.random() * this.width, Math.random() * this.height, null, this.monsterPlayer, Math.random() * this.width, Math.random() * this.height);
      amoeba.isAmoeba = true;
      let speed = 0;
      for (let d = 0; d < 4; d++) speed += Math.floor(Math.random() * 6) + 1;
      amoeba.speed = speed;
      const initialHealth = (Math.floor(Math.random()*2)+1) + (Math.floor(Math.random()*2)+1) + (Math.floor(Math.random()*2)+1) + 1;
        amoeba.maxHealth = initialHealth;
        amoeba.health = initialHealth;
      this.ships.push(amoeba);
    }

    // Create Ancient Minefields
    const hazardNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Theta', 'Iota'];
    const numMinefields = Math.max(3, Math.round((1 + Math.random() * 2) * hazardScale));
    for (let m = 0; m < numMinefields; m++) {
      const mRadius = ((50 + Math.random() * 350) * 0.75) * (hazardScale > 1 ? Math.sqrt(hazardScale) : hazardScale); // 25% smaller
      this.ionStorms.push({
        id: this.nextIonStormId++,
        name: 'Ancient Minefield',
        type: 'minefield',
        x: mRadius + Math.random() * (this.width - mRadius * 2),
        y: mRadius + Math.random() * (this.height - mRadius * 2),
        radius: mRadius,
        initialRadius: mRadius,
        mines: Math.round(mRadius * 2),
        initialMines: Math.round(mRadius * 2),
        intensity: (() => { let v = 0; for(let d=0; d<12; d++) v += Math.floor(Math.random()*6)+1; return v; })(),
        speed: 0,
        heading: 0,
        knowledge: {}
      });
    }

    // Create Nebulae
    const numNebulae = Math.round((Math.random() * 2) * hazardScale);
    for (let n = 0; n < numNebulae; n++) {
      const nRadius = ((50 + Math.random() * 350) * 1.3) * (hazardScale > 1 ? Math.sqrt(hazardScale) : hazardScale); // 30% larger
      this.ionStorms.push({
        id: this.nextIonStormId++,
        name: hazardNames[Math.floor(Math.random() * hazardNames.length)],
        type: 'nebula',
        x: nRadius + Math.random() * (this.width - nRadius * 2),
        y: nRadius + Math.random() * (this.height - nRadius * 2),
        radius: nRadius,
        intensity: (() => { let v = 0; for(let d=0; d<5; d++) v += Math.floor(Math.random()*12)+1; return v; })(),
        speed: 0,
        heading: 0,
        knowledge: {}
      });
    }

    // Create Beginning Ion Storms
    let maxStorms = 3;
    if (this.width < 1600) maxStorms = 2;
    else if (this.width > 1600) maxStorms = 4;

    const numStorms = Math.min(maxStorms, Math.round((Math.random() * 1) * hazardScale));
    const stormNames = ['Aether', 'Boreas', 'Zephyr', 'Typhon', 'Eurus', 'Notus', 'Tempest', 'Vortex', 'Maelstrom', 'Cyclone', 'Gale', 'Squall', 'Fury', 'Wrath', 'Havoc', 'Chaos', 'Surge', 'Pulse', 'Flux', 'Rift'];
    for (let s = 0; s < numStorms; s++) {
      const radius = (50 + Math.random() * 350) * (hazardScale > 1 ? Math.sqrt(hazardScale) : hazardScale);
      this.ionStorms.push({
        id: this.nextIonStormId++,
        name: stormNames[Math.floor(Math.random() * stormNames.length)],
        type: 'storm',
        x: radius + Math.random() * (this.width - radius * 2),
        y: radius + Math.random() * (this.height - radius * 2),
        radius: radius,
        intensity: (() => { let v = 0; for (let d = 0; d < 10; d++) v += Math.floor(Math.random() * 6) + 1; return Math.min(v, 10 * (this.ionStormsCreated + 1)); })(),
        speed: 1 + Math.random() * 9,
        heading: Math.random() * 360,
        knowledge: {}
      });
      this.ionStormsCreated++;
    }

    // Scatter ( map size / 100 ) anomalies randomly around the map at map creation
    const numScattered = Math.floor(this.width / 100);
    for (let i = 0; i < numScattered; i++) {
      const ax = Math.random() * this.width;
      const ay = Math.random() * this.height;
      const minDiff = 1;
      const isUnlimited = !this.settings || !this.settings.timedGameLimit || this.settings.timedGameLimit === 'unlimited';
      const timedLimitSecs = !isUnlimited ? parseFloat(this.settings.timedGameLimit) : null;
      const maxDiff = isUnlimited ? 100 : Math.min(Math.floor((timedLimitSecs / 60) / 2), 100);
      const difficulty = Math.max(1, Math.floor((Math.floor(Math.pow(Math.random(), 2) * (maxDiff - minDiff + 1)) + minDiff) / 2));
      const rewardType = Game.getRandomAnomalyRewardType();

      const planetId = 20000 + i;
      const deepSpacePlanet = new Planet(planetId, ax, ay, 0, null, 0, this.width, this.height);
      deepSpacePlanet.isDeepSpaceAnomaly = true;
      deepSpacePlanet.radius = 0;
      deepSpacePlanet.maxShips = 0;
      deepSpacePlanet.supplies = 0;
      deepSpacePlanet.ships = 0;
      deepSpacePlanet.name = "Deep Space Anomaly";
      deepSpacePlanet.anomaly = {
        id: Math.random().toString(36).substr(2, 9),
        x: ax,
        y: ay,
        difficulty: difficulty,
        progress: {},
        researched: false,
        beingResearched: false,
        rewardType: rewardType
      };
      this.addPlanet(deepSpacePlanet);
    }

    // Always pin base prices to the new map's rarities (fresh market)
    this.recalculateResourceRarities({ forceBasePrices: true });
  }

  start() {
    this.initMap();
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  stop() {
    this.isRunning = false;
  }

  setSelection(planet) {
    this.selectedPlanet = planet;
  }

  clearSelection() {
    this.selectedPlanet = null;
  }

  sendShips(source, target, isWarp = false, speedModifier = null, isBombing = false, fillAmount = null, scoutMode = false, isCruiserOrder = false) {
    if (source) source.retainedShips = false;

    if (isCruiserOrder) {
      if ((source.isMilitary || source.homeworldOf) && source.ships > 75 && source.maxShips > 75) {
        const basePower = Math.floor(source.ships / 25);
        const costShips = Math.floor(source.ships / 2);
        const costCap = basePower * 2;
        let maxHealth = Math.floor(costShips / 3);
        if (maxHealth > 30) {
          maxHealth = 30 + (maxHealth - 30) / 2;
        }
        if (maxHealth > 40) {
          maxHealth = 40 + (maxHealth - 40) / 2;
        }
        maxHealth = Math.floor(maxHealth);

        if (source.ships >= costShips && source.maxShips > costCap) {
          source.ships -= costShips;
          source.decreaseMaxShips(costCap);
          const ship = new Ship(this.nextShipId++, source.x, source.y, target, source.owner);
          ship.speed = 22; // Cruisers default to speed 22 before reductions
          ship.maxHealth = maxHealth;
          ship.health = maxHealth;
          ship.crew = ship.maxHealth + ship.health;
          ship.fuel = basePower;
          ship.speed = Math.max(5, ship.speed - 10 - basePower);
          if (ship.owner && ship.owner.id === 'monsters') {
            ship.speed = Math.max(5, ship.speed - 10);
          }
          ship.speedModifier = 1.0;
          ship.cruiserStyle = source.racialAffinity;
          ship.isCruiser = true;
          ship.count = 1;
          let startingExp = source.expScore || 0;
          if (source.focusMode === 'garrison') {
            startingExp += (source.maxShips || 0) / 10;
          }
          ship.expScore = startingExp;
          this.assignRandomShipName(ship);
          this.ships.push(ship);
          return;
        }
      }
      return;
    }
    

    let launchCost = source.owner ? 10 + (source.owner.planetCount || 0) : 10;
    if (source.owner) {
      const techBonus = Math.floor(Math.sqrt(source.owner.techScore || 0));
      launchCost = Math.max(0, launchCost - techBonus);
    }
    launchCost = Math.min(250, launchCost);

    // Calculate potential shipsToSend without deducting launch cost first
    let shipsToSend;
    const isReinforcing = source.owner && target && target.owner && source.owner.id === target.owner.id;
    if (isReinforcing && !isBombing) {
      const maxS = (target.focusMode === 'garrison') ? (target.maxShips * 2) : target.maxShips;
      if (target.ships >= maxS) {
        shipsToSend = 0;
      } else {
        const fillNeeded = maxS - target.ships;
        if (source.ships >= fillNeeded) {
          shipsToSend = fillNeeded;
        } else {
          shipsToSend = Math.floor(source.ships / 2);
        }
      }
      shipsToSend = Math.min(shipsToSend, Math.max(0, source.ships - 10));
    } else {
      shipsToSend = scoutMode ? Math.max(3, Math.floor(source.ships * 0.1)) : Math.floor(source.ships / 2);
    }

    shipsToSend = Math.min(shipsToSend, source.ships);
    
    if (source.rampageEvent) {
      const minReserve = source.maxShips * 0.75;
      if (source.ships - shipsToSend < minReserve) {
        shipsToSend = Math.floor(source.ships - minReserve);
      }
    }
    
    if (fillAmount !== null) {
      const maxCanSend = Math.max(0, Math.floor(source.ships) - 10);
      shipsToSend = Math.min(maxCanSend, fillAmount);
    }

    shipsToSend = Math.min(250, shipsToSend);

    const tritaniumCost = 0.01 * shipsToSend;
    const payWithTritanium = !isReinforcing && source.owner && source.owner.resources && (source.owner.resources.tritanium || 0) >= tritaniumCost && shipsToSend > 0 && source.useResources;

    let finalShipsToSend = shipsToSend;
    let finalLaunchCost = 0;
    let isTritaniumPaid = false;

    if (payWithTritanium) {
      isTritaniumPaid = true;
      source.owner.resources.tritanium -= tritaniumCost;
    } else {
      // Standard ship payment or credits fallback
      const useCredits = source.owner && source.owner.useCredits !== false;
      // Debt floor always from trade ships (no homeworld ownership required)
      const minAllowedCredits = source.owner
        ? -Math.floor(source.owner.totalTradeShips || 0)
        : 0;
      const creditsAvailable = source.owner ? (source.owner.credits - minAllowedCredits) : 0;
      let creditsPaid = 0;
      let shipLaunchCost = launchCost;

      if (useCredits && creditsAvailable > 0) {
        creditsPaid = Math.min(creditsAvailable, launchCost);
        shipLaunchCost = launchCost - creditsPaid;
      }

      if (source.ships < shipLaunchCost + 1) return;
      
      const tempShips = source.ships - shipLaunchCost;
      let standardShipsToSend;
      if (isReinforcing && !isBombing) {
        const maxS = (target.focusMode === 'garrison') ? (target.maxShips * 2) : target.maxShips;
        if (target.ships >= maxS) {
          standardShipsToSend = 0;
        } else {
          const fillNeeded = maxS - target.ships;
          if (tempShips >= fillNeeded) {
            standardShipsToSend = fillNeeded;
          } else {
            standardShipsToSend = Math.floor(tempShips / 2);
          }
        }
        standardShipsToSend = Math.min(standardShipsToSend, Math.max(0, tempShips - 10));
      } else {
        standardShipsToSend = scoutMode ? Math.max(3, Math.floor(tempShips * 0.1)) : Math.floor(tempShips / 2);
      }
      standardShipsToSend = Math.min(standardShipsToSend, tempShips);
      if (source.rampageEvent) {
        const minReserve = source.maxShips * 0.75;
        if (tempShips - standardShipsToSend < minReserve) {
          standardShipsToSend = Math.floor(tempShips - minReserve);
        }
      }
      if (fillAmount !== null) {
        const maxCanSend = Math.max(0, Math.floor(tempShips) - 10);
        standardShipsToSend = Math.min(maxCanSend, fillAmount);
      }
      standardShipsToSend = Math.min(250, standardShipsToSend);
      
      if (standardShipsToSend <= 0) {
        return;
      }
      if (creditsPaid > 0) {
        source.owner.credits -= creditsPaid;
      }
      finalShipsToSend = standardShipsToSend;
      finalLaunchCost = shipLaunchCost;
    }

    source.ships -= finalLaunchCost;
    source.ships -= finalShipsToSend;
    
    if (!isTritaniumPaid) {
      const capDeduction = Math.floor(finalShipsToSend / 50);
      if (capDeduction > 0) {
        source.decreaseMaxShips(capDeduction);
        if (source.maxShips < 5) source.dead = true;
      }
    }
    
    if (source.rampageEvent) {
      source.decreaseMaxShips(1);
      if (source.maxShips < 5) source.dead = true;
    }
    
    if (isBombing) {
      if (!source.isMilitary) {
        isBombing = false;
      } else {
        finalShipsToSend = Math.floor(finalShipsToSend / 3);
        if (finalShipsToSend <= 0) return;
        source.decreaseMaxShips(1);
        if (source.maxShips < 10) source.dead = true;
      }
    }
    
    // Spawn fleet represented as a single Ship entity
    const ship = new Ship(this.nextShipId++, source.x, source.y, target, source.owner);
    ship.cruiserStyle = source.racialAffinity;
    ship.count = finalShipsToSend;
    if (isTritaniumPaid) {
      ship.speed = 35;
    }
    if (source.isSpeedPlanet) ship.speed += 15;
    ship.speedModifier = speedModifier !== null ? speedModifier : 1.0;
    ship.sourcePlanet = source;
    let startingExp = source.expScore || 0;
    if (source.focusMode === 'garrison') {
      startingExp += (source.maxShips || 0) / 10;
    }
    if (isTritaniumPaid) {
      startingExp += 400;
    }
    ship.expScore = startingExp;
    ship.bomberOffsetMag = 0;
    
    if (isBombing) {
      ship.isBomber = true;
      ship.bomberType = isBombing; // 'eco' or 'ships'
      ship.speed = 15;
    }
    if (isWarp) {
      if (this.applyWarpToShip(ship, source.owner)) {
         return; // Exploded!
      }
    }
    if (source.owner && source.owner.isAI) {
      ship.expScore += 200;
      this.recordAiPhantomShips(source.owner, ship.count || finalShipsToSend || 0);
    }

    this.ships.push(ship);
  }

  /** Bank launched AI ships toward timed phantom upgrade purchases (30 ships → 1 buy). */
  recordAiPhantomShips(owner, count) {
    if (!owner || !owner.isAI || owner.id === 'monsters') return;
    const n = Math.floor(count || 0);
    if (n <= 0) return;
    owner.aiPhantomShipBank = (owner.aiPhantomShipBank || 0) + n;
    // Start a 7–12s cooldown when the bank first becomes spendable
    if ((owner.aiPhantomShipBank || 0) >= 30 && (!(owner.aiPhantomBuyTimer > 0))) {
      owner.aiPhantomBuyTimer = (7 + Math.random() * 5) * 1000;
    }
  }

  /** Spend banked AI launches: every 7–12s consume 30 ships and phantom-buy one upgrade type. */
  processAiPhantomUpgradeBuys(deltaTime) {
    const upgradeTypes = [
      'sensorarray', 'lab', 'armor', 'shield', 'engine', 'munitions', 'targeting',
      'damagecontrol', 'supplyship', 'extendedfuel', 'diplomat', 'marines', 'command'
    ];
    for (const player of this.allPlayers) {
      if (!player || !player.isAI || player.id === 'monsters') continue;
      const bank = player.aiPhantomShipBank || 0;
      if (bank < 30) {
        player.aiPhantomBuyTimer = 0;
        continue;
      }
      if (!(player.aiPhantomBuyTimer > 0)) {
        player.aiPhantomBuyTimer = (7 + Math.random() * 5) * 1000;
      }
      player.aiPhantomBuyTimer -= deltaTime;
      while (player.aiPhantomBuyTimer <= 0 && (player.aiPhantomShipBank || 0) >= 30) {
        player.aiPhantomShipBank -= 30;
        const chosen = upgradeTypes[Math.floor(Math.random() * upgradeTypes.length)];
        // Representative mid-size hull for pricing royalties
        const dummyShip = {
          maxHealth: 35,
          owner: player,
          sensorarrays: 0, labs: 0, armor: 0, shields: 0, engine: 0,
          munitions: 0, targeting: 0, damagecontrol: 0, supply_ship: 0,
          extended_fuel: 0, diplomat: 0, marines: 0, command: 0
        };
        const cost = this.getUpgradeCost(dummyShip, chosen);
        if (!this.aiUpgradePurchases) this.aiUpgradePurchases = [];
        this.aiUpgradePurchases.push({ player, type: chosen, cost });
        if ((player.aiPhantomShipBank || 0) >= 30) {
          player.aiPhantomBuyTimer += (7 + Math.random() * 5) * 1000;
        } else {
          player.aiPhantomBuyTimer = 0;
        }
      }
    }
  }

  applyWarpToShip(ship, player) {
    if (ship.maxHealth > 0) {
      if ((ship.fuel || 0) <= 0) {
        return false;
      }
      ship.fuel -= 1;
      if (ship.specialfuel && ship.specialfuel > 0) {
        ship.specialfuel = Math.max(0, ship.specialfuel - 1.0);
      }
    }

    const techBonus = Math.floor(Math.sqrt(player.techScore || 0));
    const explodeChance = Math.max(0, 50 - techBonus) / 100;
    
    if (ship.count > 1) {
      const explodedCount = Math.round(ship.count * explodeChance);
      if (explodedCount > 0) {
        const playerCredits = player ? (player.credits || 0) : 0;
        const creditsToPay = Math.min(playerCredits, explodedCount);
        if (creditsToPay > 0 && player) {
          player.credits -= creditsToPay;
          console.log(`[Warp Casualties Paid] Player ${player.id} paid ${creditsToPay} credits to save warp casualties.`);
        }
        const unpaidCasualties = explodedCount - creditsToPay;
        if (unpaidCasualties > 0) {
          ship.count -= unpaidCasualties;
          if (!this.explosions) this.explosions = [];
          this.explosions.push({
            x: ship.x,
            y: ship.y,
            color: '#add8e6',
            age: 0,
            isMassive: unpaidCasualties > 10
          });
        }
      }
      if (ship.count <= 0) {
        return true; // Whole fleet exploded
      }
    } else {
      if (Math.random() < explodeChance) {
        const isCruiser = ship.maxHealth > 0;
        const playerCredits = player ? (player.credits || 0) : 0;
        if (playerCredits >= 1 && player && !isCruiser) {
          player.credits -= 1;
          console.log(`[Warp Casualties Paid] Player ${player.id} paid 1 credit to save single ship warp casualty.`);
        } else {
          if (!this.explosions) this.explosions = [];
          this.explosions.push({
            x: ship.x,
            y: ship.y,
            color: '#add8e6',
            age: 0,
            isMassive: false
          });
          
          if (ship.maxHealth > 0) {
            if (ship.fuel > 0) {
              ship.fuel -= 1;
              if (ship.specialfuel && ship.specialfuel > 0) {
                ship.specialfuel = Math.max(0, ship.specialfuel - 1.0);
              }
            } else {
              const warpDamage = Math.floor(Math.random() * 6) + 1;
              ship.health -= warpDamage;
              console.log(`[Warp Damage] Cruiser ${ship.id} took ${warpDamage} warp damage (fuel was empty).`);
            }
            if (ship.health <= 0) {
              return true;
            }
          } else {
            return true;
          }
        }
      }
    }
    
    ship.isWarp = true;
    let planetCount = 0;
    for (const p of this.planets) {
      if (p.owner && p.owner.id === player.id) planetCount++;
    }
    ship.warpBonus = ship.getWarpBonus ? ship.getWarpBonus() : Math.max(10, ship.speed);
    return false;
  }

  sendShipsToSpace(source, targetX, targetY, isWarp = false, speedModifier = null, isBombing = false, scoutMode = false, isCruiserOrder = false) {
    if (source) source.retainedShips = false;

    if (isCruiserOrder) {
      if ((source.isMilitary || source.homeworldOf) && source.ships > 75 && source.maxShips > 75) {
        const health = Math.floor(source.ships / 25);
        const costShips = health * 15;
        const costCap = health * 2;
        if (source.ships >= costShips && source.maxShips > costCap) {
          let cruiserMaxHealth = Math.floor(source.ships / 5);
          if (cruiserMaxHealth > 30) {
            cruiserMaxHealth = 30 + (cruiserMaxHealth - 30) / 2;
          }
          if (cruiserMaxHealth > 40) {
            cruiserMaxHealth = 40 + (cruiserMaxHealth - 40) / 2;
          }
          cruiserMaxHealth = Math.floor(cruiserMaxHealth);

          source.ships -= costShips;
          source.decreaseMaxShips(costCap);
          const ship = new Ship(this.nextShipId++, source.x, source.y, null, source.owner, targetX, targetY);
          ship.speed = 22; // Cruisers default to speed 22 before reductions
          ship.maxHealth = cruiserMaxHealth;
          ship.health = cruiserMaxHealth;
          ship.crew = ship.maxHealth + ship.health;
          ship.fuel = health;
          ship.speed = Math.max(5, ship.speed - 10 - health);
          if (ship.owner && ship.owner.id === 'monsters') {
            ship.speed = Math.max(5, ship.speed - 10);
          }
          ship.speedModifier = 1.0;
          ship.cruiserStyle = source.racialAffinity;
          ship.isCruiser = true;
          ship.count = 1;
          let startingExp = source.expScore || 0;
          if (source.focusMode === 'garrison') {
            startingExp += (source.maxShips || 0) / 10;
          }
          ship.expScore = startingExp;
          this.assignRandomShipName(ship);
          this.ships.push(ship);
          return;
        }
      }
      return;
    }
    

    let launchCost = source.owner ? 10 + (source.owner.planetCount || 0) : 10;
    if (source.owner) {
      const techBonus = Math.floor(Math.sqrt(source.owner.techScore || 0));
      launchCost = Math.max(0, launchCost - techBonus);
    }
    launchCost = Math.min(250, launchCost);

    // Calculate potential shipsToSend without deducting launch cost first
    let shipsToSend = scoutMode ? Math.max(3, Math.floor(source.ships * 0.1)) : Math.floor(source.ships / 2);
    shipsToSend = Math.min(shipsToSend, source.ships);
    
    if (source.rampageEvent) {
      const minReserve = source.maxShips * 0.75;
      if (source.ships - shipsToSend < minReserve) {
        shipsToSend = Math.floor(source.ships - minReserve);
      }
    }
    
    shipsToSend = Math.min(250, shipsToSend);

    const tritaniumCost = 0.01 * shipsToSend;
    const payWithTritanium = source.owner && source.owner.resources && (source.owner.resources.tritanium || 0) >= tritaniumCost && shipsToSend > 0 && source.useResources;

    let finalShipsToSend = shipsToSend;
    let finalLaunchCost = 0;
    let isTritaniumPaid = false;

    if (payWithTritanium) {
      isTritaniumPaid = true;
      source.owner.resources.tritanium -= tritaniumCost;
    } else {
      // Standard ship payment or credits fallback
      const useCredits = source.owner && source.owner.useCredits !== false;
      // Debt floor always from trade ships (no homeworld ownership required)
      const minAllowedCredits = source.owner
        ? -Math.floor(source.owner.totalTradeShips || 0)
        : 0;
      const creditsAvailable = source.owner ? (source.owner.credits - minAllowedCredits) : 0;
      let creditsPaid = 0;
      let shipLaunchCost = launchCost;

      if (useCredits && creditsAvailable > 0) {
        creditsPaid = Math.min(creditsAvailable, launchCost);
        shipLaunchCost = launchCost - creditsPaid;
      }

      if (source.ships < shipLaunchCost + 1) return;
      
      const tempShips = source.ships - shipLaunchCost;
      let standardShipsToSend = scoutMode ? Math.max(3, Math.floor(tempShips * 0.1)) : Math.floor(tempShips / 2);
      standardShipsToSend = Math.min(standardShipsToSend, tempShips);
      if (source.rampageEvent) {
        const minReserve = source.maxShips * 0.75;
        if (tempShips - standardShipsToSend < minReserve) {
          standardShipsToSend = Math.floor(tempShips - minReserve);
        }
      }
      standardShipsToSend = Math.min(250, standardShipsToSend);
      
      if (standardShipsToSend <= 0) {
        return;
      }
      if (creditsPaid > 0) {
        source.owner.credits -= creditsPaid;
      }
      finalShipsToSend = standardShipsToSend;
      finalLaunchCost = shipLaunchCost;
    }

    source.ships -= finalLaunchCost;
    source.ships -= finalShipsToSend;
    
    if (!isTritaniumPaid) {
      const capDeduction = Math.floor(finalShipsToSend / 50);
      if (capDeduction > 0) {
        source.decreaseMaxShips(capDeduction);
        if (source.maxShips < 5) source.dead = true;
      }
    }
    
    if (source.rampageEvent) {
      source.decreaseMaxShips(1);
      if (source.maxShips < 5) source.dead = true;
    }
    
    if (isBombing) {
      if (!source.isMilitary) {
        isBombing = false;
      } else {
        finalShipsToSend = Math.floor(finalShipsToSend / 3);
        if (finalShipsToSend <= 0) return;
        source.decreaseMaxShips(1);
        if (source.maxShips < 10) source.dead = true;
      }
    }
    
    // Spawn fleet represented as a single Ship entity
    const ship = new Ship(this.nextShipId++, source.x, source.y, null, source.owner, targetX, targetY);
    ship.cruiserStyle = source.racialAffinity;
    ship.count = finalShipsToSend;
    if (isTritaniumPaid) {
      ship.speed = 35;
    }
    if (source.isSpeedPlanet) ship.speed += 15;
    const spaceDx = targetX - source.x;
    const spaceDy = targetY - source.y;
    const spaceDist = Math.sqrt(spaceDx * spaceDx + spaceDy * spaceDy);
    ship.speedModifier = speedModifier !== null ? speedModifier : 1.0;
    ship.sourcePlanet = source;
    let startingExp = source.expScore || 0;
    if (source.focusMode === 'garrison' && !source.homeworldOf) {
      startingExp += (source.maxShips || 0) / 10;
    }
    if (isTritaniumPaid) {
      startingExp += 400;
    }
    ship.expScore = startingExp;
    ship.bomberOffsetMag = 0;
    
    if (isBombing) {
       ship.isBomber = true;
       ship.bomberType = isBombing;
       ship.speed = 15;
    }
    if (isWarp) {
      if (this.applyWarpToShip(ship, source.owner)) {
         return; // Exploded!
      }
    }
    if (source.owner && source.owner.isAI) {
      ship.expScore = (ship.expScore || 0) + 200;
      this.recordAiPhantomShips(source.owner, ship.count || finalShipsToSend || 0);
    }
    this.ships.push(ship);
  }

  buildCapitalShip(source, classType) {
    if (!source || !classType) return;
    const cfg = SHIP_CLASSES[classType];
    if (!cfg) return;

    // Limit the number of cruisers a single planet may be building at a time to 1
    // O(1) via planet flag — scanning all ships was slow on huge maps
    if (source.materializingShipId != null) {
      const existing = this.shipsById ? this.shipsById.get(source.materializingShipId) : null;
      if (existing && existing.active && existing.isMaterializing) {
        return;
      }
      source.materializingShipId = null;
    }

    if (source.owner) {
      const owner = source.owner;
      if (owner) {
        owner.builtClasses = owner.builtClasses || {};
      }

      // Check unlock requirement: except for corvettes, previous class must be built
      const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
      const idx = keys.indexOf(classType);
      if (idx > 0 && classType !== 'corvette') {
        const prevClass = keys[idx - 1];
        const builtClasses = owner ? (owner.builtClasses || {}) : {};
        if (!builtClasses[prevClass]) {
          return; // Locked!
        }
      }

      const isFirst = owner ? !owner.builtClasses[classType] : true;
      let costMult = 1;
      if (isFirst) {
        const baseMultipliers = {
          corvette: 1,
          destroyer: 1.75,
          battlecruiser: 2.5,
          titan: 3.5,
          mammoth: 4
        };
        const baseMult = baseMultipliers[classType] || 1;
        costMult = baseMult;
        if (owner) {
          const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
          const idx = keys.indexOf(classType);
          if (idx > 0) {
            const prevClass = keys[idx - 1];
            const prevCount = (owner.buildCounts && owner.buildCounts[prevClass]) || 0;
            const subsequentBuilds = Math.max(0, prevCount - 1);
            costMult = Math.max(1.0, baseMult - subsequentBuilds * 0.5 * (baseMult - 1.0));
          }
        }
      }
      let costShips = cfg.costShips * costMult;
      const costCap = cfg.costCap;
      const maxHealth = cfg.hp;

      // Debt floor always from trade ships (no homeworld ownership required)
      const minAllowedCredits = owner
        ? -Math.floor(owner.totalTradeShips || 0)
        : 0;

      const useCredits = owner && owner.useCredits !== false;
      // How far credits can fall: down to debt floor (minAllowedCredits). Spendable = credits - floor.
      const creditsAvailable = owner ? (owner.credits - minAllowedCredits) : 0;
      // Military yards count garrison 2× toward ship-paid portion only
      const shipsFactor = source.isMilitary ? 2 : 1;
      const effectiveShips = source.ships * shipsFactor;

      // Hard presence rule: effective ships >= hull cost (military counts garrison 2×)
      const hasHullPresence = effectiveShips >= costShips;

      // Pay as much as debt limit allows with credits; remainder from garrison ships
      const spendableCredits = useCredits ? Math.max(0, creditsAvailable) : 0;
      let creditsPaid = Math.min(spendableCredits, costShips);
      let remainingCostShips = costShips - creditsPaid;
      let canPay = remainingCostShips <= 0
        ? true
        : (effectiveShips >= remainingCostShips);
      let canAfford = hasHullPresence && canPay;

      if (canAfford && (source.maxShips - costCap) >= 5) {
        const extraShips = source.ships;
        const bonusHp = Math.min(4, Math.floor(Math.max(0, extraShips) / 25));
        const finalMaxHealth = maxHealth + bonusHp;

        if (owner) {
          owner.builtClasses[classType] = true;
          owner.buildCounts = owner.buildCounts || {};
          owner.buildCounts[classType] = (owner.buildCounts[classType] || 0) + 1;
        }
        source.decreaseMaxShips(costCap);

        const angle = Math.random() * Math.PI * 2;
        const spawnDist = source.radius + 20;
        const sx = source.x + Math.cos(angle) * spawnDist;
        const sy = source.y + Math.sin(angle) * spawnDist;

        const ship = new Ship(this.nextShipId++, sx, sy, null, source.owner, sx, sy);
        ship.speed = 22; // Cruisers default to speed 22 before reductions
        ship.classType = classType;
        ship.maxHealth = finalMaxHealth;
        ship.health = 1;
        ship.crew = ship.maxHealth + ship.health;
        
        const basePower = Math.floor(finalMaxHealth / 5);
        ship.fuel = basePower * 5;
        ship.speed = Math.max(5, ship.speed - 5 - basePower);
        if (ship.owner && ship.owner.id === 'monsters') {
          ship.speed = Math.max(5, ship.speed - 10);
        }
        if (source.isSpeedPlanet) {
          ship.speed += 3;
        }
        ship.speedModifier = 1.0;
        
        let startingXp = 0;
        if (source.homeworldOf) {
          startingXp += source.ships / 10;
        }
        if (source.isMilitary) {
          startingXp += source.ships / 10;
        }
        if (source.focusMode === 'garrison') {
          startingXp += source.ships / 10;
        }
        startingXp += (source.expScore || 0);
        startingXp += (owner ? (owner.expScore || 0) : 0);

        ship.expScore = startingXp;

        ship.cruiserStyle = source.racialAffinity;
        ship.isCruiser = true;
        ship.count = 1;

        ship.isMaterializing = true;
        ship.materializeProgress = 0.0;
        const shipPct = Math.max(0.1, Math.min(1.0, source.ships / source.maxShips));
        ship.materializeDuration = (finalMaxHealth / 2) / shipPct;
        const trueCostShips = remainingCostShips / shipsFactor;
        ship.sourcePlanet = source;
        ship.buildCostShipsTotal = trueCostShips;
        ship.buildCostCreditsTotal = creditsPaid;
        ship.buildCostShipsRemaining = trueCostShips;
        ship.buildCostCreditsRemaining = creditsPaid;

        this.assignRandomShipName(ship);
        this.applyBankedUpgradeTokens(owner, ship);
        this.ships.push(ship);
        if (this.shipsById) this.shipsById.set(ship.id, ship);
        source.materializingShipId = ship.id;
        console.log(`[Capital Ship Build Started] Spawning ${cfg.name} (HP: ${finalMaxHealth}) from Planet ${source.id} for Player ${source.owner.id}. Deducting ${remainingCostShips} ships and ${creditsPaid} credits over ${ship.materializeDuration}s`);
      }
    }
  }

  buildCapitalShipConfig(source, classType, upgrades, configName) {
    if (!source || !classType) return;
    const cfg = SHIP_CLASSES[classType];
    if (!cfg) return;

    // Limit the number of cruisers a single planet may be building at a time to 1
    if (source.materializingShipId != null) {
      const existing = this.shipsById ? this.shipsById.get(source.materializingShipId) : null;
      if (existing && existing.active && existing.isMaterializing) {
        return;
      }
      source.materializingShipId = null;
    }

    const owner = source.owner;
    if (source.owner) {
      if (owner) {
        owner.builtClasses = owner.builtClasses || {};
      }

      // Check unlock requirement: except for corvettes, previous class must be built
      const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
      const idx = keys.indexOf(classType);
      if (idx > 0 && classType !== 'corvette') {
        const prevClass = keys[idx - 1];
        const builtClasses = owner ? (owner.builtClasses || {}) : {};
        if (!builtClasses[prevClass]) {
          return; // Locked!
        }
      }

      const isFirst = owner ? !owner.builtClasses[classType] : true;
      let costMult = 1;
      if (isFirst) {
        const baseMultipliers = {
          corvette: 1,
          destroyer: 1.75,
          battlecruiser: 2.5,
          titan: 3.5,
          mammoth: 4
        };
        const baseMult = baseMultipliers[classType] || 1;
        costMult = baseMult;
        if (owner) {
          const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
          const idx = keys.indexOf(classType);
          if (idx > 0) {
            const prevClass = keys[idx - 1];
            const prevCount = (owner.buildCounts && owner.buildCounts[prevClass]) || 0;
            const subsequentBuilds = Math.max(0, prevCount - 1);
            costMult = Math.max(1.0, baseMult - subsequentBuilds * 0.5 * (baseMult - 1.0));
          }
        }
      }
      let baseCostShips = cfg.costShips * costMult;
      const costCap = cfg.costCap;
      const maxHealth = cfg.hp;

      // Calculate configuration upgrade costs
      const upgradeProps = [
        'sensorarrays', 'labs', 'armor', 'shields', 'engine', 
        'munitions', 'targeting', 'damagecontrol', 'supply_ship', 'extended_fuel', 
        'diplomat', 'marines', 'command'
      ];
      let totalUpgradeCost = 0;
      const levels = {};
      let totalUpgradesCount = 0;
      for (const prop of upgradeProps) {
        levels[prop] = upgrades ? (parseInt(upgrades[prop], 10) || 0) : 0;
        totalUpgradesCount += levels[prop];
      }
      
      const totalUpgradesCountOriginal = totalUpgradesCount;

      let simulatedTotalUpgrades = 0;
      const simulatedLevels = { ...levels };
      while (totalUpgradesCount > 0) {
        let foundProp = null;
        for (const prop of upgradeProps) {
          if (simulatedLevels[prop] > 0) {
            foundProp = prop;
            break;
          }
        }
        if (!foundProp) break;

        const prevSum = simulatedTotalUpgrades;
        const baseCost = Math.min(150, Math.round(25 + cfg.hp * (3 + prevSum / 3)));

        const typeKeyMap = {
          sensorarrays: 'sensorarray',
          labs: 'lab',
          armor: 'armor',
          shields: 'shield',
          engine: 'engine',
          munitions: 'munitions',
          targeting: 'targeting',
          damagecontrol: 'damagecontrol',
          supply_ship: 'supplyship',
          extended_fuel: 'extendedfuel',
          diplomat: 'diplomat',
          marines: 'marines',
          command: 'command'
        };
        const normType = typeKeyMap[foundProp] || foundProp;
        const globalMod = (this.globalUpgradeModifiers && this.globalUpgradeModifiers[normType] !== undefined)
          ? Math.max(-0.50, this.globalUpgradeModifiers[normType])
          : 0.0;
        let playerMod = 0;
        if (owner && owner.upgradeModifiers && owner.upgradeModifiers[normType] !== undefined) {
          playerMod = owner.upgradeModifiers[normType];
        }
        const modifier = Math.max(-0.75, globalMod + playerMod);
        let finalCostVal = Math.max(1, Math.round(baseCost * (1 + modifier)));

        // Apply the planet upgrade divisor for this upgrade type
        let planetUpgradesCount = 0;
        if (owner) {
          for (const p of this.planets) {
            if (p.owner && p.owner.id === owner.id && !p.dead) {
              planetUpgradesCount += (p[foundProp] || 0);
            }
          }
        }
        const planetDiscount = Math.min(1.0, 0.20 * planetUpgradesCount);
        finalCostVal = Math.max(1, Math.round(finalCostVal * (1 - planetDiscount)));

        totalUpgradeCost += finalCostVal;

        simulatedLevels[foundProp]--;
        simulatedTotalUpgrades++;
        totalUpgradesCount--;
      }

      const finalCost = Math.round(baseCostShips + totalUpgradeCost);
      console.log(`[SERVER-CONFIG-COST] Name: ${configName}, classType: ${classType}, upgrades:`, JSON.stringify(upgrades), `baseCostShips: ${baseCostShips}, totalUpgradeCost: ${totalUpgradeCost}, finalCost: ${finalCost}`);

      // Debt floor always from trade ships (no homeworld ownership required)
      const minAllowedCredits = owner
        ? -Math.floor(owner.totalTradeShips || 0)
        : 0;

      const useCredits = owner && owner.useCredits !== false;
      // Spendable credits = how far balance may fall before the debt floor
      const creditsAvailable = owner ? (owner.credits - minAllowedCredits) : 0;
      const shipsFactor = source.isMilitary ? 2 : 1;
      const effectiveShips = source.ships * shipsFactor;

      // Presence uses base hull cost only (not upgrade surcharge); military counts 2×
      const hasHullPresence = effectiveShips >= baseCostShips;

      const spendableCredits = useCredits ? Math.max(0, creditsAvailable) : 0;
      let creditsPaid = Math.min(spendableCredits, finalCost);
      let remainingCostShips = finalCost - creditsPaid;
      let canPay = remainingCostShips <= 0
        ? true
        : (effectiveShips >= remainingCostShips);
      let canAfford = hasHullPresence && canPay;

      if (canAfford && (source.maxShips - costCap) >= 5) {
        const extraShips = source.ships;
        const bonusHp = Math.min(4, Math.floor(Math.max(0, extraShips) / 25));
        const finalMaxHealth = maxHealth + bonusHp;

        if (owner) {
          owner.builtClasses[classType] = true;
          owner.buildCounts = owner.buildCounts || {};
          owner.buildCounts[classType] = (owner.buildCounts[classType] || 0) + 1;

          // Apply the 1% discount for each upgrade in the configuration
          if (upgrades) {
            const typeKeyMap = {
              sensorarrays: 'sensorarray',
              labs: 'lab',
              armor: 'armor',
              shields: 'shield',
              engine: 'engine',
              munitions: 'munitions',
              targeting: 'targeting',
              damagecontrol: 'damagecontrol',
              supply_ship: 'supplyship',
              extended_fuel: 'extendedfuel',
              diplomat: 'diplomat',
              marines: 'marines',
              command: 'command'
            };
            for (const [prop, count] of Object.entries(upgrades)) {
              const normType = typeKeyMap[prop] || prop;
              const val = parseInt(count, 10) || 0;
              if (val > 0) {
                if (this.globalUpgradeModifiers) {
                  this.globalUpgradeModifiers[normType] = (this.globalUpgradeModifiers[normType] || 0) + (0.10 * val);
                }
                if (owner.upgradeModifiers && owner.upgradeModifiers[normType] !== undefined) {
                  for (let i = 0; i < val; i++) {
                    owner.upgradeModifiers[normType] = Math.max(-0.75, owner.upgradeModifiers[normType] - 0.01);
                  }
                }
              }
            }
          }
        }
        source.decreaseMaxShips(costCap);

        const angle = Math.random() * Math.PI * 2;
        const spawnDist = source.radius + 20;
        const sx = source.x + Math.cos(angle) * spawnDist;
        const sy = source.y + Math.sin(angle) * spawnDist;

        const ship = new Ship(this.nextShipId++, sx, sy, null, source.owner, sx, sy);
        ship.speed = 22; // Cruisers default to speed 22 before reductions
        ship.classType = classType;
        ship.maxHealth = finalMaxHealth;
        ship.health = 1;
        ship.crew = ship.maxHealth + ship.health;
        
        const basePower = Math.floor(finalMaxHealth / 5);
        ship.fuel = basePower * 5;
        ship.speed = Math.max(5, ship.speed - 5 - basePower);
        if (ship.owner && ship.owner.id === 'monsters') {
          ship.speed = Math.max(5, ship.speed - 10);
        }
        if (source.isSpeedPlanet) {
          ship.speed += 3;
        }
        ship.speedModifier = 1.0;
        
        let startingXp = 0;
        if (source.homeworldOf) {
          startingXp += source.ships / 10;
        }
        if (source.isMilitary) {
          startingXp += source.ships / 10;
        }
        if (source.focusMode === 'garrison') {
          startingXp += source.ships / 10;
        }
        startingXp += (source.expScore || 0);
        startingXp += (owner ? (owner.expScore || 0) : 0);

        ship.expScore = startingXp;

        ship.cruiserStyle = source.racialAffinity;
        ship.isCruiser = true;
        ship.count = 1;

        ship.isMaterializing = true;
        ship.materializeProgress = 0.0;
        
        let duration = finalMaxHealth / 2;
        if (totalUpgradesCountOriginal > 2) {
          duration *= 2;
        }
        const shipPct = Math.max(0.1, Math.min(1.0, source.ships / source.maxShips));
        ship.materializeDuration = duration / shipPct;
        
        const trueCostShips = remainingCostShips / shipsFactor;
        ship.sourcePlanet = source;
        ship.buildCostShipsTotal = trueCostShips;
        ship.buildCostCreditsTotal = creditsPaid;
        ship.buildCostShipsRemaining = trueCostShips;
        ship.buildCostCreditsRemaining = creditsPaid;

        ship.configUpgrades = upgrades;

        this.assignRandomShipName(ship);
        this.applyBankedUpgradeTokens(owner, ship);
        this.ships.push(ship);
        if (this.shipsById) this.shipsById.set(ship.id, ship);
        source.materializingShipId = ship.id;
        console.log(`[Config Build Started] Spawning config ${configName || classType} (HP: ${finalMaxHealth}) from Planet ${source.id} for Player ${source.owner.id}. Deducting ${remainingCostShips} ships and ${creditsPaid} credits over ${ship.materializeDuration}s`);
      }
    }
  }

  moveShipsToSpace(player, shipIds, targetX, targetY, isWarp = false, speedModifier = null, isShift = false) {
    // Prefer per-tick shipsById; fall back to a one-shot map if called mid-bootstrap
    let shipMap = this.shipsById;
    if (!shipMap || shipMap.size === 0) {
      shipMap = new Map();
      for (let i = 0; i < this.ships.length; i++) {
        const s = this.ships[i];
        if (s && s.active) shipMap.set(s.id, s);
      }
    }
    const validShips = shipIds.map(id => shipMap.get(id)).filter(s => s && s.active && s.owner && s.owner.id === player.id && !s.isUpgrading);
    const cruisers = validShips.filter(s => s.isCruiser);
    const numCruisers = cruisers.length;

    for (const ship of cruisers) {
      ship.groupSpeedLimit = null;
    }

    let anchor = null;
    if (numCruisers > 0) {
      let minDist = Infinity;
      for (const c of cruisers) {
        const dx = c.x - targetX;
        const dy = c.y - targetY;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          anchor = c;
        }
      }
    }

    let dispersedSpace = false;
    if (numCruisers > 1) {
      for (let j = 0; j < numCruisers; j++) {
        for (let k = j + 1; k < numCruisers; k++) {
          const dx = cruisers[j].x - cruisers[k].x;
          const dy = cruisers[j].y - cruisers[k].y;
          if (dx * dx + dy * dy > 150 * 150) {
            dispersedSpace = true;
            break;
          }
        }
        if (dispersedSpace) break;
      }
    }

    if (numCruisers > 1 && !dispersedSpace) {
      let slowestSpeed = Infinity;
      for (const ship of cruisers) {
        const speed = ship.getEffectiveSpeedForOrder ? ship.getEffectiveSpeedForOrder(isWarp, speedModifier, this) : ship.speed;
        if (speed < slowestSpeed) slowestSpeed = speed;
      }
      for (const ship of cruisers) {
        ship.groupSpeedLimit = slowestSpeed;
      }
    }

    let offsetsSpace = [];
    if (dispersedSpace) {
      const minSpacing = 40;
      for (let i = 0; i < numCruisers; i++) {
        let found = false;
        let oX = 0, oY = 0;
        let attempts = 0;
        let maxRadius = 30;
        while (!found && attempts < 500) {
          attempts++;
          if (attempts % 50 === 0) {
            maxRadius += 20;
          }
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * maxRadius;
          oX = Math.cos(angle) * radius;
          oY = Math.sin(angle) * radius;
          
          let overlap = false;
          for (const other of offsetsSpace) {
            const dx = oX - other.x;
            const dy = oY - other.y;
            if (dx * dx + dy * dy < minSpacing * minSpacing) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            found = true;
          }
        }
        offsetsSpace.push({ x: oX, y: oY });
      }
    }

    for (let i = 0; i < numCruisers; i++) {
      const ship = cruisers[i];
      let tX = targetX;
      let tY = targetY;
      if (dispersedSpace) {
        tX = targetX + offsetsSpace[i].x;
        tY = targetY + offsetsSpace[i].y;
      } else if (numCruisers !== 1 && anchor) {
        tX = targetX + (ship.x - anchor.x);
        tY = targetY + (ship.y - anchor.y);
      }

      if (isShift) {
        if (!ship.orderQueue) ship.orderQueue = [];
        ship.orderQueue.push({
          type: 'moveSpace',
          targetX: tX,
          targetY: tY,
          isWarp,
          speedModifier
        });
        let isCurrentlyIdle = !ship.cruiserTargetType;
        if (isCurrentlyIdle) {
          if (ship.targetPlanet) {
            const dx = ship.targetPlanet.x - ship.x;
            const dy = ship.targetPlanet.y - ship.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            isCurrentlyIdle = dist < ship.targetPlanet.radius + 45;
          } else if (ship.targetX !== null) {
            isCurrentlyIdle = Math.abs(ship.targetX - ship.x) < 15 && Math.abs(ship.targetY - ship.y) < 15;
          } else {
            isCurrentlyIdle = true;
          }
        }
        if (isCurrentlyIdle) {
          ship.executeNextOrder(this.planets, this.ships, this);
        }
      } else {
        ship.handlePlayerMoveOrder({ x: tX, y: tY }, this);
        ship.orderQueue = [];
        if (ship.isPatrolling) {
          ship.patrolStationX = tX;
          ship.patrolStationY = tY;
          ship.targetX = tX;
          ship.targetY = tY;
          ship.targetPlanet = null;
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
        } else {
          ship.isPatrolling = false;
          ship.targetPlanet = null;
          ship.cruiserTargetOffsetX = 0;
          ship.cruiserTargetOffsetY = 0;
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
          ship.targetX = tX;
          ship.targetY = tY;
        }
        ship.startX = ship.x;
        ship.startY = ship.y;
        if (speedModifier !== null) ship.speedModifier = speedModifier;
        if (isWarp) {
          if (!ship.isWarp) {
            if (this.applyWarpToShip(ship, player)) {
               ship.active = false;
            }
          }
        } else {
          if (ship.maxHealth > 0) ship.isWarp = false;
        }
      }
    }

    for (const ship of validShips) {
      if (!ship.isCruiser) {
        ship.targetPlanet = null;
        ship.targetX = targetX + (Math.random() - 0.5) * 30;
        ship.targetY = targetY + (Math.random() - 0.5) * 30;
        ship.startX = ship.x;
        ship.startY = ship.y;
        if (speedModifier !== null) ship.speedModifier = speedModifier;
        if (isWarp) {
          if (!ship.isWarp) {
            if (this.applyWarpToShip(ship, player)) {
               ship.active = false;
            }
          }
        } else {
          if (ship.maxHealth > 0) ship.isWarp = false;
        }
      }
    }
  }

  moveShipsToPlanet(player, shipIds, targetPlanet, isWarp = false, speedModifier = null, isShift = false) {
    let shipMap = this.shipsById;
    if (!shipMap || shipMap.size === 0) {
      shipMap = new Map();
      for (let i = 0; i < this.ships.length; i++) {
        const s = this.ships[i];
        if (s && s.active) shipMap.set(s.id, s);
      }
    }
    const validShips = shipIds.map(id => shipMap.get(id)).filter(s => s && s.active && s.owner && s.owner.id === player.id && !s.isUpgrading);
    const cruisers = validShips.filter(s => s.isCruiser);
    const numCruisers = cruisers.length;

    for (const ship of cruisers) {
      ship.groupSpeedLimit = null;
    }

    let anchor = null;
    if (numCruisers > 0) {
      let minDist = Infinity;
      for (const c of cruisers) {
        const dx = c.x - targetPlanet.x;
        const dy = c.y - targetPlanet.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          anchor = c;
        }
      }
    }

    let dispersedPlanet = false;
    if (numCruisers > 1) {
      for (let j = 0; j < numCruisers; j++) {
        for (let k = j + 1; k < numCruisers; k++) {
          const dx = cruisers[j].x - cruisers[k].x;
          const dy = cruisers[j].y - cruisers[k].y;
          if (dx * dx + dy * dy > 150 * 150) {
            dispersedPlanet = true;
            break;
          }
        }
        if (dispersedPlanet) break;
      }
    }

    if (numCruisers > 1 && !dispersedPlanet) {
      let slowestSpeed = Infinity;
      for (const ship of cruisers) {
        const speed = ship.getEffectiveSpeedForOrder ? ship.getEffectiveSpeedForOrder(isWarp, speedModifier, this) : ship.speed;
        if (speed < slowestSpeed) slowestSpeed = speed;
      }
      for (const ship of cruisers) {
        ship.groupSpeedLimit = slowestSpeed;
      }
    }

    let offsetsPlanet = [];
    if (dispersedPlanet) {
      const minSpacing = 40;
      for (let i = 0; i < numCruisers; i++) {
        let found = false;
        let oX = 0, oY = 0;
        let attempts = 0;
        let maxRadius = 30;
        while (!found && attempts < 500) {
          attempts++;
          if (attempts % 50 === 0) {
            maxRadius += 20;
          }
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * maxRadius;
          oX = Math.cos(angle) * radius;
          oY = Math.sin(angle) * radius;
          
          let overlap = false;
          for (const other of offsetsPlanet) {
            const dx = oX - other.x;
            const dy = oY - other.y;
            if (dx * dx + dy * dy < minSpacing * minSpacing) {
              overlap = true;
              break;
            }
          }
          if (!overlap) {
            found = true;
          }
        }
        offsetsPlanet.push({ x: oX, y: oY });
      }
    }

    for (let i = 0; i < numCruisers; i++) {
      const ship = cruisers[i];
      let oX = 0;
      let oY = 0;
      if (dispersedPlanet) {
        oX = offsetsPlanet[i].x;
        oY = offsetsPlanet[i].y;
      } else if (numCruisers !== 1 && anchor) {
        oX = ship.x - anchor.x;
        oY = ship.y - anchor.y;
      }

      if (isShift) {
        if (!ship.orderQueue) ship.orderQueue = [];
        ship.orderQueue.push({
          type: 'movePlanet',
          targetId: targetPlanet.id,
          offsetX: oX,
          offsetY: oY,
          isWarp,
          speedModifier
        });
        let isCurrentlyIdle = !ship.cruiserTargetType;
        if (isCurrentlyIdle) {
          if (ship.targetPlanet) {
            const dx = ship.targetPlanet.x - ship.x;
            const dy = ship.targetPlanet.y - ship.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            isCurrentlyIdle = dist < ship.targetPlanet.radius + 45;
          } else if (ship.targetX !== null) {
            isCurrentlyIdle = Math.abs(ship.targetX - ship.x) < 15 && Math.abs(ship.targetY - ship.y) < 15;
          } else {
            isCurrentlyIdle = true;
          }
        }
        if (isCurrentlyIdle) {
          ship.executeNextOrder(this.planets, this.ships, this);
        }
      } else {
        ship.handlePlayerMoveOrder({ planet: targetPlanet, x: targetPlanet.x + oX, y: targetPlanet.y + oY }, this);
        ship.orderQueue = [];
        if (ship.isPatrolling) {
          ship.patrolStationX = targetPlanet.x + oX;
          ship.patrolStationY = targetPlanet.y + oY;
          ship.targetX = ship.patrolStationX;
          ship.targetY = ship.patrolStationY;
          ship.targetPlanet = null;
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
        } else {
          ship.isPatrolling = false;
          ship.targetPlanet = targetPlanet;
          ship.targetX = null;
          ship.targetY = null;
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
          ship.cruiserTargetOffsetX = oX;
          ship.cruiserTargetOffsetY = oY;
        }
        ship.startX = ship.x;
        ship.startY = ship.y;
        if (speedModifier !== null) ship.speedModifier = speedModifier;
        if (isWarp) {
          if (!ship.isWarp) {
            if (this.applyWarpToShip(ship, player)) {
               ship.active = false;
            }
          }
        } else {
          if (ship.maxHealth > 0) ship.isWarp = false;
        }
      }
    }

    for (const ship of validShips) {
      if (!ship.isCruiser) {
        ship.targetPlanet = targetPlanet;
        ship.targetX = null;
        ship.targetY = null;
        ship.startX = ship.x;
        ship.startY = ship.y;
        if (speedModifier !== null) ship.speedModifier = speedModifier;
        if (isWarp) {
          if (!ship.isWarp) {
            if (this.applyWarpToShip(ship, player)) {
               ship.active = false;
            }
          }
        } else {
          if (ship.maxHealth > 0) ship.isWarp = false;
        }
      }
    }
  }

  gameLoop(time) {
    if (!this.isRunning) return;

    if (!this.lastTime) this.lastTime = time;
    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    if (!this.isPaused) {
      this.update(deltaTime);
      this.checkWinCondition();
    }
    
    if (this.ctx) {
      this.draw();
    }

    if (this.isRunning && typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }
  checkSympathyRevolts() {
    for (const planet of this.planets) {
      this.checkSinglePlanetSympathyRevolt(planet);
    }
  }

  checkSinglePlanetSympathyRevolt(planet) {
    if (planet.inRevolt) return;
    if (!planet.sympathy) return;

    const eligibleNonOwners = [];
    for (const player of this.allPlayers) {
      if (player === this.monsterPlayer) continue;
      const isNotOwner = !planet.owner || player.id !== planet.owner.id;
      if (isNotOwner) {
        const symVal = getEffectiveSympathy(planet, player.id, this.ships, player, this);
        if (symVal > 0) {
          eligibleNonOwners.push({ id: player.id, sympathy: symVal });
        }
      }
    }

    if (eligibleNonOwners.length > 0) {
      const competitors = [];

      if (planet.owner) {
        const ownerSym = getEffectiveSympathy(planet, planet.owner.id, this.ships, planet.owner, this);
        const maxRoll = Math.floor(planet.ships + ownerSym);
        competitors.push({ id: planet.owner.id, maxRoll, isOwner: true, name: planet.owner.name });
      } else {
        const maxRoll = Math.floor(planet.ships);
        competitors.push({ id: 'neutral', maxRoll, isOwner: true, name: 'Neutral' });
      }

      for (const competitor of eligibleNonOwners) {
        const maxRoll = Math.floor(competitor.sympathy);
        const compPlayer = this.allPlayers.find(p => p.id === competitor.id);
        const compName = compPlayer ? compPlayer.name : competitor.id;
        competitors.push({ id: competitor.id, maxRoll, isOwner: false, name: compName });
      }

      // Initialize revolt state
      planet.inRevolt = true;
      planet.revoltTimer = 15000; // 15 seconds
      planet.revoltCompetitors = competitors;
      planet.revoltAttemptEvent = true;

      // Calculate sympathy induced extra casualties to destroy over time
      let totalSubvertingSympathy = 0;
      const originalOwner = planet.owner;
      for (const player of this.allPlayers) {
        if (player === this.monsterPlayer) continue;
        if (!originalOwner || player.id !== originalOwner.id) {
          totalSubvertingSympathy += getEffectiveSympathy(planet, player.id, this.ships, player, this);
        }
      }
      const maxExtraDestroyed = Math.floor(totalSubvertingSympathy / 5);
      planet.revoltShipsToDestroy = Math.floor(Math.random() * (maxExtraDestroyed + 1));
      planet.revoltShipsDestroyedSoFar = 0;

      // Construct and queue the start chat message: [Planet Name] is in revolt! [Participant 1] [Maxroll 1], ...
      const participantsText = competitors.map(c => `${c.name} ${c.maxRoll}`).join(', ');
      const startText = `✊ ${planet.name} is in revolt! ${participantsText}`;

      this.pendingChatMessages = this.pendingChatMessages || [];
      for (const comp of competitors) {
        if (comp.id !== 'neutral') {
          this.pendingChatMessages.push({
            playerId: comp.id,
            text: startText
          });
        }
      }

      console.log(`[REVOLT START] Revolt started on Planet ${planet.name} for 15 seconds.`);
    }
  }

  resolveRevolt(planet) {
    const competitors = planet.revoltCompetitors;
    if (!competitors || competitors.length === 0) return;

    // Recalculate maxRoll based on current effective sympathy at resolution time
    for (const c of competitors) {
      if (c.id === 'neutral') {
        c.maxRoll = Math.floor(planet.ships);
      } else {
        const compPlayer = this.allPlayers.find(p => p.id === c.id);
        const symVal = getEffectiveSympathy(planet, c.id, this.ships, compPlayer, this);
        if (c.isOwner) {
          c.maxRoll = Math.floor(planet.ships + symVal);
        } else {
          c.maxRoll = Math.floor(symVal);
        }
      }
    }

    for (const c of competitors) {
      c.roll = Math.floor(Math.random() * (c.maxRoll + 1));
    }

    competitors.sort((a, b) => b.roll - a.roll);
    const winner = competitors[0];

    const wins = {};
    for (const c of competitors) wins[c.id] = 0;
    const simRuns = 5000;
    for (let r = 0; r < simRuns; r++) {
      let bestId = null;
      let bestRoll = -1;
      for (const c of competitors) {
        const roll = Math.floor(Math.random() * (c.maxRoll + 1));
        if (roll > bestRoll) {
          bestRoll = roll;
          bestId = c.id;
        }
      }
      if (bestId !== null) wins[bestId]++;
    }
    const oddsMap = {};
    for (const c of competitors) {
      oddsMap[c.id] = ((wins[c.id] / simRuns) * 100).toFixed(1) + '%';
    }

    this.pendingChatMessages = this.pendingChatMessages || [];

    if (winner && !winner.isOwner) {
      const winnerPlayer = this.allPlayers.find(p => p.id === winner.id);
      if (winnerPlayer) {
        const oldShips = planet.ships;
        const originalOwner = planet.owner;

        if (!planet.racialAffinity) {
          planet.racialAffinity = winnerPlayer.cruiserStyle || 'Federation';
        }
        planet.owner = winnerPlayer;

        planet.revoltWarmup = 0;
        
        // const baseShips = Math.floor(planet.ships / 2);
        // planet.ships = Math.max(1, baseShips);
        if (planet.sympathy) {
          for (const pId in planet.sympathy) {
            planet.sympathy[pId] /= 2;
          }
        }
        planet.justAssigned = true;
        planet.focusTransition = null;

        if (!originalOwner) {
          if (oldShips > planet.maxShips) {
            planet.retainedShips = true;
          }
          const roll = Math.random();
          if (roll < 0.10) {
            planet.isResearch = true;
          } else if (roll < 0.20) {
            planet.isMilitary = true;
          } else if (roll < 0.30) {
            planet.isSpeedPlanet = true;
          }
        }

        const details = competitors.map(c => {
          const odds = oddsMap[c.id] || '0%';
          return `${c.name} ${c.roll}/${c.maxRoll} (${odds})`;
        }).join(', ');
        const reportText = `✊ ${planet.name} revolt successful! ${winnerPlayer.name} gains control! ${details}`;

        for (const comp of competitors) {
          if (comp.id !== 'neutral') {
            this.pendingChatMessages.push({
              playerId: comp.id,
              text: reportText
            });
          }
        }

        console.log(`[REVOLT] Planet ${planet.name} revolted and joined player ${winnerPlayer.name}`);
      }
    } else {
      const ownerComp = competitors.find(c => c.isOwner);
      const ownerRoll = ownerComp ? ownerComp.roll : 0;

      const challengers = competitors.filter(c => !c.isOwner);
      const highestChallengerRoll = challengers.length > 0 ? Math.max(...challengers.map(c => c.roll)) : 0;

      const rollDiff = Math.max(0, ownerRoll - highestChallengerRoll);
      const cooldownSeconds = 60 + rollDiff * 3;

      planet.revoltWarmup = 0;

      const ownerName = winner.name;
      const details = competitors.map(c => {
        const odds = oddsMap[c.id] || '0%';
        return `${c.name} ${c.roll}/${c.maxRoll} (${odds})`;
      }).join(', ');
      const reportText = `✊ ${planet.name} revolt failed! ${ownerName} retains control! ${details}`;

      for (const comp of competitors) {
        if (comp.id !== 'neutral') {
          this.pendingChatMessages.push({
            playerId: comp.id,
            text: reportText
          });
        }
      }

      console.log(`[REVOLT FAILED] Revolt attempt on Planet ${planet.name} failed. Cooldown: ${cooldownSeconds}s.`);
    }

    planet.revoltCompetitors = null;
  }

  researchAnomaly(p, ship, deltaTime) {
    if (!p.anomaly || p.anomaly.researched) return;
    
    if (p.anomaly.completing) {
      p.anomaly.beingResearched = true;
      if (!p.anomaly.researchingShipIds) p.anomaly.researchingShipIds = [];
      if (!p.anomaly.researchingShipIds.includes(ship.id)) p.anomaly.researchingShipIds.push(ship.id);
      return;
    }

    if (!p.anomaly.progress) {
      p.anomaly.progress = {};
    }

    const ownerId = ship.owner.id;
    let currentProgress = 0;
    if (p.anomaly.progress && typeof p.anomaly.progress === 'object') {
      currentProgress = p.anomaly.progress[ownerId] || 0;
    } else if (typeof p.anomaly.progress === 'number') {
      currentProgress = p.anomaly.progress;
    }

    if (p.anomaly.difficulty <= 0 || currentProgress >= p.anomaly.difficulty) {
      p.anomaly.completing = true;
      p.anomaly.completingTimeLeft = 3000;
      p.anomaly.completingShipId = ship.id;
      p.anomaly.completingPlayerId = ship.owner.id;
      p.anomaly.beingResearched = true;
      p.anomaly.researchingShipId = ship.id;
      if (!p.anomaly.researchingShipIds) p.anomaly.researchingShipIds = [];
      if (!p.anomaly.researchingShipIds.includes(ship.id)) p.anomaly.researchingShipIds.push(ship.id);
      ship.isActivelyResearching = true;
    } else {
      p.anomaly.beingResearched = true;
      p.anomaly.researchingShipId = ship.id;
      if (!p.anomaly.researchingShipIds) p.anomaly.researchingShipIds = [];
      if (!p.anomaly.researchingShipIds.includes(ship.id)) p.anomaly.researchingShipIds.push(ship.id);
      ship.isActivelyResearching = true;
      
      const labs = ship.labs || 0;
      const shipXp = ship.expScore || 0;
      const playerTech = ship.owner.techScore || 0;
      const playerXp = ship.owner.expScore || 0;
      const threshold = (labs + shipXp + playerTech + playerXp) * 1;
      
      let currentProgress = 0;
      if (p.anomaly.progress && typeof p.anomaly.progress === 'object') {
        currentProgress = p.anomaly.progress[ship.owner.id] || 0;
      } else if (typeof p.anomaly.progress === 'number') {
        currentProgress = p.anomaly.progress;
      } else {
        p.anomaly.progress = {};
      }
      
      let rateMultiplier = 1;
      if (p.anomaly.difficulty - currentProgress < threshold) {
        rateMultiplier = 3;
      }
      
      const xpBonus = (typeof ship.getLocalXpBonus === 'function') ? ship.getLocalXpBonus() : 0;
      const xpMultiplier = 1 + (xpBonus * 3) / 100;
      const knowledgeGained = (ship.labs * deltaTime * xpMultiplier * rateMultiplier) / 120000;
      
      ship.accumulatedTech = (ship.accumulatedTech || 0) + knowledgeGained;
      
      if (ship.accumulatedTech >= 1.0) {
        const completions = Math.floor(ship.accumulatedTech);
        ship.accumulatedTech -= completions;
        ship.beakerIncreaseEvent = (ship.beakerIncreaseEvent || 0) + completions;
        
        if (p.anomaly.progress && typeof p.anomaly.progress === 'object') {
          p.anomaly.progress[ship.owner.id] = (p.anomaly.progress[ship.owner.id] || 0) + completions;
          currentProgress = p.anomaly.progress[ship.owner.id];
        } else if (typeof p.anomaly.progress === 'number') {
          p.anomaly.progress = (p.anomaly.progress || 0) + completions;
          currentProgress = p.anomaly.progress;
        } else {
          p.anomaly.progress = { [ship.owner.id]: completions };
          currentProgress = completions;
        }
        
        if (typeof ship.gainXp === 'function') {
          ship.gainXp(completions, this, ship.x, ship.y);
        }
        
        const localShipXpBonus = (typeof ship.getLocalXpBonus === 'function') ? ship.getLocalXpBonus() : 0;
        const playerXpBonus = Math.sqrt(ship.owner.expScore || 0);
        const playerTechBonus = Math.sqrt(ship.owner.techScore || 0);
        const chance = localShipXpBonus * 3 + playerXpBonus - playerTechBonus;
        
        let techGained = 0;
        for (let c = 0; c < completions; c++) {
          if (Math.random() * 100 < chance) {
            techGained += 1;
          }
        }
        if (techGained > 0) {
          ship.owner.techScore = (ship.owner.techScore || 0) + techGained;
        }
        
        if (currentProgress >= p.anomaly.difficulty) {
          p.anomaly.completing = true;
          p.anomaly.completingTimeLeft = 3000;
          p.anomaly.completingShipId = ship.id;
          p.anomaly.completingPlayerId = ship.owner.id;
        }
      }
    }
  }

  update(deltaTime) {
    const perfUpdateStart = performance.now();
    let perfPoints = [];
    
    if (!this.boardingReplays) {
      this.boardingReplays = [];
    }
    
    if (!this.planetGridPopulated && this.planets && this.planets.length > 0) {
      this.planetGrid.populate(this.planets);
      this.planetGridPopulated = true;
    }

    // O(1) ship/planet lookup for command handlers / combat (kept hot each tick)
    if (!this.shipsById) this.shipsById = new Map();
    if (!this.planetsById) this.planetsById = new Map();
    this.shipsById.clear();
    this.planetsById.clear();

    let maxGravityRadius = 0;
    for (const p of this.planets) {
       this.planetsById.set(p.id, p);
       p._tickExtraSympathy = new Map();
       p._tickShipSensorVisible = new Set();
       p._tickShipExtendedSensorVisible = new Set();
       p._tickEffectiveSympathy = new Map();
       // Cache gravity once per tick — getGravityRadius is non-trivial and was hit per-ship before
       const gr = (typeof p.getGravityRadius === 'function') ? p.getGravityRadius() : 0;
       p._tickGravityRadius = gr;
       if (gr > maxGravityRadius) maxGravityRadius = gr;
    }
    
    // Ship→planet sensor/sympathy. Cap per-ship spatial query radius so a single
    // mega gravity well (maxGravityRadius can be thousands on huge maps) doesn't
    // force every ship to scan half the map. Large wells are checked separately.
    const usePlanetGrid = this.planetGridPopulated && this.planetGrid;
    const largeWells = [];
    for (let pi = 0; pi < this.planets.length; pi++) {
      const p = this.planets[pi];
      if ((p._tickGravityRadius || 0) > 350 && !p.isDeepSpaceAnomaly) largeWells.push(p);
    }
    const LOCAL_QUERY_CAP = 400; // sensor + typical wells; large wells handled below

    for (const s of this.ships) {
      if (!s) continue;
      this.shipsById.set(s.id, s);
      if (!s.active || !s.owner) continue;
      
      const pId = s.owner.id;
      let radarRange = 50;
      if (s.isCruiser || s.maxHealth > 0) {
        radarRange = (typeof s.cruiserRadarRange === 'function') ? s.cruiserRadarRange() : Math.min(250, 5 * (s.maxHealth || 0));
      }
      
      const shipHp = (s.isCruiser || s.maxHealth > 0) ? (5 + s.maxHealth * 0.5) : ((s.count || 1) * 0.5);
      const extendedRadar = radarRange * 1.5;
      const queryR = Math.max(extendedRadar, LOCAL_QUERY_CAP);
      const queryRSq = queryR * queryR;
      const radarRSq = radarRange * radarRange;
      const extendedRSq = extendedRadar * extendedRadar;

      const nearbyPlanets = usePlanetGrid
        ? this.planetGrid.getPlanetsInRadiusSq(s.x, s.y, queryRSq)
        : this.planets;

      for (let pi = 0; pi < nearbyPlanets.length; pi++) {
         const p = nearbyPlanets[pi];
         const dx = s.x - p.x;
         const dy = s.y - p.y;
         const distSq = dx * dx + dy * dy;
         
         if (distSq <= radarRSq) {
             p._tickShipSensorVisible.add(pId);
         }
         
         if (distSq <= extendedRSq) {
             p._tickShipExtendedSensorVisible.add(pId);
         }
         
         const gr = p._tickGravityRadius || 0;
         if (gr > 0 && gr <= LOCAL_QUERY_CAP && distSq <= gr * gr) {
             p._tickExtraSympathy.set(pId, (p._tickExtraSympathy.get(pId) || 0) + shipHp);
         }
      }
      // Sparse mega-wells only (homeworlds etc.) — typically a handful
      for (let wi = 0; wi < largeWells.length; wi++) {
        const p = largeWells[wi];
        const gr = p._tickGravityRadius;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        if (dx * dx + dy * dy <= gr * gr) {
          p._tickExtraSympathy.set(pId, (p._tickExtraSympathy.get(pId) || 0) + shipHp);
        }
      }
    }
    
    for (const p of this.planets) {
       for (const player of this.allPlayers) {
          const pId = player.id;
          const baseSympathy = p.sympathy ? (p.sympathy[pId] || 0) : 0;
          let extraSympathy = 0;
          
          let isKnown = (!this.settings || !this.settings.fogOfWar) || 
                        (player.discoveredPlanets && player.discoveredPlanets.has(p.id)) ||
                        p._tickShipExtendedSensorVisible.has(pId);
          
          if (isKnown) {
             extraSympathy = p._tickExtraSympathy.get(pId) || 0;
          }
          
          let finalExtra = extraSympathy;
          if (extraSympathy > baseSympathy * 2) {
             finalExtra = baseSympathy * 2 + (extraSympathy - baseSympathy * 2) / 3;
          }
          p._tickEffectiveSympathy.set(pId, baseSympathy + finalExtra);
       }
    }
    
    for (const p of this.planets) {
       p._tickVisibleTo = new Set();
       for (const player of this.allPlayers) {
          const pId = player.id;
          if (pId === 'monsters') continue;
          if (!this.settings || !this.settings.fogOfWar) {
             p._tickVisibleTo.add(pId);
             continue;
          }
          if (p.owner && p.owner.id === pId) {
             p._tickVisibleTo.add(pId);
             continue;
          }
          if (p._tickEffectiveSympathy.get(pId) > 0) {
             p._tickVisibleTo.add(pId);
             continue;
          }
          if (p._tickShipSensorVisible.has(pId)) {
             p._tickVisibleTo.add(pId);
             continue;
          }
          
          let visibleFromOtherPlanet = false;
          
          if (!p.overlappingPlanets || p._lastPlanetCount !== this.planets.length) {
              p.overlappingPlanets = [];
              p._lastPlanetCount = this.planets.length;
              // Spatial rebuild — O(nearby) not O(planets²)
              const selfGr = p._tickGravityRadius || ((typeof p.getGravityRadius === 'function') ? p.getGravityRadius() : 0);
              const searchR = Math.max(selfGr, maxGravityRadius);
              const candidates = (this.planetGridPopulated && this.planetGrid)
                ? this.planetGrid.getPlanetsInRadiusSq(p.x, p.y, searchR * searchR)
                : this.planets;
              for (const otherPl of candidates) {
                  if (otherPl.id === p.id || otherPl.isDeepSpaceAnomaly) continue;
                  const gr = otherPl._tickGravityRadius || ((typeof otherPl.getGravityRadius === 'function') ? otherPl.getGravityRadius() : 0);
                  const dx = otherPl.x - p.x;
                  const dy = otherPl.y - p.y;
                  if (dx * dx + dy * dy <= gr * gr) {
                      p.overlappingPlanets.push(otherPl);
                  }
              }
          }

          for (const otherPl of p.overlappingPlanets) {
             if ((otherPl.owner && otherPl.owner.id === pId) || otherPl._tickEffectiveSympathy.get(pId) > 0) {
                 visibleFromOtherPlanet = true;
                 break;
             }
          }
          
          if (visibleFromOtherPlanet) {
             p._tickVisibleTo.add(pId);
          }
       }
    }
    
    // Market prices now only change through player actions
    const nowTime = Date.now();
    this.boardingReplays = this.boardingReplays.filter(r => nowTime - r.timestamp < 120000);
    if (this.completedBattleReplays) {
      this.completedBattleReplays = this.completedBattleReplays.filter(r => {
        const timeToKeep = Math.max(120000, 10 * (r.duration || 0));
        return nowTime - r.timestamp < timeToKeep;
      });
    }

    for (const player of this.allPlayers) {
      player.wasAlive = player.isAlive !== false;
    }
    this.processAiPhantomUpgradeBuys(deltaTime);
    perfPoints.push({ name: 'pre-players', time: performance.now() });

    if (this.gameStartTime && Date.now() - this.gameStartTime > 5000) {
      if (!this.goldenAmoebaSpawned && this.monsterPlayer) {
        let amoebaCount = 0;
        for (const ship of this.ships) {
          if (ship.active && ship.isAmoeba) amoebaCount++;
        }
        let monsterPlanetCount = 0;
        for (const planet of this.planets) {
          if (planet.owner && planet.owner.id === this.monsterPlayer.id) monsterPlanetCount++;
        }
        if (amoebaCount === 0 && monsterPlanetCount === 0) {
          this.goldenAmoebaSpawned = true;
          this.spawnGoldenAmoeba();
        }
      }
    }

    if (!this.wreckages) this.wreckages = [];
    if (!this.pendingPioneerSpawns) this.pendingPioneerSpawns = [];

    const hwSizeSetting = this.settings && this.settings.homeworldSize;
    const isPioneerMode = hwSizeSetting === 'pioneers' || hwSizeSetting === 'pioneers-corvettes';

    if (isPioneerMode) {
      for (const player of this.allPlayers) {
        if (player.id === 'monsters') continue;

        // 1. Never owned a planet
        if (player.hasOwnedPlanet) continue;

        // 2. Currently has 0 active cruisers
        const hasActiveCruisers = this.ships.some(s => s.active && s.isCruiser && s.owner && s.owner.id === player.id);
        if (hasActiveCruisers) continue;

        // 3. Currently has 0 pending pioneer spawns
        const hasPendingSpawns = this.pendingPioneerSpawns.some(ps => ps.ownerId === player.id);
        if (hasPendingSpawns) continue;

        // 4. Debt floor always from trade ships (no homeworld ownership required)
        const minAllowedCredits = -Math.floor(player.totalTradeShips || 0);

        // 5. Check if credits are above the debt limit (after subtracting 200)
        if (player.credits - 200 >= minAllowedCredits) {
          player.credits -= 200;

          let upgrades = {};
          const potentialUpgrades = ['sensorarrays', 'armor', 'shields', 'engine', 'munitions', 'targeting', 'damagecontrol', 'supply_ship', 'extended_fuel', 'marines', 'command', 'labs', 'diplomat'];
          for (const up of potentialUpgrades) {
            upgrades[up] = 0;
          }

          // Spawns off-screen and warps in to a random playable coordinate
          const rx = 100 + Math.random() * (this.width - 200);
          const ry = 100 + Math.random() * (this.height - 200);

          this.pendingPioneerSpawns.push({
            ownerId: player.id,
            x: rx,
            y: ry,
            classType: 'corvette',
            upgradeTokens: 3,
            upgrades: upgrades,
            timer: 1000, // 1 second delay
            isAdditional: true,
            Pioneer: true,
            cruiserStyle: player.cruiserStyle || 'Federation'
          });

          this.pendingChatMessages = this.pendingChatMessages || [];
          this.pendingChatMessages.push({
            playerId: player.id,
            text: "You ran out of cruisers! Spawning a new rescue Corvette with 3 upgrade tokens for 200 Credits."
          });

          console.log(`[Pioneer Rescue] Spawning rescue Corvette for player ${player.id}. Deducted 200 credits.`);
        }
      }
    }

    // Process pending pioneer ship spawns
    if (this.pendingPioneerSpawns.length > 0) {
      for (let i = this.pendingPioneerSpawns.length - 1; i >= 0; i--) {
        const pSpawn = this.pendingPioneerSpawns[i];
        pSpawn.timer -= deltaTime;
        if (pSpawn.timer <= 0) {
          const player = this.allPlayers.find(p => p.id === pSpawn.ownerId);
          if (player) {
            let spawnX = pSpawn.x;
            let spawnY = pSpawn.y;

            if (pSpawn.isAdditional) {
              const distLeft = pSpawn.x;
              const distRight = this.width - pSpawn.x;
              const distTop = pSpawn.y;
              const distBottom = this.height - pSpawn.y;
              const minDist = Math.min(distLeft, distRight, distTop, distBottom);

              if (minDist === distLeft) {
                spawnX = -200;
              } else if (minDist === distRight) {
                spawnX = this.width + 200;
              } else if (minDist === distTop) {
                spawnY = -200;
              } else {
                spawnY = this.height + 200;
              }
            }

            const classType = pSpawn.classType || 'corvette';
            const hp = SHIP_CLASSES[classType] ? SHIP_CLASSES[classType].hp : 15;
            const ship = new Ship(this.nextShipId++, spawnX, spawnY, null, player, pSpawn.x, pSpawn.y);
            ship.isCruiser = true;
            ship.classType = classType;
            ship.maxHealth = hp;
            ship.health = hp;
            ship.crew = ship.maxHealth + ship.health;
            
            const basePower = Math.floor(hp / 5);
            ship.fuel = basePower * 5;
            ship.speed = Math.max(5, 22 - 5 - basePower);
            if (player.id === 'monsters') {
              ship.speed = Math.max(5, ship.speed - 10);
            }
            if (pSpawn.isAdditional) {
              ship.pioneerWarpIn = true;
              ship.pioneerWarpX = pSpawn.x;
              ship.pioneerWarpY = pSpawn.y;
              ship.isWarp = true;
              ship.speed = 70;
            }
            ship.speedModifier = 1.0;
            ship.expScore = 0;
            ship.cruiserStyle = pSpawn.cruiserStyle || player.cruiserStyle || 'Federation';
            ship.count = 1;
            ship.upgradeTokens = pSpawn.upgradeTokens || 0;
            ship.Pioneer = pSpawn.Pioneer || false;
            ship.isPioneer = pSpawn.Pioneer || false;
            this.assignRandomShipName(ship);

            // Assign upgrades
            for (const up in pSpawn.upgrades) {
              ship[up] = pSpawn.upgrades[up];
            }

            // Apply upgrade side effects
            if (ship.armor) {
              const armorBonus = 4 + 0.10 * hp;
              // Multi-level armor on spawn: one bonus block per level
              const armorLevels = ship.armor || 1;
              for (let al = 0; al < armorLevels; al++) {
                ship.maxArmor = (ship.maxArmor || 0) + armorBonus;
              }
              ship.armorPoints = ship.maxArmor || 0;
            }
            if (ship.munitions) {
              ship.splashDamage = ship.munitions;
            }
            if (ship.supply_ship) {
              ship.maxsupplies = ship.supply_ship * (ship.maxHealth / 2);
            }

            // Load full fuel/shields always; pioneer supply/munitions/armor/marines fill below
            ship.fuel = ship.getMaxFuel();
            ship.bombs = ship.getMaxBombs();
            ship.marineCount = 0;
            ship.supplies = 0;
            ship.shieldPoints = 3 * (ship.shields || 0);

            // Pioneer spawn: begin with full capacity for any of those systems they start with
            if (typeof ship.refreshPioneerUpgradeCapacities === 'function') {
              ship.refreshPioneerUpgradeCapacities();
            }

            this.ships.push(ship);
          }
          this.pendingPioneerSpawns.splice(i, 1);
        }
      }
    }

    // Pioneer auto-dismantle check when a player gains a homeworld
    for (const player of this.allPlayers) {
      if (!player.isAlive) continue;
      const ownsHomeworld = this.planets.some(p => p.homeworldOf === player.id && p.owner && p.owner.id === player.id);
      if (ownsHomeworld) {
        for (const ship of this.ships) {
          if (ship.active && ship.owner && ship.owner.id === player.id && (ship.Pioneer || ship.isPioneer) && !ship.isDismantling) {
            console.log(`[Pioneer auto-dismantle] Dismantling Pioneer ship ${ship.id} for player ${player.id} because they gained a homeworld.`);
            ship.startDismantle(this);
          }
        }
      }
    }
    
    // Store/initialize current total health for all cruisers and amoebas
    for (const ship of this.ships) {
      if (ship.isCruiser || ship.isAmoeba) {
        const isTargetCruiser = ship.isCruiser && !ship.isAmoeba;
        const isTargetAmoeba = ship.isAmoeba;
        let totalHealth = 0;
        if (ship.active) {
          if (isTargetCruiser) {
            totalHealth = ship.health || 0;
          } else if (isTargetAmoeba) {
            totalHealth = Math.floor(ship.health || 0) + ((ship.maxHealth || 0) * ((ship.maxHealth || 0) - 1)) / 2;
          }
        }
        if (ship.lastTotalHealth === undefined) {
          if (ship.isDismantling) {
            ship.lastTotalHealth = 0;
          } else {
            ship.lastTotalHealth = totalHealth;
          }
        } else if (ship.isDismantling) {
          ship.lastTotalHealth = 0;
        }
      }
    }

    this.ships.updateGrid();

    // Update Command Points for all ships based on nearby Command-upgraded friendly cruisers
    for (const s of this.ships) {
      s.commandPoints = 0;
    }

    const commanders = this.ships.filter(s => s.active && s.isCruiser && s.command > 0 && s.maxHealth > 0);

    if (commanders.length > 0) {
      const commandersByPlayer = new Map();
      for (const c of commanders) {
        if (!c.owner) continue;
        if (!commandersByPlayer.has(c.owner.id)) {
          commandersByPlayer.set(c.owner.id, []);
        }
        commandersByPlayer.get(c.owner.id).push(c);
      }

      for (const [playerId, playerCommanders] of commandersByPlayer.entries()) {
        const playerShips = this.ships.filter(s => s.active && s.owner && s.owner.id === playerId);
        for (const ship of playerShips) {
          let sumCP = 0;
          let maxXPBonus = 0;

          for (const cmd of playerCommanders) {
            const sensorRange = cmd.cruiserRadarRange();
            const dx = ship.x - cmd.x;
            const dy = ship.y - cmd.y;
            if (dx * dx + dy * dy <= sensorRange * sensorRange) {
              const xpBonus = Math.sqrt(cmd.expScore || 0);
              const cpContribution = (xpBonus * cmd.command) / 4;
              sumCP += cpContribution;
              if (xpBonus > maxXPBonus) {
                maxXPBonus = xpBonus;
              }
            }
          }

          if (maxXPBonus > 0) {
            const cap = 1.5 * maxXPBonus;
            ship.commandPoints = Math.min(sumCP, cap);
          }
        }
      }
    }

    this.gameTime += deltaTime;

    if (this.scheduledEvents) {
      for (let i = this.scheduledEvents.length - 1; i >= 0; i--) {
        const ev = this.scheduledEvents[i];
        ev.delay -= deltaTime;
        if (ev.delay <= 0) {
          ev.action();
          this.scheduledEvents.splice(i, 1);
        }
      }
    }

    if (this.settings && this.settings.timedGameLimit && this.settings.timedGameLimit !== 'unlimited') {
      if (this.timeRemaining === undefined || this.timeRemaining === null) {
        this.timeRemaining = parseFloat(this.settings.timedGameLimit);
      }
      this.timeRemaining -= deltaTime / 1000;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.triggerTimedGameVictory();
      }
    }

    if (this.settings && this.settings.noRampagers) {
      // No rampagers
    } else {
      // 1. Check if we need to select a new planet for incubation
      if (this.gameTime >= this.nextRampageSelectionTime && !this.incubatingPlanet) {
        const unusedAIs = this.aiPlayers.filter(p => !this.planets.some(pl => pl.owner && pl.owner.id === p.id) && !p.isRampager);
        if (unusedAIs.length > 0) {
          const neutralPlanets = this.planets.filter(p => p.owner === null && !p.rampageIncubating);
          if (neutralPlanets.length > 0) {
            const above110 = neutralPlanets.filter(p => p.maxShips > 110);
            let target;
            if (above110.length > 0) {
              above110.sort((a, b) => a.maxShips - b.maxShips); // smallest first
              target = above110[0];
            } else {
              neutralPlanets.sort((a, b) => b.maxShips - a.maxShips); // largest first
              target = neutralPlanets[0];
            }
            target.rampageIncubating = true;
            this.incubatingPlanet = target;
            this.rampageIncubationTimeRemaining = 180000; // 3 minutes in ms
            console.log(`[Rampage Incubation] Planet ${target.name} (${target.id}) selected for rampage. Begins in 3 minutes.`);

            // Send a chat warning to all human players
            this.pendingChatMessages = this.pendingChatMessages || [];
            for (const p of this.allPlayers) {
              if (!p.isAI) {
                this.pendingChatMessages.push({
                  playerId: p.id,
                  text: `⚠️ WARNING: Pathogenic outbreak detected on Planet ${target.name}! Inimical activity expected in 3 minutes.`
                });
              }
            }
          }
        }
        // Push selection time to infinity so we don't pick multiple
        this.nextRampageSelectionTime = Infinity;
      }

      // 2. Process incubation timer if active
      if (this.incubatingPlanet) {
        if (this.incubatingPlanet.owner !== null) {
          // Planet was captured by a player during incubation! Clear/heal infection.
          console.log(`[Rampage Cured] Planet ${this.incubatingPlanet.name} (${this.incubatingPlanet.id}) captured by player ${this.incubatingPlanet.owner.id}. Incubation cleared.`);
          this.incubatingPlanet.rampageIncubating = false;
          this.incubatingPlanet = null;
          this.rampageIncubationTimeRemaining = 0;
          // Retry selection in 30 seconds
          this.nextRampageSelectionTime = this.gameTime + 30000;
        } else {
          this.rampageIncubationTimeRemaining -= deltaTime;
          if (this.rampageIncubationTimeRemaining <= 0) {
            // Incubation complete! Trigger the actual rampage!
            const target = this.incubatingPlanet;
            target.rampageIncubating = false;
            this.incubatingPlanet = null;

            const unusedAIs = this.aiPlayers.filter(p => !this.planets.some(pl => pl.owner && pl.owner.id === p.id) && !p.isRampager);
            if (unusedAIs.length > 0 && target.owner === null) {
              const rampageAI = unusedAIs[0];
              target.owner = rampageAI;
              rampageAI.isRampager = true;
              target.ships += target.maxShips * 3;
              target.rampageEvent = true;
              target.rampageBoost = true;
              console.log(`[Rampage Triggered] Planet ${target.name} (${target.id}) is now RAMPAGING under player ${rampageAI.id}!`);
            }

            // Schedule the next rampage
            this.rampageInterval = Math.max(720000, this.rampageInterval - 360000);
            this.nextRampageTime = this.gameTime + this.rampageInterval;
            this.nextRampageSelectionTime = Math.max(this.gameTime, this.nextRampageTime - 180000);
          }
        }
      }
    }

    // Ion Storm spawning (~every 5 minutes, +/- 1 min, scaled by map size)
    const hazardScaleUpdate = this.width / 1600;
    const spawnThreshold = 300000 / Math.max(0.1, hazardScaleUpdate);

    this.ionStormSpawnTimer += deltaTime;
    if (this.ionStormSpawnTimer >= spawnThreshold) {
      this.ionStormSpawnTimer = (-60000 + Math.random() * 120000) / Math.max(0.1, hazardScaleUpdate);
      
      let maxStorms = 3;
      if (this.width < 1600) maxStorms = 2;
      else if (this.width > 1600) maxStorms = 4;
      
      const currentStorms = this.ionStorms.filter(st => st.type === 'storm').length;
      if (currentStorms < maxStorms) {
        const stormNames = ['Aether', 'Boreas', 'Zephyr', 'Typhon', 'Eurus', 'Notus', 'Tempest', 'Vortex', 'Maelstrom', 'Cyclone', 'Gale', 'Squall', 'Fury', 'Wrath', 'Havoc', 'Chaos', 'Surge', 'Pulse', 'Flux', 'Rift'];
        const radius = (50 + Math.random() * 350) * (hazardScaleUpdate > 1 ? Math.sqrt(hazardScaleUpdate) : hazardScaleUpdate);
        this.ionStorms.push({
          id: this.nextIonStormId++,
          name: stormNames[Math.floor(Math.random() * stormNames.length)],
          type: 'storm',
          x: radius + Math.random() * (this.width - radius * 2),
          y: radius + Math.random() * (this.height - radius * 2),
          radius: radius,
          intensity: (() => { const numDice = Math.floor(Math.sqrt(this.ionStormsCreated)); let v = 0; for (let d = 0; d < numDice; d++) v += Math.floor(Math.random() * 10) + 1; v += Math.floor(Math.random() * 10) + 1; return v; })(),
          speed: 1 + Math.random() * 9,
          heading: Math.random() * 360,
          knowledge: {}
        });
        this.ionStormsCreated++;
      }
    }

    // Pirate Cruiser Spawning logic
    if (this.pirateSpawnTimer === undefined) {
      this.pirateSpawnTimer = 0;
      this.nextPirateSpawnInterval = 300000; // First spawn not before 5 minutes
    }

    this.pirateSpawnTimer += deltaTime;
    if (this.pirateSpawnTimer >= this.nextPirateSpawnInterval) {
      this.pirateSpawnTimer = 0;
      this.nextPirateSpawnInterval = Math.random() * 120000 + 180000; // Subsequent spawns every 3-5 minutes

      const amoebaCount = this.ships.amoebaCount !== undefined ? this.ships.amoebaCount : this.ships.filter(s => s.active && s.isAmoeba).length;
      const hazardScale = this.width / 1600;
      const maxAmoebasLimit = 8 * hazardScale;

      if (amoebaCount < maxAmoebasLimit && this.monsterPlayer) {
        let spawnX = 0;
        let spawnY = 0;
        let validSpawn = false;
        let attempts = 0;

        while (!validSpawn && attempts < 100) {
          attempts++;
          spawnX = Math.random() * this.width;
          spawnY = Math.random() * this.height;

          let tooClose = false;

          for (const p of this.planets) {
            const dx = p.x - spawnX;
            const dy = p.y - spawnY;
            if (dx * dx + dy * dy <= 400 * 400) {
              tooClose = true;
              break;
            }
          }

          if (!tooClose) {
            for (const s of this.ships) {
              if (s.active && s.owner && s.owner !== this.monsterPlayer) {
                const dx = s.x - spawnX;
                const dy = s.y - spawnY;
                if (dx * dx + dy * dy <= 400 * 400) {
                  tooClose = true;
                  break;
                }
              }
            }
          }

          if (!tooClose) {
            validSpawn = true;
          }
        }

        if (validSpawn) {
          const monstersTechBonus = Math.floor(Math.sqrt(this.monsterPlayer.techScore || 0));
          const monstersExpBonus = Math.floor(Math.sqrt(this.monsterPlayer.expScore || 0));
          const randAdd = Math.floor(Math.random() * 10) + 1; // 1d10
          const maxHealth = 5 + monstersTechBonus + monstersExpBonus + randAdd;

          const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
          const randomStyle = styles[Math.floor(Math.random() * styles.length)];

          const pirate = new Ship(this.nextShipId++, spawnX, spawnY, null, this.monsterPlayer);
          pirate.speed = 22; // Cruisers default to speed 22 before reductions
          pirate.isCruiser = true;
          pirate.count = 1;
          pirate.maxHealth = maxHealth;
          pirate.health = maxHealth;
          pirate.crew = pirate.maxHealth + pirate.health;
          pirate.cruiserStyle = randomStyle;
          const upgradeCapacity = Math.floor(maxHealth / 5);
          const numUpgrades = Math.max(0, upgradeCapacity + Math.floor(Math.random() * 4) + 1 - 2);
          const validUpgrades = ['sensorarrays', 'labs', 'armor', 'shields', 'engine', 'munitions', 'targeting', 'damagecontrol', 'supply_ship', 'extended_fuel', 'diplomat', 'marines', 'command'];
          for (let i = 0; i < numUpgrades; i++) {
            const rUpgrade = validUpgrades[Math.floor(Math.random() * validUpgrades.length)];
            pirate[rUpgrade] = (pirate[rUpgrade] || 0) + 1;
          }

          if (pirate.armor) {
            const bonus = (4 + 0.10 * pirate.maxHealth) * pirate.armor;
            pirate.maxArmor = (pirate.maxArmor || 0) + bonus;
            pirate.armorPoints = (pirate.armorPoints || 0) + bonus;
          }
          if (pirate.munitions) {
            pirate.splashDamage = pirate.munitions;
          }
          if (pirate.supply_ship) {
            pirate.maxsupplies = pirate.supply_ship * (pirate.maxHealth / 2);
            pirate.supplies = 0;
          }

          pirate.fuel = pirate.getMaxFuel();
          pirate.bombs = pirate.getMaxBombs();
          if (pirate.shields) {
            pirate.shieldPoints = pirate.getMaxShields();
          }
          pirate.speed = Math.max(5, pirate.speed - 10);
          pirate.speedModifier = 1.0;

          this.assignRandomShipName(pirate);
          this.ships.push(pirate);
          console.log(`[PIRATE SPAWN] Spawned pirate cruiser ${pirate.id} with style ${randomStyle} and maxHealth ${maxHealth} for Monsters player at (${Math.round(spawnX)}, ${Math.round(spawnY)}).`);
        }
      }
    }

    // 15-second global discount decrease timer
    if (this.globalDiscountTimer === undefined) {
      this.globalDiscountTimer = 0;
    }
    this.globalDiscountTimer += deltaTime;
    if (this.globalDiscountTimer >= 15000) {
      this.globalDiscountTimer = 0;
      
      const availableTypes = Object.keys(this.globalUpgradeModifiers).filter(type => this.globalUpgradeModifiers[type] > -0.50);
      if (availableTypes.length > 0) {
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const randDec = Math.random() * 0.01; // random amount from 0 to 0.01 (0 to 1%)
        this.globalUpgradeModifiers[type] = Math.round(Math.max(-0.50, this.globalUpgradeModifiers[type] - randDec) * 10000) / 10000;
        // console.log(`[GLOBAL DISCOUNT INCREASE] Ticked 15-second global modifier decrease for ${type}. Current modifier: ${this.globalUpgradeModifiers[type]}`);
      }
    }

    // Ion Storm movement and cleanup (skip stationary hazards)
    for (let i = this.ionStorms.length - 1; i >= 0; i--) {
      const storm = this.ionStorms[i];
      if (storm.type === 'minefield' || storm.type === 'nebula') continue;
      const headingRad = storm.heading * Math.PI / 180;
      const movePerSec = storm.speed / 3;
      storm.x += Math.sin(headingRad) * movePerSec * (deltaTime / 1000);
      storm.y += -Math.cos(headingRad) * movePerSec * (deltaTime / 1000);
      // Destroy storm once fully off-map
      if (storm.x + storm.radius < 0 || storm.x - storm.radius > this.width ||
          storm.y + storm.radius < 0 || storm.y - storm.radius > this.height) {
        this.ionStorms.splice(i, 1);
      }
    }

    // Helper to calculate knowledge-accumulation reduction
    const hazardSensorReduction = (x, y, ownerId) => {
      let reduction = 0;
      for (const h of this.ionStorms) {
        if (h.type === 'minefield') continue;
        const hdx = x - h.x, hdy = y - h.y;
        if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
          const owner = this.allPlayers.find(p => p.id === ownerId);
          const k = h.knowledge[ownerId] || 0;
          const tR = owner ? Math.sqrt(owner.techScore || 0) : 0;
          const eR = owner ? Math.sqrt(owner.expScore || 0) : 0;
          const eff = Math.max(0, h.intensity - k - (tR + eR) / 2);
          reduction += eff * 10;
        }
      }
      return reduction;
    };

    for (const ship of this.ships) {
      if (ship.isCruiser) {
        ship.isActivelyResearching = false;
      }
    }

    // Re-initialize research state for this frame
    for (const p of this.planets) {
      if (p.anomaly) {
        p.anomaly.beingResearched = false;
        p.anomaly.researchingShipId = null;
        p.anomaly.researchingShipIds = [];
      }
    }
    const wreckageNow = Date.now();
    this.wreckages = this.wreckages.filter(w => {
      if ((w.amoebaDamage || 0) <= 0 && (w.cruiserDamage || 0) <= 0) return false;
      const isLocked = (wreckageNow - w.lastFightingTime) < 5000;
      if (!isLocked) {
        if ((w.amoebaDamage || 0) <= 0 && (w.cruiserDamage || 0) < 4) {
          return false;
        }
      }
      return true;
    });
    for (const w of this.wreckages) {
      w.beingScanned = false;
      w.scanningShipId = null;
      w.scanningPlayerId = null;
    }
    
    // Combat lockout for wreckage
    for (const w of this.wreckages) {
      let fightingNearby = false;
      for (const ship of this.ships) {
        if (ship.active) {
          const dx = ship.x - w.x;
          const dy = ship.y - w.y;
          if (dx * dx + dy * dy <= 200 * 200) {
            const timeSinceAttack = wreckageNow - (ship.lastTimeAttacking || 0);
            const timeSinceAttacked = wreckageNow - (ship.lastTimeAttacked || 0);
            if (timeSinceAttack < 5000 || timeSinceAttacked < 5000) {
              fightingNearby = true;
              break;
            }
          }
        }
      }
      if (fightingNearby) {
        w.lastFightingTime = wreckageNow;
      }
    }

    // Process research per-planet (planets acting like cruisers with labs)
    for (const p of this.planets) {
      if (p.dead || !p.owner || p.isDeepSpaceAnomaly) continue;

      const isFocusResearch = p.focusMode === 'research';
      if (!isFocusResearch && !p.isResearch) continue;

      const originalLabs = p.labs || 0;
      const focusLabs = p.isResearch ? 2 : 1;
      
      // Duck-type the planet so it works in this.researchAnomaly
      p.labs = originalLabs + focusLabs;
      p.expScore = 0; // Planets don't have xp natively
      p.isActivelyResearching = false;
      
      const gravityRadius = p.getGravityRadius();
      const searchRadiusSq = gravityRadius * gravityRadius;
      
      // 1. Check if completing an anomaly
      let completingPlanet = null;
      for (const targetP of this.planets) {
        if (targetP.anomaly && targetP.anomaly.completing && targetP.anomaly.completingShipId === p.id) {
          completingPlanet = targetP;
          break;
        }
      }
      
      let completedOrResearched = false;
      
      if (completingPlanet) {
        const dx = p.x - completingPlanet.anomaly.x;
        const dy = p.y - completingPlanet.anomaly.y;
        if (dx * dx + dy * dy <= searchRadiusSq) {
          this.researchAnomaly(completingPlanet, p, deltaTime);
          
          completingPlanet.anomaly.completingTimeLeft = (completingPlanet.anomaly.completingTimeLeft || 0) - deltaTime;
          if (completingPlanet.anomaly.completingTimeLeft <= 0) {
            completingPlanet.anomaly.researched = true;
            completingPlanet.anomaly.completing = false;
            this.triggerAnomalyCompletion(completingPlanet, p.owner);
          }
          completedOrResearched = true;
        } else {
          completingPlanet.anomaly.completing = false;
          completingPlanet.anomaly.completingTimeLeft = 0;
          completingPlanet.anomaly.completingShipId = null;
          completingPlanet.anomaly.completingPlayerId = null;
        }
      }
      
      if (!completedOrResearched) {
        // Find best anomaly within gravity well
        let targetAnomaly = null;
        let highestProgress = -1;
        for (const targetP of this.planets) {
          if (!targetP.anomaly || targetP.anomaly.completing || targetP.anomaly.researched) continue;
          
          const currentProgress = (targetP.anomaly.progress && typeof targetP.anomaly.progress === 'object')
            ? (targetP.anomaly.progress[p.owner.id] || 0)
            : (typeof targetP.anomaly.progress === 'number' ? targetP.anomaly.progress : 0);
            
          const dx = p.x - targetP.anomaly.x;
          const dy = p.y - targetP.anomaly.y;
          if (dx * dx + dy * dy <= searchRadiusSq) {
            if (currentProgress > highestProgress || (currentProgress === highestProgress && (!targetAnomaly || targetP.id < targetAnomaly.id))) {
              highestProgress = currentProgress;
              targetAnomaly = targetP;
            }
          }
        }
        
        if (targetAnomaly) {
          this.researchAnomaly(targetAnomaly, p, deltaTime);
          completedOrResearched = true;
        }
      }
      
      // Research hazards (storms and minefields)
      let targetHazard = null;
      for (const storm of this.ionStorms) {
        const dx = storm.x - p.x;
        const dy = storm.y - p.y;
        const distSq = dx * dx + dy * dy;
        const effRadar = gravityRadius;
        if (distSq <= (effRadar + storm.radius) * (effRadar + storm.radius)) {
          if (storm.type === 'minefield') {
            const k = storm.knowledge[p.owner.id] || 0;
            const tR = Math.sqrt(p.owner.techScore || 0);
            const eR = Math.sqrt(p.owner.expScore || 0);
            const effectiveIntensity = Math.max(0, storm.intensity - k - (tR + eR) / 2);
            if (effectiveIntensity > 0 && storm.mines > 0) {
              targetHazard = { type: 'minefield', storm: storm };
              break;
            }
          } else {
            const k = storm.knowledge[p.owner.id] || 0;
            const tR = Math.sqrt(p.owner.techScore || 0);
            const eR = Math.sqrt(p.owner.expScore || 0);
            const effectiveIntensity = Math.max(0, storm.intensity - k - (tR + eR) / 2);
            if (effectiveIntensity > 0) {
              targetHazard = { type: 'storm', storm: storm };
              break;
            }
          }
        }
      }
      
      if (targetHazard) {
        if (!targetHazard.storm.knowledge[p.owner.id]) targetHazard.storm.knowledge[p.owner.id] = 0;
        targetHazard.storm.knowledge[p.owner.id] += (p.labs * deltaTime) / 120000;
        p.isActivelyResearching = true;
        
        const knowledgeGained = (p.labs * deltaTime) / 120000;
        p.owner.techScore = (p.owner.techScore || 0) + knowledgeGained;
        p.accumulatedTech = (p.accumulatedTech || 0) + knowledgeGained;
      }
      
      p.labs = originalLabs;
    }

    // Now process research per-ship
    for (const ship of this.ships) {
      if (ship.active && ship.isCruiser && ship.owner) {
        const hasLabs = (ship.labs || 0) > 0;
        const finalCruiserRadar = ship.cruiserRadarRange();
        const red = hazardSensorReduction(ship.x, ship.y, ship.owner.id);
        const effRadar = Math.max(10, finalCruiserRadar - red);

        // 1. Check if this ship is currently completing an anomaly
        let completingPlanet = null;
        for (const p of this.planets) {
          if (p.anomaly && p.anomaly.completing && p.anomaly.completingShipId === ship.id) {
            completingPlanet = p;
            break;
          }
        }
        let completedOrResearchedAnomalyOrWreckage = false;

        // Targeted anomaly within 50px check (research even if not idle / moving)
        if (!completedOrResearchedAnomalyOrWreckage) {
          let targetedAnomalyPlanet = null;
          if (ship.targetPlanet && ship.targetPlanet.anomaly && !ship.targetPlanet.anomaly.researched && !ship.targetPlanet.anomaly.completing) {
            targetedAnomalyPlanet = ship.targetPlanet;
          }
          if (!targetedAnomalyPlanet && ship.cruiserTargetType === 'planet' && ship.cruiserTargetId !== null) {
            const p = this.planets.find(pl => pl.id === ship.cruiserTargetId);
            if (p && p.anomaly && !p.anomaly.researched && !p.anomaly.completing) {
              targetedAnomalyPlanet = p;
            }
          }
          if (targetedAnomalyPlanet) {
            const currentProgress = (targetedAnomalyPlanet.anomaly.progress && typeof targetedAnomalyPlanet.anomaly.progress === 'object')
              ? (targetedAnomalyPlanet.anomaly.progress[ship.owner.id] || 0)
              : (typeof targetedAnomalyPlanet.anomaly.progress === 'number' ? targetedAnomalyPlanet.anomaly.progress : 0);
            const canResearch = hasLabs || currentProgress >= targetedAnomalyPlanet.anomaly.difficulty;

            if (canResearch) {
              const adx = ship.x - targetedAnomalyPlanet.anomaly.x;
              const ady = ship.y - targetedAnomalyPlanet.anomaly.y;
              const aDist = Math.sqrt(adx * adx + ady * ady);
              if (aDist <= 50) {
                this.researchAnomaly(targetedAnomalyPlanet, ship, deltaTime);
                completedOrResearchedAnomalyOrWreckage = true;
              }
            }
          }
        }

        if (completingPlanet) {
          const dx = ship.x - completingPlanet.anomaly.x;
          const dy = ship.y - completingPlanet.anomaly.y;
          if (dx*dx + dy*dy <= effRadar * effRadar) {
            completingPlanet.anomaly.beingResearched = true;
            completingPlanet.anomaly.researchingShipId = ship.id;
            if (!completingPlanet.anomaly.researchingShipIds) completingPlanet.anomaly.researchingShipIds = [];
            if (!completingPlanet.anomaly.researchingShipIds.includes(ship.id)) completingPlanet.anomaly.researchingShipIds.push(ship.id);
            ship.isActivelyResearching = true;

            completingPlanet.anomaly.completingTimeLeft = (completingPlanet.anomaly.completingTimeLeft || 0) - deltaTime;
            if (completingPlanet.anomaly.completingTimeLeft <= 0) {
              completingPlanet.anomaly.researched = true;
              completingPlanet.anomaly.completing = false;
              this.triggerAnomalyCompletion(completingPlanet, ship.owner);
            }
            completedOrResearchedAnomalyOrWreckage = true;
          } else {
            completingPlanet.anomaly.completing = false;
            completingPlanet.anomaly.completingTimeLeft = 0;
            completingPlanet.anomaly.completingShipId = null;
            completingPlanet.anomaly.completingPlayerId = null;
          }
        }

        // 2. Decide next research task based on priority:
        if (!completedOrResearchedAnomalyOrWreckage) {
          // Priority 1: claimable wreckage
          let claimableWreckage = null;
          let minWreckDistSq = Infinity;
          for (const w of this.wreckages) {
            const isLocked = (wreckageNow - w.lastFightingTime) < 5000;
            if (!isLocked && !w.beingScanned) {
              const dx = w.x - ship.x;
              const dy = w.y - ship.y;
              const distSq = dx * dx + dy * dy;
              if (distSq <= effRadar * effRadar && distSq < minWreckDistSq) {
                minWreckDistSq = distSq;
                claimableWreckage = w;
              }
            }
          }

          if (claimableWreckage) {
            claimableWreckage.beingScanned = true;
            claimableWreckage.scanningShipId = ship.id;
            claimableWreckage.scanningPlayerId = ship.owner.id;
            ship.isActivelyResearching = true;

            claimableWreckage.scanTimeLeft = (claimableWreckage.scanTimeLeft !== undefined ? claimableWreckage.scanTimeLeft : 3000) - deltaTime;
            completedOrResearchedAnomalyOrWreckage = true;
          }
        }

        if (!completedOrResearchedAnomalyOrWreckage) {
          // Priority 2: anomaly <= 3
          let anomalyLow = null;
          let minLowDistSq = Infinity;
          for (const p of this.planets) {
            if (p.anomaly && !p.anomaly.researched && !p.anomaly.completing) {
              const currentProgress = (p.anomaly.progress && typeof p.anomaly.progress === 'object')
                ? (p.anomaly.progress[ship.owner.id] || 0)
                : (typeof p.anomaly.progress === 'number' ? p.anomaly.progress : 0);
              const canResearch = p.anomaly.difficulty <= 0 || hasLabs || currentProgress >= p.anomaly.difficulty;
              if (canResearch && p.anomaly.difficulty <= 3) {
                const dx = p.anomaly.x - ship.x;
                const dy = p.anomaly.y - ship.y;
                const distSq = dx * dx + dy * dy;
                if (distSq <= effRadar * effRadar && distSq < minLowDistSq) {
                  minLowDistSq = distSq;
                  anomalyLow = p;
                }
              }
            }
          }

          if (anomalyLow) {
            this.researchAnomaly(anomalyLow, ship, deltaTime);
            completedOrResearchedAnomalyOrWreckage = true;
          }
        }

        // Priority 3: hazards (storms and minefields)
        // Research vessels (hasLabs) can simultaneously research a hazard even if they did an anomaly/wreckage!
        if (hasLabs) {
          let targetHazard = null;
          for (const storm of this.ionStorms) {
            const dx = storm.x - ship.x;
            const dy = storm.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= effRadar + storm.radius) {
              if (storm.type === 'minefield') {
                const k = storm.knowledge[ship.owner.id] || 0;
                const tR = Math.sqrt(ship.owner.techScore || 0);
                const eR = Math.sqrt(ship.owner.expScore || 0);
                const effectiveIntensity = Math.max(0, storm.intensity - k - (tR + eR) / 2);
                if (effectiveIntensity > 0 && storm.mines > 0) {
                  targetHazard = { type: 'minefield', storm: storm };
                  break;
                }
              } else {
                const k = storm.knowledge[ship.owner.id] || 0;
                const tR = Math.sqrt(ship.owner.techScore || 0);
                const eR = Math.sqrt(ship.owner.expScore || 0);
                const effectiveIntensity = Math.max(0, storm.intensity - k - (tR + eR) / 2);
                if (effectiveIntensity > 0) {
                  targetHazard = { type: 'storm', storm: storm };
                  break;
                }
              }
            }
          }

          if (targetHazard) {
            if (targetHazard.type === 'storm') {
              if (!targetHazard.storm.knowledge[ship.owner.id]) targetHazard.storm.knowledge[ship.owner.id] = 0;
              targetHazard.storm.knowledge[ship.owner.id] += (ship.labs * deltaTime) / 120000;
              
              ship.isActivelyResearching = true;
              const xpMultiplier = 1 + (ship.getLocalXpBonus() * 3) / 100;
              const knowledgeGained = (ship.labs * deltaTime * xpMultiplier) / 120000;
              ship.owner.techScore = (ship.owner.techScore || 0) + knowledgeGained;
              ship.accumulatedTech = (ship.accumulatedTech || 0) + knowledgeGained;
              
              if (ship.accumulatedTech >= 1.0) {
                const completions = Math.floor(ship.accumulatedTech);
                ship.accumulatedTech -= completions;
                ship.gainXp(completions, this, ship.x, ship.y);
              }
            } else {
              // Minefield
              if (!targetHazard.storm.knowledge[ship.owner.id]) targetHazard.storm.knowledge[ship.owner.id] = 0;
              targetHazard.storm.knowledge[ship.owner.id] += (ship.labs * deltaTime) / 120000;
              
              ship.isActivelyResearching = true;
              const xpMultiplier = 1 + (ship.getLocalXpBonus() * 3) / 100;
              const knowledgeGained = (ship.labs * deltaTime * xpMultiplier) / 120000;
              ship.owner.techScore = (ship.owner.techScore || 0) + knowledgeGained;
              ship.accumulatedTech = (ship.accumulatedTech || 0) + knowledgeGained;
              
              if (ship.accumulatedTech >= 1.0) {
                const completions = Math.floor(ship.accumulatedTech);
                ship.accumulatedTech -= completions;
                ship.gainXp(completions, this, ship.x, ship.y);
                
                if (ship.scoutAttackEnabled === true) {
                  const cap = Math.floor(ship.health - 2);
                  let volleySize = Math.max(1, Math.floor((ship.maxHealth + ship.health) / 6));
                  if (volleySize > cap) volleySize = cap;
                  if (ship.supply_ship && ship.supply_ship > 0) {
                    volleySize = Math.max(1, volleySize - 2 * ship.supply_ship);
                  }
                  if (ship.health <= 2) volleySize = 0;

                  const hitChance = Math.min(1.0, Math.max(0.0, ship.getAccuracy() + 0.10 * ship.labs));
                  let minesDestroyed = 0;
                  const rangeOfFire = ship.getWeaponRange();

                  for (let v = 0; v < volleySize; v++) {
                    let tx = 0;
                    let ty = 0;
                    let found = false;
                    for (let attempt = 0; attempt < 100; attempt++) {
                      const angle = Math.random() * Math.PI * 2;
                      const r = Math.random() * targetHazard.storm.radius;
                      const px = targetHazard.storm.x + Math.cos(angle) * r;
                      const py = targetHazard.storm.y + Math.sin(angle) * r;
                      const sDx = px - ship.x;
                      const sDy = py - ship.y;
                      if (sDx * sDx + sDy * sDy <= rangeOfFire * rangeOfFire) {
                        tx = px;
                        ty = py;
                        found = true;
                        break;
                      }
                    }

                    if (!found) continue;

                    const isHit = (targetHazard.storm.mines > 0) && (Math.random() < hitChance);
                    if (isHit) {
                      targetHazard.storm.mines -= 1;
                      minesDestroyed += 1;
                    }

                    const delayMs = v * 500;
                    const shipId = ship.id;
                    const finalTx = tx;
                    const finalTy = ty;

                    this.scheduledEvents.push({
                      delay: delayMs,
                      action: () => {
                        const currentShip = this.ships.find(s => s.id === shipId);
                        if (currentShip && currentShip.active) {
                          this.lasers.push({
                            startX: currentShip.x,
                            startY: currentShip.y,
                            endX: finalTx,
                            endY: finalTy,
                            color: '#44f',
                            age: 0,
                            duration: 0.4
                          });
                        }
                        if (isHit) {
                          this.explosions.push({
                            x: finalTx,
                            y: finalTy,
                            color: '#44f',
                            age: 0,
                            isHazard: true
                          });
                          this.explosions.push({
                            x: finalTx,
                            y: finalTy,
                            isDollarSign: true,
                            amount: 1,
                            remainingMines: targetHazard.storm.mines,
                            age: 0
                          });
                        }
                      }
                    });
                  }

                  if (minesDestroyed > 0) {
                    ship.owner.credits = (ship.owner.credits || 0) + minesDestroyed;
                    ship.creditsGainedEvent = (ship.creditsGainedEvent || 0) + minesDestroyed;
                  }
                } else {
                  ship.beakerIncreaseEvent = (ship.beakerIncreaseEvent || 0) + completions;
                }
                
                if (targetHazard.storm.initialMines > 0) {
                  targetHazard.storm.radius = targetHazard.storm.initialRadius * (targetHazard.storm.mines / targetHazard.storm.initialMines);
                }
              }
            }
          }
        }

        // Priority 4: lowest level anomaly in range after that
        if (!completedOrResearchedAnomalyOrWreckage) {
          let anomalyHigh = null;
          let minHighDifficulty = Infinity;
          let minHighDistSq = Infinity;
          for (const p of this.planets) {
            if (p.anomaly && !p.anomaly.researched && !p.anomaly.completing) {
              const currentProgress = (p.anomaly.progress && typeof p.anomaly.progress === 'object')
                ? (p.anomaly.progress[ship.owner.id] || 0)
                : (typeof p.anomaly.progress === 'number' ? p.anomaly.progress : 0);
              const canResearch = p.anomaly.difficulty <= 0 || hasLabs || currentProgress >= p.anomaly.difficulty;
              if (canResearch && p.anomaly.difficulty > 3) {
                const dx = p.anomaly.x - ship.x;
                const dy = p.anomaly.y - ship.y;
                const distSq = dx * dx + dy * dy;
                if (distSq <= effRadar * effRadar) {
                  if (p.anomaly.difficulty < minHighDifficulty || 
                      (p.anomaly.difficulty === minHighDifficulty && distSq < minHighDistSq)) {
                    minHighDifficulty = p.anomaly.difficulty;
                    minHighDistSq = distSq;
                    anomalyHigh = p;
                  }
                }
              }
            }
          }

          if (anomalyHigh) {
            this.researchAnomaly(anomalyHigh, ship, deltaTime);
          }
        }
      }
    }
    
    // 4. Resolve completed wreckage scans
    for (let i = this.wreckages.length - 1; i >= 0; i--) {
      const w = this.wreckages[i];
      if (w.scanTimeLeft !== undefined && w.scanTimeLeft <= 0) {
        const player = this.allPlayers.find(p => p.id === w.scanningPlayerId);
        const ship = this.ships.find(s => s.id === w.scanningShipId);
        if (player) {
          if (w.amoebaDamage > 10) {
            // Spawn Deep Space Anomaly
            const difficulty = Math.floor(w.amoebaDamage / 10);
            this.spawnNewDeepSpaceAnomaly(w.x, w.y, player, ship ? ship.name : 'Cruiser', difficulty);
            
            this.pendingChatMessages = this.pendingChatMessages || [];
            this.pendingChatMessages.push({
              playerId: player.id,
              text: `Wreckage salvage triggered a new Deep Space Anomaly due to concentrated Amoeba residue!`
            });
            
            w.amoebaDamage = 0;
            if ((w.cruiserDamage || 0) <= 0) {
              this.wreckages.splice(i, 1);
            } else {
              w.lastFightingTime = Date.now();
              w.scanTimeLeft = 3000;
            }
          } else {
            // Reward credits: (amoebaDamage * 2 + cruiserDamage) * (1 + random 100%)
            const randMultiplier = 1.0 + Math.random();
            const baseVal = w.amoebaDamage * 2 + w.cruiserDamage;
            const rewardCredits = Math.round(baseVal * randMultiplier);
            player.credits = (player.credits || 0) + rewardCredits;
            
            this.pendingChatMessages = this.pendingChatMessages || [];
            this.pendingChatMessages.push({
              playerId: player.id,
              text: `Wreckage successfully salvaged: Received +${rewardCredits} Credits!`
            });
            
            this.pendingAnomalyCompletions = this.pendingAnomalyCompletions || [];
            this.pendingAnomalyCompletions.push({
              playerId: player.id,
              x: w.x,
              y: w.y,
              text: `+${rewardCredits} Credits`
            });
            
            this.wreckages.splice(i, 1);
          }
        } else {
          this.wreckages.splice(i, 1);
        }
      }
    }


    // AI planets gaining knowledge from overlapping hazards (1 knowledge every 3 minutes)
    for (const storm of this.ionStorms) {
      for (const planet of this.planets) {
        if (planet.owner && planet.owner.isAI) {
          const dx = planet.x - storm.x;
          const dy = planet.y - storm.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const gravityRadius = planet.getGravityRadius();
          if (dist <= gravityRadius + storm.radius) {
            const aiId = planet.owner.id;
            if (!storm.knowledge[aiId]) storm.knowledge[aiId] = 0;
            storm.knowledge[aiId] += deltaTime / 180000;
          }
        }
      }
    }

    // Ion Storm / Minefield ship damage (every second) ... skip nebulae
    this.ionStormDamageTimer += deltaTime;
    if (this.ionStormDamageTimer >= 1000) {
      this.ionStormDamageTimer -= 1000;
      for (const storm of this.ionStorms) {
        if (storm.type !== 'storm') continue;
        const explosionColor = '#ff0';
        for (const ship of this.ships) {
          if (!ship.active || !ship.owner) continue;
          if (ship.isAmoeba) continue;
          
          const dx = ship.x - storm.x;
          const dy = ship.y - storm.y;
          if (dx * dx + dy * dy <= storm.radius * storm.radius) {
            // Determine if moving
            let isMoving = false;
            if (ship.targetPlanet) {
              const pdx = ship.targetPlanet.x - ship.x;
              const pdy = ship.targetPlanet.y - ship.y;
              if (pdx * pdx + pdy * pdy > (ship.targetPlanet.radius + 1) * (ship.targetPlanet.radius + 1)) {
                isMoving = true;
              }
            } else if (ship.targetX !== null && ship.targetY !== null && ship.targetX !== undefined && ship.targetY !== undefined) {
              const pdx = ship.targetX - ship.x;
              const pdy = ship.targetY - ship.y;
              if (pdx * pdx + pdy * pdy >= 25) { // 5 squared
                isMoving = true;
              }
            }

            const knowledge = storm.knowledge[ship.owner.id] || 0;
            const techRed = Math.sqrt(ship.owner.techScore || 0);
            const expRed = Math.sqrt(ship.owner.expScore || 0);
            const shipExpRed = ship.getLocalXpBonus();

            let risk = Math.max(0, storm.intensity - knowledge - (techRed + expRed) / 2 - shipExpRed);
            if (!isMoving) {
              risk *= 0.25;
            }

            if (risk > 0 && Math.random() * 100 < risk) {
              this.explosions.push({ x: ship.x, y: ship.y, color: explosionColor, age: 0, isHazard: true });
              const boltX = ship.x + (Math.random() - 0.5) * 80;
              const boltY = ship.y - 30 - Math.random() * 50;
              const midX = (ship.x + boltX) / 2 + (Math.random() - 0.5) * 40;
              const midY = (ship.y + boltY) / 2 + (Math.random() - 0.5) * 20;
              this.lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
              this.lasers.push({ startX: midX, startY: midY, endX: ship.x, endY: ship.y, color: explosionColor, age: 0, duration: 0.4 });

              if (ship.maxHealth > 0) {
                // Cruiser
                ship.health -= 1;
                if (ship.health <= 0) {
                  ship.active = false;
                }
              } else {
                // Standard fleet
                const pct = 0.05 + Math.random() * 0.10;
                const destroyedCount = Math.max(1, Math.floor(ship.count * pct));
                ship.count -= destroyedCount;
                if (ship.count <= 0) {
                  ship.count = 0;
                  ship.active = false;
                }
              }
            }
          }
        }
      }
    }


    // Minefield damage and lab mining check (every 1 second)
    this.minefieldDamageTimer += deltaTime;
    if (this.minefieldDamageTimer >= 1000) {
      this.minefieldDamageTimer -= 1000;
      for (let i = this.ionStorms.length - 1; i >= 0; i--) {
        const storm = this.ionStorms[i];
        if (storm.type !== 'minefield') continue;

        // 2. Perform damage check for all active ships inside the minefield
        for (const ship of this.ships) {
          if (!ship.active || !ship.owner || ship.isAmoeba) continue;

          const dx = ship.x - storm.x;
          const dy = ship.y - storm.y;
          if (dx * dx + dy * dy <= storm.radius * storm.radius) {
            // Determine if moving
            let isMoving = false;
            if (ship.targetPlanet) {
              const pdx = ship.targetPlanet.x - ship.x;
              const pdy = ship.targetPlanet.y - ship.y;
              if (pdx * pdx + pdy * pdy > (ship.targetPlanet.radius + 1) * (ship.targetPlanet.radius + 1)) {
                isMoving = true;
              }
            } else if (ship.targetX !== null && ship.targetY !== null && ship.targetX !== undefined && ship.targetY !== undefined) {
              const pdx = ship.targetX - ship.x;
              const pdy = ship.targetY - ship.y;
              if (pdx * pdx + pdy * pdy >= 25) { // 5 squared
                isMoving = true;
              }
            }

            if (!isMoving) continue;

            const knowledge = storm.knowledge[ship.owner.id] || 0;
            const techRed = Math.sqrt(ship.owner.techScore || 0);
            const expRed = Math.sqrt(ship.owner.expScore || 0);
            const shipExpRed = ship.getLocalXpBonus();
            const effectiveIntensity = Math.max(0, storm.intensity - knowledge - (techRed + expRed) / 2 - shipExpRed);

            if (Math.random() * 100 < effectiveIntensity) {
              let mineRemoved = false;
              if (ship.maxHealth > 0) {
                // Cruiser
                const roll = Math.floor(Math.random() * 6) + 1;
                const damage = ship.owner.isAI ? roll * 0.25 : roll;
                ship.health -= damage;
                mineRemoved = true;
                if (ship.health <= 0) {
                  ship.active = false;
                }
              } else {
                // Standard fleet
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const d3 = Math.floor(Math.random() * 6) + 1;
                const pct = (d1 + d2 + d3) / 100;
                const finalPct = ship.owner.isAI ? (pct / 4) : pct;

                let destroyedCount = Math.round(ship.count * finalPct);
                if (destroyedCount === 0 && ship.count > 0 && finalPct > 0) {
                  destroyedCount = 1;
                }
                destroyedCount = Math.min(ship.count, destroyedCount);
                if (destroyedCount > 0) {
                  ship.count -= destroyedCount;
                  mineRemoved = true;
                  if (ship.count <= 0) {
                    ship.count = 0;
                    ship.active = false;
                  }
                }
              }

              if (mineRemoved) {
                storm.mines = Math.max(0, storm.mines - 1);
                if (storm.initialMines > 0) {
                  storm.radius = storm.initialRadius * (storm.mines / storm.initialMines);
                }
                this.explosions.push({ x: ship.x, y: ship.y, color: '#44f', age: 0, isHazard: true });
                const boltX = ship.x + (Math.random() - 0.5) * 80;
                const boltY = ship.y - 30 - Math.random() * 50;
                const midX = (ship.x + boltX) / 2 + (Math.random() - 0.5) * 40;
                const midY = (ship.y + boltY) / 2 + (Math.random() - 0.5) * 20;
                this.lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: '#44f', age: 0, duration: 0.4 });
                this.lasers.push({ startX: midX, startY: midY, endX: ship.x, endY: ship.y, color: '#44f', age: 0, duration: 0.4 });
              }
            }
          }
        }

        // 3. Remove minefield if reduced below 8 mines
        if (storm.mines < 8) {
          console.log(`[Minefield Removed] Minefield ${storm.name} (id: ${storm.id}) has less than 8 mines remaining (${storm.mines}).`);
          this.ionStorms.splice(i, 1);
        }
      }
    }
    this.planetDepletionTimer = (this.planetDepletionTimer || 0) + deltaTime;
    if (this.planetDepletionTimer >= 1000) {
      this.planetDepletionTimer -= 1000;
      for (const storm of this.ionStorms) {
        if (storm.type === 'nebula') continue;
        if (storm.type !== 'minefield') {
          const explosionColor = '#ff0';
          for (const planet of this.planets) {
            if (!planet.owner) continue;
            const dx = planet.x - storm.x;
            const dy = planet.y - storm.y;
            if (dx * dx + dy * dy <= storm.radius * storm.radius) {
              const knowledge = storm.knowledge[planet.owner.id] || 0;
              const techRed = Math.sqrt(planet.owner.techScore || 0);
              const expRed = Math.sqrt(planet.owner.expScore || 0);
              const lastStandBonus = (planet.owner.planetCount === 1) ? 20 : 0;
              const eff = Math.max(0, storm.intensity - knowledge - (techRed + expRed) / 2 - lastStandBonus);
              // eff % / 25 per second chance
              const chance = eff / 2500;
              if (chance > 0 && Math.random() < chance) {
                planet.maxShips--;
                planet.radius = planet.maxShips / 4;
                planet.capacityDecreaseEvent = true;
                const limit = (planet.owner && !planet.owner.isAI && planet.focusMode === 'garrison') ? planet.maxShips * 2 : planet.maxShips;
                if (planet.ships > limit) planet.ships = limit;
                if (planet.maxShips < 5) {
                  planet.dead = true;
                }
                // Lightning bolt effect
                const boltX = planet.x + (Math.random() - 0.5) * planet.radius * 2;
                const boltY = planet.y - 30 - Math.random() * 50;
                const midX = (planet.x + boltX) / 2 + (Math.random() - 0.5) * 40;
                const midY = (planet.y + boltY) / 2 + (Math.random() - 0.5) * 20;
                this.lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
                this.lasers.push({ startX: midX, startY: midY, endX: planet.x, endY: planet.y, color: explosionColor, age: 0, duration: 0.4 });
              }
            }
          }
        }
      }
    }

    // Amoeba Hive Spawning
    for (const p of this.planets) {
      if (p.isAmoebaHive && p.owner && p.owner.id === this.monsterPlayer.id) {
        p.amoebaSpawnTimer = (p.amoebaSpawnTimer || 0) + deltaTime;
        if (p.amoebaSpawnTimer >= 120000) {
          p.amoebaSpawnTimer -= 120000;
          const amoeba = new Ship(this.nextShipId++, p.x, p.y, null, this.monsterPlayer, p.x + (Math.random()-0.5)*200, p.y + (Math.random()-0.5)*200);
          amoeba.isAmoeba = true;
          amoeba.cruiserStyle = p.racialAffinity;
          let speed = 0;
          for (let d = 0; d < 4; d++) speed += Math.floor(Math.random() * 6) + 1;
          amoeba.speed = speed;
          const initialHealth = (Math.floor(Math.random()*2)+1) + (Math.floor(Math.random()*2)+1) + (Math.floor(Math.random()*2)+1) + 1;
          amoeba.maxHealth = initialHealth;
          amoeba.health = initialHealth;
          this.ships.push(amoeba);
        }
      }
    }

    let cooldownMs = 0;
    if (this.settings) {
      const aiEntry = this.settings.aiEntry || 'mid';
      const gameLimit = (this.settings.timedGameLimit && this.settings.timedGameLimit !== 'unlimited')
        ? parseFloat(this.settings.timedGameLimit)
        : null;

      if (aiEntry === 'start') {
        cooldownMs = 0;
      } else if (aiEntry === 'early') {
        cooldownMs = (gameLimit !== null ? 0.20 * gameLimit : 20 * 60) * 1000;
      } else if (aiEntry === 'mid') {
        cooldownMs = (gameLimit !== null ? 0.40 * gameLimit : 40 * 60) * 1000;
      } else if (aiEntry === 'late') {
        cooldownMs = (gameLimit !== null ? 0.60 * gameLimit : 60 * 60) * 1000;
      } else if (aiEntry === 'custom') {
        const customMin = this.settings.customAiEntryMin !== undefined ? parseFloat(this.settings.customAiEntryMin) : 5;
        cooldownMs = (isNaN(customMin) ? 5 : customMin) * 60 * 1000;
      }
    }

    if (this.gameTime >= cooldownMs) {
      if (this.pendingAIs && this.pendingAIs.length > 0) {
        this.aiSpawnTimer += deltaTime;
        if (this.aiSpawnTimer >= this.aiSpawnInterval) {
          this.aiSpawnTimer -= this.aiSpawnInterval;
          const aiToSpawn = this.pendingAIs.shift();
          if (this.assignPlanet(aiToSpawn)) {
            const aiHomeworld = this.planets.find(p => p.owner && p.owner.id === aiToSpawn.id);
            if (aiHomeworld) {
              for (const storm of this.ionStorms) {
                if (storm.type === 'minefield') {
                  const dx = aiHomeworld.x - storm.x;
                  const dy = aiHomeworld.y - storm.y;
                  if (dx * dx + dy * dy <= storm.radius * storm.radius) {
                    storm.knowledge[aiToSpawn.id] = (storm.knowledge[aiToSpawn.id] || 0) + 20;
                  }
                }
              }
            }
          }
        }
      }
    }

    for (const ai of this.aiControllers) {
      ai.update(deltaTime);
    }
    
    for (const player of this.allPlayers) {
      player.totalShips = 0;
      player.totalCapacity = 0;
      player.isAlive = false;
      player.planetCount = 0;
      if (player.spyRootedEvents) player.spyRootedEvents.clear();
      
      if (player.attackedPlanets) {
        for (const [planetId, timer] of player.attackedPlanets.entries()) {
          const newTimer = timer - deltaTime;
          if (newTimer <= 0) {
            player.attackedPlanets.delete(planetId);
            if (!player.spyRootedEvents) player.spyRootedEvents = new Set();
            player.spyRootedEvents.add(planetId);
          } else {
            player.attackedPlanets.set(planetId, newTimer);
          }
        }
      }
    }
    
    this.galacticCapacity = 0;
    for (const planet of this.planets) {
      this.galacticCapacity += planet.maxShips;
      if (planet.owner) {
        planet.owner.totalCapacity += planet.maxShips;
        planet.owner.isAlive = true;
        planet.owner.planetCount++;
        planet.owner.totalShips += planet.ships;
      }
    }

    for (const ship of this.ships) {
      if (ship.active && ship.owner) {
        ship.owner.isAlive = true;
        if (!ship.isCruiser) {
          ship.owner.totalShips += (ship.count || 1);
        }
      }
    }

    for (const player of this.allPlayers) {
      if (this.pendingPioneerSpawns && this.pendingPioneerSpawns.some(ps => ps.ownerId === player.id)) {
        player.isAlive = true;
      }
    }

    // Residual foothold: >10 sympathy on any planet keeps the player alive
    // (e.g. after losing last planet/ship but still have a claim via sympathy).
    for (const planet of this.planets) {
      if (!planet.sympathy) continue;
      for (const player of this.allPlayers) {
        if (player.isAlive || player.id === 'monsters') continue;
        const sym = planet.sympathy[player.id] || 0;
        if (sym > 10) {
          player.isAlive = true;
        }
      }
    }

    for (const player of this.allPlayers) {
      // Comeback (sympathy / reassigned homeworld / new ships): allow re-elimination loot later
      if (player.isAlive && player.isEliminated) {
        player.isEliminated = false;
      }
      player.cruiserCount = this.ships.filter(s => s.active && s.owner && s.owner.id === player.id && s.isCruiser).length;
      player.commandCount = this.ships
        .filter(s => s.active && s.owner && s.owner.id === player.id && s.isCruiser)
        .reduce((sum, s) => sum + Math.floor((s.maxHealth || 0) / 10), 0);
    }

    // Reduce game speed based on successful human players (more than 5 planets + cruisers, then 10, etc.)
    for (const player of this.allPlayers) {
      if (player && !player.isAI) {
        const score = (player.planetCount || 0) + (player.cruiserCount || 0);
        if (score > 5) {
          const milestone = 5 + 5 * Math.floor((score - 5) / 5);
          this.highestSpeedMilestoneTriggered = this.highestSpeedMilestoneTriggered || 0;
          if (milestone > this.highestSpeedMilestoneTriggered) {
            this.highestSpeedMilestoneTriggered = milestone;
            const newSpeed = Math.max(0.3, 1.0 - 0.1 * (milestone / 5));
            this.gameSpeed = newSpeed;
            
            this.pendingChatMessages = this.pendingChatMessages || [];
            this.pendingChatMessages.push({
              playerId: 'all',
              text: `⚠️ Game speed has been reduced to ${Math.round(newSpeed * 100)}% because of a successful player (${player.name || player.id} is controlling ${score} units)!`
            });
          }
        }
      }
    }

    // Calculate Pirate Activity and Pirate Income for all players
    for (const p of this.allPlayers) {
      p.pirateActivity = 0;
      p.pirateIncome = 0;
    }

    for (const planet of this.planets) {
      if (planet.dead || !planet.owner) continue;

      // Calculate effective ships at this planet (Commerce worlds count double/quadruple)
      let effShips = planet.ships;
      if (planet.focusMode === 'commerce') {
        const isFull = planet.ships >= planet.maxShips;
        effShips = isFull ? planet.ships * 2 : planet.ships * 1.5;
        if (planet.minerals && planet.minerals > 4) {
          effShips *= (planet.minerals / 4);
        }
      }

      // Group enemy cruisers/amoebas max health in the planet's gravity well by owner
      const enemyMaxHealthByOwner = new Map();
      let totalEnemyMaxHealth = 0;

      for (const ship of this.ships) {
        if (ship.active && (ship.isCruiser || ship.isAmoeba) && ship.owner && ship.owner.id !== planet.owner.id) {
          const dx = ship.x - planet.x;
          const dy = ship.y - planet.y;
          const gr = planet.getGravityRadius();
          if (dx * dx + dy * dy <= gr * gr) {
            const hp = ship.maxHealth || 0;
            if (hp > 0) {
              enemyMaxHealthByOwner.set(ship.owner.id, (enemyMaxHealthByOwner.get(ship.owner.id) || 0) + hp);
              totalEnemyMaxHealth += hp;
            }
          }
        }
      }

      if (totalEnemyMaxHealth > 0) {
        // Pirate Activity equals 10 times maxhealth, capped at total effective ships
        const rawActivity = totalEnemyMaxHealth * 10;
        const activity = Math.min(rawActivity, effShips);

        // Deduct from planet owner's pirate activity
        planet.owner.pirateActivity = (planet.owner.pirateActivity || 0) + activity;

        // Prorated if rawActivity was higher than effective ships of the planet
        const scale = Math.min(1.0, effShips / rawActivity);

        // Increase Pirate Income for each of the enemy players
        for (const [ownerId, hpSum] of enemyMaxHealthByOwner.entries()) {
          const enemyPlayer = this.allPlayers.find(pl => pl.id === ownerId);
          if (enemyPlayer) {
            const income = hpSum * 10 * scale;
            enemyPlayer.pirateIncome = (enemyPlayer.pirateIncome || 0) + income;
          }
        }
      }
    }

    // Dynamic calculations for player limits and trade options
    for (const player of this.allPlayers) {
      if ((player.credits || 0) < 0) {
        const debtTier = Math.floor(Math.abs(player.credits) / 1000);
        const penaltyRate = 0.025 + (debtTier * 0.02);
        player.credits += player.credits * (penaltyRate / 60000) * deltaTime;
      } else if ((player.credits || 0) > 0) {
        player.credits += player.credits * (0.01 / 60000) * deltaTime;
      }
      let garrisonWorlds = 0;
      let fullGarrisonWorlds = 0;
      let commerceWorlds = 0;
      let controlledHomeworlds = 0;
      let controlsOwnHomeworld = false;
      let playerEffectiveShips = 0;

      for (const planet of this.planets) {
        if (planet.dead) continue;
        if (planet.owner && planet.owner.id === player.id) {
          if (planet.focusMode === 'garrison') {
            garrisonWorlds++;
            if (planet.ships > planet.maxShips * 2 - 10) {
              fullGarrisonWorlds++;
            }
          } else if (planet.focusMode === 'commerce') {
            commerceWorlds++;
          }
          if (planet.homeworldOf) {
            controlledHomeworlds++;
            if (planet.homeworldOf === player.id) {
              controlsOwnHomeworld = true;
            }
          }

          let eff = planet.ships;
          if (planet.focusMode === 'commerce') {
            const isFull = planet.ships >= planet.maxShips;
            eff = isFull ? planet.ships * 2 : planet.ships * 1.5;
            if (planet.minerals && planet.minerals > 4) {
              eff *= (planet.minerals / 4);
            }
          }
          playerEffectiveShips += eff;
        }
      }

      player.effectiveShips = playerEffectiveShips;

      player.commandLimit = 5 + (player.planetCount || 0) + (garrisonWorlds * 2) + (fullGarrisonWorlds * 2) + (controlledHomeworlds * 2) + (controlsOwnHomeworld ? 3 : 0);
      player.tradeCapacity = Math.ceil(playerEffectiveShips / 400);
      player.stockpileCapacity = (player.commandLimit || 0) + (player.tradeCapacity || 0);

      player.storageFeeAccumulator = (player.storageFeeAccumulator || 0) + deltaTime;
      while (player.storageFeeAccumulator >= 1000) {
        player.storageFeeAccumulator -= 1000;
        // Fleet cost overages
        const commandLimit = player.commandLimit || 5;
        const commandCount = player.commandCount || 0;
        if (commandCount > commandLimit) {
          const excess = commandCount - commandLimit;
          const fleetCost = (excess * 5) / 60;
          player.fleetCostRate = excess * 5;

          // Debt floor always from trade ships (no homeworld ownership required)
          const minAllowedCredits = -Math.floor(player.totalTradeShips || 0);

          const creditsAvailable = Math.max(0, (player.credits || 0) - minAllowedCredits);
          if (creditsAvailable >= fleetCost) {
            player.credits = (player.credits || 0) - fleetCost;
          } else {
            let remainingFee = fleetCost - creditsAvailable;
            if (creditsAvailable > 0) {
              player.credits = (player.credits || 0) - creditsAvailable;
            }

            while (remainingFee > 0) {
              let highestRes = null;
              let highestQty = 0;
              const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
              for (const res of resourcesList) {
                const qty = player.resources[res] || 0;
                if (qty > highestQty) {
                  highestQty = qty;
                  highestRes = res;
                }
              }

              if (highestQty <= 0 || !highestRes) {
                break;
              }

              const deductAmt = Math.min(remainingFee, highestQty);
              player.resources[highestRes] -= deductAmt;
              remainingFee -= deductAmt;
            }
          }
        } else {
          player.fleetCostRate = 0;
        }
      }

      if (player.tradeOptions === undefined) {
        player.tradeOptions = player.tradeCapacity;
      } else {
        player.tradeOptions = Math.min(player.tradeCapacity, player.tradeOptions);
      }

      // Handle Trade Options Regeneration at decreasing intervals
      const myTradeOptions = player.tradeOptions || 0;
      const penaltyDelay = myTradeOptions < 0 ? Math.abs(myTradeOptions) * 30000 : 0;
      let baseRegenSeconds = 180;
      if (player.tradeCapacity > 0) {
        baseRegenSeconds = 180 / player.tradeCapacity;
      }
      const tradeRegenInterval = (baseRegenSeconds * 1000) + penaltyDelay;
      player.tradeRegenInterval = tradeRegenInterval;
      player.tradeRegenAccumulator = (player.tradeRegenAccumulator || 0) + deltaTime;
      while (player.tradeRegenAccumulator >= tradeRegenInterval) {
        player.tradeRegenAccumulator -= tradeRegenInterval;
        player.tradeOptions = Math.min(player.tradeCapacity, (player.tradeOptions || 0) + 1);
      }

      // Auto Bundle Sale
      if (player.tradeOptions >= player.tradeCapacity && player.resources) {
        const now = Date.now();
        if (!player.lastBundleSaleTime || now - player.lastBundleSaleTime >= 5 * 60 * 1000) {
          const resList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium'];
          let hasAll = true;
          for (const res of resList) {
            if ((player.resources[res] || 0) < 1) {
              hasAll = false;
              break;
            }
          }
          if (hasAll && (player.resources['latinum'] || 0) >= 4) {
            player.lastBundleSaleTime = now;
            for (const res of resList) {
              player.resources[res] -= 1;
            }
            player.resources['latinum'] -= 4;
            
            let totalGain = this.bundleValue || 200;
            player.credits = (player.credits || 0) + totalGain;
            this.bundleValue = (this.bundleValue || 200) + 10;
            
            player.tradeOptions -= 5;
            
            console.log(`[Auto Bundle Sale] Executed for player ${player.id}. Gained ${totalGain} credits. New Bundle Value: ${this.bundleValue}`);
          }
        }
      }

      // Passive trading income based on effective ships of all friendly/neutral planets, capped based on player's own effective ships
      if (player !== this.monsterPlayer) {
        let playerEffectiveShips = player.effectiveShips || 0;

        // 2. Group other qualifying partners' effective ships
        const otherPartners = {};
        otherPartners["Neutral"] = 0;
        for (const p of this.allPlayers) {
          if (p !== player && p !== this.monsterPlayer) {
            otherPartners[p.name] = 0;
          }
        }

        let otherEffectiveShips = 0;
        for (const planet of this.planets) {
          if (planet.dead) continue;
          const isOwn = (planet.owner && planet.owner.id === player.id);
          const isNotAtWar = !planet.owner || !player.isAtWarWith(planet.owner);
          
          if (!isOwn && isNotAtWar) {
            const isVisibleOrOnceKnown = this.isPlanetVisibleTo(planet, player) || (player.discoveredPlanets && player.discoveredPlanets.has(planet.id));
            if (isVisibleOrOnceKnown) {
              let baseShips = planet.ships;
              if (!planet.owner) {
                // Neutral planet: cap counted ships to sympathy on that planet toward the player * 10
                const sympathyVal = getEffectiveSympathy(planet, player.id, this.ships, player, this);
                baseShips = Math.min(baseShips, sympathyVal * 20);
              }

              let eff = baseShips;
              if (planet.focusMode === 'commerce') {
                const isFull = planet.ships >= planet.maxShips;
                eff = isFull ? baseShips * 2 : baseShips * 1.5;
                if (planet.minerals && planet.minerals > 4) {
                  eff *= (planet.minerals / 4);
                }
              }
              otherEffectiveShips += eff;
              
              if (planet.owner) {
                if (planet.owner !== this.monsterPlayer) {
                  otherPartners[planet.owner.name] = (otherPartners[planet.owner.name] || 0) + eff;
                }
              } else {
                otherPartners["Neutral"] = (otherPartners["Neutral"] || 0) + eff;
              }
            }
          }
        }

        // 3. Apply the cap (sum of other effective ships capped at player's own effective ships) - Soft Cap
        let scale = 1.0;
        if (otherEffectiveShips > playerEffectiveShips) {
          const excess = otherEffectiveShips - playerEffectiveShips;
          const credited = playerEffectiveShips + 0.10 * excess;
          scale = credited / otherEffectiveShips;
        }

        // 4. Build visible partner ships list using the scaled values
        const visiblePartnerShips = {};
        visiblePartnerShips["Domestic Ships"] = playerEffectiveShips;
        for (const key in otherPartners) {
          const scaledVal = otherPartners[key] * scale;
          if (scaledVal > 0) {
            visiblePartnerShips[key] = scaledVal;
          }
        }

        let qualifyingShipsSum = 0;
        for (const key in visiblePartnerShips) {
          qualifyingShipsSum += visiblePartnerShips[key];
        }

        const tradingIncomeRate = qualifyingShipsSum > 0 ? (qualifyingShipsSum / 1500) : 0; // credits per second
        const tradingIncome = tradingIncomeRate * (deltaTime / 1000);
        player.credits = (player.credits || 0) + tradingIncome;
        player.passiveIncomeRate = tradingIncomeRate; // Store for client UI display!

        // Apply Pirate Activity and Pirate Income adjustments
        const pirateActivityRate = (player.pirateActivity || 0) / 1500;
        const pirateActivityDeduction = pirateActivityRate * (deltaTime / 1000);
        player.credits = (player.credits || 0) - pirateActivityDeduction;

        const pirateIncomeRate = (player.pirateIncome || 0) / 1500;
        const pirateIncomeAddition = pirateIncomeRate * (deltaTime / 1000);
        player.credits = (player.credits || 0) + pirateIncomeAddition;

        player.tradingPartners = [];
        for (const key in visiblePartnerShips) {
          const shipsCapped = visiblePartnerShips[key];
          if (shipsCapped > 0) {
            const shipsNonCapped = key === "Domestic Ships" ? playerEffectiveShips : (otherPartners[key] || 0);
            player.tradingPartners.push({
              name: key,
              ships: shipsNonCapped,
              cappedShips: shipsCapped,
              rate: qualifyingShipsSum > 0 ? ((shipsCapped / qualifyingShipsSum) * tradingIncomeRate) : 0
            });
          }
        }
        player.playerEffectiveShips = playerEffectiveShips;
        player.otherEffectiveShips = otherEffectiveShips;
        player.totalTradeShips = qualifyingShipsSum;
      } else {
        player.passiveIncomeRate = 0;
        player.tradingPartners = [];
        player.playerEffectiveShips = 0;
        player.otherEffectiveShips = 0;
        player.totalTradeShips = 0;
      }
    }
    
    for (const planet of this.planets) {
      if (planet.inRevolt) {
        planet.revoltTimer = Math.max(0, (planet.revoltTimer || 0) - deltaTime);
        
        // Gradual sympathy-induced extra casualties countdown
        if (planet.revoltShipsToDestroy && planet.revoltShipsToDestroy > 0) {
          const ratio = Math.min(1.0, 1.0 - (planet.revoltTimer / 15000));
          const targetDestroyed = Math.floor(ratio * planet.revoltShipsToDestroy);
          const toDestroy = Math.min(targetDestroyed - (planet.revoltShipsDestroyedSoFar || 0), planet.ships - 1);
          if (toDestroy > 0) {
            planet.ships -= toDestroy;
            planet.revoltShipsDestroyedSoFar = (planet.revoltShipsDestroyedSoFar || 0) + toDestroy;
          }
        }

        if (Math.random() < 0.15) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * planet.radius;
          const ex = planet.x + Math.cos(angle) * dist;
          const ey = planet.y + Math.sin(angle) * dist;
          const isFirework = Math.random() < 0.4;
          this.explosions.push({
            id: 'exp_' + Math.random().toString(36).substr(2, 9),
            x: ex,
            y: ey,
            color: '#ff3333',
            age: 0,
            duration: 1.0,
            isFirework: isFirework,
            size: 10 + Math.random() * 20
          });
        }
        if (planet.revoltTimer <= 0) {
          planet.inRevolt = false;
          this.resolveRevolt(planet);
        }
      } else {
        planet.update(deltaTime, this.planets, this.settings, this);
      }
    }
    perfPoints.push({ name: 'planet-loop', time: performance.now() });

    // Owned planets exert sympathy on neutral and enemy planets within their gravity well that have less ships than them at the rate of 1 per minute.
    for (const sourcePlanet of this.planets) {
      if (sourcePlanet.owner) {
        const gravityRadius = sourcePlanet.getGravityRadius();
        const gravityRadiusSq = gravityRadius * gravityRadius;
        const candidatePlanets = this.planetGridPopulated && this.planetGrid ? this.planetGrid.getPlanetsInRadiusSq(sourcePlanet.x, sourcePlanet.y, gravityRadiusSq) : this.planets;
        for (const targetPlanet of candidatePlanets) {
          if (targetPlanet.id !== sourcePlanet.id) {
            const isNeutralOrEnemy = !targetPlanet.owner || targetPlanet.owner.id !== sourcePlanet.owner.id;
            if (isNeutralOrEnemy) {
              const dx = targetPlanet.x - sourcePlanet.x;
              const dy = targetPlanet.y - sourcePlanet.y;
              const distSq = dx * dx + dy * dy;
              if (distSq <= gravityRadiusSq) {
                if (targetPlanet.ships < sourcePlanet.ships) {
                  targetPlanet.addSympathy(sourcePlanet.owner.id, deltaTime / 60000);
                }
              }
            }
          }
        }
      }
    }
    
    for (const ship of this.ships) {
      if (ship.targetPlanet && ship.targetPlanet.dead) {
        const dx = ship.x - ship.targetPlanet.x;
        const dy = ship.y - ship.targetPlanet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 75) {
          let nearestPlanet = null;
          let nearestPlanetDistSq = Infinity;
          for (const p of this.planets) {
            if (!p.dead && p.id !== ship.targetPlanet.id) {
              const pdx = p.x - ship.x;
              const pdy = p.y - ship.y;
              const pDistSq = pdx * pdx + pdy * pdy;
              if (pDistSq < nearestPlanetDistSq) {
                nearestPlanetDistSq = pDistSq;
                nearestPlanet = p;
              }
            }
          }
          if (nearestPlanet) {
            ship.targetPlanet = nearestPlanet;
            ship.targetX = nearestPlanet.x;
            ship.targetY = nearestPlanet.y;
            ship.startX = ship.x;
            ship.startY = ship.y;
            ship.cruiserTargetType = null;
            ship.cruiserTargetId = null;
            ship.cruiserTargetOffsetX = 0;
            ship.cruiserTargetOffsetY = 0;
          } else {
            ship.active = false;
            continue;
          }
        } else {
          ship.active = false;
          continue;
        }
      }
      ship.update(deltaTime, this.ships, this.explosions, this.planets, this.lasers, this.ionStorms, this.width, this);
      
      // Boundary check for cruisers: take 1 damage per d3 seconds outside map boundary
      if (ship.active && ship.isCruiser && !ship.isAmoeba) {
        const isOutOfBounds = ship.x < 0 || ship.x > this.width || ship.y < 0 || ship.y > this.height;
        if (isOutOfBounds) {
          // Check if cruiser is within 50px of a friendly gravity well
          let nearFriendlyWell = false;
          if (ship.owner) {
            for (const planet of this.planets) {
              if (planet.owner && planet.owner.id === ship.owner.id && !planet.dead) {
                const dx = ship.x - planet.x;
                const dy = ship.y - planet.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= planet.getGravityRadius() + 50) {
                  nearFriendlyWell = true;
                  break;
                }
              }
            }
          }

          if (!nearFriendlyWell) {
            if (ship.outOfBoundsDamageTimer === undefined || ship.outOfBoundsDamageTimer === null) {
              ship.outOfBoundsDamageTimer = (Math.floor(Math.random() * 3) + 1) * 1000;
            }
            ship.outOfBoundsDamageTimer -= deltaTime;
            if (ship.outOfBoundsDamageTimer <= 0) {
              ship.outOfBoundsDamageTimer = (Math.floor(Math.random() * 3) + 1) * 1000;
              ship.health = Math.max(0, ship.health - 1);
              if (ship.health <= 0) {
                ship.active = false;
              }
              const explosionColor = '#ff0';
              this.explosions.push({ x: ship.x, y: ship.y, color: explosionColor, age: 0, isHazard: true });
              const boltX = ship.x + (Math.random() - 0.5) * 80;
              const boltY = ship.y - 30 - Math.random() * 50;
              const midX = (ship.x + boltX) / 2 + (Math.random() - 0.5) * 40;
              const midY = (ship.y + boltY) / 2 + (Math.random() - 0.5) * 20;
              this.lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
              this.lasers.push({ startX: midX, startY: midY, endX: ship.x, endY: ship.y, color: explosionColor, age: 0, duration: 0.4 });
            }
          } else {
            ship.outOfBoundsDamageTimer = null;
          }
        } else {
          ship.outOfBoundsDamageTimer = null;
        }
      }
        if (ship.needsSplit) {
          ship.needsSplit = false;
          const triggerMax = ship.maxHealth;
          if (this.monsterPlayer) {
            this.monsterPlayer.techScore = (this.monsterPlayer.techScore || 0) + triggerMax;
            this.monsterPlayer.expScore = (this.monsterPlayer.expScore || 0) + triggerMax;
          }
          const halfSize = Math.max(1, Math.floor(triggerMax / 2));
          ship.maxHealth = halfSize;
          ship.health = halfSize;
          // Recalculate and set parent's lastTotalHealth to prevent mitosis wreckage
          ship.lastTotalHealth = Math.floor(ship.health) + (ship.maxHealth * (ship.maxHealth - 1)) / 2;
          
          const newAmoeba = new Ship(this.nextShipId++, ship.x, ship.y, null, this.monsterPlayer, ship.x + (Math.random() - 0.5) * 400, ship.y + (Math.random() - 0.5) * 400);
          newAmoeba.isAmoeba = true;
          newAmoeba.cruiserStyle = ship.cruiserStyle;
          let speed = 0;
          for (let d = 0; d < 4; d++) speed += Math.floor(Math.random() * 6) + 1;
          newAmoeba.speed = speed;
          newAmoeba.maxHealth = halfSize;
          newAmoeba.health = halfSize;
          this.ships.push(newAmoeba);
          ship.targetX = ship.x + (Math.random() - 0.5) * 400;
          ship.targetY = ship.y + (Math.random() - 0.5) * 400;
        }
    }

    // Resolve cruiser stacking when not moving
    const nonMovingCruisers = [];
    for (const ship of this.ships) {
      if (ship.active && ship.isCruiser && ship.maxHealth > 0 && ship.stationaryTimer > 0 && (!ship.bumpImmunityTimer || ship.bumpImmunityTimer <= 0)) {
        nonMovingCruisers.push(ship);
      }
    }

    if (nonMovingCruisers.length > 1) {
      let anyMoved = false;
      
      // Run relaxation at a gradual speed of 3 pixels per second per cruiser
      for (let pass = 0; pass < 1; pass++) {
        let movedThisPass = false;
        for (let i = 0; i < nonMovingCruisers.length; i++) {
          const shipA = nonMovingCruisers[i];
          for (let j = i + 1; j < nonMovingCruisers.length; j++) {
            const shipB = nonMovingCruisers[j];
            const dx = shipB.x - shipA.x;
            const dy = shipB.y - shipA.y;
            const distSq = dx * dx + dy * dy;
            
            const minDistance = Math.max(shipA.maxHealth || 0, shipB.maxHealth || 0) * 1.30;
            const minDistanceSq = minDistance * minDistance;
            
            if (distSq < minDistanceSq) {
              // Stacked! Resolve by scooting them in opposite directions gradually.
              // If they are exactly on top of each other, use a random angle to break symmetry.
              // Otherwise, push them directly away from each other.
              let pushX, pushY;
              if (distSq < 0.01) {
                const angle = Math.random() * Math.PI * 2;
                pushX = Math.cos(angle);
                pushY = Math.sin(angle);
              } else {
                const dist = Math.sqrt(distSq);
                pushX = dx / dist;
                pushY = dy / dist;
              }
              
              // Size-weighted drift: smaller ships scoot more, larger ships barely move
              // (larger ships effectively push smaller ones out of the way).
              // Equal sizes still each move 3 px/s (total relative 6 px/s, unchanged).
              const sizeA = Math.max(1, shipA.maxHealth || 1);
              const sizeB = Math.max(1, shipB.maxHealth || 1);
              const totalSize = sizeA + sizeB;
              const weightA = sizeB / totalSize; // inverse mass: smaller A → larger weight
              const weightB = sizeA / totalSize;
              const totalScoot = 6 * (deltaTime / 1000);
              
              shipA.x -= pushX * totalScoot * weightA;
              shipA.y -= pushY * totalScoot * weightA;
              shipB.x += pushX * totalScoot * weightB;
              shipB.y += pushY * totalScoot * weightB;
              
              // Keep within map boundaries
              shipA.x = Math.max(20, Math.min(this.width - 20, shipA.x));
              shipA.y = Math.max(20, Math.min(this.height - 20, shipA.y));
              shipB.x = Math.max(20, Math.min(this.width - 20, shipB.x));
              shipB.y = Math.max(20, Math.min(this.height - 20, shipB.y));
              
              // Update target and starting coordinates so they don't jitter/try to return to old coords
              if (shipA.targetX !== null && shipA.targetX !== undefined) {
                shipA.targetX = shipA.x;
                shipA.targetY = shipA.y;
                shipA.startX = shipA.x;
                shipA.startY = shipA.y;
              }
              if (shipB.targetX !== null && shipB.targetX !== undefined) {
                shipB.targetX = shipB.x;
                shipB.targetY = shipB.y;
                shipB.startX = shipB.x;
                shipB.startY = shipB.y;
              }
              
              movedThisPass = true;
              anyMoved = true;
            }
          }
        }
        if (!movedThisPass) break;
      }
      if (anyMoved) {
        this.ships.updateGrid();
      }
    }
    
    // Fleet attrition: destroy 1 ship per 4 seconds in a fleet (ships safe for first 12s)
    this.fleetAttritionTimer = (this.fleetAttritionTimer || 0) + deltaTime / 1000;
    if (this.fleetAttritionTimer >= 4) {
      this.fleetAttritionTimer -= 4;
      
      const fleets = new Map();
      for (const ship of this.ships) {
        if (!ship.active) continue;
        if (ship.owner) ship.owner.isAlive = true;
        const techBonus = Math.sqrt(ship.owner ? (ship.owner.techScore || 0) : 0);
        const expBonus = Math.sqrt(ship.owner ? (ship.owner.expScore || 0) : 0);
        const effectiveFlightTime = ship.flightTime - techBonus - expBonus;
        if (effectiveFlightTime < 0) continue; // Safe only for duration of bonuses
        
        const targetId = ship.targetPlanet ? ship.targetPlanet.id : `space-${Math.round(ship.targetX / 100)}-${Math.round(ship.targetY / 100)}`;
        const key = `${ship.owner ? ship.owner.id : "neutral"}-${targetId}`;
        if (!fleets.has(key)) fleets.set(key, []);
        fleets.get(key).push(ship);
      }
      
      for (const fleet of fleets.values()) {
        const victim = fleet[0];
        if (victim.checkSurvivalRoll()) continue;
        
        if (victim.count > 1) {
          victim.count--;
        } else {
          victim.active = false;
        }
        if (victim.owner) {
          victim.owner.addExperience(1);
          if (victim.sourceShipId) {
            const launcher = this.ships.find(sh => sh.id === victim.sourceShipId && sh.active);
            if (launcher) {
              launcher.gainXp(1, this);
            }
          }
        }
        this.explosions.push({
          x: victim.x,
          y: victim.y,
          color: victim.owner ? victim.owner.color : '#fff',
          age: 0,
          isDeath: true
        });
      }
    }
    
    // Update and remove explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].age += deltaTime / 1000;
      const maxAge = this.explosions[i].duration !== undefined 
        ? this.explosions[i].duration 
        : (this.explosions[i].isDollarSign ? 5.0 : 1.0);
      if (this.explosions[i].age > maxAge) {
        this.explosions.splice(i, 1);
      }
    }
    
    // Update and remove lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].age += deltaTime / 1000;
      if (this.lasers[i].age > this.lasers[i].duration) {
        const laser = this.lasers[i];
        if (laser.color === 'cruiser-projectile') {
          if (this.accuracyEvents && laser.accuracy !== undefined) {
            this.accuracyEvents.push({
              x: laser.endX,
              y: laser.endY,
              accuracy: laser.accuracy,
              isCruiser: true,
              attackerOwnerId: laser.attackerOwnerId,
              targetOwnerId: laser.targetOwnerId,
              isBombAttack: !!laser.isBombAttack,
              hit: !!laser.destroysDefender,
              attackerShipId: laser.sourceShipId,
              attackerX: laser.startX,
              attackerY: laser.startY
            });
          }
          if (laser.destroysDefender) {
            if (laser.targetPlanetId !== undefined) {
              const targetPlanet = this.planets.find(pl => pl.id === laser.targetPlanetId);
              if (targetPlanet && targetPlanet.ships >= 0) {
                const oldShips = targetPlanet.ships;
                if (targetPlanet.ships > 0) {
                  targetPlanet.ships -= 1;
                  let toDestroy = 0;
                  if (laser.splashDamage && laser.splashDamage > 0) {
                    const splashLimit = Math.floor(targetPlanet.ships / 50);
                    const splash = Math.min(laser.splashDamage, splashLimit);
                    toDestroy = Math.min(targetPlanet.ships, splash);
                    targetPlanet.ships -= toDestroy;
                  }
                }
                const actualKilled = oldShips - targetPlanet.ships;
                if (actualKilled > 0) {
                  targetPlanet.addExperience(actualKilled);
                }

                const sourceShip = this.ships.find(sh => sh.id === laser.sourceShipId);
                if (sourceShip && sourceShip.owner && targetPlanet.owner && targetPlanet.owner.id !== sourceShip.owner.id) {
                  targetPlanet.owner.lastAttackerPlayerId = sourceShip.owner.id;
                }
                
                if (targetPlanet.ships <= 0) {
                  targetPlanet.ships = 0;
                  const sourceShip = this.ships.find(sh => sh.id === laser.sourceShipId);
                  if (sourceShip && sourceShip.owner) {
                    const previousOwner = targetPlanet.owner;
                    if (previousOwner !== null) {
                      targetPlanet.maxShips--;
                      if (targetPlanet.maxShips < 5) {
                        targetPlanet.dead = true;
                        if (targetPlanet.homeworldOf) {
                          sourceShip.owner.expScore = (sourceShip.owner.expScore || 0) + 100;
                        }
                      }
                    } else {
                      // Neutral capture
                      const roll = Math.random();
                      if (roll < 0.10) {
                        targetPlanet.isResearch = true;
                      } else if (roll < 0.20) {
                        targetPlanet.isMilitary = true;
                      } else if (roll < 0.30) {
                        targetPlanet.isSpeedPlanet = true;
                      }
                    }
                    if (previousOwner) {
                      previousOwner.lastAttackerPlayerId = sourceShip.owner.id;
                    }
                    if (!targetPlanet.racialAffinity) {
                      targetPlanet.racialAffinity = sourceShip.cruiserStyle || (sourceShip.owner ? sourceShip.owner.cruiserStyle : null);
                    }
                    targetPlanet.owner = sourceShip.owner;
                    targetPlanet.rampageBoost = false;
                    targetPlanet.rampageEvent = false;
                    
                    // Check previous owner elimination (last planet taken)
                    if (previousOwner && previousOwner.id !== sourceShip.owner.id) {
                      const hasRemaining = this.planets.some(pl => pl !== targetPlanet && pl.owner && pl.owner.id === previousOwner.id);
                      if (!hasRemaining) {
                        targetPlanet.defeatEvent = { name: previousOwner.name, color: previousOwner.color };
                        this.tryAwardPlayerConquerXp(previousOwner, sourceShip.owner, 100);
                      }
                    }
                  }
                }
              }
            }
            if (laser.sourceShipId !== undefined) {
              const sourceShip = this.ships.find(sh => sh.id === laser.sourceShipId);
              if (sourceShip && sourceShip.active) {
                sourceShip.gainXp(0.05, this);
              }
            }
            this.explosions.push({
              x: laser.endX,
              y: laser.endY,
              color: '#ffa500',
              age: 0
            });
          }
        }
        this.lasers.splice(i, 1);
      }
    }
    
    // Award tech score to cruisers with laboratories in sensor range when an amoeba or monster ship dies
    let hasInactiveAmoebaOrMonster = false;
    for (const ship of this.ships) {
      if (!ship.active && (ship.isAmoeba || (ship.owner && (ship.owner.id === 'monsters' || ship.owner.isMonster)))) {
        hasInactiveAmoebaOrMonster = true;
        break;
      }
    }
    
    if (hasInactiveAmoebaOrMonster) {
      const labCruisers = [];
      for (const cruiser of this.ships) {
        if (cruiser.active && cruiser.isCruiser && (cruiser.labs || 0) > 0 && cruiser.owner) {
          labCruisers.push(cruiser);
        }
      }
      
      if (labCruisers.length > 0) {
        for (const ship of this.ships) {
          const isAmoebaOrMonster = ship.isAmoeba || (ship.owner && (ship.owner.id === 'monsters' || ship.owner.isMonster));
          if (!ship.active && isAmoebaOrMonster) {
            for (const cruiser of labCruisers) {
              const dx = cruiser.x - ship.x;
              const dy = cruiser.y - ship.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              // Calculate Cruiser sensor range including experience & player modifiers
              const sensorRange = cruiser.cruiserRadarRange();
              
              if (dist <= sensorRange) {
                const techGain = cruiser.labs;
                cruiser.owner.techScore = (cruiser.owner.techScore || 0) + techGain;
                cruiser.beakerIncreaseEvent = (cruiser.beakerIncreaseEvent || 0) + techGain;
              }
            }
          }
        }
      }
    }

    // Golden Amoeba Reward Check
    if (this.goldenAmoebaSpawned && !this.goldenAmoebaRewarded) {
      const gAmoeba = this.ships.find(s => s.isGoldenAmoeba);
      if (gAmoeba && !gAmoeba.active) {
        this.goldenAmoebaRewarded = true;
        let killerShip = null;
        let lastTime = 0;
        for (const ship of this.ships) {
          if (ship.lastAttackTimeOnShip && ship.lastAttackTimeOnShip[gAmoeba.id]) {
            if (ship.lastAttackTimeOnShip[gAmoeba.id] > lastTime) {
              lastTime = ship.lastAttackTimeOnShip[gAmoeba.id];
              killerShip = ship;
            }
          }
        }
        if (killerShip && killerShip.owner && killerShip.owner !== this.monsterPlayer) {
          const killer = killerShip.owner;
          killer.techScore = (killer.techScore || 0) + 50;
          killer.expScore = (killer.expScore || 0) + 50;
          killer.happinessScore = (killer.happinessScore || 0) + 50;
          killer.credits = (killer.credits || 0) + 500;
          
          if (this.events) {
            this.events.push({
              text: `${killer.name} has destroyed The Golden Amoeba!`,
              type: 'diplomacy',
              color: '#ffd700',
              age: 0,
              duration: 5.0
            });
          }
        }
      }
    }

    // Wreckage accumulation check
    for (const ship of this.ships) {
      if (ship.isCruiser || ship.isAmoeba) {
        if (ship.isDismantling) continue;
        
        const isTargetCruiser = ship.isCruiser && !ship.isAmoeba;
        const isTargetAmoeba = ship.isAmoeba;
        
        let currentTotal = 0;
        if (ship.active) {
          if (isTargetCruiser) {
            currentTotal = ship.health || 0;
          } else if (isTargetAmoeba) {
            currentTotal = Math.floor(ship.health || 0) + ((ship.maxHealth || 0) * ((ship.maxHealth || 0) - 1)) / 2;
          }
        }
        
        if (ship.lastTotalHealth !== undefined) {
          const dmg = ship.lastTotalHealth - currentTotal;
          if (dmg > 0) {
            this.handleWreckageDamage(ship.x, ship.y, isTargetAmoeba ? dmg : 0, isTargetCruiser ? dmg : 0);
          }
        }
        ship.lastTotalHealth = currentTotal;
      }
    }

    let planetDestroyed = false;
    for (let i = this.planets.length - 1; i >= 0; i--) {
      if (this.planets[i].dead) {
        const deadPlanet = this.planets[i];
        const isMilitaryExplosion = !!deadPlanet.isMilitary;
        this.explosions.push({
          x: deadPlanet.x,
          y: deadPlanet.y,
          color: deadPlanet.owner ? deadPlanet.owner.color : '#fff',
          age: 0,
          isMassive: !isMilitaryExplosion,
          isCatastrophic: isMilitaryExplosion
        });
        
        // Splash damage queued
        let splashDamage = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
        if (isMilitaryExplosion) splashDamage *= 3;
        if (!this.pendingSplashDamage) this.pendingSplashDamage = [];
        this.pendingSplashDamage.push({
          x: deadPlanet.x,
          y: deadPlanet.y,
          damage: splashDamage,
          splashRadius: isMilitaryExplosion ? 600 : 400,
          isMilitaryExplosion: isMilitaryExplosion,
          timer: 1000 // 1 second
        });
        
        this.planets.splice(i, 1);
        planetDestroyed = true;
      }
    }
    if (planetDestroyed) {
      this.recalculateResourceRarities();
    }
    
    // Execute pending splash damage
    if (this.pendingSplashDamage) {
      for (let i = this.pendingSplashDamage.length - 1; i >= 0; i--) {
        const p = this.pendingSplashDamage[i];
        p.timer -= deltaTime;
        if (p.timer <= 0) {
          for (const nearby of this.planets) {
            const dx = nearby.x - p.x;
            const dy = nearby.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < p.splashRadius) {
              const rangeReduction = Math.floor(dist / 25);
              const finalDamage = Math.max(0, p.damage - rangeReduction);
              if (finalDamage > 0) {
                const capacityDamage = p.isMilitaryExplosion ? finalDamage : Math.round(finalDamage / 3);
                nearby.maxShips -= capacityDamage;
                nearby.radius = nearby.maxShips / 4;
                nearby.capacityDecreaseEvent = true;
                nearby.ships -= finalDamage;
                const limit = (nearby.owner && !nearby.owner.isAI && nearby.focusMode === 'garrison') ? nearby.maxShips * 2 : nearby.maxShips;
                if (nearby.owner !== null && nearby.ships > limit) nearby.ships = limit;
                if (nearby.ships < 1) {
                  nearby.ships = 0;
                  nearby.owner = null;
                }
                if (nearby.maxShips < 5) {
                  nearby.dead = true;
                }
                // Explosion effect on damaged planet
                this.explosions.push({
                  x: nearby.x,
                  y: nearby.y,
                  color: p.isMilitaryExplosion ? '#ff4400' : '#ffaa00',
                  age: 0,
                  isMassive: false
                });
                if (p.isMilitaryExplosion) {
                  // Additional secondary explosions for military blast
                  for (let k = 0; k < 3; k++) {
                    this.explosions.push({
                      x: nearby.x + (Math.random() - 0.5) * nearby.radius * 2,
                      y: nearby.y + (Math.random() - 0.5) * nearby.radius * 2,
                      color: '#ff6600',
                      age: Math.random() * 0.2,
                      isMassive: false
                    });
                  }
                }
              }
            }
          }
          this.pendingSplashDamage.splice(i, 1);
        }
      }
    }
    // Check if any player's tech bonus increased
    for (const player of this.allPlayers) {
      const curBonus = Math.floor(Math.sqrt(player.techScore || 0));
      if (player.prevTechBonus === undefined) {
        player.prevTechBonus = curBonus;
      } else if (curBonus > player.prevTechBonus) {
        player.prevTechBonus = curBonus;

        const roll = Math.floor(Math.random() * 2) + 1; // d2 roll (1 or 2)

        if (player.upgradeModifiers) {
          const eligibleUpgradeTypes = [];
          const zeroUpgradeTypes = [];

          for (const type of Object.keys(player.upgradeModifiers)) {
            const val = player.upgradeModifiers[type];
            if (val < 0 && val > -0.75) {
              eligibleUpgradeTypes.push(type);
            } else if (val === 0) {
              zeroUpgradeTypes.push(type);
            }
          }

          let chosenType = null;
          if (roll === 1 && eligibleUpgradeTypes.length > 0) {
            chosenType = eligibleUpgradeTypes[Math.floor(Math.random() * eligibleUpgradeTypes.length)];
            player.upgradeModifiers[chosenType] = Math.max(-0.75, player.upgradeModifiers[chosenType] - 0.15);
          } else if (zeroUpgradeTypes.length > 0) {
            chosenType = zeroUpgradeTypes[Math.floor(Math.random() * zeroUpgradeTypes.length)];
            player.upgradeModifiers[chosenType] = Math.max(-0.75, player.upgradeModifiers[chosenType] - 0.15);
          }

          if (chosenType) {
            let targetPlanet = this.planets.find(p => p.homeworldOf === player.id && p.owner && p.owner.id === player.id);
            if (!targetPlanet) {
              const ownedPlanets = this.planets.filter(p => p.owner && p.owner.id === player.id);
              if (ownedPlanets.length > 0) {
                targetPlanet = ownedPlanets[Math.floor(Math.random() * ownedPlanets.length)];
              }
            }

            if (targetPlanet) {
              const displayUpgradeName = {
                sensorarray: 'Sensor Array',
                lab: 'Research Lab',
                armor: 'Armor',
                shield: 'Shield',
                engine: 'Engine',
                munitions: 'Munitions',
                targeting: 'Targeting',
                damagecontrol: 'Damage Control',
                supplyship: 'Supply Ship',
                extendedfuel: 'Extended Fuel',
                diplomat: 'Diplomat',
                marines: 'Marines'
              }[chosenType] || chosenType;

              const text = `${player.name} enhances the ${displayUpgradeName} upgrade!`;
              
              this.upgradeEnhanceEvents = this.upgradeEnhanceEvents || [];
              this.upgradeEnhanceEvents.push({
                planetId: targetPlanet.id,
                x: targetPlanet.x,
                y: targetPlanet.y - targetPlanet.radius - 15,
                text: text,
                color: player.color || '#fff'
              });

              // Queue a chat message for the player who gets the upgrade discount
              this.pendingChatMessages = this.pendingChatMessages || [];
              this.pendingChatMessages.push({
                playerId: player.id,
                text: `Congratulations! You received a discount on ${displayUpgradeName} upgrades!`
              });

              console.log(`[TECH ENHANCEMENT] Player ${player.name} enhanced ${chosenType} cost modifier to ${player.upgradeModifiers[chosenType]}`);
            }
          }
        }
      }
    }

    this.updateCustomCruiserSystems(deltaTime / 1000);



    // Update happiness scores every minute (60 seconds = 60000ms)
    this.happinessTimer = (this.happinessTimer || 0) + deltaTime;
    while (this.happinessTimer >= 60000) {
      this.happinessTimer -= 60000;
      
      for (const player of this.allPlayers) {
        if (!player.isAlive) continue;
        
        let happinessGained = 0;
        for (const planet of this.planets) {
          if (planet.owner && planet.owner.id === player.id && !planet.dead) {
            const finalRate = planet.getFinalProductionRate(this.settings);
            const inHighProduction = (finalRate > 1.0);
            
            if (inHighProduction) {
              happinessGained -= 3;
              this.happinessEvents = this.happinessEvents || [];
              this.happinessEvents.push({
                planetId: planet.id,
                x: planet.x,
                y: planet.y,
                amount: -3,
                isBrokenHeart: true,
                color: '#ff1744'
              });
            }
            
            if (planet.ships >= planet.maxShips - 5) {
              const gained = planet.ships * 0.01 * (planet.habitability / 100);
              happinessGained += gained;
              
              this.happinessEvents = this.happinessEvents || [];
              this.happinessEvents.push({
                planetId: planet.id,
                x: planet.x,
                y: planet.y,
                amount: gained,
                habitability: planet.habitability,
                color: player.color || '#ffeb3b'
              });

              if (planet.focusMode === 'terraforming' && Math.random() < 0.5) {
                planet.addSympathy(player.id, 1);
              }
            }
          }
        }
        player.happinessScore = Math.max(0, (player.happinessScore || 0) + happinessGained);
      }
    }

    this.announceVictoryStatMilestones();

     if (this.onScoreUpdate) {
       const pCount = this.planets.filter(p => p.owner && p.owner.id === this.humanPlayer.id).length;
       const aiCount = this.planets.filter(p => p.owner && p.owner.id !== this.humanPlayer.id).length;
       this.onScoreUpdate(pCount, aiCount);
     }

     // Check for player elimination
     for (const player of this.allPlayers) {
       if (player.wasAlive && !player.isAlive && player.id !== 'monsters') {
         let conquerorId = player.lastAttackerPlayerId || null;
         let conqueror = conquerorId ? this.allPlayers.find(p => p.id === conquerorId) : null;
         this.eliminatePlayer(player, conqueror);
       }
     }

    // 2D Spatial Battle Replays logic
    if (this.ongoingBattles) {
      const timeNow = Date.now();
      for (let i = this.ongoingBattles.length - 1; i >= 0; i--) {
        const b = this.ongoingBattles[i];
        b.participants = b.participants || new Set();
        
        // Capture frame at 5 FPS (every 200ms)
        if (timeNow - b.lastFrameTime >= 200) {
          b.lastFrameTime = timeNow;
          const frame = {
            timeOffset: timeNow - b.startTime,
            ships: [],
            lasers: [],
            explosions: []
          };
          
          const bRadSq = b.radius * b.radius;
          for (const s of this.ships) {
            const dx = s.x - b.x;
            const dy = s.y - b.y;
            if (dx*dx + dy*dy <= bRadSq) {
              frame.ships.push({
                id: s.id,
                name: s.name,
                x: s.x,
                y: s.y,
                angle: s.angle,
                health: s.health,
                maxHealth: s.maxHealth,
                ownerId: s.owner ? s.owner.id : null,
                isCruiser: s.isCruiser,
                isAmoeba: s.isAmoeba,
                isMarineFleet: s.isMarineFleet,
                radius: s.radius,
                package: s.package,
                count: s.count,
                cohort: s.cohort,
                cruiserStyle: s.cruiserStyle,
                classType: s.classType,
                style: s.style,
                maxsupplies: s.maxsupplies,
                specialbombs: s.specialbombs,
                specialfuel: s.specialfuel,
                specialduranium: s.specialduranium,
                isUpgrading: s.isUpgrading,
                armor: s.armor,
                maxArmor: s.maxArmor,
                armorPoints: s.armorPoints,
                shields: s.shields,
                shieldPoints: s.shieldPoints,
                sensorarrays: s.sensorarrays,
                labs: s.labs,
                engine: s.engine,
                munitions: s.munitions,
                targeting: s.targeting,
                damagecontrol: s.damagecontrol,
                supply_ship: s.supply_ship,
                extended_fuel: s.extended_fuel
              });
              b.participants.add(s.owner ? s.owner.id : 'monsters');
            }
          }
          
          for (const l of this.lasers) {
            const dx = l.startX - b.x;
            const dy = l.startY - b.y;
            if (dx*dx + dy*dy <= bRadSq) {
              frame.lasers.push({
                startX: l.startX, startY: l.startY, endX: l.endX, endY: l.endY, color: l.color, age: l.age, duration: l.duration
              });
            }
          }
          
          for (const e of this.explosions) {
            const dx = e.x - b.x;
            const dy = e.y - b.y;
            if (dx*dx + dy*dy <= bRadSq) {
              frame.explosions.push({
                x: e.x, y: e.y, size: e.size, color: e.color, age: e.age, duration: e.duration, isMassive: e.isMassive
              });
            }
          }
          b.frames.push(frame);
        }
        
        // Finalize battle if no activity for 5 seconds
        if (timeNow - b.lastActivityTime >= 5000) {
          // Trim trailing empty frames so instant-kill battles don't result in 5 seconds of blank space
          while (b.frames.length > 1) {
            const lastFrame = b.frames[b.frames.length - 1];
            if (lastFrame.ships.length === 0 && lastFrame.lasers.length === 0 && lastFrame.explosions.length === 0) {
              b.frames.pop();
            } else {
              break;
            }
          }
          
          if (b.frames.length > 2) { // Only save if the battle had some duration
            // Calculate total damage dealt and whether a cruiser died
            let totalDamage = 0;
            let cruiserDied = false;
            for (let fi = 1; fi < b.frames.length; fi++) {
              const prev = b.frames[fi - 1];
              const curr = b.frames[fi];
              for (const ps of prev.ships) {
                const cs = curr.ships.find(s => s.id === ps.id);
                if (cs) {
                  const dmg = ps.health - cs.health;
                  if (dmg > 0) totalDamage += dmg;
                } else {
                  // Ship disappeared — count remaining health as damage
                  totalDamage += Math.max(0, ps.health);
                  if (ps.isCruiser || ps.isAmoeba) cruiserDied = true;
                }
              }
            }
            
            // Skip insignificant battles (less than 5 damage and no cruiser/amoeba killed)
            if (totalDamage < 5 && !cruiserDied) {
              this.ongoingBattles.splice(i, 1);
              continue;
            }
            
            const humanParticipants = Array.from(b.participants).filter(pId => {
              const p = this.allPlayers.find(pl => pl.id === pId);
              return p && !p.isAI && p.id !== 'monsters';
            });
            
            if (humanParticipants.length > 0) {
              let battleName = 'Space Skirmish';
              // Find the nearest planet to the battle center (skip anomalies)
              let nearestPlanet = null;
              let nearestDist = Infinity;
              for (const p of this.planets) {
                if (p.isDeepSpaceAnomaly) continue;
                const pdx = p.x - b.x;
                const pdy = p.y - b.y;
                const dist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearestPlanet = p;
                }
              }
              if (nearestPlanet) {
                battleName = 'Battle of ' + nearestPlanet.name;
              }
              const d = new Date(timeNow);
              const timeStr = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') + ':' + d.getSeconds().toString().padStart(2, '0');
              battleName = battleName + ' (' + timeStr + ')';

              // Diagnostic log for battle replay
              const totalShips = b.frames.reduce((sum, f) => sum + f.ships.length, 0);
              const totalLasers = b.frames.reduce((sum, f) => sum + f.lasers.length, 0);
              const totalExplosions = b.frames.reduce((sum, f) => sum + f.explosions.length, 0);
              console.log(`[BATTLE REPLAY] "${battleName}" finalized: ${b.frames.length} frames, ${totalShips} ship entries, ${totalLasers} laser entries, ${totalExplosions} explosion entries, radius=${b.radius}, center=(${Math.round(b.x)},${Math.round(b.y)})`);
              
              this.completedBattleReplays.push({
                id: b.id,
                name: battleName,
                type: 'battle',
                timestamp: timeNow,
                x: b.x,
                y: b.y,
                radius: b.radius,
                duration: timeNow - b.startTime,
                frames: b.frames,
                planets: b.planets || [],
                participants: Array.from(b.participants)
              });
              
              // Limit stored replays to prevent memory bloating
              if (this.completedBattleReplays.length > 50) {
                this.completedBattleReplays.shift();
              }
              
              const durationSecs = Math.max(0, Math.floor((timeNow - b.startTime) / 1000));
              const mins = Math.floor(durationSecs / 60);
              const secs = durationSecs % 60;
              const durationStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
              
              // Only notify human participants — never global chat (leaks FoW / remote battles)
              this.pendingChatMessages = this.pendingChatMessages || [];
              for (const pId of humanParticipants) {
                this.pendingChatMessages.push({
                  playerId: pId,
                  text: `A new battle recording (${battleName}, ${durationStr}) is available for review.`
                });
              }
            }
          }
          this.ongoingBattles.splice(i, 1);
        }
      }
    }
    
    // Remove inactive ships that died during this tick so they don't persist
    let activeIndex = 0;
    for (let i = 0; i < this.ships.length; i++) {
      if (this.ships[i].active) {
        this.ships[activeIndex++] = this.ships[i];
      }
    }
    this.ships.length = activeIndex;
   }

  /**
   * Chat when a player's leaderboard victory bonus (√score) crosses a 3-point milestone
   * (3, 6, 9, … tech / experience / happiness).
   */
  announceVictoryStatMilestones() {
    if (!this.pendingChatMessages) this.pendingChatMessages = [];
    for (const player of this.allPlayers) {
      if (!player || player.id === 'monsters' || player.id === 'monster') continue;
      if (player.isAlive === false) continue;

      const name = player.name || player.id;
      const checks = [
        { bonus: Math.sqrt(player.techScore || 0), field: 'lastTechMilestoneTier', label: 'tech' },
        { bonus: Math.sqrt(player.expScore || 0), field: 'lastExpMilestoneTier', label: 'experience' },
        { bonus: Math.sqrt(player.happinessScore || 0), field: 'lastHappinessMilestoneTier', label: 'happiness' }
      ];

      for (const { bonus, field, label } of checks) {
        const tier = Math.floor(bonus / 3); // 0 below 3, 1 at [3,6), 2 at [6,9), ...
        const last = player[field] || 0;
        if (tier <= last) continue;
        for (let t = last + 1; t <= tier; t++) {
          this.pendingChatMessages.push({
            playerId: 'all',
            text: `${name}'s empire is increasing in ${label}!`
          });
        }
        player[field] = tier;
      }
    }
  }

   /**
    * Award player-conquer XP at most once per victim per game.
    * Returns XP actually granted (0 if already claimed).
    */
   tryAwardPlayerConquerXp(victim, conqueror, amount = 100) {
     if (!victim || victim.id === 'monsters' || !conqueror) return 0;
     if (victim.eliminationXpAwarded) return 0;
     victim.eliminationXpAwarded = true;
     conqueror.expScore = (conqueror.expScore || 0) + amount;
     return amount;
   }

   eliminatePlayer(eliminatedPlayer, conqueror) {
     if (!eliminatedPlayer || eliminatedPlayer.id === 'monsters') return;

     // Skip only while already processed for this death (cleared when they become alive again)
     if (eliminatedPlayer.isEliminated) return;
     eliminatedPlayer.isEliminated = true;

     const stolenCredits = Math.max(0, eliminatedPlayer.credits || 0);
     eliminatedPlayer.credits = 0;

     const resourcesGained = {};
     const resourceKeys = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
     for (const key of resourceKeys) {
       if (eliminatedPlayer.resources && eliminatedPlayer.resources[key] !== undefined) {
         const amt = Math.max(0, eliminatedPlayer.resources[key]);
         resourcesGained[key] = amt;
         eliminatedPlayer.resources[key] = 0;
         if (conqueror) {
           if (!conqueror.resources) conqueror.resources = {};
           conqueror.resources[key] = (conqueror.resources[key] || 0) + amt;
         }
       }
     }

     if (conqueror) {
       conqueror.credits = (conqueror.credits || 0) + stolenCredits;
     }

     // XP only on first elimination of this player in the game (loot always pillaged above)
     let xpGained = 0;
     if (conqueror && !conqueror.isAI) {
       xpGained = this.tryAwardPlayerConquerXp(eliminatedPlayer, conqueror, 100);
     } else if (conqueror && conqueror.isAI) {
       // AI can claim the one-time flag without the human-only message path
       this.tryAwardPlayerConquerXp(eliminatedPlayer, conqueror, 100);
     }

     if (conqueror && !conqueror.isAI) {
       // Build resource string for chat message
       const resParts = [];
       if (stolenCredits > 0) {
         resParts.push(`${Math.round(stolenCredits)} Credits`);
       }
       const resourceEmojis = {
         dilithium: '💎 Dilithium',
         merculite: '☄️ Merculite',
         duranium: '🔲 Duranium',
         tritanium: '🔩 Tritanium',
         antimatter: '🌀 Antimatter',
         deuterium: '💧 Deuterium',
         latinum: '🏺 Latinum'
       };
       for (const [key, amt] of Object.entries(resourcesGained)) {
         if (amt > 0) {
           resParts.push(`${Math.round(amt)} ${resourceEmojis[key] || key}`);
         }
       }
       const resString = resParts.length > 0 ? resParts.join(', ') : 'no assets';

       const xpText = xpGained > 0 ? ` and gained ${xpGained} XP!` : ' (no XP — already conquered once).';
       const messageText = `🏆 ${conqueror.name || conqueror.id} has eliminated ${eliminatedPlayer.name || eliminatedPlayer.id}! Captured ${resString}${xpText}`;

       if (!this.pendingChatMessages) this.pendingChatMessages = [];
       this.pendingChatMessages.push({
         playerId: 'all',
         text: messageText
       });
     } else {
       // If AI conquered them or they died to other forces, send simple system message
       const messageText = `💀 ${eliminatedPlayer.name || eliminatedPlayer.id} has been eliminated!`;
       if (!this.pendingChatMessages) this.pendingChatMessages = [];
       this.pendingChatMessages.push({
         playerId: 'all',
         text: messageText
       });
     }
   }

  triggerDiplomacyEvent(ship, targetPlanet) {
    const expBonus = Math.sqrt(ship.owner.happinessScore || 0);
    const shipExpBonus = ship.getLocalXpBonus();
    const MathSquareBase = expBonus + shipExpBonus;
    const currentSym = getEffectiveSympathy(targetPlanet, ship.owner.id, this.ships, ship.owner, this);
    const disposition = targetPlanet.disposition ? (targetPlanet.disposition[ship.owner.id] ?? 0) : 0;

    const prefRes = targetPlanet.preferredResource;
    const initialQty = prefRes ? (ship.owner.resources?.[prefRes] || 0) : 0;

    if (prefRes && initialQty >= 0.1) {
      ship.owner.resources[prefRes] = Math.max(0, ship.owner.resources[prefRes] - 0.1);
      ship.diplomatPrefResourceEvent = prefRes;
    }

    const hasPref = prefRes && initialQty >= 0.1;

    const chanceBase = 30 + disposition + currentSym + MathSquareBase;
    const chancePref = 30 + disposition + currentSym + (MathSquareBase * 3) + 10;
    
    let rawChance = hasPref ? chancePref : chanceBase;
    if (targetPlanet.racialAffinity && (ship.cruiserStyle === targetPlanet.racialAffinity || (ship.owner && ship.owner.cruiserStyle === targetPlanet.racialAffinity))) {
      rawChance += 20;
    }
    const chancePercent = Math.max(0, Math.round(rawChance));
    
    const roll = Math.floor(Math.random() * 100) + 1;

    ship.gainXp(1, this);

    if (roll <= chancePercent) {
      ship.owner.happinessScore = (ship.owner.happinessScore || 0) + 1;

      targetPlanet.sympathy = targetPlanet.sympathy || {};
      targetPlanet.disposition = targetPlanet.disposition || {};

      if (targetPlanet.disposition[ship.owner.id] === undefined) {
        let rollSum = 0;
        for (let i = 0; i < 10; i++) {
          rollSum += Math.floor(Math.random() * 10) + 1;
        }
        let dispositionVal = rollSum - 60;

        if (initialQty >= 0.1) {
          dispositionVal += (expBonus + shipExpBonus) * 1;
        }
        if (initialQty >= 0.1) {
          dispositionVal += 10;
        }
        dispositionVal += 0.5 * currentSym;

        targetPlanet.disposition[ship.owner.id] = Math.max(-100, Math.min(100, Math.floor(dispositionVal)));
        targetPlanet.dispositionTimers = targetPlanet.dispositionTimers || {};
        targetPlanet.dispositionTimers[ship.owner.id] = 600000;
      }

      const baseIncreaseAmt = Math.floor(1 + (chancePercent - roll) / 25);
      let increaseAmt = baseIncreaseAmt;

      const isTargetFriendly = targetPlanet.owner && targetPlanet.owner.id === ship.owner.id;
      if (isTargetFriendly) {
        increaseAmt = Math.ceil(increaseAmt / 2);
      }

      const actualIncrease = targetPlanet.addSympathy(ship.owner.id, increaseAmt);

      let successXP = Math.floor(1 + actualIncrease / 2);

      ship.gainXp(successXP, this);
      
      ship.diplomatSuccessEvent = (ship.diplomatSuccessEvent || 0) + Math.max(1, actualIncrease);
    } else {
      ship.diplomatFailureEvent = (ship.diplomatFailureEvent || 0) + 1;
      ship.diplomatFailureChance = Math.round(chancePercent);
    }
  }

  handleWreckageDamage(x, y, amoebaDamage, cruiserDamage) {
    if (!this.wreckages) this.wreckages = [];
    if (amoebaDamage <= 0 && cruiserDamage <= 0) return;
    
    // Find an existing wreckage within 300px merge range
    let closestW = null;
    let minDistSq = Infinity;
    for (const w of this.wreckages) {
      const dx = w.x - x;
      const dy = w.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 300 * 300 && distSq < minDistSq) {
        minDistSq = distSq;
        closestW = w;
      }
    }
    
    if (closestW) {
      closestW.amoebaDamage += amoebaDamage;
      closestW.cruiserDamage += cruiserDamage;
      closestW.lastFightingTime = Date.now(); // reset combat lock cooldown to 20s
    } else {
      const wreckage = {
        id: 'wreck_' + Math.random().toString(36).substr(2, 9),
        x: x,
        y: y,
        amoebaDamage: amoebaDamage,
        cruiserDamage: cruiserDamage,
        lastFightingTime: Date.now()
      };
      this.wreckages.push(wreckage);
    }
  }

  spawnNewDeepSpaceAnomaly(x, y, player, shipName, customDifficulty = null) {
    const elapsedMinutes = (Date.now() - (this.gameStartTime || Date.now())) / 60000;
    const isUnlimited = !this.settings || !this.settings.timedGameLimit || this.settings.timedGameLimit === 'unlimited';
    const minDiff = 1;
    const timedLimitSecs = !isUnlimited ? parseFloat(this.settings.timedGameLimit) : null;
    const maxDiff = isUnlimited ? 100 : Math.min(Math.floor((timedLimitSecs / 60) / 2), 100);
    const difficulty = customDifficulty !== null ? customDifficulty : Math.max(1, Math.floor((Math.floor(Math.pow(Math.random(), 2) * (maxDiff - minDiff + 1)) + minDiff) / 2));

    const rewardType = Game.getRandomAnomalyRewardType();

    const planetId = 30000 + this.planets.length;
    const deepSpacePlanet = new Planet(planetId, x, y, 0, null, 0, this.width, this.height);
    deepSpacePlanet.isDeepSpaceAnomaly = true;
    deepSpacePlanet.radius = 0;
    deepSpacePlanet.maxShips = 0;
    deepSpacePlanet.supplies = 0;
    deepSpacePlanet.ships = 0;
    deepSpacePlanet.name = "Deep Space Anomaly";
    deepSpacePlanet.anomaly = {
      id: Math.random().toString(36).substr(2, 9),
      x: x,
      y: y,
      difficulty: difficulty,
      progress: {},
      researched: false,
      beingResearched: false,
      rewardType: rewardType
    };
    this.addPlanet(deepSpacePlanet);

    // Notify player in chat/logs
    this.pendingChatMessages = this.pendingChatMessages || [];
    this.pendingChatMessages.push({
      playerId: player.id,
      text: `🔍 Cruiser ${shipName || 'Cruiser'} has discovered a new Deep Space Anomaly!`
    });
  }

  /** Apply any upgrade tokens banked from anomaly rewards when no cruiser was available. */
  applyBankedUpgradeTokens(player, ship) {
    if (!player || !ship || !ship.isCruiser) return;
    const banked = player.bankedUpgradeTokens || 0;
    if (banked > 0) {
      ship.upgradeTokens = (ship.upgradeTokens || 0) + banked;
      player.bankedUpgradeTokens = 0;
    }
    const bankedTerra = player.bankedTerraforming || 0;
    if (bankedTerra > 0) {
      ship.terraforming = (ship.terraforming || 0) + bankedTerra;
      player.bankedTerraforming = 0;
    }
  }

  triggerAnomalyCompletion(planet, player) {
    const difficulty = planet.anomaly ? planet.anomaly.difficulty : 0;
    
    // Always grant the type shown on the tooltip (fixed at anomaly creation).
    // If missing (legacy/save), assign once and store so it cannot change.
    if (planet.anomaly && !planet.anomaly.rewardType) {
      planet.anomaly.rewardType = Game.getRandomAnomalyRewardType();
    }
    const rewardType = (planet.anomaly && planet.anomaly.rewardType)
      ? planet.anomaly.rewardType
      : 'credits';
    
    let text = '';
    let floatText = '';
    
    const baseVal = Math.max(15, 40 + difficulty * 3);
    const factor = 1.0 + Math.random(); // 100% to 200%
    const creditsValueEquivalent = Math.max(30, baseVal * factor);
    
    const locationName = planet.isDeepSpaceAnomaly ? 'Deep Space' : planet.name;
    const preposition = planet.isDeepSpaceAnomaly ? 'in' : 'on';

    this.recalculateResourceRarities();

    if (rewardType === 'discount') {
      const numDiscounts = Math.max(1, 1 + Math.floor(difficulty / 20));
      const categories = ['sensorarray', 'lab', 'armor', 'shield', 'engine', 'munitions', 'targeting', 'damagecontrol', 'supplyship', 'extendedfuel', 'diplomat', 'marines'];
      const categoryNames = {
        sensorarray: 'Sensor Array',
        lab: 'Science Lab',
        armor: 'Armor',
        shield: 'Shields',
        engine: 'Engine',
        munitions: 'Munitions',
        targeting: 'Targeting',
        damagecontrol: 'Damage Control',
        supplyship: 'Supply Ship',
        extendedfuel: 'Extended Fuel',
        diplomat: 'Diplomat',
        marines: 'Marines'
      };
      const applied = [];
      for (let d = 0; d < numDiscounts; d++) {
        const eligible = categories.filter(cat => (player.upgradeModifiers[cat] || 0) > -0.75);
        if (eligible.length > 0) {
          const chosen = eligible[Math.floor(Math.random() * eligible.length)];
          player.upgradeModifiers[chosen] = Math.max(-0.75, (player.upgradeModifiers[chosen] || 0) - 0.15);
          applied.push(chosen);
        }
      }
      const appliedNames = applied.map(cat => categoryNames[cat] || cat);
      text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received upgrade discount(s) for ${appliedNames.join(', ')}!`;
      floatText = `DISCOUNTS!`;
    } else if (rewardType === 'credits') {
      const creditsReward = Math.round(creditsValueEquivalent);
      player.credits = (player.credits || 0) + creditsReward;
      text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received +${creditsReward} Credits!`;
      floatText = `+${creditsReward} 💲`;
    } else if (rewardType === 'tech') {
      const techReward = Math.round(creditsValueEquivalent / 10);
      player.techScore = (player.techScore || 0) + techReward;
      text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received +${techReward} Tech Score!`;
      floatText = `+${techReward} 🔬`;
    } else if (rewardType === 'xp') {
      const expReward = Math.round(creditsValueEquivalent / 10);
      player.expScore = (player.expScore || 0) + expReward;
      text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received +${expReward} Player XP!`;
      floatText = `+${expReward} XP`;
    } else if (rewardType === 'hab') {
      // Terraforming charges go on the completing cruiser; parked over a friendly
      // world they spend 1 charge / 10s to raise that planet's habitability.
      const habReward = Math.round(creditsValueEquivalent / 5);
      const completingShipId = planet.anomaly ? planet.anomaly.completingShipId : null;
      let targetShip = this.ships.find(s => s.id === completingShipId);
      if (!targetShip || !targetShip.isCruiser || !targetShip.active) {
        let minDistSq = Infinity;
        for (const s of this.ships) {
          if (s.active && s.isCruiser && s.owner === player) {
            const dx = s.x - (planet.anomaly ? planet.anomaly.x : planet.x);
            const dy = s.y - (planet.anomaly ? planet.anomaly.y : planet.y);
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              targetShip = s;
            }
          }
        }
      }
      if (targetShip && targetShip.isCruiser) {
        targetShip.terraforming = (targetShip.terraforming || 0) + habReward;
        text = `ANOMALY RESOLVED ${preposition} ${locationName}: Cruiser ${targetShip.name || ''} received +${habReward} Terraforming!`;
        floatText = `+${habReward} 🌱 TERRAFORMING!`;
      } else {
        // No cruiser available — charges banked on the player for the next cruiser build path isn't wired;
        // grant to nearest owned planet's future use by storing on player as bankedTerraforming.
        player.bankedTerraforming = (player.bankedTerraforming || 0) + habReward;
        text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received +${habReward} Terraforming (banked for your next cruiser)!`;
        floatText = `+${habReward} 🌱 (banked)`;
      }
    } else if (rewardType === 'rare_resource_cache') {
      const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      let rareResources = resourcesList.filter(r => this.resourceRarities && (this.resourceRarities[r] === 'rare' || this.resourceRarities[r] === 'exotic'));
      if (rareResources.length === 0) {
        rareResources = resourcesList.filter(r => this.resourceRarities && this.resourceRarities[r] === 'normal');
      }
      if (rareResources.length === 0) {
        rareResources = resourcesList;
      }
      const chosenRes = rareResources[Math.floor(Math.random() * rareResources.length)];
      const qty = (Math.floor(Math.random() * 6) + 1) + Math.floor(creditsValueEquivalent / 20);
      
      player.resources = player.resources || {};
      player.resources[chosenRes] = (player.resources[chosenRes] || 0) + qty;
      
      const resName = chosenRes.charAt(0).toUpperCase() + chosenRes.slice(1);
      text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received +${qty} ${resName}!`;
      floatText = `+${qty} ${resName}!`;
    } else if (rewardType === 'upgrade_token') {
      const numTokens = 1 + Math.floor(creditsValueEquivalent / 40);
      const completingShipId = planet.anomaly ? planet.anomaly.completingShipId : null;
      let targetShip = this.ships.find(s => s.id === completingShipId);
      if (!targetShip || !targetShip.isCruiser) {
        let minDistSq = Infinity;
        for (const s of this.ships) {
          if (s.active && s.isCruiser && s.owner === player) {
            const dx = s.x - planet.x;
            const dy = s.y - planet.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              targetShip = s;
            }
          }
        }
      }
      // Never substitute a different reward type — bank tokens if no cruiser is available
      if (targetShip && targetShip.isCruiser) {
        targetShip.upgradeTokens = (targetShip.upgradeTokens || 0) + numTokens;
        text = `ANOMALY RESOLVED ${preposition} ${locationName}: Cruiser ${targetShip.name || ''} received +${numTokens} Upgrade Tokens!`;
        floatText = `+${numTokens} Tokens`;
      } else {
        player.bankedUpgradeTokens = (player.bankedUpgradeTokens || 0) + numTokens;
        text = `ANOMALY RESOLVED ${preposition} ${locationName}: Received +${numTokens} Upgrade Tokens (banked for your next cruiser)!`;
        floatText = `+${numTokens} Tokens (banked)`;
      }
    }
    
    // Add to pending chat messages for the player
    this.pendingChatMessages = this.pendingChatMessages || [];
    this.pendingChatMessages.push({
      playerId: player.id,
      text: text
    });
    
    // Add to pending anomaly completions so the server broadcasts to the client
    this.pendingAnomalyCompletions = this.pendingAnomalyCompletions || [];
    this.pendingAnomalyCompletions.push({
      playerId: player.id,
      x: planet.anomaly ? planet.anomaly.x : planet.x,
      y: planet.anomaly ? planet.anomaly.y : planet.y,
      text: floatText
    });

    if (planet.isDeepSpaceAnomaly) {
      this.planets = this.planets.filter(p => p !== planet);
      for (const ship of this.ships) {
        if (ship.targetPlanet === planet) {
          ship.targetPlanet = null;
        }
      }
    }
  }

  updateCustomCruiserSystems(dt) {
    if (!this.isRunning || this.isPaused) return;

    // If a target dies mid-boarding, clear the ray and refund attackers' marines
    for (const s of this.ships) {
      if (!s || !s.isUnderBoarding) continue;
      if (s.active && (s.health || 0) > 0) continue;
      const refund = Math.max(0, Math.floor(s.boardingMarines || 0));
      if (refund > 0 && s.boardingSourceContributions) {
        const totalStart = s.boardingStartMarines || refund || 1;
        for (const contrib of s.boardingSourceContributions) {
          const launcher = this.ships.find(x => x.id === contrib.shipId && x.active);
          if (!launcher) continue;
          const share = Math.floor(refund * ((contrib.contributed || 0) / totalStart));
          if (share > 0) launcher.marineCount = (launcher.marineCount || 0) + share;
        }
      }
      s.isUnderBoarding = false;
      s.boardingMarines = 0;
      s.boardingTimer = 0;
      s.boardingSourceContributions = null;
      s.boardingSourceId = null;
      s.boardingPlayer = null;
      console.log(`[BOARDING ABORT] Target cruiser ${s.id} destroyed during boarding; marines refunded.`);
    }

    const cruisers = this.ships.filter(s => s.active && s.isCruiser);
    const pods = this.ships.filter(s => s.active && (s.isBoardingFleet || s.isReturnPod));

    // A mapping from diplomat ship ID to the ship object for quick lookup
    const diplomatShipsMap = new Map();
    for (const ship of cruisers) {
      if ((ship.diplomat || 0) > 0 && ship.isDiplomacy) {
        diplomatShipsMap.set(ship.id, ship);
      }
    }

    // Validate activeDiplomatId for each planet
    for (const p of this.planets) {
      if (p.activeDiplomatId) {
        const diplomat = diplomatShipsMap.get(p.activeDiplomatId);
        let isValid = false;
        if (diplomat && diplomat.active && !p.dead && (diplomat.parley || 0) > 0) {
          // Check sensor range
          let baseCruiserRadar = 25 + diplomat.maxHealth * 2;
          let radar = baseCruiserRadar + 25 * (diplomat.sensorarrays || 0);
          radar *= (1 + 0.10 * (diplomat.sensorarrays || 0));
          if (diplomat.isWarp) radar *= 0.25;
          if (diplomat.owner) {
            const techBonus = 0.01 * Math.sqrt(diplomat.owner.techScore || 0);
            radar *= (1 + techBonus);
          }
          const dx = p.x - diplomat.x;
          const dy = p.y - diplomat.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist <= radar) {
            isValid = true;
          }
        }
        if (!isValid) {
          p.activeDiplomatId = null;
        }
      }
    }

    // Update diplomacy timers and parley consumption for each planet
    for (const p of this.planets) {
      if (p.activeDiplomatId) {
        const diplomat = diplomatShipsMap.get(p.activeDiplomatId);
        if (diplomat) {
          // Continuous warmup progression
          const diplomatsCount = diplomat.diplomat || 1;
          p.diplomacyWarmupTimer = Math.min(30, (p.diplomacyWarmupTimer || 0) + dt * diplomatsCount);
          // Check completion
          if (p.diplomacyWarmupTimer >= 30) {
            p.diplomacyWarmupTimer = 0;
            diplomat.parley = Math.max(0, (diplomat.parley || 0) - 1);
            this.triggerDiplomacyEvent(diplomat, p);
            p.activeDiplomatId = null;
            diplomat.diplomatTargetPlanetId = null;
          }
        }
      } else {
        // Cooldown/decay at the same rate
        if (p.diplomacyWarmupTimer && p.diplomacyWarmupTimer > 0) {
          p.diplomacyWarmupTimer = Math.max(0, p.diplomacyWarmupTimer - dt);
        }
      }
    }

    // Handle Pods tracking and collision/impact
    for (const pod of pods) {
      const target = this.ships.find(s => s.id === pod.targetShipId && s.active);
      if (!target) {
        // Target is destroyed
        if (pod.isBoardingFleet) {
          // Turn into return pod back to launcher (if launcher alive)
          const launcher = this.ships.find(s => s.id === pod.sourceShipId && s.active);
          if (launcher) {
            pod.isBoardingFleet = false;
            pod.isReturnPod = true;
            pod.targetShipId = launcher.id;
          } else {
            pod.active = false;
          }
        } else {
          pod.active = false;
        }
        continue;
      }

      // Track target coordinate
      pod.targetX = target.x;
      pod.targetY = target.y;
      pod.startX = pod.x;
      pod.startY = pod.y;

      // Check distance for impact
      const dx = target.x - pod.x;
      const dy = target.y - pod.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= 5) {
        pod.active = false;
        if (pod.isBoardingFleet) {
          const podMarines = Math.max(0, Math.floor(pod.marineCount || 0));
          if (podMarines > 0 && (!target.boardingCooldown || target.boardingCooldown <= 0 || target.isUnderBoarding)) {
            target.isUnderBoarding = true;
            target.boardingPlayer = pod.owner;
            target.boardingMarines = (target.boardingMarines || 0) + podMarines;
            target.boardingSourceId = pod.sourceShipId;
            // Ensure resolution timer exists so the boarding ray can finish
            if (target.boardingTimer == null || target.boardingTimer <= 0) {
              target.boardingTimer = 5.0;
            }
            if (!target.boardingCooldown || target.boardingCooldown <= 0) {
              target.boardingCooldown = 60.0;
            }
            if (!target.boardingSourceContributions) {
              target.boardingSourceContributions = [];
            }
            if (pod.sourceShipId != null) {
              target.boardingSourceContributions.push({ shipId: pod.sourceShipId, contributed: podMarines });
              target.boardingStartMarines = (target.boardingStartMarines || 0) + podMarines;
            }
          }
        } else if (pod.isReturnPod) {
          const maxCapacity = (target.marines || 0) > 0 ? Math.ceil(((target.marines || 0) * target.maxHealth) / 2) + 5 : 0;
          target.marineCount = Math.min(maxCapacity, (target.marineCount || 0) + pod.marineCount);
        }
      }
    }

    // Handle Cruisers simulation
    for (const ship of cruisers) {
      if (ship.isUpgrading) continue;

      if (ship.boardingCooldown && ship.boardingCooldown > 0) {
        ship.boardingCooldown = Math.max(0, ship.boardingCooldown - dt);
      }

      // 0. Process queued marine launches (re-check range every batch so leaving a well cancels)
      if (ship.pendingMarineLaunches && ship.pendingMarineLaunches.length > 0) {
        for (let i = 0; i < ship.pendingMarineLaunches.length; i++) {
          const launch = ship.pendingMarineLaunches[i];
          launch.timer -= dt;
          if (launch.timer <= 0) {
            // Abort planet assaults/revolts if the cruiser is no longer in valid range
            // (assault also requires still holding still with empty bombs)
            if (launch.targetType === 'planet' && !launch.isBoardingFleet) {
              const mode = launch.launchMode || 'assault';
              if (!this.isCruiserInMarineLaunchRange(ship, launch.targetId, mode)
                  || (mode === 'assault' && !this.isCruiserReadyForStandardInvasion(ship))) {
                ship.marineCount = (ship.marineCount || 0) + (launch.count || 0);
                ship.pendingMarineLaunches.splice(i, 1);
                i--;
                continue;
              }
            }
            let success = false;
            const batchSize = Math.min(launch.count, 20);
            if (batchSize > 0) {
              success = this.executeQueuedLaunch(ship, launch, batchSize);
              if (success) {
                launch.count -= batchSize;
              }
            }
            if (launch.count <= 0 || !success) {
              if (!success && launch.count > 0) {
                ship.marineCount = (ship.marineCount || 0) + (launch.count || 0);
              }
              ship.pendingMarineLaunches.splice(i, 1);
              i--;
            } else {
              launch.timer = 2.0;
            }
          }
        }
      }

      const radar = ship.cruiserRadarRange();

      // 2. Crew restoration
      // "not within 100px of enemy vessels automatically restore crew at no cost at the rate of 1 per second"
      let enemyNearby = false;
      const nearbyOthers = (typeof this.ships.getShipsInRadiusSq === 'function')
        ? this.ships.getShipsInRadiusSq(ship.x, ship.y, 100 * 100)
        : this.ships;
      for (const other of nearbyOthers) {
        if (other.active && other.id !== ship.id) {
          const isEnemy = (other.owner && other.owner.id !== ship.owner.id) || other.isAmoeba;
          if (isEnemy) {
            const dx = other.x - ship.x;
            const dy = other.y - ship.y;
            if (dx*dx + dy*dy <= 100 * 100) {
              enemyNearby = true;
              break;
            }
          }
        }
      }

      if (ship.inFriendlyWell && !enemyNearby) {
        ship.crew = Math.min(ship.maxHealth + ship.health, (ship.crew || 0) + 1 * dt);
      }

      // 3. Marine Invasion Checks (Preempts friendly load/deposit)
      let invasionLaunched = false;
      const maxMarinesCapacity = (ship.marines || 0) > 0 ? Math.ceil(((ship.marines || 0) * (ship.maxHealth || 0)) / 2) + 5 : 0;
      
      // 3a. Standard marine invasion: Scout Attack On + over/near enemy planet
      // Must be within 15px of the planet's perimeter (dist <= radius + 15).
      // Also: hold still 3s and empty bombs first so the cruiser bombards before dumping marines.
      if (ship.scoutAttackEnabled === true && (ship.marineCount || 0) > 0 && (!ship.marineLaunchCooldown || ship.marineLaunchCooldown <= 0)) {
        const hasEnoughMarines = maxMarinesCapacity > 0 && ship.marineCount > 0.5 * maxMarinesCapacity;
        if (hasEnoughMarines && this.isCruiserReadyForStandardInvasion(ship)) {
          for (const p of this.planets) {
            if (p.isDeepSpaceAnomaly) continue;
            if (!p.dead && (!p.owner || p.owner.id !== ship.owner.id)) {
              if (!this.isCruiserInMarineLaunchRange(ship, p.id, 'assault')) continue;
              const count = Math.floor(ship.marineCount);
              if (count > 0) {
                ship.marineCount = Math.max(0, (ship.marineCount || 0) - count);
                this.queueMarineLaunch(ship, {
                  targetType: 'planet',
                  targetId: p.id,
                  isBoardingFleet: false,
                  launchMode: 'assault',
                  count: count
                });
                ship.marineLaunchCooldown = 15.0;
                invasionLaunched = true;
                break;
              }
            }
          }
        }
      }

      // 3b. Revolt Reaction Invasion — ONLY while cruiser is inside that planet's gravity well
      // Requires Scout Attack not Peace; cap total inbound marines at maxShips+ships.
      if (!invasionLaunched
          && ship.scoutAttackEnabled !== 'peace'
          && (ship.marineCount || 0) > 0
          && (!ship.marineLaunchCooldown || ship.marineLaunchCooldown <= 0)) {
        for (const p of this.planets) {
          if (p.isDeepSpaceAnomaly) continue;
          if (!p.dead && p.inRevolt && (!p.owner || p.owner.id !== ship.owner.id)) {
            if (!this.isCruiserInMarineLaunchRange(ship, p.id, 'revolt')) continue;

            const planetCap = (p.maxShips || 0) + (p.ships || 0);
            const inbound = this.countMarinesInboundToPlanet(p.id, ship.owner ? ship.owner.id : null, ship.id);
            // Do not launch if others already cover the full planet budget
            if (inbound >= planetCap) continue;

            const room = planetCap - inbound;
            const onBoard = Math.floor(ship.marineCount);
            const count = Math.min(onBoard, room);
            if (count > 0) {
              this.queueMarineLaunch(ship, {
                targetType: 'planet',
                targetId: p.id,
                isBoardingFleet: false,
                launchMode: 'revolt',
                count: count
              });
              ship.marineCount = Math.max(0, (ship.marineCount || 0) - count);
              ship.marineLaunchCooldown = 15.0;
              invasionLaunched = true;
              break;
            }
          }
        }
      }

      // 3c. Load / Deposit Marines (driven by Scout Attack mode, not Load/Unload toggles)
      // - Not Peace (On or Off): load from friendly wells
      // - Peace (Hold Fire): deposit back to friendly planets
      if (!invasionLaunched && ship.inFriendlyWell && (ship.marines || 0) > 0) {
        if (ship.scoutAttackEnabled === 'peace') {
          // Deposit marines up to the planet's capacity if inside a friendly planet's gravity well
          for (const p of this.planets) {
            if ((ship.marineCount || 0) <= 0) break;
            if (p.owner && p.owner.id === ship.owner.id) {
              const pdx = p.x - ship.x;
              const pdy = p.y - ship.y;
              const distSq = pdx * pdx + pdy * pdy;
              const gr = p.getGravityRadius();
              if (distSq < gr * gr) {
                const spaceAvailable = Math.max(0, p.maxShips - p.ships);
                if (spaceAvailable > 0) {
                  // Deposit continuously at a rate of 1 per second
                  const toUnload = Math.min(ship.marineCount, spaceAvailable, 1 * dt);
                  if (toUnload > 0) {
                    ship.marineCount = Math.max(0, ship.marineCount - toUnload);
                    p.ships += toUnload;
                  }
                }
              }
            }
          }
        } else {
          // Load marines when Scout Attack is On or Off (not Hold Fire / peace)
          // "from planets with > 50% ships at cost of 1 ship from nearby planet for each marine"
          const capacity = Math.ceil((ship.marines * ship.maxHealth) / 2) + 5;
          for (const p of this.planets) {
            if (ship.marineCount >= capacity) break;
            if (p.owner && p.owner.id === ship.owner.id) {
              const pdx = p.x - ship.x;
              const pdy = p.y - ship.y;
              const distSq = pdx*pdx + pdy*pdy;
              const gr = p.getGravityRadius();
              if (distSq < gr * gr) {
                // Rule: When loading marines, do not load from a garrison world that is within 10 of twice maxships
                // unless the ship to be loaded is sitting within 25px of the planet.
                const isSuchGarrisonWorld = (p.isMilitary || p.focusMode === 'garrison') && (p.ships >= p.maxShips * 2 - 10);
                if (isSuchGarrisonWorld && distSq > 25 * 25) {
                  continue;
                }

                const halfCapacity = 0.5 * p.maxShips;
                if (p.ships > halfCapacity) {
                  const needed = capacity - ship.marineCount;
                  const available = p.ships - halfCapacity;
                  // Load continuously at a rate of 1 per second
                  const toLoad = Math.min(needed, available, 1 * dt);
                  if (toLoad > 0) {
                    ship.marineCount += toLoad;
                    p.ships = Math.max(0, p.ships - toLoad);
                  }
                }
              }
            }
          }
        }
      }

      // 4. Diplomats sympathy generation
      if ((ship.diplomat || 0) > 0) {
        ship.parley = Math.min((ship.diplomat || 0) * 3, (ship.parley || 0) + ((ship.diplomat || 0) / 60) * dt);
        if (ship.isDiplomacy) {
          ship.diplomatTargetPlanetId = null;
          // Find all qualifying planets (neutral, enemy, or friendly) within sensor range that are not at max empathy/sympathy
          const qualifyingPlanets = [];
          const isParleyFull = (ship.parley || 0) >= (ship.diplomat || 0) * 3 - 0.01;
          for (const p of this.planets) {
            // Only one diplomat may attempt diplomacy on a planet at a time.
            if (p.activeDiplomatId && p.activeDiplomatId !== ship.id) {
              continue;
            }

            const dx = p.x - ship.x;
            const dy = p.y - ship.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= radar) {
              const baseSym = p.sympathy ? (p.sympathy[ship.owner.id] || 0) : 0;
              const limit = Math.max(p.maxShips, p.ships || 0);
              const isMaxEmpathy = baseSym >= limit;
              if (!isMaxEmpathy && !p.dead) {
                const isFriendly = p.owner && p.owner.id === ship.owner.id;
                if (isFriendly) {
                  const isTargeted = (ship.targetPlanet && ship.targetPlanet.id === p.id) || 
                                     (ship.cruiserTargetType === 'planet' && ship.cruiserTargetId === p.id);
                  if (!isParleyFull && !isTargeted) {
                    // Don't use parleys on a friendly world unless parley capacity is full or targeted
                    continue;
                  }
                }
                qualifyingPlanets.push({ planet: p, dist: dist });
              }
            }
          }

          let closestPlanet = null;
          if (qualifyingPlanets.length > 0) {
            const closeQualifying = qualifyingPlanets.filter(qp => qp.dist <= 40);
            if (closeQualifying.length > 0) {
              // Exception: select the closest qualifying planet within 40px
              let minDist = Infinity;
              for (const qp of closeQualifying) {
                if (qp.dist < minDist) {
                  minDist = qp.dist;
                  closestPlanet = qp.planet;
                }
              }
            } else {
              // General Rule: sort based on the sympathy tiers and disposition (ties broken by closer distance)
              qualifyingPlanets.sort((a, b) => {
                const isFriendlyA = a.planet.owner && a.planet.owner.id === ship.owner.id;
                const isFriendlyB = b.planet.owner && b.planet.owner.id === ship.owner.id;

                const symA = getEffectiveSympathy(a.planet, ship.owner.id, this.ships, ship.owner, this);
                const symB = getEffectiveSympathy(b.planet, ship.owner.id, this.ships, ship.owner, this);

                // Friendly planets are low priority (Tier 0)
                const tierA = isFriendlyA ? 0 : ((symA === 0) ? 3 : ((symA > a.planet.ships) ? 1 : 2));
                const tierB = isFriendlyB ? 0 : ((symB === 0) ? 3 : ((symB > b.planet.ships) ? 1 : 2));

                if (tierA !== tierB) {
                  return tierB - tierA; // Higher tier first
                }

                const hasDispA = a.planet.disposition && a.planet.disposition[ship.owner.id] !== undefined;
                const hasDispB = b.planet.disposition && b.planet.disposition[ship.owner.id] !== undefined;

                if (hasDispA !== hasDispB) {
                  return hasDispA ? 1 : -1; // No disposition first
                }

                if (hasDispA && hasDispB) {
                  const dispValA = a.planet.disposition[ship.owner.id];
                  const dispValB = b.planet.disposition[ship.owner.id];
                  if (dispValA !== dispValB) {
                    return dispValB - dispValA; // Higher disposition first
                  }
                }

                return a.dist - b.dist; // Closer first
              });
              closestPlanet = qualifyingPlanets[0].planet;
            }
          }

          const targetPlanet = closestPlanet;
          if (targetPlanet) {
            const isContinuing = targetPlanet.activeDiplomatId === ship.id;
            if (isContinuing || (ship.parley || 0) > 1) {
              ship.diplomatTargetPlanetId = targetPlanet.id;
              // Claim this planet and release any other planets previously claimed by this ship
              for (const pl of this.planets) {
                if (pl.activeDiplomatId === ship.id && pl.id !== targetPlanet.id) {
                  pl.activeDiplomatId = null;
                }
              }
              targetPlanet.activeDiplomatId = ship.id;
            } else {
              // Cannot start diplomacy on targetPlanet since parley <= 1 and we were not already active on it.
              ship.diplomatTargetPlanetId = null;
              for (const pl of this.planets) {
                if (pl.activeDiplomatId === ship.id) {
                  pl.activeDiplomatId = null;
                }
              }
            }
          } else {
            // No target, release any previous claims by this ship
            for (const pl of this.planets) {
              if (pl.activeDiplomatId === ship.id) {
                pl.activeDiplomatId = null;
              }
            }
          }
        } else {
          ship.diplomatTargetPlanetId = null;
          for (const pl of this.planets) {
            if (pl.activeDiplomatId === ship.id) {
              pl.activeDiplomatId = null;
            }
          }
        }
      }

      // (Marine Invasion checks moved to step 3a and 3b)


      // 5. Boarding Trigger Checks (New: Direct Boarding if disabled & isolated)
      // Require whole marines only — fractional marineCount from continuous load must not
      // start a boarding action with 0 transferred marines (stuck ray forever).
      if (ship.health < 2 && ship.health > 0 && !ship.isUnderBoarding && !ship.isMaterializing && (!ship.boardingCooldown || ship.boardingCooldown <= 0)) {
        const sensorRange = ship.cruiserRadarRange();
        const friendlyNearby = cruisers.some(other => 
          other.id !== ship.id && 
          other.owner && 
          ship.owner && 
          other.owner.id === ship.owner.id && 
          !other.isMaterializing && 
          Math.hypot(other.x - ship.x, other.y - ship.y) <= sensorRange
        );

        if (!friendlyNearby) {
          const enemiesInRange = cruisers.filter(other => 
            other.owner && 
            ship.owner && 
            other.owner.id !== ship.owner.id && 
            !other.isAmoeba &&
            Math.floor(other.marineCount || 0) > 0 && 
            !other.isMaterializing && 
            other.scoutAttackEnabled === true &&
            Math.hypot(other.x - ship.x, other.y - ship.y) <= other.cruiserRadarRange()
          );

          if (enemiesInRange.length > 0) {
            const playerMarineCounts = new Map();
            for (const ec of enemiesInRange) {
              const pId = ec.owner.id;
              const whole = Math.floor(ec.marineCount || 0);
              playerMarineCounts.set(pId, (playerMarineCounts.get(pId) || 0) + whole);
            }

            let bestPlayerId = null;
            let maxMarines = 0;
            for (const [pId, mCount] of playerMarineCounts.entries()) {
              if (mCount > maxMarines) {
                maxMarines = mCount;
                bestPlayerId = pId;
              }
            }

            if (bestPlayerId && maxMarines > 0) {
              const bestPlayer = this.allPlayers.find(p => p.id === bestPlayerId);
              const attackingCruisers = enemiesInRange.filter(ec => ec.owner.id === bestPlayerId);

              const contributions = [];
              let totalAttackingMarines = 0;
              for (const ac of attackingCruisers) {
                const mCount = Math.floor(ac.marineCount || 0);
                if (mCount > 0) {
                  contributions.push({ shipId: ac.id, contributed: mCount });
                  ac.marineCount = Math.max(0, (ac.marineCount || 0) - mCount);
                  totalAttackingMarines += mCount;
                }
              }

              // Only commit boarding once we actually transferred marines
              if (totalAttackingMarines > 0 && bestPlayer) {
                ship.isUnderBoarding = true;
                ship.boardingPlayer = bestPlayer;
                ship.boardingTimer = 5.0;
                ship.boardingCooldown = 60.0;
                ship.boardingSourceContributions = contributions;
                ship.boardingStartMarines = totalAttackingMarines;
                ship.boardingMarines = totalAttackingMarines;
                ship.boardingSourceId = contributions[0] ? contributions[0].shipId : null;

                console.log(`[BOARDING STARTED] Cruiser ${ship.id} is being boarded by player ${bestPlayer.name} with ${totalAttackingMarines} marines.`);
              }
            }
          }
        }
      }

      // Stuck boarding cleanup: ray on with 0 marines never resolves
      if (ship.isUnderBoarding && !(ship.boardingMarines > 0)) {
        ship.isUnderBoarding = false;
        ship.boardingTimer = 0;
        ship.boardingMarines = 0;
        ship.boardingSourceContributions = null;
        ship.boardingSourceId = null;
        ship.boardingPlayer = null;
        console.log(`[BOARDING ABORT] Cleared empty boarding state on Cruiser ${ship.id}.`);
      }

      // 6. Boarding Battle Combat resolution
      if (ship.isUnderBoarding && ship.boardingMarines > 0) {
        if (ship.boardingTimer == null || ship.boardingTimer === undefined) {
          ship.boardingTimer = 5.0;
        }

        ship.boardingTimer = Math.max(0, ship.boardingTimer - dt);

        if (ship.boardingTimer <= 0) {
          if (ship.boardingPlayer && ship.boardingSourceContributions) {
            const alreadyContributingIds = new Set(ship.boardingSourceContributions.map(c => c.shipId));
            const lateCruisers = cruisers.filter(other => 
              other.owner && 
              other.owner.id === ship.boardingPlayer.id &&
              !alreadyContributingIds.has(other.id) &&
              !other.isAmoeba &&
              other.marineCount > 0 &&
              !other.isMaterializing &&
              other.scoutAttackEnabled === true &&
              Math.hypot(other.x - ship.x, other.y - ship.y) <= other.cruiserRadarRange()
            );

            if (lateCruisers.length > 0) {
              let lateMarines = 0;
              for (const lc of lateCruisers) {
                const mCount = Math.floor(lc.marineCount || 0);
                if (mCount > 0) {
                  ship.boardingSourceContributions.push({ shipId: lc.id, contributed: mCount });
                  lc.marineCount -= mCount;
                  lateMarines += mCount;
                }
              }
              ship.boardingStartMarines = (ship.boardingStartMarines || 0) + lateMarines;
              ship.boardingMarines = (ship.boardingMarines || 0) + lateMarines;
              console.log(`[BOARDING LATE JOIN] ${lateCruisers.length} additional cruisers joined the boarding action adding ${lateMarines} marines.`);
            }
          }

          let M_atk = Math.max(0, Math.floor(ship.boardingMarines || 0));
          let M_def = Math.max(0, Math.floor(ship.marineCount || 0));
          let C_def = Math.max(0, Math.floor(ship.crew || 0));

          // Calculate tech/XP bonuses
          const defenderPlayer = ship.owner || { id: 'monsters', techScore: 0, expScore: 0 };
          const attackerPlayer = ship.boardingPlayer || { id: 'unknown', techScore: 0, expScore: 0 };

          const defTech = Math.sqrt(defenderPlayer.techScore || 0);
          const defXp = Math.sqrt(ship.expScore || 0);
          const defHitChance = Math.max(1, 10 + defTech + defXp);

          let atkXp = 0;
          if (ship.boardingSourceContributions && ship.boardingSourceContributions.length > 0) {
            const launcher = this.ships.find(s => s.id === ship.boardingSourceContributions[0].shipId && s.active);
            if (launcher) {
              atkXp = Math.sqrt(launcher.expScore || 0);
            }
          }
          const atkTech = Math.sqrt(attackerPlayer.techScore || 0);
          const atkHitChance = Math.max(1, 10 + atkTech + atkXp);

          const leftUnits = [];
          for (let i = 0; i < M_def; i++) {
            leftUnits.push({ id: `L_${i}`, type: 'marine', side: 'left', alive: true });
          }
          for (let i = 0; i < C_def; i++) {
            leftUnits.push({ id: `L_${M_def + i}`, type: 'crew', side: 'left', alive: true });
          }

          const rightUnits = [];
          for (let i = 0; i < M_atk; i++) {
            rightUnits.push({ id: `R_${i}`, type: 'marine', side: 'right', alive: true });
          }

          let currentTime = 0;
          const events = [];
          // Cap rounds so a bad RNG / zero-hit edge case cannot freeze the sim
          const maxBoardingRounds = 200;
          let boardingRounds = 0;

          while (leftUnits.some(u => u.alive) && rightUnits.some(u => u.alive) && boardingRounds < maxBoardingRounds) {
            boardingRounds++;
            const roundShots = [];
            
            leftUnits.forEach(u => {
              if (u.alive) {
                roundShots.push({ shooter: u, time: currentTime + Math.random() * 3.0, enemyUnits: rightUnits, hitChance: defHitChance });
              }
            });

            rightUnits.forEach(u => {
              if (u.alive) {
                roundShots.push({ shooter: u, time: currentTime + Math.random() * 3.0, enemyUnits: leftUnits, hitChance: atkHitChance });
              }
            });

            // Sort shots chronologically within this 3-second interval
            roundShots.sort((a, b) => a.time - b.time);

            // Execute shots sequentially
            for (const shot of roundShots) {
              if (!shot.shooter.alive) continue;

              const aliveEnemies = shot.enemyUnits.filter(u => u.alive);
              if (aliveEnemies.length === 0) break;

              if (Math.random() * 100 < shot.hitChance) {
                const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                target.alive = false;
                events.push({
                  time: shot.time,
                  shooterId: shot.shooter.id,
                  targetId: target.id
                });
              }
            }

            currentTime += 3.0;
          }

          // If capped out, force a winner by remaining unit counts
          if (leftUnits.some(u => u.alive) && rightUnits.some(u => u.alive)) {
            const lCount = leftUnits.filter(u => u.alive).length;
            const rCount = rightUnits.filter(u => u.alive).length;
            if (rCount >= lCount) {
              leftUnits.forEach(u => { u.alive = false; });
            } else {
              rightUnits.forEach(u => { u.alive = false; });
            }
          }

          const leftSurvivors = leftUnits.filter(u => u.alive);
          const rightSurvivors = rightUnits.filter(u => u.alive);

          const survivorMarines = leftSurvivors.filter(u => u.type === 'marine').length;
          const survivorCrew = leftSurvivors.filter(u => u.type === 'crew').length;

          // Record Replay
          ship.boardingAttempts = (ship.boardingAttempts || 0) + 1;
          let replayName = `The battle for ${ship.name || ship.configName || ("Cruiser " + ship.id)}`;
          if (ship.boardingAttempts > 1) {
            replayName += `, Round ${ship.boardingAttempts}`;
          }
          const replay = {
            id: `rep_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: replayName,
            timestamp: Date.now(),
            leftSide: {
              name: ship.owner && ship.owner.id === 'monsters' ? 'MONSTERS' : (ship.owner ? (ship.owner.name || ship.owner.id) : 'Defender'),
              color: ship.owner ? (ship.owner.color || '#ffffff') : '#ffffff',
              units: leftUnits.map((u, idx) => ({ id: u.id, type: u.type, side: u.side, index: idx })),
              hitChance: defHitChance
            },
            rightSide: {
              name: ship.boardingPlayer ? (ship.boardingPlayer.name || ship.boardingPlayer.id) : 'Attacker',
              color: ship.boardingPlayer ? (ship.boardingPlayer.color || '#ff3366') : '#ff3366',
              units: rightUnits.map((u, idx) => ({ id: u.id, type: u.type, side: u.side, index: idx })),
              hitChance: atkHitChance
            },
            events: events,
            winner: leftSurvivors.length > 0 ? 'Defender' : 'Attacker',
            totalDuration: Math.max(1, currentTime),
            type: 'boarding',
            participants: [ship.owner ? ship.owner.id : 'monsters', ship.boardingPlayer ? ship.boardingPlayer.id : 'monsters']
          };

          if (!this.boardingReplays) {
            this.boardingReplays = [];
          }
          this.boardingReplays.push(replay);

          if (leftSurvivors.length > 0) {
            // Defenders win!
            ship.isUnderBoarding = false;
            ship.boardingMarines = 0;
            ship.boardingTimer = 0;
            ship.marineCount = survivorMarines;
            ship.crew = survivorCrew;
            ship.boardingResultEvent = {
              success: false,
              text: 'BOARDING REPELLED!',
              color: (ship.owner && ship.owner.color) ? ship.owner.color : '#ffffff',
              shipName: ship.name || ship.configName || `Cruiser ${ship.id}`,
              attackerName: ship.boardingPlayer ? (ship.boardingPlayer.name || ship.boardingPlayer.id) : 'Attacker',
              defenderName: ship.owner ? (ship.owner.name || ship.owner.id) : 'Defender'
            };
            console.log(`[BOARDING RESOLVED] Defenders survived boarding action on Cruiser ${ship.id}.`);
          } else {
            // Attackers win!
            M_atk = rightSurvivors.length;
            ship.isUnderBoarding = false;
            ship.boardingMarines = 0;
            ship.boardingTimer = 0;

            // Change ownership
            const wasMonsterShip = ship.owner && (ship.owner.id === 'monsters' || ship.owner.isMonster);
            const attackerName = ship.boardingPlayer ? (ship.boardingPlayer.name || ship.boardingPlayer.id) : 'Attacker';
            const prevDefenderName = ship.owner ? (ship.owner.name || ship.owner.id) : 'Defender';
            const newOwnerId = ship.boardingPlayer
              ? (ship.boardingPlayer.id != null ? ship.boardingPlayer.id : ship.boardingPlayer)
              : null;
            const newOwner = newOwnerId != null
              ? this.allPlayers.find(p => p.id === newOwnerId)
              : null;
            if (newOwner) {
              ship.owner = newOwner;
            }
            if (wasMonsterShip) {
              ship.speed = (ship.speed || 0) + 10;
              ship.isRefueling = false;
            }

            // Retain a small crew (e.g. 2) to operate the captured cruiser
            const crewRetained = Math.min(M_atk, 2);
            ship.crew = crewRetained;
            ship.marineCount = 0;

            ship.boardingResultEvent = {
              success: true,
              text: 'BOARDING SUCCESS!',
              color: (ship.owner && ship.owner.color) ? ship.owner.color : '#ffd740',
              shipName: ship.name || ship.configName || `Cruiser ${ship.id}`,
              attackerName,
              defenderName: prevDefenderName
            };

            console.log(`[BOARDING SUCCESS] Cruiser ${ship.id} captured by player ${(ship.owner && ship.owner.name) || attackerName}. Crew assigned: ${crewRetained}/${ship.maxHealth}.`);

            // Return prorated remaining survivors directly to the attacking cruisers
            const M_return = M_atk - crewRetained;
            if (M_return > 0 && ship.boardingSourceContributions && ship.boardingSourceContributions.length > 0) {
              let totalDistributed = 0;
              const contributions = ship.boardingSourceContributions;
              const totalStart = ship.boardingStartMarines || 1;

              for (let i = 0; i < contributions.length; i++) {
                const contrib = contributions[i];
                const launcher = this.ships.find(s => s.id === contrib.shipId && s.active);
                if (launcher) {
                  let share = Math.floor(M_return * (contrib.contributed / totalStart));
                  share = Math.min(contrib.contributed, share);

                  launcher.marineCount = (launcher.marineCount || 0) + share;
                  totalDistributed += share;
                  contrib.returnedShare = share;
                }
              }

              // Distribute remainder from floor rounding to first active contributing launcher
              let remainder = M_return - totalDistributed;
              if (remainder > 0) {
                for (const contrib of contributions) {
                  const launcher = this.ships.find(s => s.id === contrib.shipId && s.active);
                  if (launcher) {
                    const canTake = Math.max(0, contrib.contributed - (launcher.marineCount || 0));
                    const added = Math.min(remainder, canTake);
                    launcher.marineCount += added;
                    remainder -= added;
                    if (remainder <= 0) break;
                  }
                }
              }
              console.log(`[BOARDING RETURN] Directly returned ${M_return} survivors back to source cruisers.`);
            }
          }
        }
      }
    }
    this.updateBattlecam();
  }

  /**
   * Standard invasion (Scout Attack On) must wait until the cruiser has been
   * stationary ~3s and has no bombs left — so it bombards the planet first.
   * stationaryTimer is ms (same as planet-bombard gating).
   */
  isCruiserReadyForStandardInvasion(ship) {
    if (!ship) return false;
    const stillLongEnough = (ship.stationaryTimer || 0) >= 3000;
    const bombsEmpty = !(ship.bombs > 0);
    return stillLongEnough && bombsEmpty;
  }

  /**
   * Whether a cruiser is currently allowed to dump marines at a planet.
   * assault: Scout Attack On + within planet.radius + 15
   * revolt:  Scout Attack not Peace + inside that planet's gravity well only
   */
  isCruiserInMarineLaunchRange(ship, planetId, launchMode = 'assault') {
    if (!ship || planetId == null) return false;
    const p = this.planets.find(pl => pl.id === planetId);
    if (!p || p.dead || p.isDeepSpaceAnomaly) return false;
    if (p.owner && ship.owner && p.owner.id === ship.owner.id) return false;

    const dx = p.x - ship.x;
    const dy = p.y - ship.y;
    const distSq = dx * dx + dy * dy;

    if (launchMode === 'revolt') {
      if (ship.scoutAttackEnabled === 'peace') return false;
      if (!p.inRevolt) return false;
      const gr = p.getGravityRadius();
      // Strict well membership (use <= and require finite positive radius)
      if (!(gr > 0) || !Number.isFinite(gr)) return false;
      return distSq <= gr * gr;
    }

    // Default / assault: must be Scout Attack On and nearly on top of the planet
    if (ship.scoutAttackEnabled !== true) return false;
    const maxDist = (p.radius || 0) + 15;
    return distSq <= maxDist * maxDist;
  }

  /**
   * Marines already en route or queued at a planet (same owner).
   * excludeShipId: skip that cruiser's pending queues ("from other cruisers").
   */
  countMarinesInboundToPlanet(planetId, ownerId, excludeShipId = null) {
    let total = 0;
    if (planetId == null) return 0;
    for (const s of this.ships) {
      if (!s.active) continue;
      if (ownerId != null && (!s.owner || s.owner.id !== ownerId)) continue;

      // Marine fleets already flying at the planet
      if (s.isMarineFleet) {
        const tid = s.targetPlanet
          ? s.targetPlanet.id
          : (s.targetPlanetId != null ? s.targetPlanetId : null);
        if (tid === planetId) {
          total += s.count || 0;
        }
      }

      // Pending batch launches still on other cruisers (not this one)
      if (s.pendingMarineLaunches && s.pendingMarineLaunches.length > 0) {
        if (excludeShipId != null && s.id === excludeShipId) continue;
        for (const launch of s.pendingMarineLaunches) {
          if (launch && launch.targetType === 'planet' && launch.targetId === planetId && !launch.isBoardingFleet) {
            total += launch.count || 0;
          }
        }
      }
    }
    return total;
  }

  executeQueuedLaunch(ship, launch, batchSize) {
    if (launch.isBoardingFleet) {
      const enemy = this.ships.find(s => s.id === launch.targetId && s.active);
      if (!enemy) return false;
      const pod = new Ship(this.nextShipId++, ship.x, ship.y, null, ship.owner, enemy.x, enemy.y);
      pod.cruiserStyle = ship.cruiserStyle;
      pod.isBoardingFleet = true;
      pod.targetShipId = enemy.id;
      pod.sourceShipId = ship.id;
      pod.marineCount = batchSize;
      pod.speed = 25;
      pod.isCruiser = false;
      this.ships.push(pod);
      console.log(`[BOARDING BATCH] Ship ${ship.id} launched pod targeting Ship ${enemy.id} carrying ${batchSize} marines.`);
      return true;
    } else {
      let targetPlanet = null;
      let targetShip = null;
      if (launch.targetType === 'planet') {
        targetPlanet = this.planets.find(p => p.id === launch.targetId);
        // Never land marines on deep-space anomalies
        if (targetPlanet && targetPlanet.isDeepSpaceAnomaly) {
          return false;
        }
        // Re-check range so multi-batch dumps cannot fire across the map after leaving the well
        const mode = launch.launchMode || 'assault';
        if (!this.isCruiserInMarineLaunchRange(ship, launch.targetId, mode)) {
          return false;
        }
        if (mode === 'assault' && !this.isCruiserReadyForStandardInvasion(ship)) {
          return false;
        }
      } else if (launch.targetType === 'ship') {
        targetShip = this.ships.find(s => s.id === launch.targetId && s.active);
      }
      
      if (!targetPlanet && !targetShip) return false;
      
      const targetX = targetPlanet ? null : targetShip.x;
      const targetY = targetPlanet ? null : targetShip.y;
      
      const marineFleet = new Ship(this.nextShipId++, ship.x, ship.y, targetPlanet, ship.owner, targetX, targetY);
      marineFleet.cruiserStyle = ship.cruiserStyle;
      marineFleet.count = batchSize;
      marineFleet.speedModifier = 1.0;
      marineFleet.isMarineFleet = true;
      marineFleet.sourceShipId = ship.id;
      marineFleet.speed = 35;
      if (targetShip) {
        marineFleet.targetShipId = targetShip.id;
      }
      
      let startingExp = (ship.expScore || 0) + 100;
      const tritaniumCost = 0.01 * (batchSize / 3);
      const owner = ship.owner;
      const canUseRes = !!(ship.useResources || (owner && owner.tradeLimitToggle === true));
      if (owner && owner.resources && (owner.resources.tritanium || 0) >= tritaniumCost && batchSize > 0 && canUseRes) {
        owner.resources.tritanium -= tritaniumCost;
        startingExp = (ship.expScore || 0) + 400;
      }
      marineFleet.expScore = startingExp;
      this.ships.push(marineFleet);
      
      console.log(`[MARINE BATCH] Cruiser ${ship.id} launched a fleet of ${batchSize} marines targeting ${targetPlanet ? 'planet ' + targetPlanet.name : 'ship ' + targetShip.id}.`);
      return true;
    }
  }

  queueMarineLaunch(ship, launchInfo) {
    const totalCount = launchInfo.count;
    if (totalCount <= 0) return;

    // Planet dumps must still be in valid range at queue time
    if (launchInfo.targetType === 'planet' && !launchInfo.isBoardingFleet) {
      const mode = launchInfo.launchMode || 'assault';
      if (!this.isCruiserInMarineLaunchRange(ship, launchInfo.targetId, mode)) {
        return;
      }
      if (mode === 'assault' && !this.isCruiserReadyForStandardInvasion(ship)) {
        return;
      }
    }
    
    // Launch first batch immediately
    const firstBatch = Math.min(totalCount, 20);
    const immediateLaunchInfo = { ...launchInfo, count: firstBatch };
    const firstOk = this.executeQueuedLaunch(ship, immediateLaunchInfo, firstBatch);
    if (!firstOk) {
      // Caller already deducted marines — refund full amount
      ship.marineCount = (ship.marineCount || 0) + totalCount;
      return;
    }
    
    // Queue the rest if any
    const remaining = totalCount - firstBatch;
    if (remaining > 0) {
      ship.pendingMarineLaunches = ship.pendingMarineLaunches || [];
      ship.pendingMarineLaunches.push({
        targetType: launchInfo.targetType,
        targetId: launchInfo.targetId,
        isBoardingFleet: launchInfo.isBoardingFleet,
        launchMode: launchInfo.launchMode || 'assault',
        count: remaining,
        timer: 2.0
      });
    }
  }

  draw() {
    if (!this.ctx) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw connections if a planet is selected
    if (this.selectedPlanet) {
      for (const p of this.planets) {
        if (p !== this.selectedPlanet) {
          this.ctx.beginPath();
          this.ctx.moveTo(this.selectedPlanet.x, this.selectedPlanet.y);
          this.ctx.lineTo(p.x, p.y);
          this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }
    
    for (const planet of this.planets) {
      const mapScale = this.width > 1600 ? this.width / 1600 : 1.0;
      const gravityRadius = planet.getGravityRadius(mapScale);
      
      this.ctx.beginPath();
      this.ctx.arc(planet.x, planet.y, gravityRadius, 0, Math.PI * 2);
      if (planet.owner) {
        this.ctx.strokeStyle = planet.owner.color;
        this.ctx.globalAlpha = 0.15;
      } else {
        this.ctx.strokeStyle = 'rgba(211, 211, 211, 0.25)';
        this.ctx.globalAlpha = 0.15;
      }
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([5, 10]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = 1.0;
      
      planet.draw(this.ctx, planet === this.selectedPlanet);
    }
    
    for (const laser of this.lasers) {
      const progress = laser.age / laser.duration;
      if (laser.color === 'amoeba') {
        const curX = laser.startX + (laser.endX - laser.startX) * progress;
        const curY = laser.startY + (laser.endY - laser.startY) * progress;
        this.ctx.beginPath();
        this.ctx.arc(curX, curY, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = "rgba(0, 100, 0, 1)";
        this.ctx.strokeStyle = "#ff0";
        this.ctx.lineWidth = 1.5;
        this.ctx.fill();
        this.ctx.stroke();
      } else if (laser.color === 'cruiser-projectile') {
        const curX = laser.startX + (laser.endX - laser.startX) * progress;
        const curY = laser.startY + (laser.endY - laser.startY) * progress;
        this.ctx.beginPath();
        this.ctx.arc(curX, curY, 1, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ff5500";
        this.ctx.strokeStyle = "#ffff00";
        this.ctx.lineWidth = 0.4;
        this.ctx.fill();
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(laser.startX, laser.startY);
        this.ctx.lineTo(laser.endX, laser.endY);
        this.ctx.strokeStyle = laser.color;
        this.ctx.globalAlpha = 1 - progress;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
      }
    }
    
    for (const ship of this.ships) {
      ship.draw(this.ctx);
    }
    
    if (this.isPaused) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '40px Orbitron';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
    }
  }
  
  checkWinCondition() {
    const activeOwners = new Set();
    
    for (const p of this.planets) {
      if (p.owner) activeOwners.add(p.owner.id);
    }
    for (const s of this.ships) {
      if (s.owner) activeOwners.add(s.owner.id);
    }
    
    if (activeOwners.size <= 1 && (!this.pendingAIs || this.pendingAIs.length === 0)) {
      this.stop();
      let winnerName = 'NO ONE';
      if (activeOwners.size === 1) {
        const winnerId = [...activeOwners][0];
        const winner = this.allPlayers.find(p => p.id === winnerId);
        if (winner) winnerName = winner.name || winner.id;
      }
      this.gameOverMessage = `${winnerName.toUpperCase()} IS VICTORIOUS!\n(ELIMINATION)`;
      if (this.onGameOver) this.onGameOver(this.gameOverMessage);
      return;
    }

    const alivePlayers = this.allPlayers.filter(p => p.isAlive);
    if (alivePlayers.length === 0) return;

    // Helper functions for bonuses
    const getTechBonus = p => Math.sqrt(p.techScore || 0);
    const getExpBonus = p => Math.sqrt(p.expScore || 0);
    const getHappinessBonus = p => Math.sqrt(p.happinessScore !== undefined ? p.happinessScore : 0);
    const getVP = p => getTechBonus(p) + getExpBonus(p) + getHappinessBonus(p);

    // Calculate dynamic required lead for Tech, Experience, and Happiness victories
    const isUnlimited = !this.settings || !this.settings.timedGameLimit || this.settings.timedGameLimit === 'unlimited';
    const limitSecs = this.settings ? parseFloat(this.settings.timedGameLimit) : NaN;
    const requiredLead = (isUnlimited || isNaN(limitSecs)) ? 15 : (11 + (limitSecs / 60) / 30);

    // 1. Tech Victory: leads by requiredLead Tech Bonus points
    const sortedByTech = [...alivePlayers].sort((a, b) => getTechBonus(b) - getTechBonus(a));
    if (sortedByTech.length >= 2) {
      const topPlayer = sortedByTech[0];
      const lead = getTechBonus(topPlayer) - getTechBonus(sortedByTech[1]);
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && lead >= requiredLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(TECH VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    } else if (sortedByTech.length === 1) {
      const topPlayer = sortedByTech[0];
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && getTechBonus(topPlayer) >= requiredLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(TECH VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    }

    // 2. Experience Victory: leads by requiredLead Experience Bonus points
    const sortedByExp = [...alivePlayers].sort((a, b) => getExpBonus(b) - getExpBonus(a));
    if (sortedByExp.length >= 2) {
      const topPlayer = sortedByExp[0];
      const lead = getExpBonus(topPlayer) - getExpBonus(sortedByExp[1]);
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && lead >= requiredLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(EXPERIENCE VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    } else if (sortedByExp.length === 1) {
      const topPlayer = sortedByExp[0];
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && getExpBonus(topPlayer) >= requiredLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(EXPERIENCE VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    }

    // 3. Happiness Victory: leads by requiredLead Happiness Bonus points
    const sortedByHappiness = [...alivePlayers].sort((a, b) => getHappinessBonus(b) - getHappinessBonus(a));
    if (sortedByHappiness.length >= 2) {
      const topPlayer = sortedByHappiness[0];
      const lead = getHappinessBonus(topPlayer) - getHappinessBonus(sortedByHappiness[1]);
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && lead >= requiredLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(HAPPINESS VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    } else if (sortedByHappiness.length === 1) {
      const topPlayer = sortedByHappiness[0];
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && getHappinessBonus(topPlayer) >= requiredLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(HAPPINESS VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    }

    // 4. Score Victory: leads by 1.5 * requiredLead (rounded up) Victory Points
    const requiredScoreLead = Math.ceil(requiredLead * 1.5);
    const sortedByVP = [...alivePlayers].sort((a, b) => getVP(b) - getVP(a));
    if (sortedByVP.length >= 2) {
      const topPlayer = sortedByVP[0];
      const lead = getVP(topPlayer) - getVP(sortedByVP[1]);
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && lead >= requiredScoreLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(SCORE VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    } else if (sortedByVP.length === 1) {
      const topPlayer = sortedByVP[0];
      const isHuman = !topPlayer.isAI && topPlayer.id !== 'monsters';
      if (topPlayer.id !== 'monsters' && topPlayer.id !== 'monster' && getVP(topPlayer) >= requiredScoreLead && (!isHuman || (topPlayer.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(SCORE VICTORY)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    }

    // 5. Economic Domination: 75% of total galactic capacity
    let galacticCapacity = 0;
    for (const p of this.planets) {
      galacticCapacity += p.maxShips;
    }
    for (const player of this.allPlayers) {
      const isHuman = !player.isAI && player.id !== 'monsters';
      if (player.id !== 'monsters' && player.id !== 'monster' && player.isAlive && (player.totalCapacity || 0) > galacticCapacity * 0.75 && (!isHuman || (player.credits || 0) >= 0)) {
        this.stop();
        this.gameOverMessage = `${(player.name || player.id).toUpperCase()} IS VICTORIOUS!\n(ECONOMIC DOMINATION)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
      }
    }

    // 6. Financial Victory: player's credits exceeds target amount
    if (this.settings && this.settings.financialVictoryTarget && this.settings.financialVictoryTarget !== 'none') {
      const target = parseFloat(this.settings.financialVictoryTarget);
      if (!isNaN(target)) {
        for (const player of this.allPlayers) {
          const isHuman = !player.isAI && player.id !== 'monsters';
          if (player.id !== 'monsters' && player.id !== 'monster' && player.isAlive && (player.credits || 0) >= target && (!isHuman || (player.credits || 0) >= 0)) {
            this.stop();
            this.gameOverMessage = `${(player.name || player.id).toUpperCase()} IS VICTORIOUS!\n(FINANCIAL VICTORY)`;
            if (this.onGameOver) this.onGameOver(this.gameOverMessage);
            return;
          }
        }
      }
    }
  }

  triggerTimedGameVictory() {
    this.stop();

    // Find all alive players
    const players = this.allPlayers.filter(p => p.isAlive);
    if (players.length === 0) {
      this.gameOverMessage = "TIMED GAME ENDED IN A DRAW!\n(DRAW)";
      if (this.onGameOver) this.onGameOver(this.gameOverMessage);
      return;
    }

    // Sort players by total score descending
    const scoredPlayers = players.map(player => {
      const techBonus = Math.sqrt(player.techScore || 0);
      const expBonus = Math.sqrt(player.expScore || 0);
      const happinessBonus = Math.sqrt(player.happinessScore !== undefined ? player.happinessScore : 0);
      const totalScore = techBonus + expBonus + happinessBonus;
      return { player, totalScore };
    });

    scoredPlayers.sort((a, b) => b.totalScore - a.totalScore);

    let bestPlayer = null;
    if (scoredPlayers.length > 0) {
      const lead = scoredPlayers[0].player;
      const isLeadHuman = !lead.isAI && lead.id !== 'monsters';
      if (isLeadHuman && (lead.credits || 0) < 0) {
        // Find the next highest player who is not in debt
        const eligible = scoredPlayers.find(sp => {
          const isHuman = !sp.player.isAI && sp.player.id !== 'monsters';
          return !isHuman || (sp.player.credits || 0) >= 0;
        });
        if (eligible) {
          bestPlayer = eligible.player;
        } else {
          bestPlayer = null;
        }
      } else {
        bestPlayer = lead;
      }
    }

    if (bestPlayer) {
      const winnerName = bestPlayer.name || bestPlayer.id;
      this.gameOverMessage = `${winnerName.toUpperCase()} IS VICTORIOUS!\n(TIMED GAME VICTORY)`;
    } else {
      this.gameOverMessage = "TIMED GAME ENDED IN A DRAW!\n(DRAW)";
    }
    if (this.onGameOver) this.onGameOver(this.gameOverMessage);
  }
}
