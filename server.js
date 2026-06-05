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

        game.sendShips(sourcePlanet, targetPlanet, data.isWarp, data.speedModifier, data.isBombing, data.fillAmount, data.scoutMode, data.isCruiser);
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
        game.sendShipsToSpace(sourcePlanet, data.targetX, data.targetY, data.isWarp, data.speedModifier, data.isBombing, data.scoutMode, data.isCruiser);
      }
    });

    socket.on('buildCapitalShip', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }

      const p = game.planets.find(pl => pl.id === data.planetId);
      if (p && p.owner && p.owner.id === player.id) {
        game.buildCapitalShip(p, data.classType);
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

      console.log(`[Server Received Upgrade] Player: ${player.name}, shipId: ${data.shipId}, type: ${data.type}`);
      const ship = game.ships.find(s => s.id === data.shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        const typesMap = {
          sensorarray: 'sensorarrays',
          lab: 'labs',
          armor: 'armor',
          shield: 'shields',
          engine: 'engine',
          munitions: 'munitions',
          targeting: 'targeting',
          damagecontrol: 'damagecontrol',
          fueltanker: 'fuel_tanker',
          diplomat: 'diplomat',
          marines: 'marines'
        };
        const prop = typesMap[data.type];
         if (prop && (ship[prop] || 0) < 5 && !ship.isUpgrading) {
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

          const maxIndividualLevel = Math.floor((ship.maxHealth || 0) / 10);
          const maxTotalUpgrades = Math.floor((ship.maxHealth || 0) / 5);

          const currentVal = ship[prop] || 0;
          const nextLevel = currentVal + 1;

          if (prop === 'shields') {
            const playerTech = ship.owner ? ship.owner.techScore || 0 : 0;
            const playerExp = ship.owner ? ship.owner.expScore || 0 : 0;
            const shipExp = ship.expScore || 0;
            const techBonus = Math.sqrt(playerTech);
            const expBonus = Math.sqrt(playerExp);
            const shipExpBonus = Math.sqrt(shipExp);
            const baseDeflection = ship.maxHealth + (techBonus + expBonus + shipExpBonus);
            const deflectionRem = 100 - baseDeflection;
            const nextShieldDeflectionBonus = nextLevel * (deflectionRem / 5);
            const newDeflection = baseDeflection + nextShieldDeflectionBonus;
            if (newDeflection > 90) {
              console.log(`[Server Upgrade Rejected] Next deflection (${newDeflection}%) would exceed 90%.`);
              return;
            }
          }

          if (nextLevel > maxIndividualLevel || (totalUpgrades + 1) > maxTotalUpgrades) {
            console.log(`[Server Upgrade Rejected] Health limits exceeded. shipId: ${ship.id}, maxHealth: ${ship.maxHealth}, currentVal: ${currentVal}, next: ${nextLevel}, maxLevel: ${maxIndividualLevel}, totalUpgrades: ${totalUpgrades}, maxTotalUpgrades: ${maxTotalUpgrades}`);
            return;
          }

          const cost = game.getUpgradeCost(ship, data.type);

          let closestPlanet = null;
          let closestDistSq = Infinity;

          for (const p of game.planets) {
            const creditsAvailable = player.useCredits !== false ? (player.credits || 0) : 0;
            if (p.owner && p.owner.id === player.id && (p.ships + creditsAvailable) >= cost) {
              const gravityRadius = p.getGravityRadius();
              
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
              const distSq = dx * dx + dy * dy;
              if (distSq <= effGravity * effGravity) {
                // Rule: Limit such a garrison world from paying upgrade costs unless the upgrading ship is within 25px of the garrison world.
                const isSuchGarrisonWorld = (p.isMilitary || p.focusMode === 'garrison') && (p.ships >= p.maxShips * 2 - 10);
                if (isSuchGarrisonWorld && distSq > 25 * 25) {
                  continue;
                }
                
                if (distSq < closestDistSq) {
                  closestDistSq = distSq;
                  closestPlanet = p;
                }
              }
            }
          }

          let upgradeStarted = false;
          if (closestPlanet) {
            const p = closestPlanet;
            // Increase the global cost modifier by 5% when starting/purchasing the upgrade
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
            const normType = typeKeyMap[data.type] || data.type;
            game.globalUpgradeModifiers[normType] = (game.globalUpgradeModifiers[normType] || 0) + 0.05;
            if (player.upgradeModifiers && player.upgradeModifiers[normType] !== undefined) {
              if (player.upgradeModifiers[normType] > -0.50) {
                player.upgradeModifiers[normType] = Math.max(-0.50, player.upgradeModifiers[normType] - 0.01);
              }
            }

            ship.isUpgrading = true;
            ship.upgradeTimer = cost * 0.2;
            ship.upgradeProp = prop;
            ship.upgradeType = data.type;
            ship.upgradePlanetId = p.id;
            ship.upgradeShipsPaid = 0;
            ship.upgradeAccumulator = 0;
            
            console.log(`Started progressive upgrade for cruiser ${ship.id} with ${data.type}, financing from closest planet ${p.id} at cost ${cost}`);
            upgradeStarted = true;
          }
          if (!upgradeStarted) {
            console.log(`[Server Rejected Upgrade] Financing or distance check failed. shipId: ${ship.id}, type: ${data.type}, prop: ${prop}, cost: ${cost}`);
          }
        } else {
          console.log(`[Server Rejected Upgrade] Validation failed. shipId: ${ship.id}, type: ${data.type}, prop: ${prop}, currentVal: ${prop ? (ship[prop] || 0) : 'N/A'}, isUpgrading: ${ship.isUpgrading}`);
        }
      } else {
        console.log(`[Server Rejected Upgrade] Ship verification failed. shipId: ${data.shipId}, type: ${data.type}, shipExists: ${!!ship}, isCruiser: ${ship ? ship.isCruiser : 'N/A'}, ownerMatches: ${ship && ship.owner ? ship.owner.id === player.id : 'N/A'}`);
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

      game.moveShipsToSpace(player, data.shipIds, data.targetX, data.targetY, data.isWarp, data.speedModifier, data.isShift);
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

      game.moveShipsToPlanet(player, data.shipIds, targetPlanet, data.isWarp, data.speedModifier, data.isShift);
    });

    socket.on('setCruiserTarget', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipIds, targetType, targetId, clickX, clickY, isShift } = data;
      if (!shipIds || !targetType || targetId === undefined) return;

      for (const id of shipIds) {
        const ship = game.ships.find(s => s.id === id);
        if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
          if (isShift) {
            if (!ship.orderQueue) ship.orderQueue = [];
            ship.orderQueue.push({
              type: 'target',
              targetType,
              targetId,
              clickX,
              clickY
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
              ship.executeNextOrder(game.planets, game.ships, game);
            }
          } else {
            ship.orderQueue = [];
            if (ship.isPatrolling && targetType !== 'ship') {
              const destPlanet = targetType === 'planet' ? game.planets.find(p => p.id === targetId) : null;
              const tx = (clickX !== undefined && clickX !== null) ? clickX : (destPlanet ? destPlanet.x : ship.x);
              const ty = (clickY !== undefined && clickY !== null) ? clickY : (destPlanet ? destPlanet.y : ship.y);
              ship.patrolStationX = tx;
              ship.patrolStationY = ty;
              ship.targetX = tx;
              ship.targetY = ty;
              ship.targetPlanet = null;
              ship.cruiserTargetType = null;
              ship.cruiserTargetId = null;
            } else {
              ship.isPatrolling = false;
              ship.cruiserTargetType = targetType;
              ship.cruiserTargetId = targetId;
              ship.cruiserTargetClickX = clickX !== undefined ? clickX : null;
              ship.cruiserTargetClickY = clickY !== undefined ? clickY : null;
            }
          }
        }
      }
    });

    socket.on('toggleCruiserBomb', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        ship.bombPlanetsEnabled = !!enabled;
        if (ship.bombPlanetsEnabled) {
          ship.isPatrolling = false;
          ship.isScouting = false;
          ship.isResearching = false;
          ship.isDiplomacy = false;
        }
      }
    });

    socket.on('setCruiserPackage', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const shipIds = Array.isArray(data.shipIds) ? data.shipIds : [data.shipId];
      for (const shipId of shipIds) {
        const ship = game.ships.find(s => s.id === shipId);
        if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
          if (['brute', 'ranged', 'sniper'].includes(data.value)) {
            ship.package = data.value;
            if (ship.package === 'brute' && ship.strategy === 'short') {
              ship.strategy = 'normal';
            }
          }
        }
      }
    });

    socket.on('setCruiserTactics', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const shipIds = Array.isArray(data.shipIds) ? data.shipIds : [data.shipId];
      for (const shipId of shipIds) {
        const ship = game.ships.find(s => s.id === shipId);
        if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
          if (['normal', 'patient', 'frenzied'].includes(data.value)) {
            ship.tactics = data.value;
          }
        }
      }
    });

    socket.on('setCruiserStrategy', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const shipIds = Array.isArray(data.shipIds) ? data.shipIds : [data.shipId];
      for (const shipId of shipIds) {
        const ship = game.ships.find(s => s.id === shipId);
        if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
          if (['normal', 'short', 'long'].includes(data.value)) {
            if (ship.package === 'brute' && data.value === 'short') {
              ship.strategy = 'normal';
            } else {
              ship.strategy = data.value;
            }
          }
        }
      }
    });

    socket.on('toggleCruiserPatrol', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        ship.isPatrolling = !!enabled;
        ship.patrolReloading = false;
        if (ship.isPatrolling) {
          ship.bombPlanetsEnabled = false;
          ship.isScouting = false;
          ship.isResearching = false;
          ship.isDiplomacy = false;
          ship.orderQueue = [];
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
          ship.patrolStationX = ship.x;
          ship.patrolStationY = ship.y;
        }
      }
    });

    socket.on('toggleCruiserScout', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        ship.isScouting = !!enabled;
        ship.scoutFuelRetreating = false;
        if (ship.isScouting) {
          ship.isPatrolling = false;
          ship.bombPlanetsEnabled = false;
          ship.isResearching = false;
          ship.isDiplomacy = false;
          ship.orderQueue = [];
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
          ship.scoutTargetX = null;
          ship.scoutTargetY = null;
        }
      }
    });

    socket.on('toggleCruiserScoutAttack', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        ship.scoutAttackEnabled = !!enabled;
      }
    });

    socket.on('toggleCruiserResearch', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id && ship.labs > 0) {
        ship.isResearching = !!enabled;
        ship.researchFuelRetreating = false;
        ship.researchRearming = false;
        if (ship.isResearching) {
          ship.isDiplomacy = false;
          ship.isScouting = false;
          ship.isPatrolling = false;
          ship.bombPlanetsEnabled = false;
          ship.orderQueue = [];
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
        }
      }
    });

    socket.on('toggleCruiserDiplomacy', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id && ship.diplomat > 0) {
        ship.isDiplomacy = !!enabled;
        ship.diplomacyFuelRetreating = false;
        if (ship.isDiplomacy) {
          ship.isResearching = false;
          ship.isScouting = false;
          ship.isPatrolling = false;
          ship.bombPlanetsEnabled = false;
          ship.orderQueue = [];
          ship.cruiserTargetType = null;
          ship.cruiserTargetId = null;
        }
      }
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

    // Sci-Fi Planetary Resources System Event Listeners
    socket.on('setResourceTargetStockpile', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && data && data.resource && typeof data.value === 'number') {
        if (!player.targetStockpile) {
          player.targetStockpile = { dilithium: 0, merculite: 0, duranium: 0, tritanium: 0, antimatter: 0, deuterium: 0, latinum: 0 };
        }
        if (player.targetStockpile[data.resource] !== undefined) {
          player.targetStockpile[data.resource] = Math.max(0, Math.min(999, data.value));
        }
      }
    });

    socket.on('setResourceOfferPrice', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && data && data.resource && typeof data.value === 'number') {
        if (!player.offerPrice) {
          player.offerPrice = { dilithium: 3, merculite: 3, duranium: 3, tritanium: 3, antimatter: 3, deuterium: 3, latinum: 3 };
        }
        if (player.offerPrice[data.resource] !== undefined) {
          player.offerPrice[data.resource] = Math.max(0, Math.min(999, data.value));
        }
      }
    });

    socket.on('setResourceBuyPrice', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && data && data.resource && typeof data.value === 'number') {
        if (!player.buyPrice) {
          player.buyPrice = { dilithium: 2, merculite: 2, duranium: 2, tritanium: 2, antimatter: 2, deuterium: 2, latinum: 2 };
        }
        if (!player.offerPrice) {
          player.offerPrice = { dilithium: 3, merculite: 3, duranium: 3, tritanium: 3, antimatter: 3, deuterium: 3, latinum: 3 };
        }
        if (player.buyPrice[data.resource] !== undefined) {
          const oldBuyPrice = player.buyPrice[data.resource];
          const newBuyPrice = Math.max(0, Math.min(999, data.value));
          player.buyPrice[data.resource] = newBuyPrice;
          
          if (newBuyPrice > oldBuyPrice) {
            const currentSellPrice = player.offerPrice[data.resource] ?? 3;
            if (currentSellPrice <= newBuyPrice) {
              player.offerPrice[data.resource] = newBuyPrice + 1;
            }
          }
        }
      }
    });

    socket.on('toggleResourceSell', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && data && data.resource) {
        if (!player.sellToggled) {
          player.sellToggled = { dilithium: false, merculite: false, duranium: false, tritanium: false, antimatter: false, deuterium: false, latinum: false };
        }
        if (player.sellToggled[data.resource] !== undefined) {
          player.sellToggled[data.resource] = !player.sellToggled[data.resource];
        }
      }
    });

    socket.on('sellResourcesToBank', () => {
      const player = connectedClients.get(socket.id);
      if (player && player.resources) {
        if (player.tradeOptions === undefined) {
          player.tradeOptions = player.tradeCapacity || 5;
        }

        const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
        const eligible = [];
        for (const res of resourcesList) {
          const qty = player.resources[res] || 0;
          if (qty >= 1.0) {
            eligible.push({ name: res, qty: qty });
          }
        }

        const L = eligible.length;

        // Allow sale if they have at least 1 trade option
        if (L > 0 && player.tradeOptions >= 1) {
          const sellPrice = Math.ceil((L * L) / 2);
          for (const item of eligible) {
            player.resources[item.name] = (player.resources[item.name] || 0) - 1.0;
          }
          player.credits = (player.credits || 0) + sellPrice * L;
          
          // Deduct options count (cost), can go negative
          player.tradeOptions = (player.tradeOptions || 0) - L;

          console.log(`[Bank Direct Sale] Player ${player.id} sold ${L} resources for ${sellPrice * L} credits. Remaining options: ${player.tradeOptions}`);
        }
      }
    });

    socket.on('changeSellPriceSetting', () => {
      const player = connectedClients.get(socket.id);
      if (player) {
        player.sellPriceSetting = (player.sellPriceSetting || 2) + 1;
        if (player.sellPriceSetting > 12) {
          player.sellPriceSetting = 2;
        }
      }
    });

    socket.on('postSellOrder', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && player.resources) {
        if (player.tradeOptions === undefined) {
          player.tradeOptions = player.tradeCapacity || 5;
        }
        
        // Player must have at least 1 trade option and stockpile >= 1.0
        if (player.tradeOptions >= 1 && (player.resources[data.resource] || 0) >= 1.0) {
          player.tradeOptions -= 1;
          player.resources[data.resource] -= 1.0;
          
          if (!game.sellOrders) game.sellOrders = [];
          const orderId = "order_" + Math.random().toString(36).substring(2, 9);
          game.sellOrders.push({
            id: orderId,
            ownerId: player.id,
            ownerName: player.name,
            resource: data.resource,
            price: player.sellPriceSetting || 2,
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60000 // 15 minutes
          });
          console.log(`[Market Post] Player ${player.id} posted 1 ${data.resource} for ${player.sellPriceSetting || 2} credits.`);
        }
      }
    });

    socket.on('cancelSellOrder', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && game.sellOrders) {
        const idx = game.sellOrders.findIndex(o => o.id === data.orderId);
        if (idx !== -1) {
          const order = game.sellOrders[idx];
          if (order.ownerId === player.id) {
            // Return resource to player stockpile, no option consumed/refunded
            player.resources[order.resource] = (player.resources[order.resource] || 0) + 1.0;
            game.sellOrders.splice(idx, 1);
            console.log(`[Market Cancel] Player ${player.id} cancelled order ${order.id}. Stockpile returned.`);
          }
        }
      }
    });

    socket.on('buySellOrder', (data) => {
      const player = connectedClients.get(socket.id); // buyer
      if (player && player.resources && game.sellOrders) {
        if (player.tradeOptions === undefined) {
          player.tradeOptions = player.tradeCapacity || 5;
        }
        
        const idx = game.sellOrders.findIndex(o => o.id === data.orderId);
        if (idx !== -1) {
          const order = game.sellOrders[idx];
          // Buyer must have >= 1 option and enough credits
          if (order.ownerId !== player.id && player.tradeOptions >= 1 && (player.credits || 0) >= order.price) {
            player.tradeOptions -= 1;
            player.credits -= order.price;
            player.resources[order.resource] = (player.resources[order.resource] || 0) + 1.0;
            
            // Pay credits to seller if not neutral
            if (order.ownerId !== 'neutral') {
              const seller = game.allPlayers.find(p => p.id === order.ownerId);
              if (seller) {
                seller.credits = (seller.credits || 0) + order.price;
              }
            }
            
            game.sellOrders.splice(idx, 1);
            socket.emit('purchaseSuccess');
            console.log(`[Market Buy] Player ${player.id} bought 1 ${order.resource} from ${order.ownerId} for ${order.price} credits.`);
          }
        }
      }
    });

    socket.on('changePlanetFocus', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }
      game.tryAssignPlanet(player);

      if (!data || data.planetId === undefined || !data.focusMode) return;
      const planet = game.planets.find(p => p.id === data.planetId);
      if (!planet || !planet.owner || planet.owner.id !== player.id) return;

      const validModes = ['economy', 'research', 'garrison', 'commerce', 'mining'];
      if (!validModes.includes(data.focusMode)) return;
      if (data.focusMode === 'commerce' && planet.maxShips <= 100) return;

      if (planet.focusTransition) return; // Prevent concurrent focus shifts on same planet
      const cost = Math.floor(planet.maxShips / 2);
      const creditsAvailable = player.useCredits !== false ? (player.credits || 0) : 0;
      if ((planet.ships + creditsAvailable) >= cost) {
        planet.focusTransition = {
          targetMode: data.focusMode,
          totalCost: cost,
          costRemaining: cost,
          elapsed: 0,
          playerId: player.id
        };
      }
    });

    socket.on('nameShip', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }
      game.tryAssignPlanet(player);

      if (!data || data.shipId === undefined) return;
      const ship = game.ships.find(s => s.id === data.shipId);
      if (!ship || !ship.owner || ship.owner.id !== player.id) return;

      if (data.name !== undefined) {
        const cleanName = typeof data.name === 'string' ? data.name.trim().substring(0, 16) : '';
        ship.name = cleanName || null;
      }
    });

    socket.on('namePlanet', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }
      game.tryAssignPlanet(player);

      if (!data || data.planetId === undefined) return;
      const planet = game.planets.find(p => p.id === data.planetId);
      if (!planet || !planet.owner || planet.owner.id !== player.id) return;

      if (data.name !== undefined) {
        const cleanName = typeof data.name === 'string' ? data.name.trim().substring(0, 16) : '';
        planet.name = cleanName || null;
      }
    });

    socket.on('toggleUseCredits', () => {
      const player = connectedClients.get(socket.id);
      if (player) {
        player.useCredits = player.useCredits !== false ? false : true;
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
          fogOfWar: options && options.fogOfWar !== undefined ? !!options.fogOfWar : true,
          smallEmpires: options && options.smallEmpires !== undefined ? !!options.smallEmpires : true,
          noRampagers: options && options.noRampagers,
          aiCount: options && options.aiCount !== undefined ? options.aiCount : 5,
          productionMultiple: options && options.productionMultiple !== undefined ? options.productionMultiple : 1.0,
          mapSize: options && options.mapSize !== undefined ? options.mapSize : 1600,
          planetCount: options && options.planetCount !== undefined ? options.planetCount : 60,
          clusters: options && options.clusters !== undefined ? parseInt(options.clusters, 10) : 0,
          hazardMultiple: options && options.hazardMultiple !== undefined ? options.hazardMultiple : 1.0,
          timedGameLimit: options && options.timedGameLimit !== undefined ? options.timedGameLimit : "3600",
          homeworldSize: options && options.homeworldSize !== undefined ? options.homeworldSize : "120"
        };
        if (game.settings.timedGameLimit && game.settings.timedGameLimit !== 'unlimited') {
          game.timeRemaining = parseFloat(game.settings.timedGameLimit);
        } else {
          game.timeRemaining = null;
        }
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
          fogOfWar: options && options.fogOfWar !== undefined ? !!options.fogOfWar : true,
          smallEmpires: options && options.smallEmpires !== undefined ? !!options.smallEmpires : true,
          noRampagers: options && options.noRampagers,
          aiCount: options && options.aiCount !== undefined ? options.aiCount : 5,
          productionMultiple: options && options.productionMultiple !== undefined ? options.productionMultiple : 1.0,
          mapSize: options && options.mapSize !== undefined ? options.mapSize : 1600,
          planetCount: options && options.planetCount !== undefined ? options.planetCount : 60,
          clusters: options && options.clusters !== undefined ? parseInt(options.clusters, 10) : 0,
          hazardMultiple: options && options.hazardMultiple !== undefined ? options.hazardMultiple : 1.0,
          timedGameLimit: options && options.timedGameLimit !== undefined ? options.timedGameLimit : "3600",
          homeworldSize: options && options.homeworldSize !== undefined ? options.homeworldSize : "120"
      };
      
      if (game.settings.timedGameLimit && game.settings.timedGameLimit !== 'unlimited') {
        game.timeRemaining = parseFloat(game.settings.timedGameLimit);
      } else {
        game.timeRemaining = null;
      }
      
      game.width = game.settings.mapSize;
      game.height = game.settings.mapSize;
      game.initMap();
      game.gameStartTime = now;
      game.isRunning = true;
      game.isPaused = false;
      
      for (const [socketId, oldPlayer] of connectedClients.entries()) {
        const newPlayer = game.allPlayers.find(p => p.id === oldPlayer.id);
        if (newPlayer) {
          newPlayer.clientPlayerId = oldPlayer.clientPlayerId;
          connectedClients.set(socketId, newPlayer);
        }
      }

      for (const p of connectedClients.values()) {
        p.isAI = false;
        p.isAlive = true;
        p.needsPlanet = true;
        p.lastCommandTime = now;
        p.discoveredPlanets = new Set();
        p.attackedPlanets = new Map();
        p.cruiserStyle = null;
        p.credits = 0;
        
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
      
      // Process pending game chat messages
      if (game.pendingChatMessages && game.pendingChatMessages.length > 0) {
        for (const msg of game.pendingChatMessages) {
          for (const [socketId, player] of connectedClients.entries()) {
            if (player.id === msg.playerId) {
              io.to(socketId).emit('chatMessage', {
                sender: 'System',
                color: '#ffb74d',
                text: msg.text
              });
            }
          }
        }
        game.pendingChatMessages = [];
      }
    } else if (game.isRunning && game.isPaused) {
      // Pause logic is not needed for AFK since AFK is removed
    }

    tickCount++;



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
                const gravityRadius = otherPlanet.getGravityRadius();
                
                if (dx*dx + dy*dy < gravityRadius * gravityRadius) {
                  if (otherPlanet.owner === owner) {
                    let mult = 0.002;
                    if (otherPlanet.isMilitary || otherPlanet.focusMode === 'garrison') {
                      if (otherPlanet.ships >= otherPlanet.maxShips * 2 - 10) {
                        mult = 0.0045;
                      } else if (otherPlanet.ships >= otherPlanet.maxShips) {
                        mult = 0.003;
                      }
                    }
                    friendlyPlanetBoost += mult * Math.floor(otherPlanet.ships / 10);
                  } else if (p.owner !== null && otherPlanet.owner === p.owner) {
                    let mult = 0.002;
                    if (otherPlanet.isMilitary || otherPlanet.focusMode === 'garrison') {
                      if (otherPlanet.ships >= otherPlanet.maxShips * 2 - 10) {
                        mult = 0.0045;
                      } else if (otherPlanet.ships >= otherPlanet.maxShips) {
                        mult = 0.003;
                      }
                    }
                    defenderPlanetPenalty += mult * Math.floor(otherPlanet.ships / 10);
                  }
                }
              }
            }
            
            const attackerTechBonus = 0.01 * Math.sqrt(owner.techScore || 0);
            const attackerExpBonus = 0.01 * Math.sqrt(owner.expScore || 0);
            const defenderTechPenalty = 0.01 * Math.sqrt(p.owner ? (p.owner.techScore || 0) : 0);
            const defenderExpPenalty = 0.01 * Math.sqrt(p.owner ? (p.owner.expScore || 0) : 0);
            
            let maxShipExp = 0;
            for (const s of ships) {
              if (s.expScore > maxShipExp) maxShipExp = s.expScore;
            }
            const attackerLocalExpBonus = 0.01 * Math.sqrt(maxShipExp || 0);
            const defenderLocalExpPenalty = 0.01 * Math.sqrt(p.expScore || 0);
            
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
            
            let hazardPenalty = 0;
            if (game.storms) {
              for (const storm of game.storms) {
                if (storm.type === 'minefield') continue;
                const sdx = p.x - storm.x;
                const sdy = p.y - storm.y;
                if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
                  const knowledge = (storm.knowledge && typeof storm.knowledge === 'object') ? (storm.knowledge[owner.id] || 0) : (storm.knowledge || 0);
                  const tRed = Math.sqrt(owner.techScore || 0);
                  const eRed = Math.sqrt(owner.expScore || 0);
                  const sRed = Math.sqrt(maxShipExp || 0);
                  const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                  hazardPenalty += eff / 100;
                }
              }
            }

            const minKillChance = attackerTechBonus + attackerExpBonus + attackerLocalExpBonus;
            const matchesAnyAttacker = ships.some(s => s.cruiserStyle === p.racialAffinity) || (owner && owner.cruiserStyle === p.racialAffinity);
            const racialDefenseBonus = !matchesAnyAttacker ? 0.15 : 0;
            let killChance = Math.max(minKillChance, 0.8 - penalty + advantage + friendlyPlanetBoost - defenderPlanetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - defenderTechPenalty - defenderExpPenalty - defenderLocalExpPenalty - lastStandPenalty - defenderHomeworldPenalty - humanDefenderBonus - racialDefenseBonus);
            killChance = Math.max(minKillChance, killChance - hazardPenalty);
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

        // Calculate final production rate with soft-cap
        let finalRate = 0;
        if (p.owner) {
          const isHuman = !p.owner.isAI;
          const focus = p.focusMode || 'economy';
          const growthLimit = (isHuman && focus === 'garrison') ? p.maxShips * 2 : p.maxShips;
          
          if (p.ships < growthLimit || p.owner.isAI) {
            const techBonus = p.owner.techScore ? 0.01 * Math.sqrt(p.owner.techScore) : 0;
            const lowPopMultiplier = Math.min(1.0, 0.10 + 0.02 * Math.max(0, p.ships - 5));
            const effectiveMaxShips = p.rampageBoost ? p.maxShips * 3 : p.maxShips;
            const prodDivisor = 100 / (game.settings?.productionMultiple || 1.0);
            finalRate = (Math.max(10, effectiveMaxShips - p.ships) / prodDivisor) * (1 + techBonus) * lowPopMultiplier;
            if (p.homeworldOf === p.owner.id) {
              finalRate *= 2;
            }
            if (isHuman) {
              if (finalRate > 1.0) {
                finalRate = 1.0 + ((finalRate - 1.0) / 3);
              }
            }
          }
        }

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
          rampageIncubating: p.rampageIncubating || false,
          isAICandidate: p.isAICandidate || false,
          defeatEvent: dEvent,
          homeworldOf: p.homeworldOf,
          lastStandEvent: lEvent,
          homeworldEvent: hwEvent,
          isResearch: p.isResearch,
          isMilitary: p.isMilitary,
          isSpeedPlanet: p.isSpeedPlanet,
          focusMode: p.focusMode || 'economy',
          focusChanges: p.focusChanges || 0,
          sympathy: p.sympathy || null,
          disposition: p.disposition || null,
          revoltCooldown: p.revoltCooldown || 0,
          focusTransition: p.focusTransition ? {
            targetMode: p.focusTransition.targetMode,
            progress: Math.min(1.0, p.focusTransition.elapsed / 15000)
          } : null,
          finalRateExceedsOne: finalRate > 1.0,
          resources: p.resources || null,
          preferredResource: p.preferredResource || null,
          racialAffinity: p.racialAffinity || null
      };
    });

    const allShipsMapped = game.ships.map(s => {
      const bEvent = s.beakerIncreaseEvent || 0;
      s.beakerIncreaseEvent = 0;
      const dipSuccess = s.diplomatSuccessEvent || 0;
      s.diplomatSuccessEvent = 0;
      const dipFailure = s.diplomatFailureEvent || 0;
      s.diplomatFailureEvent = 0;
      const dipFailureChance = s.diplomatFailureChance || 0;
      s.diplomatFailureChance = 0;
      const dipPrefResource = s.diplomatPrefResourceEvent || 0;
      s.diplomatPrefResourceEvent = 0;

      const consumeEvents = s.resourceConsumeEvents ? { ...s.resourceConsumeEvents } : null;
      if (s.resourceConsumeEvents) {
        s.resourceConsumeEvents = { deuterium: 0, tritanium: 0, duranium: 0, merculite: 0, antimatter: 0, dilithium: 0 };
      }

      if (s.isCruiser || s.isAmoeba) {
        return {
          id: s.id,
          x: s.x,
          y: s.y,
          count: s.count || 1,
          ownerId: s.owner ? s.owner.id : null,
          active: s.active,
          expScore: s.expScore || 0,
          isBomber: s.isBomber,
          isCruiser: s.isCruiser || false,
          name: s.name || null,
          classType: s.classType || null,
          isAmoeba: s.isAmoeba || false,
          health: s.health || 0,
          maxHealth: s.maxHealth || 0,
          bombs: s.bombs || 0,
          bombReloadTimer: s.bombReloadTimer || 0,
          labs: s.labs || 0,
          sensorarrays: s.sensorarrays || 0,
          armor: s.armor || 0,
          armorPoints: s.armorPoints || 0,
          maxArmor: s.maxArmor || 0,
          shields: s.shields || 0,
          engine: s.engine || 0,
          munitions: s.munitions || 0,
          splashDamage: s.splashDamage || 0,
          targeting: s.targeting || 0,
          damagecontrol: s.damagecontrol || 0,
          fuel_tanker: s.fuel_tanker || 0,
          supplies: s.supplies || 0,
          maxsupplies: s.maxsupplies || 0,
          specialfuel: s.specialfuel || 0,
          specialbombs: s.specialbombs || 0,
          resourceConsumeEvents: consumeEvents,
          diplomat: s.diplomat || 0,
          marines: s.marines || 0,
          diplomatTargetPlanetId: s.diplomatTargetPlanetId || null,
          crew: s.crew || 0,
          marineCount: s.marineCount || 0,
          isBoardingFleet: s.isBoardingFleet || false,
          isReturnPod: s.isReturnPod || false,
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
          currentSpeed: s.currentSpeed || 0,
          specialduranium: s.specialduranium || 0,
          targetX: s.targetPlanet ? s.targetPlanet.x : s.targetX,
          targetY: s.targetPlanet ? s.targetPlanet.y : s.targetY,
          formation: s.formation,
          beakerIncreaseEvent: bEvent,
          diplomatSuccessEvent: dipSuccess,
          diplomatFailureEvent: dipFailure,
          diplomatFailureChance: dipFailureChance,
          diplomatPrefResourceEvent: dipPrefResource,
          cruiserTargetType: s.cruiserTargetType || null,
          cruiserTargetId: s.cruiserTargetId || null,
          cruiserTargetClickX: s.cruiserTargetClickX !== undefined ? s.cruiserTargetClickX : null,
          cruiserTargetClickY: s.cruiserTargetClickY !== undefined ? s.cruiserTargetClickY : null,
          orderQueue: s.orderQueue ? s.orderQueue.map(o => {
            if (o.type === 'moveSpace') {
              return { type: o.type, targetX: o.targetX, targetY: o.targetY };
            } else if (o.type === 'movePlanet') {
              return { type: o.type, targetId: o.targetId, offsetX: o.offsetX || 0, offsetY: o.offsetY || 0 };
            } else if (o.type === 'target') {
              return { type: o.type, targetType: o.targetType, targetId: o.targetId, clickX: o.clickX || null, clickY: o.clickY || null };
            }
            return null;
          }).filter(Boolean) : [],
          bombPlanetsEnabled: s.bombPlanetsEnabled !== false,
          isPatrolling: s.isPatrolling || false,
          isScouting: s.isScouting || false,
          isResearching: s.isResearching || false,
          isDiplomacy: s.isDiplomacy || false,
          scoutAttackEnabled: s.scoutAttackEnabled || false,
          isMaterializing: s.isMaterializing || false,
          materializeProgress: s.materializeProgress !== undefined ? s.materializeProgress : 1.0,
          cruiserStyle: s.cruiserStyle || null,
          package: s.package || 'ranged',
          tactics: s.tactics || 'normal',
          strategy: s.strategy || 'normal'
        };
      } else {
        return null;
      }
    });

    for (const [socketId, player] of connectedClients.entries()) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock && sock.conn && sock.conn.writeBuffer) {
        const bufferLen = sock.conn.writeBuffer.length;
        if (bufferLen > 8) {
          // Extremely congested socket: drop the tick entirely to allow the buffer to clear
          continue;
        } else if (bufferLen > 3) {
          // Mildly congested socket: rate-limit to 5 FPS to reduce traffic without losing telemetry
          if (tickCount % 4 !== 0) {
            continue;
          }
        }
      }

      if (!player.discoveredPlanets) {
        player.discoveredPlanets = new Set();
      }
      
      let visiblePlanets = [];
      let visibleShips = [];
      let visibleExplosions = [];
      let visibleLasers = [];

      const playerTechBonus = 0.01 * Math.floor(Math.sqrt(player.techScore || 0));
      const playerExpBonus = 0.01 * Math.sqrt(player.expScore || 0);

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
        fleet.radarRange = 50 * scaleMap;

        let maxCruiserRange = 0;
        for (const s of fleet.ships) {
          if (s.maxHealth > 0) {
            const shipRange = s.cruiserRadarRange();
            if (shipRange > maxCruiserRange) maxCruiserRange = shipRange;
          }
        }
        if (maxCruiserRange > 0) {
          fleet.radarRange = Math.max(fleet.radarRange, maxCruiserRange * scaleMap);
        }

        if (fleet.ships.length > 0) {
          const clusters = [];
          const clusterGrid = new Map();
          const r = fleet.radarRange;
          const cellSize = r > 0 ? r : 75;
          for (const s of fleet.ships) {
            const col = Math.floor(s.x / cellSize);
            const row = Math.floor(s.y / cellSize);
            let found = false;
            for (let dc = -1; dc <= 1; dc++) {
              for (let dr = -1; dr <= 1; dr++) {
                const key = `${col + dc},${row + dr}`;
                const cellClusters = clusterGrid.get(key);
                if (cellClusters) {
                  for (const c of cellClusters) {
                    const dx = c.x - s.x;
                    const dy = c.y - s.y;
                    if (dx*dx + dy*dy < r * r) {
                      if (s.isCruiser) c.isCruiser = true;
                      found = true;
                      break;
                    }
                  }
                }
                if (found) break;
              }
              if (found) break;
            }
            if (!found) {
              const newCluster = { x: s.x, y: s.y, radarRange: r, ownerId: player.id, isCruiser: s.isCruiser || false };
              clusters.push(newCluster);
              const key = `${col},${row}`;
              if (!clusterGrid.has(key)) {
                clusterGrid.set(key, []);
              }
              clusterGrid.get(key).push(newCluster);
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
            const gravityRadius = p.getGravityRadius();
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
            const gravityRadius = p.getGravityRadius() * 1.5;
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
        const hasSympathy = p.sympathy && p.sympathy[player.id] > 0;
        if ((p.owner && p.owner.id === player.id) || isVisible(p.x, p.y) || hasSympathy) {
          player.discoveredPlanets.add(p.id);
          const mappedPlanet = Object.assign({}, allPlanetsMapped[i]);
          if (player.spyRootedEvents && player.spyRootedEvents.has(p.id)) mappedPlanet.spyRootedOutEvent = true;
          visiblePlanets.push(mappedPlanet);
        } else if (isSilhouetteVisible(p.x, p.y) || player.discoveredPlanets.has(p.id) || p.rampageEvent) {
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
              ownerId: p.owner ? p.owner.id : null,
              ships: 0,
              maxShips: p.maxShips,
              inFog: true,
              spyRootedOutEvent: spyRooted,
              isSpeedPlanet: p.isSpeedPlanet,
              isResearch: p.isResearch,
              isMilitary: p.isMilitary,
              rampageEvent: p.rampageEvent || false,
              rampageIncubating: p.rampageIncubating || false,
              isAICandidate: p.isAICandidate || false,
              resources: p.resources || null,
              expScore: p.expScore || 0
            });
          }
        }
      }

      const visibleFlatShips = [];
      for (let i = 0; i < game.ships.length; i++) {
        const s = game.ships[i];
        if ((s.owner && s.owner.id === player.id) || isVisible(s.x, s.y)) {
          if (s.isCruiser || s.isAmoeba) {
            visibleShips.push(allShipsMapped[i]);
          } else {
            const ownerIdx = s.owner ? game.allPlayers.indexOf(s.owner) : -1;
            visibleFlatShips.push(
              s.id,
              Math.round(s.x * 10) / 10,
              Math.round(s.y * 10) / 10,
              s.count || 1,
              ownerIdx,
              s.active ? 1 : 0,
              s.isBomber ? 1 : 0,
              s.isInterceptor ? 1 : 0,
              s.isBoardingFleet ? 1 : 0,
              s.isReturnPod ? 1 : 0,
              Math.round(s.angle * 100) / 100,
              Math.round((s.targetPlanet ? s.targetPlanet.x : (s.targetX || 0)) * 10) / 10,
              Math.round((s.targetPlanet ? s.targetPlanet.y : (s.targetY || 0)) * 10) / 10,
              Math.round((s.health || 0) * 10) / 10,
              Math.round((s.expScore || 0) * 10) / 10,
              Math.round((s.flightTime || 0) * 10) / 10,
              Math.round((s.currentSpeed || 0) * 10) / 10
            );
          }
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
              const gr = p.getGravityRadius();
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

      const visibleUpgradeEnhanceEvents = (game.upgradeEnhanceEvents || []).filter(ev => {
        const targetPlanet = game.planets.find(p => p.id === ev.planetId);
        if (!targetPlanet) return false;
        const hasSympathy = targetPlanet.sympathy && targetPlanet.sympathy[player.id] > 0;
        return (targetPlanet.owner && targetPlanet.owner.id === player.id) || isVisible(targetPlanet.x, targetPlanet.y) || hasSympathy;
      });

      const visibleAccuracyEvents = (game.accuracyEvents || []).filter(ev => {
        return isVisible(ev.x, ev.y);
      });

      const state = {
        planets: visiblePlanets,
        ships: visibleShips,
        flatShips: visibleFlatShips,
        fleets: visibleFleets,
        explosions: visibleExplosions,
        lasers: visibleLasers,
        storms: visibleStorms,
        players: game.allPlayers,
        globalUpgradeModifiers: game.globalUpgradeModifiers,
        upgradeEnhanceEvents: visibleUpgradeEnhanceEvents,
        accuracyEvents: visibleAccuracyEvents,
        galacticCapacity: game.galacticCapacity,
        sellOrders: game.sellOrders || [],
        isPaused: game.isPaused,
        isRunning: game.isRunning,
        gameOverMessage: game.gameOverMessage,
        settings: game.settings,
        timeRemaining: game.timeRemaining,
        width: game.width,
        height: game.height
      };
      
      io.to(socketId).emit('gameStateUpdate', state);
    }

    // Clear upgrade enhancement events after broadcasting to all clients
    game.upgradeEnhanceEvents = [];
    game.accuracyEvents = [];
    
  }, TICK_RATE);

  const PORT = process.env.PORT || 5173;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
