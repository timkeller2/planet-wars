import { Player } from './entities/Player.js';
import { Planet } from './entities/Planet.js';
import { Ship } from './entities/Ship.js';
import { InputHandler } from './systems/InputHandler.js';
import { AIController } from './systems/AIController.js';

export function getEffectiveSympathy(planet, playerId, allShips, player = null, game = null) {
  let sympathyVal = planet.sympathy ? (planet.sympathy[playerId] || 0) : 0;
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
          // Check if any of the player's ships currently has the planet in its radar range
          for (const ship of allShips) {
            if (ship.active && ship.owner && ship.owner.id === playerId) {
              const dx = ship.x - planet.x;
              const dy = ship.y - planet.y;
              const distSq = dx * dx + dy * dy;
              
              let radarRange = 50; // default standard ship radar range
              if (ship.isCruiser || ship.maxHealth > 0) {
                radarRange = ship.cruiserRadarRange ? ship.cruiserRadarRange() : Math.min(250, 5 * (ship.maxHealth || 0));
              }
              const extendedRadar = radarRange * 1.5; // server uses extended radar range for visibility (1.5x)
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
      const maxDist = gr;
      const maxDistSq = maxDist * maxDist;
      for (const ship of allShips) {
        if (ship.active && ship.owner && ship.owner.id === playerId) {
          const dx = ship.x - planet.x;
          const dy = ship.y - planet.y;
          if (dx * dx + dy * dy <= maxDistSq) {
            const shipHp = (ship.isCruiser || ship.maxHealth > 0) ? (ship.maxHealth * 0.5) : ((ship.count || 1) * 0.5);
            sympathyVal += shipHp;
          }
        }
      }
    }
  }
  return sympathyVal;
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
      const key = `${col},${row}`;
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
        const key = `${col},${row}`;
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

export class Game {
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
    this.monsterPlayer.name = 'Monsters';
    
    const allColors = [
      '#f0f', '#ff0', '#f00', '#0f0', '#00f', '#f80', '#80f', // Original 7
      '#08f', '#0f8', '#8f0', '#f08', '#f88', '#8f8', '#88f', '#fff',
      '#a40', '#0a4', '#40a', '#a04', '#4a0', '#04a', '#a44', '#4a4', '#aaa'
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
    for (let i = 0; i < 23; i++) {
      this.aiPlayers.push(new Player(shuffledNames[i] || `ai${i+1}`, allColors[i], true));
    }
    
    this.allPlayers = [this.humanPlayer, this.monsterPlayer, ...this.aiPlayers];
    
    this.planets = [];
    this.ships = new SpatialGridArray();
    this.lasers = new RecycledArray(1500);
    this.explosions = new RecycledArray(1000);
    
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
    const getRandMod = () => Math.round((-0.10 - Math.random() * 0.20) * 100) / 100;
    this.globalUpgradeModifiers = {
      sensorarray: getRandMod(),
      lab: getRandMod(),
      armor: getRandMod(),
      shield: getRandMod(),
      engine: getRandMod(),
      munitions: getRandMod(),
      targeting: getRandMod(),
      damagecontrol: getRandMod(),
      fueltanker: getRandMod(),
      diplomat: getRandMod(),
      marines: getRandMod()
    };
    this.upgradeEnhanceEvents = [];
    this.accuracyEvents = [];
    this.pendingChatMessages = [];
    this.sellOrders = [];
    this.fulfillOrders = [];
    this.neutralTradeTimer = 0;
    this.nextNeutralTradeTime = 120000 + Math.random() * 60000;
    this.aiMarketTimer = 0;
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

  getUpgradeCost(ship, type) {
    const totalUpgrades = (ship.sensorarrays || 0) +
                          (ship.labs || 0) +
                          (ship.armor || 0) +
                          (ship.shields || 0) +
                          (ship.engine || 0) +
                          (ship.munitions || 0) +
                          (ship.targeting || 0) +
                          (ship.damagecontrol || 0) +
                          (ship.fuel_tanker || 0) +
                          (ship.diplomat || 0) +
                          (ship.marines || 0) +
                          (ship.command || 0);
    const baseCost = Math.min(150, Math.round(25 + ship.maxHealth * (3 + totalUpgrades / 3)));
    
    const typeKeyMap = {
      sensorarrays: 'sensorarray',
      labs: 'lab',
      armor: 'armor',
      shields: 'shield',
      engine: 'engine',
      munitions: 'munitions',
      targeting: 'targeting',
      damagecontrol: 'damagecontrol',
      fuel_tanker: 'fueltanker',
      diplomat: 'diplomat',
      marines: 'marines',
      command: 'command',
      
      sensorarray: 'sensorarray',
      lab: 'lab',
      shield: 'shield',
      fueltanker: 'fueltanker'
    };
    const normType = typeKeyMap[type] || type;
    
    const globalMod = (this.globalUpgradeModifiers && this.globalUpgradeModifiers[normType] !== undefined)
      ? Math.max(-0.35, this.globalUpgradeModifiers[normType])
      : -0.25;
      
    let playerMod = 0.0;
    if (ship.owner && ship.owner.upgradeModifiers && ship.owner.upgradeModifiers[normType] !== undefined) {
      playerMod = ship.owner.upgradeModifiers[normType];
    }
    
    const modifier = Math.max(-0.50, globalMod + playerMod);
    return Math.max(1, Math.round(baseCost * (1 + modifier)));
  }

  getCruiserTotalUpgradeCost(ship) {
    const upgradeProps = [
      'sensorarrays', 'labs', 'armor', 'shields', 'engine', 
      'munitions', 'targeting', 'damagecontrol', 'fuel_tanker', 
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
        fuel_tanker: 'fueltanker',
        diplomat: 'diplomat',
        marines: 'marines'
      };
      const normType = typeKeyMap[foundProp] || foundProp;
      const globalMod = (this.globalUpgradeModifiers && this.globalUpgradeModifiers[normType] !== undefined)
        ? Math.max(-0.35, this.globalUpgradeModifiers[normType])
        : -0.25;
      let playerMod = 0;
      if (ship.owner && ship.owner.upgradeModifiers && ship.owner.upgradeModifiers[normType] !== undefined) {
        playerMod = ship.owner.upgradeModifiers[normType];
      }
      const modifier = Math.max(-0.50, globalMod + playerMod);
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

    // If fog of war is NOT enabled, everything is visible
    if (!this.settings || !this.settings.fogOfWar) {
      return true;
    }

    // A player can always see their own planets
    if (p.owner && p.owner.id === player.id) {
      return true;
    }

    // 1. Gravity well check
    for (const pl of this.planets) {
      if (pl.owner && pl.owner.id === player.id) {
        const gr = pl.getGravityRadius();
        const dx = pl.x - p.x;
        const dy = pl.y - p.y;
        if (dx * dx + dy * dy <= gr * gr) return true;
      }
    }

    // 2. Sympathy check
    if (getEffectiveSympathy(p, player.id, this.ships, player, this) > 0) return true;

    // 3. Ship sensor check
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
      if (pl.owner && pl.owner.id === player.id) {
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
    const hwSizeSetting = (this.settings && this.settings.homeworldSize) ? this.settings.homeworldSize : "120";
    const isNatural = hwSizeSetting === 'natural';

    let targetPlanet = null;

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
          if (existingHomeworlds.length === 0) {
            // First homeworld: pick a random valid candidate
            bestPos = candidates[Math.floor(Math.random() * candidates.length)];
          } else {
            // Pick candidate that maximizes minimum distance to other homeworlds
            for (const c of candidates) {
              const minDist = Math.min(...existingHomeworlds.map(h => {
                const dx = h.x - c.x;
                const dy = h.y - c.y;
                return Math.sqrt(dx * dx + dy * dy);
              }));
              if (minDist > maxMinDist) {
                maxMinDist = minDist;
                bestPos = c;
              }
            }
          }
          break; // Found a position, stop trying smaller spacings
        }
      }
      
      if (bestPos) {
        const newPlanetId = Math.max(...this.planets.map(p => p.id), 0) + 1;
        const initialShips = (!isNaN(parsedVal) && parsedVal > 0) ? parsedVal : 120;
        targetPlanet = new Planet(newPlanetId, bestPos.x, bestPos.y, newRadius, null, initialShips, this.width, this.height);
        this.planets.push(targetPlanet);
        console.log(`[New Homeworld Created] Created new Planet ${targetPlanet.name} (${targetPlanet.id}) at (${Math.round(bestPos.x)}, ${Math.round(bestPos.y)}) for player ${player.id}. Min dist to other homeworlds: ${maxMinDist.toFixed(1)}`);
      }
    }

    if (!targetPlanet) {
      const neutralPlanets = this.planets.filter(p => p.owner === null && !p.isSuperPlanet);
      if (neutralPlanets.length === 0) return false;

      let availableCandidates = neutralPlanets;
      if (player.isAI && player !== this.monsterPlayer) {
        const preferred = neutralPlanets.filter(p => {
          // Skip if in human gravity well
          if (this.isPlanetInHumanGravityWell(p)) return false;
          // Skip if FOW is enabled and visible to human (66% chance)
          if (this.settings && this.settings.fogOfWar) {
            if (this.isPlanetVisibleToHuman(p) && Math.random() < 0.66) {
              return false;
            }
          }
          return true;
        });
        if (preferred.length > 0) {
          availableCandidates = preferred;
        }
      }

      if (player === this.monsterPlayer) {
        // Monster gets the smallest planet
        availableCandidates.sort((a, b) => a.maxShips - b.maxShips);
        targetPlanet = availableCandidates[0];
      } else {
        const humanPlanets = this.planets.filter(p => p.owner && !p.owner.isAI);
        
        if (!player.isAI && humanPlanets.length > 0) {
          // Human player: prioritize candidates with maxShips > 115, sorted by distance to nearest human planet descending
          const candidatePlanets = availableCandidates.filter(p => p.maxShips > 115);
          if (candidatePlanets.length > 0) {
            candidatePlanets.sort((a, b) => {
              const distA = humanPlanets.reduce((min, hp) => Math.min(min, (a.x - hp.x)**2 + (a.y - hp.y)**2), Infinity);
              const distB = humanPlanets.reduce((min, hp) => Math.min(min, (b.x - hp.x)**2 + (b.y - hp.y)**2), Infinity);
              return distB - distA; // Descending order (furthest first)
            });
            targetPlanet = candidatePlanets[0];
          }
        }
        
        if (!targetPlanet) {
          const candidatePlanets = availableCandidates.filter(p => p.maxShips > 115 && humanPlanets.every(hp => {
            const dx = p.x - hp.x;
            const dy = p.y - hp.y;
            return dx*dx + dy*dy >= 40000; // 200^2
          }));

          if (candidatePlanets.length > 0) {
            candidatePlanets.sort((a, b) => a.maxShips - b.maxShips); // smallest > 115
            targetPlanet = candidatePlanets[0];
          } else {
            // Fallback 1: smallest > 115 regardless of distance
            const anyLarge = availableCandidates.filter(p => p.maxShips > 115);
            if (anyLarge.length > 0) {
              anyLarge.sort((a, b) => a.maxShips - b.maxShips);
              targetPlanet = anyLarge[0];
            } else {
              // Fallback 2: highest maxShips overall
              availableCandidates.sort((a, b) => b.maxShips - a.maxShips);
              targetPlanet = availableCandidates[0];
            }
          }
        }
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
      targetPlanet.maxShips = Math.max(60, targetPlanet.sizeClass - 20);
      targetPlanet.ships = targetPlanet.maxShips;
      targetPlanet.radius = Math.min(targetPlanet.sizeClass, targetPlanet.maxShips) / 4;
      targetPlanet.habitability = 100;
      targetPlanet.justAssigned = true;
      targetPlanet.justAssignedTimer = 0;
      targetPlanet.homeworldOf = player.id;
      targetPlanet.focusMode = 'economy';
      
      // Ensure homeworld has a preferred resource
      const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      if (!targetPlanet.preferredResource) {
        targetPlanet.preferredResource = resourcesList[Math.floor(Math.random() * resourcesList.length)];
      }

      // All homeworlds must begin with a resource (the accuracy resource for the player's race/style)
      const style = player.cruiserStyle || targetPlanet.racialAffinity;
      let accuracyResource = 'merculite';
      if (style === 'Romulan' || style === 'Gorn') {
        accuracyResource = 'antimatter';
      } else if (style === 'Tholian' || style === 'Lyran') {
        accuracyResource = 'dilithium';
      }
      targetPlanet.resources = [accuracyResource];

      // Ensure preferred resource is not the same as the mined accuracy resource
      if (targetPlanet.preferredResource === accuracyResource) {
        const otherPreferredList = resourcesList.filter(r => r !== accuracyResource);
        targetPlanet.preferredResource = otherPreferredList[Math.floor(Math.random() * otherPreferredList.length)];
      }

      // Player stockpiles start at 0
      // (resources object is already initialized to all zeros in Player constructor)
      
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
      this.recalculateResourceRarities();
      return true;
    }
    return false;
  }

  recalculateResourceRarities() {
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
            counts[res]++;
            totalDeposits++;
          }
        }
      }
    }
    
    const average = totalDeposits / 7;
    this.resourceRarities = {};
    for (const r of resourcesList) {
      if (average === 0) {
        this.resourceRarities[r] = 'normal';
        continue;
      }
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
      resourceRarities: this.resourceRarities,
      sellOrders: this.sellOrders,
      fulfillOrders: this.fulfillOrders,
      exploredGrid: this.exploredGrid,
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
        tradeRegenAccumulator: p.tradeRegenAccumulator
      })),
      planets: this.planets.map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        radius: p.radius,
        sizeClass: p.sizeClass,
        maxShips: p.maxShips,
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
        revoltShipsDestroyedSoFar: p.revoltShipsDestroyedSoFar
      })),
      ships: this.ships.map(s => {
        const sData = {};
        for (const [k, v] of Object.entries(s)) {
          if (k === 'targetPlanet') {
            sData.targetPlanetId = v ? v.id : null;
          } else if (k === 'owner') {
            sData.ownerId = v ? v.id : null;
          } else if (typeof v !== 'function') {
            sData[k] = v;
          }
        }
        return sData;
      })
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
    this.resourceRarities = state.resourceRarities;
    this.sellOrders = state.sellOrders;
    this.fulfillOrders = state.fulfillOrders;
    this.exploredGrid = state.exploredGrid;

    // Restore players
    const playersMap = new Map();
    this.allPlayers = state.players.map(pData => {
      const p = new Player(pData.id, pData.color, pData.isAI);
      p.name = pData.name;
      p.techScore = pData.techScore;
      p.expScore = pData.expScore;
      p.expProgress = pData.expProgress;
      p.credits = pData.credits;
      p.tradingBonus = pData.tradingBonus;
      p.useCredits = pData.useCredits;
      p.atWarWith = pData.atWarWith || {};
      p.builtClasses = pData.builtClasses || {};
      p.buildCounts = pData.buildCounts || p.buildCounts;
      p.autoBuyOrders = pData.autoBuyOrders || p.autoBuyOrders;
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
      
      p.sizeClass = pData.sizeClass;
      p.maxShips = pData.maxShips;
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

      planetsMap.set(p.id, p);
      return p;
    });

    this.incubatingPlanet = state.incubatingPlanetId ? planetsMap.get(state.incubatingPlanetId) : null;

    // Restore ships
    this.ships = new SpatialGridArray();
    if (state.ships) {
      for (const sData of state.ships) {
        const owner = sData.ownerId ? playersMap.get(sData.ownerId) : null;
        const targetPlanet = sData.targetPlanetId ? planetsMap.get(sData.targetPlanetId) : null;
        const s = new Ship(sData.id, sData.x, sData.y, targetPlanet, owner, sData.targetX, sData.targetY);

        for (const [k, v] of Object.entries(sData)) {
          if (k !== 'targetPlanetId' && k !== 'ownerId') {
            s[k] = v;
          }
        }
        s.owner = owner;
        s.targetPlanet = targetPlanet;
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
  }

  initMap() {
    this.planets = [];
    this.ships = new SpatialGridArray();
    this.explosions.clear();
    this.lasers.clear();
    this.ionStorms = [];
    this.sellOrders = [];
    this.fulfillOrders = [];
    this.exploredGrid = {};
    this.ionStormSpawnTimer = 0;
    this.ionStormDamageTimer = 0;
    this.minefieldDamageTimer = 0;
    this.ionStormsCreated = 0;
    this.nextShipId = 1;
    this.gameTime = 0;
    this.timeRemaining = null;
    let rampageDelayMultiple = 1.0;
    if (this.width < 1600) {
      rampageDelayMultiple = 1600 / this.width;
    }
    this.rampageInterval = Math.round(1800000 * rampageDelayMultiple);
    this.nextRampageTime = this.rampageInterval;
    this.nextRampageSelectionTime = Math.max(0, this.nextRampageTime - 180000);
    this.incubatingPlanet = null;
    this.rampageIncubationTimeRemaining = 0;
    this.scheduledAttacks = [];
    
    // Reset player states
    for (const player of this.allPlayers) {
      player.techScore = 0;
      player.expScore = 0;
      player.expProgress = 0;
      player.cruiserStyle = null;
      player.prevTechBonus = 0;
      player.credits = this.settings && this.settings.startingCredits !== undefined ? this.settings.startingCredits : 250;
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
      player.upgradeModifiers = {
        sensorarray: 0,
        lab: 0,
        armor: 0,
        shield: 0,
        engine: 0,
        munitions: 0,
        targeting: 0,
        damagecontrol: 0,
        fueltanker: 0,
        diplomat: 0,
        marines: 0
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
    const getRandMod = () => Math.round((-0.10 - Math.random() * 0.20) * 100) / 100;
    this.globalUpgradeModifiers = {
      sensorarray: getRandMod(),
      lab: getRandMod(),
      armor: getRandMod(),
      shield: getRandMod(),
      engine: getRandMod(),
      munitions: getRandMod(),
      targeting: getRandMod(),
      damagecontrol: getRandMod(),
      fueltanker: getRandMod(),
      diplomat: getRandMod(),
      marines: getRandMod()
    };
    
    const width = this.width;
    const height = this.height;
    
    // Create random planets
    const numPlanets = this.settings && this.settings.planetCount ? this.settings.planetCount : 50;
    
    let countMegaSuper = width >= 3000 ? 1 : 0;
    let countSuper = width >= 3000 ? 3 : 1;
    let countLarge = Math.round(numPlanets * 0.05);
    let countMedium = Math.round(numPlanets * 0.15);
    let countSmall = Math.round(numPlanets * 0.6667);
    let countTiny = numPlanets - (countMegaSuper + countSuper + countLarge + countMedium + countSmall);
    
    // Ensure at least some planets exist if math goes wonky with very small numbers
    if (countTiny < 0) { countSmall += countTiny; countTiny = 0; }
    if (countSmall < 0) { countMedium += countSmall; countSmall = 0; }

    const isClustersOff = !this.settings || !this.settings.clusters || this.settings.clusters === 0;

    if (isClustersOff) {
      // Pre-generate specifications for all planets to ensure sizes match the counts
      const planetSpecs = [];
      for (let i = 0; i < numPlanets; i++) {
        let generatedMaxShips;
        if (i < countMegaSuper) {
          generatedMaxShips = 300;
        } else if (i < countMegaSuper + countSuper) {
          if (width < 1600) {
            generatedMaxShips = 200 + Math.floor(Math.random() * 21);
          } else {
            generatedMaxShips = 250;
          }
        } else if (i < countMegaSuper + countSuper + countLarge) {
          generatedMaxShips = 150 + Math.floor(Math.random() * 31);
        } else if (i < countMegaSuper + countSuper + countLarge + countMedium) {
          generatedMaxShips = 120 + Math.floor(Math.random() * 31);
        } else if (i < countMegaSuper + countSuper + countLarge + countMedium + countSmall) {
          generatedMaxShips = 75 + Math.floor(Math.random() * 41);
        } else {
          generatedMaxShips = 53 + Math.floor(Math.random() * 22);
        }
        const radius = generatedMaxShips / 4;
        const isSuperPlanet = (i < countMegaSuper + countSuper);
        planetSpecs.push({ id: i, radius, maxShips: generatedMaxShips, isSuperPlanet });
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
          newPlanet.radius = Math.min(newPlanet.sizeClass, newPlanet.maxShips) / 4;
        }
        return newPlanet;
      };

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
          this.planets.push(newPlanet);
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
                this.planets.push(nearbyPlanet);
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
      // Original planet placement logic when clusters setting is ON
      for (let i = 0; i < numPlanets; i++) {
        let x, y, radius;
        let valid = false;
        let attempts = 0;
        
        while (!valid && attempts < 100) {
          let generatedMaxShips;
          if (i < countMegaSuper) {
            generatedMaxShips = 300;
          } else if (i < countMegaSuper + countSuper) {
            if (width < 1600) {
              generatedMaxShips = 200 + Math.floor(Math.random() * 21);
            } else {
              generatedMaxShips = 250;
            }
          } else if (i < countMegaSuper + countSuper + countLarge) {
            generatedMaxShips = 150 + Math.floor(Math.random() * 31);
          } else if (i < countMegaSuper + countSuper + countLarge + countMedium) {
            generatedMaxShips = 120 + Math.floor(Math.random() * 31);
          } else if (i < countMegaSuper + countSuper + countLarge + countMedium + countSmall) {
            generatedMaxShips = 75 + Math.floor(Math.random() * 41);
          } else {
            generatedMaxShips = 53 + Math.floor(Math.random() * 22);
          }
          radius = generatedMaxShips / 4;
          x = radius + Math.random() * (width - radius * 2);
          y = radius + Math.random() * (height - radius * 2);
          
          valid = true;

          if (valid) {
            const minDistPadding = (this.settings && this.settings.graphicalMode) ? 40 : 25;
            for (const p of this.planets) {
              const dx = p.x - x;
              const dy = p.y - y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < p.radius + radius + minDistPadding) {
                valid = false;
                break;
              }
            }
          }
          attempts++;
        }
        
        if (valid) {
          const maxShips = radius * 4;
          const expectedPercentage = maxShips / 100;
          let expectedShips = maxShips * expectedPercentage;
          let variance = maxShips * 0.4;
          
          if (maxShips > 150) {
            expectedShips *= 2;
            variance = expectedShips * 0.15;
          }

          let initialShips = Math.floor(expectedShips + (Math.random() * 2 - 1) * variance);
          initialShips = Math.max(1, initialShips);
           const newPlanet = new Planet(i, x, y, radius, null, initialShips, this.width, this.height);
          if (i < countMegaSuper + countSuper) {
            newPlanet.isSuperPlanet = true;
            newPlanet.sizeClass = 200;
            newPlanet.habitability = 150;
            newPlanet.maxShips = radius * 4;
            newPlanet.radius = Math.min(newPlanet.sizeClass, newPlanet.maxShips) / 4;
          }
          this.planets.push(newPlanet);
        }
      }
    }
    
    // Clear discovered/attacked planets for all players
    for (const player of this.allPlayers) {
      player.discoveredPlanets = new Set();
      player.attackedPlanets = new Map();
      player.spyRootedEvents = new Set();
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
      const monsterHomeworld = this.planets.find(p => p.owner === this.monsterPlayer);
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

    this.recalculateResourceRarities();
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
          ship.crew = 2 * maxHealth;
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
    const payWithTritanium = source.owner && source.owner.resources && (source.owner.resources.tritanium || 0) >= tritaniumCost && shipsToSend > 0;

    let finalShipsToSend = shipsToSend;
    let finalLaunchCost = 0;
    let isTritaniumPaid = false;

    if (payWithTritanium) {
      isTritaniumPaid = true;
      source.owner.resources.tritanium -= tritaniumCost;
    } else {
      // Standard ship payment or credits fallback
      const useCredits = source.owner && source.owner.useCredits !== false;
      const playerCredits = source.owner ? (source.owner.credits || 0) : 0;
      let creditsPaid = 0;
      let shipLaunchCost = launchCost;

      if (useCredits && playerCredits > 0) {
        creditsPaid = Math.min(playerCredits, launchCost);
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
    
    if (source.rampageEvent) {
      source.decreaseMaxShips(1);
      if (source.maxShips < 55) source.dead = true;
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
    if (source.isSpeedPlanet) ship.speed += 15;
    ship.speedModifier = speedModifier !== null ? speedModifier : 1.0;
    ship.sourcePlanet = source;
    let startingExp = source.expScore || 0;
    if (source.focusMode === 'garrison') {
      startingExp += (source.maxShips || 0) / 10;
    }
    if (isTritaniumPaid) {
      startingExp += 100;
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
    this.ships.push(ship);
  }



  applyWarpToShip(ship, player) {
    if (ship.maxHealth > 0) {
      if ((ship.fuel || 0) <= 0) {
        return false;
      }
      ship.fuel -= 1;
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
    ship.warpBonus = Math.max(20, 30 - planetCount);
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
          ship.crew = 2 * cruiserMaxHealth;
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
    const payWithTritanium = source.owner && source.owner.resources && (source.owner.resources.tritanium || 0) >= tritaniumCost && shipsToSend > 0;

    let finalShipsToSend = shipsToSend;
    let finalLaunchCost = 0;
    let isTritaniumPaid = false;

    if (payWithTritanium) {
      isTritaniumPaid = true;
      source.owner.resources.tritanium -= tritaniumCost;
    } else {
      // Standard ship payment or credits fallback
      const useCredits = source.owner && source.owner.useCredits !== false;
      const playerCredits = source.owner ? (source.owner.credits || 0) : 0;
      let creditsPaid = 0;
      let shipLaunchCost = launchCost;

      if (useCredits && playerCredits > 0) {
        creditsPaid = Math.min(playerCredits, launchCost);
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
    
    if (source.rampageEvent) {
      source.decreaseMaxShips(1);
      if (source.maxShips < 55) source.dead = true;
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
      startingExp += 100;
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
    this.ships.push(ship);
  }

  buildCapitalShip(source, classType) {
    if (!source || !classType) return;
    const cfg = SHIP_CLASSES[classType];
    if (!cfg) return;

    if (source.owner && !source.isSpeedPlanet) {
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
      if (!(source.isMilitary || source.homeworldOf)) {
        costShips *= 2;
      }
      const costCap = cfg.costCap;
      const maxHealth = cfg.hp;

      const creditsAvailable = (owner && owner.useCredits !== false) ? (owner.credits || 0) : 0;
      const creditsAvailableForAffordability = (isFirst || !(source.isMilitary || source.homeworldOf)) ? creditsAvailable : 0;

      if ((source.ships + creditsAvailableForAffordability) >= costShips && (source.maxShips - costCap) >= 55) {
        const creditsPaid = Math.min(creditsAvailable, costShips);
        const remainingCostShips = costShips - creditsPaid;
        const extraShips = source.ships - remainingCostShips;
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
        ship.crew = 2 * finalMaxHealth;
        
        const basePower = Math.floor(finalMaxHealth / 5);
        ship.fuel = basePower * 5;
        ship.speed = Math.max(5, ship.speed - 5 - basePower);
        if (ship.owner && ship.owner.id === 'monsters') {
          ship.speed = Math.max(5, ship.speed - 10);
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
        ship.materializeDuration = finalMaxHealth / 2;
        ship.sourcePlanet = source;
        ship.buildCostShipsTotal = remainingCostShips;
        ship.buildCostCreditsTotal = creditsPaid;
        ship.buildCostShipsRemaining = remainingCostShips;
        ship.buildCostCreditsRemaining = creditsPaid;

        this.ships.push(ship);
        console.log(`[Capital Ship Build Started] Spawning ${cfg.name} (HP: ${finalMaxHealth}) from Planet ${source.id} for Player ${source.owner.id}. Deducting ${remainingCostShips} ships and ${creditsPaid} credits over ${ship.materializeDuration}s`);
      }
    }
  }

  moveShipsToSpace(player, shipIds, targetX, targetY, isWarp = false, speedModifier = null, isShift = false) {
    const shipMap = new Map();
    for (let i = 0; i < this.ships.length; i++) {
      const s = this.ships[i];
      if (s && s.active) {
        shipMap.set(s.id, s);
      }
    }
    const validShips = shipIds.map(id => shipMap.get(id)).filter(s => s && s.owner && s.owner.id === player.id && !s.isUpgrading);
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
    const shipMap = new Map();
    for (let i = 0; i < this.ships.length; i++) {
      const s = this.ships[i];
      if (s && s.active) {
        shipMap.set(s.id, s);
      }
    }
    const validShips = shipIds.map(id => shipMap.get(id)).filter(s => s && s.owner && s.owner.id === player.id && !s.isUpgrading);
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

    if (typeof planet.isBeingInvaded === 'function' && planet.isBeingInvaded(this)) return;

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

        planet.owner = winnerPlayer;

        planet.revoltWarmup = 0;
        
        const baseShips = Math.floor(planet.ships / 2);
        planet.ships = Math.max(1, baseShips);
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

  update(deltaTime) {
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
        const unusedAIs = this.aiPlayers.filter(p => !this.planets.some(pl => pl.owner === p) && !p.isRampager);
        if (unusedAIs.length > 0) {
          const neutralPlanets = this.planets.filter(p => p.owner === null && !p.rampageIncubating);
          if (neutralPlanets.length > 0) {
            const above150 = neutralPlanets.filter(p => p.maxShips > 150);
            let target;
            if (above150.length > 0) {
              above150.sort((a, b) => a.maxShips - b.maxShips); // smallest first
              target = above150[0];
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

            const unusedAIs = this.aiPlayers.filter(p => !this.planets.some(pl => pl.owner === p) && !p.isRampager);
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
          pirate.crew = 2 * maxHealth;
          pirate.cruiserStyle = randomStyle;
          pirate.fuel = pirate.getMaxFuel();
          pirate.bombs = pirate.getMaxBombs();
          pirate.speed = Math.max(5, pirate.speed - 10);
          pirate.speedModifier = 1.0;

          this.ships.push(pirate);
          console.log(`[PIRATE SPAWN] Spawned pirate cruiser ${pirate.id} with style ${randomStyle} and maxHealth ${maxHealth} for Monsters player at (${Math.round(spawnX)}, ${Math.round(spawnY)}).`);
        }
      }
    }

    // 15-minute global discount decrease timer
    if (this.globalDiscountTimer === undefined) {
      this.globalDiscountTimer = 0;
    }
    this.globalDiscountTimer += deltaTime;
    if (this.globalDiscountTimer >= 900000) {
      this.globalDiscountTimer = 0;
      for (const type of Object.keys(this.globalUpgradeModifiers)) {
        if (this.globalUpgradeModifiers[type] > -0.35) {
          const randDec = 0.10 + Math.random() * 0.10; // random amount from 0.10 to 0.20
          this.globalUpgradeModifiers[type] = Math.round(Math.max(-0.35, this.globalUpgradeModifiers[type] - randDec) * 100) / 100;
        }
      }
      console.log("[GLOBAL DISCOUNT INCREASE] Ticked 15-minute global modifier decrease. Current modifiers:", this.globalUpgradeModifiers);
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

    // Ion Storm knowledge accumulation (ships with labs are the primary method of gaining knowledge now)
    for (const storm of this.ionStorms) {
      if (storm.type === 'minefield') continue;
      for (const player of this.allPlayers) {
        if (!player.isAlive) continue;
        let overlapCount = 0;
        for (const ship of this.ships) {
          if (ship.active && ship.isCruiser && ship.owner && ship.owner.id === player.id && ship.labs > 0) {
            const finalCruiserRadar = ship.cruiserRadarRange();

            const red = hazardSensorReduction(ship.x, ship.y, player.id);
            const effRadar = Math.max(10, finalCruiserRadar - red);
            const dx = ship.x - storm.x;
            const dy = ship.y - storm.y;
            if (Math.sqrt(dx * dx + dy * dy) <= effRadar + storm.radius) {
              overlapCount += ship.labs;

              const k = storm.knowledge[player.id] || 0;
              const tR = Math.sqrt(player.techScore || 0);
              const eR = Math.sqrt(player.expScore || 0);
              const effectiveIntensity = Math.max(0, storm.intensity - k - (tR + eR) / 2);

              if (effectiveIntensity > 1) {
                const knowledgeGained = (ship.labs * deltaTime) / 120000;
                player.techScore = (player.techScore || 0) + knowledgeGained;
                ship.accumulatedTech = (ship.accumulatedTech || 0) + knowledgeGained;
                ship.isActivelyResearching = true;
                if (ship.accumulatedTech >= 1.0) {
                  const beakerCount = Math.floor(ship.accumulatedTech);
                  ship.accumulatedTech -= beakerCount;
                  ship.beakerIncreaseEvent = (ship.beakerIncreaseEvent || 0) + beakerCount;
                }
              }
            }
          }
        }
        if (overlapCount > 0) {
          if (!storm.knowledge[player.id]) storm.knowledge[player.id] = 0;
          storm.knowledge[player.id] += (overlapCount * deltaTime) / 120000;
        }
      }
    }

    // Minefield research/mining loop (continuous warmup, only destroy mines when warmup completes)
    for (const storm of this.ionStorms) {
      if (storm.type !== 'minefield') continue;
      for (const player of this.allPlayers) {
        if (!player.isAlive) continue;
        for (const ship of this.ships) {
          if (ship.active && ship.isCruiser && ship.owner && ship.owner.id === player.id && ship.labs > 0 && ship.scoutAttackEnabled) {
            const finalCruiserRadar = ship.cruiserRadarRange();
            const red = hazardSensorReduction(ship.x, ship.y, player.id);
            const effRadar = Math.max(10, finalCruiserRadar - red);
            const dx = ship.x - storm.x;
            const dy = ship.y - storm.y;
            if (Math.sqrt(dx * dx + dy * dy) <= effRadar + storm.radius) {
              // Cruiser is actively researching minefield
              ship.isActivelyResearching = true;
              const knowledgeGained = (ship.labs * deltaTime) / 120000;
              ship.accumulatedTech = (ship.accumulatedTech || 0) + knowledgeGained;
              
              if (ship.accumulatedTech >= 1.0) {
                const completions = Math.floor(ship.accumulatedTech);
                ship.accumulatedTech -= completions;
                
                for (let c = 0; c < completions; c++) {
                  const rolledMines = Math.floor(Math.random() * 6) + 1;
                  const minesDestroyed = Math.min(storm.mines, rolledMines);
                  storm.mines -= minesDestroyed;
                  player.credits = (player.credits || 0) + minesDestroyed;
                  ship.creditsGainedEvent = (ship.creditsGainedEvent || 0) + minesDestroyed;
                  
                  if (minesDestroyed > 0) {
                    this.explosions.push({
                      x: ship.x,
                      y: ship.y,
                      isDollarSign: true,
                      amount: minesDestroyed,
                      remainingMines: storm.mines,
                      age: 0
                    });

                    for (let k = 0; k < minesDestroyed; k++) {
                      const delayMs = Math.random() * 2000;
                      
                      let tx = storm.x;
                      let ty = storm.y;
                      for (let attempt = 0; attempt < 30; attempt++) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = Math.random() * storm.radius;
                        const px = storm.x + Math.cos(angle) * r;
                        const py = storm.y + Math.sin(angle) * r;
                        const sDx = px - ship.x;
                        const sDy = py - ship.y;
                        if (sDx * sDx + sDy * sDy <= effRadar * effRadar) {
                          tx = px;
                          ty = py;
                          break;
                        }
                      }

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
                          this.explosions.push({
                            x: finalTx,
                            y: finalTy,
                            color: '#44f',
                            age: 0
                          });
                        }
                      });
                    }
                  }
                }
                
                if (storm.initialMines > 0) {
                  storm.radius = storm.initialRadius * (storm.mines / storm.initialMines);
                }
              }
            }
          }
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
              this.explosions.push({ x: ship.x, y: ship.y, color: explosionColor, age: 0 });
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
                this.explosions.push({ x: ship.x, y: ship.y, color: '#44f', age: 0 });
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
                if (planet.maxShips < 55) {
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
      if (p.isAmoebaHive && p.owner === this.monsterPlayer) {
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

    if (this.pendingAIs && this.pendingAIs.length > 0) {
      this.aiSpawnTimer += deltaTime;
      if (this.aiSpawnTimer >= this.aiSpawnInterval) {
        this.aiSpawnTimer -= this.aiSpawnInterval;
        const aiToSpawn = this.pendingAIs.shift();
        if (this.assignPlanet(aiToSpawn)) {
          const aiHomeworld = this.planets.find(p => p.owner === aiToSpawn);
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
      player.cruiserCount = this.ships.filter(s => s.active && s.owner === player && s.isCruiser).length;
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
        effShips = isFull ? planet.ships * 4 : planet.ships * 2;
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
        player.credits += player.credits * (0.01 / 60000) * deltaTime;
      } else if ((player.credits || 0) > 0) {
        player.credits += player.credits * (0.005 / 60000) * deltaTime;
      }
      let garrisonWorlds = 0;
      let fullGarrisonWorlds = 0;
      let commerceWorlds = 0;
      let controlledHomeworlds = 0;
      let controlsOwnHomeworld = false;

      for (const planet of this.planets) {
        if (planet.owner === player) {
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
        }
      }

      player.commandLimit = 1 + Math.ceil((player.planetCount || 0) / 3) + garrisonWorlds + fullGarrisonWorlds + controlledHomeworlds + (controlsOwnHomeworld ? 1 : 0);
      player.tradeCapacity = Math.ceil((player.planetCount || 0) / 5) + commerceWorlds;
      player.stockpileCapacity = (player.commandLimit || 0) + (player.tradeCapacity || 0);

      player.storageFeeAccumulator = (player.storageFeeAccumulator || 0) + deltaTime;
      while (player.storageFeeAccumulator >= 1000) {
        player.storageFeeAccumulator -= 1000;
        
        const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
        let totalStockpile = 0;
        if (!player.resources) {
          player.resources = { dilithium: 0, merculite: 0, duranium: 0, tritanium: 0, antimatter: 0, deuterium: 0, latinum: 0 };
        }
        for (const res of resourcesList) {
          totalStockpile += (player.resources[res] || 0);
        }
        
        const stockpileCapacity = player.stockpileCapacity || 1;
        player.totalStockpile = totalStockpile;

        if (totalStockpile > stockpileCapacity) {
          const excess = totalStockpile - stockpileCapacity;
          const storageFee = excess / (stockpileCapacity * 8);
          player.storageFeeRate = storageFee * 60;

          if ((player.credits || 0) >= storageFee) {
            player.credits -= storageFee;
          } else {
            let remainingFee = storageFee - (player.credits || 0);
            player.credits = 0;

            while (remainingFee > 0) {
              let highestRes = null;
              let highestQty = 0;
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
          player.storageFeeRate = 0;
        }
      }

      if (player.tradeOptions === undefined) {
        player.tradeOptions = player.tradeCapacity;
      } else {
        player.tradeOptions = Math.min(player.tradeCapacity, player.tradeOptions);
      }

      // Handle Trade Options Regeneration at decreasing intervals
      const tradeRegenRate = 1 + commerceWorlds;
      const tradeRegenInterval = 60000 / tradeRegenRate;
      player.tradeRegenAccumulator = (player.tradeRegenAccumulator || 0) + deltaTime;
      while (player.tradeRegenAccumulator >= tradeRegenInterval) {
        player.tradeRegenAccumulator -= tradeRegenInterval;
        player.tradeOptions = Math.min(player.tradeCapacity, (player.tradeOptions || 0) + 1);
      }

      // Passive trading income based on effective ships of all friendly/neutral planets, capped based on player's own effective ships
      if (player !== this.monsterPlayer) {
        let playerEffectiveShips = 0;
        
        // 1. Calculate player's own effective ships (doubled if commerce focus, quadrupled if commerce focus and at full ships)
        for (const planet of this.planets) {
          if (planet.dead) continue;
          const isOwn = (planet.owner && planet.owner.id === player.id);
          if (isOwn) {
            let eff = planet.ships;
            if (planet.focusMode === 'commerce') {
              const isFull = planet.ships >= planet.maxShips;
              eff = isFull ? planet.ships * 4 : planet.ships * 2;
            }
            playerEffectiveShips += eff;
          }
        }

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
                baseShips = Math.min(baseShips, sympathyVal * 10);
              }

              let eff = baseShips;
              if (planet.focusMode === 'commerce') {
                const isFull = planet.ships >= planet.maxShips;
                eff = isFull ? baseShips * 4 : baseShips * 2;
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
              rate: qualifyingShipsSum > 0 ? ((shipsCapped / qualifyingShipsSum) * tradingIncomeRate) : 0
            });
          }
        }
      } else {
        player.passiveIncomeRate = 0;
        player.tradingPartners = [];
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

    // Owned planets exert sympathy on neutral and enemy planets within their gravity well that have less ships than them at the rate of 1 per minute.
    for (const sourcePlanet of this.planets) {
      if (sourcePlanet.owner) {
        const gravityRadius = sourcePlanet.getGravityRadius();
        for (const targetPlanet of this.planets) {
          if (targetPlanet.id !== sourcePlanet.id) {
            const isNeutralOrEnemy = !targetPlanet.owner || targetPlanet.owner.id !== sourcePlanet.owner.id;
            if (isNeutralOrEnemy) {
              const dx = targetPlanet.x - sourcePlanet.x;
              const dy = targetPlanet.y - sourcePlanet.y;
              const distSq = dx * dx + dy * dy;
              if (distSq <= gravityRadius * gravityRadius) {
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
          age: 0
        });
      }
    }
    
    // Update and remove explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].age += deltaTime / 1000;
      const maxAge = this.explosions[i].isDollarSign ? 5.0 : 1.0;
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
              hit: !!laser.destroysDefender
            });
          }
          if (laser.destroysDefender) {
            if (laser.targetPlanetId !== undefined) {
              const targetPlanet = this.planets.find(pl => pl.id === laser.targetPlanetId);
              if (targetPlanet && targetPlanet.ships > 0) {
                const oldShips = targetPlanet.ships;
                targetPlanet.ships -= 1;
                let toDestroy = 0;
                if (laser.splashDamage && laser.splashDamage > 0) {
                  const splashLimit = Math.floor(targetPlanet.ships / 50);
                  const splash = Math.min(laser.splashDamage, splashLimit);
                  toDestroy = Math.min(targetPlanet.ships, splash);
                  targetPlanet.ships -= toDestroy;
                }
                const actualKilled = oldShips - targetPlanet.ships;
                targetPlanet.addExperience(actualKilled);
                
                if (targetPlanet.ships <= 0) {
                  targetPlanet.ships = 0;
                  const sourceShip = this.ships.find(sh => sh.id === laser.sourceShipId);
                  if (sourceShip && sourceShip.owner) {
                    const previousOwner = targetPlanet.owner;
                    if (previousOwner !== null) {
                      targetPlanet.maxShips--;
                      if (targetPlanet.maxShips < 55) {
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
                    targetPlanet.owner = sourceShip.owner;
                    targetPlanet.rampageBoost = false;
                    targetPlanet.rampageEvent = false;
                    
                    // Check previous owner elimination
                    if (previousOwner && previousOwner !== sourceShip.owner) {
                      const hasRemaining = this.planets.some(pl => pl !== targetPlanet && pl.owner === previousOwner);
                      if (!hasRemaining) {
                        targetPlanet.defeatEvent = { name: previousOwner.name, color: previousOwner.color };
                        sourceShip.owner.expScore = (sourceShip.owner.expScore || 0) + 100;
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

    // Remove inactive ships and dead planets
    this.ships = this.ships.filter(s => s.active);
    
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
                if (nearby.maxShips < 55) {
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
            if (val < 0 && val > -0.50) {
              eligibleUpgradeTypes.push(type);
            } else if (val === 0) {
              zeroUpgradeTypes.push(type);
            }
          }

          let chosenType = null;
          if (roll === 1 && eligibleUpgradeTypes.length > 0) {
            chosenType = eligibleUpgradeTypes[Math.floor(Math.random() * eligibleUpgradeTypes.length)];
            player.upgradeModifiers[chosenType] = Math.max(-0.50, player.upgradeModifiers[chosenType] - 0.10);
          } else if (zeroUpgradeTypes.length > 0) {
            chosenType = zeroUpgradeTypes[Math.floor(Math.random() * zeroUpgradeTypes.length)];
            player.upgradeModifiers[chosenType] = Math.max(-0.50, player.upgradeModifiers[chosenType] - 0.10);
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
                fueltanker: 'Fuel Tanker',
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

    // Sell & Fulfill Orders Expiration and Neutral Postings Loops
    if (!this.sellOrders) {
      this.sellOrders = [];
    }
    if (!this.fulfillOrders) {
      this.fulfillOrders = [];
    }

    // 1. Check expirations (15 minutes lifespan)
    const nowTimestamp = Date.now();
    for (let i = this.sellOrders.length - 1; i >= 0; i--) {
      const order = this.sellOrders[i];
      if (nowTimestamp >= order.expiresAt) {
        // Return 1.0 resource unit back to original owner
        const owner = this.allPlayers.find(p => p.id === order.ownerId);
        if (owner && owner.isAlive) {
          if (!owner.resources) owner.resources = {};
          owner.resources[order.resource] = (owner.resources[order.resource] || 0) + 1.0;
          console.log(`[Market Expiration] Order ${order.id} expired. 1.0 ${order.resource} returned to ${owner.id}`);
        }
        this.sellOrders.splice(i, 1);
      }
    }
    for (let i = this.fulfillOrders.length - 1; i >= 0; i--) {
      const order = this.fulfillOrders[i];
      if (nowTimestamp >= order.expiresAt) {
        this.fulfillOrders.splice(i, 1);
        console.log(`[Market Expiration] Fulfill Order ${order.id} expired.`);
      }
    }

    // 2. Neutral Posting Loop (every 2-3 minutes)
    this.neutralTradeTimer = (this.neutralTradeTimer || 0) + deltaTime;
    if (this.neutralTradeTimer >= (this.nextNeutralTradeTime || 120000)) {
      this.neutralTradeTimer = 0;
      this.nextNeutralTradeTime = 120000 + Math.random() * 60000; // 2-3 minutes random interval

      const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      const randomRes = resourcesList[Math.floor(Math.random() * resourcesList.length)];
      const d3 = Math.floor(Math.random() * 3) + 1; // d3 (1, 2, 3)
      let startPrice = 7 + d3;
      if (this.resourceRarities && this.resourceRarities[randomRes]) {
        const rarity = this.resourceRarities[randomRes];
        if (rarity === 'exotic') startPrice = Math.round(startPrice * 3);
        else if (rarity === 'rare') startPrice = Math.round(startPrice * 2);
        else if (rarity === 'common') startPrice = Math.round(startPrice * 0.75);
      }

      // Post the new neutral order
      const orderId = "order_" + Math.random().toString(36).substring(2, 9);
      this.sellOrders.push({
        id: orderId,
        ownerId: 'neutral',
        ownerName: 'Neutral Market',
        resource: randomRes,
        price: startPrice,
        createdAt: nowTimestamp,
        expiresAt: nowTimestamp + 15 * 60000 // 15 minutes in milliseconds
      });
      console.log(`[Neutral Market] Posted sell order ${orderId} for ${randomRes} at price ${startPrice}.`);

      // Decrease the price of all existing neutral and AI orders by 10-30%, min 1
      for (const order of this.sellOrders) {
        const isNeutral = order.ownerId === 'neutral';
        const isAI = this.aiPlayers.some(p => p.id === order.ownerId);
        if ((isNeutral || isAI) && order.id !== orderId) {
          const oldPrice = order.price;
          const pct = 0.10 + Math.random() * 0.20;
          const decrease = Math.max(1, Math.round(oldPrice * pct));
          order.price = Math.max(1, oldPrice - decrease);
          console.log(`[Market Decay] Decayed ${isNeutral ? 'Neutral' : 'AI'} order ${order.id} price from ${oldPrice} to ${order.price} (decay=${decrease}, pct=${Math.round(pct * 100)}%).`);
        }
      }
    }

    // 3. AI Posting Loop (every 1 minute)
    this.aiMarketTimer = (this.aiMarketTimer || 0) + deltaTime;
    if (this.aiMarketTimer >= 60000) {
      this.aiMarketTimer = 0;

      const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      
      for (const aiPlayer of this.aiPlayers) {
        if (!aiPlayer.isAlive || !aiPlayer.isAI) continue;
        if (!aiPlayer.resources) aiPlayer.resources = {};

        // Find qualifying resources where AI has > 2.0
        let mostNumerousRes = null;
        let highestQty = 2.0; // Must be strictly greater than 2.0
        
        for (const res of resourcesList) {
          const qty = aiPlayer.resources[res] || 0;
          if (qty > highestQty) {
            highestQty = qty;
            mostNumerousRes = res;
          }
        }

        // If qualifying, 33% chance to post
        if (mostNumerousRes && Math.random() < 0.33) {
          // Deduct 1.0 resource
          aiPlayer.resources[mostNumerousRes] -= 1.0;
          // Deduct 1 trade option
          if (aiPlayer.tradeOptions === undefined) {
            aiPlayer.tradeOptions = aiPlayer.tradeCapacity || 5;
          }
          aiPlayer.tradeOptions = (aiPlayer.tradeOptions || 0) - 1;

          // Create the sell order
          const orderId = "order_" + Math.random().toString(36).substring(2, 9);
          const d3 = Math.floor(Math.random() * 3) + 1; // d3 (1, 2, or 3)
          let startPrice = 7 + d3;
          if (this.resourceRarities && this.resourceRarities[mostNumerousRes]) {
            const rarity = this.resourceRarities[mostNumerousRes];
            if (rarity === 'exotic') startPrice = Math.round(startPrice * 3);
            else if (rarity === 'rare') startPrice = Math.round(startPrice * 2);
            else if (rarity === 'common') startPrice = Math.round(startPrice * 0.75);
          }
          
          this.sellOrders.push({
            id: orderId,
            ownerId: aiPlayer.id,
            ownerName: aiPlayer.name,
            resource: mostNumerousRes,
            price: startPrice,
            createdAt: nowTimestamp,
            expiresAt: nowTimestamp + 15 * 60000 // 15 minutes
          });
          console.log(`[AI Market Post] AI Player ${aiPlayer.name} (${aiPlayer.id}) posted 1 ${mostNumerousRes} for ${startPrice} credits (stock remaining: ${aiPlayer.resources[mostNumerousRes]}, options remaining: ${aiPlayer.tradeOptions}).`);
        }
      }
    }

    // 4. Auto Buy Orders Check
    if (this.sellOrders && this.sellOrders.length > 0) {
      for (const player of this.allPlayers) {
        if (!player.isAlive || player.isAI) continue;
        if (!player.autoBuyOrders || player.autoBuyOrders.length === 0) continue;

        if (player.tradeOptions === undefined) {
          player.tradeOptions = player.tradeCapacity || 5;
        }

        let minAllowedCredits = 0;
        const ownsHomeworld = this.planets.some(p => p.homeworldOf === player.id && p.owner && p.owner.id === player.id);
        if (ownsHomeworld) {
          minAllowedCredits = -(1000 + (player.totalShips || 0));
        }

        let purchasedAny = true;
        while (purchasedAny && player.tradeOptions >= 1 && this.sellOrders.length > 0) {
          purchasedAny = false;
          for (const abo of player.autoBuyOrders) {
            if (player.tradeOptions < 1) break;

            let bestOrderIdx = -1;
            let lowestPrice = Infinity;

            for (let i = 0; i < this.sellOrders.length; i++) {
              const order = this.sellOrders[i];
              if (order.ownerId !== player.id && order.resource === abo.resource && order.price <= abo.price) {
                const buyerCredits = player.credits || 0;
                if (order.price < lowestPrice && (buyerCredits - minAllowedCredits) >= order.price) {
                  lowestPrice = order.price;
                  bestOrderIdx = i;
                }
              }
            }

            if (bestOrderIdx !== -1) {
              const order = this.sellOrders[bestOrderIdx];
              player.tradeOptions -= 1;
              player.credits = (player.credits || 0) - order.price;
              if (!player.resources) player.resources = {};
              player.resources[order.resource] = (player.resources[order.resource] || 0) + 1.0;

              if (order.ownerId !== 'neutral') {
                const seller = this.allPlayers.find(p => p.id === order.ownerId);
                if (seller) {
                  seller.credits = (seller.credits || 0) + order.price;
                }
              }

              console.log(`[Auto Buy Success] Player ${player.id} automatically purchased 1 ${order.resource} from ${order.ownerId} for ${order.price} credits using Auto Buy Order ${abo.id}.`);
              this.sellOrders.splice(bestOrderIdx, 1);
              purchasedAny = true;
              break;
            }
          }
        }
      }
    }

    if (this.onScoreUpdate) {
      const pCount = this.planets.filter(p => p.owner === this.humanPlayer).length;
      const aiCount = this.planets.filter(p => p.owner && p.owner !== this.humanPlayer).length;
      this.onScoreUpdate(pCount, aiCount);
    }
  }

  triggerDiplomacyEvent(ship, targetPlanet) {
    const expBonus = Math.sqrt(ship.owner.expScore || 0);
    const shipExpBonus = ship.getLocalXpBonus();
    const MathSquareBase = expBonus + shipExpBonus;
    const currentSym = getEffectiveSympathy(targetPlanet, ship.owner.id, this.ships, ship.owner, this);
    const disposition = targetPlanet.disposition ? (targetPlanet.disposition[ship.owner.id] ?? 0) : 0;

    const prefRes = targetPlanet.preferredResource;
    const initialQty = prefRes ? (ship.owner.resources?.[prefRes] || 0) : 0;

    if (prefRes && initialQty >= 0.1) {
      ship.owner.resources[prefRes] = Math.max(0, ship.owner.resources[prefRes] - 0.1);
      ship.diplomatPrefResourceEvent = (ship.diplomatPrefResourceEvent || 0) + 1;
    }

    const hasPref = prefRes && initialQty >= 0.1;

    const chanceBase = 30 + disposition + currentSym + MathSquareBase;
    const chancePref = 30 + disposition + currentSym + (MathSquareBase * 3) + 10;
    
    let rawChance = hasPref ? chancePref : chanceBase;
    if (ship.cruiserStyle === targetPlanet.racialAffinity || (ship.owner && ship.owner.cruiserStyle === targetPlanet.racialAffinity)) {
      rawChance += 20;
    }
    const chancePercent = Math.max(0, Math.round(rawChance));
    
    const roll = Math.floor(Math.random() * 100) + 1;

    ship.gainXp(1, this);

    if (roll <= chancePercent) {
      ship.owner.expScore = (ship.owner.expScore || 0) + 1;

      targetPlanet.sympathy = targetPlanet.sympathy || {};
      targetPlanet.disposition = targetPlanet.disposition || {};

      if (targetPlanet.disposition[ship.owner.id] === undefined) {
        let rollSum = 0;
        for (let i = 0; i < 10; i++) {
          rollSum += Math.floor(Math.random() * 10) + 1;
        }
        let dispositionVal = rollSum - 60;

        if (initialQty >= 0.1) {
          dispositionVal += (expBonus + shipExpBonus) * 3;
        }
        if (initialQty >= 0.1) {
          dispositionVal += 10;
        }
        dispositionVal += 0.5 * currentSym;

        targetPlanet.disposition[ship.owner.id] = Math.max(-100, Math.min(100, Math.floor(dispositionVal)));
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
      
      ship.diplomatSuccessEvent = (ship.diplomatSuccessEvent || 0) + actualIncrease;
    } else {
      ship.diplomatFailureEvent = (ship.diplomatFailureEvent || 0) + 1;
      ship.diplomatFailureChance = Math.round(chancePercent);
    }
  }

  updateCustomCruiserSystems(dt) {
    if (!this.isRunning || this.isPaused) return;

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
          let radar = baseCruiserRadar + 10 * (diplomat.sensorarrays || 0);
          radar *= (1 + 0.25 * (diplomat.sensorarrays || 0));
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
          target.isUnderBoarding = true;
          target.boardingPlayer = pod.owner;
          target.boardingMarines = (target.boardingMarines || 0) + pod.marineCount;
          target.boardingSourceId = pod.sourceShipId;
        } else if (pod.isReturnPod) {
          const maxCapacity = (target.marines || 0) * target.maxHealth;
          target.marineCount = Math.min(maxCapacity, (target.marineCount || 0) + pod.marineCount);
        }
      }
    }

    // Handle Cruisers simulation
    for (const ship of cruisers) {
      if (ship.isUpgrading) continue;

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
        ship.crew = Math.min(2 * ship.health, (ship.crew || 0) + 1 * dt);
      }

      // 3. Load Marines
      // "load marines up to capacity from planets with > 50% ships at cost of 1 ship from nearby planet for each marine"
      if (ship.inFriendlyWell && (ship.marines || 0) > 0) {
        const capacity = ship.marines * ship.maxHealth;
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
              const currentSym = getEffectiveSympathy(p, ship.owner.id, this.ships, ship.owner, this);
              const isMaxEmpathy = currentSym >= p.maxShips;
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
            const closeQualifying = qualifyingPlanets.filter(qp => qp.dist <= 25);
            if (closeQualifying.length > 0) {
              // Exception: select the closest qualifying planet within 25px
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

                const dispA = a.planet.disposition ? (a.planet.disposition[ship.owner.id] || 0) : 0;
                const dispB = b.planet.disposition ? (b.planet.disposition[ship.owner.id] || 0) : 0;

                if (dispA !== dispB) {
                  return dispB - dispA; // Higher disposition first
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

      // 4b. Marine Planet Attack Check
      const maxMarinesCapacity = (ship.marines || 0) * (ship.maxHealth || 0);
      const isTargetingPlanet = (ship.cruiserTargetType === 'planet' && ship.cruiserTargetId !== null);
      const hasEnoughMarines = maxMarinesCapacity > 0 && ship.marineCount > 0.5 * maxMarinesCapacity && ship.scoutAttackEnabled === true && isTargetingPlanet;

      if ((ship.marineCount || 0) > 0 && hasEnoughMarines) {
        let targetPlanet = null;
        if (ship.cruiserTargetType === 'planet' && ship.cruiserTargetId !== null) {
          const p = this.planets.find(p => p.id === ship.cruiserTargetId);
          if (p && (!p.owner || p.owner.id !== ship.owner.id)) {
            targetPlanet = p;
          }
        }

        if (targetPlanet) {
          // Launch standard fleet representing the marines
          const count = Math.floor(ship.marineCount);
          const marineFleet = new Ship(this.nextShipId++, ship.x, ship.y, targetPlanet, ship.owner);
          marineFleet.cruiserStyle = ship.cruiserStyle;
          marineFleet.count = count;
          marineFleet.speedModifier = 1.0;
          marineFleet.isMarineFleet = true;
          marineFleet.sourceShipId = ship.id;
          marineFleet.speed = 35;

          let startingExp = ship.expScore || 0;
          const tritaniumCost = 0.01 * (count / 3);
          const owner = ship.owner;
          if (owner && owner.resources && (owner.resources.tritanium || 0) >= tritaniumCost && count > 0) {
            owner.resources.tritanium -= tritaniumCost;
            startingExp += 400;
          }
          marineFleet.expScore = startingExp;
          this.ships.push(marineFleet);

          console.log(`[MARINE PLANET INVASION] Cruiser ${ship.id} launched a fleet of ${marineFleet.count} marines to attack target planet ${targetPlanet.name}.`);
          ship.marineCount = 0;
        }
      }

      // Direct ship targeting launch check (Moved outside of hasEnoughMarines block to fix logic contradiction)
      let targetShip = null;
      if ((ship.marineCount || 0) > 0 && ship.cruiserTargetType === 'ship' && ship.cruiserTargetId !== null) {
        const enemy = this.ships.find(s => s.id === ship.cruiserTargetId && s.active);
        if (enemy && enemy.owner && (enemy.owner.id !== ship.owner.id || enemy.isAmoeba)) {
          targetShip = enemy;
        }
      }

      if (targetShip) {
        // Only launch up to 3 times the defending crew
        const count = Math.min(Math.floor(ship.marineCount), Math.max(1, 3 * (targetShip.crew || 0)));
        const marineFleet = new Ship(this.nextShipId++, ship.x, ship.y, null, ship.owner, targetShip.x, targetShip.y);
        marineFleet.cruiserStyle = ship.cruiserStyle;
        marineFleet.count = count;
        marineFleet.speedModifier = 1.0;
        marineFleet.isMarineFleet = true;
        marineFleet.targetShipId = targetShip.id;
        marineFleet.sourceShipId = ship.id;
        marineFleet.speed = 35;

        let startingExp = ship.expScore || 0;
        const tritaniumCost = 0.01 * (count / 3);
        const owner = ship.owner;
        if (owner && owner.resources && (owner.resources.tritanium || 0) >= tritaniumCost && count > 0) {
          owner.resources.tritanium -= tritaniumCost;
          startingExp += 400;
        }
        marineFleet.expScore = startingExp;
        this.ships.push(marineFleet);

        console.log(`[MARINE SHIP INVASION] Cruiser ${ship.id} launched a fleet of ${marineFleet.count} marines to target ship ${targetShip.id}.`);
        ship.marineCount = Math.max(0, ship.marineCount - count);
      }

      // 5. Boarding Trigger Checks
      if ((ship.marineCount || 0) > 0 && (ship.marines || 0) > 0) {
        // Find enemy cruiser in full scan range of attacking cruiser
        for (const enemy of cruisers) {
          if (enemy.owner.id !== ship.owner.id && !enemy.isAmoeba) {
            const dx = enemy.x - ship.x;
            const dy = enemy.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radar) {
              const isSelectedTarget = (ship.cruiserTargetType === 'ship' && ship.cruiserTargetId === enemy.id);
              if (isSelectedTarget || ship.marineCount > 0) {
                // Launch Boarding Fleet Pod up to 3 times the defending crew
                const launchCount = Math.min(Math.floor(ship.marineCount), Math.max(1, 3 * (enemy.crew || 0)));
                const pod = new Ship(this.nextShipId++, ship.x, ship.y, null, ship.owner, enemy.x, enemy.y);
                pod.cruiserStyle = ship.cruiserStyle;
                pod.isBoardingFleet = true;
                pod.targetShipId = enemy.id;
                pod.sourceShipId = ship.id;
                pod.marineCount = launchCount;
                pod.speed = 60; // moves at fast pace
                pod.isCruiser = false; // it is drawn uniquely, not as a cruiser body!
                this.ships.push(pod);

                console.log(`[BOARDING] Ship ${ship.id} launched pod targeting Ship ${enemy.id} carrying ${launchCount} marines.`);
                ship.marineCount = Math.max(0, ship.marineCount - launchCount);
                break;
              }
            }
          }
        }
      }

      // 6. Boarding Battle Combat resolution
      if (ship.isUnderBoarding && ship.boardingMarines > 0) {
        let M_atk = ship.boardingMarines;
        let M_def = ship.marineCount || 0;
        let C_def = ship.crew || 0;

        // Symmetric combat tick
        const killRateAtk = Math.max(0.05, Math.min(0.95, (50 + M_atk - C_def - M_def) / 100));
        const defendersKilled = M_atk * killRateAtk * dt;

        const killRateDef = Math.max(0.05, Math.min(0.95, (25 + C_def + M_def - M_atk) / 100));
        const attackersKilled = (C_def + M_def) * killRateDef * dt;

        // Apply attackers casualties
        M_atk = Math.max(0, M_atk - attackersKilled);

        // Apply defenders casualties
        let remDeaths = defendersKilled;
        if (M_def > 0) {
          const deaths = Math.min(M_def, remDeaths);
          M_def -= deaths;
          remDeaths -= deaths;
        }
        C_def = Math.max(0, C_def - remDeaths);

        ship.boardingMarines = M_atk;
        ship.marineCount = M_def;
        ship.crew = C_def;

        if (M_atk <= 0) {
          // Boarding failed!
          ship.isUnderBoarding = false;
          ship.boardingMarines = 0;
          console.log(`[BOARDING FAILED] Boarding of Ship ${ship.id} failed. Defenders survived.`);
        } else if (M_def <= 0 && C_def <= 0) {
          // Attacking victory! Capture successful!
          const originalSourceId = ship.boardingSourceId;

          ship.isUnderBoarding = false;
          ship.boardingMarines = 0;

          // Change ownership
          ship.owner = this.allPlayers.find(p => p.id === ship.boardingPlayer.id);
          
          // Crew from survivors
          const crewNeeded = 2 * ship.health;
          const crewAssigned = Math.min(M_atk, crewNeeded);
          ship.crew = crewAssigned;
          M_atk -= crewAssigned;
          ship.marineCount = 0;

          console.log(`[BOARDING SUCCESS] Ship ${ship.id} captured by player ${ship.owner.name}.`);

          // Spawn return pod if survivors remain
          if (M_atk > 0) {
            const launcher = this.ships.find(ss => ss.id === originalSourceId && ss.active);
            if (launcher) {
              const rPod = new Ship(this.nextShipId++, ship.x, ship.y, null, ship.owner, launcher.x, launcher.y);
              rPod.cruiserStyle = ship.cruiserStyle;
              rPod.isReturnPod = true;
              rPod.targetShipId = launcher.id;
              rPod.sourceShipId = ship.id;
              rPod.marineCount = M_atk;
              rPod.speed = 60;
              this.ships.push(rPod);
              console.log(`[RETURN POD] Returning ${M_atk} survivors from Ship ${ship.id} to Ship ${launcher.id}.`);
            }
          }
        }
      }
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

    // Calculate total galactic capacity
    let galacticCapacity = 0;
    for (const p of this.planets) {
      galacticCapacity += p.maxShips;
    }

    // Tech score victory condition: 10% tech bonus lead AND minimum 15% absolute tech bonus
    const sortedByTech = [...this.allPlayers].filter(p => p.isAlive).sort((a, b) => (b.techScore || 0) - (a.techScore || 0));
    if (sortedByTech.length >= 2) {
      const topPlayer = sortedByTech[0];
      const topBonus = Math.floor(Math.sqrt(topPlayer.techScore || 0));
      const secondBonus = Math.floor(Math.sqrt(sortedByTech[1].techScore || 0));
      if (topBonus >= 15 && topBonus - secondBonus >= 10) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(TECH DOMINATION)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
      }
    } else if (sortedByTech.length === 1) {
      const topPlayer = sortedByTech[0];
      const topBonus = Math.floor(Math.sqrt(topPlayer.techScore || 0));
      if (topBonus >= 15) {
        this.stop();
        this.gameOverMessage = `${(topPlayer.name || topPlayer.id).toUpperCase()} IS VICTORIOUS!\n(TECH DOMINATION)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
      }
    }

    // Capacity victory condition: 75% of total galactic capacity
    
    for (const player of this.allPlayers) {
      if (player.isAlive && (player.totalCapacity || 0) > galacticCapacity * 0.75) {
        this.stop();
        this.gameOverMessage = `${(player.name || player.id).toUpperCase()} IS VICTORIOUS!\n(ECONOMIC DOMINATION)`;
        if (this.onGameOver) this.onGameOver(this.gameOverMessage);
        return;
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

    // Calculate total galaxy max ships capacity
    let totalGalaxyMaxShips = 0;
    for (const p of this.planets) {
      totalGalaxyMaxShips += p.maxShips || 0;
    }

    // For each player, compute: Tech Bonus + Experience Bonus + Percentage of Maxships
    let bestPlayer = null;
    let highestScore = -Infinity;

    for (const player of players) {
      const techBonus = Math.sqrt(player.techScore || 0);
      const expBonus = Math.sqrt(player.expScore || 0);

      // Percentage of Maxships (out of 100)
      let playerMaxShips = 0;
      for (const p of this.planets) {
        if (p.owner && p.owner.id === player.id) {
          playerMaxShips += p.maxShips || 0;
        }
      }
      const pctMaxShips = totalGalaxyMaxShips > 0 ? (playerMaxShips / totalGalaxyMaxShips) * 100 : 0;

      const totalScore = techBonus + expBonus + pctMaxShips;

      if (totalScore > highestScore) {
        highestScore = totalScore;
        bestPlayer = player;
      }
    }

    let winnerName = 'NO ONE';
    if (bestPlayer) {
      winnerName = bestPlayer.name || bestPlayer.id;
    }

    this.gameOverMessage = `${winnerName.toUpperCase()} IS VICTORIOUS!\n(TIMED GAME VICTORY)`;
    if (this.onGameOver) this.onGameOver(this.gameOverMessage);
  }
}
