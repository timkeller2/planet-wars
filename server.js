import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Game } from './src/game.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    app.use(express.static(path.join(__dirname, 'dist')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 1000
        }
      },
      appType: 'spa'
    });
    
    app.use(vite.middlewares);
  }

  // Initialize server game instance
  let game = new Game({ width: 1920, height: 1620 });
  game.initMap();
  game.gameStartTime = Date.now();
  game.isRunning = true;
  game.settings = null;
  
  const connectedClients = new Map(); // socket.id -> player reference

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    const clientId = socket.handshake.query.playerId;
    let assignedPlayer = game.allPlayers.find(p => p.clientPlayerId === clientId);

    if (!assignedPlayer) {
      if (!game.humanPlayer.clientPlayerId) {
        assignedPlayer = game.humanPlayer;
        assignedPlayer.clientPlayerId = clientId;
        assignedPlayer.isAI = false;
        assignedPlayer.lastCommandTime = Date.now();
      } else {
        const availableExtendedAI = game.aiPlayers.slice(11).find(ai => !ai.clientPlayerId && game.planets.filter(p => p.owner === ai).length === 0);
        if (availableExtendedAI) {
          if (game.assignPlanet(availableExtendedAI)) {
            availableExtendedAI.clientPlayerId = clientId;
            availableExtendedAI.isAI = false;
            availableExtendedAI.lastCommandTime = Date.now();
            assignedPlayer = availableExtendedAI;
          }
        }
      }
    } else {
      assignedPlayer.isAI = false;
      assignedPlayer.lastCommandTime = Date.now();
    }
    
    if (assignedPlayer) {
      assignedPlayer.lastCommandTime = Date.now();
      connectedClients.set(socket.id, assignedPlayer);
      socket.emit('assignedPlayer', assignedPlayer);
    } else {
      // Spectator
      socket.emit('spectator');
    }

    socket.on('sendShips', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
        console.log(`Player ${player.id} issued a command, returning control`);
      }

      const sourcePlanet = game.planets.find(p => p.id === data.sourceId);
      const targetPlanet = game.planets.find(p => p.id === data.targetId);
      if (sourcePlanet && targetPlanet && sourcePlanet.owner && sourcePlanet.owner.id === player.id) {

        game.sendShips(sourcePlanet, targetPlanet, data.isWarp, data.speedModifier, data.isBombing, data.fillAmount, data.scoutMode, data.isInterceptor, data.isCruiser);
      }
    });

    socket.on('sendShipsToSpace', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }

      const sourcePlanet = game.planets.find(p => p.id === data.sourceId);

      if (sourcePlanet && sourcePlanet.owner && sourcePlanet.owner.id === player.id) {
        game.sendShipsToSpace(sourcePlanet, data.targetX, data.targetY, data.isWarp, data.speedModifier, data.isBombing, data.scoutMode, data.isInterceptor, data.isCruiser);
      }
    });

    socket.on('upgradeCruiser', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }

      const ship = game.ships.find(s => s.id === data.shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        // Find if this cruiser is within a friendly gravity well of a planet with over 100 ships
        for (const p of game.planets) {
          if (p.owner && p.owner.id === player.id && p.ships > 100) {
            const techBonus = 0.01 * Math.sqrt(player.techScore || 0);
            const expBonus = 0.005 * Math.sqrt(player.expScore || 0);
            const gravityRadius = (p.maxShips * 1.5) * (1 + techBonus + expBonus);
            
            let penaltyPct = 0;
            for (const h of game.ionStorms) {
              if (h.type === 'minefield') continue;
              const hdx = p.x - h.x, hdy = p.y - h.y;
              if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
                const k = h.knowledge[player.id] || 0;
                const tR = Math.sqrt(player.techScore || 0);
                const eR = Math.sqrt(player.expScore || 0);
                const eff = Math.max(0, h.intensity - k - (tR + eR) / 2);
                penaltyPct += eff / 100;
              }
            }
            const pct = Math.max(0, 1 - penaltyPct);
            const effGravity = Math.max(10, gravityRadius * pct);

            const dx = ship.x - p.x;
            const dy = ship.y - p.y;
            if (dx * dx + dy * dy <= effGravity * effGravity) {
              const typesMap = {
                sensorarray: 'sensorarrays',
                lab: 'labs',
                armor: 'armor',
                shield: 'shields',
                engine: 'engine',
                munitions: 'munitions',
                targeting: 'targeting',
                damagecontrol: 'damagecontrol'
              };
              const prop = typesMap[data.type];
              if (prop && (ship[prop] || 0) < 3 && !ship.isUpgrading) {
                ship.isUpgrading = true;
                ship.upgradeTimer = 20.0;
                ship.upgradeProp = prop;
                ship.upgradeType = data.type;
                ship.upgradePlanetId = p.id;
                ship.upgradeShipsPaid = 0;
                ship.upgradeAccumulator = 0;
                
                console.log(`Started progressive upgrade for cruiser ${ship.id} with ${data.type}, financing from planet ${p.id}`);
                break;
              }
            }
          }
        }
      }
    });

    socket.on('moveShipsToSpace', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }

      game.moveShipsToSpace(player, data.shipIds, data.targetX, data.targetY, data.isWarp, data.speedModifier, data.isBombing);
    });

    socket.on('chatMessage', (text) => {
      const player = connectedClients.get(socket.id);
      if (player && text && typeof text === 'string' && text.trim().length > 0) {
        const cleanText = text.trim().substring(0, 100);
        io.emit('chatMessage', {
          sender: player.name,
          color: player.color,
          text: cleanText
        });
      }
    });

    socket.on('resetAFK', () => {
      const p = connectedClients.get(socket.id);
      if (p) {
        if (p.isAFK) {
          p.isAFK = false;
          p.isAI = false;
          p.afkTimer = 0;
          socket.emit('afkConverted');
          io.emit('chatMessage', { sender: 'System', text: `${p.name || p.id} has returned.`, color: '#0ff' });
        }
        p.lastCommandTime = Date.now();
        game.tryAssignPlanet(p);
      }
    });

    socket.on('moveShipsToPlanet', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }
      game.tryAssignPlanet(player);

      const targetPlanet = game.planets.find(p => p.id === data.targetId);
      if (!targetPlanet) return;

      game.moveShipsToPlanet(player, data.shipIds, targetPlanet, data.isWarp, data.speedModifier, data.isBombing);
    });

    socket.on('togglePause', () => {
      game.isPaused = !game.isPaused;
    });

    socket.on('setName', (name) => {
      const player = connectedClients.get(socket.id);
      if (player && name && typeof name === 'string') {
        player.name = name.substring(0, 16); // limit length
      }
    });

    socket.on('resetAFK', () => {
      const player = connectedClients.get(socket.id);
      if (player) {
        player.lastCommandTime = Date.now();
        player.afkWarningSent = false;
      }
    });

    socket.on('enterGame', (options) => {
      if (!game.settings) {
        game.settings = {
          fogOfWar: options && options.fogOfWar,
          smallEmpires: options && options.smallEmpires,
          noRampagers: options && options.noRampagers,
          aiCount: options && options.aiCount !== undefined ? options.aiCount : 5,
          productionMultiple: options && options.productionMultiple !== undefined ? options.productionMultiple : 1.0,
          mapSize: options && options.mapSize !== undefined ? options.mapSize : 1600,
          planetCount: options && options.planetCount !== undefined ? options.planetCount : 60,
          hazardMultiple: options && options.hazardMultiple !== undefined ? options.hazardMultiple : 1.0
        };
      }
      const p = connectedClients.get(socket.id);
      if (p) {
        p.lastCommandTime = Date.now();
        game.tryAssignPlanet(p);
      }
    });

    socket.on('restartGame', (options) => {
      // Prevent multiple restarts at the same time
      const now = Date.now();
      if (now - (game.lastRestartTime || 0) < 500) return;
      game.lastRestartTime = now;
      
      game.settings = { 
          fogOfWar: options && options.fogOfWar,
          smallEmpires: options && options.smallEmpires,
          noRampagers: options && options.noRampagers,
          aiCount: options && options.aiCount !== undefined ? options.aiCount : 5,
          productionMultiple: options && options.productionMultiple !== undefined ? options.productionMultiple : 1.0,
          mapSize: options && options.mapSize !== undefined ? options.mapSize : 1600,
          planetCount: options && options.planetCount !== undefined ? options.planetCount : 60,
          hazardMultiple: options && options.hazardMultiple !== undefined ? options.hazardMultiple : 1.0
      };
      
      game.width = game.settings.mapSize;
      game.height = game.settings.mapSize;
      game.initMap();
      game.gameStartTime = now;
      game.isRunning = true;
      game.isPaused = false;
      
      for (const p of connectedClients.values()) {
        p.isAI = false;
        p.isAlive = true;
        p.needsPlanet = true;
        p.lastCommandTime = now;
        p.discoveredPlanets = new Set();
        p.attackedPlanets = new Map();
        p.cruiserStyle = null;
        
        console.log(`RESTART: Assigning planet for ${p.id}`);
        game.tryAssignPlanet(p);
      }
    });

    socket.on('disconnect', () => {
      const player = connectedClients.get(socket.id);
      if (player && player.id !== game.humanPlayer.id) {
        player.isAI = true; // Revert to AI if it's one of the AI slots
      }
      connectedClients.delete(socket.id);
    });
  });

  // Game Loop (20 TPS simulation, adaptive broadcast)
  const TICK_RATE = 1000 / 20;
  const BROADCAST_EVERY_NORMAL = 1;  // 20 FPS when all clients healthy
  const BROADCAST_EVERY_SLOW = 4;    // 5 FPS when a client is behind
  let lastTime = Date.now();
  let tickCount = 0;

  setInterval(() => {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    if (game.isRunning && !game.isPaused) {
      game.update(deltaTime);
      game.checkWinCondition();
      
    } else if (game.isRunning && game.isPaused) {
      // Pause logic is not needed for AFK since AFK is removed
    }

    tickCount++;

    // Check if any client is experiencing backpressure
    let anyClientBehind = false;
    for (const [socketId] of connectedClients.entries()) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock && sock.conn) {
        if (sock.conn.writeBuffer && sock.conn.writeBuffer.length > 5) {
          anyClientBehind = true;
          break;
        }
      }
    }

    const broadcastEvery = anyClientBehind ? BROADCAST_EVERY_SLOW : BROADCAST_EVERY_NORMAL;
    if (tickCount % broadcastEvery !== 0) return;

    // Compute planet visual state
    const allPlanetsMapped = game.planets.map(p => {
        const incomingShips = game.ships.filter(s => {
          if (!s.active || s.targetPlanet !== p || s.owner === p.owner) return false;
          const dx = s.x - p.x;
          const dy = s.y - p.y;
          return dx*dx + dy*dy < 22500; // Only show odds if attackers are within 150 pixels
        });
        let maxKillChance = null;
        
        if (incomingShips.length > 0) {
          const attackersByOwner = new Map();
          for (const s of incomingShips) {
            if (!attackersByOwner.has(s.owner)) attackersByOwner.set(s.owner, []);
            attackersByOwner.get(s.owner).push(s);
          }
          
          for (const [owner, ships] of attackersByOwner.entries()) {
            const penalty = 0.01 * Math.floor(p.ships / 5);
            
            let nearbyFriendlyCount = 0;
            for (const s of ships) {
              const dx = s.x - p.x;
              const dy = s.y - p.y;
              if (dx*dx + dy*dy < 2500) nearbyFriendlyCount++;
            }
            const advantage = 0.01 * Math.floor(nearbyFriendlyCount / 10);
            
            let friendlyPlanetBoost = 0;
            let defenderPlanetPenalty = 0;
            for (const otherPlanet of game.planets) {
              if (otherPlanet !== p) {
                const dx = otherPlanet.x - p.x;
                const dy = otherPlanet.y - p.y;
                const techBonus = otherPlanet.owner ? (0.01 * Math.sqrt(otherPlanet.owner.techScore || 0)) : 0;
                const expBonus = otherPlanet.owner ? (0.005 * Math.sqrt(otherPlanet.owner.expScore || 0)) : 0;
                const gravityRadius = 225 * (1 + techBonus + expBonus);
                
                if (dx*dx + dy*dy < gravityRadius * gravityRadius) {
                  if (otherPlanet.owner === owner) friendlyPlanetBoost += 0.02;
                  else if (otherPlanet.owner === p.owner) defenderPlanetPenalty += 0.02;
                }
              }
            }
            
            const attackerTechBonus = 0.01 * Math.sqrt(owner.techScore || 0);
            const attackerExpBonus = 0.005 * Math.sqrt(owner.expScore || 0);
            const defenderTechPenalty = 0.01 * Math.sqrt(p.owner ? (p.owner.techScore || 0) : 0);
            const defenderExpPenalty = 0.005 * Math.sqrt(p.owner ? (p.owner.expScore || 0) : 0);
            
            let maxShipExp = 0;
            for (const s of ships) {
              if (s.expScore > maxShipExp) maxShipExp = s.expScore;
            }
            const attackerLocalExpBonus = 0.005 * Math.sqrt(maxShipExp || 0);
            const defenderLocalExpPenalty = 0.005 * Math.sqrt(p.expScore || 0);
            
            const humanInvolved = (!owner.isAI) || (p.owner && !p.owner.isAI);
            const humanVsHuman = (!owner.isAI) && (p.owner && !p.owner.isAI);
            
            let survivingAICount = 0;
            if (humanVsHuman) {
              const aiOwners = new Set();
              for (const planet of game.planets) {
                if (planet.owner && planet.owner.isAI) {
                  aiOwners.add(planet.owner.id);
                }
              }
              survivingAICount = aiOwners.size;
            }
            const humanDefenderBonus = humanVsHuman ? (0.02 * survivingAICount) : 0;
            
            const lastStandPenalty = (humanInvolved && p.owner && p.owner.planetCount === 1) ? 0.20 : 0;
            const defenderHomeworldPenalty = (humanInvolved && p.owner && p.owner.id === p.homeworldOf) ? 0.20 : 0;
            const attackerHomeworldBonus = (humanInvolved && owner.id === p.homeworldOf && p.owner !== owner) ? 0.20 : 0;
            
            const killChance = Math.max(0, 0.8 - penalty + advantage + friendlyPlanetBoost - defenderPlanetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - defenderTechPenalty - defenderExpPenalty - defenderLocalExpPenalty - lastStandPenalty - defenderHomeworldPenalty - humanDefenderBonus);
            if (maxKillChance === null || killChance > maxKillChance) {
              maxKillChance = killChance;
            }
          }
        }

        const tEvent = p.techIncreaseEvent;
        p.techIncreaseEvent = false;

        const tdEvent = p.techDoubleIncreaseEvent;
        p.techDoubleIncreaseEvent = false;
        
        const cEvent = p.capacityDecreaseEvent;
        p.capacityDecreaseEvent = false;

        const dEvent = p.defeatEvent;
        p.defeatEvent = null;

        const lEvent = p.lastStandEvent;
        p.lastStandEvent = false;

        const hwEvent = p.homeworldEvent;
        p.homeworldEvent = false;

        return {
          id: p.id,
          name: p.name,
          x: p.x,
          y: p.y,
          radius: p.radius,
          ships: p.ships,
          maxShips: p.maxShips,
          ownerId: p.owner ? p.owner.id : null,
          productionProgress: p.productionProgress,
          expScore: p.expScore || 0,
          attackerOdds: maxKillChance !== null ? Math.round(maxKillChance * 100) : null,
          techIncreaseEvent: tEvent,
          techDoubleIncreaseEvent: tdEvent,
          capacityDecreaseEvent: cEvent,
          justAssigned: p.justAssigned,
          rampageEvent: p.rampageEvent,
          defeatEvent: dEvent,
          homeworldOf: p.homeworldOf,
          lastStandEvent: lEvent,
          homeworldEvent: hwEvent,
          isResearch: p.isResearch,
          isMilitary: p.isMilitary,
          isSpeedPlanet: p.isSpeedPlanet
      };
    });

    const allShipsMapped = game.ships.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      count: s.count || 1,
      ownerId: s.owner ? s.owner.id : null,
      active: s.active,
      expScore: s.expScore || 0,
      isBomber: s.isBomber,
      isInterceptor: s.isInterceptor,
      isCruiser: s.isCruiser || false,
        isAmoeba: s.isAmoeba || false,
      health: s.health || 0,
      maxHealth: s.maxHealth || 0,
      bombs: s.bombs || 0,
      bombReloadTimer: s.bombReloadTimer || 0,
      labs: s.labs || 0,
      sensorarrays: s.sensorarrays || 0,
      armor: s.armor || 0,
      shields: s.shields || 0,
      engine: s.engine || 0,
      munitions: s.munitions || 0,
      splashDamage: s.splashDamage || 0,
      targeting: s.targeting || 0,
      damagecontrol: s.damagecontrol || 0,
      isUpgrading: s.isUpgrading || false,
      upgradeTimer: s.upgradeTimer || 0,
      upgradeType: s.upgradeType || null,
      isHungry: s.isAmoeba ? (!s.amoebaGrowCooldown || s.amoebaGrowCooldown <= 0) : false,
      isWarp: s.isWarp || false,
      fuel: s.fuel || 0,
      angle: s.angle || 0,
      flightTime: s.flightTime || 0,
      speedModifier: s.speedModifier || 1.0,
      speed: s.speed || 35,
      targetX: s.targetPlanet ? s.targetPlanet.x : s.targetX,
      targetY: s.targetPlanet ? s.targetPlanet.y : s.targetY,
      formation: s.formation
    }));

    for (const [socketId, player] of connectedClients.entries()) {
      if (!player.discoveredPlanets) {
        player.discoveredPlanets = new Set();
      }
      
      let visiblePlanets = [];
      let visibleShips = [];
      let visibleExplosions = [];
      let visibleLasers = [];

      const playerTechBonus = 0.01 * Math.sqrt(player.techScore || 0);
      const playerExpBonus = 0.005 * Math.sqrt(player.expScore || 0);

      let hasEntities = false;
      const playerFleets = new Map();

      for (const p of game.planets) {
        if (p.owner && p.owner.id === player.id) {
          hasEntities = true;
          break;
        }
      }
      
      if (!hasEntities && game.settings?.fogOfWar && !player.isAI) {
         console.log(`GETSTATE: ${player.id} has NO entities! (Planets: ${game.planets.filter(p=>p.owner).map(p=>p.owner.id).join(',')})`);
      }

      for (const s of game.ships) {
        if (s.active && s.owner && s.owner.id === player.id) {
          hasEntities = true;
          const targetId = s.targetPlanet ? s.targetPlanet.id : `space-${Math.round(s.targetX / 100)}-${Math.round(s.targetY / 100)}`;
          if (!playerFleets.has(targetId)) {
            playerFleets.set(targetId, { count: 0, ships: [] });
          }
          const fleet = playerFleets.get(targetId);
          fleet.count += s.count || 1;
          fleet.ships.push(s);
        }
      }

      const visibleFleets = [];

      // Helper: compute sensor range reduction from storms/nebulae at a position
      const hazardSensorReductionPct = (x, y, ownerId) => {
        let penaltyPct = 0;
        for (const h of game.ionStorms) {
          if (h.type === 'minefield') continue;
          const hdx = x - h.x, hdy = y - h.y;
          if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
            const owner = game.allPlayers.find(p => p.id === ownerId);
            const k = h.knowledge[ownerId] || 0;
            const tR = owner ? Math.sqrt(owner.techScore || 0) : 0;
            const eR = owner ? Math.sqrt(owner.expScore || 0) : 0;
            const eff = Math.max(0, h.intensity - k - (tR + eR) / 2);
            penaltyPct += eff / 100;
          }
        }
        return Math.max(0, 1 - penaltyPct);
      };

      const scaleMap = 1.0;

      for (const fleet of playerFleets.values()) {
        const count = fleet.count;
        let baseRadar = count * 1.5 * scaleMap;
        fleet.radarRange = Math.max(75 * scaleMap, Math.min(300 * scaleMap, baseRadar * (1 + playerTechBonus + playerExpBonus)));

        let maxCruiserRadar = 0;
        for (const s of fleet.ships) {
          if (s.maxHealth > 0) {
            const shipExpBonus = (s.expScore || 0) * 2;
            let cruiserRadar = Math.min(250, 5 * s.maxHealth) + shipExpBonus;
            if (s.isWarp) cruiserRadar *= 0.25;
            if (s.sensorarrays && s.sensorarrays > 0) {
              let mult = 1.0;
              mult += 0.50;
              if (s.sensorarrays > 1) {
                mult += 0.25;
              }
              if (s.sensorarrays > 2) {
                mult += 0.25;
              }
              cruiserRadar *= mult;
            }
            if (cruiserRadar > maxCruiserRadar) maxCruiserRadar = cruiserRadar;
          }
        }
        if (maxCruiserRadar > 0) {
          fleet.radarRange = Math.max(fleet.radarRange, maxCruiserRadar * scaleMap * (1 + playerTechBonus + playerExpBonus));
        }

        if (fleet.ships.length > 0) {
          const clusters = [];
          for (const s of fleet.ships) {
            let cluster = clusters.find(c => {
              const dx = c.x - s.x;
              const dy = c.y - s.y;
              return dx*dx + dy*dy < fleet.radarRange * fleet.radarRange;
            });
            if (!cluster) {
              clusters.push({ x: s.x, y: s.y, radarRange: fleet.radarRange, ownerId: player.id, isCruiser: s.isCruiser || false });
            } else if (s.isCruiser) {
              cluster.isCruiser = true;
            }
          }
          visibleFleets.push(...clusters.map(c => {
            const pct = hazardSensorReductionPct(c.x, c.y, player.id);
            return { ...c, radarRange: Math.max(10, c.radarRange * pct) };
          }));
        }
      }

      const isVisible = (x, y) => {
        if (!game.settings?.fogOfWar) return true;
        if (player.isAI || !hasEntities) return true; // AI and spectators see all
        
        for (const p of game.planets) {
          if (p.owner && p.owner.id === player.id) {
            const planetTech = 0.01 * Math.sqrt(p.owner.techScore || 0);
            const planetExp = 0.005 * Math.sqrt(p.owner.expScore || 0);
            const gravityRadius = (p.maxShips * 1.5 * scaleMap) * (1 + planetTech + planetExp);
            const pct = hazardSensorReductionPct(p.x, p.y, player.id);
            const effectiveGravity = Math.max(10, gravityRadius * pct);
            const dx = p.x - x;
            const dy = p.y - y;
            if (dx*dx + dy*dy <= effectiveGravity*effectiveGravity) return true;
          }
        }
        
        for (const cluster of visibleFleets) {
          const rangeSq = cluster.radarRange * cluster.radarRange;
          const dx = cluster.x - x;
          const dy = cluster.y - y;
          if (dx*dx + dy*dy <= rangeSq) return true;
        }
        return false;
      };

      const isSilhouetteVisible = (x, y) => {
        if (!game.settings?.fogOfWar) return true;
        if (player.isAI || !hasEntities) return true;
        
        for (const p of game.planets) {
          if (p.owner && p.owner.id === player.id) {
            const planetTech = 0.01 * Math.sqrt(p.owner.techScore || 0);
            const planetExp = 0.005 * Math.sqrt(p.owner.expScore || 0);
            const gravityRadius = (p.maxShips * 1.5 * scaleMap) * (1 + planetTech + planetExp) * 1.5;
            const pct = hazardSensorReductionPct(p.x, p.y, player.id);
            const effectiveGravity = Math.max(10, gravityRadius * pct);
            const dx = p.x - x;
            const dy = p.y - y;
            if (dx*dx + dy*dy <= effectiveGravity*effectiveGravity) return true;
          }
        }
        
        for (const fleet of playerFleets.values()) {
          const extendedRadar = fleet.radarRange * 1.5;
          const rangeSq = extendedRadar * extendedRadar;
          for (const s of fleet.ships) {
            const dx = s.x - x;
            const dy = s.y - y;
            if (dx*dx + dy*dy <= rangeSq) return true;
          }
        }
        return false;
      };

      for (let i = 0; i < game.planets.length; i++) {
        const p = game.planets[i];
        if ((p.owner && p.owner.id === player.id) || isVisible(p.x, p.y)) {
          player.discoveredPlanets.add(p.id);
          const mappedPlanet = Object.assign({}, allPlanetsMapped[i]);
          if (player.spyRootedEvents && player.spyRootedEvents.has(p.id)) mappedPlanet.spyRootedOutEvent = true;
          visiblePlanets.push(mappedPlanet);
        } else if (isSilhouetteVisible(p.x, p.y) || player.discoveredPlanets.has(p.id)) {
          if (isSilhouetteVisible(p.x, p.y)) {
            player.discoveredPlanets.add(p.id);
          }
          const hasAttacked = player.attackedPlanets && player.attackedPlanets.has(p.id) && player.attackedPlanets.get(p.id) > 0;
          if (hasAttacked) {
            const mappedPlanet = Object.assign({}, allPlanetsMapped[i], { inFog: true, permanentlyTracked: true });
            if (player.spyRootedEvents && player.spyRootedEvents.has(p.id)) mappedPlanet.spyRootedOutEvent = true;
            visiblePlanets.push(mappedPlanet);
          } else {
            const spyRooted = player.spyRootedEvents && player.spyRootedEvents.has(p.id);
            visiblePlanets.push({
              id: p.id,
              x: p.x,
              y: p.y,
              radius: p.radius,
              ownerId: null,
              ships: 0,
              maxShips: p.maxShips,
              inFog: true,
              spyRootedOutEvent: spyRooted,
              isSpeedPlanet: p.isSpeedPlanet,
              isResearch: p.isResearch,
              isMilitary: p.isMilitary
            });
          }
        }
      }

      for (let i = 0; i < game.ships.length; i++) {
        const s = game.ships[i];
        if ((s.owner && s.owner.id === player.id) || isVisible(s.x, s.y)) {
          visibleShips.push(allShipsMapped[i]);
        }
      }

      for (const e of game.explosions) {
        if (isVisible(e.x, e.y)) {
          visibleExplosions.push(e);
        }
      }

      for (const l of game.lasers) {
        if (isVisible(l.startX, l.startY) || isVisible(l.endX, l.endY)) {
          visibleLasers.push(l);
        }
      }

      // Ion storm visibility
      let visibleStorms = [];
      for (const storm of game.ionStorms) {
        let stormVisible = false;
        if (!game.settings?.fogOfWar || player.isAI || !hasEntities) {
          stormVisible = true;
        } else {
          for (const p of game.planets) {
            if (p.owner && p.owner.id === player.id) {
              const pt = 0.01 * Math.sqrt(p.owner.techScore || 0);
              const pe = 0.005 * Math.sqrt(p.owner.expScore || 0);
              const gr = (p.maxShips * 1.5) * (1 + pt + pe);
              const dx = p.x - storm.x, dy = p.y - storm.y;
              if (Math.sqrt(dx * dx + dy * dy) <= gr + storm.radius) { stormVisible = true; break; }
            }
          }
          if (!stormVisible) {
            for (const cl of visibleFleets) {
              const dx = cl.x - storm.x, dy = cl.y - storm.y;
              if (Math.sqrt(dx * dx + dy * dy) <= cl.radarRange + storm.radius) { stormVisible = true; break; }
            }
          }
        }
        if (stormVisible) {
          visibleStorms.push({
            id: storm.id, name: storm.name, type: storm.type || 'storm',
            x: storm.x, y: storm.y, radius: storm.radius,
            intensity: storm.intensity, speed: storm.speed,
            heading: Math.round(storm.heading),
            knowledge: storm.knowledge[player.id] || 0
          });
        }
      }

      const state = {
        planets: visiblePlanets,
        ships: visibleShips,
        fleets: visibleFleets,
        explosions: visibleExplosions,
        lasers: visibleLasers,
        storms: visibleStorms,
        players: game.allPlayers,
        galacticCapacity: game.galacticCapacity,
        isPaused: game.isPaused,
        isRunning: game.isRunning,
        gameOverMessage: game.gameOverMessage,
        settings: game.settings,
        width: game.width,
        height: game.height
      };
      
      io.to(socketId).emit('gameStateUpdate', state);
    }
    
  }, TICK_RATE);

  const PORT = process.env.PORT || 5173;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
