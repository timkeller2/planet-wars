import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Game } from './src/game.js';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_VERSION = "1.0.0";
const savesDir = path.join(__dirname, 'saves');
if (!fs.existsSync(savesDir)) {
  fs.mkdirSync(savesDir, { recursive: true });
}

const shipConfigsDir = path.join(savesDir, 'ship_configs');
if (!fs.existsSync(shipConfigsDir)) {
  fs.mkdirSync(shipConfigsDir, { recursive: true });
}

function getConfigsForPlayer(playerName) {
  if (!playerName) return [];
  const sanitized = playerName.replace(/[^a-z0-9_-]/gi, '_');
  const filePath = path.join(shipConfigsDir, `${sanitized}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('[Load Ship Configs Error]', e);
  }
  return [];
}

function saveConfigsForPlayer(playerName, configs) {
  if (!playerName) return;
  const sanitized = playerName.replace(/[^a-z0-9_-]/gi, '_');
  const filePath = path.join(shipConfigsDir, `${sanitized}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(configs, null, 2), 'utf8');
  } catch (e) {
    console.error('[Save Ship Configs Error]', e);
  }
}

function sendShipConfigs(socket, playerName) {
  const configs = getConfigsForPlayer(playerName);
  socket.emit('shipConfigsList', configs);
}

async function bootstrap() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    perMessageDeflate: true
  });

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
  game.gameSpeed = 1.0;
  
  const connectedClients = new Map(); // socket.id -> player reference
  let lastHumanActivityTime = Date.now();

  function executeCommand(cmdStr, player, socket, io, game) {
    const hasCheats = true;

    const cleanCmd = cmdStr.trim().replace(/^\//, '');
    const parts = cleanCmd.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    let targetPlayer = player || game.humanPlayer;
    if (!targetPlayer) {
      return "No valid player target found.";
    }

    switch (cmd) {
      case 'help':
        return `Available Commands:
/ships <number> - Set ships on all owned planets.
/credits <number> - Set credits.
/tech <number> - Set technology level.
/exp <number> - Set experience level.
/pause - Toggle game pause.
/speed <number> - Set game simulation speed multiplier.
/amoeba - Spawn a space amoeba.
/clear - Clear all space amoebas.
/<resource> <number> - Set resource stockpile (e.g. /latinum 100).`;

      case 'ships': {
        const amt = parseInt(args[0], 10);
        if (isNaN(amt)) return "Usage: /ships <number>";
        let count = 0;
        for (const p of game.planets) {
          if (p.owner === targetPlayer) {
            p.ships = amt;
            count++;
          }
        }
        if (count === 0) {
          // If they don't own any planets, find the first neutral and set it
          const homeworld = game.planets.find(p => p.homeworldOf === targetPlayer.id);
          if (homeworld) {
            homeworld.owner = targetPlayer;
            homeworld.ships = amt;
            count++;
          }
        }
        return `Set ships to ${amt} on ${count} planets owned by ${targetPlayer.name}.`;
      }

      case 'credits': {
        const amt = parseInt(args[0], 10);
        if (isNaN(amt)) return "Usage: /credits <number>";
        targetPlayer.credits = amt;
        return `Set credits of ${targetPlayer.name} to ${amt}.`;
      }

      case 'tech': {
        const amt = parseFloat(args[0]);
        if (isNaN(amt)) return "Usage: /tech <number>";
        targetPlayer.techScore = amt;
        return `Set techScore of ${targetPlayer.name} to ${amt}.`;
      }

      case 'exp': {
        const amt = parseFloat(args[0]);
        if (isNaN(amt)) return "Usage: /exp <number>";
        targetPlayer.expScore = amt;
        return `Set expScore of ${targetPlayer.name} to ${amt}.`;
      }

      case 'pause': {
        game.isPaused = !game.isPaused;
        return `Game is now ${game.isPaused ? 'PAUSED' : 'UNPAUSED'}.`;
      }

      case 'speed': {
        const val = parseFloat(args[0]);
        if (isNaN(val)) return "Usage: /speed <number>";
        game.gameSpeed = val;
        return `Game simulation speed modifier set to ${val}.`;
      }

      case 'amoeba': {
        if (typeof game.spawnAmoebaCheat === 'function') {
          const spawned = game.spawnAmoebaCheat();
          if (spawned) {
            return `Spawned Amoeba ship ${spawned.id} at (${Math.round(spawned.x)}, ${Math.round(spawned.y)}).`;
          }
        }
        return "Spawn amoeba failed (monster player or spawn method not initialized).";
      }

      case 'clear': {
        let count = 0;
        for (let i = game.ships.length - 1; i >= 0; i--) {
          if (game.ships[i].isAmoeba) {
            game.ships[i].active = false;
            game.ships.splice(i, 1);
            count++;
          }
        }
        return `Cleared ${count} active amoeba ships from simulation.`;
      }

      default: {
        // Check if it's a resource command
        const resources = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
        if (resources.includes(cmd)) {
          const amt = parseFloat(args[0]);
          if (isNaN(amt)) return `Usage: /${cmd} <number>`;
          if (!targetPlayer.resources) targetPlayer.resources = {};
          targetPlayer.resources[cmd] = amt;
          return `Set ${cmd} resource of ${targetPlayer.name} to ${amt}.`;
        }
        return `Unknown command: "${cmd}". Type /help for a list of commands.`;
      }
    }
  }

  // Set up standard input console command listener
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    
    // Target the human player by default
    const feedback = executeCommand(text, game.humanPlayer, null, io, game);
    console.log(`[Console Command Result] ${feedback}`);
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send initial list of save games on connection
    try {
      if (fs.existsSync(savesDir)) {
        const initialSaves = fs.readdirSync(savesDir)
          .filter(file => file.endsWith('.json'))
          .map(file => file.slice(0, -5));
        socket.emit('saveGamesList', initialSaves);
      } else {
        socket.emit('saveGamesList', []);
      }
    } catch (e) {
      console.error('[Save Games List Error]', e);
    }
    
    lastHumanActivityTime = Date.now();
    if (game.isPaused && game.pausedForAFK) {
      game.isPaused = false;
      game.pausedForAFK = false;
      console.log(`[Auto-Unpause] Client connection detected. Unpausing game.`);
    }

    socket.use((packet, next) => {
      lastHumanActivityTime = Date.now();
      const player = connectedClients.get(socket.id);
      if (player) {
        player.lastCommandTime = Date.now();
      }
      if (game.isPaused && game.pausedForAFK) {
        game.isPaused = false;
        game.pausedForAFK = false;
        console.log(`[Auto-Unpause] Human interaction packet detected (${packet ? packet[0] : 'unknown'}). Unpausing game.`);
      }
      next();
    });
    
    const clientId = socket.handshake.query.playerId;
    let assignedPlayer = game.allPlayers.find(p => p.clientPlayerId === clientId);

    if (!assignedPlayer) {
      if (!game.humanPlayer.clientPlayerId) {
        assignedPlayer = game.humanPlayer;
        assignedPlayer.clientPlayerId = clientId;
        assignedPlayer.isAI = false;
        assignedPlayer.lastCommandTime = Date.now();
        assignedPlayer.disconnectTime = null;
      } else {
        const availableExtendedAI = game.aiPlayers.slice(11).find(ai => !ai.clientPlayerId && game.planets.filter(p => p.owner === ai).length === 0);
        if (availableExtendedAI) {
          if (game.assignPlanet(availableExtendedAI)) {
            availableExtendedAI.clientPlayerId = clientId;
            availableExtendedAI.isAI = false;
            availableExtendedAI.lastCommandTime = Date.now();
            availableExtendedAI.disconnectTime = null;
            assignedPlayer = availableExtendedAI;
          }
        }
      }
    } else {
      const wasAI = assignedPlayer.isAI;
      assignedPlayer.isAI = false;
      assignedPlayer.lastCommandTime = Date.now();
      assignedPlayer.disconnectTime = null;
      if (wasAI) {
        console.log(`Player ${assignedPlayer.id} reconnected. Restoring control from AI.`);
        io.emit('chatMessage', {
          sender: 'System',
          color: '#39ff14',
          text: `Player ${assignedPlayer.name || assignedPlayer.id} has reconnected. Restoring control.`
        });
      }
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
        if (sourcePlanet.inRevolt) return;
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
        if (sourcePlanet.inRevolt) return;
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
        if (p.inRevolt) return;
        game.buildCapitalShip(p, data.classType);
      }
    });

    socket.on('buildCapitalShipConfig', (data) => {
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
        if (p.inRevolt) return;
        game.buildCapitalShipConfig(p, data.classType, data.upgrades, data.configName);
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
          supplyship: 'supply_ship',
          extendedfuel: 'extended_fuel',
          diplomat: 'diplomat',
          marines: 'marines',
          command: 'command'
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
                                (ship.supply_ship || 0) +
                                (ship.extended_fuel || 0) +
                                (ship.diplomat || 0) +
                                (ship.marines || 0) +
                                (ship.command || 0);

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

          if (ship.upgradeTokens > 0) {
            if (nextLevel <= Math.min(5, maxIndividualLevel)) {
              ship.upgradeTokens--;
              ship.isUpgrading = true;
              ship.upgradeUsingToken = true;
              ship.upgradeTimer = 3.0;
              ship.upgradeProp = prop;
              ship.upgradeType = data.type;
              ship.upgradePlanetId = null;
              ship.upgradeShipsPaid = 0;
              ship.upgradeAccumulator = 0;
              console.log(`Started token upgrade for cruiser ${ship.id} with ${data.type}. Tokens left: ${ship.upgradeTokens}`);
              return;
            } else {
              console.log(`[Server Upgrade Rejected] Token level limit exceeded. nextLevel: ${nextLevel}, maxLevel: ${maxIndividualLevel}`);
              return;
            }
          }

          if (nextLevel > maxIndividualLevel || (totalUpgrades + 1) > maxTotalUpgrades) {
            console.log(`[Server Upgrade Rejected] Health limits exceeded. shipId: ${ship.id}, maxHealth: ${ship.maxHealth}, currentVal: ${currentVal}, next: ${nextLevel}, maxLevel: ${maxIndividualLevel}, totalUpgrades: ${totalUpgrades}, maxTotalUpgrades: ${maxTotalUpgrades}`);
            return;
          }

          const cost = game.getUpgradeCost(ship, data.type);

          let minAllowedCredits = 0;
          const ownsHomeworld = game.planets.some(p => p.homeworldOf === player.id && p.owner && p.owner.id === player.id);
          if (ownsHomeworld) {
            minAllowedCredits = -(1000 + Math.floor(player.totalShips || 0));
          }

          let closestPlanet = null;
          let closestDistSq = Infinity;

          for (const p of game.planets) {
            const creditsAvailable = (player.credits || 0) - minAllowedCredits;
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
                // Exception: If the player has enough credits to cover the cost of the upgrade.
                const isSuchGarrisonWorld = (p.isMilitary || p.focusMode === 'garrison') && (p.ships >= p.maxShips * 2 - 10);
                const hasEnoughCredits = creditsAvailable >= cost;
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

    socket.on('dismantleCruisers', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      player.lastCommandTime = Date.now();
      player.afkWarningSent = false;
      if (player.isAI) {
        player.isAI = false;
      }

      if (data && Array.isArray(data.shipIds)) {
        for (const shipId of data.shipIds) {
          const ship = game.ships.find(s => s.id === shipId);
          if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id && !ship.isDismantling) {
            let inFriendlyWell = false;
            for (const pl of game.planets) {
              if (pl.owner && pl.owner.id === player.id) {
                const gr = pl.getGravityRadius();
                const dx = pl.x - ship.x;
                const dy = pl.y - ship.y;
                if (dx * dx + dy * dy <= gr * gr) {
                  inFriendlyWell = true;
                  break;
                }
              }
            }
            if (inFriendlyWell) {
              ship.startDismantle(game);
              console.log(`[Server Dismantle Started] Player: ${player.name}, shipId: ${shipId}`);
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

      game.moveShipsToSpace(player, data.shipIds, data.targetX, data.targetY, data.isWarp, data.speedModifier, data.isShift);
    });

    socket.on('chatMessage', (text) => {
      const player = connectedClients.get(socket.id);
      if (player && text && typeof text === 'string' && text.trim().length > 0) {
        const cleanText = text.trim();
        
        if (cleanText.startsWith('-save')) {
          const parts = cleanText.split(/\s+/);
          const saveName = parts.slice(1).join(' ').trim();
          if (!saveName) {
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#ff3333',
              text: 'Usage: -save <name>'
            });
            return;
          }
          const sanitized = saveName.replace(/[^a-zA-Z0-9_\-]/g, '');
          if (!sanitized || sanitized !== saveName) {
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#ff3333',
              text: 'Save name must contain only letters, numbers, underscores, and hyphens.'
            });
            return;
          }
          try {
            const state = game.saveState();
            const filePath = path.join(savesDir, `${sanitized}.json`);
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#00ff00',
              text: `Game successfully saved as '${sanitized}'.`
            });
            try {
              const updatedSaves = fs.readdirSync(savesDir)
                .filter(file => file.endsWith('.json'))
                .map(file => file.slice(0, -5));
              io.emit('saveGamesList', updatedSaves);
            } catch (e) {
              console.error('[Save Broadcast Error]', e);
            }
            console.log(`[Save Game] Game successfully saved as '${sanitized}' by player ${player.name} (${player.id})`);
          } catch (err) {
            console.error('[Save Game Error]', err);
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#ff3333',
              text: `Failed to save game: ${err.message}`
            });
          }
          return;
        }

        if (cleanText.startsWith('-load')) {
          const parts = cleanText.split(/\s+/);
          const saveName = parts.slice(1).join(' ').trim();
          if (!saveName) {
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#ff3333',
              text: 'Usage: -load <name>'
            });
            return;
          }
          const sanitized = saveName.replace(/[^a-zA-Z0-9_\-]/g, '');
          const filePath = path.join(savesDir, `${sanitized}.json`);
          if (!fs.existsSync(filePath)) {
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#ff3333',
              text: `Save game '${sanitized}' not found.`
            });
            return;
          }
          try {
            const fileData = fs.readFileSync(filePath, 'utf-8');
            const state = JSON.parse(fileData);
            
            if (!state.version || state.version !== GAME_VERSION) {
              socket.emit('chatMessage', {
                sender: 'System',
                color: '#ff3333',
                text: `Save game is incompatible with this version of Amoeba Wars (save version: ${state.version || 'unknown'}, current: ${GAME_VERSION}).`
              });
              return;
            }

            game.loadState(state);

            for (const [socketId, oldPlayer] of connectedClients.entries()) {
              const newPlayer = game.allPlayers.find(p => p.id === oldPlayer.id);
              if (newPlayer) {
                newPlayer.clientPlayerId = oldPlayer.clientPlayerId;
                connectedClients.set(socketId, newPlayer);
              }
            }

            for (const [socketId, activePlayer] of connectedClients.entries()) {
              io.to(socketId).emit('assignedPlayer', activePlayer);
            }

            io.emit('chatMessage', {
              sender: 'System',
              color: '#00ff00',
              text: `Game state '${sanitized}' loaded successfully.`
            });
            console.log(`[Load Game] Game successfully loaded '${sanitized}' by player ${player.name} (${player.id})`);
          } catch (err) {
            console.error('[Load Game Error]', err);
            socket.emit('chatMessage', {
              sender: 'System',
              color: '#ff3333',
              text: `Failed to load game: ${err.message}`
            });
          }
          return;
        }

        if (cleanText.startsWith('/')) {
          const feedback = executeCommand(cleanText, player, socket, io, game);
          socket.emit('chatMessage', {
            sender: 'System',
            color: '#00e5ff',
            text: feedback
          });
          console.log(`[Cheat Command] Player ${player.name} (${player.id}) ran command: ${cleanText}`);
          return;
        }
        const cleanTextToBroadcast = cleanText.substring(0, 100);
        io.emit('chatMessage', {
          sender: player.name,
          color: player.color,
          text: cleanTextToBroadcast
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
          ship.groupSpeedLimit = null;
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
            const targetPlanet = targetType === 'planet' ? game.planets.find(p => p.id === targetId) : null;
            const tx = (clickX !== undefined && clickX !== null) ? clickX : (targetPlanet ? targetPlanet.x : ship.x);
            const ty = (clickY !== undefined && clickY !== null) ? clickY : (targetPlanet ? targetPlanet.y : ship.y);
            ship.handlePlayerMoveOrder({ planet: targetPlanet, x: tx, y: ty }, game);

            ship.orderQueue = [];
            const isAttackingAndInjured = ship.isPatrolling && (ship.combatCooldown > 0) && (ship.health < ship.maxHealth);
            if (ship.isPatrolling && targetType !== 'ship' && targetType !== 'planet' && !isAttackingAndInjured) {
              ship.patrolStationX = tx;
              ship.patrolStationY = ty;
              ship.targetX = tx;
              ship.targetY = ty;
              ship.targetPlanet = null;
              ship.cruiserTargetType = null;
              ship.cruiserTargetId = null;
            } else {
              ship.isPatrolling = false;
              ship.patrolReloading = false;
              ship.cruiserTargetType = targetType;
              ship.cruiserTargetId = targetId;
              ship.cruiserTargetClickX = clickX !== undefined ? clickX : null;
              ship.cruiserTargetClickY = clickY !== undefined ? clickY : null;
            }
          }
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
        ship.isRetreating = false;
        ship.retreatTargetPlanetId = null;
        if (ship.isPatrolling) {
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
        ship.isRetreating = false;
        ship.retreatTargetPlanetId = null;
        ship.targetPlanet = null;
        if (ship.isScouting) {
          ship.isPatrolling = false;
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
        if (enabled === 'peace') {
          ship.scoutAttackEnabled = 'peace';
        } else {
          ship.scoutAttackEnabled = !!enabled;
        }
      }
    });

    socket.on('toggleTradeLimit', () => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;
      player.tradeLimitToggle = !player.tradeLimitToggle;
    });

    socket.on('toggleCruiserUseResources', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { shipId, enabled } = data;
      if (shipId === undefined || enabled === undefined) return;

      const ship = game.ships.find(s => s.id === shipId);
      if (ship && ship.isCruiser && ship.owner && ship.owner.id === player.id) {
        ship.useResources = !!enabled;
      }
    });

    socket.on('togglePlanetUseResources', (data) => {
      if (!game.isRunning || game.isPaused) return;
      const player = connectedClients.get(socket.id);
      if (!player) return;

      const { planetId, enabled } = data;
      if (planetId === undefined || enabled === undefined) return;

      const planet = game.planets.find(p => p.id === planetId);
      if (planet && planet.owner && planet.owner.id === player.id) {
        planet.useResources = !!enabled;
      }
    });






    socket.on('togglePause', () => {
      game.isPaused = !game.isPaused;
    });

    socket.on('changeGameSpeed', (data) => {
      if (data && data.direction !== undefined) {
        let current = game.gameSpeed || 1.0;
        if (data.direction === 'up') {
          current += 0.1;
        } else if (data.direction === 'down') {
          current -= 0.1;
        }
        game.gameSpeed = Math.max(0.1, Math.min(5.0, Math.round(current * 10) / 10));
      }
    });

    socket.on('setName', (name) => {
      const player = connectedClients.get(socket.id);
      if (player && name && typeof name === 'string') {
        player.name = name.substring(0, 16); // limit length
        sendShipConfigs(socket, player.name);
      }
    });

    socket.on('saveShipConfig', (configData) => {
      const player = connectedClients.get(socket.id);
      if (!player || !player.name || !configData || !configData.name) return;
      
      let configs = getConfigsForPlayer(player.name);
      configs = configs.filter(c => c.name !== configData.name);
      configs.push({
        name: configData.name,
        classType: configData.classType,
        upgrades: configData.upgrades
      });
      saveConfigsForPlayer(player.name, configs);
      sendShipConfigs(socket, player.name);
    });

    socket.on('deleteShipConfig', (configName) => {
      const player = connectedClients.get(socket.id);
      if (!player || !player.name || !configName) return;
      
      let configs = getConfigsForPlayer(player.name);
      configs = configs.filter(c => c.name !== configName);
      saveConfigsForPlayer(player.name, configs);
      sendShipConfigs(socket, player.name);
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
        const now = Date.now();
        if (player.lastBundleSaleTime && now - player.lastBundleSaleTime < 5 * 60 * 1000) {
          console.log(`[Bank Direct Sale] Blocked: Player ${player.id} direct sale bundle is on cooldown.`);
          return;
        }

        if (player.tradeOptions === undefined) {
          player.tradeOptions = player.tradeCapacity || 5;
        }

        const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium'];
        const eligible = [];
        for (const res of resourcesList) {
          const qty = player.resources[res] || 0;
          if (qty >= 1.0) {
            eligible.push({ name: res, count: 1 });
          }
        }
        const latinumQty = player.resources['latinum'] || 0;
        const latinumSold = Math.min(4, Math.floor(latinumQty));
        if (latinumSold >= 1) {
          eligible.push({ name: 'latinum', count: latinumSold });
        }

        let L = 0;
        for (const item of eligible) {
          L += item.count;
        }

        // Allow sale if they have at least 1 trade option
        if (L > 0 && player.tradeOptions >= 1) {
          player.lastBundleSaleTime = now;
          const sellPrice = L + 2;
          for (const item of eligible) {
            player.resources[item.name] = (player.resources[item.name] || 0) - item.count;
          }
          let totalGain = sellPrice * L;
          if (latinumSold >= 1) {
            totalGain = Math.round(totalGain * (1 + 0.10 * latinumSold));
          }
          player.credits = (player.credits || 0) + totalGain;
          
          // Deduct options count (cost), can go negative: 1 + 1/2 resources rounded up
          const optionsExpended = Math.ceil(1 + L / 2);
          player.tradeOptions = (player.tradeOptions || 0) - optionsExpended;

          console.log(`[Bank Direct Sale] Player ${player.id} sold ${L} resources for ${totalGain} credits. Remaining options: ${player.tradeOptions}`);
        }
      }
    });

    socket.on('changeSellPriceSetting', (data) => {
      const player = connectedClients.get(socket.id);
      if (player) {
        if (data && typeof data.value === 'number') {
          player.sellPriceSetting = Math.max(1, data.value);
        } else {
          player.sellPriceSetting = (player.sellPriceSetting || 1) + 1;
        }
      }
    });

    socket.on('createAutoBuyOrder', (data) => {
      const player = connectedClients.get(socket.id);
      if (player) {
        if (!player.autoBuyOrders) player.autoBuyOrders = [];
        
        const existingOrder = player.autoBuyOrders.find(o => o.resource === data.resource);
        if (existingOrder) {
          existingOrder.price = data.price;
          console.log(`[Auto Buy Update] Player ${player.id} updated Auto Buy Order for ${data.resource} to <= ${data.price} credits.`);
        } else {
          const orderId = "autobuy_" + Math.random().toString(36).substring(2, 9);
          player.autoBuyOrders.push({
            id: orderId,
            isAutoBuy: true,
            ownerId: player.id,
            ownerName: player.name,
            resource: data.resource,
            price: data.price
          });
          console.log(`[Auto Buy Create] Player ${player.id} created Auto Buy Order for ${data.resource} at <= ${data.price} credits.`);
        }
      }
    });

    socket.on('cancelAutoBuyOrder', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && player.autoBuyOrders) {
        const idx = player.autoBuyOrders.findIndex(o => o.id === data.orderId);
        if (idx !== -1) {
          player.autoBuyOrders.splice(idx, 1);
          console.log(`[Auto Buy Cancel] Player ${player.id} cancelled Auto Buy Order ${data.orderId}.`);
        }
      }
    });

    socket.on('setAllAutoBuysToSellPrice', () => {
      const player = connectedClients.get(socket.id);
      if (player) {
        if (!player.autoBuyOrders) player.autoBuyOrders = [];
        const resources = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
        const price = player.sellPriceSetting || 1;
        
        for (const res of resources) {
          const existingOrder = player.autoBuyOrders.find(o => o.resource === res);
          if (existingOrder) {
            existingOrder.price = price;
          } else {
            const orderId = "autobuy_" + Math.random().toString(36).substring(2, 9);
            player.autoBuyOrders.push({
              id: orderId,
              isAutoBuy: true,
              ownerId: player.id,
              ownerName: player.name,
              resource: res,
              price: price
            });
          }
        }
        console.log(`[Auto Buy SetAll] Player ${player.id} set all auto buy orders to <= ${price} credits.`);
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
          const startPrice = player.sellPriceSetting || 1;

          game.sellOrders.push({
            id: orderId,
            ownerId: player.id,
            ownerName: player.name,
            resource: data.resource,
            price: startPrice,
            createdAt: Date.now(),
            expiresAt: Date.now() + 30 * 60000 // 30 minutes
          });
          console.log(`[Market Post] Player ${player.id} posted 1 ${data.resource} for ${startPrice} credits.`);
        }
      }
    });

    socket.on('postFulfillOrder', (data) => {
      const player = connectedClients.get(socket.id);
      if (player && player.resources && data && data.resource) {
        if (player.tradeOptions === undefined) {
          player.tradeOptions = player.tradeCapacity || 5;
        }
        const price = player.sellPriceSetting || 1;
        if (player.tradeOptions >= 1 && (player.credits || 0) > 0) {
          player.tradeOptions -= 1;
          
          if (!game.fulfillOrders) game.fulfillOrders = [];
          const orderId = "order_" + Math.random().toString(36).substring(2, 9);
          game.fulfillOrders.push({
            id: orderId,
            ownerId: player.id,
            ownerName: player.name,
            resource: data.resource,
            price: price,
            isFulfill: true,
            createdAt: Date.now(),
            expiresAt: Date.now() + 15 * 60000 // 15 minutes
          });
          console.log(`[Fulfill Post] Player ${player.id} posted fulfill order ${orderId} for 1 ${data.resource} at price ${price} credits.`);
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
          let minAllowedCredits = 0;
          const ownsHomeworld = game.planets.some(p => p.homeworldOf === player.id && p.owner && p.owner.id === player.id);
          if (ownsHomeworld) {
            minAllowedCredits = -(1000 + Math.floor(player.totalShips || 0));
          }
          const buyerCredits = player.credits || 0;
          // Buyer must have >= 1 option and enough credits
          if (order.ownerId !== player.id && player.tradeOptions >= 1 && (buyerCredits - minAllowedCredits) >= order.price) {
            player.tradeOptions -= 1;
            player.credits -= order.price;
            player.resources[order.resource] = (player.resources[order.resource] || 0) + 1.0;
            
             // Pay credits to seller if not neutral
             if (order.ownerId !== 'neutral') {
               const seller = game.allPlayers.find(p => p.id === order.ownerId);
               if (seller) {
                 seller.credits = (seller.credits || 0) + order.price;
                 if (!seller.isAI && seller.id !== 'monsters') {
                   if (!game.pendingChatMessages) game.pendingChatMessages = [];
                   game.pendingChatMessages.push({
                     playerId: seller.id,
                     text: `${player.name || player.id} purchased your sell order of 1 ${order.resource} for ${order.price} credits.`
                   });
                 }
               }
             }
            
            game.recordMarketSale(order.resource, order.price);
            game.sellOrders.splice(idx, 1);
            socket.emit('purchaseSuccess');
            console.log(`[Market Buy] Player ${player.id} bought 1 ${order.resource} from ${order.ownerId} for ${order.price} credits.`);
          }
        }
      }
    });

    socket.on('clickFulfillOrder', (data) => {
      const player = connectedClients.get(socket.id); // clicker
      if (player && player.resources && game.fulfillOrders) {
        const idx = game.fulfillOrders.findIndex(o => o.id === data.orderId);
        if (idx !== -1) {
          const order = game.fulfillOrders[idx];
          
          if (order.ownerId === player.id) {
            // Cancel own fulfill order
            game.fulfillOrders.splice(idx, 1);
            console.log(`[Fulfill Cancel] Player ${player.id} cancelled fulfill order ${order.id}.`);
          } else {
            // Fulfill the order
            const resourceAmount = player.resources[order.resource] || 0;
            if (resourceAmount >= 1.0) {
              const owner = game.allPlayers.find(p => p.id === order.ownerId);
              if (owner) {
                // Transfer 1 resource from clicker to owner
                player.resources[order.resource] -= 1.0;
                owner.resources[order.resource] = (owner.resources[order.resource] || 0) + 1.0;
                
                // Transfer price credits from owner to clicker (can cause owner's credits to go negative)
                owner.credits = (owner.credits || 0) - order.price;
                player.credits = (player.credits || 0) + order.price;
                
                game.recordMarketSale(order.resource, order.price);
                game.fulfillOrders.splice(idx, 1);
                console.log(`[Fulfill Order Fulfilling] Player ${player.id} fulfilled player ${owner.id}'s order ${order.id} for ${order.price} credits.`);
              }
            }
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
      if (planet.inRevolt) return;

      const validModes = ['economy', 'research', 'garrison', 'commerce', 'mining', 'terraforming', 'homeworld'];
      if (!validModes.includes(data.focusMode)) return;
      if (data.focusMode === 'commerce' && planet.maxShips <= 100) return;
      if (data.focusMode === 'terraforming') {
        const techBonus = Math.floor(Math.sqrt(player.techScore || 0));
        const settings = game.settings || {};
        const isUnlimited = !settings.timedGameLimit || settings.timedGameLimit === 'unlimited';
        const timedLimitSecs = !isUnlimited ? parseFloat(settings.timedGameLimit) : null;
        const durationInMinutes = timedLimitSecs ? (timedLimitSecs / 60) : null;
        const multiplier = (durationInMinutes && durationInMinutes > 0) ? (600 / durationInMinutes) : 5;
        const capVal = Math.round(multiplier * techBonus);
        if (planet.habitability > capVal) return;
      }
      if (data.focusMode === 'homeworld') {
        const hasHomeworld = game.planets.some(p => p.homeworldOf === player.id);
        if (hasHomeworld) return;
      }

      if (planet.focusTransition) return; // Prevent concurrent focus shifts on same planet
      const cost = Math.floor(planet.maxShips / 2);
      let minAllowedCredits = 0;
      if (player.id !== 'monsters') {
        const ownsHw = game.planets.some(p => p.homeworldOf === player.id && p.owner === player);
        if (ownsHw) {
          minAllowedCredits = -(1000 + Math.floor(player.totalShips || 0));
        }
      }
      const creditsAvailable = player.useCredits !== false ? Math.max(0, (player.credits || 0) - minAllowedCredits) : 0;
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

    socket.on('deleteSaveGame', (saveName) => {
      if (!saveName || typeof saveName !== 'string') return;
      const sanitized = saveName.replace(/[^a-zA-Z0-9_\-]/g, '');
      const filePath = path.join(savesDir, `${sanitized}.json`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[Delete Save] File '${sanitized}.json' deleted by client request.`);
          // Broadcast updated list to all clients
          const updatedSaves = fs.readdirSync(savesDir)
            .filter(file => file.endsWith('.json'))
            .map(file => file.slice(0, -5));
          io.emit('saveGamesList', updatedSaves);
        } catch (e) {
          console.error('[Delete Save Error]', e);
        }
      }
    });

    socket.on('loadSaveGame', (saveName) => {
      if (!saveName || typeof saveName !== 'string') return;
      const sanitized = saveName.replace(/[^a-zA-Z0-9_\-]/g, '');
      const filePath = path.join(savesDir, `${sanitized}.json`);
      if (!fs.existsSync(filePath)) {
        socket.emit('chatMessage', {
          sender: 'System',
          color: '#ff3333',
          text: `Save game '${sanitized}' not found.`
        });
        return;
      }
      try {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        const state = JSON.parse(fileData);
        
        if (!state.version || state.version !== GAME_VERSION) {
          socket.emit('chatMessage', {
            sender: 'System',
            color: '#ff3333',
            text: `Save game is incompatible (save version: ${state.version || 'unknown'}, current: ${GAME_VERSION}).`
          });
          return;
        }

        game.loadState(state);

        // Assign current sockets to players in the loaded state
        for (const [socketId, oldPlayer] of connectedClients.entries()) {
          const newPlayer = game.allPlayers.find(p => p.id === oldPlayer.id);
          if (newPlayer) {
            newPlayer.clientPlayerId = oldPlayer.clientPlayerId;
            if (oldPlayer.name) {
              newPlayer.name = oldPlayer.name;
            }
            connectedClients.set(socketId, newPlayer);
          }
        }

        for (const [socketId, activePlayer] of connectedClients.entries()) {
          io.to(socketId).emit('assignedPlayer', activePlayer);
        }

        // Notify all clients that a game has successfully loaded
        io.emit('gameLoadedAndStarted', sanitized);
        
        io.emit('chatMessage', {
          sender: 'System',
          color: '#00ff00',
          text: `Game state '${sanitized}' loaded successfully.`
        });
        console.log(`[Load Game Event] Game successfully loaded '${sanitized}'`);
      } catch (err) {
        console.error('[Load Game Event Error]', err);
        socket.emit('chatMessage', {
          sender: 'System',
          color: '#ff3333',
          text: `Failed to load game: ${err.message}`
        });
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
          planetCount: options && options.planetCount !== undefined ? options.planetCount : (options && options.mapSize !== undefined ? Math.round(options.mapSize / 40) : 40),
          clusters: options && options.clusters !== undefined ? parseInt(options.clusters, 10) : 0,
          hazardMultiple: options && options.hazardMultiple !== undefined ? options.hazardMultiple : 1.0,
          timedGameLimit: options && options.timedGameLimit !== undefined ? options.timedGameLimit : "3600",
          homeworldSize: options && options.homeworldSize !== undefined ? options.homeworldSize : "120",
          startingCredits: options && options.startingCredits !== undefined ? parseInt(options.startingCredits, 10) : 0,
          financialVictoryTarget: options && options.financialVictoryTarget !== undefined ? options.financialVictoryTarget : "none",
          graphicalMode: options && options.graphicalMode !== undefined ? !!options.graphicalMode : false,
          enableCheats: options && options.enableCheats !== undefined ? !!options.enableCheats : false,
          aiEntry: options && options.aiEntry !== undefined ? options.aiEntry : 'mid',
          customAiEntryMin: options && options.customAiEntryMin !== undefined ? parseFloat(options.customAiEntryMin) : 5
        };
        if (game.settings.timedGameLimit && game.settings.timedGameLimit !== 'unlimited') {
          game.timeRemaining = parseFloat(game.settings.timedGameLimit);
        } else {
          game.timeRemaining = null;
        }
      }

      if (!game.isRunning) {
        game.initMap();
        game.gameStartTime = Date.now();
        game.isRunning = true;
        game.isPaused = false;
        game.gameSpeed = 1.0;
        game.highestSpeedMilestoneTriggered = 0;
        
        // Ensure all connected clients are assigned to the new players in the new map
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
          p.lastCommandTime = Date.now();
          p.disconnectTime = null;
          p.discoveredPlanets = new Set();
          p.attackedPlanets = new Map();
          p.credits = game.settings && game.settings.startingCredits !== undefined ? game.settings.startingCredits : 0;
        }
        for (const [socketId, activePlayer] of connectedClients.entries()) {
          io.to(socketId).emit('assignedPlayer', activePlayer);
        }
      }

      const p = connectedClients.get(socket.id);
      if (p) {
        p.lastCommandTime = Date.now();
        if (options && options.race && options.race !== 'Random') {
          p.cruiserStyle = options.race;
        } else {
          p.cruiserStyle = null;
        }
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
          planetCount: options && options.planetCount !== undefined ? options.planetCount : (options && options.mapSize !== undefined ? Math.round(options.mapSize / 40) : 40),
          clusters: options && options.clusters !== undefined ? parseInt(options.clusters, 10) : 0,
          hazardMultiple: options && options.hazardMultiple !== undefined ? options.hazardMultiple : 1.0,
          timedGameLimit: options && options.timedGameLimit !== undefined ? options.timedGameLimit : "3600",
          homeworldSize: options && options.homeworldSize !== undefined ? options.homeworldSize : "120",
          startingCredits: options && options.startingCredits !== undefined ? parseInt(options.startingCredits, 10) : 0,
          financialVictoryTarget: options && options.financialVictoryTarget !== undefined ? options.financialVictoryTarget : "none",
          graphicalMode: options && options.graphicalMode !== undefined ? !!options.graphicalMode : false,
          enableCheats: options && options.enableCheats !== undefined ? !!options.enableCheats : false,
          aiEntry: options && options.aiEntry !== undefined ? options.aiEntry : 'mid',
          customAiEntryMin: options && options.customAiEntryMin !== undefined ? parseFloat(options.customAiEntryMin) : 5
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
      game.gameSpeed = 1.0;
      game.highestSpeedMilestoneTriggered = 0;
      
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
        p.disconnectTime = null;
        p.discoveredPlanets = new Set();
        p.attackedPlanets = new Map();
        
        const initiatingPlayer = connectedClients.get(socket.id);
        if (p === initiatingPlayer) {
          if (options && options.race && options.race !== 'Random') {
            p.cruiserStyle = options.race;
          } else {
            p.cruiserStyle = null;
          }
        } else {
          p.cruiserStyle = null;
        }
        
        p.credits = game.settings && game.settings.startingCredits !== undefined ? game.settings.startingCredits : 0;
        const resources = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
        p.autoBuyOrders = resources.map(res => ({
          id: "autobuy_" + Math.random().toString(36).substring(2, 9),
          isAutoBuy: true,
          ownerId: p.id,
          ownerName: p.name || (p.id === 'p1' ? 'Player 1' : 'Player ' + p.id),
          resource: res,
          price: 1
        }));
        
        console.log(`RESTART: Assigning planet for ${p.id}`);
        game.tryAssignPlanet(p);
      }
      for (const [socketId, activePlayer] of connectedClients.entries()) {
        io.to(socketId).emit('assignedPlayer', activePlayer);
      }
    });

    socket.on('disconnect', () => {
      lastHumanActivityTime = Date.now();
      const player = connectedClients.get(socket.id);
      if (player) {
        player.disconnectTime = Date.now();
        console.log(`Player ${player.id} disconnected. 5-minute AI takeover cooldown started.`);
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
  let noClientStartTime = null;

  setInterval(() => {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Check connection timeout victory:
    const activeClientsCount = io.sockets.sockets.size;
    if (game.isRunning && (!game.isPaused || game.pausedForAFK) && activeClientsCount === 0) {
      if (noClientStartTime === null) {
        noClientStartTime = currentTime;
      } else if (currentTime - noClientStartTime >= 15 * 60 * 1000) { // 15 minutes
        console.log(`[Connection Timeout] No clients connected to the running game for 15 minutes. Triggering time victory.`);
        game.triggerTimedGameVictory();
        noClientStartTime = null;
      }
    } else {
      noClientStartTime = null;
    }

    // Check AFK/Inactivity pause:
    if (game.isRunning && !game.isPaused) {
      if (currentTime - lastHumanActivityTime >= 300000) { // 5 minutes
        game.isPaused = true;
        game.pausedForAFK = true;
        console.log(`[Auto-Pause] No human activity for 5 minutes. Pausing game server.`);
      }
    }

    if (game.isRunning && !game.isPaused) {
      // Check if any disconnected players have exceeded the 5-minute cooldown
      for (const p of game.allPlayers) {
        if (!p.isAI && p.disconnectTime && (currentTime - p.disconnectTime >= 300000)) { // 5 minutes
          p.isAI = true;
          p.disconnectTime = null;
          console.log(`[Disconnect AI Takeover] Player ${p.id} disconnected for 5 minutes. Converting to AI.`);
          io.emit('chatMessage', {
            sender: 'System',
            color: '#ffb74d',
            text: `Player ${p.name || p.id} has been offline for 5 minutes. AI is taking control.`
          });
          // Also ensure they are updated in client's assignedPlayer
          for (const [socketId, activePlayer] of connectedClients.entries()) {
            if (activePlayer.id === p.id) {
              io.to(socketId).emit('assignedPlayer', activePlayer);
            }
          }
        }
      }

      const speed = game.gameSpeed || 1.0;
      game.update(deltaTime * speed);
      game.checkWinCondition();
      
      // Process pending game chat messages
      if (game.pendingChatMessages && game.pendingChatMessages.length > 0) {
        for (const msg of game.pendingChatMessages) {
          if (msg.playerId === 'all') {
            io.emit('chatMessage', {
              sender: 'System',
              color: '#ffb74d',
              text: msg.text
            });
          } else {
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
        }
        game.pendingChatMessages = [];
      }

      // Process pending exploration events
      if (game.pendingExplorationEvents && game.pendingExplorationEvents.length > 0) {
        for (const ev of game.pendingExplorationEvents) {
          for (const [socketId, player] of connectedClients.entries()) {
            if (player.id === ev.playerId) {
              io.to(socketId).emit('tileExplored', {
                x: ev.x,
                y: ev.y,
                shipId: ev.shipId,
                xp: ev.xp
              });
            }
          }
        }
        game.pendingExplorationEvents = [];
      }

      // Process pending anomaly completions
      if (game.pendingAnomalyCompletions && game.pendingAnomalyCompletions.length > 0) {
        for (const ev of game.pendingAnomalyCompletions) {
          for (const [socketId, player] of connectedClients.entries()) {
            if (player.id === ev.playerId) {
              io.to(socketId).emit('anomalyCompleted', ev);
            }
          }
        }
        game.pendingAnomalyCompletions = [];
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
            let penalty = 0.01 * Math.floor(p.ships / 5);
            
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
                    let bonus = mult * Math.floor(otherPlanet.ships / 10);
                    if (otherPlanet.inRevolt) {
                      bonus *= 0.5;
                    }
                    defenderPlanetPenalty += bonus;
                  }
                }
              }
            }
            
            const attackerTechBonus = 0.01 * Math.sqrt(owner.techScore || 0);
            const attackerExpBonus = 0.01 * Math.sqrt(owner.expScore || 0);
            let defenderTechPenalty = 0.01 * Math.sqrt(p.owner ? (p.owner.techScore || 0) : 0);
            let defenderExpPenalty = 0.01 * Math.sqrt(p.owner ? (p.owner.expScore || 0) : 0);
            
            let maxShipExp = 0;
            for (const s of ships) {
              if (s.expScore > maxShipExp) maxShipExp = s.expScore;
            }
            const attackerLocalExpBonus = 0.01 * Math.sqrt(maxShipExp || 0);
            let defenderLocalExpPenalty = 0.01 * Math.sqrt(p.expScore || 0);
            
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
            let humanDefenderBonus = humanVsHuman ? (0.02 * survivingAICount) : 0;
            
            let lastStandPenalty = (humanInvolved && p.owner && p.owner.planetCount === 1) ? 0.20 : 0;
            let defenderHomeworldPenalty = (humanInvolved && p.owner && p.owner.id === p.homeworldOf) ? 0.20 : 0;
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
            let racialDefenseBonus = !matchesAnyAttacker ? 0.15 : 0;

            if (p.inRevolt) {
              penalty *= 0.5;
              defenderPlanetPenalty *= 0.5;
              defenderTechPenalty *= 0.5;
              defenderExpPenalty *= 0.5;
              defenderLocalExpPenalty *= 0.5;
              lastStandPenalty *= 0.5;
              defenderHomeworldPenalty *= 0.5;
              humanDefenderBonus *= 0.5;
              racialDefenseBonus *= 0.5;
            }

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

        const prwEvent = p.preferredResourceWantedEvent || false;
        p.preferredResourceWantedEvent = false;
        
        const cEvent = p.capacityDecreaseEvent;
        p.capacityDecreaseEvent = false;

        const dEvent = p.defeatEvent;
        p.defeatEvent = null;

        const lEvent = p.lastStandEvent;
        p.lastStandEvent = false;

        const hwEvent = p.homeworldEvent;
        p.homeworldEvent = false;

        const rAttemptEvent = p.revoltAttemptEvent || false;
        p.revoltAttemptEvent = false;

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
          maxShips: Math.round(p.maxShips),
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
          isSuperPlanet: p.isSuperPlanet,
          focusMode: p.focusMode || 'economy',
          focusChanges: p.focusChanges || 0,
          sympathy: p.sympathy || null,
          disposition: p.disposition || null,
          revoltWarmup: p.revoltWarmup || 0,
          revoltWarmupMax: p.revoltWarmupMax || 1,
          revoltAttemptEvent: rAttemptEvent,
          inRevolt: p.inRevolt || false,
          revoltTimer: p.revoltTimer || 0,
          focusTransition: p.focusTransition ? {
            targetMode: p.focusTransition.targetMode,
            progress: Math.min(1.0, p.focusTransition.elapsed / 15000)
          } : null,
          finalRateExceedsOne: finalRate > 1.0,
          resources: p.resources || null,
          preferredResource: p.preferredResource || null,
          racialAffinity: p.racialAffinity || null,
          preferredResourceWantedEvent: prwEvent,
          sizeClass: p.sizeClass || 0,
          habitability: p.habitability || 0,
          supplies: p.supplies,
          diplomacyWarmupTimer: p.diplomacyWarmupTimer || 0,
          activeDiplomatId: p.activeDiplomatId || null,
          useResources: p.useResources || false,
          isDeepSpaceAnomaly: p.isDeepSpaceAnomaly || false,
           anomaly: p.anomaly ? {
             id: p.anomaly.id,
             x: p.anomaly.x,
             y: p.anomaly.y,
             difficulty: p.anomaly.difficulty,
             progress: p.anomaly.progress,
             researched: p.anomaly.researched,
             beingResearched: p.anomaly.beingResearched || false,
             rewardType: p.anomaly.rewardType,
             completing: p.anomaly.completing || false,
             completingTimeLeft: p.anomaly.completingTimeLeft || 0,
             completingShipId: p.anomaly.completingShipId || null,
             completingPlayerId: p.anomaly.completingPlayerId || null,
             researchingShipId: p.anomaly.researchingShipId || null,
             researchingShipIds: p.anomaly.researchingShipIds || []
           } : null
      };
    });

    const allShipsMapped = game.ships.map(s => {
      const bEvent = s.beakerIncreaseEvent || 0;
      s.beakerIncreaseEvent = 0;
      const cEvent = s.creditsGainedEvent || 0;
      s.creditsGainedEvent = 0;
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
          shieldPoints: s.shieldPoints !== undefined ? s.shieldPoints : 0,
          shieldShowTimer: s.shieldShowTimer !== undefined ? s.shieldShowTimer : 0,
          engine: s.engine || 0,
          munitions: s.munitions || 0,
          splashDamage: s.splashDamage || 0,
          targeting: s.targeting || 0,
          damagecontrol: s.damagecontrol || 0,
          supply_ship: s.supply_ship || 0,
          extended_fuel: s.extended_fuel || 0,
          supplies: s.supplies || 0,
          maxsupplies: s.maxsupplies || 0,
          specialfuel: s.specialfuel || 0,
          specialbombs: s.specialbombs || 0,
          resourceConsumeEvents: consumeEvents,
          diplomat: s.diplomat || 0,
          parley: s.parley !== undefined ? s.parley : 0,
          marines: s.marines || 0,
          command: s.command || 0,
          commandPoints: s.commandPoints || 0,
          diplomatTargetPlanetId: s.diplomatTargetPlanetId || null,
          crew: s.crew || 0,
          marineCount: s.marineCount || 0,
          isBoardingFleet: s.isBoardingFleet || false,
          isReturnPod: s.isReturnPod || false,
          isUpgrading: s.isUpgrading || false,
          upgradeTimer: s.upgradeTimer || 0,
          upgradeType: s.upgradeType || null,
          upgradeTokens: s.upgradeTokens || 0,
          upgradeUsingToken: s.upgradeUsingToken || false,
          isDismantling: s.isDismantling || false,
          dismantleTimer: s.dismantleTimer !== undefined ? s.dismantleTimer : 0,
          dismantleDuration: s.dismantleDuration || (s.maxHealth / 2) || 15,
          isHungry: s.isAmoeba ? (!s.amoebaGrowCooldown || s.amoebaGrowCooldown <= 0) : false,
          isWarp: s.isWarp || false,
          fuel: s.fuel || 0,
          angle: s.angle || 0,
          flightTime: s.flightTime || 0,
          speedModifier: s.speedModifier || 1.0,
          speed: typeof s.getMaxSpeed === 'function' ? s.getMaxSpeed() : (s.speed || (s.isCruiser ? 22 : 15)),
          currentSpeed: s.currentSpeed || 0,
          specialduranium: s.specialduranium || 0,
          targetX: s.targetPlanet ? s.targetPlanet.x : s.targetX,
          targetY: s.targetPlanet ? s.targetPlanet.y : s.targetY,
          formation: s.formation,
          anomalyDiscoveryCooldown: s.anomalyDiscoveryCooldown || 0,
          beakerIncreaseEvent: bEvent,
          creditsGainedEvent: cEvent,
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
          savedBombardPlanetId: s.savedBombardPlanetId !== undefined ? s.savedBombardPlanetId : null,
          isPatrolling: s.isPatrolling || false,
          isScouting: s.isScouting || false,
          scoutTargetX: s.scoutTargetX !== undefined ? s.scoutTargetX : null,
          scoutTargetY: s.scoutTargetY !== undefined ? s.scoutTargetY : null,
          scoutTargetUnexplored: (s.isScouting && s.scoutTargetX !== null && s.scoutTargetY !== null && s.owner && game.exploredGrid) ?
            ((game.exploredGrid[`${s.owner.id}_${Math.floor(s.scoutTargetX / 100)}_${Math.floor(s.scoutTargetY / 100)}`] || 0) === 0) : false,
          isResearching: s.isResearching || false,
          isActivelyResearching: s.isActivelyResearching || false,
          accumulatedTech: s.accumulatedTech || 0,
          isDiplomacy: s.isDiplomacy || false,
          scoutAttackEnabled: s.scoutAttackEnabled || false,
          useResources: s.useResources || false,
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

    const recipients = [];
    for (const [socketId, player] of connectedClients.entries()) {
      const sock = io.sockets.sockets.get(socketId);
      let shouldSend = false;
      if (sock && sock.conn && sock.conn.writeBuffer) {
        const bufferLen = sock.conn.writeBuffer.length;
        if (bufferLen > 8) {
          // Extremely congested socket: drop the tick entirely to allow the buffer to clear
          continue;
        } else if (bufferLen > 3) {
          // Mildly congested socket: rate-limit to 5 FPS to reduce traffic without losing telemetry
          shouldSend = (tickCount % 4 === 0);
        } else {
          // Healthy socket: rate-limit to 10 FPS to save bandwidth/CPU, client interpolates to 60 FPS
          shouldSend = (tickCount % 2 === 0);
        }
      } else {
        shouldSend = (tickCount % 2 === 0);
      }
      if (shouldSend) {
        recipients.push({ socketId, player });
      }
    }

    if (recipients.length === 0) {
      // Clear events that accumulate per-tick
      game.upgradeEnhanceEvents = [];
      game.accuracyEvents = [];
      return;
    }

    for (const { socketId, player } of recipients) {

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
         // console.log(`GETSTATE: ${player.id} has NO entities! (Planets: ${game.planets.filter(p=>p.owner).map(p=>p.owner.id).join(',')})`);
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
        let isDiscoveredNow = false;

        const spawnAnomalyForPlanet = () => {
          if (p.owner === null && p.anomalyAttempted === undefined) {
            p.anomalyAttempted = true;
            let maxLabs = 0;
            let maxShipXpBonus = 0;
            const playerShips = game.ships.filter(s => s.active && s.owner && s.owner.id === player.id);
            for (const ship of playerShips) {
              const radar = ship.isCruiser ? (ship.cruiserRadarRange ? ship.cruiserRadarRange() : 150) : 50;
              const pct = hazardSensorReductionPct(ship.x, ship.y, player.id);
              const eff = Math.max(10, radar * pct);
              const dx = ship.x - p.x;
              const dy = ship.y - p.y;
              if (dx*dx + dy*dy <= eff*eff) {
                const labs = ship.labs || 0;
                if (labs > maxLabs) {
                  maxLabs = labs;
                }
                const xpBonus = typeof ship.getLocalXpBonus === 'function' ? ship.getLocalXpBonus() : 0;
                if (xpBonus > maxShipXpBonus) {
                  maxShipXpBonus = xpBonus;
                }
              }
            }
            let spawnChance = Math.min(0.50, 0.10 + 0.10 * maxLabs + 0.03 * maxShipXpBonus);
            const discoveredByOthers = game.allPlayers.some(op => op.id !== player.id && op.discoveredPlanets && op.discoveredPlanets.has(p.id));
            if (discoveredByOthers) {
              spawnChance -= 0.25;
            }
            if (Math.random() < spawnChance) {
              const dist = Math.random() * (p.radius - 5);
              const angle = Math.random() * Math.PI * 2;
              const ax = p.x + Math.cos(angle) * dist;
              const ay = p.y + Math.sin(angle) * dist;
              const elapsedMinutes = (Date.now() - (game.gameStartTime || Date.now())) / 60000;
              const isUnlimited = !game.settings || !game.settings.timedGameLimit || game.settings.timedGameLimit === 'unlimited';
              const minDiff = 1;
              const timedLimitSecs = !isUnlimited ? parseFloat(game.settings.timedGameLimit) : null;
              const maxDiff = isUnlimited ? 100 : Math.min(Math.floor((timedLimitSecs / 60) / 2), 100);
              const difficulty = Math.max(1, Math.floor((Math.floor(Math.pow(Math.random(), 2) * (maxDiff - minDiff + 1)) + minDiff) / 2));
              
              const rewardOptions = ['discount', 'credits', 'tech', 'xp', 'hab', 'rare_resource_cache', 'upgrade_token'];
              const rewardType = rewardOptions[Math.floor(Math.random() * rewardOptions.length)];
              
              p.anomaly = {
                id: Math.random().toString(36).substr(2, 9),
                x: ax,
                y: ay,
                difficulty: difficulty,
                progress: {},
                researched: false,
                beingResearched: false,
                rewardType: rewardType
              };
            }
          }
        };

        if ((p.owner && p.owner.id === player.id) || isVisible(p.x, p.y) || hasSympathy) {
          if (!player.discoveredPlanets.has(p.id)) {
            isDiscoveredNow = true;
          }
          player.discoveredPlanets.add(p.id);
          if (isDiscoveredNow) {
            spawnAnomalyForPlanet();
          }
          const mappedPlanet = Object.assign({}, allPlanetsMapped[i]);
          if (mappedPlanet.anomaly) {
            mappedPlanet.anomaly = Object.assign({}, mappedPlanet.anomaly, {
              progress: (p.anomaly.progress && typeof p.anomaly.progress === 'object') ? (p.anomaly.progress[player.id] || 0) : 0
            });
          }
          if (player.spyRootedEvents && player.spyRootedEvents.has(p.id)) mappedPlanet.spyRootedOutEvent = true;
          visiblePlanets.push(mappedPlanet);

          player.lastKnownPlanets = player.lastKnownPlanets || {};
          player.lastKnownPlanets[p.id] = Object.assign({}, mappedPlanet);
        } else if (isSilhouetteVisible(p.x, p.y) || player.discoveredPlanets.has(p.id) || p.rampageEvent) {
          if (isSilhouetteVisible(p.x, p.y)) {
            if (!player.discoveredPlanets.has(p.id)) {
              isDiscoveredNow = true;
            }
            player.discoveredPlanets.add(p.id);
            if (isDiscoveredNow) {
              spawnAnomalyForPlanet();
            }
          }
          const hasAttacked = player.attackedPlanets && player.attackedPlanets.has(p.id) && player.attackedPlanets.get(p.id) > 0;
          if (hasAttacked) {
            const mappedPlanet = Object.assign({}, allPlanetsMapped[i], { inFog: true, permanentlyTracked: true });
            if (mappedPlanet.anomaly) {
              mappedPlanet.anomaly = Object.assign({}, mappedPlanet.anomaly, {
                progress: (p.anomaly.progress && typeof p.anomaly.progress === 'object') ? (p.anomaly.progress[player.id] || 0) : 0
              });
            }
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
              maxShips: Math.round(p.maxShips),
              inFog: true,
              spyRootedOutEvent: spyRooted,
              isSpeedPlanet: p.isSpeedPlanet,
              isSuperPlanet: p.isSuperPlanet,
              isResearch: p.isResearch,
              isMilitary: p.isMilitary,
              rampageEvent: p.rampageEvent || false,
              rampageIncubating: p.rampageIncubating || false,
              isAICandidate: p.isAICandidate || false,
              resources: p.resources || null,
              expScore: p.expScore || 0,
              sizeClass: p.sizeClass || 0,
              habitability: p.habitability || 0,
              inRevolt: p.inRevolt || false,
              revoltTimer: p.revoltTimer || 0,
              isDeepSpaceAnomaly: p.isDeepSpaceAnomaly || false,
              anomaly: p.anomaly ? {
                 id: p.anomaly.id,
                 x: p.anomaly.x,
                 y: p.anomaly.y,
                 difficulty: p.anomaly.difficulty,
                 progress: (p.anomaly.progress && typeof p.anomaly.progress === 'object') ? (p.anomaly.progress[player.id] || 0) : 0,
                 researched: p.anomaly.researched,
                 beingResearched: p.anomaly.beingResearched || false,
                 completing: p.anomaly.completing || false,
                 completingTimeLeft: p.anomaly.completingTimeLeft || 0,
                 completingShipId: p.anomaly.completingShipId || null,
                 completingPlayerId: p.anomaly.completingPlayerId || null,
                 researchingShipId: p.anomaly.researchingShipId || null,
                 researchingShipIds: p.anomaly.researchingShipIds || []
               } : null
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
              Math.round((s.currentSpeed || 0) * 10) / 10,
              s.isMarineFleet ? 1 : 0,
              Math.round((s.commandPoints || 0) * 100) / 100
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
            knowledge: storm.knowledge[player.id] || 0,
            mines: storm.mines
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

      const visibleHappinessEvents = (game.happinessEvents || []).filter(ev => {
        const targetPlanet = game.planets.find(p => p.id === ev.planetId);
        if (!targetPlanet) return false;
        const hasSympathy = targetPlanet.sympathy && targetPlanet.sympathy[player.id] > 0;
        return (targetPlanet.owner && targetPlanet.owner.id === player.id) || isVisible(targetPlanet.x, targetPlanet.y) || hasSympathy;
      });

      const playerExploredCells = {};
      if (game.exploredGrid) {
        const prefix = `${player.id}_`;
        for (const [key, value] of Object.entries(game.exploredGrid)) {
          if (key.startsWith(prefix) && value > 0) {
            playerExploredCells[key.substring(prefix.length)] = value;
          }
        }
      }

      // Wreckage visibility filtering
      const visibleWreckages = [];
      for (const w of (game.wreckages || [])) {
        if (isVisible(w.x, w.y)) {
          visibleWreckages.push({
            id: w.id,
            x: w.x,
            y: w.y,
            amoebaDamage: w.amoebaDamage,
            cruiserDamage: w.cruiserDamage,
            lastFightingTime: w.lastFightingTime,
            beingScanned: w.beingScanned || false,
            scanningShipId: w.scanningShipId || null,
            scanningPlayerId: w.scanningPlayerId || null,
            scanTimeLeft: w.scanTimeLeft || 0
          });
        }
      }

      // Chunk visibility filtering
      const visibleChunks = [];
      for (const c of (game.chunks || [])) {
        if (isVisible(c.x, c.y)) {
          visibleChunks.push({
            id: c.id,
            x: c.x,
            y: c.y,
            amoebaDamage: c.amoebaDamage,
            cruiserDamage: c.cruiserDamage
          });
        }
      }

      const state = {
        planets: visiblePlanets,
        ships: visibleShips,
        flatShips: visibleFlatShips,
        fleets: visibleFleets,
        explosions: visibleExplosions,
        lasers: visibleLasers,
        storms: visibleStorms,
        wreckages: visibleWreckages,
        chunks: visibleChunks,
        players: game.allPlayers.map(p => {
          const pObj = Object.assign({}, p);
          pObj.discoveredPlanetsArray = p.discoveredPlanets ? Array.from(p.discoveredPlanets) : [];
          if (p.id === player.id) {
            pObj.lastKnownPlanets = p.lastKnownPlanets || {};
          } else {
            delete pObj.lastKnownPlanets;
          }
          return pObj;
        }),
        globalUpgradeModifiers: game.globalUpgradeModifiers,
        upgradeEnhanceEvents: visibleUpgradeEnhanceEvents,
        accuracyEvents: visibleAccuracyEvents,
        happinessEvents: visibleHappinessEvents,
        galacticCapacity: game.galacticCapacity,
        sellOrders: [
          ...(player.autoBuyOrders || []),
          ...(game.sellOrders || [])
        ],
        fulfillOrders: [
          ...(game.fulfillOrders || [])
        ],
        resourceRarities: game.resourceRarities || {},
        isPaused: game.isPaused,
        isRunning: game.isRunning,
        gameOverMessage: game.gameOverMessage,
        settings: game.settings,
        timeRemaining: game.timeRemaining,
        elapsedTime: game.gameTime / 1000,
        gameSpeed: game.gameSpeed || 1.0,
        width: game.width,
        height: game.height,
        gameStartTime: game.gameStartTime,
        exploredCells: playerExploredCells
      };
      
      if (game.pendingHabClassChanges && game.pendingHabClassChanges.length > 0) {
        for (const ev of game.pendingHabClassChanges) {
          const planet = game.planets.find(p => p.id === ev.planetId);
          if (planet) {
            const hasSympathy = planet.sympathy && planet.sympathy[player.id] > 0;
            const hasVis = (planet.owner && planet.owner.id === player.id) || isVisible(planet.x, planet.y) || hasSympathy;
            if (hasVis) {
              io.to(socketId).emit('chatMessage', {
                sender: 'System',
                color: '#39ff14',
                text: `${ev.planetName} has class-changed from ${ev.oldClass} to ${ev.newClass}!`,
                isAnimated: true
              });
            }
          }
        }
      }

      io.to(socketId).emit('gameStateUpdate', state);
    }

    // Clear upgrade enhancement events after broadcasting to all clients
    game.upgradeEnhanceEvents = [];
    game.accuracyEvents = [];
    game.happinessEvents = [];
    game.pendingHabClassChanges = [];
    
  }, TICK_RATE);

  const PORT = process.env.PORT || 5173;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
