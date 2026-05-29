import { Player } from './entities/Player.js';
import { Planet } from './entities/Planet.js';
import { Ship } from './entities/Ship.js';
import { InputHandler } from './systems/InputHandler.js';
import { AIController } from './systems/AIController.js';

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
    this.ships = [];
    this.lasers = [];
    this.explosions = [];
    
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
    this.rampageInterval = 900000;
    this.nextRampageTime = 900000;
    this.scheduledAttacks = [];
    this.ionStorms = [];
    this.nextIonStormId = 0;
    this.ionStormSpawnTimer = 0;
    this.ionStormDamageTimer = 0;
    this.globalUpgradeModifiers = {
      sensorarray: -0.25,
      lab: -0.25,
      armor: -0.25,
      shield: -0.25,
      engine: -0.25,
      munitions: -0.25,
      targeting: -0.25,
      damagecontrol: -0.25,
      fueltanker: -0.25,
      diplomat: -0.25,
      marines: -0.25
    };
    this.upgradeEnhanceEvents = [];
    this.pendingChatMessages = [];
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
                          (ship.marines || 0);
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
      
      sensorarray: 'sensorarray',
      lab: 'lab',
      shield: 'shield',
      fueltanker: 'fueltanker'
    };
    const normType = typeKeyMap[type] || type;
    
    const globalMod = (this.globalUpgradeModifiers && this.globalUpgradeModifiers[normType] !== undefined)
      ? this.globalUpgradeModifiers[normType]
      : -0.25;
      
    let playerMod = 0.0;
    if (ship.owner && ship.owner.upgradeModifiers && ship.owner.upgradeModifiers[normType] !== undefined) {
      playerMod = ship.owner.upgradeModifiers[normType];
    }
    
    const modifier = globalMod + playerMod;
    return Math.max(1, Math.round(baseCost * (1 + modifier)));
  }

  tryAssignPlanet(player) {
    if (player.needsPlanet && this.isRunning && player.isAlive !== undefined) {
      player.needsPlanet = false;
      this.assignPlanet(player);
    }
  }

  assignPlanet(player) {
    const neutralPlanets = this.planets.filter(p => p.owner === null && !p.isSuperPlanet);
    if (neutralPlanets.length === 0) return false;

    let targetPlanet = null;

    if (player === this.monsterPlayer) {
      // Monster gets the smallest planet
      neutralPlanets.sort((a, b) => a.maxShips - b.maxShips);
      targetPlanet = neutralPlanets[0];
    } else {
      const humanPlanets = this.planets.filter(p => p.owner && !p.owner.isAI);
      
      if (!player.isAI && humanPlanets.length > 0) {
        // Human player: prioritize candidates with maxShips > 115, sorted by distance to nearest human planet descending
        const candidatePlanets = neutralPlanets.filter(p => p.maxShips > 115);
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
        const candidatePlanets = neutralPlanets.filter(p => p.maxShips > 115 && humanPlanets.every(hp => {
          const dx = p.x - hp.x;
          const dy = p.y - hp.y;
          return dx*dx + dy*dy >= 40000; // 200^2
        }));

        if (candidatePlanets.length > 0) {
          candidatePlanets.sort((a, b) => a.maxShips - b.maxShips); // smallest > 115
          targetPlanet = candidatePlanets[0];
        } else {
          // Fallback 1: smallest > 115 regardless of distance
          const anyLarge = neutralPlanets.filter(p => p.maxShips > 115);
          if (anyLarge.length > 0) {
            anyLarge.sort((a, b) => a.maxShips - b.maxShips);
            targetPlanet = anyLarge[0];
          } else {
            // Fallback 2: highest maxShips overall
            neutralPlanets.sort((a, b) => b.maxShips - a.maxShips);
            targetPlanet = neutralPlanets[0];
          }
        }
      }
    }

    if (targetPlanet) {
      targetPlanet.owner = player;
      targetPlanet.ships = targetPlanet.maxShips;
      targetPlanet.justAssigned = true;
      targetPlanet.justAssignedTimer = 0;
      targetPlanet.homeworldOf = player.id;
      targetPlanet.focusMode = 'economy';
      
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
        
        const extraPlanets = remainingNeutral.slice(0, 2);
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
      return true;
    }
    return false;
  }

  initMap() {
    this.planets = [];
    this.ships = [];
    this.explosions = [];
    this.lasers = [];
    this.ionStorms = [];
    this.ionStormSpawnTimer = 0;
    this.ionStormDamageTimer = 0;
    this.ionStormsCreated = 0;
    this.nextShipId = 1;
    this.gameTime = 0;
    this.timeRemaining = null;
    let rampageDelayMultiple = 1.0;
    if (this.width < 1600) {
      rampageDelayMultiple = 1600 / this.width;
    }
    this.rampageInterval = Math.round(900000 * rampageDelayMultiple);
    this.nextRampageTime = this.rampageInterval;
    this.scheduledAttacks = [];
    
    // Reset player states
    for (const player of this.allPlayers) {
      player.techScore = 0;
      player.expScore = 0;
      player.cruiserStyle = null;
      player.prevTechBonus = 0;
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
    }

    // Reset global upgrade modifiers
    this.globalUpgradeModifiers = {
      sensorarray: -0.25,
      lab: -0.25,
      armor: -0.25,
      shield: -0.25,
      engine: -0.25,
      munitions: -0.25,
      targeting: -0.25,
      damagecontrol: -0.25,
      fueltanker: -0.25,
      diplomat: -0.25,
      marines: -0.25
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

    for (let i = 0; i < numPlanets; i++) {
      let x, y, radius;
      let valid = false;
      let attempts = 0;
      
      while (!valid && attempts < 100) {
        let generatedMaxShips;
        if (i < countMegaSuper) {
          generatedMaxShips = 300; // Mega Super planet
        } else if (i < countMegaSuper + countSuper) {
          if (width < 1600) {
            generatedMaxShips = 200 + Math.floor(Math.random() * 21); // Super planet (small map)
          } else {
            generatedMaxShips = 250; // Super planet (normal/large map)
          }
        } else if (i < countMegaSuper + countSuper + countLarge) {
          generatedMaxShips = 150 + Math.floor(Math.random() * 31); // Large planets 150-180
        } else if (i < countMegaSuper + countSuper + countLarge + countMedium) {
          generatedMaxShips = 120 + Math.floor(Math.random() * 31); // Medium planets 120-150
        } else if (i < countMegaSuper + countSuper + countLarge + countMedium + countSmall) {
          generatedMaxShips = 75 + Math.floor(Math.random() * 41); // Small planets 75-115
        } else {
          generatedMaxShips = 53 + Math.floor(Math.random() * 22); // Tiny planets 53-74
        }
        radius = generatedMaxShips / 4;
        x = radius + Math.random() * (width - radius * 2);
        y = radius + Math.random() * (height - radius * 2);
        
        valid = true;

        if (valid) {
          for (const p of this.planets) {
            const dx = p.x - x;
            const dy = p.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < p.radius + radius + 25) {
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
          variance = expectedShips * 0.15; // Randomize slightly
        }

        let initialShips = Math.floor(expectedShips + (Math.random() * 2 - 1) * variance);
        initialShips = Math.max(1, initialShips);
        const newPlanet = new Planet(i, x, y, radius, null, initialShips);
        if (i < countMegaSuper + countSuper) newPlanet.isSuperPlanet = true;
        this.planets.push(newPlanet);
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
    const numMinefields = Math.round((Math.random() * 2) * hazardScale);
    for (let m = 0; m < numMinefields; m++) {
      const mRadius = ((50 + Math.random() * 350) * 0.75) * hazardScale; // 25% smaller
      this.ionStorms.push({
        id: this.nextIonStormId++,
        name: 'Ancient Minefield',
        type: 'minefield',
        x: mRadius + Math.random() * (this.width - mRadius * 2),
        y: mRadius + Math.random() * (this.height - mRadius * 2),
        radius: mRadius,
        intensity: (() => { let v = 0; for(let d=0; d<12; d++) v += Math.floor(Math.random()*6)+1; return v; })(),
        speed: 0,
        heading: 0,
        knowledge: {}
      });
    }

    // Create Nebulae
    const numNebulae = Math.round((Math.random() * 2) * hazardScale);
    for (let n = 0; n < numNebulae; n++) {
      const nRadius = ((50 + Math.random() * 350) * 1.3) * hazardScale; // 30% larger
      this.ionStorms.push({
        id: this.nextIonStormId++,
        name: hazardNames[Math.floor(Math.random() * hazardNames.length)],
        type: 'nebula',
        x: nRadius + Math.random() * (this.width - nRadius * 2),
        y: nRadius + Math.random() * (this.height - nRadius * 2),
        radius: nRadius,
        intensity: (() => { let v = 0; for(let d=0; d<10; d++) v += Math.floor(Math.random()*8)+1; return v; })(),
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
      const radius = (50 + Math.random() * 350) * hazardScale;
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
      if ((source.isMilitary || source.homeworldOf) && source.ships > 60 && source.maxShips > 60) {
        const basePower = Math.floor(source.ships / 25);
        const costShips = Math.floor(source.ships / 2);
        const costCap = basePower * 2;
        const maxHealth = Math.floor(costShips / 3);
        if (source.ships >= costShips && source.maxShips > costCap) {
          source.ships -= costShips;
          source.decreaseMaxShips(costCap);
          const ship = new Ship(this.nextShipId++, source.x, source.y, target, source.owner);
          ship.maxHealth = maxHealth;
          ship.health = maxHealth;
          ship.crew = 2 * maxHealth;
          ship.fuel = basePower;
          ship.speed = Math.max(5, ship.speed - 10 - basePower);
          ship.speedModifier = 1.0;
          if (!source.owner.cruiserStyle) {
            const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
            if (!source.owner.isAI) {
              const assignedStyles = this.allPlayers
                .filter(p => !p.isAI && p.cruiserStyle)
                .map(p => p.cruiserStyle);
              const unusedStyles = styles.filter(s => !assignedStyles.includes(s));
              if (unusedStyles.length > 0) {
                source.owner.cruiserStyle = unusedStyles[Math.floor(Math.random() * unusedStyles.length)];
              } else {
                source.owner.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
              }
            } else {
              source.owner.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
            }
            console.log(`Assigned ${source.owner.cruiserStyle} style to ${source.owner.id}`);
          }
          ship.isCruiser = true;
          ship.count = 1;
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
    if (source.ships < launchCost + 1) return;
    
    source.ships -= launchCost;
    let shipsToSend;
    const isReinforcing = source.owner && target && target.owner && source.owner.id === target.owner.id;
    if (isReinforcing && !isBombing) {
      if (target.ships >= target.maxShips) {
        shipsToSend = 0;
      } else {
        const fillNeeded = target.maxShips - target.ships;
        if (source.ships >= fillNeeded) {
          shipsToSend = fillNeeded;
        } else {
          shipsToSend = Math.floor(source.ships / 2);
        }
      }
      // Never leave source planet with less than 10 ships
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

    if (shipsToSend <= 0) {
      source.ships += launchCost; // revert cost
      return;
    }
    
    source.ships -= shipsToSend;
    
    if (source.rampageEvent) {
      source.decreaseMaxShips(1);
      if (source.maxShips < 55) source.dead = true;
    }
    
    if (isBombing) {
      if (!source.isMilitary) {
        isBombing = false;
      } else {
        shipsToSend = Math.floor(shipsToSend / 3);
        if (shipsToSend <= 0) return;
        source.decreaseMaxShips(1);
        if (source.maxShips < 10) source.dead = true;
      }
    }
    
    // Spawn fleet represented as a single Ship entity
    const ship = new Ship(this.nextShipId++, source.x, source.y, target, source.owner);
    ship.count = shipsToSend;
    if (source.isSpeedPlanet) ship.speed += 15;
    ship.speedModifier = speedModifier !== null ? speedModifier : 1.0;
    ship.sourcePlanet = source;
    ship.expScore = source.expScore || 0;
    ship.bomberOffsetMag = 0;
    
    if (isBombing) {
      ship.isBomber = true;
      ship.bomberType = isBombing; // 'eco' or 'ships'
      ship.speed = 20;
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
        ship.count -= explodedCount;
        if (!this.explosions) this.explosions = [];
        this.explosions.push({
          x: ship.x,
          y: ship.y,
          color: '#add8e6',
          age: 0,
          isMassive: explodedCount > 10
        });
      }
      if (ship.count <= 0) {
        return true; // Whole fleet exploded
      }
    } else {
      if (Math.random() < explodeChance) {
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
            ship.health -= 1;
          }
          if (ship.health <= 0) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    
    ship.isWarp = true;
    let planetCount = 0;
    for (const p of this.planets) {
      if (p.owner && p.owner.id === player.id) planetCount++;
    }
    ship.warpBonus = Math.max(10, 30 - planetCount);
    return false;
  }

  sendShipsToSpace(source, targetX, targetY, isWarp = false, speedModifier = null, isBombing = false, scoutMode = false, isCruiserOrder = false) {
    if (source) source.retainedShips = false;

    if (isCruiserOrder) {
      if ((source.isMilitary || source.homeworldOf) && source.ships > 60 && source.maxShips > 60) {
        const health = Math.floor(source.ships / 25);
        const costShips = health * 15;
        const costCap = health * 2;
        if (source.ships >= costShips && source.maxShips > costCap) {
          const cruiserMaxHealth = Math.floor(source.ships / 5);
          source.ships -= costShips;
          source.decreaseMaxShips(costCap);
          const ship = new Ship(this.nextShipId++, source.x, source.y, null, source.owner, targetX, targetY);
          ship.maxHealth = cruiserMaxHealth;
          ship.health = cruiserMaxHealth;
          ship.crew = 2 * cruiserMaxHealth;
          ship.fuel = health;
          ship.speed = Math.max(5, ship.speed - 10 - health);
          ship.speedModifier = 1.0;
          if (!source.owner.cruiserStyle) {
            const styles = ['Federation', 'Romulan', 'Klingon', 'Gorn', 'Tholian', 'Lyran'];
            if (!source.owner.isAI) {
              const assignedStyles = this.allPlayers
                .filter(p => !p.isAI && p.cruiserStyle)
                .map(p => p.cruiserStyle);
              const unusedStyles = styles.filter(s => !assignedStyles.includes(s));
              if (unusedStyles.length > 0) {
                source.owner.cruiserStyle = unusedStyles[Math.floor(Math.random() * unusedStyles.length)];
              } else {
                source.owner.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
              }
            } else {
              source.owner.cruiserStyle = styles[Math.floor(Math.random() * styles.length)];
            }
          }
          ship.isCruiser = true;
          ship.count = 1;
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
    if (source.ships < launchCost + 1) return;
    
    source.ships -= launchCost;
    let shipsToSend = scoutMode ? Math.max(3, Math.floor(source.ships * 0.1)) : Math.floor(source.ships / 2);
    shipsToSend = Math.min(shipsToSend, source.ships);
    
    if (source.rampageEvent) {
      const minReserve = source.maxShips * 0.75;
      if (source.ships - shipsToSend < minReserve) {
        shipsToSend = Math.floor(source.ships - minReserve);
      }
    }
    
    shipsToSend = Math.min(250, shipsToSend);

    if (shipsToSend <= 0) {
      source.ships += launchCost; // revert cost
      return;
    }
    
    source.ships -= shipsToSend;
    
    if (source.rampageEvent) {
      source.decreaseMaxShips(1);
      if (source.maxShips < 55) source.dead = true;
    }
    
    if (isBombing) {
      if (!source.isMilitary) {
        isBombing = false;
      } else {
        shipsToSend = Math.floor(shipsToSend / 3);
        if (shipsToSend <= 0) return;
        source.decreaseMaxShips(1);
        if (source.maxShips < 10) source.dead = true;
      }
    }
    
    // Spawn fleet represented as a single Ship entity
    const ship = new Ship(this.nextShipId++, source.x, source.y, null, source.owner, targetX, targetY);
    ship.count = shipsToSend;
    if (source.isSpeedPlanet) ship.speed += 15;
    const spaceDx = targetX - source.x;
    const spaceDy = targetY - source.y;
    const spaceDist = Math.sqrt(spaceDx * spaceDx + spaceDy * spaceDy);
    ship.speedModifier = speedModifier !== null ? speedModifier : 1.0;
    ship.sourcePlanet = source;
    ship.expScore = source.expScore || 0;
    ship.bomberOffsetMag = 0;
    
    if (isBombing) {
      ship.isBomber = true;
      ship.bomberType = isBombing;
      ship.speed = 20;
    }
    if (isWarp) {
      if (this.applyWarpToShip(ship, source.owner)) {
         return; // Exploded!
      }
    }
    this.ships.push(ship);
  }

  moveShipsToSpace(player, shipIds, targetX, targetY, isWarp = false, speedModifier = null) {
    const validShips = shipIds.map(id => this.ships.find(s => s.id === id)).filter(s => s && s.owner && s.owner.id === player.id && !s.isUpgrading);
    const cruisers = validShips.filter(s => s.isCruiser);
    const numCruisers = cruisers.length;

    for (let i = 0; i < numCruisers; i++) {
      const ship = cruisers[i];
      ship.targetPlanet = null;
      ship.cruiserTargetOffsetX = 0;
      ship.cruiserTargetOffsetY = 0;
      if (numCruisers === 1) {
        ship.targetX = targetX;
        ship.targetY = targetY;
      } else {
        const theta = i * 2.39996; // Golden angle
        const r = 35 * Math.sqrt(i);
        ship.targetX = targetX + r * Math.cos(theta);
        ship.targetY = targetY + r * Math.sin(theta);
      }
    }

    for (const ship of validShips) {
      if (!ship.isCruiser) {
        ship.targetPlanet = null;
        ship.targetX = targetX + (Math.random() - 0.5) * 30;
        ship.targetY = targetY + (Math.random() - 0.5) * 30;
      }
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

  moveShipsToPlanet(player, shipIds, targetPlanet, isWarp = false, speedModifier = null) {
    const validShips = shipIds.map(id => this.ships.find(s => s.id === id)).filter(s => s && s.owner && s.owner.id === player.id && !s.isUpgrading);
    const cruisers = validShips.filter(s => s.isCruiser);
    const numCruisers = cruisers.length;

    for (let i = 0; i < numCruisers; i++) {
      const ship = cruisers[i];
      ship.targetPlanet = targetPlanet;
      ship.targetX = null;
      ship.targetY = null;
      if (numCruisers === 1) {
        ship.cruiserTargetOffsetX = 0;
        ship.cruiserTargetOffsetY = 0;
      } else {
        const theta = i * 2.39996; // Golden angle
        const r = 35 * Math.sqrt(i);
        ship.cruiserTargetOffsetX = r * Math.cos(theta);
        ship.cruiserTargetOffsetY = r * Math.sin(theta);
      }
    }

    for (const ship of validShips) {
      if (!ship.isCruiser) {
        ship.targetPlanet = targetPlanet;
        ship.targetX = null;
        ship.targetY = null;
      }
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
      if ((planet.revoltCooldown || 0) > 0) continue;
      if (!planet.sympathy) continue;

      const threshold = planet.ships / 3;

      const eligibleNonOwners = [];
      for (const [pId, symVal] of Object.entries(planet.sympathy)) {
        const isNotOwner = !planet.owner || pId !== planet.owner.id;
        if (isNotOwner && symVal > threshold) {
          eligibleNonOwners.push({ id: pId, sympathy: symVal });
        }
      }

      if (eligibleNonOwners.length > 0) {
        const competitors = [];

        if (planet.owner) {
          const ownerSym = planet.sympathy[planet.owner.id] || 0;
          const maxRoll = planet.ships + ownerSym;
          const rollVal = Math.floor(Math.random() * (maxRoll + 1));
          competitors.push({ id: planet.owner.id, roll: rollVal, isOwner: true });
        }

        for (const competitor of eligibleNonOwners) {
          const maxRoll = competitor.sympathy;
          const rollVal = Math.floor(Math.random() * (maxRoll + 1));
          competitors.push({ id: competitor.id, roll: rollVal, isOwner: false });
        }

        competitors.sort((a, b) => b.roll - a.roll);
        const winner = competitors[0];

        if (winner && !winner.isOwner) {
          const winnerPlayer = this.allPlayers.find(p => p.id === winner.id);
          if (winnerPlayer) {
            const oldShips = planet.ships;
            const originalOwner = planet.owner;

            planet.owner = winnerPlayer;

            const sympathyConsumed = Math.floor(oldShips / 3);
            planet.sympathy[winnerPlayer.id] = Math.max(0, (planet.sympathy[winnerPlayer.id] || 0) - sympathyConsumed);

            planet.revoltCooldown = 180000;
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

            // Queue a chat message for the player who wins the revolt
            this.pendingChatMessages = this.pendingChatMessages || [];
            this.pendingChatMessages.push({
              playerId: winnerPlayer.id,
              text: `Your subverters succeeded! Planet ${planet.name} has revolted and joined your empire!`
            });

            console.log(`[REVOLT] Planet ${planet.name} revolted through competitive roll and joined player ${winnerPlayer.name}`);
          }
        }
      }
    }
  }

  update(deltaTime) {
    this.revoltCheckTimer = (this.revoltCheckTimer || 0) + deltaTime;
    if (this.revoltCheckTimer >= 60000) {
      this.revoltCheckTimer -= 60000;
      this.checkSympathyRevolts();
    }

    this.gameTime += deltaTime;

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
    } else if (this.gameTime >= this.nextRampageTime) {
      this.rampageInterval = Math.max(360000, this.rampageInterval - 180000);
      this.nextRampageTime = this.gameTime + this.rampageInterval;
      const unusedAIs = this.aiPlayers.filter(p => !this.planets.some(pl => pl.owner === p));
      if (unusedAIs.length > 0) {
        const neutralPlanets = this.planets.filter(p => p.owner === null);
        if (neutralPlanets.length > 0) {
          const rampageAI = unusedAIs[0];
          const above150 = neutralPlanets.filter(p => p.maxShips > 150);
          let target;
          if (above150.length > 0) {
            above150.sort((a, b) => a.maxShips - b.maxShips); // smallest first
            target = above150[0];
          } else {
            neutralPlanets.sort((a, b) => b.maxShips - a.maxShips); // largest first
            target = neutralPlanets[0];
          }
          target.owner = rampageAI;
          rampageAI.isRampager = true;
          target.ships += target.maxShips * 3;
          target.rampageEvent = true;
          target.rampageBoost = true;
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
        const radius = (50 + Math.random() * 350) * hazardScaleUpdate;
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

    // Ion Storm knowledge accumulation (ships with labs are the primary method of gaining knowledge now)
    for (const storm of this.ionStorms) {
      for (const player of this.allPlayers) {
        if (!player.isAlive) continue;
        let overlapCount = 0;
        for (const ship of this.ships) {
          if (ship.active && ship.isCruiser && ship.owner && ship.owner.id === player.id && ship.labs > 0) {
            let cruiserRadar = Math.min(250, 5 * ship.maxHealth);
            if (ship.isWarp) cruiserRadar *= 0.25;
            if (ship.sensorarrays > 0) {
              let mult = 1.0;
              mult += 0.50;
              if (ship.sensorarrays > 1) {
                mult += 0.25;
              }
              if (ship.sensorarrays > 2) {
                mult += 0.25;
              }
              cruiserRadar *= mult;
            }
            const shipXpBonus = Math.sqrt(ship.expScore || 0);
            const finalCruiserRadar = cruiserRadar * (100 + shipXpBonus * 3) / 100;

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

    // Ion Storm / Minefield ship damage (every second, chance/10) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â skip nebulae
    this.ionStormDamageTimer += deltaTime;
    if (this.ionStormDamageTimer >= 1000) {
      this.ionStormDamageTimer -= 1000;
      for (const storm of this.ionStorms) {
        if (storm.type === 'nebula') continue;
        const explosionColor = storm.type === 'minefield' ? '#44f' : '#ff0';
        for (const ship of this.ships) {
          if (!ship.active || !ship.owner) continue;
          if (ship.isAmoeba) continue;
          
          if (storm.type === 'minefield') {
            let isMoving = true;
            if (ship.targetPlanet) {
              const dx = ship.targetPlanet.x - ship.x;
              const dy = ship.targetPlanet.y - ship.y;
              if (Math.sqrt(dx * dx + dy * dy) <= ship.targetPlanet.radius + 1) {
                isMoving = false;
              }
            } else if (ship.targetX !== undefined && ship.targetY !== undefined) {
              const dx = ship.targetX - ship.x;
              const dy = ship.targetY - ship.y;
              if (Math.sqrt(dx * dx + dy * dy) < 5) {
                isMoving = false;
              }
            }
            if (!isMoving) continue;
          }
          const dx = ship.x - storm.x;
          const dy = ship.y - storm.y;
          if (dx * dx + dy * dy <= storm.radius * storm.radius) {
            const knowledge = storm.knowledge[ship.owner.id] || 0;
            const techRed = Math.sqrt(ship.owner.techScore || 0);
            const expRed = Math.sqrt(ship.owner.expScore || 0);
            const shipExpRed = Math.sqrt(ship.expScore || 0);
            const effectiveIntensity = storm.intensity - knowledge - (techRed + expRed) / 2 - shipExpRed;
            const damageChance = Math.max(0, effectiveIntensity / 1000);

            if (ship.maxHealth > 0) {
              // CruiserException: Retains dynamic 1d6 damage on damageChance failure
              if (damageChance > 0 && Math.random() < damageChance) {
                ship.takeDamage(this.explosions, null, true);
                // Lightning bolt effect
                const boltX = ship.x + (Math.random() - 0.5) * 80;
                const boltY = ship.y - 30 - Math.random() * 50;
                const midX = (ship.x + boltX) / 2 + (Math.random() - 0.5) * 40;
                const midY = (ship.y + boltY) / 2 + (Math.random() - 0.5) * 20;
                this.lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
                this.lasers.push({ startX: midX, startY: midY, endX: ship.x, endY: ship.y, color: explosionColor, age: 0, duration: 0.4 });
              }
            } else {
              // Standard fleet tick checks: 1/10th that rate per second afterward
              let destroyedCount = 0;
              const initialCount = ship.count;
              for (let i = 0; i < initialCount; i++) {
                if (Math.random() < damageChance) {
                  if (!ship.checkSurvivalRoll()) {
                    destroyedCount++;
                  }
                }
              }
              if (destroyedCount > 0) {
                ship.count -= destroyedCount;
                if (ship.count <= 0) {
                  ship.count = 0;
                  ship.active = false;
                }
                this.explosions.push({ x: ship.x, y: ship.y, color: explosionColor, age: 0 });
                // Lightning bolt effect
                const boltX = ship.x + (Math.random() - 0.5) * 80;
                const boltY = ship.y - 30 - Math.random() * 50;
                const midX = (ship.x + boltX) / 2 + (Math.random() - 0.5) * 40;
                const midY = (ship.y + boltY) / 2 + (Math.random() - 0.5) * 20;
                this.lasers.push({ startX: boltX, startY: boltY, endX: midX, endY: midY, color: explosionColor, age: 0, duration: 0.4 });
                this.lasers.push({ startX: midX, startY: midY, endX: ship.x, endY: ship.y, color: explosionColor, age: 0, duration: 0.4 });
              }
            }
          }
        }
        
        if (storm.type !== 'minefield') {
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
                if (planet.ships > planet.maxShips) planet.ships = planet.maxShips;
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
      }
    }
    
    for (const planet of this.planets) {
        planet.update(deltaTime, this.planets, this.settings);
    }
    
    for (const ship of this.ships) {
      if (ship.targetPlanet && ship.targetPlanet.dead) {
        ship.active = false;
        continue;
      }
      ship.update(deltaTime, this.ships, this.explosions, this.planets, this.lasers, this.ionStorms, this.width);
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
        const expBonus = 0.5 * Math.sqrt(ship.owner ? (ship.owner.expScore || 0) : 0);
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
        if (victim.owner) victim.owner.addExperience(1);
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
      if (this.explosions[i].age > 1.0) {
        this.explosions.splice(i, 1);
      }
    }
    
    // Update and remove lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].age += deltaTime / 1000;
      if (this.lasers[i].age > this.lasers[i].duration) {
        const laser = this.lasers[i];
        if (laser.color === 'cruiser-projectile') {
          if (laser.destroysDefender) {
            if (laser.targetPlanetId !== undefined) {
              const targetPlanet = this.planets.find(pl => pl.id === laser.targetPlanetId);
              if (targetPlanet && targetPlanet.ships > 0) {
                targetPlanet.ships -= 1;
                if (laser.splashDamage && laser.splashDamage > 0) {
                  const splashLimit = Math.floor(targetPlanet.ships / 50);
                  const splash = Math.min(laser.splashDamage, splashLimit);
                  const toDestroy = Math.min(targetPlanet.ships, splash);
                  targetPlanet.ships -= toDestroy;
                }
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
                sourceShip.expScore = (sourceShip.expScore || 0) + 0.05;
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
    
    // Award tech score to cruisers with laboratories in sensor range when an amoeba dies
    for (const ship of this.ships) {
      if (!ship.active && ship.isAmoeba) {
        for (const cruiser of this.ships) {
          if (cruiser.active && cruiser.isCruiser && cruiser.labs > 0 && cruiser.owner) {
            const dx = cruiser.x - ship.x;
            const dy = cruiser.y - ship.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate Cruiser sensor range including experience & player modifiers
            let cruiserRadar = Math.min(250, 5 * cruiser.maxHealth);
            if (cruiser.isWarp) cruiserRadar *= 0.25;
            if (cruiser.sensorarrays > 0) {
              let mult = 1.0;
              mult += 0.50;
              if (cruiser.sensorarrays > 1) {
                mult += 0.25;
              }
              if (cruiser.sensorarrays > 2) {
                mult += 0.25;
              }
              cruiserRadar *= mult;
            }
            const playerTechBonus = 0.01 * Math.sqrt(cruiser.owner.techScore || 0);
            const playerExpBonus = 0.01 * Math.sqrt(cruiser.owner.expScore || 0);
            const baseRange = cruiserRadar * (1 + playerTechBonus + playerExpBonus);
            const shipXpBonus = Math.sqrt(cruiser.expScore || 0);
            const sensorRange = baseRange * (100 + shipXpBonus * 3) / 100;
            
            if (dist <= sensorRange) {
              const techGain = cruiser.labs;
              cruiser.owner.techScore = (cruiser.owner.techScore || 0) + techGain;
              cruiser.beakerIncreaseEvent = (cruiser.beakerIncreaseEvent || 0) + techGain;
            }
          }
        }
      }
    }

    // Remove inactive ships and dead planets
    this.ships = this.ships.filter(s => s.active);
    
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
      }
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
                if (nearby.owner !== null && nearby.ships > nearby.maxShips) nearby.ships = nearby.maxShips;
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
            player.upgradeModifiers[chosenType] -= 0.10;
          } else if (zeroUpgradeTypes.length > 0) {
            chosenType = zeroUpgradeTypes[Math.floor(Math.random() * zeroUpgradeTypes.length)];
            player.upgradeModifiers[chosenType] -= 0.10;
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

    if (this.onScoreUpdate) {
      const pCount = this.planets.filter(p => p.owner === this.humanPlayer).length;
      const aiCount = this.planets.filter(p => p.owner && p.owner !== this.humanPlayer).length;
      this.onScoreUpdate(pCount, aiCount);
    }
  }

  updateCustomCruiserSystems(dt) {
    if (!this.isRunning || this.isPaused) return;

    // 1. Update Boarding Pods, Return Pods, and active Cruisers
    const cruisers = this.ships.filter(s => s.active && s.isCruiser);
    const pods = this.ships.filter(s => s.active && (s.isBoardingFleet || s.isReturnPod));

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

      // 2. Crew restoration
      // "not within sensor range of enemy vessels automatically restore crew at no cost at the rate of 1 per second"
      let enemyNearby = false;
      const radar = ship.cruiserRadarRange();
      for (const other of this.ships) {
        if (other.active && other.id !== ship.id) {
          const isEnemy = (other.owner && other.owner.id !== ship.owner.id) || other.isAmoeba;
          if (isEnemy) {
            const dx = other.x - ship.x;
            const dy = other.y - ship.y;
            if (dx*dx + dy*dy <= radar * radar) {
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
            const gr = p.getGravityRadius();
            if (pdx*pdx + pdy*pdy < gr * gr) {
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
        ship.diplomatTargetPlanetId = null;
        // Find all qualifying neutral/enemy planets within sensor range that are not at max empathy/sympathy
        const qualifyingPlanets = [];
        for (const p of this.planets) {
          const isNeutralOrEnemy = !p.owner || p.owner.id !== ship.owner.id;
          if (isNeutralOrEnemy) {
            const dx = p.x - ship.x;
            const dy = p.y - ship.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= radar) {
              const currentSym = p.sympathy ? (p.sympathy[ship.owner.id] || 0) : 0;
              const isMaxEmpathy = currentSym >= p.maxShips;
              if (!isMaxEmpathy) {
                qualifyingPlanets.push({ planet: p, dist: dist });
              }
            }
          }
        }

        let closestPlanet = null;
        if (qualifyingPlanets.length > 0) {
          const closeQualifying = qualifyingPlanets.filter(qp => qp.dist <= 100);
          if (closeQualifying.length > 0) {
            // Exception: select the closest qualifying planet within 100px
            let minDist = Infinity;
            for (const qp of closeQualifying) {
              if (qp.dist < minDist) {
                minDist = qp.dist;
                closestPlanet = qp.planet;
              }
            }
          } else {
            // General Rule: choose the one with the highest disposition (break ties by distance)
            let highestDisp = -1;
            let closestDistForHighestDisp = Infinity;
            for (const qp of qualifyingPlanets) {
              const disp = qp.planet.disposition ? (qp.planet.disposition[ship.owner.id] || 0) : 0;
              if (disp > highestDisp) {
                highestDisp = disp;
                closestDistForHighestDisp = qp.dist;
                closestPlanet = qp.planet;
              } else if (disp === highestDisp) {
                if (qp.dist < closestDistForHighestDisp) {
                  closestDistForHighestDisp = qp.dist;
                  closestPlanet = qp.planet;
                }
              }
            }
          }
        }

        if (closestPlanet) {
          ship.diplomatTargetPlanetId = closestPlanet.id;
          ship.diplomatTimer = (ship.diplomatTimer || 0) + dt;
          const attemptInterval = 60 / ship.diplomat;
          if (ship.diplomatTimer >= attemptInterval) {
            ship.diplomatTimer -= attemptInterval;

            // XP Bonus: sqrt( XP score )
            const expBonus = Math.sqrt(ship.owner.expScore || 0);
            const shipExpBonus = Math.sqrt(ship.expScore || 0);
            const currentSym = closestPlanet.sympathy ? (closestPlanet.sympathy[ship.owner.id] || 0) : 0;
            // Success rate: (30 + player XP bonus * 3 + ship XP bonus * 3 + current player sympathy)%
            const chancePercent = 30 + expBonus * 3 + shipExpBonus * 3 + currentSym;
            const prob = chancePercent / 100;

            if (Math.random() < prob) {
              // Award 1 XP score to player
              ship.owner.expScore = (ship.owner.expScore || 0) + 1;

              closestPlanet.sympathy = closestPlanet.sympathy || {};
              closestPlanet.disposition = closestPlanet.disposition || {};

              // Roll disposition if not yet set
              if (closestPlanet.disposition[ship.owner.id] === undefined) {
                const d20 = Math.floor(Math.random() * 20) + 1;
                closestPlanet.disposition[ship.owner.id] = Math.floor((d20 + expBonus + shipExpBonus) / 6);
              }

              const disp = closestPlanet.disposition[ship.owner.id];
              const increaseAmt = 1 + Math.floor(Math.random() * (disp + 1));

              const newSym = Math.min(closestPlanet.maxShips, currentSym + increaseAmt);
              const actualIncrease = newSym - currentSym;

              // Give ship XP score equal to the sympathy created
              ship.expScore = (ship.expScore || 0) + actualIncrease;

              closestPlanet.sympathy[ship.owner.id] = newSym;
              
              ship.diplomatSuccessEvent = (ship.diplomatSuccessEvent || 0) + 1;
            } else {
              ship.diplomatFailureEvent = (ship.diplomatFailureEvent || 0) + 1;
            }
          }
        }
      }

      // 4b. Marine Planet Attack Check
      if ((ship.marineCount || 0) > 0) {
        // Find an enemy or neutral planet within sensor range
        let targetPlanet = null;
        for (const p of this.planets) {
          const isNeutralOrEnemy = !p.owner || p.owner.id !== ship.owner.id;
          if (isNeutralOrEnemy) {
            const dx = p.x - ship.x;
            const dy = p.y - ship.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= radar) {
              // Check if marine count > triple the planet's defending ships
              if (ship.marineCount > 3 * p.ships) {
                targetPlanet = p;
                break;
              }
            }
          }
        }

        if (targetPlanet) {
          // Launch standard fleet representing the marines
          const marineFleet = new Ship(this.nextShipId++, ship.x, ship.y, targetPlanet, ship.owner);
          marineFleet.count = Math.floor(ship.marineCount);
          marineFleet.speedModifier = 1.0;
          marineFleet.expScore = ship.expScore || 0;
          this.ships.push(marineFleet);

          console.log(`[MARINE PLANET INVASION] Cruiser ${ship.id} launched a fleet of ${marineFleet.count} marines to attack target planet ${targetPlanet.name}.`);
          ship.marineCount = 0;
        }
      }

      // 5. Boarding Trigger Checks
      // alone, enemy cruiser in 1/2 sensor range, marine count >= 2 * enemy crew
      if ((ship.marineCount || 0) > 0) {
        // check alone (no friendly cruisers in scan range)
        let friendlyCruiserNearby = false;
        for (const other of cruisers) {
          if (other.id !== ship.id && other.owner.id === ship.owner.id) {
            const dx = other.x - ship.x;
            const dy = other.y - ship.y;
            if (dx*dx + dy*dy <= radar * radar) {
              friendlyCruiserNearby = true;
              break;
            }
          }
        }

        if (!friendlyCruiserNearby) {
          // Find enemy cruiser in 1/2 scan range
          for (const enemy of cruisers) {
            if (enemy.owner.id !== ship.owner.id) {
              const dx = enemy.x - ship.x;
              const dy = enemy.y - ship.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist <= 0.5 * radar) {
                const requiredMarines = 2 * (enemy.crew || 0);
                if (ship.marineCount >= requiredMarines && requiredMarines > 0) {
                  // Launch Boarding Fleet Pod!
                  const pod = new Ship(this.nextShipId++, ship.x, ship.y, null, ship.owner, enemy.x, enemy.y);
                  pod.isBoardingFleet = true;
                  pod.targetShipId = enemy.id;
                  pod.sourceShipId = ship.id;
                  pod.marineCount = ship.marineCount;
                  pod.speed = 60; // moves at fast pace
                  pod.isCruiser = false; // it is drawn uniquely, not as a cruiser body!
                  this.ships.push(pod);

                  console.log(`[BOARDING] Ship ${ship.id} launched pod targeting Ship ${enemy.id} carrying ${ship.marineCount} marines.`);
                  ship.marineCount = 0;
                  break;
                }
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
      if (planet.owner) {
        const mapScale = this.width > 1600 ? this.width / 1600 : 1.0;
        const gravityRadius = planet.getGravityRadius(mapScale);
        
        this.ctx.beginPath();
        this.ctx.arc(planet.x, planet.y, gravityRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = planet.owner.color;
        this.ctx.globalAlpha = 0.15;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 10]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
      }
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
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.width, this.height);
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
