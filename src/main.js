import { io } from 'socket.io-client';
const keysDown = {};
const AMOEBA_COS = [1, 0.70710678, 0, -0.70710678, -1, -0.70710678, 0, 0.70710678];
const AMOEBA_SIN = [0, 0.70710678, 1, 0.70710678, 0, -0.70710678, -1, -0.70710678];
window.addEventListener('keydown', e => keysDown[e.key] = true);
window.addEventListener('keyup', e => keysDown[e.key] = false);

const habIcons = {
  'Toxic': '☣️',
  'Radiated': '☢️',
  'Barren': '🪨',
  'Desert': '🏜️',
  'Tundra': '❄️',
  'Swamp': '🐊',
  'Jungle': '🌴',
  'Ocean': '🌊',
  'Arid': '🌵',
  'Terran': '🌍',
  'Gaia': '🍀'
};

function getHabName(habitability) {
  const hab = habitability || 0;
  if (hab < 20) return 'Toxic';
  if (hab < 30) return 'Radiated';
  if (hab < 40) return 'Barren';
  if (hab < 50) return 'Desert';
  if (hab < 60) return 'Tundra';
  if (hab < 70) return 'Swamp';
  if (hab < 80) return 'Jungle';
  if (hab < 90) return 'Ocean';
  if (hab < 100) return 'Arid';
  if (hab < 141) return 'Terran';
  return 'Gaia';
}

let playedIntroTracks = [];
let lastMusicChangeTime = 0;

function playRandomIntroTrack() {
  const musicCheckbox = document.getElementById('music-checkbox');
  const bgMusic = document.getElementById('bg-music');
  if (!musicCheckbox || !musicCheckbox.checked || !bgMusic) return;

  const introTracks = [
    'A little loud, but pretty good.mp3',
    'Deep Space Ambience.wav',
    'Intense option.mp3',
    'Pretty and Steady.mp3',
    'Solid option.mp3'
  ];

  let availableTracks = introTracks.filter(track => !playedIntroTracks.includes(track));
  if (availableTracks.length === 0) {
    playedIntroTracks = [];
    availableTracks = [...introTracks];
  }

  const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  playedIntroTracks.push(randomTrack);

  bgMusic.src = '/Music/Intro Music/' + encodeURIComponent(randomTrack);
  bgMusic.loop = true; // Loop so it doesn't go silent and trigger browser autoplay blocks
  bgMusic.volume = 0.4;
  bgMusic.play().catch(e => console.warn('Music play blocked:', e));

  lastMusicChangeTime = Date.now();
}

function checkMusicRotation() {
  // Disabled as the intro piece is looping indefinitely.
}

function getEffectiveSympathyClient(pl, playerId) {
  const baseSympathy = pl.sympathy?.[playerId] || 0;
  let extraSympathy = 0;
  if (serverState && serverState.ships && (!pl.ownerId || pl.ownerId === 'neutral' || pl.ownerId !== playerId)) {
    let isKnown = false;
    if (!serverState.settings || !serverState.settings.fogOfWar) {
      isKnown = true;
    } else {
      const resolvedPlayer = serverState.players ? serverState.players.find(p => p.id === playerId) : null;
      if (resolvedPlayer) {
        if (resolvedPlayer.discoveredPlanetsArray && (resolvedPlayer.discoveredPlanetsArray.includes(pl.id) || resolvedPlayer.discoveredPlanetsArray.includes(Number(pl.id)) || resolvedPlayer.discoveredPlanetsArray.includes(String(pl.id)))) {
          isKnown = true;
        } else {
          // Check if any of the player's ships currently has the planet in its radar range
          for (const ship of serverState.ships) {
            if (ship.active && ship.ownerId === playerId) {
              const dx = ship.x - pl.x;
              const dy = ship.y - pl.y;
              const distSq = dx * dx + dy * dy;
              
              let radarRange = 50;
              if (ship.isCruiser || (ship.maxHealth && ship.maxHealth > 0)) {
                radarRange = Math.min(250, 5 * (ship.maxHealth || ship.health || 0));
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
      let baseRadius = (pl.maxShips || 0) * 1.5;
      if (pl.isMilitary && (pl.ships || 0) >= (pl.maxShips || 0)) {
        baseRadius *= 1.5;
      }
      const plOwner = pl.ownerId && pl.ownerId !== 'neutral' ? serverState.players.find(o => o.id === pl.ownerId) : null;
      const isHuman = plOwner && !plOwner.isAI;
      if (isHuman && pl.focusMode === 'garrison' && (pl.ships || 0) >= (pl.maxShips || 0)) {
        baseRadius += ((pl.ships || 0) / 2);
      }
      const tb = 0.01 * Math.sqrt(plOwner ? (plOwner.techScore || 0) : 0);
      const eb = 0.01 * Math.sqrt(plOwner ? (plOwner.expScore || 0) : 0);
      let gr = baseRadius * (1 + tb + eb);
      if (!pl.ownerId || pl.ownerId === 'neutral') {
        gr *= 0.5;
      }
      const maxDist = gr;
      const maxDistSq = maxDist * maxDist;
      for (const ship of serverState.ships) {
        if (ship.active && ship.ownerId === playerId) {
          const dx = ship.x - pl.x;
          const dy = ship.y - pl.y;
          if (dx * dx + dy * dy <= maxDistSq) {
            const shipHp = (ship.isCruiser || (ship.maxHealth && ship.maxHealth > 0)) ? ((ship.maxHealth || ship.health || 0) * 0.5) : ((ship.count || 1) * 0.5);
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

function getPlanetTradeIncomePerMin(planet) {
  const myPlayer = (serverState && serverState.players && localPlayer) ? (serverState.players.find(p => p.id === localPlayer.id) || localPlayer) : localPlayer;
  if (!myPlayer || planet.dead) return 0;

  // 1. Calculate player's own effective ships
  let playerEffectiveShips = 0;
  if (serverState && serverState.planets) {
    for (const pl of serverState.planets) {
      if (pl.dead) continue;
      if (pl.ownerId === myPlayer.id) {
        let eff = pl.ships || 0;
        if (pl.focusMode === 'commerce') {
          const isFull = (pl.ships || 0) >= (pl.maxShips || 0);
          eff = isFull ? eff * 4 : eff * 2;
        }
        playerEffectiveShips += eff;
      }
    }
  }

  // 2. Calculate other effective ships
  let otherEffectiveShips = 0;
  if (serverState && serverState.planets) {
    for (const pl of serverState.planets) {
      if (pl.dead) continue;
      const isOwn = (pl.ownerId === myPlayer.id);
      
      let isNotAtWar = true;
      if (pl.ownerId) {
        if (pl.ownerId === 'monsters') {
          isNotAtWar = false;
        } else {
          const isAtWar = !!(myPlayer.atWarWith && myPlayer.atWarWith[pl.ownerId] && Date.now() < myPlayer.atWarWith[pl.ownerId]);
          if (isAtWar) isNotAtWar = false;
        }
      }
      
      if (!isOwn && isNotAtWar) {
        let baseShips = pl.ships || 0;
        if (!pl.ownerId) {
          const sympathyVal = getEffectiveSympathyClient(pl, myPlayer.id);
          baseShips = Math.min(baseShips, sympathyVal * 10);
        }
        let eff = baseShips;
        if (pl.focusMode === 'commerce') {
          const isFull = (pl.ships || 0) >= (pl.maxShips || 0);
          eff = isFull ? baseShips * 4 : baseShips * 2;
        }
        otherEffectiveShips += eff;
      }
    }
  }

  // 3. Scale factor - Soft Cap
  let scale = 1.0;
  if (otherEffectiveShips > playerEffectiveShips) {
    const excess = otherEffectiveShips - playerEffectiveShips;
    const credited = playerEffectiveShips + 0.10 * excess;
    scale = credited / otherEffectiveShips;
  }

  // 4. Calculate for the given planet
  const isOwn = (planet.ownerId === myPlayer.id);
  let isNotAtWar = true;
  if (planet.ownerId) {
    if (planet.ownerId === 'monsters') {
      isNotAtWar = false;
    } else {
      const isAtWar = !!(myPlayer.atWarWith && myPlayer.atWarWith[planet.ownerId] && Date.now() < myPlayer.atWarWith[planet.ownerId]);
      if (isAtWar) isNotAtWar = false;
    }
  }

  if (isOwn) {
    let eff = planet.ships || 0;
    if (planet.focusMode === 'commerce') {
      const isFull = (planet.ships || 0) >= (planet.maxShips || 0);
      eff = isFull ? eff * 4 : eff * 2;
    }
    return eff / 25;
  } else if (isNotAtWar) {
    let baseShips = planet.ships || 0;
    if (!planet.ownerId) {
      const sympathyVal = getEffectiveSympathyClient(planet, myPlayer.id);
      baseShips = Math.min(baseShips, sympathyVal * 10);
    }
    let eff = baseShips;
    if (planet.focusMode === 'commerce') {
      const isFull = (planet.ships || 0) >= (planet.maxShips || 0);
      eff = isFull ? baseShips * 4 : baseShips * 2;
    }
    return (eff * scale) / 25;
  }

  return 0;
}



// Run initialization immediately as an ES Module
  console.log('[PlanetWars] Code version: RAF-loop-v1');
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let playerId = localStorage.getItem('planetWarsPlayerId');
  if (!playerId) {
    playerId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('planetWarsPlayerId', playerId);
  }
  const socket = io({ query: { playerId } });
  window.socket = socket;

  const savedPlayerName = localStorage.getItem('planetWarsPlayerName');
  if (savedPlayerName) {
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) nameInput.value = savedPlayerName;
  }

  const savedPlayerRace = localStorage.getItem('planetWarsPlayerRace');
  if (savedPlayerRace) {
    const raceSelect = document.getElementById('player-race-select');
    if (raceSelect) raceSelect.value = savedPlayerRace;
  }

  let localPlayer = null;
  let serverState = null;
  let lastGameStartTime = null;
  let lastSelectedCruiserId = null;
  let selectedPlanets = [];
  let selectedShips = [];
  window.getLocalPlayer = () => localPlayer;
  window.getServerState = () => serverState;
  window.getSelectedShips = () => selectedShips;
  window.setSelectedShips = (val) => { selectedShips = val; };
  window.getSelectedPlanets = () => selectedPlanets;
  window.setSelectedPlanets = (val) => { selectedPlanets = val; };
  window.getCameraZoom = () => cameraZoom;
  window.setCameraZoom = (val) => { cameraZoom = val; };
  window.getCameraPanX = () => cameraPanX;
  window.setCameraPanX = (val) => { cameraPanX = val; };
  window.getCameraPanY = () => cameraPanY;
  window.setCameraPanY = (val) => { cameraPanY = val; };
  window.getFloatingAnimations = () => floatingAnimations;
  let warpOrderNext = false;
  let controlGroups = {}; // RTS control groups for fleets/cruisers
  let lastKnownPlanets = {}; // Cache of last-known states for planets under Fog of War

  function resetClientModeFlags() {
    selectedPlanets = [];
    selectedShips = [];
    warpOrderNext = false;
    bombOrderNext = false;
    scoutModeNext = false;
    upgradeModeActive = false;
    focusModeActive = false;
    cruiserBuildModeActive = false;
    activeConfigClassType = null;
    confirmingDismantle = false;
    speedModifierNext = null;
  }

  let transparentPlanetsCanvas = null;
  const planetSpriteSheet = new Image();
  planetSpriteSheet.onload = () => {
    // Process image to make black background transparent
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = planetSpriteSheet.naturalWidth;
    tempCanvas.height = planetSpriteSheet.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(planetSpriteSheet, 0, 0);
    try {
      const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        // JPEG compression noise check: transparent if dark enough (R, G, B < 15)
        if (r < 15 && g < 15 && b < 15) {
          data[i+3] = 0;
        }
      }
      tempCtx.putImageData(imgData, 0, 0);
      transparentPlanetsCanvas = tempCanvas;
    } catch (e) {
      console.error('[AntiGravity] Failed to process planet transparency:', e);
      transparentPlanetsCanvas = planetSpriteSheet;
    }
  };
  planetSpriteSheet.src = 'Planets Resource.jpg';

  let transparentShipsCanvas = null;
  const shipsSpriteSheet = new Image();
  shipsSpriteSheet.onload = () => {
    // Process image to make black background transparent
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = shipsSpriteSheet.naturalWidth;
    tempCanvas.height = shipsSpriteSheet.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(shipsSpriteSheet, 0, 0);
    try {
      const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        // JPEG compression noise check: transparent if dark enough (R, G, B < 15)
        if (r < 15 && g < 15 && b < 15) {
          data[i+3] = 0;
        }
      }
      tempCtx.putImageData(imgData, 0, 0);
      transparentShipsCanvas = tempCanvas;
    } catch (e) {
      console.error('[AntiGravity] Failed to process ship transparency:', e);
      transparentShipsCanvas = shipsSpriteSheet;
    }
    updateBuildButtonCanvases();
  };
  shipsSpriteSheet.src = 'Ships Resource.jpg';

  const FACTION_MAPPING = {
    'Federation': { x: 20, w: 121 },
    'Gorn': { x: 155, w: 107 },
    'Romulan': { x: 276, w: 114 },
    'Klingon': { x: 403, w: 113 },
    'Tholian': { x: 528, w: 116 },
    'Lyran': { x: 653, w: 119 }
  };

  const CLASS_MAPPING = {
    'corvette': { y: 20, h: 84 },
    'frigate': { y: 120, h: 78 },
    'destroyer': { y: 213, h: 114 },
    'cruiser': { y: 338, h: 152 },
    'battlecruiser': { y: 504, h: 83 },
    'battleship': { y: 596, h: 100 },
    'titan': { y: 709, h: 102 },
    'mammoth': { y: 826, h: 319 }
  };

  const graphicalModeCheckbox = document.getElementById('graphical-mode-checkbox');
  let graphicalMode = graphicalModeCheckbox ? graphicalModeCheckbox.checked : false;
  if (graphicalModeCheckbox) {
    graphicalModeCheckbox.addEventListener('change', () => {
      graphicalMode = graphicalModeCheckbox.checked;
      updateBuildButtonCanvases();
    });
  }

  let speedModifierNext = null;
  let bombOrderNext = false;
  let scoutModeNext = false;
  // Interceptor order removed
  let upgradeModeActive = false;
  let confirmingDismantle = false;
  let lastSelectedCruiserIdsStr = "";
  let focusModeActive = false;

  let cameraZoom = 1.0;
  let cameraPanX = 0;
  let cameraPanY = 0;
  let hasCenteredOnHomeworld = false;
  let isDraggingCamera = false;
  let lastCameraDragX = 0;
  let lastCameraDragY = 0;

  let initialPinchDistance = null;
  let initialPinchZoom = 1.0;
  let lastPinchMidX = 0;
  let lastPinchMidY = 0;

  function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getPinchMidpoint(touches) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) * scaleX,
      y: ((touches[0].clientY + touches[1].clientY) / 2 - rect.top) * scaleY
    };
  }

  let lasso = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };

  const getMaxFuel = (s) => {
    const baseFuel = s.maxHealth / 5;
    return baseFuel + (s.fuel_tanker || 0) * 5;
  };

  const getMaxBombs = (s) => {
    const baseMax = Math.floor(s.maxHealth / 5);
    return baseMax + (s.munitions || 0);
  };

  function drawRacialShipHull(ctx, style, cohort, size) {
    ctx.beginPath();
    if (style === 'Federation') {
      if (cohort === 'destroyer_group') {
        // Federation Destroyer (disk/saucer with side engines, pylons at bottom 1/5 of disk)
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.35, -size * 0.9);
        ctx.lineTo(size * 0.5, -size * 0.6);
        ctx.lineTo(size * 0.42, -size * 0.45);
        ctx.lineTo(size * 0.68, -size * 0.35);
        ctx.lineTo(size * 0.68, -size * 0.75);
        ctx.lineTo(size * 0.82, -size * 0.75);
        ctx.lineTo(size * 0.82, size * 0.15);
        ctx.lineTo(size * 0.68, size * 0.15);
        ctx.lineTo(size * 0.68, -size * 0.25);
        ctx.lineTo(size * 0.38, -size * 0.35);
        ctx.lineTo(size * 0.15, -size * 0.2);
        ctx.lineTo(0, -size * 0.2);
        ctx.lineTo(-size * 0.15, -size * 0.2);
        ctx.lineTo(-size * 0.38, -size * 0.35);
        ctx.lineTo(-size * 0.68, -size * 0.25);
        ctx.lineTo(-size * 0.68, size * 0.15);
        ctx.lineTo(-size * 0.82, size * 0.15);
        ctx.lineTo(-size * 0.82, -size * 0.75);
        ctx.lineTo(-size * 0.68, -size * 0.75);
        ctx.lineTo(-size * 0.68, -size * 0.35);
        ctx.lineTo(-size * 0.42, -size * 0.45);
        ctx.lineTo(-size * 0.5, -size * 0.6);
        ctx.lineTo(-size * 0.35, -size * 0.9);
      } else if (cohort === 'cruiser_group') {
        // Cruiser uses the Scout design
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.5, -size * 0.8);
        ctx.lineTo(size * 0.5, -size * 0.4);
        ctx.lineTo(size * 0.2, -size * 0.3);
        ctx.lineTo(size * 0.2, size * 0.2);
        ctx.lineTo(size * 0.7, size * 0.2);
        ctx.lineTo(size * 0.7, -size * 0.2);
        ctx.lineTo(size * 0.9, -size * 0.2);
        ctx.lineTo(size * 0.9, size * 0.8);
        ctx.lineTo(size * 0.7, size * 0.8);
        ctx.lineTo(size * 0.7, size * 0.4);
        ctx.lineTo(size * 0.2, size * 0.4);
        ctx.lineTo(size * 0.2, size * 0.6);
        ctx.lineTo(-size * 0.2, size * 0.6);
        ctx.lineTo(-size * 0.2, size * 0.4);
        ctx.lineTo(-size * 0.7, size * 0.4);
        ctx.lineTo(-size * 0.7, size * 0.8);
        ctx.lineTo(-size * 0.9, size * 0.8);
        ctx.lineTo(-size * 0.9, -size * 0.2);
        ctx.lineTo(-size * 0.7, -size * 0.2);
        ctx.lineTo(-size * 0.7, size * 0.2);
        ctx.lineTo(-size * 0.2, size * 0.2);
        ctx.lineTo(-size * 0.2, -size * 0.3);
        ctx.lineTo(-size * 0.5, -size * 0.4);
        ctx.lineTo(-size * 0.5, -size * 0.8);
      } else if (cohort === 'battleship_group') {
        // Battleship uses the Cruiser design
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.6, -size * 0.7);
        ctx.lineTo(size * 0.6, -size * 0.3);
        ctx.lineTo(size * 0.2, -size * 0.2);
        ctx.lineTo(size * 0.2, size * 0.1);
        ctx.lineTo(size * 0.7, size * 0.1);
        ctx.lineTo(size * 0.7, -size * 0.3);
        ctx.lineTo(size * 0.85, -size * 0.3);
        ctx.lineTo(size * 0.85, size * 0.7);
        ctx.lineTo(size * 0.7, size * 0.7);
        ctx.lineTo(size * 0.7, size * 0.3);
        ctx.lineTo(size * 0.2, size * 0.3);
        ctx.lineTo(size * 0.15, size * 0.5);
        ctx.lineTo(size * 0.15, size * 0.8);
        ctx.lineTo(0, size * 0.9);
        ctx.lineTo(-size * 0.15, size * 0.8);
        ctx.lineTo(-size * 0.15, size * 0.5);
        ctx.lineTo(-size * 0.2, size * 0.3);
        ctx.lineTo(-size * 0.7, size * 0.3);
        ctx.lineTo(-size * 0.7, size * 0.7);
        ctx.lineTo(-size * 0.85, size * 0.7);
        ctx.lineTo(-size * 0.85, -size * 0.3);
        ctx.lineTo(-size * 0.7, -size * 0.3);
        ctx.lineTo(-size * 0.7, size * 0.1);
        ctx.lineTo(-size * 0.2, size * 0.1);
        ctx.lineTo(-size * 0.2, -size * 0.2);
        ctx.lineTo(-size * 0.6, -size * 0.3);
        ctx.lineTo(-size * 0.6, -size * 0.7);
      } else if (cohort === 'mammoth_group') {
        // Mammoth uses the Battleship design
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.7, -size * 0.8);
        ctx.lineTo(size * 0.7, -size * 0.4);
        ctx.lineTo(size * 0.3, -size * 0.1);
        ctx.lineTo(size * 0.5, -size * 0.1);
        ctx.lineTo(size * 0.5, -size * 0.4);
        ctx.lineTo(size * 0.65, -size * 0.4);
        ctx.lineTo(size * 0.65, size * 0.3);
        ctx.lineTo(size * 0.5, size * 0.3);
        ctx.lineTo(size * 0.3, size * 0.1);
        ctx.lineTo(size * 0.3, size * 0.3);
        ctx.lineTo(size * 0.9, size * 0.3);
        ctx.lineTo(size * 0.9, 0);
        ctx.lineTo(size * 1.05, 0);
        ctx.lineTo(size * 1.05, size * 0.9);
        ctx.lineTo(size * 0.9, size * 0.9);
        ctx.lineTo(size * 0.9, size * 0.5);
        ctx.lineTo(size * 0.2, size * 0.5);
        ctx.lineTo(size * 0.1, size * 0.7);
        ctx.lineTo(-size * 0.1, size * 0.7);
        ctx.lineTo(-size * 0.2, size * 0.5);
        ctx.lineTo(-size * 0.9, size * 0.5);
        ctx.lineTo(-size * 0.9, size * 0.9);
        ctx.lineTo(-size * 1.05, size * 0.9);
        ctx.lineTo(-size * 1.05, 0);
        ctx.lineTo(-size * 0.9, 0);
        ctx.lineTo(-size * 0.9, size * 0.3);
        ctx.lineTo(-size * 0.3, size * 0.3);
        ctx.lineTo(-size * 0.3, size * 0.1);
        ctx.lineTo(-size * 0.5, size * 0.3);
        ctx.lineTo(-size * 0.65, size * 0.3);
        ctx.lineTo(-size * 0.65, -size * 0.4);
        ctx.lineTo(-size * 0.5, -size * 0.4);
        ctx.lineTo(-size * 0.5, -size * 0.1);
        ctx.lineTo(-size * 0.3, -size * 0.1);
        ctx.lineTo(-size * 0.7, -size * 0.4);
        ctx.lineTo(-size * 0.7, -size * 0.8);
      } else {
        // Scout redesigned to look like the Cruiser but without side engines and with a narrowed back
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.6, -size * 0.7);
        ctx.lineTo(size * 0.6, -size * 0.3);
        ctx.lineTo(size * 0.15, -size * 0.2);
        ctx.lineTo(size * 0.15, size * 0.5);
        ctx.lineTo(size * 0.1, size * 0.8);
        ctx.lineTo(0, size * 0.9);
        ctx.lineTo(-size * 0.1, size * 0.8);
        ctx.lineTo(-size * 0.15, size * 0.5);
        ctx.lineTo(-size * 0.15, -size * 0.2);
        ctx.lineTo(-size * 0.6, -size * 0.3);
        ctx.lineTo(-size * 0.6, -size * 0.7);
      }
    } else if (style === 'Romulan') {
      if (cohort === 'destroyer_group') {
        // Romulan Destroyer (sleeker bird-of-prey style with wingtip guns and angled-up back)
        ctx.moveTo(0, -size * 0.9);
        ctx.lineTo(size * 0.15, -size * 0.75);
        ctx.lineTo(size * 0.25, -size * 0.4);
        ctx.lineTo(size * 0.7, -size * 0.1);
        ctx.lineTo(size * 0.7, -size * 0.3);
        ctx.lineTo(size * 0.66, -size * 0.3);
        ctx.lineTo(size * 0.66, -size * 0.08);
        ctx.lineTo(size * 0.3, size * 0.2);
        ctx.lineTo(size * 0.2, size * 0.1);
        ctx.lineTo(0, size * 0.1);
        ctx.lineTo(-size * 0.2, size * 0.1);
        ctx.lineTo(-size * 0.3, size * 0.2);
        ctx.lineTo(-size * 0.66, -size * 0.08);
        ctx.lineTo(-size * 0.66, -size * 0.3);
        ctx.lineTo(-size * 0.7, -size * 0.3);
        ctx.lineTo(-size * 0.7, -size * 0.1);
        ctx.lineTo(-size * 0.25, -size * 0.4);
        ctx.lineTo(-size * 0.15, -size * 0.75);
      } else if (cohort === 'cruiser_group') {
        ctx.moveTo(0, -size * 0.6);
        ctx.lineTo(size * 0.2, -size * 0.55);
        ctx.lineTo(size * 0.35, -size * 0.4);
        ctx.lineTo(size * 0.4, -size * 0.2);
        ctx.lineTo(size * 0.33, size * 0.0);
        // Right forward-sweeping beam to engine (shifted backward)
        ctx.lineTo(size * 0.56, -size * 0.2);
        ctx.lineTo(size * 0.66, -size * 0.75);
        ctx.lineTo(size * 0.74, -size * 0.75);
        ctx.lineTo(size * 0.54, size * 0.25);
        ctx.lineTo(size * 0.46, size * 0.25);
        ctx.lineTo(size * 0.53, -size * 0.1);
        ctx.lineTo(size * 0.3, size * 0.1);
        ctx.lineTo(size * 0.2, size * 0.4);
        ctx.lineTo(0, size * 0.4);
        ctx.lineTo(-size * 0.2, size * 0.4);
        ctx.lineTo(-size * 0.3, size * 0.1);
        // Left forward-sweeping beam to engine (shifted backward)
        ctx.lineTo(-size * 0.53, -size * 0.1);
        ctx.lineTo(-size * 0.46, size * 0.25);
        ctx.lineTo(-size * 0.54, size * 0.25);
        ctx.lineTo(-size * 0.74, -size * 0.75);
        ctx.lineTo(-size * 0.66, -size * 0.75);
        ctx.lineTo(-size * 0.56, -size * 0.2);
        ctx.lineTo(-size * 0.33, size * 0.0);
        ctx.lineTo(-size * 0.4, -size * 0.2);
        ctx.lineTo(-size * 0.35, -size * 0.4);
        ctx.lineTo(-size * 0.2, -size * 0.55);
      } else if (cohort === 'battleship_group') {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.25, -size * 0.7);
        ctx.lineTo(size * 0.6, -size * 0.6);
        ctx.lineTo(size * 1.2, -size * 0.5);
        ctx.lineTo(size * 1.0, 0);
        ctx.lineTo(size * 0.7, -size * 0.2);
        ctx.lineTo(size * 0.5, size * 0.4);
        ctx.lineTo(size * 0.25, size * 0.1);
        ctx.lineTo(size * 0.2, size * 0.8);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(-size * 0.2, size * 0.8);
        ctx.lineTo(-size * 0.25, size * 0.1);
        ctx.lineTo(-size * 0.5, size * 0.4);
        ctx.lineTo(-size * 0.7, -size * 0.2);
        ctx.lineTo(-size * 1.0, 0);
        ctx.lineTo(-size * 1.2, -size * 0.5);
        ctx.lineTo(-size * 0.6, -size * 0.6);
        ctx.lineTo(-size * 0.25, -size * 0.7);
      } else if (cohort === 'mammoth_group') {
        ctx.moveTo(0, -size * 0.9);
        ctx.lineTo(size * 0.4, -size * 0.8);
        ctx.lineTo(size * 0.8, -size * 0.5);
        ctx.lineTo(size * 1.2, 0);
        ctx.lineTo(size * 0.8, size * 0.6);
        ctx.lineTo(size * 0.5, size * 0.2);
        ctx.lineTo(size * 0.3, size * 0.9);
        ctx.lineTo(0, size * 0.8);
        ctx.lineTo(-size * 0.3, size * 0.9);
        ctx.lineTo(-size * 0.5, size * 0.2);
        ctx.lineTo(-size * 0.8, size * 0.6);
        ctx.lineTo(-size * 1.2, 0);
        ctx.lineTo(-size * 0.8, -size * 0.5);
        ctx.lineTo(-size * 0.4, -size * 0.8);
      } else {
        ctx.moveTo(0, -size * 1.0);
        ctx.lineTo(size * 0.2, -size * 0.5);
        ctx.lineTo(size * 0.2, -size * 0.25);
        ctx.lineTo(size * 0.55, -size * 0.25);
        ctx.lineTo(size * 0.55, -size * 0.45);
        ctx.lineTo(size * 0.65, -size * 0.45);
        ctx.lineTo(size * 0.65, size * 0.05);
        ctx.lineTo(size * 0.55, size * 0.05);
        ctx.lineTo(size * 0.55, -size * 0.15);
        ctx.lineTo(size * 0.2, -size * 0.15);
        ctx.lineTo(size * 0.2, size * 0.1);
        ctx.lineTo(0, size * 0.25);
        ctx.lineTo(-size * 0.2, size * 0.1);
        ctx.lineTo(-size * 0.2, -size * 0.15);
        ctx.lineTo(-size * 0.55, -size * 0.15);
        ctx.lineTo(-size * 0.55, size * 0.05);
        ctx.lineTo(-size * 0.65, size * 0.05);
        ctx.lineTo(-size * 0.65, -size * 0.45);
        ctx.lineTo(-size * 0.55, -size * 0.45);
        ctx.lineTo(-size * 0.55, -size * 0.25);
        ctx.lineTo(-size * 0.2, -size * 0.25);
        ctx.lineTo(-size * 0.2, -size * 0.5);
      }
    } else if (style === 'Gorn') {
      if (cohort === 'destroyer_group') {
        // Gorn Destroyer (heavy angular spearhead with double nose-gun pods)
        ctx.moveTo(0, -size * 0.425);
        ctx.lineTo(size * 0.2, -size * 0.375);
        ctx.lineTo(size * 0.2, -size * 0.25);
        ctx.lineTo(size * 0.5, -size * 0.4);
        ctx.lineTo(size * 0.6, -size * 0.4);
        ctx.lineTo(size * 0.6, size * 0.15);
        ctx.lineTo(size * 0.35, size * 0.23125);
        ctx.lineTo(size * 0.25, size * 0.29375);
        ctx.lineTo(0, size * 0.31875);
        ctx.lineTo(-size * 0.25, size * 0.29375);
        ctx.lineTo(-size * 0.35, size * 0.23125);
        ctx.lineTo(-size * 0.6, size * 0.15);
        ctx.lineTo(-size * 0.6, -size * 0.4);
        ctx.lineTo(-size * 0.5, -size * 0.4);
        ctx.lineTo(-size * 0.2, -size * 0.25);
        ctx.lineTo(-size * 0.2, -size * 0.375);
      } else if (cohort === 'cruiser_group') {
        ctx.moveTo(-size * 0.4, -size * 0.8);
        ctx.lineTo(size * 0.4, -size * 0.8);
        ctx.lineTo(size * 0.4, -size * 0.5);
        ctx.lineTo(size * 0.2, -size * 0.5);
        ctx.lineTo(size * 0.2, size * 0.1);
        ctx.lineTo(size * 0.8, size * 0.1);
        ctx.lineTo(size * 0.8, size * 0.5);
        ctx.lineTo(size * 0.5, size * 0.5);
        ctx.lineTo(size * 0.3, size * 0.8);
        ctx.lineTo(-size * 0.3, size * 0.8);
        ctx.lineTo(-size * 0.5, size * 0.5);
        ctx.lineTo(-size * 0.8, size * 0.5);
        ctx.lineTo(-size * 0.8, size * 0.1);
        ctx.lineTo(-size * 0.2, size * 0.1);
        ctx.lineTo(-size * 0.2, -size * 0.5);
        ctx.lineTo(-size * 0.4, -size * 0.5);
      } else if (cohort === 'battleship_group') {
        ctx.moveTo(-size * 0.4, -size);
        ctx.lineTo(size * 0.4, -size);
        ctx.lineTo(size * 0.4, -size * 0.6);
        ctx.lineTo(size * 0.8, -size * 0.6);
        ctx.lineTo(size * 0.8, size * 0.3);
        ctx.lineTo(size * 0.5, size * 0.3);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.lineTo(size * 0.2, size * 0.8);
        ctx.lineTo(size * 0.2, size * 0.9);
        ctx.lineTo(-size * 0.2, size * 0.9);
        ctx.lineTo(-size * 0.2, size * 0.8);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.lineTo(-size * 0.5, size * 0.3);
        ctx.lineTo(-size * 0.8, size * 0.3);
        ctx.lineTo(-size * 0.8, -size * 0.6);
        ctx.lineTo(-size * 0.4, -size * 0.6);
      } else if (cohort === 'mammoth_group') {
        ctx.moveTo(-size * 0.6, -size * 0.9);
        ctx.lineTo(size * 0.6, -size * 0.9);
        ctx.lineTo(size * 0.6, -size * 0.3);
        ctx.lineTo(size * 0.9, -size * 0.3);
        ctx.lineTo(size * 0.9, size * 0.9);
        ctx.lineTo(size * 0.5, size * 0.9);
        ctx.lineTo(size * 0.5, size * 0.3);
        ctx.lineTo(-size * 0.5, size * 0.3);
        ctx.lineTo(-size * 0.5, size * 0.9);
        ctx.lineTo(-size * 0.9, size * 0.9);
        ctx.lineTo(-size * 0.9, -size * 0.3);
        ctx.lineTo(-size * 0.6, -size * 0.3);
      } else {
        ctx.moveTo(-size * 0.25, -size * 0.56);
        ctx.lineTo(size * 0.25, -size * 0.56);
        ctx.lineTo(size * 0.34, -size * 0.28);
        ctx.lineTo(size * 0.67, -size * 0.14);
        ctx.lineTo(size * 0.67, size * 0.28);
        ctx.lineTo(size * 0.42, size * 0.28);
        ctx.lineTo(size * 0.42, size * 0.56);
        ctx.lineTo(size * 0.17, size * 0.56);
        ctx.lineTo(size * 0.17, size * 0.42);
        ctx.lineTo(-size * 0.17, size * 0.42);
        ctx.lineTo(-size * 0.17, size * 0.56);
        ctx.lineTo(-size * 0.42, size * 0.56);
        ctx.lineTo(-size * 0.42, size * 0.28);
        ctx.lineTo(-size * 0.67, size * 0.28);
        ctx.lineTo(-size * 0.67, -size * 0.14);
        ctx.lineTo(-size * 0.34, -size * 0.28);
      }
    } else if (style === 'Tholian') {
      if (cohort === 'destroyer_group') {
        // Tholian Destroyer (crystalline facet shard)
        ctx.moveTo(0, -size * 1.1);
        ctx.lineTo(size * 0.35, -size * 0.4);
        ctx.lineTo(size * 0.75, -size * 0.1);
        ctx.lineTo(size * 0.45, size * 0.35);
        ctx.lineTo(size * 0.15, size * 0.15);
        ctx.lineTo(0, size * 0.8);
        ctx.lineTo(-size * 0.15, size * 0.15);
        ctx.lineTo(-size * 0.45, size * 0.35);
        ctx.lineTo(-size * 0.75, -size * 0.1);
        ctx.lineTo(-size * 0.35, -size * 0.4);
      } else if (cohort === 'cruiser_group') {
        ctx.moveTo(0, -size * 1.2);
        ctx.lineTo(size * 0.3, -size * 0.65);
        ctx.lineTo(size * 0.8, -size * 0.65);
        ctx.lineTo(size * 0.5, 0);
        ctx.lineTo(size * 0.9, size * 0.3);
        ctx.lineTo(size * 0.3, size * 0.3);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(-size * 0.3, size * 0.3);
        ctx.lineTo(-size * 0.9, size * 0.3);
        ctx.lineTo(-size * 0.5, 0);
        ctx.lineTo(-size * 0.8, -size * 0.65);
        ctx.lineTo(-size * 0.3, -size * 0.65);
      } else if (cohort === 'battleship_group') {
        ctx.moveTo(0, -size * 1.2);
        ctx.lineTo(size * 0.4, -size * 0.85);
        ctx.lineTo(size * 0.9, -size * 0.55);
        ctx.lineTo(size * 0.6, 0);
        ctx.lineTo(size * 0.9, size * 0.25);
        ctx.lineTo(size * 0.4, size * 0.45);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(-size * 0.4, size * 0.45);
        ctx.lineTo(-size * 0.9, size * 0.25);
        ctx.lineTo(-size * 0.6, 0);
        ctx.lineTo(-size * 0.9, -size * 0.55);
        ctx.lineTo(-size * 0.4, -size * 0.85);
      } else if (cohort === 'mammoth_group') {
        ctx.moveTo(0, -size * 1.25);
        ctx.lineTo(size * 0.2, -size * 0.75);
        ctx.lineTo(size * 0.7, -size * 1.0);
        ctx.lineTo(size * 0.5, -size * 0.45);
        ctx.lineTo(size * 1.0, -size * 0.45);
        ctx.lineTo(size * 0.6, 0);
        ctx.lineTo(size * 1.0, size * 0.18);
        ctx.lineTo(size * 0.5, size * 0.18);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(size * 0.2, size * 0.38);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(-size * 0.2, size * 0.38);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.5, size * 0.18);
        ctx.lineTo(-size * 1.0, size * 0.18);
        ctx.lineTo(-size * 0.6, 0);
        ctx.lineTo(-size * 1.0, -size * 0.45);
        ctx.lineTo(-size * 0.5, -size * 0.45);
        ctx.lineTo(-size * 0.7, -size * 1.0);
        ctx.lineTo(-size * 0.2, -size * 0.75);
      } else {
        ctx.moveTo(0, -size * 1.2);
        ctx.lineTo(size * 0.4, -size * 0.5);
        ctx.lineTo(size * 0.9, 0);
        ctx.lineTo(size * 0.4, size * 0.25);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(-size * 0.4, size * 0.25);
        ctx.lineTo(-size * 0.9, 0);
        ctx.lineTo(-size * 0.4, -size * 0.5);
        ctx.moveTo(0, -size * 0.6);
        ctx.lineTo(-size * 0.2, 0);
        ctx.lineTo(0, size * 0.3);
        ctx.lineTo(size * 0.2, 0);
      }
    } else if (style === 'Lyran') {
      if (cohort === 'destroyer_group') {
        // Lyran Destroyer (twin-hull catamaran connected by a wing bridge)
        ctx.moveTo(0, -size * 0.2);
        ctx.lineTo(size * 0.4, -size * 0.2);
        ctx.lineTo(size * 0.5, -size * 0.95);
        ctx.lineTo(size * 0.75, -size * 0.95);
        ctx.lineTo(size * 0.75, size * 0.8);
        ctx.lineTo(size * 0.5, size * 0.8);
        ctx.lineTo(size * 0.4, size * 0.4);
        ctx.lineTo(0, size * 0.4);
        ctx.lineTo(-size * 0.4, size * 0.4);
        ctx.lineTo(-size * 0.5, size * 0.8);
        ctx.lineTo(-size * 0.75, size * 0.8);
        ctx.lineTo(-size * 0.75, -size * 0.95);
        ctx.lineTo(-size * 0.5, -size * 0.95);
        ctx.lineTo(-size * 0.4, -size * 0.2);
      } else if (cohort === 'cruiser_group') {
        ctx.moveTo(-size * 0.7, -size * 0.9);
        ctx.lineTo(-size * 0.3, -size * 0.9);
        ctx.lineTo(-size * 0.3, size * 0.2);
        ctx.lineTo(size * 0.3, size * 0.2);
        ctx.lineTo(size * 0.3, -size * 0.9);
        ctx.lineTo(size * 0.7, -size * 0.9);
        ctx.lineTo(size * 0.9, size * 0.6);
        ctx.lineTo(size * 0.4, size * 0.6);
        ctx.lineTo(size * 0.2, size * 0.9);
        ctx.lineTo(-size * 0.2, size * 0.9);
        ctx.lineTo(-size * 0.4, size * 0.6);
        ctx.lineTo(-size * 0.9, size * 0.6);
      } else if (cohort === 'battleship_group') {
        ctx.moveTo(0, -size * 0.7);
        ctx.lineTo(size * 0.2, -size * 0.7);
        ctx.lineTo(size * 0.2, -size * 0.4);
        ctx.lineTo(size * 0.5, -size * 0.4);
        ctx.lineTo(size * 0.5, -size);
        ctx.lineTo(size * 0.8, -size);
        ctx.lineTo(size * 0.8, -size * 0.2);
        ctx.lineTo(size * 1.2, 0);
        ctx.lineTo(size * 1.2, size * 0.4);
        ctx.lineTo(size * 0.8, size * 0.4);
        ctx.lineTo(size * 0.8, size * 0.9);
        ctx.lineTo(size * 0.4, size * 0.9);
        ctx.lineTo(size * 0.4, size * 0.6);
        ctx.lineTo(-size * 0.4, size * 0.6);
        ctx.lineTo(-size * 0.4, size * 0.9);
        ctx.lineTo(-size * 0.8, size * 0.9);
        ctx.lineTo(-size * 0.8, size * 0.4);
        ctx.lineTo(-size * 1.2, size * 0.4);
        ctx.lineTo(-size * 1.2, 0);
        ctx.lineTo(-size * 0.8, -size * 0.2);
        ctx.lineTo(-size * 0.8, -size);
        ctx.lineTo(-size * 0.5, -size);
        ctx.lineTo(-size * 0.5, -size * 0.4);
        ctx.lineTo(-size * 0.2, -size * 0.4);
        ctx.lineTo(-size * 0.2, -size * 0.7);
      } else if (cohort === 'mammoth_group') {
        ctx.moveTo(0, -size * 0.4);
        ctx.lineTo(size * 0.1, -size * 0.4);
        ctx.lineTo(size * 0.1, -size * 0.7);
        ctx.lineTo(size * 0.3, -size * 0.7);
        ctx.lineTo(size * 0.3, -size * 0.4);
        ctx.lineTo(size * 0.6, -size * 0.4);
        ctx.lineTo(size * 0.6, -size);
        ctx.lineTo(size * 0.9, -size);
        ctx.lineTo(size * 0.9, -size * 0.2);
        ctx.lineTo(size * 1.3, -size * 0.2);
        ctx.lineTo(size * 1.3, size * 0.5);
        ctx.lineTo(size * 0.9, size * 0.5);
        ctx.lineTo(size * 0.9, size * 0.9);
        ctx.lineTo(size * 0.6, size * 0.9);
        ctx.lineTo(size * 0.6, size * 0.6);
        ctx.lineTo(size * 0.2, size * 0.6);
        ctx.lineTo(size * 0.2, size * 0.9);
        ctx.lineTo(-size * 0.2, size * 0.9);
        ctx.lineTo(-size * 0.2, size * 0.6);
        ctx.lineTo(-size * 0.6, size * 0.6);
        ctx.lineTo(-size * 0.6, size * 0.9);
        ctx.lineTo(-size * 0.9, size * 0.9);
        ctx.lineTo(-size * 0.9, size * 0.5);
        ctx.lineTo(-size * 1.3, size * 0.5);
        ctx.lineTo(-size * 1.3, -size * 0.2);
        ctx.lineTo(-size * 0.9, -size * 0.2);
        ctx.lineTo(-size * 0.9, -size);
        ctx.lineTo(-size * 0.6, -size);
        ctx.lineTo(-size * 0.6, -size * 0.4);
        ctx.lineTo(-size * 0.3, -size * 0.4);
        ctx.lineTo(-size * 0.3, -size * 0.7);
        ctx.lineTo(-size * 0.1, -size * 0.7);
        ctx.lineTo(-size * 0.1, -size * 0.4);
      } else {
        ctx.moveTo(-size * 0.14, -size * 0.9);
        ctx.lineTo(size * 0.14, -size * 0.9);
        ctx.lineTo(size * 0.14, -size * 0.4);
        ctx.lineTo(size * 0.63, size * 0.6);
        ctx.lineTo(size * 0.28, size * 0.6);
        ctx.lineTo(size * 0.14, size * 0.9);
        ctx.lineTo(-size * 0.14, size * 0.9);
        ctx.lineTo(-size * 0.28, size * 0.6);
        ctx.lineTo(-size * 0.63, size * 0.6);
        ctx.lineTo(-size * 0.14, -size * 0.4);
      }
    } else {
      if (cohort === 'destroyer_group') {
        // Klingon Destroyer (bulbous head, short neck, wings angling down 1/5 more, engine pods)
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.35, -size * 0.8);
        ctx.lineTo(size * 0.2, -size * 0.6);
        ctx.lineTo(size * 0.12, -size * 0.3);
        ctx.lineTo(size * 0.25, size * 0.12);
        ctx.lineTo(size * 0.55, size * 0.12);
        ctx.lineTo(size * 0.55, -size * 0.1);
        ctx.lineTo(size * 0.7, -size * 0.1);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(size * 0.55, size * 0.5);
        ctx.lineTo(size * 0.45, size * 0.5);
        ctx.lineTo(0, size * 0.6);
        ctx.lineTo(-size * 0.45, size * 0.5);
        ctx.lineTo(-size * 0.55, size * 0.5);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.7, -size * 0.1);
        ctx.lineTo(-size * 0.55, -size * 0.1);
        ctx.lineTo(-size * 0.55, size * 0.12);
        ctx.lineTo(-size * 0.25, size * 0.12);
        ctx.lineTo(-size * 0.12, -size * 0.3);
        ctx.lineTo(-size * 0.2, -size * 0.6);
        ctx.lineTo(-size * 0.35, -size * 0.8);
      } else if (cohort === 'cruiser_group' || cohort === 'battleship_group' || cohort === 'mammoth_group') {
        ctx.moveTo(0, -size);
        ctx.lineTo(size / 6, -size * 0.85);
        ctx.lineTo(size / 8, -size * 0.75);
        ctx.lineTo(size / 10, -size * 0.2);
        ctx.lineTo(size * 0.8, -size * 0.1);
        // Right wingtip gun barrel
        ctx.lineTo(size * 0.87, size * 0.2);
        ctx.lineTo(size * 0.87, size * 0.05);
        ctx.lineTo(size * 0.93, size * 0.05);
        ctx.lineTo(size * 0.93, size * 0.2);
        ctx.lineTo(size * 0.9, size * 0.5);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(size * 0.6, size * 0.3);
        ctx.lineTo(size / 4, size * 0.4);
        ctx.lineTo(size / 5, size * 0.6);
        ctx.lineTo(-size / 5, size * 0.6);
        ctx.lineTo(-size / 4, size * 0.4);
        ctx.lineTo(-size * 0.6, size * 0.3);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.9, size * 0.5);
        // Left wingtip gun barrel
        ctx.lineTo(-size * 0.93, size * 0.2);
        ctx.lineTo(-size * 0.93, size * 0.05);
        ctx.lineTo(-size * 0.87, size * 0.05);
        ctx.lineTo(-size * 0.87, size * 0.2);
        ctx.lineTo(-size * 0.8, -size * 0.1);
        ctx.lineTo(-size / 10, -size * 0.2);
        ctx.lineTo(-size / 8, -size * 0.75);
        ctx.lineTo(-size / 6, -size * 0.85);
      } else {
        ctx.moveTo(0, -size);
        ctx.lineTo(size / 6, -size * 0.85);
        ctx.lineTo(size / 8, -size * 0.75);
        ctx.lineTo(size / 10, -size * 0.2);
        ctx.lineTo(size * 0.8, -size * 0.1);
        ctx.lineTo(size * 0.9, size * 0.2);
        ctx.lineTo(size * 0.9, size * 0.5);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(size * 0.6, size * 0.3);
        ctx.lineTo(size / 4, size * 0.4);
        ctx.lineTo(size / 5, size * 0.6);
        ctx.lineTo(-size / 5, size * 0.6);
        ctx.lineTo(-size / 4, size * 0.4);
        ctx.lineTo(-size * 0.6, size * 0.3);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.9, size * 0.5);
        ctx.lineTo(-size * 0.9, size * 0.2);
        ctx.lineTo(-size * 0.8, -size * 0.1);
        ctx.lineTo(-size / 10, -size * 0.2);
        ctx.lineTo(-size / 8, -size * 0.75);
        ctx.lineTo(-size / 6, -size * 0.85);
      }
    }
  }

  function drawShipClassOnCanvas(canvas, classType, style, playerColor, isCruiserBtn = true) {
    if (!canvas) return;
    const ctxBtn = canvas.getContext('2d');
    ctxBtn.clearRect(0, 0, canvas.width, canvas.height);
    
    ctxBtn.save();
    ctxBtn.translate(canvas.width / 2, canvas.height / 2);
    
    let cohort = 'scout_group';
    if (classType === 'destroyer') {
      cohort = 'destroyer_group';
    } else if (classType === 'cruiser' || classType === 'battlecruiser') {
      cohort = 'cruiser_group';
    } else if (classType === 'battleship' || classType === 'titan') {
      cohort = 'battleship_group';
    } else if (classType === 'mammoth') {
      cohort = 'mammoth_group';
    }
    
    let drawnButtonImage = false;
    if (graphicalMode && transparentShipsCanvas && !(style === 'Romulan' && classType === 'corvette')) {
      let normalizedStyle = style;
      if (normalizedStyle) {
        normalizedStyle = normalizedStyle.charAt(0).toUpperCase() + normalizedStyle.slice(1).toLowerCase();
      }
      if (!FACTION_MAPPING[normalizedStyle]) {
        normalizedStyle = 'Klingon';
      }
      const faction = FACTION_MAPPING[normalizedStyle];
      const classRow = CLASS_MAPPING[classType];
      if (faction && classRow) {
        const maxDim = Math.max(faction.w, classRow.h);
        const buttonScale = (isCruiserBtn ? 36 : 20) / maxDim;
        const drawnW = faction.w * buttonScale;
        const drawnH = classRow.h * buttonScale;
        
        ctxBtn.drawImage(
          transparentShipsCanvas,
          faction.x, classRow.y, faction.w, classRow.h,
          -drawnW / 2, -drawnH / 2, drawnW, drawnH
        );
        drawnButtonImage = true;
      }
    }

    if (!drawnButtonImage) {
      let size = isCruiserBtn ? 14 : 8;
      if (style === 'Romulan' && classType === 'corvette') {
        size *= 1.35;
      }
      ctxBtn.fillStyle = playerColor;
      drawRacialShipHull(ctxBtn, style, cohort, size);
      ctxBtn.closePath();
      ctxBtn.fill();
      
      ctxBtn.strokeStyle = '#000000';
      ctxBtn.lineWidth = 1;
      ctxBtn.stroke();
    }
    
    ctxBtn.restore();
  }

  function updateBuildButtonCanvases() {
    if (!localPlayer) return;
    const myPlayer = (serverState && serverState.players) ? serverState.players.find(p => p.id === localPlayer.id) : null;
    const style = myPlayer ? (myPlayer.cruiserStyle || 'Klingon') : (localPlayer.cruiserStyle || 'Klingon');
    const playerColor = myPlayer ? (myPlayer.color || '#00ffff') : (localPlayer.color || '#00ffff');

    for (const [classType, cfg] of Object.entries(SHIP_CLASSES)) {
      const el = document.getElementById(cfg.btnId);
      if (!el) continue;
      
      const isCruiserBtn = el.classList.contains('cruiser-build-btn');
      const targetSize = isCruiserBtn ? 40 : 24;
      let canvas = el.querySelector('canvas');
      if (!canvas || canvas.width !== targetSize) {
        const iconSpan = el.querySelector('.btn-icon');
        if (iconSpan) {
          iconSpan.innerHTML = '';
          canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          canvas.style.verticalAlign = 'middle';
          iconSpan.appendChild(canvas);
        }
      }
      
      if (canvas) {
        drawShipClassOnCanvas(canvas, classType, style, playerColor, isCruiserBtn);
      }
    }
  }

  const formatTooltipString = (str) => {
    if (str === undefined || str === null) return '';
    const s = String(str);
    return s.replace(/([-+]?\d+)\.\d+/g, (match) => {
      const val = Math.round(parseFloat(match));
      const hasPlus = match.startsWith('+');
      if (hasPlus && val >= 0) {
        return '+' + val;
      }
      return String(val);
    });
  };
  const SHIP_CLASSES = {
    corvette: { name: 'Corvette', key: 's', hp: 15, costShips: 50, costCap: 2, btnId: 'btn-build-corvette' },
    destroyer: { name: 'Destroyer', key: 'd', hp: 25, costShips: 100, costCap: 4, btnId: 'btn-build-destroyer' },
    battlecruiser: { name: 'Battlecruiser', key: 'a', hp: 35, costShips: 175, costCap: 7, btnId: 'btn-build-battlecruiser' },
    titan: { name: 'Titan', key: 't', hp: 45, costShips: 300, costCap: 12, btnId: 'btn-build-titan' },
    mammoth: { name: 'Mammoth', key: 'm', hp: 55, costShips: 500, costCap: 20, btnId: 'btn-build-mammoth' }
  };
  let cruiserBuildModeActive = false;
  let activeConfigClassType = null;
  let starfieldEnabled = true;
  let hoveredPlanet = null;
  let hoveredShip = null;
  let hoveredAnomaly = null;
  let hoveredAnomalyPlanet = null;
  let isHoveringSelectionTile = false;
  let selectionTileMouseX = 0;
  let selectionTileMouseY = 0;
  let isShiftSelectingInHUD = false;
  const hudSelectedSet = new Set();

  const getPlanetSVG = (p) => {
    const color = p.ownerId ? (serverState ? serverState.players.find(pl => pl.id === p.ownerId)?.color : null) || '#888' : '#555';
    return `
      <svg width="28" height="28" viewBox="0 0 32 32">
        <defs>
          <radialGradient id="grad-${p.id}" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.5"/>
            <stop offset="40%" stop-color="${color}"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0.8"/>
          </radialGradient>
          <filter id="glow-${p.id}">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="16" cy="16" r="12" fill="url(#grad-${p.id})" filter="url(#glow-${p.id})" />
      </svg>
    `;
  };

  const getShipSVG = (s, color) => {
    if (s.isAmoeba) {
      return `
        <svg width="28" height="28" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="10" fill="rgba(15, 255, 15, 0.2)" stroke="#0f0" stroke-width="2" />
          <circle cx="12" cy="14" r="2" fill="#0f0" />
          <circle cx="20" cy="14" r="2" fill="#0f0" />
          <path d="M 10,20 Q 16,24 22,20" fill="none" stroke="#0f0" stroke-width="1.5" />
        </svg>
      `;
    }
    let path = 'M 16,4 L 28,24 L 16,18 L 4,24 Z';
    if (s.isCruiser) {
      const style = s.cruiserStyle || 'Federation';
      if (style === 'Federation') {
        path = 'M 16,4 A 8,8 0 0,1 24,12 L 22,14 L 28,14 L 28,26 L 24,26 L 24,18 L 16,18 L 8,18 L 8,26 L 4,26 L 4,14 L 10,14 L 8,12 A 8,8 0 0,1 16,4 Z';
      } else if (style === 'Romulan') {
        path = 'M 16,4 L 24,10 L 28,20 L 22,22 L 20,16 L 16,18 L 12,16 L 10,22 L 4,20 L 8,10 Z';
      } else if (style === 'Klingon') {
        path = 'M 16,4 L 19,10 L 28,12 L 24,16 L 26,26 L 16,20 L 6,26 L 8,16 L 4,12 L 13,10 Z';
      } else {
        path = 'M 16,2 L 30,22 L 22,22 L 16,14 L 10,22 L 2,22 Z';
      }
    } else if (s.isMarineFleet) {
      path = 'M 16,4 Q 26,4 26,18 L 22,18 L 22,24 L 10,24 L 10,18 L 6,18 Q 6,4 16,4 Z';
    }
    return `
      <svg width="28" height="28" viewBox="0 0 32 32" style="filter: drop-shadow(0 0 3px ${color});">
        <path d="${path}" fill="${color}" stroke="#fff" stroke-width="1" stroke-linejoin="round" />
      </svg>
    `;
  };

  const drawUnitOnTileCanvas = (ctxTile, width, height, unit, type) => {
    ctxTile.clearRect(0, 0, width, height);
    
    // 1. Calculate the ideal scale to center the unit and its labels
    let scale = 1.0;
    if (type === 'planet') {
      scale = (width * 0.23) / unit.radius;
    } else if (type === 'ship') {
      if (unit.isCruiser) {
        const size = (6 + (unit.maxHealth || 0)) / 3;
        scale = (width * 0.23) / size;
      } else if (unit.isAmoeba) {
        const size = 6 + (unit.maxHealth || 0) * 1.5;
        scale = (width * 0.23) / size;
      } else {
        scale = 1.6;
      }
    }

    // 2. Set up centered coordinate system
    ctxTile.save();
    ctxTile.translate(width / 2, height / 2);
    ctxTile.scale(scale, scale);
    ctxTile.translate(-unit.x, -unit.y);

    const cameraZoom = 1.2; // Mock cameraZoom to force labels/upgrade drawings

    if (type === 'planet') {
      const p = unit;
      const owner = serverState.players.find(pl => pl.id === p.ownerId);

      let drawnPlanetImage = false;
      if (graphicalMode && transparentPlanetsCanvas) {
        const spriteIdx = 2 + (p.id % 78);
        const col = spriteIdx % 8;
        const row = Math.floor(spriteIdx / 8);
        const sx = 12 + col * 94;
        const sy = 26 + row * 94;

        ctxTile.save();
        ctxTile.beginPath();
        ctxTile.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
        ctxTile.clip();
        ctxTile.drawImage(
          transparentPlanetsCanvas,
          sx, sy, 94, 94,
          p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2
        );
        ctxTile.restore();
        
        drawnPlanetImage = true;
      }

      if (!drawnPlanetImage) {
        ctxTile.beginPath();
        ctxTile.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        if (owner) {
          ctxTile.fillStyle = owner.color;
          ctxTile.shadowColor = owner.color;
          ctxTile.shadowBlur = 15;
        } else {
          ctxTile.fillStyle = '#555';
          ctxTile.shadowColor = 'transparent';
          ctxTile.shadowBlur = 0;
        }
        ctxTile.fill();
      }

      // Soft cap and current maxships filled circles
      const isLastKnownPlanet = p.inFog && !p.permanentlyTracked && lastKnownPlanets[p.id] ? true : false;
      if (!p.inFog || p.permanentlyTracked || isLastKnownPlanet) {
        const techBonus = owner ? Math.sqrt(owner.techScore || 0) : 0;
        const threshold = p.sizeClass * ((p.habitability + techBonus) / 100);
        if (threshold > 0) {
          ctxTile.save();
          
          const planetColor = owner ? owner.color : '#555555';
          let r = 85, g = 85, b = 85;
          let clean = planetColor.replace('#', '');
          if (clean.length === 3) {
            clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
          }
          const num = parseInt(clean, 16);
          if (!isNaN(num)) {
            r = (num >> 16) & 255;
            g = (num >> 8) & 255;
            b = num & 255;
          }

          const lightR = Math.floor(r + (255 - r) * 0.6);
          const lightG = Math.floor(g + (255 - g) * 0.6);
          const lightB = Math.floor(b + (255 - b) * 0.6);
          const softCapFillColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.25)`;
          const softCapStrokeColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.4)`;

          const darkR = Math.floor(r * 0.55);
          const darkG = Math.floor(g * 0.55);
          const darkB = Math.floor(b * 0.55);
          const currentMaxShipsFillColor = `rgba(${darkR}, ${darkG}, ${darkB}, 0.35)`;
          const currentMaxShipsStrokeColor = `rgba(${darkR}, ${darkG}, ${darkB}, 0.55)`;

          ctxTile.beginPath();
          ctxTile.arc(p.x, p.y, threshold / 4, 0, Math.PI * 2);
          ctxTile.fillStyle = softCapFillColor;
          ctxTile.fill();
          ctxTile.strokeStyle = softCapStrokeColor;
          ctxTile.lineWidth = 1;
          ctxTile.stroke();

          if (p.maxShips > 0) {
            ctxTile.beginPath();
            ctxTile.arc(p.x, p.y, p.maxShips / 4, 0, Math.PI * 2);
            ctxTile.fillStyle = currentMaxShipsFillColor;
            ctxTile.fill();
            ctxTile.strokeStyle = currentMaxShipsStrokeColor;
            ctxTile.lineWidth = 1;
            ctxTile.stroke();
          }

          if (p.habitability < 100 && p.sizeClass > 0) {
            ctxTile.beginPath();
            ctxTile.arc(p.x, p.y, p.sizeClass / 4, 0, Math.PI * 2);
            ctxTile.strokeStyle = 'rgba(150, 150, 150, 0.3)';
            ctxTile.lineWidth = 1;
            ctxTile.stroke();
          }

          ctxTile.restore();
        }
      }

      // Revolt warmup counter red ring
      if (p.revoltWarmup && p.revoltWarmup > 0 && p.revoltWarmupMax) {
        ctxTile.save();
        ctxTile.beginPath();
        const progress = Math.min(1.0, p.revoltWarmup / p.revoltWarmupMax);
        ctxTile.arc(p.x, p.y, p.radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctxTile.strokeStyle = 'rgba(255, 50, 50, 0.85)';
        ctxTile.lineWidth = 2;
        ctxTile.stroke();
        ctxTile.restore();
      }

      if (planetShields[p.id] > 0) {
        ctxTile.beginPath();
        ctxTile.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
        ctxTile.strokeStyle = `rgba(255, 255, 0, ${Math.min(1, planetShields[p.id])})`;
        ctxTile.lineWidth = 3;
        ctxTile.shadowColor = '#ff0';
        ctxTile.shadowBlur = 10;
        ctxTile.stroke();
      }

      if (serverState.players) {
        let currentAngle = -Math.PI / 2;
        const ringRadius = p.radius + 6;
        for (const player of serverState.players) {
          const symLevel = getEffectiveSympathyClient(p, player.id);
          if (symLevel > 0) {
            const angleSize = (Math.PI * 2 * symLevel) / p.maxShips;
            ctxTile.beginPath();
            ctxTile.arc(p.x, p.y, ringRadius, currentAngle, currentAngle + angleSize);
            ctxTile.strokeStyle = player.color;
            ctxTile.lineWidth = 2;
            ctxTile.stroke();
            currentAngle += angleSize;
          }
        }
      }

      if (p.inRevolt) {
        ctxTile.save();
        ctxTile.beginPath();
        const pulseRadius = p.radius + 10 + Math.sin(Date.now() / 100) * 2;
        ctxTile.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
        ctxTile.strokeStyle = '#ff3333';
        ctxTile.lineWidth = 2;
        ctxTile.stroke();

        ctxTile.font = 'bold 8px Orbitron';
        ctxTile.textAlign = 'center';
        ctxTile.textBaseline = 'bottom';
        const alpha = 0.5 + Math.sin(Date.now() / 150) * 0.5;
        ctxTile.fillStyle = `rgba(255, 51, 51, ${alpha})`;
        ctxTile.fillText('✊ REVOLTING', p.x, p.y - p.radius - 16);
        ctxTile.restore();
      }

      ctxTile.shadowBlur = 0;

      if (p.focusTransition) {
        const progress = p.focusTransition.progress || 0;
        const target = p.focusTransition.targetMode;
        const emoji = target === 'research' ? '🔬' : (target === 'garrison' ? '🛡️' : (target === 'commerce' ? '💲' : (target === 'mining' ? '⛏️' : (target === 'terraforming' ? '🌱' : '📈'))));
        
        ctxTile.save();
        ctxTile.beginPath();
        const ringRadius = p.radius + 12;
        ctxTile.arc(p.x, p.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
        ctxTile.strokeStyle = '#39ff14';
        ctxTile.lineWidth = 2;
        ctxTile.stroke();
        ctxTile.restore();
      }

      if (!p.inFog || p.permanentlyTracked || isLastKnownPlanet) {
        const displayShips = isLastKnownPlanet ? lastKnownPlanets[p.id].ships : p.ships;
        const displayMaxShips = isLastKnownPlanet ? lastKnownPlanets[p.id].maxShips : p.maxShips;
        const displayOwnerId = isLastKnownPlanet ? lastKnownPlanets[p.id].ownerId : p.ownerId;
        const displayOwner = serverState.players.find(pl => pl.id === displayOwnerId);

        let pName = (isLastKnownPlanet ? lastKnownPlanets[p.id].name : p.name) || 'Unknown';
        const nameY = p.y - p.radius - 10;
        let displayName = `${pName} (${Math.floor(displayShips)}/${Math.round(displayMaxShips)})`;
        const displayHomeworldOf = isLastKnownPlanet ? lastKnownPlanets[p.id].homeworldOf : p.homeworldOf;
        if (displayHomeworldOf) {
          displayName = `👑 ${displayName}`;
        }

        if (isLastKnownPlanet) {
          ctxTile.fillStyle = '#888';
        } else if (owner) {
          ctxTile.fillStyle = owner.color;
        } else {
          ctxTile.fillStyle = '#ffffff';
        }
        ctxTile.font = 'bold 8px Orbitron';
        ctxTile.textAlign = 'center';
        ctxTile.textBaseline = 'middle';
        ctxTile.fillText(displayName, p.x, nameY);

        if (!isLastKnownPlanet && p.finalRateExceedsOne) {
          const nameWidth = ctxTile.measureText(displayName).width;
          ctxTile.save();
          ctxTile.font = '8px sans-serif';
          ctxTile.textAlign = 'left';
          ctxTile.textBaseline = 'middle';
          ctxTile.fillStyle = '#fff';
          ctxTile.fillText('🏭', p.x + nameWidth / 2 + 4, nameY);
          ctxTile.restore();
        }

        const myPlayer = (serverState && serverState.players && localPlayer) ? (serverState.players.find(pl => pl.id === localPlayer.id) || localPlayer) : localPlayer;
        if (myPlayer && !p.dead) {
          const isOwn = (p.ownerId === myPlayer.id);
          let isNotAtWar = true;
          if (p.ownerId) {
            if (p.ownerId === 'monsters') {
              isNotAtWar = false;
            } else {
              const isAtWar = !!(myPlayer.atWarWith && myPlayer.atWarWith[p.ownerId] && Date.now() < myPlayer.atWarWith[p.ownerId]);
              if (isAtWar) isNotAtWar = false;
            }
          }
          if (!isOwn && isNotAtWar) {
            const tradingShips = Math.floor(getPlanetTradeIncomePerMin(p) * 25);
            if (tradingShips > 0) {
              const nameWidth = ctxTile.measureText(displayName).width;
              let rightOffset = nameWidth / 2 + 4;
              if (!isLastKnownPlanet && p.finalRateExceedsOne) {
                rightOffset += 16;
              }
              ctxTile.save();
              ctxTile.font = '8px sans-serif';
              ctxTile.textAlign = 'left';
              ctxTile.textBaseline = 'middle';
              ctxTile.fillText(`🚢${tradingShips}`, p.x + rightOffset, nameY);
              ctxTile.restore();
            }
          }
        }
      }
    } else if (type === 'ship') {
      const s = unit;
      const owner = serverState.players.find(pl => pl.id === s.ownerId);

      ctxTile.fillStyle = owner ? owner.color : '#fff';
      
      if (s.count > 1 && !s.isCruiser && !s.isAmoeba) {
        const maxSpread = Math.min(60, 10 + Math.sqrt(s.count || 1) * 2.5);
        let maxRender = 40;
        const renderCount = Math.min(maxRender, s.count);
        for (let i = 0; i < renderCount; i++) {
          const { lx, ly } = getFormationOffset(s.formation, i, renderCount, maxSpread, s.isInterceptor, s.isBomber);
          const cos = Math.cos(s.angle || 0);
          const sin = Math.sin(s.angle || 0);
          const drawX = s.x + lx * cos - ly * sin;
          const drawY = s.y + lx * sin + ly * cos;
          
          if (s.isBomber) {
            let angle = 0;
            if (s.targetX !== undefined && s.targetY !== undefined) {
              angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
            }
            const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
            const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
            if (sheet) {
              ctxTile.drawImage(sheet, angleDeg * 16, 16, 16, 16, drawX - 8, drawY - 8, 16, 16);
            } else {
              ctxTile.save();
              ctxTile.translate(drawX, drawY);
              ctxTile.rotate(angle + Math.PI / 2);
              ctxTile.beginPath();
              ctxTile.moveTo(0, -4);
              ctxTile.lineTo(4, 4);
              ctxTile.lineTo(-4, 4);
              ctxTile.closePath();
              ctxTile.fill();
              ctxTile.restore();
            }
          } else if (s.isInterceptor) {
            let angle = 0;
            if (s.targetX !== undefined && s.targetY !== undefined) {
              angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
            }
            const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
            const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
            if (sheet) {
              ctxTile.drawImage(sheet, angleDeg * 16, 32, 16, 16, drawX - 8, drawY - 8, 16, 16);
            } else {
              ctxTile.save();
              ctxTile.translate(drawX, drawY);
              ctxTile.rotate(angle + Math.PI / 2);
              ctxTile.beginPath();
              ctxTile.moveTo(0, -3);
              ctxTile.lineTo(3, 3);
              ctxTile.lineTo(-3, 3);
              ctxTile.closePath();
              ctxTile.fill();
              ctxTile.restore();
            }
          } else {
            const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
            if (sheet) {
              ctxTile.drawImage(sheet, 0, 0, 16, 16, drawX - 8, drawY - 8, 16, 16);
            } else {
              ctxTile.beginPath();
              ctxTile.arc(drawX, drawY, 1.5, 0, Math.PI * 2);
              ctxTile.fill();
            }
          }
        }

        if (s.count > renderCount) {
          ctxTile.save();
          ctxTile.font = 'bold 8px Orbitron';
          ctxTile.fillStyle = owner ? owner.color : '#ffffff';
          ctxTile.textAlign = 'center';
          ctxTile.textBaseline = 'bottom';
          ctxTile.fillText(`+${Math.round(s.count - renderCount)}`, s.x, s.y - maxSpread - 4);
          ctxTile.restore();
        }
      } else {
        if (s.isBomber) {
          let angle = 0;
          if (s.targetX !== undefined && s.targetY !== undefined) {
            angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
          }
          const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
          const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
          if (sheet) {
            ctxTile.drawImage(sheet, angleDeg * 16, 16, 16, 16, s.x - 8, s.y - 8, 16, 16);
          } else {
            ctxTile.save();
            ctxTile.translate(s.x, s.y);
            ctxTile.rotate(angle + Math.PI / 2);
            ctxTile.beginPath();
            ctxTile.moveTo(0, -5);
            ctxTile.lineTo(5, 5);
            ctxTile.lineTo(-5, 5);
            ctxTile.closePath();
            ctxTile.fill();
            ctxTile.restore();
          }
        } else if (s.isInterceptor) {
          let angle = 0;
          if (s.targetX !== undefined && s.targetY !== undefined) {
            angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
          }
          const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
          const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
          if (sheet) {
            ctxTile.drawImage(sheet, angleDeg * 16, 32, 16, 16, s.x - 8, s.y - 8, 16, 16);
          } else {
            ctxTile.save();
            ctxTile.translate(s.x, s.y);
            ctxTile.rotate(angle + Math.PI / 2);
            ctxTile.beginPath();
            ctxTile.moveTo(0, -3);
            ctxTile.lineTo(3, 3);
            ctxTile.lineTo(-3, 3);
            ctxTile.closePath();
            ctxTile.fill();
            ctxTile.restore();
          }
        } else if (s.isAmoeba) {
          const size = (6 + (s.maxHealth || 0) * 1.5);
          const time = Date.now() / 500 + s.id;
          ctxTile.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = size + Math.sin(time + i) * (size * 0.2);
            const px = s.x + AMOEBA_COS[i] * r;
            const py = s.y + AMOEBA_SIN[i] * r;
            if (i === 0) ctxTile.moveTo(px, py);
            else ctxTile.lineTo(px, py);
          }
          ctxTile.closePath();
          
          ctxTile.save();
          ctxTile.fillStyle = "rgba(0, 100, 0, 0.7)";
          ctxTile.strokeStyle = "#0f0";
          ctxTile.lineWidth = 1.5;
          ctxTile.fill();
          ctxTile.stroke();
          ctxTile.restore();
        } else if (s.isCruiser) {
          ctxTile.save();
          if (s.isMaterializing && s.materializeProgress !== undefined) {
            ctxTile.globalAlpha = s.materializeProgress;
          } else if (s.isDismantling && s.dismantleTimer !== undefined && s.dismantleDuration) {
            ctxTile.globalAlpha = Math.max(0, Math.min(1.0, s.dismantleTimer / s.dismantleDuration));
          }
          let angle = s.angle || 0;
          let ownerPlayer = serverState.players.find(p => p.id === s.ownerId);
          let style = s.cruiserStyle || (ownerPlayer ? ownerPlayer.cruiserStyle : 'Klingon');
          let size = ((6 + (s.maxHealth || 0) * 1.0) / 3.0);
          if (style === 'Romulan' && s.classType === 'corvette') {
            size *= 1.35;
          }

          let cohort = 'scout_group';
          if (s.classType === 'destroyer') {
            cohort = 'destroyer_group';
          } else if (s.classType === 'cruiser' || s.classType === 'battlecruiser') {
            cohort = 'cruiser_group';
          } else if (s.classType === 'battleship' || s.classType === 'titan') {
            cohort = 'battleship_group';
          } else if (s.classType === 'mammoth') {
            cohort = 'mammoth_group';
          }

          let drawnShipImage = false;
          if (graphicalMode && transparentShipsCanvas && !(style === 'Romulan' && s.classType === 'corvette')) {
            let normalizedStyle = style;
            if (normalizedStyle) {
              normalizedStyle = normalizedStyle.charAt(0).toUpperCase() + normalizedStyle.slice(1).toLowerCase();
            }
            if (!FACTION_MAPPING[normalizedStyle]) {
              normalizedStyle = 'Klingon';
            }
            const faction = FACTION_MAPPING[normalizedStyle];
            const classRow = CLASS_MAPPING[s.classType || 'corvette'];
            if (faction && classRow) {
              let drawScale = (6 + (s.maxHealth || 0)) / 240;
              if (s.classType === 'corvette') {
                drawScale *= 1.6;
              } else if (s.classType === 'frigate') {
                drawScale *= 1.4;
              }
              const drawnW = faction.w * drawScale;
              const drawnH = classRow.h * drawScale;
              
              ctxTile.save();
              ctxTile.translate(s.x, s.y);
              ctxTile.rotate(angle + Math.PI / 2);
              ctxTile.drawImage(
                transparentShipsCanvas,
                faction.x, classRow.y, faction.w, classRow.h,
                -drawnW / 2, -drawnH / 2, drawnW, drawnH
              );
              ctxTile.restore();
              drawnShipImage = true;
            }
          }

          if (!drawnShipImage) {
            ctxTile.save();
            ctxTile.translate(s.x, s.y);
            ctxTile.rotate(angle + Math.PI / 2);
            ctxTile.beginPath();
            drawRacialShipHull(ctxTile, style, cohort, size);
            ctxTile.closePath();
            ctxTile.fill();
            ctxTile.strokeStyle = '#000';
            ctxTile.lineWidth = 1;
            ctxTile.stroke();
            ctxTile.restore();
          }

          if (s.isActivelyResearching && s.accumulatedTech !== undefined) {
            ctxTile.save();
            ctxTile.beginPath();
            const progress = Math.max(0.0, Math.min(1.0, s.accumulatedTech));
            ctxTile.arc(s.x, s.y, size + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            ctxTile.strokeStyle = 'rgba(0, 76, 255, 0.95)';
            ctxTile.lineWidth = 1.5;
            ctxTile.stroke();
            ctxTile.restore();
          }

          const activeUpgrades = [];
          if ((s.sensorarrays || 0) > 0) activeUpgrades.push({ symbol: '📡', count: s.sensorarrays });
          if ((s.labs || 0) > 0) activeUpgrades.push({ symbol: '🔬', count: s.labs });
          if ((s.shields || 0) > 0) activeUpgrades.push({ symbol: '🌀', count: s.shields });
          if ((s.armor || 0) > 0) activeUpgrades.push({ symbol: '🛡️', count: s.armor });
          if ((s.engine || 0) > 0) activeUpgrades.push({ symbol: '🚀', count: s.engine });
          if ((s.munitions || 0) > 0) activeUpgrades.push({ symbol: '💣', count: s.munitions });
          if ((s.targeting || 0) > 0) activeUpgrades.push({ symbol: '🎯', count: s.targeting });
          if ((s.damagecontrol || 0) > 0) activeUpgrades.push({ symbol: '🔧', count: s.damagecontrol });
          if ((s.fuel_tanker || 0) > 0) activeUpgrades.push({ symbol: '⛽', count: s.fuel_tanker });
          if ((s.diplomat || 0) > 0) activeUpgrades.push({ symbol: '🤝', count: s.diplomat });
          if ((s.marines || 0) > 0) activeUpgrades.push({ symbol: '🪖', count: s.marines });
          if ((s.command || 0) > 0) activeUpgrades.push({ symbol: '👑', count: s.command });

          let upgradesHeight = 0;
          if (activeUpgrades.length > 0) {
            const iconSize = 4;
            const spacingX = 5;
            const yOffset = size + 4;
            upgradesHeight = 6;
            
            ctxTile.save();
            ctxTile.font = `${iconSize}px Orbitron`;
            ctxTile.textAlign = 'center';
            ctxTile.textBaseline = 'middle';
            
            const startX = s.x - ((activeUpgrades.length - 1) * spacingX) / 2;
            for (let j = 0; j < activeUpgrades.length; j++) {
              const item = activeUpgrades[j];
              const x = startX + j * spacingX;
              const y = s.y + yOffset;
              ctxTile.fillText(item.symbol, x, y);
              if (item.count > 1) {
                ctxTile.fillStyle = '#39ff14';
                ctxTile.font = 'bold 2px Orbitron';
                ctxTile.fillText(item.count.toString(), x + 2.5, y - 2.0);
                ctxTile.font = `${iconSize}px Orbitron`;
              }
            }
            ctxTile.restore();
          }

          if (s.name) {
            ctxTile.save();
            ctxTile.font = 'bold 5px Orbitron';
            ctxTile.fillStyle = ownerPlayer ? ownerPlayer.color : '#fff';
            ctxTile.textAlign = 'center';
            ctxTile.textBaseline = 'top';
            ctxTile.fillText(s.name, s.x, s.y + size + 3 + upgradesHeight);
            ctxTile.restore();
          }

          // Status bars
          if (s.maxHealth > 0) {
            const barW = size * 1.5;
            const barH = 2;
            let currentY = s.y - size - 4;
            
            const maxFuel = getMaxFuel(s);
            if (s.fuel !== undefined) {
              currentY -= barH;
              ctxTile.fillStyle = '#555';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctxTile.fillStyle = '#ffa500';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.fuel) / maxFuel), barH);
              currentY -= 1;
            }
            
            if (s.bombs !== undefined) {
              const maxBombs = getMaxBombs(s);
              currentY -= barH;
              ctxTile.fillStyle = '#3a3a3a';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctxTile.fillStyle = '#a0a0a0';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.bombs) / maxBombs), barH);
              currentY -= 1;
            }
            
            const shipExpBonus = Math.sqrt(s.expScore || 0);
            if (s.isCruiser && (s.expScore || 0) >= 1) {
              currentY -= barH;
              ctxTile.fillStyle = '#1a3344';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctxTile.fillStyle = '#00d5ff';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW * Math.min(1.0, shipExpBonus / 20), barH);
              currentY -= 1;
            }

            if (s.isCruiser && (s.commandPoints || 0) > 0) {
              currentY -= barH;
              ctxTile.fillStyle = '#3a0f0f';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctxTile.fillStyle = '#800000';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW * Math.min(1.0, s.commandPoints / 20), barH);
              currentY -= 1;
            }

            if (s.isCruiser && s.maxsupplies > 0) {
              currentY -= barH;
              ctxTile.fillStyle = '#3a1a4a';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctxTile.fillStyle = '#a855f7';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.supplies || 0) / s.maxsupplies), barH);
              currentY -= 1;
            }

            if (s.isCruiser && (s.diplomat || 0) > 0) {
              currentY -= barH;
              ctxTile.fillStyle = '#443d00';
              ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctxTile.fillStyle = '#ffff00';
              const maxParley = (s.diplomat || 0) * 3;
              const ratio = maxParley > 0 ? Math.min(1.0, Math.max(0, s.parley || 0) / maxParley) : 0;
              ctxTile.fillRect(s.x - barW / 2, currentY, barW * ratio, barH);
              currentY -= 1;
            }
            
            currentY -= barH;
            ctxTile.fillStyle = 'red';
            ctxTile.fillRect(s.x - barW / 2, currentY, barW, barH);
            ctxTile.fillStyle = '#0f0';
            ctxTile.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.health) / s.maxHealth), barH);
          }

          let modeText = '';
          let modeColor = '';
          if (s.isPatrolling) {
            modeText = '⚔️';
            modeColor = '#0ff';
          } else if (s.isScouting) {
            modeText = '🔭';
            modeColor = '#0ff';
          } else if (s.isResearching) {
            modeText = '🔬';
            modeColor = '#0f0';
          } else if (s.isDiplomacy) {
            modeText = '🤝';
            modeColor = '#ff00ff';
          }

          if (modeText) {
            ctxTile.save();
            ctxTile.font = 'bold 8px Orbitron';
            ctxTile.fillStyle = modeColor;
            ctxTile.textAlign = 'left';
            ctxTile.textBaseline = 'middle';
            ctxTile.shadowBlur = 6;
            ctxTile.shadowColor = modeColor;
            ctxTile.fillText(modeText, s.x + size * 1.6 + 2, s.y);
            ctxTile.restore();
          }

          let groupNum = null;
          for (let g = 0; g <= 9; g++) {
            if (controlGroups[g] && controlGroups[g].shipIds && controlGroups[g].shipIds.includes(s.id)) {
              groupNum = g;
              break;
            }
          }
          if (groupNum !== null) {
            ctxTile.save();
            ctxTile.font = 'bold 7px Orbitron';
            ctxTile.fillStyle = '#ffffff';
            ctxTile.textAlign = 'right';
            ctxTile.textBaseline = 'bottom';
            ctxTile.fillText(groupNum.toString(), s.x - size * 1.6 - 2, s.y);
            ctxTile.restore();
          }
          ctxTile.restore();
        }
      }
    }

    ctxTile.restore();
  };

  let lastSelectionIdsStr = "";

  const updateSelectionTiles = () => {
    const container = document.getElementById('selection-tiles-container');
    if (!container) return;

    if (selectedShips.length === 0 && selectedPlanets.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      lastSelectionIdsStr = "";
      return;
    }
    container.style.display = 'flex';

    const currentSelectionIdsStr = "P:" + selectedPlanets.map(p => p.id).sort().join(",") + 
                                  "|S:" + selectedShips.map(s => s.id).sort().join(",") +
                                  "|Shift:" + isShiftSelectingInHUD +
                                  "|Set:" + Array.from(hudSelectedSet).sort().join(",");
    
    if (currentSelectionIdsStr !== lastSelectionIdsStr) {
      let html = '';
      
      for (const p of selectedPlanets) {
        const livePlanet = serverState ? serverState.planets.find(sp => sp.id === p.id) : p;
        if (!livePlanet) continue;
        
        const key = `planet-${livePlanet.id}`;
        const activeClass = isShiftSelectingInHUD && hudSelectedSet.has(key) ? ' active-selected' : '';
        const opacityStyle = isShiftSelectingInHUD && !hudSelectedSet.has(key) ? ' style="opacity: 0.5;"' : '';
        
        html += `
          <div class="selection-tile${activeClass}" data-type="planet" data-id="${livePlanet.id}"${opacityStyle} title="${livePlanet.name}">
            <canvas class="selection-tile-canvas" width="120" height="120" style="width: 56px; height: 56px;"></canvas>
          </div>
        `;
      }

      for (const s of selectedShips) {
        const liveShip = serverState ? serverState.ships.find(ss => ss.id === s.id) : s;
        if (!liveShip || !liveShip.active) continue;
        
        let shipClass = "Fleet";
        if (liveShip.isCruiser) {
          if (liveShip.classType && SHIP_CLASSES[liveShip.classType]) {
            shipClass = SHIP_CLASSES[liveShip.classType].name;
          } else {
            const hpMax = liveShip.maxHealth || 1;
            if (hpMax <= 19) shipClass = "Corvette";
            else if (hpMax <= 24) shipClass = "Frigate";
            else if (hpMax <= 29) shipClass = "Destroyer";
            else if (hpMax <= 34) shipClass = "Cruiser";
            else if (hpMax <= 39) shipClass = "Battlecruiser";
            else if (hpMax <= 44) shipClass = "Battleship";
            else if (hpMax <= 49) shipClass = "Titan";
            else shipClass = "Mammoth";
          }
        }

        const key = `ship-${liveShip.id}`;
        const activeClass = isShiftSelectingInHUD && hudSelectedSet.has(key) ? ' active-selected' : '';
        const opacityStyle = isShiftSelectingInHUD && !hudSelectedSet.has(key) ? ' style="opacity: 0.5;"' : '';

        html += `
          <div class="selection-tile${activeClass}" data-type="ship" data-id="${liveShip.id}"${opacityStyle} title="${liveShip.name ? shipClass + ' ' + liveShip.name : shipClass}">
            <canvas class="selection-tile-canvas" width="120" height="120" style="width: 56px; height: 56px;"></canvas>
          </div>
        `;
      }

      container.innerHTML = html;
      lastSelectionIdsStr = currentSelectionIdsStr;

      const tiles = container.querySelectorAll('.selection-tile');
      for (const tile of tiles) {
        const type = tile.getAttribute('data-type');
        const id = parseInt(tile.getAttribute('data-id'), 10);

        if (type === 'ship') {
          const liveShip = serverState ? serverState.ships.find(ss => ss.id === id) : null;
          if (liveShip && liveShip.isCruiser && !liveShip.isAmoeba) {
            let pressTimer = null;
            const startPress = (e) => {
              if (e.button !== undefined && e.button !== 0) return;
              pressTimer = setTimeout(() => {
                triggerSaveConfig(id);
              }, 500);
            };
            const endPress = () => {
              if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
              }
            };

            tile.addEventListener('mousedown', startPress);
            tile.addEventListener('touchstart', startPress);
            tile.addEventListener('mouseup', endPress);
            tile.addEventListener('touchend', endPress);
            tile.addEventListener('mouseleave', endPress);
            tile.addEventListener('touchcancel', endPress);

            tile.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              triggerSaveConfig(id);
            });
          }
        }
        
        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = `${type}-${id}`;
          
          if (e.shiftKey) {
            if (!isShiftSelectingInHUD) {
              isShiftSelectingInHUD = true;
              hudSelectedSet.clear();
              hudSelectedSet.add(key);
            } else {
              if (hudSelectedSet.has(key)) {
                hudSelectedSet.delete(key);
              } else {
                hudSelectedSet.add(key);
              }
            }
            updateSelectionTiles();
          } else {
            isShiftSelectingInHUD = false;
            hudSelectedSet.clear();
            
            if (type === 'planet') {
              const planet = serverState ? serverState.planets.find(p => p.id === id) : null;
              if (planet) {
                selectedPlanets = [planet];
                selectedShips = [];
                const mapWidth = serverState.width || 1920;
                const mapHeight = serverState.height || 1620;
                cameraPanX = mapWidth / 2 - planet.x;
                cameraPanY = mapHeight / 2 - planet.y;
              }
            } else if (type === 'ship') {
              const ship = serverState ? serverState.ships.find(s => s.id === id) : null;
              if (ship) {
                selectedShips = [ship];
                selectedPlanets = [];
                const mapWidth = serverState.width || 1920;
                const mapHeight = serverState.height || 1620;
                cameraPanX = mapWidth / 2 - ship.x;
                cameraPanY = mapHeight / 2 - ship.y;
              }
            }
          }
        });
        
        tile.addEventListener('mouseenter', (e) => {
          isHoveringSelectionTile = true;
          selectionTileMouseX = e.clientX;
          selectionTileMouseY = e.clientY;
          if (infoPanelTimer) {
            clearTimeout(infoPanelTimer);
            infoPanelTimer = null;
          }
          openInfoPanel(type, id);
        });
        
        tile.addEventListener('mousemove', (e) => {
          isHoveringSelectionTile = true;
          selectionTileMouseX = e.clientX;
          selectionTileMouseY = e.clientY;
          updateInfoPanelContent();
        });
        
        tile.addEventListener('mouseleave', () => {
          isHoveringSelectionTile = false;
          checkInfoPanelDismiss();
        });
      }
    }

    const tiles = container.querySelectorAll('.selection-tile');
    for (const tile of tiles) {
      const type = tile.getAttribute('data-type');
      const id = parseInt(tile.getAttribute('data-id'), 10);
      const canvasEl = tile.querySelector('.selection-tile-canvas');
      if (!canvasEl) continue;

      const ctxTile = canvasEl.getContext('2d');
      if (type === 'planet') {
        const livePlanet = serverState ? serverState.planets.find(sp => sp.id === id) : null;
        if (!livePlanet) continue;
        drawUnitOnTileCanvas(ctxTile, canvasEl.width, canvasEl.height, livePlanet, 'planet');
      } else if (type === 'ship') {
        const liveShip = serverState ? serverState.ships.find(ss => ss.id === id) : null;
        if (!liveShip || !liveShip.active) continue;
        drawUnitOnTileCanvas(ctxTile, canvasEl.width, canvasEl.height, liveShip, 'ship');
      }

      let isMapHovered = false;
      if (type === 'planet') {
        if (hoveredPlanet && hoveredPlanet.id === id) {
          isMapHovered = true;
        }
      } else if (type === 'ship' || type === 'fleet') {
        if (hoveredShip && hoveredShip.id === id) {
          isMapHovered = true;
        }
      }

      if (isMapHovered) {
        tile.classList.add('map-hovered');
      } else {
        tile.classList.remove('map-hovered');
      }
    }
  };

  let activeInfoPanel = null;
  let infoPanelTimer = null;
  let mouseMovedSinceOpen = false;
  let lastMouseTarget = null;
  let panelOpenedThisTick = false;
  let lastCanvasMouseX = undefined;
  let lastCanvasMouseY = undefined;

  const infoPanelModal = document.getElementById('info-panel-modal');
  const infoPanelContainer = document.querySelector('.info-panel-container');
  const infoPanelTitle = document.getElementById('info-panel-title');
  const infoPanelBody = document.getElementById('info-panel-body');
  const infoPanelCloseBtn = document.querySelector('.info-panel-close-btn');
  const infoPanelBackdrop = document.querySelector('.info-panel-backdrop');
  const infoPanelImagePlaceholder = document.querySelector('.info-panel-image-placeholder');
  const infoPanelImageHologram = document.querySelector('.info-panel-image-hologram');

  function isMouseOverActiveEntity() {
    if (isHoveringSelectionTile) return true;
    if (!activeInfoPanel) return false;
    if (lastCanvasMouseX === undefined || lastCanvasMouseY === undefined) return false;

    // If the mouse is over the info panel container, it is not hovering over the active unit/planet
    const container = document.querySelector('.info-panel-container');
    if (container && lastMouseTarget && container.contains(lastMouseTarget)) {
      return false;
    }
    
    if (activeInfoPanel.type === 'anomaly') {
      const p = serverState.planets.find(pp => pp.id === activeInfoPanel.id);
      if (p && p.anomaly && !p.anomaly.researched) {
        const serverPos = getMouseServerPos(lastCanvasMouseX, lastCanvasMouseY);
        const adx = p.anomaly.x - serverPos.x;
        const ady = p.anomaly.y - serverPos.y;
        const adist = Math.sqrt(adx * adx + ady * ady);
        return adist <= 15;
      }
      return false;
    } else if (activeInfoPanel.type === 'planet') {
      const p = getPlanetAt(lastCanvasMouseX, lastCanvasMouseY);
      return p && p.id === activeInfoPanel.id;
    } else if (activeInfoPanel.type === 'ship' || activeInfoPanel.type === 'fleet') {
      const serverPos = getMouseServerPos(lastCanvasMouseX, lastCanvasMouseY);
      if (serverState && serverState.ships) {
        for (const ship of serverState.ships) {
          if (ship.id === activeInfoPanel.id && ship.active) {
            const maxSpread = Math.min(60, 10 + Math.sqrt(ship.count || 1) * 2.5);
            const hoverRadius = ship.count > 1 ? maxSpread + 5 : 15;
            const sdx = ship.x - serverPos.x;
            const sdy = ship.y - serverPos.y;
            if (sdx * sdx + sdy * sdy < hoverRadius * hoverRadius) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  function checkInfoPanelDismiss() {
    if (!activeInfoPanel) return;
    if (!mouseMovedSinceOpen) return; // hold the tooltip if the mouse hasn't physically moved since open
    if (infoPanelTimer) return;
    
    infoPanelTimer = setTimeout(() => {
      infoPanelTimer = null;
      if (!isMouseOverActiveEntity()) {
        closeInfoPanel();
      }
    }, 250);
  }

  function getAnomalyColor(diff) {
    if (diff <= 0) return '#00ff88';
    if (diff <= 12) return '#ffcc00';
    if (diff <= 24) return '#00e5ff';
    if (diff <= 48) return '#ff6d00';
    return '#ff00ff';
  }

  function getDeterministicProgressAccuracy(anomalyId) {
    let hash = 0;
    if (!anomalyId) return 50;
    for (let i = 0; i < anomalyId.length; i++) {
      hash = anomalyId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 100);
  }

  function openInfoPanel(type, id) {
    activeInfoPanel = { type, id };
    if (infoPanelModal) {
      infoPanelModal.classList.remove('hidden');
    }
    panelOpenedThisTick = true;
    setTimeout(() => { panelOpenedThisTick = false; }, 0);
    mouseMovedSinceOpen = false; // reset flag on open
    updateInfoPanelContent();
  }
  window.openInfoPanel = openInfoPanel;
  window.getServerState = () => serverState;
  window.getLocalPlayer = () => localPlayer;
  window.getCameraPan = () => ({ x: cameraPanX, y: cameraPanY });
  window.setCameraPan = (x, y) => { cameraPanX = x; cameraPanY = y; };

  function closeInfoPanel() {
    activeInfoPanel = null;
    if (infoPanelTimer) {
      clearTimeout(infoPanelTimer);
      infoPanelTimer = null;
    }
    if (infoPanelModal) {
      infoPanelModal.classList.add('hidden');
    }
  }

  if (infoPanelCloseBtn) {
    infoPanelCloseBtn.addEventListener('click', closeInfoPanel);
  }
  if (infoPanelBackdrop) {
    infoPanelBackdrop.addEventListener('click', closeInfoPanel);
  }

  function updateInfoPanelContent() {
    if (!activeInfoPanel || !serverState || !infoPanelTitle || !infoPanelBody) {
      if (infoPanelModal && !infoPanelModal.classList.contains('hidden')) {
        closeInfoPanel();
      }
      return;
    }

    const myPlayer = (serverState && serverState.players && localPlayer) ? (serverState.players.find(p => p.id === localPlayer.id) || localPlayer) : localPlayer;
    const { type, id } = activeInfoPanel;

    if (infoPanelImagePlaceholder && infoPanelImageHologram) {
      if (type === 'fleet') {
        const hs = serverState.ships.find(ss => ss.id === id);
        const hsOwner = hs && hs.ownerId ? serverState.players.find(pl => pl.id === hs.ownerId) : null;
        const isMonster = hsOwner && (hsOwner.id === 'monsters' || hsOwner.id === 'monster');

        if (isMonster) {
          infoPanelImagePlaceholder.style.backgroundImage = "url('/Art/amoeba.jpg')";
          infoPanelImagePlaceholder.style.backgroundSize = "cover";
        } else {
          infoPanelImagePlaceholder.style.backgroundImage = "url('/Art/transports.jpg')";
          infoPanelImagePlaceholder.style.backgroundSize = "contain";
        }
        infoPanelImagePlaceholder.style.backgroundRepeat = "no-repeat";
        infoPanelImagePlaceholder.style.backgroundPosition = "center center";
        infoPanelImageHologram.style.display = "none";
      } else if (type === 'planet') {
        let p = serverState.planets.find(pp => pp.id === id);
        const isLastKnown = p && p.inFog && (p.permanentlyTracked || !!lastKnownPlanets[p.id]);
        if (isLastKnown && !p.permanentlyTracked && lastKnownPlanets[p.id]) {
          p = lastKnownPlanets[p.id];
        }
        if (p && (!p.inFog || isLastKnown)) {
          const habName = getHabName(p.habitability).toLowerCase();
          infoPanelImagePlaceholder.style.backgroundImage = `url('/Art/${habName}.jpg')`;
          infoPanelImagePlaceholder.style.backgroundSize = "cover";
          infoPanelImagePlaceholder.style.backgroundRepeat = "no-repeat";
          infoPanelImagePlaceholder.style.backgroundPosition = "center center";
          infoPanelImageHologram.style.display = "none";
        } else {
          infoPanelImagePlaceholder.style.backgroundImage = "";
          infoPanelImagePlaceholder.style.backgroundRepeat = "";
          infoPanelImageHologram.style.display = "flex";
        }
      } else if (type === 'ship') {
        const hs = serverState.ships.find(ss => ss.id === id);
        const hsOwner = hs && hs.ownerId ? serverState.players.find(pl => pl.id === hs.ownerId) : null;
        const raceStyle = hs ? (hs.cruiserStyle || (hsOwner ? hsOwner.cruiserStyle : null)) : null;
        const isMonster = hsOwner && (hsOwner.id === 'monsters' || hsOwner.id === 'monster');

        const raceImages = {
          'Federation': 'federation.jpg',
          'Romulan': 'romulan.jpg',
          'Gorn': 'gorn.jpg',
          'Klingon': 'Klingon.png',
          'Tholian': 'tholian.png',
          'Lyran': 'lyran.png'
        };

        if ((hs && hs.isAmoeba) || isMonster) {
          infoPanelImagePlaceholder.style.backgroundImage = "url('/Art/amoeba.jpg')";
          infoPanelImagePlaceholder.style.backgroundSize = "cover";
          infoPanelImagePlaceholder.style.backgroundRepeat = "no-repeat";
          infoPanelImagePlaceholder.style.backgroundPosition = "center center";
          infoPanelImageHologram.style.display = "none";
        } else if (raceStyle && raceImages[raceStyle]) {
          const imgName = raceImages[raceStyle];
          infoPanelImagePlaceholder.style.backgroundImage = `url('/Art/${imgName}')`;
          infoPanelImagePlaceholder.style.backgroundSize = "cover";
          infoPanelImagePlaceholder.style.backgroundRepeat = "no-repeat";
          infoPanelImagePlaceholder.style.backgroundPosition = "center center";
          infoPanelImageHologram.style.display = "none";
        } else {
          infoPanelImagePlaceholder.style.backgroundImage = "";
          infoPanelImagePlaceholder.style.backgroundRepeat = "";
          infoPanelImageHologram.style.display = "flex";
        }
      } else if (type === 'anomaly') {
        infoPanelImagePlaceholder.style.backgroundImage = "url('/Art/anomaly.jpg')";
        infoPanelImagePlaceholder.style.backgroundSize = "cover";
        infoPanelImagePlaceholder.style.backgroundRepeat = "no-repeat";
        infoPanelImagePlaceholder.style.backgroundPosition = "center center";
        infoPanelImageHologram.style.display = "none";
      } else {
        infoPanelImagePlaceholder.style.backgroundImage = "";
        infoPanelImagePlaceholder.style.backgroundRepeat = "";
        infoPanelImageHologram.style.display = "flex";
      }
    }

    let titleHTML = '';
    let bodyHTML = '';

    const blueprintText = document.querySelector('.info-panel-blueprint-text');
    if (blueprintText) {
      if (type === 'anomaly') {
        blueprintText.textContent = 'ANOMALY DETECTED';
      } else {
        blueprintText.textContent = 'SYSTEM BLUEPRINT';
      }
    }

    if (type === 'anomaly') {
      let p = serverState.planets.find(pp => pp.id === id);
      if (!p || !p.anomaly || p.anomaly.researched) {
        closeInfoPanel();
        return;
      }
      
      const anomalyColor = getAnomalyColor(p.anomaly.difficulty);
      titleHTML = p.isDeepSpaceAnomaly ? `<span style="color: ${anomalyColor}">DEEP SPACE ANOMALY</span>` : `<span style="color: ${anomalyColor}">PLANETARY ANOMALY</span>`;
      
      const lines = [];
      if (p.isDeepSpaceAnomaly) {
        lines.push({ label: 'Location', value: 'Deep Space', color: '#888' });
      } else {
        lines.push({ label: 'Location', value: p.name, color: '#fff' });
      }
      lines.push({ label: 'Research Progress', value: `${p.anomaly.progress || 0} / ${p.anomaly.difficulty}`, color: '#ffb74d' });
      lines.push({ label: 'Difficulty', value: `${p.anomaly.difficulty}`, color: anomalyColor });
      
      // Calculate likely reward
      const selectedCruiser = getSelectedCruiser();
      const localShipXpBonus = selectedCruiser ? (Math.sqrt(selectedCruiser.expScore || 0) + (selectedCruiser.commandPoints || 0)) : 0;
      const accuracyChance = Math.min(100, Math.max(0, Math.round(50 + localShipXpBonus * 3)));
      
      // Deterministic roll based on anomaly ID
      const hashVal = getDeterministicProgressAccuracy(p.anomaly.id);
      const isAccurate = hashVal < accuracyChance;
      
      const rewardOptions = ['discount', 'credits', 'tech', 'xp', 'hab', 'rare_resource_cache', 'upgrade_token'];
      const trueType = p.anomaly.rewardType || 'credits';
      let displayedType = trueType;
      
      if (!isAccurate) {
        const trueIndex = rewardOptions.indexOf(trueType);
        const incorrectIndex = (trueIndex + 1 + (hashVal % (rewardOptions.length - 1))) % rewardOptions.length;
        displayedType = rewardOptions[incorrectIndex];
      }
      
      const rewardLabels = {
        discount: 'Upgrade Discount',
        credits: 'Credits Reward',
        tech: 'Tech Score Reward',
        xp: 'Player XP Reward',
        hab: 'Habitability Increase',
        rare_resource_cache: 'Rare Resource Cache',
        upgrade_token: 'Upgrade Tokens'
      };
      
      const displayLabel = rewardLabels[displayedType] || 'Unknown';
      lines.push({ label: 'Likely Reward', value: displayLabel, color: '#00e5ff' });
      lines.push({ label: 'Scanner Accuracy', value: `${accuracyChance}%`, color: '#888' });

      for (const line of lines) {
        const displayLabel = formatTooltipString(line.label);
        const displayValue = formatTooltipString(line.value);
        bodyHTML += `<div class="info-panel-row" style="color: ${line.color || '#fff'}">
          <div class="info-panel-label">${displayLabel}</div>
          <div class="info-panel-value">${displayValue}</div>
        </div>`;
      }
    } else if (type === 'planet') {
      let p = serverState.planets.find(pp => pp.id === id);
      const isLastKnown = p && p.inFog && (p.permanentlyTracked || !!lastKnownPlanets[p.id]);
      if (isLastKnown && !p.permanentlyTracked && lastKnownPlanets[p.id]) {
        p = lastKnownPlanets[p.id];
      }
      if (!p || (p.inFog && !isLastKnown)) {
        closeInfoPanel();
        return;
      }
      const owner = p.ownerId ? serverState.players.find(pl => pl.id === p.ownerId) : null;
      const ownerColor = owner ? owner.color : '#888';

      const sizeClassText = p.sizeClass < 70 ? 'Tiny' : p.sizeClass < 90 ? 'Small' : p.sizeClass < 110 ? 'Standard' : p.sizeClass < 140 ? 'Large' : p.sizeClass < 180 ? 'Huge' : 'Super Planet';
      const habName = getHabName(p.habitability);
      const raceName = p.racialAffinity || '';
      const focusName = p.focusMode ? p.focusMode.charAt(0).toUpperCase() + p.focusMode.slice(1) : 'Economy';

      let prefBonusStr = '';
      if (p.preferredResource) {
        let bonusVal = 0;
        if (owner && owner.resources) {
          const qty = owner.resources[p.preferredResource] || 0;
          if (qty > 0) {
            let mult = 1;
            if (p.maxShips >= 150) mult = 4;
            else if (p.maxShips >= 120) mult = 3;
            else if (p.maxShips >= 100) mult = 2;
            bonusVal = Math.round(Math.sqrt(qty) * mult);
          }
        }
        if (bonusVal > 0) {
          prefBonusStr = ` (+${bonusVal}%)`;
        }
      }

      const racePart = raceName ? `${raceName} ` : '';
      titleHTML = `<span style="color: ${ownerColor}">${p.name} - ${racePart}${sizeClassText} ${habName} ${focusName} World${isLastKnown ? ' <span style="font-size:0.75rem;color:#aaa;">(Last Known)</span>' : ''}</span>`;

      const lines = [];

      const resourceEmojis = {
        dilithium: '💎',
        merculite: '☄️',
        duranium: '🔲',
        tritanium: '🔩',
        antimatter: '🌀',
        deuterium: '💧',
        latinum: '🏺'
      };

      const hpOwner = owner || { techScore: 0, expScore: 0, id: 'neutral' };
      const techBonusVal = hpOwner ? Math.sqrt(hpOwner.techScore || 0) : 0;
      const softCap = Math.round(p.sizeClass * ((p.habitability + techBonusVal) / 100));
      lines.push({ label: `Improvement Rate: ${p.habitability}`, value: `Potential: ${softCap}`, color: '#ffb74d' });

      const producedIcons = p.resources ? p.resources.map(r => resourceEmojis[r] || '').filter(Boolean).join(' ') : '';
      const wantedResourceName = p.preferredResource ? p.preferredResource.charAt(0).toUpperCase() + p.preferredResource.slice(1) : 'Nothing';
      const wantedStr = p.preferredResource ? `${resourceEmojis[p.preferredResource] || ''} ${wantedResourceName}${prefBonusStr}` : 'Nothing';

      lines.push({ label: `Produces: ${producedIcons}`, value: `Wants: ${wantedStr}`, color: '#fff' });

      const isNeutralOrEnemy = !p.ownerId || p.ownerId !== myPlayer.id;
      if (isNeutralOrEnemy) {
        const currentSym = getEffectiveSympathyClient(p, myPlayer.id);
        const expBonus = Math.sqrt(myPlayer.expScore || 0);
        const selectedCruiser = getSelectedCruiser();
        const shipExpBonus = selectedCruiser ? (Math.sqrt(selectedCruiser.expScore || 0) + (selectedCruiser.commandPoints || 0)) : 0;
        const bonusSum = expBonus + shipExpBonus;
        const disposition = p.disposition?.[myPlayer.id] ?? 0;
        
        let racialBonus = 0;
        if (selectedCruiser) {
          const shipOwner = serverState.players.find(pl => pl.id === selectedCruiser.ownerId);
          if (selectedCruiser.cruiserStyle === p.racialAffinity || (shipOwner && shipOwner.cruiserStyle === p.racialAffinity)) {
            racialBonus = 20;
          }
        }

        const chanceBase = 30 + disposition + currentSym + bonusSum + racialBonus;
        const chancePref = 30 + disposition + currentSym + (bonusSum * 3) + 10 + racialBonus;
        
        const basePercent = Math.max(0, Math.round(chanceBase));
        const prefPercent = Math.max(0, Math.round(chancePref));
        
        if (p.preferredResource) {
          const prefEmoji = resourceEmojis[p.preferredResource] || '💎';
          lines.push({ 
            label: '🤝 Diplomacy Chance', 
            value: `${basePercent}%, w/ ${prefEmoji}: ${prefPercent}%`, 
            color: '#4caf50' 
          });
        } else {
          lines.push({ 
            label: '🤝 Diplomacy Chance', 
            value: `${basePercent}%`, 
            color: '#4caf50' 
          });
        }
      }

      const assocPlayers = new Set();
      if (p.sympathy) {
        for (const pId of Object.keys(p.sympathy)) {
          assocPlayers.add(pId);
        }
      }
      if (p.disposition) {
        for (const pId of Object.keys(p.disposition)) {
          assocPlayers.add(pId);
        }
      }
      if (!p.ownerId && serverState && serverState.players) {
        for (const pl of serverState.players) {
          if (pl.id !== 'monsters') {
            const symVal = getEffectiveSympathyClient(p, pl.id);
            if (symVal > 0) {
              assocPlayers.add(pl.id);
            }
          }
        }
      }
      for (const pId of assocPlayers) {
        const targetPlayer = serverState.players.find(pl => pl.id === pId);
        const pName = targetPlayer ? targetPlayer.name : pId;
        const pColor = targetPlayer ? targetPlayer.color : '#e040fb';
        const dispVal = p.disposition?.[pId];
        const symVal = getEffectiveSympathyClient(p, pId);
        if (dispVal !== undefined || symVal !== 0) {
          let dispStr = 'Unknown';
          if (dispVal !== undefined) {
            const dVal = Math.round(dispVal);
            let emoji = '';
            if (dVal < -35) emoji = '😠';
            else if (dVal < -15) emoji = '😢';
            else if (dVal < 1) emoji = '😐';
            else if (dVal < 20) emoji = '🙂';
            else if (dVal < 40) emoji = '😀';
            else emoji = '😍';

            let scoreColor = '#ff3333';
            if (dVal > 0) {
              scoreColor = '#4caf50';
            } else if (dVal > -25) {
              scoreColor = '#ffeb3b';
            }
            dispStr = `<span style="color: ${scoreColor}; font-weight: bold;">${dVal}</span> ${emoji}`;
          }
          const baseSym = p.sympathy?.[pId] || 0;
          lines.push({
            label: `🎭 Disp (${pName}): ${dispStr}`,
            value: `💖 Sym: ${Math.round(baseSym)}/${Math.round(symVal)}`,
            color: pColor
          });
        }
      }

      // Show Trade Income below the disposition rows
      const planetTradeRatePerMin = getPlanetTradeIncomePerMin(p);
      if (planetTradeRatePerMin > 0) {
        const effShips = planetTradeRatePerMin * 25;
        const effShipsStr = Number(effShips.toFixed(1)).toString();
        lines.push({
          label: `💰 Trading Ships Active: ${effShipsStr}`,
          value: `+${planetTradeRatePerMin.toFixed(2)}/m`,
          color: '#ffd54f'
        });
      }


      if (owner) {
        let capacityMultiplier = 1.0;
        if (p.isMilitary) capacityMultiplier = 0.8;
        if (p.focusMode === 'garrison') capacityMultiplier = 2.0;

        const maxPop = Math.round(p.maxShips * capacityMultiplier);

        lines.push({ label: 'Garrison', value: `${Math.floor(p.ships)} / ${maxPop}`, color: '#fff' });
      } else {
        lines.push({ label: 'Garrison', value: `${Math.floor(p.ships)} / ${Math.round(p.maxShips)}`, color: '#fff' });
      }

      let totalDefense = 0;
      const defenseLines = [];

      // Gravity Well Support calculation helper
      const getGravityRadiusClient = (pl) => {
        let baseRadius = pl.maxShips * 1.5;
        if (pl.isMilitary && pl.ships >= pl.maxShips) {
          baseRadius *= 1.5;
        }
        const plOwner = pl.ownerId ? serverState.players.find(o => o.id === pl.ownerId) : null;
        const isHuman = plOwner && !plOwner.isAI;
        if (isHuman && pl.focusMode === 'garrison' && pl.ships >= pl.maxShips) {
          baseRadius += (pl.ships / 2);
        }
        const tb = 0.01 * Math.sqrt(plOwner ? (plOwner.techScore || 0) : 0);
        const eb = 0.01 * Math.sqrt(plOwner ? (plOwner.expScore || 0) : 0);
        let r = baseRadius * (1 + tb + eb);
        if (!plOwner) {
          r *= 0.5;
        }
        return r;
      };

      let gravityWellBonusTotal = 0;
      if (p.ownerId) {
        for (const planet of serverState.planets) {
          if (planet.id !== p.id && planet.ownerId === p.ownerId) {
            const pdx = planet.x - p.x;
            const pdy = planet.y - p.y;
            const pDistSq = pdx * pdx + pdy * pdy;
            const gr = getGravityRadiusClient(planet);
            if (pDistSq < gr * gr) {
              let mult = 0.002;
              if (planet.isMilitary || planet.focusMode === 'garrison') {
                if (planet.ships >= planet.maxShips * 2 - 10) {
                  mult = 0.0045;
                } else if (planet.ships >= planet.maxShips) {
                  mult = 0.003;
                }
              }
              const contribution = mult * Math.floor(planet.ships / 10) * 100;
              gravityWellBonusTotal += contribution;
            }
          }
        }
      }
      
      if (gravityWellBonusTotal > 0) {
        totalDefense += gravityWellBonusTotal;
        defenseLines.push({ label: 'Gravity Well Support', value: `${Math.round(gravityWellBonusTotal)}%`, color: '#00e676' });
      }

      // Garrison defense bonus
      const garrisonBonus = Math.floor(p.ships / 5);
      if (garrisonBonus > 0) {
        totalDefense += garrisonBonus;
        defenseLines.push({ label: 'Garrison Shielding', value: `${garrisonBonus}%`, color: '#4caf50' });
      }

      // Tech defense bonus
      const techBonus = Math.round(Math.sqrt(hpOwner.techScore || 0));
      if (techBonus > 0) {
        totalDefense += techBonus;
      }

      // Owner Experience defense bonus
      const expBonus = Math.round(Math.sqrt(hpOwner.expScore || 0));
      if (expBonus > 0) {
        totalDefense += expBonus;
      }

      // Planet Local Experience defense bonus
      const planetExpBonus = Math.round(Math.sqrt(p.expScore || 0));
      if (planetExpBonus > 0) {
        totalDefense += planetExpBonus;
        defenseLines.push({ label: 'Planet Exp Defense', value: `${planetExpBonus}%`, color: '#ffea00' });
      }

      if (p.isMilitary) {
        totalDefense += 15;
        defenseLines.push({ label: 'Military Base', value: `15%`, color: '#ff5722' });
      }
      
      const envLabel = p.preferredResource === 'deuterium' ? 'Frozen' : p.preferredResource === 'antimatter' ? 'Volcanic' : p.preferredResource === 'latinum' ? 'Oceanic' : 'Desert';
      const hasEnvDefense = (p.preferredResource === 'deuterium' || p.preferredResource === 'antimatter' || p.preferredResource === 'latinum');
      if (p.ownerId) {
        if (hasEnvDefense) {
          totalDefense += 15;
          defenseLines.push({ label: envLabel, value: `15%`, color: '#e040fb' });
        }
        if (hpOwner.id === p.homeworldOf) {
          totalDefense += 15;
          defenseLines.push({ label: 'Homeworld', value: `15%`, color: '#ff0' });
        }
        if (hpOwner.planetCount === 1) {
          totalDefense += 15;
          defenseLines.push({ label: 'Last stand', value: `15%`, color: '#ff0' });
        }
        if (myPlayer && !myPlayer.isAI && !hpOwner.isAI) {
          const aiOwners = new Set();
          for (const plPlanet of serverState.planets) {
            if (plPlanet.ownerId) {
              const plOwner = serverState.players.find(pl => pl.id === plPlanet.ownerId);
              if (plOwner && plOwner.isAI) aiOwners.add(plPlanet.ownerId);
            }
          }
          const hvhBonus = aiOwners.size * 2;
          if (hvhBonus > 0) {
            totalDefense += hvhBonus;
            defenseLines.push({ label: 'PvP Defense', value: `${hvhBonus}%`, color: '#ff0' });
          }
        }
      } else {
        if (hasEnvDefense) {
          totalDefense += 15;
          defenseLines.push({ label: envLabel, value: `15%`, color: '#e040fb' });
        } else {
          defenseLines.push({ label: 'Neutral', value: 'No defense bonuses', color: '#888' });
        }
      }

      if (serverState.storms) {
        const defenseOwner = owner || { techScore: 0, expScore: 0, id: 'neutral' };
        for (const storm of serverState.storms) {
          if (storm.type === 'minefield') continue;
          const sdx = p.x - storm.x;
          const sdy = p.y - storm.y;
          if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
            const knowledge = (storm.knowledge && typeof storm.knowledge === 'object') ? (storm.knowledge[defenseOwner.id] || 0) : (storm.knowledge || 0);
            const tRed = Math.sqrt(defenseOwner.techScore || 0);
            const eRed = Math.sqrt(defenseOwner.expScore || 0);
            const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2);
            if (eff > 0) {
              totalDefense += eff;
              const label = storm.type === 'nebula' ? 'Nebula Shielding' : 'Ion Interference';
              defenseLines.push({ label: label, value: `${Math.round(eff)}%`, color: storm.type === 'nebula' ? '#ff4444' : '#ffff44' });
            }
          }
        }
      }
      lines.push({ label: 'Total Defense Modifier', value: totalDefense > 0 ? `🛡️ ${Math.round(totalDefense)}%` : '0%', color: '#fff', isHeader: true });
      lines.push(...defenseLines);

      if (owner) {
        lines.push({ label: 'Owner Tech 🧪', value: `+${Math.round(Math.sqrt(owner.techScore))} (${owner.techScore})`, color: '#00e5ff' });
        lines.push({ label: 'Owner Exp 🎯', value: `+${Math.round(Math.sqrt(owner.expScore))} (${owner.expScore})`, color: '#ffeb3b' });
      }





      if (serverState.storms) {
        for (const storm of serverState.storms) {
          if (storm.type === 'minefield') continue;
          const dx = p.x - storm.x, dy = p.y - storm.y;
          if (dx * dx + dy * dy <= storm.radius * storm.radius) {
            const typeLabel = storm.type === 'nebula' ? 'Nebula' : 'Ion Storm';
            const typeColor = storm.type === 'nebula' ? '#f66' : '#ff0';
            lines.push({ label: `⚠️ ${typeLabel}`, value: `Int: ${storm.intensity}`, color: typeColor });
          }
        }
      }

      for (const line of lines) {
        const displayLabel = formatTooltipString(line.label);
        const displayValue = formatTooltipString(line.value);
        if (line.isHeader) {
          bodyHTML += `<div class="info-panel-row header-row" style="color: ${line.color}">
            <div class="info-panel-label">${displayLabel}</div>
            <div class="info-panel-value">${displayValue || ''}</div>
          </div>`;
        } else {
          bodyHTML += `<div class="info-panel-row" style="color: ${line.color || '#fff'}">
            <div class="info-panel-label">${displayLabel}</div>
            <div class="info-panel-value">${displayValue}</div>
          </div>`;
        }
      }
    } else if (type === 'ship' || type === 'fleet') {
      const hs = serverState.ships.find(ss => ss.id === id);
      if (!hs || !hs.active) {
        closeInfoPanel();
        return;
      }
      const hsOwner = hs.ownerId ? serverState.players.find(pl => pl.id === hs.ownerId) : null;
      const lines = [];

      if (hs.isAmoeba) {
        titleHTML = `<span style="color: #0f0">Giant Space Amoeba</span>`;

        const currentTotalHealth = Math.floor(hs.health) + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
        const maxTotalHealth = hs.maxHealth + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
        lines.push({ label: 'Health', value: currentTotalHealth + ' / ' + maxTotalHealth, color: '#fff' });
        lines.push({ label: 'Sacs', value: (hs.bombs || 0).toFixed(1) + ' / ' + hs.maxHealth, color: '#ff0' });
        if (hs.isHungry) {
          lines.push({ label: 'Status', value: 'Hungry (will grow)', color: '#f66' });
        } else {
          lines.push({ label: 'Status', value: 'Digesting', color: '#4f4' });
        }
        
        const techBonus = hsOwner ? Math.floor(Math.sqrt(hsOwner.techScore || 0)) : 0;
        const laserTechBonus = 0.01 * techBonus;
        const expBonus = hsOwner ? Math.sqrt(hsOwner.expScore || 0) : 0;
        const shipExpBonusForRange = Math.sqrt(hs.expScore || 0) + (hs.commandPoints || 0);
        const xpRangeBonus = (expBonus + shipExpBonusForRange) * 0.10;
        const displayedMaxHealth = hs.maxHealth + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
        let effectiveRange = 20 + displayedMaxHealth;
        if (hs.bombs > 0) {
          effectiveRange += 10;
        }
        const finalAmoebaRange = Math.floor(effectiveRange);
        lines.push({ label: 'Attack Range', value: finalAmoebaRange + 'px', color: '#f88' });

        const shipExpBonusOriginal = Math.sqrt(hs.expScore || 0);
        const bombBonus = (hs.bombs && hs.bombs > 0) ? (hs.bombs * 3) : 0;
        const amoebaHitChance = Math.round(Math.min(100, 10 + techBonus + expBonus + shipExpBonusOriginal + hs.maxHealth * 5 + bombBonus)) + '%';
        lines.push({ label: 'Accuracy', value: amoebaHitChance, color: '#f88' });
        const shrugChance = Math.min(95, Math.floor(50 + hs.maxHealth * 1 + (techBonus + expBonus + shipExpBonusOriginal) * 1));
        lines.push({ label: 'Deflection', value: shrugChance + '%', color: '#ccc' });
      } else if (hs.isCruiser) {
        let shipClass = "Mammoth";
        if (hs.classType && SHIP_CLASSES[hs.classType]) {
          shipClass = SHIP_CLASSES[hs.classType].name;
        } else {
          if (hs.maxHealth <= 19) shipClass = "Corvette";
          else if (hs.maxHealth <= 24) shipClass = "Frigate";
          else if (hs.maxHealth <= 29) shipClass = "Destroyer";
          else if (hs.maxHealth <= 34) shipClass = "Cruiser";
          else if (hs.maxHealth <= 39) shipClass = "Battlecruiser";
          else if (hs.maxHealth <= 44) shipClass = "Battleship";
          else if (hs.maxHealth <= 49) shipClass = "Titan";
        }

        const raceStyle = hs.cruiserStyle || (hsOwner ? hsOwner.cruiserStyle : null);
        let raceStr = '';
        if (raceStyle) {
          const raceIcons = {
            'Federation': '🖖',
            'Romulan': '🦅',
            'Klingon': '⚔️',
            'Gorn': '🦎',
            'Tholian': '🕸️',
            'Lyran': '🐶'
          };
          const icon = raceIcons[raceStyle] || '';
          raceStr = (icon ? icon + ' ' : '') + raceStyle;
        }

        titleHTML = `<span style="color: ${hsOwner ? hsOwner.color : '#0ff'}">${(hsOwner ? hsOwner.name : 'Unknown')}'s ${raceStr ? raceStr + ' ' : ''}${hs.name ? shipClass + ' ' + hs.name : shipClass}</span>`;
        lines.push({ label: 'Hull Integrity', value: `${Math.floor(hs.health)} / ${hs.maxHealth}`, color: '#fff' });
        if (hs.isCruiser) {
          const totalUpgrades = (hs.sensorarrays || 0) +
                                (hs.labs || 0) +
                                (hs.armor || 0) +
                                (hs.shields || 0) +
                                (hs.engine || 0) +
                                (hs.munitions || 0) +
                                (hs.targeting || 0) +
                                (hs.damagecontrol || 0) +
                                (hs.fuel_tanker || 0) +
                                (hs.diplomat || 0) +
                                (hs.marines || 0) +
                                (hs.command || 0);
          const maxTotalUpgrades = Math.floor((hs.maxHealth || 0) / 5);
          const upgradesRemaining = maxTotalUpgrades - totalUpgrades;
          if (upgradesRemaining > 0) {
            lines.push({ label: 'Upgrades Remaining', value: `${upgradesRemaining}`, color: '#00e5ff' });
          }
          if (hs.upgradeTokens > 0) {
            lines.push({ label: 'Upgrade Tokens', value: `${hs.upgradeTokens}`, color: '#ffd740' });
          }
        }

        let fuelLabel = hs.engine > 0 ? `Fuel (${hs.engine})` : 'Fuel';
        if (hs.specialfuel && hs.specialfuel > 0) {
          fuelLabel += '*';
        }
        const fuelVal = Math.floor(hs.fuel || 0) + '/' + Math.floor(getMaxFuel(hs));
        const speedVal = (hs.currentSpeed || 0).toFixed(1) + '/' + (hs.speed || 30).toFixed(1);
        lines.push({ label: `⚡ Speed`, value: `${speedVal}`, color: '#ffa500' });
        lines.push({ label: `⛽ ${fuelLabel}`, value: `${fuelVal}`, color: (hs.fuel <= 0 ? '#f00' : '#ffa500') });

        if (hs.maxsupplies > 0) {
          lines.push({ label: '📦 Supplies', value: `${Math.floor(hs.supplies || 0)} / ${hs.maxsupplies}`, color: '#ffcc80' });
        }

        if (hs.maxArmor && hs.maxArmor > 0) {
          let armorLabel = `Cruiser Armor (${hs.armor})`;
          if (hs.specialduranium && hs.specialduranium > 0) {
            armorLabel += '*';
          }
          lines.push({ label: armorLabel, value: Math.floor(hs.armorPoints) + ' / ' + Math.floor(hs.maxArmor), color: '#b0bec5' });
        }

        let crewVal = `👤 ${Math.floor(hs.crew || 0)} / ${Math.floor(2 * hs.health)}`;
        if (hs.marines > 0) {
          crewVal += `  |  🪖 Marines: ${Math.floor(hs.marineCount || 0)} / ${hs.marines * hs.maxHealth}`;
        }
        lines.push({ label: 'Crew / Marines', value: crewVal, color: '#81d4fa' });
        if (hs.commandPoints > 0) {
          lines.push({ label: '👑 Command Points', value: `+${(hs.commandPoints).toFixed(2)}`, color: '#ffeb3b' });
        }

        const rawTech = hsOwner ? (hsOwner.techScore || 0) : 0;
        const rawExp = hsOwner ? (hsOwner.expScore || 0) : 0;
        const shipExp = hs.expScore || 0;

        const techBonus = Math.sqrt(rawTech);
        const expBonus = Math.sqrt(rawExp);
        const shipExpBonus = Math.sqrt(shipExp) + (hs.commandPoints || 0);

        const baseDeflection = hs.maxHealth + (techBonus + expBonus + shipExpBonus);
        let shrugChance = Math.floor(baseDeflection);
        if ((hs.bombs || 0) < 1) {
          shrugChance = Math.floor(shrugChance / 2);
        }
        if (hs.specialduranium && hs.specialduranium > 0) {
          shrugChance += 10;
        }
        shrugChance = Math.min(90, shrugChance);
        let deflectionLabel = 'Deflection';
        if (hs.specialduranium && hs.specialduranium > 0) {
          deflectionLabel += '*';
        }

        const maxBombs = getMaxBombs(hs);
        let munitionsDisplay = (hs.bombs || 0).toFixed(1) + ' / ' + maxBombs.toFixed(1);
        let munitionsLabel = hs.munitions > 0 ? `Munitions (${hs.munitions})` : 'Munitions';
        if (hs.specialbombs && hs.specialbombs > 0) {
          munitionsLabel += '*';
        }
        lines.push({ label: `${munitionsLabel}`, value: `${munitionsDisplay}  |  🛡️ ${deflectionLabel}: ${shrugChance}%`, color: '#ffa' });
        if (hs.munitions > 0) {
          lines.push({ label: 'Splash Damage', value: `+${hs.munitions}`, color: '#ffd740' });
        }

        const laserTechBonus = Math.floor(techBonus) * 0.01;
        const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
        const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
        const targetingBonus = (hs.targeting || 0) * 5;
        const targetingRangeBonus = (hs.targeting || 0) * 0.05;

        let effectiveRange = baseDogfightRange * 1.10;
        if (hs.bombs > 0) {
          effectiveRange += baseDogfightRange * 0.10;
        }
        effectiveRange = Math.floor(effectiveRange * (1 + targetingRangeBonus));
        if (hs.fuel_tanker && hs.fuel_tanker > 0) {
          effectiveRange = Math.max(5, effectiveRange - hs.fuel_tanker * 5);
        }
        if (hs.specialbombs && hs.specialbombs > 0) {
          effectiveRange += 10;
        }
        if (hs.package === 'brute') {
          effectiveRange *= 0.5;
        } else if (hs.package === 'sniper') {
          effectiveRange *= 1.5;
        }
        effectiveRange = Math.floor(effectiveRange);

        let bombAccuracyBonus = 0;
        if (hs.bombs > 0) {
          bombAccuracyBonus = 10;
          let effTactics = hs.tactics;
          if (!effTactics) {
            if (hs.cruiserStyle === 'Tholian' || hs.cruiserStyle === 'Lyran') {
              effTactics = 'patient';
            } else if (hs.cruiserStyle === 'Romulan') {
              effTactics = 'frenzied';
            } else {
              effTactics = 'normal';
            }
          }
          if (effTactics === 'patient') {
            bombAccuracyBonus = 7;
          } else if (effTactics === 'frenzied') {
            bombAccuracyBonus = 20;
          }
        }

        let hitChanceValue = 10 + targetingBonus + bombAccuracyBonus;
        hitChanceValue += techBonus + expBonus + shipExpBonus;
        if (hs.fuel_tanker && hs.fuel_tanker > 0) {
          hitChanceValue -= hs.fuel_tanker * 5;
        }
        if (hs.specialbombs && hs.specialbombs > 0) {
          hitChanceValue += 10;
        }
        
        let friendlyGrav = 0;
        let enemyGrav = 0;
        if (serverState.planets) {
          for (const gp of serverState.planets) {
            if (!gp.ownerId) continue;
            const gpOwner = serverState.players.find(pl => pl.id === gp.ownerId);
            if (!gpOwner) continue;
            const tb = 0.01 * Math.sqrt(gpOwner.techScore || 0);
            const eb = 0.01 * Math.sqrt(gpOwner.expScore || 0);
            let baseRadius = gp.maxShips * 1.5;
            if (gp.isMilitary && gp.ships >= gp.maxShips) {
              baseRadius *= 1.5;
            }
            const isGpHuman = gpOwner && !gpOwner.isAI;
            if (isGpHuman && gp.focusMode === 'garrison' && gp.ships >= gp.maxShips) {
              baseRadius += (gp.ships / 2);
            }
            const gr = baseRadius * (1 + tb + eb);
            const pdx = gp.x - hs.x, pdy = gp.y - hs.y;
            if (pdx * pdx + pdy * pdy <= gr * gr) {
              let mult = 0.2;
              if (gp.isMilitary || gp.focusMode === 'garrison') {
                if (gp.ships >= gp.maxShips * 2 - 10) {
                  mult = 0.45;
                } else if (gp.ships >= gp.maxShips) {
                  mult = 0.3;
                }
              }
              const strength = mult * Math.floor(gp.ships / 10);
              if (gp.ownerId === hs.ownerId) {
                friendlyGrav += strength;
              } else {
                enemyGrav += strength;
              }
            }
          }
        }
        
        let hazardPenalty = 0;
        if (serverState.storms) {
          for (const storm of serverState.storms) {
            if (storm.type === 'minefield') continue;
            const sdx = hs.x - storm.x;
            const sdy = hs.y - storm.y;
            if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
              const knowledge = typeof storm.knowledge === 'object' ? ((storm.knowledge && hsOwner && storm.knowledge[hsOwner.id]) || 0) : (storm.knowledge || 0);
              const tRed = hsOwner ? Math.sqrt(hsOwner.techScore || 0) : 0;
              const eRed = hsOwner ? Math.sqrt(hsOwner.expScore || 0) : 0;
              const sRed = Math.sqrt(hs.expScore || 0);
              const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
              hazardPenalty += eff;
            }
          }
        }

        const hitChance = Math.round(Math.min(100, Math.max(10.0, hitChanceValue + friendlyGrav - enemyGrav - hazardPenalty))) + '%';
        let volleySizeVal = Math.max(1, Math.floor((hs.maxHealth + hs.health) / 6));
        const cap = Math.floor(hs.health - 2);
        if (volleySizeVal > cap) volleySizeVal = cap;
        if (hs.health <= 2) volleySizeVal = 0;
        const volleySize = volleySizeVal === 0 ? '0 (Disabled)' : volleySizeVal;
        let rangeLabel = 'Range';
        if (hs.specialbombs && hs.specialbombs > 0) {
          rangeLabel += '*';
        }
        let accuracyLabel = hs.targeting > 0 ? `Accuracy (${hs.targeting})` : 'Accuracy';
        if (hs.specialbombs && hs.specialbombs > 0) {
          accuracyLabel += '*';
        }
        lines.push({ label: `🎯 ${accuracyLabel}`, value: `${hitChance}  |  📏 ${rangeLabel}: ${effectiveRange}px`, color: '#f88' });
        
        const netMapBonus = friendlyGrav - enemyGrav - hazardPenalty;
        if (netMapBonus !== 0) {
          const sign = netMapBonus > 0 ? '+' : '';
          const color = netMapBonus > 0 ? '#4f4' : '#f66';
          lines.push({ label: 'Map Bonus', value: `${sign}${Math.round(netMapBonus)}%`, color: color });
        }
        
        const sm = hs.speedModifier || 1.0;
        if (sm < 1.0) {
          const speedLabel = sm === 0.25 ? '1/4 speed' : sm === 0.50 ? '1/2 speed' : `${Math.round(sm * 100)}% speed`;
          const saveChance = sm === 0.25 ? 90 : sm === 0.50 ? 75 : 0;
          lines.push({ label: speedLabel, value: saveChance > 0 ? `${saveChance}% save` : '', color: '#aaf' });
        }
        
        lines.push({ label: 'Volley Size', value: volleySize, color: '#ffa' });
        lines.push({ label: 'XP', value: `+${Math.round(shipExpBonus)} (${Math.round(shipExp)})`, color: '#00d5ff' });

        if (hs.sensorarrays > 0) lines.push({ label: `Sensor Array (${hs.sensorarrays})`, value: `📡 Active`, color: '#ffb300' });
        if (hs.labs > 0) lines.push({ label: `Laboratories (${hs.labs})`, value: `🔬 Active`, color: '#00e5ff' });
        if (hs.damagecontrol > 0) lines.push({ label: `Damage Control (${hs.damagecontrol})`, value: `🔧 Active`, color: '#69f0ae' });
        if (hs.fuel_tanker > 0) lines.push({ label: `Fuel Tanker (${hs.fuel_tanker})`, value: `⛽ ${25 + hs.fuel_tanker * 10}% Savings`, color: '#ffa500' });
        if (hs.diplomat > 0) lines.push({ label: `Diplomats (${hs.diplomat})`, value: `🤝 ${hs.diplomat} Active`, color: '#e040fb' });
        if (hs.command > 0) lines.push({ label: `Command (${hs.command})`, value: `👑 Active`, color: '#ffeb3b' });
      } else {
        const swarmRange = 100;
        const swarmRangesq = swarmRange * swarmRange;
        let nearbyCount = 0;
        let bomberCount = 0;
        let maxShipExp = hs.expScore || 0;
        let avgFlightTime = hs.flightTime || 0;
        let flightTimeCount = 1;
        for (const ship of serverState.ships) {
          if (ship.id === hs.id || ship.ownerId !== hs.ownerId || !ship.active) continue;
          const sdx = ship.x - hs.x;
          const sdy = ship.y - hs.y;
          if (sdx * sdx + sdy * sdy <= swarmRangesq) {
            nearbyCount += (ship.count || 1);
            if (ship.isBomber) bomberCount += (ship.count || 1);
            if ((ship.expScore || 0) > maxShipExp) maxShipExp = ship.expScore || 0;
            avgFlightTime += (ship.flightTime || 0) * (ship.count || 1);
            flightTimeCount += (ship.count || 1);
          }
        }
        avgFlightTime /= flightTimeCount;
        const totalShips = nearbyCount + (hs.count || 1);

        titleHTML = `<span style="color: ${hsOwner ? hsOwner.color : '#0ff'}">${(hsOwner ? hsOwner.name : 'Unknown')}'s Fleet</span>`;

        const bomberLabel = bomberCount > 0 ? ` (${bomberCount + (hs.isBomber ? 1 : 0)} bombers)` : '';
        lines.push({ label: 'ships in range', value: `${totalShips}${bomberLabel}`, color: '#ccc' });
        const raceStyle = hs.cruiserStyle || (hsOwner ? hsOwner.cruiserStyle : null);
        if (raceStyle) {
          const raceIcons = {
            'Federation': '🖖',
            'Romulan': '🦅',
            'Klingon': '⚔️',
            'Gorn': '🦎',
            'Tholian': '🕸️',
            'Lyran': '🐶'
          };
          const icon = raceIcons[raceStyle] || '';
          lines.push({ label: 'Race', value: `${icon} ${raceStyle}`, color: '#e040fb' });
        }
        lines.push({ label: 'Base Speed', value: (hs.speed || 30).toFixed(1), color: '#ccc' });
        lines.push({ label: 'Effective Speed', value: (hs.currentSpeed || 0).toFixed(1), color: '#4f4' });

        let totalAttackMod = 0;
        const swarmBonus = Math.floor(nearbyCount / 10);
        if (swarmBonus > 0) {
          totalAttackMod += swarmBonus;
          lines.push({ label: 'swarm Bonus', value: `${swarmBonus}%`, color: '#4f4' });
        }

        const techAtk = hsOwner ? Math.round(Math.sqrt(hsOwner.techScore || 0)) : 0;
        if (techAtk > 0) {
           totalAttackMod += techAtk;
           lines.push({ label: 'Tech Attack', value: `${techAtk}%`, color: '#4f4' });
        }

        const expAtk = hsOwner ? Math.round(Math.sqrt(hsOwner.expScore || 0)) : 0;
        if (expAtk > 0) {
           totalAttackMod += expAtk;
           lines.push({ label: 'Exp Attack', value: `${expAtk}%`, color: '#4f4' });
        }

        const shipExp = Math.round(Math.sqrt(maxShipExp || 0));
        if (shipExp > 0) {
          totalAttackMod += shipExp;
          lines.push({ label: 'ship Exp', value: `${shipExp}%`, color: '#4f4' });
        }
        if (hs.commandPoints > 0) {
          lines.push({ label: '👑 Command Points', value: `+${(hs.commandPoints).toFixed(2)}`, color: '#ffeb3b' });
        }

        let friendlyGrav = 0;
        let enemyGrav = 0;
        if (serverState.planets) {
          for (const gp of serverState.planets) {
            if (!gp.ownerId) continue;
            const gpOwner = serverState.players.find(pl => pl.id === gp.ownerId);
            if (!gpOwner) continue;
            const tb = 0.01 * Math.sqrt(gpOwner.techScore || 0);
            const eb = 0.01 * Math.sqrt(gpOwner.expScore || 0);
            let baseRadius = gp.maxShips * 1.5;
            if (gp.isMilitary && gp.ships >= gp.maxShips) {
              baseRadius *= 1.5;
            }
            const isGpHuman = gpOwner && !gpOwner.isAI;
            if (isGpHuman && gp.focusMode === 'garrison' && gp.ships >= gp.maxShips) {
              baseRadius += (gp.ships / 2);
            }
            const gr = baseRadius * (1 + tb + eb);
            const pdx = gp.x - hs.x, pdy = gp.y - hs.y;
            if (pdx * pdx + pdy * pdy <= gr * gr) {
              let mult = 0.2;
              if (gp.isMilitary || gp.focusMode === 'garrison') {
                if (gp.ships >= gp.maxShips * 2 - 10) {
                  mult = 0.45;
                } else if (gp.ships >= gp.maxShips) {
                  mult = 0.3;
                }
              }
              const strength = mult * Math.floor(gp.ships / 10);
              if (gp.ownerId === hs.ownerId) {
                friendlyGrav += strength;
              } else {
                enemyGrav += strength;
              }
            }
          }
        }
        let hazardPenalty = 0;
        if (serverState.storms) {
          for (const storm of serverState.storms) {
            if (storm.type === 'minefield') continue;
            const sdx = hs.x - storm.x;
            const sdy = hs.y - storm.y;
            if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
              const knowledge = typeof storm.knowledge === 'object' ? ((storm.knowledge && hsOwner && storm.knowledge[hsOwner.id]) || 0) : (storm.knowledge || 0);
              const tRed = hsOwner ? Math.sqrt(hsOwner.techScore || 0) : 0;
              const eRed = hsOwner ? Math.sqrt(hsOwner.expScore || 0) : 0;
              const sRed = Math.sqrt(maxShipExp || 0);
              const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
              hazardPenalty += eff;
            }
          }
        }

        if (friendlyGrav > 0) totalAttackMod += friendlyGrav;
        if (enemyGrav > 0) totalAttackMod -= enemyGrav;
        if (hazardPenalty > 0) totalAttackMod -= hazardPenalty;

        const netMapBonus = friendlyGrav - enemyGrav - hazardPenalty;
        if (netMapBonus !== 0) {
          const sign = netMapBonus > 0 ? '+' : '';
          const color = netMapBonus > 0 ? '#4f4' : '#f66';
          lines.push({ label: 'Map Bonus', value: `${sign}${Math.round(netMapBonus)}%`, color: color });
        }

        const sm = hs.speedModifier || 1.0;
        if (sm < 1.0) {
          const speedLabel = sm === 0.25 ? '1/4 speed' : sm === 0.50 ? '1/2 speed' : `${Math.round(sm * 100)}% speed`;
          const saveChance = sm === 0.25 ? 90 : sm === 0.50 ? 75 : 0;
          lines.push({ label: speedLabel, value: saveChance > 0 ? `${saveChance}% save` : '', color: '#aaf' });
        }

        lines.push({ label: 'Dogfight Hit%', value: `${Math.round(Math.max(1, 10 + totalAttackMod))}%`, color: '#fff' });

        const techSafe = hsOwner ? Math.sqrt(hsOwner.techScore || 0) : 0;
        const expSafe = hsOwner ? Math.sqrt(hsOwner.expScore || 0) : 0;
        const safeTime = techSafe + expSafe;

        if (avgFlightTime > 0) {
          lines.push({ label: 'Flight Time', value: `${Math.round(avgFlightTime)}s`, color: '#aaa' });
        }
        if (safeTime > 0) {
          lines.push({ label: 'safe Time', value: `${Math.round(safeTime)}s`, color: avgFlightTime >= safeTime ? '#f66' : '#4f4' });
        }

        if (avgFlightTime >= safeTime) {
          const timeExposed = avgFlightTime - safeTime;
          let attritionRate = 1 + Math.floor(timeExposed / 4);
          let attritionLabel = `${attritionRate}%/s`;

          let inFriendlyWell = false;
          if (serverState.planets) {
            for (const planet of serverState.planets) {
              if (planet.ownerId !== hs.ownerId) continue;
              const pOwner = serverState.players.find(pl => pl.id === planet.ownerId);
              if (!pOwner) continue;
              const tb = 0.01 * Math.sqrt(pOwner.techScore || 0);
              const eb = 0.01 * Math.sqrt(pOwner.expScore || 0);
              let baseRadius = planet.maxShips * 1.5;
              if (planet.isMilitary && planet.ships >= planet.maxShips) {
                baseRadius *= 1.5;
              }
              const isPlanetHuman = pOwner && !pOwner.isAI;
              if (isPlanetHuman && planet.focusMode === 'garrison' && planet.ships >= planet.maxShips) {
                baseRadius += (planet.ships / 2);
              }
              const gr = baseRadius * (1 + tb + eb);
              const pdx = hs.x - planet.x, pdy = hs.y - planet.y;
              if (pdx * pdx + pdy * pdy < gr * gr) {
                inFriendlyWell = true;
                break;
              }
            }
          }
          if (inFriendlyWell) attritionLabel += ' (÷3 friendly well)';
          if (hs.isBomber) attritionLabel += ' (÷2 bomber)';
          lines.push({ label: 'Attrition', value: attritionLabel, color: '#f66' });
        } else {
          lines.push({ label: 'Attrition', value: 'safe', color: '#4f4' });
        }
      }

      if (serverState.storms) {
        for (const storm of serverState.storms) {
          const dx = hs.x - storm.x, dy = hs.y - storm.y;
          if (dx * dx + dy * dy <= storm.radius * storm.radius) {
            const typeLabel = storm.type === 'minefield' ? 'Minefield' : storm.type === 'nebula' ? 'Nebula' : 'Ion Storm';
            const typeColor = storm.type === 'minefield' ? '#66f' : storm.type === 'nebula' ? '#f66' : '#ff0';
            lines.push({ label: `⚠️ ${typeLabel}`, value: `Int: ${storm.intensity}`, color: typeColor });
          }
        }
      }

      for (const line of lines) {
        const displayLabel = formatTooltipString(line.label);
        const displayValue = formatTooltipString(line.value);
        if (line.isHeader) {
          bodyHTML += `<div class="info-panel-row header-row" style="color: ${line.color}">
            <div class="info-panel-label">${displayLabel}</div>
            <div class="info-panel-value">${displayValue || ''}</div>
          </div>`;
        } else if (line.isSpeedBar) {
          const fillPct = Math.min(1.0, Math.max(0, line.currentSpeed / Math.max(1, line.maxSpeed)));
          bodyHTML += `<div class="info-panel-row" style="color: ${line.color || '#fff'}">
            <div class="info-panel-label">${displayLabel}</div>
            <div class="info-panel-speedbar-container">
              <span style="font-size: 0.8rem; color: #ccc; margin-right: 4px;">${displayValue.split('|')[1]?.trim() || ''}</span>
              <div class="info-panel-speedbar-track">
                <div class="info-panel-speedbar-fill" style="width: ${fillPct * 100}%"></div>
              </div>
              <span style="font-size: 0.8rem; color: #ffa500; font-weight: bold; margin-left: 4px;">${displayValue.split('|')[0]?.trim() || ''}</span>
            </div>
          </div>`;
        } else {
          bodyHTML += `<div class="info-panel-row" style="color: ${line.color || '#fff'}">
            <div class="info-panel-label">${displayLabel}</div>
            <div class="info-panel-value">${displayValue}</div>
          </div>`;
        }
      }
    }

    infoPanelTitle.innerHTML = titleHTML;
    infoPanelBody.innerHTML = bodyHTML;

    // Position as tooltip near the selected target
    let targetX = 0;
    let targetY = 0;
    let hasTargetCoords = false;

    if (type === 'anomaly') {
      let p = serverState.planets.find(pp => pp.id === id);
      if (p && p.anomaly) {
        targetX = p.anomaly.x;
        targetY = p.anomaly.y;
        hasTargetCoords = true;
      }
    } else if (type === 'planet') {
      let p = serverState.planets.find(pp => pp.id === id);
      const isLastKnown = p && p.inFog && (p.permanentlyTracked || !!lastKnownPlanets[p.id]);
      if (isLastKnown && !p.permanentlyTracked && lastKnownPlanets[p.id]) {
        p = lastKnownPlanets[p.id];
      }
      if (p) {
        targetX = p.x;
        targetY = p.y;
        hasTargetCoords = true;
      }
    } else if (type === 'ship' || type === 'fleet') {
      let s = serverState.ships.find(ss => ss.id === id);
      if (s) {
        targetX = s.x;
        targetY = s.y;
        hasTargetCoords = true;
      }
    }

    if (isHoveringSelectionTile) {
      const container = document.querySelector('.info-panel-container');
      if (container) {
        let left = selectionTileMouseX + 15;
        let top = selectionTileMouseY - 150;

        const width = container.offsetWidth || 380;
        const height = container.offsetHeight || 450;

        if (left + width > window.innerWidth) {
          left = selectionTileMouseX - width - 15;
        }
        if (left < 10) left = 10;

        if (top + height > window.innerHeight) {
          top = window.innerHeight - height - 10;
        }
        if (top < 10) top = 10;

        container.style.position = 'fixed';
        container.style.left = `${left}px`;
        container.style.top = `${top}px`;
        container.style.margin = '0';
      }
    } else if (hasTargetCoords) {
      const screenPos = getServerToScreenPos(targetX, targetY);
      const container = document.querySelector('.info-panel-container');
      if (container) {
        let top = screenPos.y - 150;
        let left = screenPos.x + 25;

        // Retrieve container dimensions. Use standard fallbacks if container is not fully rendered yet.
        const width = container.offsetWidth || 380;
        const height = container.offsetHeight || 450;

        if (left + width > window.innerWidth) {
          left = screenPos.x - width - 25;
        }
        if (left < 10) left = 10;

        if (top + height > window.innerHeight) {
          top = window.innerHeight - height - 10;
        }
        if (top < 10) top = 10;

        container.style.position = 'fixed';
        container.style.left = `${left}px`;
        container.style.top = `${top}px`;
        container.style.margin = '0';
      }
    }
  }

  // UI Elements
  const startScreen = document.getElementById('start-screen');
  const endScreen = document.getElementById('end-screen');
  const gameUI = document.getElementById('game-ui');

  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const lobbyBtn = document.getElementById('lobby-btn');
  const endTitle = document.getElementById('end-title');

  const leaderboardContent = document.getElementById('leaderboard-content');
  const scoreBoard = document.getElementById('score-board');

  document.getElementById('btn-leaderboard').addEventListener('click', () => {
    scoreBoard.classList.toggle('hidden');
  });

  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const closeHelp = document.getElementById('close-help');
  const helpTitle = document.getElementById('help-title');
  const helpIndex = document.getElementById('help-index');
  const helpBackContainer = document.getElementById('help-back-container');
  const helpBackBtn = document.getElementById('help-back-btn');

  const topicTitles = {
    victory: '⚔️ Victory Conditions',
    controls: '🎮 Controls',
    planets: '🪐 Planets & Economy',
    focus: '👁️ Focus Modes',
    ships: '🚀 Ships & Combat',
    cruisers: '🛸 Cruisers',
    upgrades: '🛠️ Upgrades',
    diplomacy: '🤝 Diplomacy & Sympathy',
    hazards: '⚡ Hazards',
    monsters: '🧬 Space Amoebas',
    ai: '🤖 AI & Rampage',
    other: '📡 Other',
    anomalies: '🔬 Anomalies'
  };

  function showHelpIndex() {
    // Hide all topic pages
    document.querySelectorAll('[id^="help-topic-"]').forEach(el => el.classList.add('hidden'));
    helpIndex.classList.remove('hidden');
    helpBackContainer.style.display = 'none';
    helpTitle.textContent = 'How to Play';
  }

  function showHelpTopic(topic) {
    helpIndex.classList.add('hidden');
    document.querySelectorAll('[id^="help-topic-"]').forEach(el => el.classList.add('hidden'));
    const topicEl = document.getElementById(`help-topic-${topic}`);
    if (topicEl) topicEl.classList.remove('hidden');
    helpBackContainer.style.display = 'block';
    helpTitle.textContent = topicTitles[topic] || 'How to Play';
  }

  helpBtn.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
    showHelpIndex();
  });

  closeHelp.addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });

  window.addEventListener('click', (event) => {
    if (event.target === helpModal) {
      helpModal.classList.add('hidden');
    }
    // Dismiss info panel with a click outside the container
    if (activeInfoPanel && !panelOpenedThisTick) {
      const container = document.querySelector('.info-panel-container');
      if (container && !container.contains(event.target)) {
        closeInfoPanel();
      }
    }
  });

  // Wire up topic buttons
  document.querySelectorAll('.help-topic-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showHelpTopic(btn.dataset.topic);
    });
  });

  // Wire up back button
  helpBackBtn.addEventListener('click', () => {
    showHelpIndex();
  });

  const mapSizeselect = document.getElementById('map-size-select');
  const customMapsizeContainer = document.getElementById('custom-map-size-container');
  const mapSizeInput = document.getElementById('map-size-input');
  const planetCountInput = document.getElementById('planet-count-input');
  const aiCountInput = document.getElementById('ai-count-input');
  const prodMultipleSelect = document.getElementById('production-multiple-select');
  const customProdMultipleContainer = document.getElementById('custom-production-multiple-container');
  const prodMultipleInput = document.getElementById('production-multiple-input');
  const timedGameSelect = document.getElementById('timed-game-select');
  const customTimedGameContainer = document.getElementById('custom-timed-game-container');
  const timedGameInput = document.getElementById('timed-game-input');

  const homeworldSizeSelect = document.getElementById('homeworld-size-select');
  const customHomeworldSizeContainer = document.getElementById('custom-homeworld-size-container');
  const homeworldSizeInput = document.getElementById('homeworld-size-input');

  const startingCreditsSelect = document.getElementById('starting-credits-select');
  const customStartingCreditsContainer = document.getElementById('custom-starting-credits-container');
  const startingCreditsInput = document.getElementById('starting-credits-input');

  const aiEntrySelect = document.getElementById('ai-entry-select');
  const customAiEntryContainer = document.getElementById('custom-ai-entry-container');
  const customAiEntryInput = document.getElementById('custom-ai-entry-input');

  if (aiEntrySelect) {
    aiEntrySelect.addEventListener('change', () => {
      if (aiEntrySelect.value === 'custom') {
        if (customAiEntryContainer) customAiEntryContainer.style.display = 'flex';
      } else {
        if (customAiEntryContainer) customAiEntryContainer.style.display = 'none';
      }
    });
  }

  if (prodMultipleSelect) {
    prodMultipleSelect.addEventListener('change', () => {
      if (prodMultipleSelect.value === 'custom') {
        customProdMultipleContainer.style.display = 'flex';
      } else {
        customProdMultipleContainer.style.display = 'none';
        prodMultipleInput.value = prodMultipleSelect.value;
      }
    });
  }

  const hazardMultipleSelect = document.getElementById('hazard-multiple-select');
  const customHazardMultipleContainer = document.getElementById('custom-hazard-multiple-container');
  const hazardMultipleInput = document.getElementById('hazard-multiple-input');

  if (hazardMultipleSelect) {
    hazardMultipleSelect.addEventListener('change', () => {
      if (hazardMultipleSelect.value === 'custom') {
        customHazardMultipleContainer.style.display = 'flex';
      } else {
        customHazardMultipleContainer.style.display = 'none';
        hazardMultipleInput.value = hazardMultipleSelect.value;
      }
    });
  }

  let lastSuggestedPlanets = 30;
  let lastSuggestedAI = 2;

  if (planetCountInput && aiCountInput) {
    planetCountInput.addEventListener('input', () => {
      const planets = parseInt(planetCountInput.value, 10) || 0;
      const suggestedAI = Math.min(11, Math.max(1, Math.floor(planets / 10) - 1));
      aiCountInput.value = suggestedAI;
      lastSuggestedAI = suggestedAI;
    });
  }

  if (mapSizeselect) {
    mapSizeselect.addEventListener('change', () => {
      const val = mapSizeselect.value;
      if (val === 'custom') {
        customMapsizeContainer.style.display = 'flex';
      } else {
        customMapsizeContainer.style.display = 'none';
        const newSize = parseInt(val, 10);
        mapSizeInput.value = newSize; // Keep custom sync'd
        const suggestedPlanets = Math.max(1, Math.round(15 + 0.015 * (newSize - 1000)));
        if (parseInt(planetCountInput.value, 10) === lastSuggestedPlanets) {
          planetCountInput.value = suggestedPlanets;
          planetCountInput.dispatchEvent(new Event('input'));
        }
        lastSuggestedPlanets = suggestedPlanets;
      }
    });
  }

  if (mapSizeInput) {
    mapSizeInput.addEventListener('input', () => {
      if (mapSizeselect && mapSizeselect.value === 'custom') {
        const newSize = parseInt(mapSizeInput.value, 10) || 1600;
        const suggestedPlanets = Math.max(1, Math.round(15 + 0.015 * (newSize - 1000)));
        if (parseInt(planetCountInput.value, 10) === lastSuggestedPlanets) {
          planetCountInput.value = suggestedPlanets;
          planetCountInput.dispatchEvent(new Event('input'));
        }
        lastSuggestedPlanets = suggestedPlanets;
      }
    });
  }

  if (timedGameSelect) {
    timedGameSelect.addEventListener('change', () => {
      if (timedGameSelect.value === 'custom') {
        if (customTimedGameContainer) customTimedGameContainer.style.display = 'flex';
      } else {
        if (customTimedGameContainer) customTimedGameContainer.style.display = 'none';
        if (timedGameInput && timedGameSelect.value !== 'unlimited') {
          timedGameInput.value = String(Math.round(parseFloat(timedGameSelect.value) / 60));
        }
      }
    });
  }

  if (homeworldSizeSelect) {
    homeworldSizeSelect.addEventListener('change', () => {
      if (homeworldSizeSelect.value === 'custom') {
        if (customHomeworldSizeContainer) customHomeworldSizeContainer.style.display = 'flex';
      } else {
        if (customHomeworldSizeContainer) customHomeworldSizeContainer.style.display = 'none';
      }
    });
  }

  if (startingCreditsSelect) {
    startingCreditsSelect.addEventListener('change', () => {
      if (startingCreditsSelect.value === 'custom') {
        if (customStartingCreditsContainer) customStartingCreditsContainer.style.display = 'flex';
      } else {
        if (customStartingCreditsContainer) customStartingCreditsContainer.style.display = 'none';
        if (startingCreditsInput) {
          startingCreditsInput.value = startingCreditsSelect.value;
        }
      }
    });
  }



  const setupNewGameBtn = document.getElementById('setup-new-game-btn');
  const setupOptionsContainer = document.getElementById('setup-options-container');
  let lockedSettings = false;

  if (setupNewGameBtn && setupOptionsContainer) {
    setupNewGameBtn.addEventListener('click', () => {
      setupOptionsContainer.style.display = 'flex';
      setupNewGameBtn.style.display = 'none';
      startBtn.textContent = 'START GAME';

      // Unlock fields that were locked by an ongoing game
      const fogCheck = document.getElementById('fog-of-war-checkbox');
      const aiInput = document.getElementById('ai-count-input');
      if (fogCheck) fogCheck.disabled = false;
      if (aiInput) {
        aiInput.disabled = false;
        if (lockedSettings) {
          aiInput.value = lastSuggestedAI;
        }
      }
    });
  }

  const musicCheckboxEl = document.getElementById('music-checkbox');
  if (musicCheckboxEl) {
    musicCheckboxEl.addEventListener('change', () => {
      const bgMusic = document.getElementById('bg-music');
      if (musicCheckboxEl.checked) {
        if (bgMusic && bgMusic.paused) {
          playRandomIntroTrack();
        }
      } else {
        if (bgMusic) {
          bgMusic.pause();
        }
      }
    });
  }

  startBtn.addEventListener('click', () => {
    console.log('startBtn clicked!');
    megalovaniaPlayed = false;
    const nameInput = document.getElementById('player-name-input');
    if (nameInput && nameInput.value.trim() !== '') {
      socket.emit('setName', nameInput.value.trim());
      localStorage.setItem('planetWarsPlayerName', nameInput.value.trim());
    }

    const musicCheckbox = document.getElementById('music-checkbox');
    const bgMusic = document.getElementById('bg-music');
    if (musicCheckbox && musicCheckbox.checked && bgMusic) {
      playRandomIntroTrack();
    } else if (bgMusic) {
      bgMusic.pause();
    }

    const starfieldCheckbox = document.getElementById('starfield-checkbox');
    starfieldEnabled = starfieldCheckbox ? starfieldCheckbox.checked : false;

    startScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
  });

  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const chatContainer = document.getElementById('chat-container');
  let chatInteracted = false;

  const configNameInput = document.getElementById('config-name-input');
  if (configNameInput) {
    configNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        const name = configNameInput.value.trim();
        if (name && pendingShipConfig) {
          const savedConfigs = JSON.parse(localStorage.getItem('planetwars_ship_configs') || '[]');
          const newConfig = {
            name: name.substring(0, 30),
            classType: pendingShipConfig.classType,
            upgrades: pendingShipConfig.upgrades
          };
          savedConfigs.push(newConfig);
          localStorage.setItem('planetwars_ship_configs', JSON.stringify(savedConfigs));
          
          configNameInput.value = '';
          configNameInput.classList.add('hidden');
          configNameInput.blur();
          pendingShipConfig = null;

          const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
          const selectedPlanetBuild = selectedPlanets.length === 1 ? selectedPlanets[0] : null;
          updateConfigBuildButtons(myPlayer, selectedPlanetBuild);
        }
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        configNameInput.value = '';
        configNameInput.classList.add('hidden');
        configNameInput.blur();
        pendingShipConfig = null;
      }
    });
  }

  if (chatMessages) {
    chatMessages.addEventListener('mousedown', () => {
      chatInteracted = true;
    });
    chatMessages.addEventListener('wheel', () => {
      chatInteracted = true;
    });
  }

  document.addEventListener('keydown', (e) => {
    if (chatContainer && chatContainer.classList.contains('chat-active')) {
      if (e.key === 'PageUp' || e.key === 'PageDown') {
        chatInteracted = true;
        if (e.key === 'PageUp') {
          chatMessages.scrollTop = Math.max(0, chatMessages.scrollTop - 100);
        } else {
          chatMessages.scrollTop = Math.min(chatMessages.scrollHeight, chatMessages.scrollTop + 100);
        }
        e.preventDefault();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (chatInput) {
        if (document.activeElement === chatInput) {
          const text = chatInput.value.trim();
          if (text !== '') {
            const match = text.match(/^[nN]\s+(.+)$/);
            let ship = null;
            let planet = null;
            if (selectedShips.length === 1 && serverState) {
              ship = serverState.ships.find(s => s.id === selectedShips[0].id && s.isCruiser && s.ownerId === localPlayer.id);
            }
            if (selectedPlanets.length === 1 && serverState) {
              planet = serverState.planets.find(p => p.id === selectedPlanets[0].id && p.ownerId === localPlayer.id);
            }

            if (match && ship) {
              const newName = match[1].trim().substring(0, 16);
              socket.emit('nameShip', { shipId: ship.id, name: newName });
            } else if (match && planet) {
              const newName = match[1].trim().substring(0, 16);
              socket.emit('namePlanet', { planetId: planet.id, name: newName });
            } else {
              socket.emit('chatMessage', text);
            }

            if (chatInteracted) {
              chatInput.value = '';
              setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }, 50);
              return;
            }
          }
          chatInput.value = '';
          chatInput.classList.add('hidden');
          chatInput.blur();
          if (chatContainer) chatContainer.classList.remove('chat-active');
          chatInteracted = false;
        } else {
          chatInput.classList.remove('hidden');
          chatInput.focus();
          if (chatContainer) chatContainer.classList.add('chat-active');
          chatInteracted = false;
        }
      }
    }
  });

  socket.on('chatMessage', (msg) => {
    if (chatMessages) {
      const div = document.createElement('div');
      div.className = msg.isAnimated ? 'chat-msg chat-msg-animated' : 'chat-msg';
      div.style.color = msg.color || '#fff';
      div.innerHTML = `<span style="opacity: 0.7">[${msg.sender}]</span> ${msg.text}`;
      chatMessages.appendChild(div);
      
      if (!chatInteracted) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      // Play chime sound
      playChatNotificationSound();

      if (msg.text && msg.text.trim().toLowerCase() === 'battle time!') {
        const musicCheckbox = document.getElementById('music-checkbox');
        const bgMusic = document.getElementById('bg-music');
        if (musicCheckbox && musicCheckbox.checked && bgMusic) {
          bgMusic.src = '/Music/Battletime.mp3';
          bgMusic.loop = false;
          bgMusic.volume = 0.5;
          bgMusic.play().catch(e => console.warn('Battletime play blocked:', e));
        }
      }

      if (msg.text && msg.text.trim().toLowerCase() === 'meg!') {
        const musicCheckbox = document.getElementById('music-checkbox');
        const bgMusic = document.getElementById('bg-music');
        if (musicCheckbox && musicCheckbox.checked && bgMusic) {
          bgMusic.src = '/Music/Megalovania.mp3';
          bgMusic.loop = false;
          bgMusic.volume = 0.5;
          bgMusic.play().catch(e => console.warn('Megalovania play blocked:', e));
        }
      }

      // Limit children to 200 elements to avoid DOM bloat
      while (chatMessages.children.length > 200) {
        chatMessages.removeChild(chatMessages.firstChild);
      }

      // Set class faded after 90 seconds
      setTimeout(() => {
        div.classList.add('faded');
      }, 90000);
    }
  });

  // Generate starfield (regenerated when map size is known)
  let stars = [];
  let starsMapWidth = 0;
  let starsMapHeight = 0;
  function regenerateStars(mapW, mapH) {
    if (mapW === starsMapWidth && mapH === starsMapHeight) return;
    starsMapWidth = mapW;
    starsMapHeight = mapH;
    const area = mapW * mapH;
    const baseArea = 1920 * 1620;
    const starCount = Math.round(800 * (area / baseArea));
    stars = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * mapW,
        y: Math.random() * mapH,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.8 + 0.2
      });
    }
  }
  regenerateStars(1920, 1620);

  socket.on('assignedPlayer', (player) => {
    localPlayer = player;
  });

  socket.on('saveGamesList', (saves) => {
    const savesList = document.getElementById('saves-list');
    if (!savesList) return;
    
    savesList.innerHTML = '';
    
    if (!saves || saves.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.color = '#888';
      emptyMsg.style.fontFamily = "'Rajdhani', sans-serif";
      emptyMsg.style.fontSize = '0.95rem';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = '10px';
      emptyMsg.textContent = 'No saved missions found. Start a new game below.';
      savesList.appendChild(emptyMsg);
      return;
    }
    
    saves.forEach(save => {
      const item = document.createElement('div');
      item.className = 'save-item';
      item.textContent = save;
      
      // Left click to load
      item.addEventListener('click', (e) => {
        const nameInput = document.getElementById('player-name-input');
        if (nameInput && nameInput.value.trim() !== '') {
          socket.emit('setName', nameInput.value.trim());
          localStorage.setItem('planetWarsPlayerName', nameInput.value.trim());
        }
        
        socket.emit('loadSaveGame', save);
      });
      
      // Right click to delete
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        socket.emit('deleteSaveGame', save);
      });
      
      savesList.appendChild(item);
    });
  });

  socket.on('gameLoadedAndStarted', (saveName) => {
    megalovaniaPlayed = false;
    const musicCheckbox = document.getElementById('music-checkbox');
    const bgMusic = document.getElementById('bg-music');
    if (musicCheckbox && musicCheckbox.checked && bgMusic) {
      playRandomIntroTrack();
    } else if (bgMusic) {
      bgMusic.pause();
    }
    
    const starfieldCheckbox = document.getElementById('starfield-checkbox');
    starfieldEnabled = starfieldCheckbox ? starfieldCheckbox.checked : false;

    startScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    hasCenteredOnHomeworld = false;
    resetClientModeFlags();
    lastKnownPlanets = {};
  });

  socket.on('spectator', () => {
    console.log("Joined as spectator");
  });

  const afkWarningOverlay = document.getElementById('afk-warning');
  const resetAfkBtn = document.getElementById('reset-afk-btn');

  socket.on('afkWarning', () => {
    afkWarningOverlay.classList.remove('hidden');
  });

  socket.on('afkConverted', () => {
    afkWarningOverlay.classList.add('hidden');
  });

  socket.on('tileExplored', (data) => {
    floatingAnimations.push({
      x: data.x,
      y: data.y,
      shipId: data.shipId,
      text: `${data.xp}`,
      type: 'exploration_xp',
      age: 0,
      duration: 1.5
    });
  });

  socket.on('anomalyCompleted', (data) => {
    playSound('trumpet');
    floatingAnimations.push({
      x: data.x,
      y: data.y,
      text: data.text,
      type: 'anomaly_completion',
      age: 0,
      duration: 2.0
    });
  });

  if (resetAfkBtn) {
    resetAfkBtn.addEventListener('click', () => {
      socket.emit('resetAFK');
      afkWarningOverlay.classList.add('hidden');
    });
  }

  let lastPlanetCapacities = {};
  let lastPlanetAssignments = {};
  let lastPlanetRampages = {};
  let lastPlanetIncubations = {};
  let lastPlanetRevoltAttempts = {};
  let megalovaniaPlayed = false;
  let lastPlanetStands = {};
  let lastPlanetHomeworlds = {};
  let planetShields = {};
  let floatingAnimations = [];
  let lastPlanetSpyRooted = {};
  let visualShips = new Map();

  const sounds = {
    laser: new Audio('/laser.wav'),
    explosion: new Audio('/explosion.wav'),
    trumpet: new Audio('/trumpet.wav'),
    rampage: new Audio('/rampage.wav')
  };
  sounds.laser.volume = 0.075;
  sounds.explosion.volume = 0.3;
  sounds.trumpet.volume = 0.6;
  sounds.rampage.volume = 0.8;

  function playSound(type) {
    if (window.onPlaySound) {
      window.onPlaySound(type);
    }
    if (!sounds[type]) return;
    const clone = sounds[type].cloneNode();
    clone.volume = sounds[type].volume;
    clone.play().catch(e => { }); // Ignore autoplay errors
  }

  function playBattleSound() {
    playSound('laser');
    setTimeout(() => playSound('explosion'), 100);
    setTimeout(() => playSound('laser'), 250);
    setTimeout(() => playSound('explosion'), 350);
    setTimeout(() => playSound('laser'), 500);
    setTimeout(() => playSound('explosion'), 600);
  }

  let lastScanningSoundTime = 0;
  function playScanningSound(isCompleting) {
    const nowTime = Date.now();
    const interval = isCompleting ? 100 : 150;
    if (nowTime - lastScanningSoundTime < interval) return; // limit rate
    lastScanningSoundTime = nowTime;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      
      const now = audioCtx.currentTime;
      if (isCompleting) {
        // Higher pitched upward sweep for beaming up
        const baseFreq = 500 + Math.sin(nowTime / 20) * 200;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);
        gainNode.gain.setValueAtTime(0.06, now); // slightly louder
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else {
        // Lower pitched warble for scanning
        const freq = 350 + Math.sin(nowTime / 40) * 100;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq + 50, now + 0.15);
        gainNode.gain.setValueAtTime(0.03, now); // low volume
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      // ignore
    }
  }

  function playThudSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
      
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Web Audio synthesis failed, falling back to low volume explosion:', e);
      if (sounds.explosion) {
        const clone = sounds.explosion.cloneNode();
        clone.volume = 0.05;
        clone.play().catch(err => {});
      }
    }
  }

  function playChatNotificationSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
      
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn('Web Audio synthesis failed for chat sound:', e);
    }
  }

  function playChaChingSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const now = audioCtx.currentTime;
      
      // First high bell chime (triangle)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08); // E6
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Second high bell chime (cha-ching, delayed sine wave)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.08); // E6
      osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.25); // A6
      gain2.gain.setValueAtTime(0.0, now);
      gain2.gain.setValueAtTime(0.08, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn('Web Audio synthesis failed for cha-ching sound:', e);
    }
  }

  const spriteSheets = {};

  function preRenderSprites(players) {
    for (const player of players) {
      const canvas = document.createElement('canvas');
      canvas.width = 360 * 16;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = player.color;
      
      for (let angleDeg = 0; angleDeg < 360; angleDeg++) {
        const angleRad = angleDeg * Math.PI / 180;
        const xOffset = angleDeg * 16 + 8;
        
        // Row 0: Standard ship (circle)
        ctx.save();
        ctx.translate(xOffset, 8);
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Row 1: Bomber (triangle size 4)
        ctx.save();
        ctx.translate(xOffset, 24);
        ctx.rotate(angleRad + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(4, 4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        
        // Row 2: Interceptor (triangle size 3)
        ctx.save();
        ctx.translate(xOffset, 40);
        ctx.rotate(angleRad + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(3, 3);
        ctx.lineTo(-3, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      spriteSheets[player.id] = canvas;
    }
  }

  let lastExplosionCount = 0;
  let lastLaserCount = 0;

  socket.on('gameStateUpdate', (state) => {
    if (state.gameStartTime !== undefined && state.gameStartTime !== lastGameStartTime) {
      lastGameStartTime = state.gameStartTime;
      hasCenteredOnHomeworld = false;
      resetClientModeFlags();
      lastKnownPlanets = {};
    }

    if (Object.keys(spriteSheets).length === 0 && state.players && state.players.length > 0) {
      preRenderSprites([...state.players, { id: 'neutral', color: '#ffffff' }]);
    }

    if (state.settings && !lockedSettings && !startScreen.classList.contains('hidden')) {
      const fogCheck = document.getElementById('fog-of-war-checkbox');
      const aiInput = document.getElementById('ai-count-input');
      if (fogCheck) {
        fogCheck.checked = state.settings.fogOfWar;
        fogCheck.disabled = true;
      }
      if (aiInput) {
        aiInput.value = state.settings.aiCount;
        aiInput.disabled = true;
      }
      lockedSettings = true;
    }

    // Regenerate starfield if map size changed, and reset camera
    if (state.width && state.height) {
      if (state.width !== starsMapWidth || state.height !== starsMapHeight) {
        cameraPanX = 0;
        cameraPanY = 0;
        cameraZoom = 1.0;
        hasCenteredOnHomeworld = false;
      }
      regenerateStars(state.width, state.height);
    }

    // Center on homeworld/initial corvettes and select them on first sync
    if (!hasCenteredOnHomeworld && localPlayer && state.settings && state.width && state.height) {
      if (state.settings.homeworldSize === 'pioneers') {
        const myShips = state.ships.filter(s => s.ownerId === localPlayer.id && s.active);
        if (myShips.length > 0) {
          // Calculate average position of player's initial ships
          let sumX = 0, sumY = 0;
          for (const s of myShips) {
            sumX += s.x;
            sumY += s.y;
          }
          const centerX = sumX / myShips.length;
          const centerY = sumY / myShips.length;

          cameraPanX = state.width / 2 - centerX;
          cameraPanY = state.height / 2 - centerY;
          cameraZoom = 2.0; // Zoom in!
          hasCenteredOnHomeworld = true;
        }
      } else {
        const hw = state.planets.find(p => p.homeworldOf === localPlayer.id);
        if (hw) {
          cameraPanX = state.width / 2 - hw.x;
          cameraPanY = state.height / 2 - hw.y;
          cameraZoom = 2.0;
          hasCenteredOnHomeworld = true;

          // Auto-select homeworld disabled per user request
          // selectedPlanets = [hw];
        }
      }
    }

    if (serverState) {
      for (const p of state.planets) {

        const wasVisible = serverState.planets.some(oldP => oldP.id === p.id);
        if (!p.inFog && wasVisible && p.ownerId && lastPlanetCapacities[p.id] && p.maxShips > lastPlanetCapacities[p.id]) {
          floatingAnimations.push({
            x: p.x,
            y: p.y - p.radius,
            text: '$$$',
            type: 'dollar',
            age: 0,
            duration: 1.5
          });
        }
        if (!p.inFog && p.techIncreaseEvent) {
          floatingAnimations.push({
            x: p.x,
            y: p.y - p.radius,
            text: '🧪',
            type: 'beaker',
            age: 0,
            duration: 2.5
          });
        }
        if (!p.inFog && p.techDoubleIncreaseEvent) {
          floatingAnimations.push({
            x: p.x - 10,
            y: p.y - p.radius,
            text: '🧪',
            type: 'beaker',
            age: 0,
            duration: 2.5
          });
          floatingAnimations.push({
            x: p.x + 10,
            y: p.y - p.radius,
            text: '🧪',
            type: 'beaker',
            age: 0.2, // Offset animation slightly
            duration: 2.5
          });
        }
        if (!p.inFog && p.capacityDecreaseEvent) {
          floatingAnimations.push({
            x: p.x + (Math.random() - 0.5) * p.radius,
            y: p.y + (Math.random() - 0.5) * p.radius,
            text: '⚡',
            type: 'lightning',
            age: 0,
            duration: 0.75
          });
          playSound('explosion'); // Planet took damage
        }
        if (!p.inFog && p.preferredResourceWantedEvent) {
          const emojis = {
            antimatter: '🌀',
            tritanium: '🔩',
            merculite: '☄️',
            dilithium: '💎',
            duranium: '🔲',
            deuterium: '💧',
            latinum: '🏺'
          };
          const emoji = emojis[p.preferredResource] || '💎';
          floatingAnimations.push({
            x: p.x,
            y: p.y - p.radius,
            text: `${p.name} wants ${emoji}!`,
            type: 'resource_wanted',
            age: 0,
            duration: 3.5
          });
        }
        if (!p.inFog && p.justAssigned && !lastPlanetAssignments[p.id]) {
          const owner = state.players.find(pl => pl.id === p.ownerId);
          const playerName = owner && owner.name ? owner.name : 'Unknown Player';
          floatingAnimations.push({
            x: p.x,
            y: p.y,
            text: `${playerName} enters the fray from ${p.name || 'Unknown'}!`,
            type: 'colonize',
            age: 0,
            duration: 3.0
          });
          playSound('trumpet');
          lastPlanetAssignments[p.id] = true;
        } else if (!p.justAssigned) {
          lastPlanetAssignments[p.id] = false;
        }
        if (p.rampageEvent && !lastPlanetRampages[p.id]) {
          lastPlanetRampages[p.id] = true;

          const pOwner = state.players ? state.players.find(pl => pl.id === p.ownerId) : null;
          if (pOwner && pOwner.isAI) {
            if (!megalovaniaPlayed) {
              megalovaniaPlayed = true;
              const musicCheckbox = document.getElementById('music-checkbox');
              const bgMusic = document.getElementById('bg-music');
              if (musicCheckbox && musicCheckbox.checked && bgMusic) {
                bgMusic.src = '/Music/Megalovania.mp3';
                bgMusic.loop = false;
                bgMusic.volume = 0.5;
                bgMusic.play().catch(e => console.warn('Megalovania play blocked:', e));
              }
            }
          }

          if (!p.inFog) {
            floatingAnimations.push({
              x: p.x,
              y: p.y,
              text: 'RAMPAGE!!!',
              type: 'rampage',
              age: 0,
              duration: 4.0
            });
            playSound('rampage');
          }
        } else if (!p.rampageEvent) {
          lastPlanetRampages[p.id] = false;
        }
        if (p.rampageIncubating && !lastPlanetIncubations[p.id]) {
          lastPlanetIncubations[p.id] = true;
          if (!p.inFog) {
            floatingAnimations.push({
              x: p.x,
              y: p.y,
              text: 'OUTBREAK DETECTED!',
              type: 'outbreak',
              age: 0,
              duration: 4.0
            });
            playSound('trumpet');
          }
        } else if (!p.rampageIncubating) {
          lastPlanetIncubations[p.id] = false;
        }
        if (p.defeatEvent) {
          floatingAnimations.push({
            x: p.x,
            y: p.y - 20,
            text: `${p.defeatEvent.name} DEFEATED!`,
            type: 'defeat',
            color: p.defeatEvent.color,
            age: 0,
            duration: 5.0
          });
          playSound('explosion');
        }
        if (!p.inFog && p.revoltAttemptEvent && !lastPlanetRevoltAttempts[p.id]) {
          lastPlanetRevoltAttempts[p.id] = true;
          floatingAnimations.push({
            x: p.x,
            y: p.y - 30,
            text: `✊ ${p.name} is in revolt! ✊`,
            type: 'revolt',
            age: 0,
            duration: 4.0
          });
          playBattleSound();
        } else if (!p.revoltAttemptEvent) {
          lastPlanetRevoltAttempts[p.id] = false;
        }
        if (!p.inFog && p.lastStandEvent && !lastPlanetStands[p.id]) {
          const pOwner = state.players.find(pl => pl.id === p.ownerId);
          if (pOwner) {
            floatingAnimations.push({
              x: p.x,
              y: p.y + p.radius + 24,
              text: `${(pOwner.name || pOwner.id).toUpperCase()}'s LAsT sTAND!`,
              type: 'lastStand',
              color: pOwner.color,
              age: 0,
              duration: 3.0
            });
            lastPlanetStands[p.id] = true;
            planetShields[p.id] = 1.5;
          }
        } else if (!p.lastStandEvent) {
          lastPlanetStands[p.id] = false;
        }
        if (p.spyRootedOutEvent && !lastPlanetSpyRooted[p.id]) {
          floatingAnimations.push({
            x: p.x,
            y: p.y,
            text: '\uD83D\uDC41\uFE0F',
            type: 'spyRooted',
            color: '#aaa',
            age: 0,
            duration: 4.0
          });
          lastPlanetSpyRooted[p.id] = true;
        } else if (!p.spyRootedOutEvent) {
          lastPlanetSpyRooted[p.id] = false;
        }

        if (!p.inFog && p.homeworldEvent && !lastPlanetHomeworlds[p.id]) {
          const hwOwner = state.players.find(pl => pl.id === p.homeworldOf);
          if (hwOwner) {
            floatingAnimations.push({
              x: p.x,
              y: p.y - p.radius - 36,
              text: `${(hwOwner.name || hwOwner.id).toUpperCase()}'s HOME WORLD!`,
              type: 'homeworldAnim',
              color: hwOwner.color,
              age: 0,
              duration: 3.0
            });
            lastPlanetHomeworlds[p.id] = true;
            if (p.ownerId === p.homeworldOf) {
              planetShields[p.id] = 1.5;
            }
          }
        } else if (!p.homeworldEvent) {
          lastPlanetHomeworlds[p.id] = false;
        }
        lastPlanetCapacities[p.id] = p.maxShips;
      }
    } else {
      for (const p of state.planets) {
        lastPlanetCapacities[p.id] = p.maxShips;
      }
    }

    if (state.planets) {
      for (const p of state.planets) {
        if (!p.inFog || p.permanentlyTracked) {
          lastKnownPlanets[p.id] = { ...p };
        }
      }
    }

    if (state.ships) {
      for (const s of state.ships) {
        if (s.resourceConsumeEvents) {
          const emojis = {
            deuterium: '💧',
            tritanium: '🔩',
            duranium: '🔲',
            merculite: '☄️',
            antimatter: '🌀',
            dilithium: '💎'
          };
          for (const [res, count] of Object.entries(s.resourceConsumeEvents)) {
            if (count > 0 && emojis[res]) {
              for (let b = 0; b < count; b++) {
                floatingAnimations.push({
                  x: s.x + (Math.random() - 0.5) * 12,
                  y: s.y - 12 - b * 5,
                  text: emojis[res],
                  type: 'resource_consume',
                  age: b * 0.1,
                  duration: 2.0
                });
              }
            }
          }
        }
        if (s.diplomatPrefResourceEvent && s.diplomatPrefResourceEvent > 0) {
          let targetX = s.x;
          let targetY = s.y;
          let prefEmoji = '💎';
          if (s.diplomatTargetPlanetId !== null && state.planets) {
            const targetP = state.planets.find(p => p.id === s.diplomatTargetPlanetId);
            if (targetP) {
              targetX = targetP.x;
              targetY = targetP.y;
              if (targetP.preferredResource) {
                const emojis = {
                  dilithium: '💎',
                  merculite: '☄️',
                  duranium: '🔲',
                  tritanium: '🔩',
                  antimatter: '🌀',
                  deuterium: '💧',
                  latinum: '🏺'
                };
                prefEmoji = emojis[targetP.preferredResource] || '💎';
              }
            }
          }
          for (let b = 0; b < s.diplomatPrefResourceEvent; b++) {
            floatingAnimations.push({
              startX: s.x,
              startY: s.y,
              endX: targetX,
              endY: targetY,
              x: s.x,
              y: s.y,
              text: prefEmoji,
              type: 'pref_resource_diplomacy',
              age: b * 0.2,
              duration: 2.5
            });
          }
        }
        if (s.beakerIncreaseEvent && s.beakerIncreaseEvent > 0) {
          for (let b = 0; b < s.beakerIncreaseEvent; b++) {
            floatingAnimations.push({
              x: s.x,
              y: s.y - 12,
              text: '🧪',
              type: 'beaker',
              age: b * 0.2,
              duration: 2.5
            });
          }
        }
        if (s.creditsGainedEvent && s.creditsGainedEvent > 0) {
          floatingAnimations.push({
            x: s.x,
            y: s.y - 12,
            text: `$$$ +${s.creditsGainedEvent}`,
            type: 'dollar',
            age: 0,
            duration: 2.0
          });
        }
        if (s.diplomatSuccessEvent && s.diplomatSuccessEvent > 0) {
          let targetX = s.x;
          let targetY = s.y - 12;
          if (s.diplomatTargetPlanetId !== null && state.planets) {
            const targetP = state.planets.find(p => p.id === s.diplomatTargetPlanetId);
            if (targetP) {
              targetX = targetP.x;
              targetY = targetP.y;
            }
          }
          for (let b = 0; b < s.diplomatSuccessEvent; b++) {
            floatingAnimations.push({
              startX: targetX,
              startY: targetY,
              endX: s.x,
              endY: s.y,
              x: targetX,
              y: targetY,
              shipId: s.id,
              text: '💖',
              type: 'diplomacy_success',
              age: b * 0.15,
              duration: 2.2 + Math.random() * 0.6,
              driftX: (Math.random() - 0.5) * 30,
              driftYMult: 0.8 + Math.random() * 0.6,
              scatterX: (Math.random() - 0.5) * 20
            });
          }
        }
        if (s.diplomatFailureEvent && s.diplomatFailureEvent > 0) {
          let targetX = s.x;
          let targetY = s.y - 12;
          if (s.diplomatTargetPlanetId !== null && state.planets) {
            const targetP = state.planets.find(p => p.id === s.diplomatTargetPlanetId);
            if (targetP) {
              targetX = targetP.x;
              targetY = targetP.y;
            }
          }
          for (let b = 0; b < s.diplomatFailureEvent; b++) {
            floatingAnimations.push({
              x: targetX,
              y: targetY,
              text: '💔' + (s.diplomatFailureChance ? ` ${s.diplomatFailureChance}%` : ''),
              type: 'diplomacy_failure',
              age: b * 0.2,
              duration: 7.5
            });
          }
        }
      }
    }

    if (state.flatShips) {
      const flat = state.flatShips;
      const len = flat.length;
      state.ships = state.ships || [];
      for (let i = 0; i < len; i += 19) {
        const owner = state.players[flat[i + 4]];
        const isMarine = flat[i + 17] === 1;
        state.ships.push({
          id: flat[i],
          x: flat[i + 1],
          y: flat[i + 2],
          count: flat[i + 3],
          ownerId: owner ? owner.id : null,
          active: flat[i + 5] === 1,
          isBomber: flat[i + 6] === 1,
          isInterceptor: flat[i + 7] === 1,
          isBoardingFleet: flat[i + 8] === 1,
          isReturnPod: flat[i + 9] === 1,
          angle: flat[i + 10],
          targetX: flat[i + 11],
          targetY: flat[i + 12],
          health: flat[i + 13],
          expScore: flat[i + 14],
          flightTime: flat[i + 15],
          currentSpeed: flat[i + 16],
          isMarineFleet: isMarine,
          commandPoints: flat[i + 18] || 0,
          speed: isMarine ? 35 : 15,
          formation: 'arrow',
          isCruiser: false,
          isAmoeba: false
        });
      }
    }

    if (serverState && state.ships && localPlayer) {
      const oldShipIds = new Set(serverState.ships.map(s => s.id));
      const newlyBuiltCruiser = state.ships.find(s => s.isCruiser && s.ownerId === localPlayer.id && !oldShipIds.has(s.id));
      if (newlyBuiltCruiser) {
        selectedShips = [newlyBuiltCruiser];
        selectedPlanets = [];
      }
    }

    serverState = state;

    if (state.ships) {
      selectedShips = selectedShips.map(sel => state.ships.find(s => s.id === sel.id)).filter(Boolean);
    }
    if (state.planets) {
      selectedPlanets = selectedPlanets.map(sel => state.planets.find(p => p.id === sel.id)).filter(Boolean);
    }

    if (state.upgradeEnhanceEvents && state.upgradeEnhanceEvents.length > 0) {
      for (const ev of state.upgradeEnhanceEvents) {
        floatingAnimations.push({
          x: ev.x,
          y: ev.y,
          text: ev.text,
          type: 'enhance',
          age: 0,
          duration: 3.5,
          color: ev.color || '#fff'
        });
      }
    }

    if (state.accuracyEvents && state.accuracyEvents.length > 0) {
      for (const ev of state.accuracyEvents) {
        let text = `🎯${ev.accuracy}%`;
        if (ev.isBombAttack) {
          const outcome = ev.hit ? 'Hit!' : 'Miss!';
          text = `🎯 ${outcome} (${ev.accuracy}%)`;
        }
        floatingAnimations.push({
          x: ev.x,
          y: ev.y,
          text: text,
          type: 'accuracyIndicator',
          age: 0,
          duration: 3.0,
          attackerOwnerId: ev.attackerOwnerId,
          targetOwnerId: ev.targetOwnerId,
          isBombAttack: ev.isBombAttack
        });
      }
    }

    if (state.explosions) {
      let playNormalExplosion = false;
      let playThud = false;
      const currentExplosionKeys = new Set();
      if (!window.playedExplosionKeys) {
        window.playedExplosionKeys = new Set();
      }

      for (const e of state.explosions) {
        const key = `${e.x.toFixed(1)},${e.y.toFixed(1)},${e.color || ''}`;
        currentExplosionKeys.add(key);

        if (!window.playedExplosionKeys.has(key)) {
          if (e.age <= 0.15) {
            if (e.color === 'amoeba-shrug') {
              playThud = true;
            } else {
              playNormalExplosion = true;
            }
          }
        }
      }
      window.playedExplosionKeys = currentExplosionKeys;

      if (playThud) {
        playThudSound();
      }
      if (playNormalExplosion) {
        playSound('explosion');
      }
    }
    lastExplosionCount = state.explosions ? state.explosions.length : 0;

    if (state.lasers && state.lasers.length > 0) {
      const delay = window.nextLaserDelay || 400;
      if (!window.lastLaserSoundTime || Date.now() - window.lastLaserSoundTime > delay) {
        playSound('laser');
        window.lastLaserSoundTime = Date.now();
        window.nextLaserDelay = 200 + Math.random() * 400;
      }
    }

    if (state.isRunning) {
      if (!endScreen.classList.contains('hidden')) {
        endScreen.classList.add('hidden');
      }
      if (startScreen.classList.contains('hidden') && gameUI.classList.contains('hidden')) {
        gameUI.classList.remove('hidden');
      }
      if (scoreBoard && scoreBoard.parentNode !== gameUI) {
        const chatContainer = document.getElementById('chat-container');
        gameUI.insertBefore(scoreBoard, chatContainer);
      }
    }

    // Clean up obsolete ship keys from visualShips cache
    const currentShipIds = new Set(state.ships ? state.ships.map(s => s.id) : []);
    if (state.flatShips) {
      const flat = state.flatShips;
      const len = flat.length;
      for (let i = 0; i < len; i += 19) {
        currentShipIds.add(flat[i]);
      }
    }
    for (const id of visualShips.keys()) {
      if (!currentShipIds.has(id)) {
        visualShips.delete(id);
      }
    }

    updateUI();
  });

  function formatTime(seconds) {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return "00:00";
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }

  function updateUI() {
    if (!serverState || !localPlayer) return;
    updateBuildButtonCanvases();

    const gameTimer = document.getElementById('game-timer');
    const gameSpeedDisplay = document.getElementById('game-speed-display');
    if (gameTimer) {
      gameTimer.style.display = 'block';
      if (serverState.settings && serverState.settings.timedGameLimit && serverState.settings.timedGameLimit !== 'unlimited') {
        gameTimer.textContent = formatTime(serverState.timeRemaining);
      } else {
        gameTimer.textContent = formatTime(serverState.elapsedTime || 0);
      }
    }
    if (gameSpeedDisplay) {
      gameSpeedDisplay.style.display = 'block';
      const speedPct = Math.round((serverState.gameSpeed || 1.0) * 100);
      gameSpeedDisplay.textContent = `Speed: ${speedPct}%`;
    }

    const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
    if (!myPlayer) return;

    const creditsDisplay = document.getElementById('player-credits-display');
    if (creditsDisplay) {
      const creditsVal = myPlayer.credits || 0;

      const interestRatePerMin = creditsVal < 0 ? (creditsVal * 0.01) : (creditsVal * 0.005);
      const stockpileMaintenanceRatePerMin = myPlayer.storageFeeRate || 0;
      const fleetCostRatePerMin = myPlayer.fleetCostRate || 0;
      let totalTradeRatePerMin = 0;
      let rowsHtml = "";
      if (myPlayer.tradingPartners && myPlayer.tradingPartners.length > 0) {
        for (const partner of myPlayer.tradingPartners) {
          const partnerName = partner.name;
          const ratePerMin = partner.rate * 60;
          let partnerColor = '#ffffff';
          if (partnerName === 'Domestic Ships') {
            partnerColor = myPlayer.color || '#00e5ff';
          } else if (partnerName === 'Neutral') {
            partnerColor = '#ffffff';
          } else {
            const partnerPlayer = serverState.players.find(p => p.name === partnerName);
            if (partnerPlayer && partnerPlayer.color) {
              partnerColor = partnerPlayer.color;
            }
          }
          rowsHtml += `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: ${partnerColor};">
              <td style="padding: 6px 0; color: ${partnerColor}; text-align: left;">${partnerName}</td>
              <td style="padding: 6px 0; text-align: center; color: ${partnerColor};">${Math.floor(partner.ships)}</td>
              <td style="padding: 6px 0; text-align: right; color: ${partnerColor}; font-weight: bold;">+${ratePerMin.toFixed(2)}/m</td>
            </tr>
          `;
          totalTradeRatePerMin += ratePerMin;
        }
      } else {
        rowsHtml = `
          <tr style="color: #88a; font-style: italic;">
            <td colspan="3" style="padding: 10px 0; text-align: center;">
              No active trading lines<br>
              <span style="font-size: 0.7rem; color: #668; font-style: normal;">(Requires visible friendly/neutral planets & own ships)</span>
            </td>
          </tr>
        `;
      }

      const pirateActivityRatePerMin = (myPlayer.pirateActivity || 0) / 25;
      const pirateIncomeRatePerMin = (myPlayer.pirateIncome || 0) / 25;
      const netIncome = totalTradeRatePerMin - stockpileMaintenanceRatePerMin - fleetCostRatePerMin + interestRatePerMin - pirateActivityRatePerMin + pirateIncomeRatePerMin;
      const incomeInt = Math.round(netIncome);

      // Render custom tooltip panel HTML (Task 101 Overhaul)
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel && tooltipPanel.style.display === 'block' && tooltipPanel.dataset.source === 'credits') {
        let interestColor = '#aaa';
        let interestText = '0.00';
        if (interestRatePerMin > 0) {
          interestColor = '#4caf50';
          interestText = `+${interestRatePerMin.toFixed(2)}`;
        } else if (interestRatePerMin < 0) {
          interestColor = '#ff3333';
          interestText = `${interestRatePerMin.toFixed(2)}`;
        }

        let limitHtml = "";
        const ownsHw = serverState.planets.some(p => p.homeworldOf === localPlayer.id && p.ownerId === localPlayer.id);
        if (ownsHw) {
          const limitVal = 1000 + Math.floor(myPlayer.totalShips || 0);
          limitHtml = `
            <div style="font-size: 0.75rem; color: #ff3333; margin-top: 8px; text-align: center; border-top: 1px dashed rgba(255, 51, 51, 0.2); padding-top: 6px; font-family: 'Rajdhani', sans-serif;">
              Debt Limit: -${limitVal} credits (1000 + total ships)<br>
              Debt incurs 1%/min interest.<br>
              <span style="color: #4caf50;">Positive balance earns 0.5%/min interest.</span>
            </div>
          `;
        } else {
          limitHtml = `
            <div style="font-size: 0.75rem; color: #88a; margin-top: 8px; text-align: center; border-top: 1px dashed rgba(255, 255, 255, 0.1); padding-top: 6px; font-family: 'Rajdhani', sans-serif;">
              Control your Homeworld to access negative credit financing.<br>
              <span style="color: #4caf50;">Positive balance earns 0.5%/min interest.</span>
            </div>
          `;
        }

        let totalIncomeColor = '#aaa';
        let totalIncomeText = '0.00';
        if (netIncome > 0) {
          totalIncomeColor = '#4caf50';
          totalIncomeText = `+${netIncome.toFixed(2)}`;
        } else if (netIncome < 0) {
          totalIncomeColor = '#ff3333';
          totalIncomeText = `${netIncome.toFixed(2)}`;
        }

        let stockpileRowHtml = "";
        if (stockpileMaintenanceRatePerMin > 0) {
          stockpileRowHtml = `
            <tr style="border-top: 1px dashed rgba(255, 255, 255, 0.15);">
              <td style="padding: 6px 0; color: #aaa; text-align: left;">Stockpile Maintenance</td>
              <td style="padding: 6px 0;"></td>
              <td style="padding: 6px 0; text-align: right; color: #ff3333; font-weight: bold;">-${stockpileMaintenanceRatePerMin.toFixed(2)}/m</td>
            </tr>
          `;
        }

        let fleetCostRowHtml = "";
        if (fleetCostRatePerMin > 0) {
          fleetCostRowHtml = `
            <tr style="border-top: 1px dashed rgba(255, 255, 255, 0.15);">
              <td style="padding: 6px 0; color: #aaa; text-align: left;">Fleet Costs</td>
              <td style="padding: 6px 0;"></td>
              <td style="padding: 6px 0; text-align: right; color: #ff3333; font-weight: bold;">-${fleetCostRatePerMin.toFixed(2)}/m</td>
            </tr>
          `;
        }

        let pirateActivityRowHtml = "";
        if (pirateActivityRatePerMin > 0) {
          pirateActivityRowHtml = `
            <tr style="border-top: 1px dashed rgba(255, 255, 255, 0.15);">
              <td style="padding: 6px 0; color: #ff3333; text-align: left;">Pirate Activity</td>
              <td style="padding: 6px 0; text-align: center; color: #ff3333;">${Math.round(myPlayer.pirateActivity)}</td>
              <td style="padding: 6px 0; text-align: right; color: #ff3333; font-weight: bold;">-${pirateActivityRatePerMin.toFixed(2)}/m</td>
            </tr>
          `;
        }

        let pirateIncomeRowHtml = "";
        if (pirateIncomeRatePerMin > 0) {
          pirateIncomeRowHtml = `
            <tr style="border-top: 1px dashed rgba(255, 255, 255, 0.15);">
              <td style="padding: 6px 0; color: #4caf50; text-align: left;">Pirate Income</td>
              <td style="padding: 6px 0; text-align: center; color: #4caf50;">${Math.round(myPlayer.pirateIncome)}</td>
              <td style="padding: 6px 0; text-align: right; color: #4caf50; font-weight: bold;">+${pirateIncomeRatePerMin.toFixed(2)}/m</td>
            </tr>
          `;
        }

        tooltipPanel.innerHTML = `
          <div style="font-weight: bold; font-size: 0.85rem; color: #ffeb3b; border-bottom: 1px solid rgba(255, 235, 59, 0.3); padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Income Summary</div>
          <table style="width: 100%; border-collapse: collapse; font-family: 'Rajdhani', sans-serif; font-size: 0.9rem;">
            <thead>
              <tr style="color: #0ff; font-family: 'Orbitron', sans-serif; font-size: 0.7rem; border-bottom: 1px dashed rgba(0, 229, 255, 0.2); text-align: left;">
                <th style="padding: 4px 0; text-align: left;">Category / Partner</th>
                <th style="padding: 4px 0; text-align: center;">Ships</th>
                <th style="padding: 4px 0; text-align: right;">Rate</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              ${stockpileRowHtml}
              ${fleetCostRowHtml}
              ${pirateActivityRowHtml}
              ${pirateIncomeRowHtml}
              <tr style="border-top: 1px dashed rgba(255, 255, 255, 0.15);">
                <td style="padding: 6px 0; color: #aaa; text-align: left;">Interest Accrual</td>
                <td style="padding: 6px 0;"></td>
                <td style="padding: 6px 0; text-align: right; color: ${interestColor}; font-weight: bold;">${interestText}/m</td>
              </tr>
              <tr style="border-top: 1px solid rgba(255, 235, 59, 0.3); font-weight: bold; font-size: 0.95rem;">
                <td style="padding: 6px 0; color: #ffeb3b; text-align: left;">Total Income</td>
                <td style="padding: 6px 0;"></td>
                <td style="padding: 6px 0; text-align: right; color: ${totalIncomeColor};">${totalIncomeText}/m</td>
              </tr>
            </tfoot>
          </table>
          <div style="font-size: 0.75rem; color: #88a; margin-top: 8px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 6px; font-family: 'Rajdhani', sans-serif;">
            Formula: (Trade Ships / 25) credits per minute
          </div>
          ${limitHtml}
        `;
      }

      creditsDisplay.style.display = 'block';
      const hasMoneyBags = myPlayer.otherEffectiveShips !== undefined && myPlayer.playerEffectiveShips !== undefined && myPlayer.otherEffectiveShips >= myPlayer.playerEffectiveShips && myPlayer.playerEffectiveShips > 0;
      creditsDisplay.innerHTML = `💲 ${Math.floor(creditsVal)}<span style="font-size: 33.33%; font-weight: normal; margin-left: 4px; opacity: 0.85;">${incomeInt >= 0 ? '+' : ''}${incomeInt}${hasMoneyBags ? '💰' : ''}</span>`;
      creditsDisplay.removeAttribute('title');

      if (creditsVal < 0) {
        creditsDisplay.style.color = '#ff3333';
        creditsDisplay.style.textShadow = '0 0 5px #ff3333';
        creditsDisplay.style.background = 'rgba(255, 51, 51, 0.15)';
        creditsDisplay.style.borderColor = '#ff3333';
        creditsDisplay.style.textDecoration = 'none';
      } else if (myPlayer.useCredits !== false) {
        creditsDisplay.style.color = '#ffeb3b';
        creditsDisplay.style.textShadow = '0 0 5px #ffeb3b';
        creditsDisplay.style.background = 'rgba(255, 235, 59, 0.15)';
        creditsDisplay.style.borderColor = '#ffeb3b';
        creditsDisplay.style.textDecoration = 'none';
      } else {
        creditsDisplay.style.color = '#888';
        creditsDisplay.style.textShadow = 'none';
        creditsDisplay.style.background = 'rgba(255, 255, 255, 0.05)';
        creditsDisplay.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        creditsDisplay.style.textDecoration = 'none';
      }
    }

    const commandLimitDisplay = document.getElementById('player-command-limit-display');
    if (commandLimitDisplay) {
      const commandCount = myPlayer.commandCount || 0;
      const commandLimit = myPlayer.commandLimit || 0;
      commandLimitDisplay.style.display = 'block';
      commandLimitDisplay.textContent = `⚓: ${commandCount}/${commandLimit}`;
    }

    const tradeOptionsDisplay = document.getElementById('player-trade-options-display');
    if (tradeOptionsDisplay) {
      const tradeOptions = myPlayer.tradeOptions !== undefined ? Math.floor(myPlayer.tradeOptions) : 5;
      const tradeCapacity = myPlayer.tradeCapacity !== undefined ? Math.floor(myPlayer.tradeCapacity) : 5;
      tradeOptionsDisplay.style.display = 'block';
      tradeOptionsDisplay.textContent = `⚖️: ${tradeOptions}/${tradeCapacity}`;
      
      if (myPlayer.tradeLimitToggle === true) {
        tradeOptionsDisplay.style.color = '#ff9800';
        tradeOptionsDisplay.style.textShadow = '0 0 5px #ff9800';
        tradeOptionsDisplay.style.background = 'rgba(255, 152, 0, 0.15)';
        tradeOptionsDisplay.style.borderColor = '#ff9800';
      } else {
        tradeOptionsDisplay.style.color = '#888';
        tradeOptionsDisplay.style.textShadow = 'none';
        tradeOptionsDisplay.style.background = 'rgba(255, 255, 255, 0.05)';
        tradeOptionsDisplay.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }
    }

    const stockpileCapacityDisplay = document.getElementById('player-stockpile-capacity-display');
    if (stockpileCapacityDisplay) {
      const resourcesListForStockpile = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      let totalStockpile = 0;
      if (myPlayer.resources) {
        for (const res of resourcesListForStockpile) {
          totalStockpile += (myPlayer.resources[res] || 0);
        }
      }
      const stockpileCapacity = myPlayer.stockpileCapacity || 1;
      stockpileCapacityDisplay.style.display = 'block';
      stockpileCapacityDisplay.textContent = `📦: ${Math.floor(totalStockpile)}/${stockpileCapacity}`;

      if (totalStockpile > stockpileCapacity) {
        stockpileCapacityDisplay.style.color = '#ff5252';
        stockpileCapacityDisplay.style.borderColor = 'rgba(255, 82, 82, 0.4)';
        stockpileCapacityDisplay.style.textShadow = '0 0 5px #ff5252';
        stockpileCapacityDisplay.style.background = 'rgba(255, 82, 82, 0.1)';
      } else {
        stockpileCapacityDisplay.style.color = '#00e676';
        stockpileCapacityDisplay.style.borderColor = 'rgba(0, 230, 118, 0.2)';
        stockpileCapacityDisplay.style.textShadow = '0 0 5px #00e676';
        stockpileCapacityDisplay.style.background = 'rgba(0, 230, 118, 0.05)';
      }
    }

    const sellForDisplay = document.getElementById('player-sell-for-display');
    if (sellForDisplay) {
      const sellPriceSetting = myPlayer.sellPriceSetting !== undefined ? myPlayer.sellPriceSetting : 1;
      sellForDisplay.style.display = 'block';
      sellForDisplay.textContent = `💰: ${sellPriceSetting}`;
    }



    const resHud = document.getElementById('resources-hud');
    if (resHud) {
      resHud.style.display = 'flex';
      
      const resourcesList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
      
      const wantedResources = new Set();
      if (serverState && serverState.planets && localPlayer) {
        for (const p of serverState.planets) {
          if (p.ownerId === localPlayer.id && p.preferredResource && p.maxShips >= 150) {
            wantedResources.add(p.preferredResource);
          }
        }
      }

      for (const res of resourcesList) {
        const qtySpan = document.getElementById(`res-qty-${res}`);
        const rawQty = myPlayer.resources?.[res] || 0;
        const qtyVal = rawQty > 5 ? Math.floor(rawQty).toString() : rawQty.toFixed(2);
        
        if (qtySpan) qtySpan.textContent = qtyVal;
        
        const card = document.getElementById(`res-card-${res}`);
        if (card) {
          let wantedIndicator = card.querySelector('.res-wanted-indicator');
          if (!wantedIndicator) {
            wantedIndicator = document.createElement('span');
            wantedIndicator.className = 'res-wanted-indicator';
            wantedIndicator.style.marginLeft = '6px';
            wantedIndicator.style.fontSize = '0.9rem';
            wantedIndicator.style.textShadow = '0 0 5px #ffd700';
            wantedIndicator.textContent = '⭐';
            const childSpan = card.querySelector('span');
            if (childSpan) {
              childSpan.appendChild(wantedIndicator);
            } else {
              card.appendChild(wantedIndicator);
            }
          }
          wantedIndicator.style.display = wantedResources.has(res) ? 'inline-block' : 'none';

          const rarity = serverState.resourceRarities?.[res] || 'normal';
          if (rarity === 'exotic') {
            card.style.borderColor = '#ff3333';
            card.style.boxShadow = '0 0 8px rgba(255, 51, 51, 0.4)';
            card.style.background = 'rgba(255, 51, 51, 0.15)';
            card.style.color = '#ff3333';
          } else if (rarity === 'rare') {
            card.style.borderColor = '#ffeb3b';
            card.style.boxShadow = '0 0 8px rgba(255, 235, 59, 0.4)';
            card.style.background = 'rgba(255, 235, 59, 0.15)';
            card.style.color = '#ffeb3b';
          } else if (rarity === 'common') {
            card.style.borderColor = '#4caf50';
            card.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.4)';
            card.style.background = 'rgba(76, 175, 80, 0.15)';
            card.style.color = '#4caf50';
          } else {
            card.style.borderColor = 'rgba(0, 229, 255, 0.35)';
            card.style.boxShadow = 'none';
            card.style.background = 'rgba(0, 229, 255, 0.05)';
            card.style.color = '#00e5ff';
          }
        }
      }
      
      // Uncapped surplus scan
      const eligible = [];
      for (const r of resourcesList) {
        if (r === 'latinum') {
          const qty = myPlayer.resources?.latinum || 0;
          const latinumSold = Math.min(4, Math.floor(qty));
          if (latinumSold >= 1) {
            eligible.push({ name: 'latinum', count: latinumSold });
          }
        } else {
          const qty = myPlayer.resources?.[r] || 0;
          if (qty >= 1.0) {
            eligible.push({ name: r, count: 1 });
          }
        }
      }
      
      const toSell = eligible;
      let L = 0;
      for (const item of eligible) {
        L += item.count;
      }
      
      const sellPrice = Math.ceil((L * L) / 2) + 2;
      let totalGain = sellPrice * L;
      const latinumItem = eligible.find(item => item.name === 'latinum');
      const latinumCount = latinumItem ? latinumItem.count : 0;
      if (latinumCount > 0) {
        totalGain = Math.round(totalGain * (1 + 0.25 * latinumCount));
      }
      
      const sellBtn = document.getElementById('btn-sell-resources');
      if (sellBtn) {
        const resourceEmojis = {
          antimatter: '🌀',
          tritanium: '🔩',
          merculite: '☄️',
          dilithium: '💎',
          duranium: '🔲',
          deuterium: '💧',
          latinum: '🏺'
        };
        
        if (L > 0) {
          const iconParts = [];
          for (const item of toSell) {
            const emoji = resourceEmojis[item.name] || '';
            for (let c = 0; c < item.count; c++) {
              iconParts.push(emoji);
            }
          }
          const iconStr = iconParts.join('');
          sellBtn.textContent = `${iconStr}: +${totalGain}`;
        } else {
          sellBtn.textContent = 'SELL: +0';
        }
        
        const availableOptions = myPlayer.tradeOptions !== undefined ? myPlayer.tradeOptions : 5;
        // Don't gray it out if the player has at least one trade option (availableOptions >= 1), only if they have none (< 1)
        if (L === 0 || availableOptions < 1) {
          sellBtn.disabled = true;
          sellBtn.style.opacity = '0.5';
          sellBtn.style.pointerEvents = 'none';
        } else {
          sellBtn.disabled = false;
          sellBtn.style.opacity = '1.0';
          sellBtn.style.pointerEvents = 'auto';
        }
        
        sellBtn.style.display = 'flex';
      }

      // Populate and render Sell Orders HUD
      const sellOrdersHud = document.getElementById('sell-orders-hud');
      if (sellOrdersHud) {
        const orders = serverState.sellOrders || [];
        const fulfillOrders = serverState.fulfillOrders || [];
        
        // Split auto buy orders from regular sell orders
        const autoBuyOrders = orders.filter(o => o.isAutoBuy);
        const regularOrders = orders.filter(o => !o.isAutoBuy);
        
        // Sort regular sell orders strictly from lowest price to highest
        regularOrders.sort((a, b) => a.price - b.price);
        
        // Group auto buy orders by price
        const autoBuyGroups = {};
        for (const order of autoBuyOrders) {
          if (!autoBuyGroups[order.price]) {
            autoBuyGroups[order.price] = [];
          }
          autoBuyGroups[order.price].push(order);
        }
        
        const groupedAutoBuyOrders = [];
        const allResList = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
        for (const price in autoBuyGroups) {
          const group = autoBuyGroups[price];
          group.sort((a, b) => a.resource.localeCompare(b.resource));
          const uniqueRes = new Set(group.map(o => o.resource));
          const isSimplified = allResList.every(r => uniqueRes.has(r));
          groupedAutoBuyOrders.push({
            isAutoBuy: true,
            isGrouped: true,
            isSimplified: isSimplified,
            price: parseInt(price, 10),
            orders: group,
            ownerId: group[0].ownerId
          });
        }
        
        const sortedFulfillOrders = [...fulfillOrders];
        sortedFulfillOrders.sort((a, b) => a.price - b.price);

        // Combine: Auto Buy Orders first, regular sell orders second, fulfill orders third
        const allOrders = [...groupedAutoBuyOrders, ...regularOrders, ...sortedFulfillOrders];
        
        sellOrdersHud.innerHTML = '';
        sellOrdersHud.style.display = 'flex';
        
        const resourceEmojis = {
          antimatter: '🌀',
          tritanium: '🔩',
          merculite: '☄️',
          dilithium: '💎',
          duranium: '🔲',
          deuterium: '💧',
          latinum: '🏺'
        };
        
        const myCredits = myPlayer.credits || 0;
        const myTradeOptions = myPlayer.tradeOptions !== undefined ? myPlayer.tradeOptions : 5;
        
        for (const order of allOrders) {
          const emoji = order.isAutoBuy ? '' : (resourceEmojis[order.resource] || '');
          const card = document.createElement('div');
          card.className = 'cyber-btn sell-order-card';
          card.style.display = 'flex';
          card.style.alignItems = 'center';
          card.style.justifyContent = 'center';
          card.style.padding = '3px 8px';
          card.style.borderRadius = '4px';
          card.style.cursor = 'pointer';
          card.style.fontSize = '0.75rem';
          card.style.fontFamily = "'Orbitron', sans-serif";
          card.style.fontWeight = 'bold';
          card.style.transition = 'all 0.2s';
          
          if (order.isAutoBuy) {
            // White styling for Auto Buy Order (only visible to owner, prepended to sellOrders by server)
            card.style.borderColor = 'rgba(255, 255, 255, 0.6)';
            card.style.background = 'rgba(255, 255, 255, 0.15)';
            card.style.color = '#ffffff';
            card.style.textShadow = '0 0 6px #ffffff';
            if (order.isSimplified) {
              card.title = `Auto Buy: All resources at <= ${order.price} credits - Click to Dismiss`;
              card.textContent = `∞: ${order.price}`;
            } else {
              const emojis = order.orders.map(o => resourceEmojis[o.resource] || '').join('');
              const resourceNames = order.orders.map(o => o.resource).join(', ');
              card.title = `Auto Buy: ${resourceNames} at <= ${order.price} credits - Click to Dismiss`;
              card.textContent = `${emojis}: ${order.price}`;
            }
          } else if (order.isFulfill) {
            const isMine = order.ownerId === localPlayer.id;
            if (isMine) {
              card.style.borderColor = 'rgba(76, 175, 80, 0.4)';
              card.style.background = 'rgba(76, 175, 80, 0.1)';
              card.style.color = '#4caf50';
              card.style.textShadow = '0 0 4px #4caf50';
              card.title = `Your Fulfill Order - Click to Cancel`;
            } else {
              card.style.borderColor = 'rgba(33, 150, 243, 0.4)';
              card.style.background = 'rgba(33, 150, 243, 0.1)';
              card.style.color = '#2196f3';
              card.style.textShadow = '0 0 4px #2196f3';
              card.title = `Fulfill Order: Click to sell 1 ${order.resource} for ${order.price} credits`;
              
              const hasResource = (myPlayer.resources[order.resource] || 0) >= 1.0;
              if (!hasResource) {
                card.style.opacity = '0.35';
                card.style.pointerEvents = 'none';
                card.style.cursor = 'not-allowed';
              }
            }
            // Display as [PRICE][RESOURCE]
            card.textContent = `${order.price}${emoji}`;
          } else {
            const isMine = order.ownerId === localPlayer.id;
            const timeRemainingMs = order.expiresAt - Date.now();
            
            if (isMine) {
              card.style.borderColor = 'rgba(76, 175, 80, 0.4)';
              card.style.background = 'rgba(76, 175, 80, 0.1)';
              card.style.color = '#4caf50';
              card.style.textShadow = '0 0 4px #4caf50';
              card.title = `Your Order - Click to Cancel (Refunds 1 ${order.resource})`;
            } else {
              if (timeRemainingMs > 0 && timeRemainingMs <= 60000) {
                card.style.borderColor = 'rgba(244, 67, 54, 0.4)';
                card.style.background = 'rgba(244, 67, 54, 0.1)';
                card.style.color = '#f44336';
                card.style.textShadow = '0 0 4px #f44336';
              } else {
                card.style.borderColor = 'rgba(33, 150, 243, 0.4)';
                card.style.background = 'rgba(33, 150, 243, 0.1)';
                card.style.color = '#2196f3';
                card.style.textShadow = '0 0 4px #2196f3';
              }
              card.title = `Owner: ${order.ownerName} - Click to Buy for ${order.price} credits (Costs 1 option)`;
            }
            
            card.textContent = `${emoji}: ${order.price}`;
            
            // Make order blink if it is within 30 seconds of expiring (Task 104)
            if (timeRemainingMs > 0 && timeRemainingMs <= 30000) {
              card.classList.add('blink-warning');
            }
            
            // Disable / gray out orders if optionless or creditless (except for own orders)
            if (!isMine) {
              const hasOptions = myTradeOptions >= 1;
              let minAllowedCredits = 0;
              const ownsHomeworld = serverState.planets.some(p => p.homeworldOf === localPlayer.id && p.ownerId === localPlayer.id);
              if (ownsHomeworld) {
                minAllowedCredits = -(1000 + Math.floor(myPlayer.totalShips || 0));
              }
              const hasCredits = (myCredits - minAllowedCredits) >= order.price;
              if (!hasOptions || !hasCredits) {
                card.style.opacity = '0.35';
                card.style.pointerEvents = 'none';
                card.style.cursor = 'not-allowed';
              }
            }
          }
          
          card.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (order.isAutoBuy) {
              for (const originalOrder of order.orders) {
                socket.emit('cancelAutoBuyOrder', { orderId: originalOrder.id });
              }
            } else if (order.isFulfill) {
              if (!e.ctrlKey) {
                socket.emit('clickFulfillOrder', { orderId: order.id });
              }
            } else if (!e.ctrlKey) {
              const isMine = order.ownerId === localPlayer.id;
              if (isMine) {
                socket.emit('cancelSellOrder', { orderId: order.id });
              } else {
                socket.emit('buySellOrder', { orderId: order.id });
              }
            }
          });
          
          sellOrdersHud.appendChild(card);
        }
      }
    }

    const pCount = myPlayer.planetCount || 0;
    const totalEconomy = myPlayer.totalCapacity || 0;
    const remainingPlanets = 42 - pCount;
    const techScore = myPlayer.techScore || 0;
    const techBonus = (Math.sqrt(techScore)).toFixed(1);
    const expScore = myPlayer.expScore || 0;
    const expBonus = (Math.sqrt(expScore)).toFixed(1);

    if (leaderboardContent) {
      let galacticCapacity = serverState.galacticCapacity || 1;

      const getVictoryScore = (p) => {
        const capacity = p.totalCapacity || 0;
        const capacityPercent = galacticCapacity > 0 ? Math.round((capacity / galacticCapacity) * 100) : 0;
        const pTech = Math.floor(Math.sqrt(p.techScore || 0));
        const pExp = Math.floor(Math.sqrt(p.expScore || 0));
        return pTech + pExp + capacityPercent;
      };

      const alivePlayers = serverState.players.filter(p => p.isAlive || p.id === localPlayer.id || (serverState.ships && serverState.ships.some(s => s.active && s.ownerId === p.id)));
      alivePlayers.sort((a, b) => getVictoryScore(b) - getVictoryScore(a));

      const techSorted = [...alivePlayers].sort((a, b) => (b.techScore || 0) - (a.techScore || 0));
      const techLead = techSorted.length > 1 ? ((techSorted[0].techScore || 0) - (techSorted[1].techScore || 0)) : (techSorted[0] ? (techSorted[0].techScore || 0) : 0);
      const techLeadingId = techLead >= 200 ? techSorted[0].id : null;

      const capSorted = [...alivePlayers].sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));
      const capLeadingId = capSorted.length > 1 && (capSorted[0].totalCapacity || 0) > 2 * (capSorted[1].totalCapacity || 0) ? capSorted[0].id : (capSorted.length === 1 && (capSorted[0].totalCapacity || 0) > 0 ? capSorted[0].id : null);

      // Determine bullseye targets: capacity > 4500, OR tech lead >= 200, OR 2x capacity over 2nd
      const bullseyeIds = new Set();
      if (techLeadingId) bullseyeIds.add(techLeadingId);
      if (capLeadingId) bullseyeIds.add(capLeadingId);
      alivePlayers.forEach(p => {
        if ((p.totalCapacity || 0) > 4500) bullseyeIds.add(p.id);
      });

      let html = '';
      alivePlayers.forEach(p => {
        const capacity = p.totalCapacity || 0;
        const capacityPercent = galacticCapacity > 0 ? Math.round((capacity / galacticCapacity) * 100) : 0;
        const pTech = Math.floor(Math.sqrt(p.techScore || 0));
        const pExp = Math.floor(Math.sqrt(p.expScore || 0));
        const victoryScore = pTech + pExp + capacityPercent;
        const blinkClass = (p.id === techLeadingId || p.id === capLeadingId) ? ' leader-row' : '';
        const bullseye = bullseyeIds.has(p.id) ? '<span style="color: #f00; text-shadow: 0 0 5px #f00; margin-left: 2px;" title="Target!">🎯</span>' : '';

        // Check if local player is at war with player p
        const isAtWar = !!(myPlayer.atWarWith && myPlayer.atWarWith[p.id] && Date.now() < myPlayer.atWarWith[p.id]);
        const warIcon = isAtWar ? '<span style="margin-right: 3px;" title="At War!">⚔️</span>' : '';

        html += `
            <div class="${blinkClass}" style="display: flex; justify-content: space-between; font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; gap: 5px; color: ${p.color}; text-shadow: 0 0 5px ${p.color};">
              <span style="width: 75px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${warIcon}${p.name}${bullseye}</span>
              <span style="width: 50px; text-align: center;">+${pTech}%</span>
              <span style="width: 45px; text-align: center;">+${pExp}%</span>
              <span style="width: 45px; text-align: right;">${capacityPercent}%</span>
              <span style="width: 55px; text-align: right; font-weight: bold;">${victoryScore}</span>
            </div>
          `;
      });
      leaderboardContent.innerHTML = html;
    }

    if (!serverState.isRunning && gameUI.classList.contains('hidden') === false) {
      gameUI.classList.add('hidden');
      endScreen.classList.remove('hidden');
      endTitle.innerHTML = (serverState.gameOverMessage || 'GAME OVER').replace(/\n/g, '<br>');
      if (pCount > 0) {
        endTitle.style.color = '#0ff';
        endTitle.style.textShadow = '0 0 10px #0ff, 0 0 20px #0ff';
      } else {
        endTitle.style.color = '#f0f';
        endTitle.style.textShadow = '0 0 10px #f0f, 0 0 20px #f0f';
      }
      if (scoreBoard) {
        endScreen.appendChild(scoreBoard);
        scoreBoard.classList.remove('hidden');
      }
    }
  }

  function getPlanetAt(x, y) {
    if (!serverState) return null;
    const pos = getMouseServerPos(x, y);

    let bestPlanet = null;
    let bestSurfaceDist = Infinity;
    for (const planet of serverState.planets) {
      if (planet.isDeepSpaceAnomaly) continue;
      const dx = planet.x - pos.x;
      const dy = planet.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = planet.radius;

      if (dist <= hitRadius) {
        const surfaceDist = dist - planet.radius;
        if (surfaceDist < bestSurfaceDist) {
          bestSurfaceDist = surfaceDist;
          bestPlanet = planet;
        }
      }
    }
    return bestPlanet;
  }

  const hazardSensorReductionPct = (x, y, ownerId) => {
    let penaltyPct = 0;
    if (!serverState || !serverState.storms) return 1;
    for (const h of serverState.storms) {
      if (h.type === 'minefield') continue;
      const hdx = x - h.x, hdy = y - h.y;
      if (hdx * hdx + hdy * hdy <= h.radius * h.radius) {
        const owner = serverState.players.find(p => p.id === ownerId);
        const k = h.knowledge || 0;
        const tR = owner ? Math.sqrt(owner.techScore || 0) : 0;
        const eR = owner ? Math.sqrt(owner.expScore || 0) : 0;
        const eff = Math.max(0, h.intensity - k - (tR + eR) / 2);
        penaltyPct += eff / 100;
      }
    }
    return Math.max(0, 1 - penaltyPct);
  };

  function getSelectedCruiser() {
    if (!serverState || !localPlayer) return null;
    if (selectedShips.length !== 1) return null;
    const ship = serverState.ships.find(s => s.id === selectedShips[0].id);
    if (!ship || !ship.isCruiser || ship.ownerId !== localPlayer.id) return null;
    return ship;
  }

  function isCruiserInFriendlyGravityWell(s) {
    if (!serverState || !localPlayer || !s) return false;
    if (!serverState.planets) return false;
    for (const planet of serverState.planets) {
      if (planet.ownerId !== localPlayer.id) continue;
      const pOwner = serverState.players.find(pl => pl.id === planet.ownerId);
      if (!pOwner) continue;
      const tb = 0.01 * Math.sqrt(pOwner.techScore || 0);
      const eb = 0.01 * Math.sqrt(pOwner.expScore || 0);
      let baseRadius = planet.maxShips * 1.5;
      if (planet.isMilitary && planet.ships >= planet.maxShips) {
        baseRadius *= 1.5;
      }
      const isPlanetHuman = pOwner && !pOwner.isAI;
      if (isPlanetHuman && planet.focusMode === 'garrison' && planet.ships >= planet.maxShips) {
        baseRadius += (planet.ships / 2);
      }
      const gr = baseRadius * (1 + tb + eb);
      const pdx = s.x - planet.x, pdy = s.y - planet.y;
      if (pdx * pdx + pdy * pdy <= gr * gr) {
        return true;
      }
    }
    return false;
  }

  function getSelectedCruisers() {
    if (!serverState || !localPlayer || selectedShips.length === 0) return [];
    const cruisers = [];
    for (const sel of selectedShips) {
      const ship = serverState.ships.find(s => s.id === sel.id);
      if (ship && ship.isCruiser && ship.ownerId === localPlayer.id) {
        cruisers.push(ship);
      }
    }
    return cruisers;
  }

  function getUpgradeCostForShip(ship, type) {
    if (!serverState) return 0;
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
    
    const globalMod = (serverState.globalUpgradeModifiers && serverState.globalUpgradeModifiers[normType] !== undefined)
      ? Math.max(-0.35, serverState.globalUpgradeModifiers[normType])
      : -0.25;
      
    let playerMod = 0.0;
    const playerObj = serverState.players ? serverState.players.find(p => p.id === ship.ownerId) : null;
    if (playerObj && playerObj.upgradeModifiers && playerObj.upgradeModifiers[normType] !== undefined) {
      playerMod = playerObj.upgradeModifiers[normType];
    }
    
    const modifier = Math.max(-0.50, globalMod + playerMod);
    return Math.max(1, Math.round(baseCost * (1 + modifier)));
  }

  let pendingShipConfig = null;

  function getConfigurationUpgradeCost(classType, upgrades, myPlayer) {
    if (!serverState) return 0;
    const baseCfg = SHIP_CLASSES[classType];
    if (!baseCfg) return 0;
    const hp = baseCfg.hp;

    const upgradeProps = [
      'sensorarrays', 'labs', 'armor', 'shields', 'engine', 
      'munitions', 'targeting', 'damagecontrol', 'fuel_tanker', 
      'diplomat', 'marines', 'command'
    ];
    let totalUpgradeCost = 0;
    const levels = {};
    let totalUpgradesCount = 0;
    for (const prop of upgradeProps) {
      levels[prop] = upgrades ? (parseInt(upgrades[prop], 10) || 0) : 0;
      totalUpgradesCount += levels[prop];
    }

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
      const baseCost = Math.min(150, Math.round(25 + hp * (3 + prevSum / 3)));

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
        command: 'command'
      };
      const normType = typeKeyMap[foundProp] || foundProp;
      const globalMod = (serverState.globalUpgradeModifiers && serverState.globalUpgradeModifiers[normType] !== undefined)
        ? Math.max(-0.35, serverState.globalUpgradeModifiers[normType])
        : -0.25;
      let playerMod = 0;
      if (myPlayer && myPlayer.upgradeModifiers && myPlayer.upgradeModifiers[normType] !== undefined) {
        playerMod = myPlayer.upgradeModifiers[normType];
      }
      const modifier = Math.max(-0.50, globalMod + playerMod);
      const finalCostVal = Math.max(1, Math.round(baseCost * (1 + modifier)));
      totalUpgradeCost += finalCostVal;

      simulatedLevels[foundProp]--;
      simulatedTotalUpgrades++;
      totalUpgradesCount--;
    }

    return totalUpgradeCost;
  }

  function getCreditsAvailableForConfig(myPlayer) {
    let minAllowedCredits = 0;
    if (serverState && serverState.planets && myPlayer) {
      const ownsHomeworld = serverState.planets.some(p => p.homeworldOf === myPlayer.id && p.ownerId === myPlayer.id);
      if (ownsHomeworld) {
        minAllowedCredits = -(1000 + Math.floor(myPlayer.totalShips || 0));
      }
    }
    return (myPlayer && myPlayer.useCredits !== false) ? ((myPlayer.credits || 0) - minAllowedCredits) : 0;
  }

  function getUpgradeIconsHtml(upgrades) {
    if (!upgrades) return '';
    const emojiMap = {
      sensorarrays: '📡',
      labs: '🔬',
      armor: '🛡️',
      shields: '🌀',
      engine: '🚀',
      munitions: '💣',
      targeting: '🎯',
      damagecontrol: '🔧',
      fuel_tanker: '⛽',
      diplomat: '🤝',
      marines: '🪖',
      command: '👑'
    };
    
    let html = '';
    for (const [key, val] of Object.entries(upgrades)) {
      const level = parseInt(val, 10) || 0;
      if (level > 0) {
        const emoji = emojiMap[key] || '⭐';
        if (level > 1) {
          html += `<span class="upgrade-icon-item" title="${key}: Level ${level}">${emoji}<sub style="font-size: 0.55rem; bottom: -0.2em; left: -0.1em; font-weight: bold; text-shadow: 1px 1px 1px #000;">${level}</sub></span>`;
        } else {
          html += `<span class="upgrade-icon-item" title="${key}: Level ${level}">${emoji}</span>`;
        }
      }
    }
    return html;
  }

  function updateConfigBuildButtons(myPlayer, selectedPlanetBuild) {
    const container = document.getElementById('config-build-buttons');
    if (!container) return;

    if (!cruiserBuildModeActive || !selectedPlanetBuild || !activeConfigClassType) {
      container.style.display = 'none';
      container.innerHTML = '';
      container.removeAttribute('data-class-type');
      return;
    }

    const savedConfigs = JSON.parse(localStorage.getItem('planetwars_ship_configs') || '[]');
    const activeConfigs = savedConfigs
      .map((cfg, originalIdx) => ({ ...cfg, originalIdx }))
      .filter(cfg => cfg.classType === activeConfigClassType);

    if (activeConfigs.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      container.removeAttribute('data-class-type');
      return;
    }

    const existingButtons = container.querySelectorAll('.config-build-btn');
    const containerClassType = container.getAttribute('data-class-type');
    if (existingButtons.length !== activeConfigs.length || containerClassType !== activeConfigClassType) {
      container.setAttribute('data-class-type', activeConfigClassType);
      let html = '';
      for (let i = 0; i < activeConfigs.length; i++) {
        const cfg = activeConfigs[i];
        const baseCfg = SHIP_CLASSES[cfg.classType];
        if (!baseCfg) continue;

        const iconsHtml = getUpgradeIconsHtml(cfg.upgrades);

        html += `
          <button class="cyber-btn action-btn-icon cruiser-build-btn config-build-btn" 
                  data-index="${cfg.originalIdx}" style="position: relative !important;">
            <span class="btn-icon"></span>
            <span class="btn-name">${cfg.name}</span>
            <span class="btn-cost"></span>
            <div class="config-upgrade-icons" style="position: absolute; bottom: 4px; left: 6px; display: flex; gap: 4px; font-size: 0.75rem; pointer-events: none; line-height: 1;">
              ${iconsHtml}
            </div>
          </button>
        `;
      }
      container.innerHTML = html;

      const buttons = container.querySelectorAll('.config-build-btn');
      for (const btn of buttons) {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const config = savedConfigs[idx];

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (selectedPlanetBuild) {
            socket.emit('buildCapitalShipConfig', {
              planetId: selectedPlanetBuild.id,
              classType: config.classType,
              upgrades: config.upgrades,
              configName: config.name
            });
            activeConfigClassType = null;
          }
        });

        let pressTimer = null;
        const startPress = (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          pressTimer = setTimeout(() => {
            deleteConfig(idx);
          }, 500);
        };
        const endPress = () => {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        };

        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('touchstart', startPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('touchend', endPress);
        btn.addEventListener('mouseleave', endPress);
        btn.addEventListener('touchcancel', endPress);

        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          deleteConfig(idx);
        });
      }
    }

    const buttons = container.querySelectorAll('.config-build-btn');
    for (const btn of buttons) {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const cfg = savedConfigs[idx];
      if (!cfg) continue;
      const baseCfg = SHIP_CLASSES[cfg.classType];
      if (!baseCfg) continue;

      let canvas = btn.querySelector('canvas');
      if (!canvas) {
        const iconSpan = btn.querySelector('.btn-icon');
        if (iconSpan) {
          iconSpan.innerHTML = '';
          canvas = document.createElement('canvas');
          canvas.width = 40;
          canvas.height = 40;
          canvas.style.verticalAlign = 'middle';
          iconSpan.appendChild(canvas);
        }
      }

      const style = myPlayer ? (myPlayer.cruiserStyle || 'Klingon') : (localPlayer.cruiserStyle || 'Klingon');
      const playerColor = myPlayer ? (myPlayer.color || '#00ffff') : (localPlayer.color || '#00ffff');
      if (canvas) {
        drawShipClassOnCanvas(canvas, cfg.classType, style, playerColor, true);
      }

      const builtClasses = myPlayer ? (myPlayer.builtClasses || {}) : {};
      const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
      const idxClass = keys.indexOf(cfg.classType);
      let isUnlocked = true;
      let lockReason = '';
      if (idxClass > 0 && cfg.classType !== 'corvette') {
        const prevClass = keys[idxClass - 1];
        if (!builtClasses[prevClass]) {
          isUnlocked = false;
          lockReason = `Requires building a ${SHIP_CLASSES[prevClass].name} first`;
        }
      }

      const isFirst = !builtClasses[cfg.classType];
      let costMult = 1;
      if (isFirst) {
        const baseMultipliers = {
          corvette: 1,
          destroyer: 1.75,
          battlecruiser: 2.5,
          titan: 3.5,
          mammoth: 4
        };
        const baseMult = baseMultipliers[cfg.classType] || 1;
        costMult = baseMult;
        if (myPlayer) {
          const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
          const idxKeys = keys.indexOf(cfg.classType);
          if (idxKeys > 0) {
            const prevClass = keys[idxKeys - 1];
            const prevCount = (myPlayer.buildCounts && myPlayer.buildCounts[prevClass]) || 0;
            const subsequentBuilds = Math.max(0, prevCount - 1);
            costMult = Math.max(1.0, baseMult - subsequentBuilds * 0.5 * (baseMult - 1.0));
          }
        }
      }
      let baseCostShips = baseCfg.costShips * costMult;
      if (selectedPlanetBuild && !(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf)) {
        baseCostShips *= 2;
      }

      const totalUpgradeCost = getConfigurationUpgradeCost(cfg.classType, cfg.upgrades, myPlayer);
      const finalCost = Math.round((baseCostShips + totalUpgradeCost) * 0.8);
      console.log(`[CLIENT-CONFIG-COST] Name: ${cfg.name}, upgrades:`, JSON.stringify(cfg.upgrades), `baseCostShips: ${baseCostShips}, totalUpgradeCost: ${totalUpgradeCost}, finalCost: ${finalCost}`);

      const creditsAvailable = getCreditsAvailableForConfig(myPlayer);
      const canAfford = isUnlocked && (selectedPlanetBuild.ships + creditsAvailable) >= finalCost && (selectedPlanetBuild.maxShips - baseCfg.costCap) >= 55;

      if (costMult > 1) {
        btn.style.borderColor = '#ffeb3b';
        btn.style.color = '#ffeb3b';
        btn.style.boxShadow = '0 0 10px rgba(255, 235, 59, 0.3), inset 0 0 10px rgba(255, 235, 59, 0.3)';
      } else {
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.style.boxShadow = '';
      }

      if (!canAfford) {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      } else {
        btn.style.opacity = '1.0';
        btn.style.pointerEvents = 'auto';
      }

      btn.style.display = isUnlocked ? 'inline-flex' : 'none';

      const costSpan = btn.querySelector('.btn-cost');
      if (costSpan) {
        costSpan.textContent = `${finalCost}/${baseCfg.costCap}`;
      }

      let titleStr = '';
      if (!isUnlocked) {
        titleStr = `Build ${cfg.name} (LOCKED - ${lockReason})`;
      } else {
        titleStr = `Build ${isFirst ? 'Prototype ' : ''}${cfg.name} (Config of ${baseCfg.name}) (Cost: ${finalCost} ships/credits, Cap: ${baseCfg.costCap}). Right-click or long-press to delete configuration.`;
      }
      btn.setAttribute('title', titleStr);
    }
  }

  function deleteConfig(idx) {
    const savedConfigs = JSON.parse(localStorage.getItem('planetwars_ship_configs') || '[]');
    savedConfigs.splice(idx, 1);
    localStorage.setItem('planetwars_ship_configs', JSON.stringify(savedConfigs));
    const container = document.getElementById('config-build-buttons');
    if (container) {
      container.innerHTML = '';
    }
    const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
    const selectedPlanetBuild = selectedPlanets.length === 1 ? selectedPlanets[0] : null;
    updateConfigBuildButtons(myPlayer, selectedPlanetBuild);
  }

  const triggerSaveConfig = (shipId) => {
    const liveShip = serverState ? serverState.ships.find(s => s.id === shipId) : null;
    if (!liveShip || !liveShip.isCruiser || liveShip.isAmoeba) return;
    const classType = liveShip.classType;
    if (!classType || !SHIP_CLASSES[classType]) return;

    const upgrades = {
      sensorarrays: parseInt(liveShip.sensorarrays, 10) || 0,
      labs: parseInt(liveShip.labs, 10) || 0,
      armor: parseInt(liveShip.armor, 10) || 0,
      shields: parseInt(liveShip.shields, 10) || 0,
      engine: parseInt(liveShip.engine, 10) || 0,
      munitions: parseInt(liveShip.munitions, 10) || 0,
      targeting: parseInt(liveShip.targeting, 10) || 0,
      damagecontrol: parseInt(liveShip.damagecontrol, 10) || 0,
      fuel_tanker: parseInt(liveShip.fuel_tanker, 10) || 0,
      diplomat: parseInt(liveShip.diplomat, 10) || 0,
      marines: parseInt(liveShip.marines, 10) || 0,
      command: parseInt(liveShip.command, 10) || 0
    };

    const savedConfigs = JSON.parse(localStorage.getItem('planetwars_ship_configs') || '[]');
    const exists = savedConfigs.some(cfg => {
      if (cfg.classType !== classType) return false;
      for (const key of Object.keys(upgrades)) {
        if ((cfg.upgrades?.[key] || 0) !== upgrades[key]) return false;
      }
      return true;
    });

    if (exists) {
      return;
    }

    pendingShipConfig = { classType, upgrades };
    const configNameInput = document.getElementById('config-name-input');
    if (configNameInput) {
      configNameInput.value = '';
      configNameInput.classList.remove('hidden');
      configNameInput.focus();
    }
  };

  function getPlayerSpecificDiscountForShip(ship, type) {
    if (!serverState) return 0;
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
    let playerMod = 0.0;
    const playerObj = serverState.players ? serverState.players.find(p => p.id === ship.ownerId) : null;
    if (playerObj && playerObj.upgradeModifiers && playerObj.upgradeModifiers[normType] !== undefined) {
      playerMod = playerObj.upgradeModifiers[normType];
    }
    return Math.round(playerMod * 100);
  }

  function getSelectedCruiserUpgradeQualifiers() {
    if (!serverState || !localPlayer) return null;
    if (selectedShips.length !== 1) return null;
    const ship = serverState.ships.find(s => s.id === selectedShips[0].id);
    if (!ship || !ship.isCruiser || ship.ownerId !== localPlayer.id) return null;

    if (ship.upgradeTokens > 0) {
      return { ship, planet: { id: -1, ships: 9999 } };
    }

    const validProps = [
      'sensorarrays', 'labs', 'armor', 'shields', 'engine',
      'munitions', 'targeting', 'damagecontrol', 'fuel_tanker',
      'diplomat', 'marines', 'command'
    ];
    let minCost = Infinity;
    for (const prop of validProps) {
      const currentVal = ship[prop] || 0;
      const shieldCheck = (prop !== 'shields' || (currentVal + 1) * 0.10 <= 0.80);
      if (currentVal < 5 && shieldCheck) {
        const uCost = getUpgradeCostForShip(ship, prop);
        if (uCost < minCost) {
          minCost = uCost;
        }
      }
    }
    
    if (minCost === Infinity) return null;

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

  function getSelectedPlanetForFocus() {
    if (!serverState || !localPlayer) return null;
    if (selectedPlanets.length !== 1) return null;
    const planet = serverState.planets.find(p => p.id === selectedPlanets[0].id);
    if (!planet || planet.ownerId !== localPlayer.id) return null;
    return planet;
  }

  function getSelectedPlanetFocusQualifiers() {
    if (!serverState || !localPlayer) return null;
    if (selectedPlanets.length !== 1) return null;
    const planet = serverState.planets.find(p => p.id === selectedPlanets[0].id);
    if (!planet || planet.ownerId !== localPlayer.id) return null;
    const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
    const creditsAvailable = (myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0;
    const cost = Math.floor(planet.maxShips / 2);
    if ((planet.ships + creditsAvailable) < cost) return null;
    return planet;
  }

  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function getMouseServerPos(x, y) {
    const mapWidth = serverState ? (serverState.width || 1920) : 1920;
    const mapHeight = serverState ? (serverState.height || 1620) : 1620;
    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const finalScale = baseScale * cameraZoom;
    const centerServerX = mapWidth / 2 - cameraPanX;
    const centerServerY = mapHeight / 2 - cameraPanY;

    return {
      x: (x - canvas.width / 2) / finalScale + centerServerX,
      y: (y - canvas.height / 2) / finalScale + centerServerY
    };
  }

  function getServerToScreenPos(serverX, serverY) {
    const mapWidth = serverState ? (serverState.width || 1920) : 1920;
    const mapHeight = serverState ? (serverState.height || 1620) : 1620;
    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const finalScale = baseScale * cameraZoom;
    const centerServerX = mapWidth / 2 - cameraPanX;
    const centerServerY = mapHeight / 2 - cameraPanY;

    const canvasX = (serverX - centerServerX) * finalScale + canvas.width / 2;
    const canvasY = (serverY - centerServerY) * finalScale + canvas.height / 2;

    const rect = canvas.getBoundingClientRect();
    const cssX = canvasX / (canvas.width / rect.width) + rect.left;
    const cssY = canvasY / (canvas.height / rect.height) + rect.top;

    return { x: cssX, y: cssY };
  }

  function handlePointerDown(x, y, isShift = false, isTouch = false, button = 0) {
    if (!serverState || !localPlayer) return;

    const pos = getMouseServerPos(x, y);

    // Search for friendly ships in click range
    let clickedFleet = null;
    let clickedCruiser = null;

    if (serverState && serverState.ships) {
      for (const ship of serverState.ships) {
        if (!ship.active || ship.ownerId !== localPlayer.id) continue;
        const maxSpread = Math.min(60, 10 + Math.sqrt(ship.count || 1) * 2.5);
        const hitRadius = ship.count > 1 ? maxSpread + 10 : 25;
        const sdx = ship.x - pos.x;
        const sdy = ship.y - pos.y;
        if (sdx * sdx + sdy * sdy < hitRadius * hitRadius) {
          if (ship.isCruiser) {
            clickedCruiser = ship;
          } else {
            clickedFleet = ship;
          }
        }
      }
    }

    // LEFT-CLICK: Select / Lasso Precedence
    if (button === 0) {
      // 1. Fleets (standard ships) have top priority
      if (clickedFleet) {
        const clickedShip = clickedFleet;
        if (isShift) {
          const isAlreadySelected = selectedShips.some(s => s.id === clickedShip.id);
          if (isAlreadySelected) {
            selectedShips = selectedShips.filter(s => s.id !== clickedShip.id);
          } else {
            selectedShips.push(clickedShip);
          }
        } else {
          selectedShips = [clickedShip];
          selectedPlanets = [];
        }
        return;
      }

      // 2. Cruisers have second priority
      if (clickedCruiser) {
        const clickedShip = clickedCruiser;
        if (isShift) {
          const isAlreadySelected = selectedShips.some(s => s.id === clickedShip.id);
          if (isAlreadySelected) {
            selectedShips = selectedShips.filter(s => s.id !== clickedShip.id);
          } else {
            selectedShips.push(clickedShip);
          }
        } else {
          const wasOnlySelection = (selectedShips.length === 1 && selectedShips[0].id === clickedShip.id && selectedPlanets.length === 0);
          if (wasOnlySelection) {
            upgradeModeActive = !upgradeModeActive;
          } else {
            selectedShips = [clickedShip];
            selectedPlanets = [];
          }
        }
        return;
      }

      // 3. Focus badge button check
      for (const p of serverState.planets) {
        if (p.ownerId === localPlayer.id && !p.inFog) {
          const text = `${Math.floor(p.ships)} / ${Math.round(p.maxShips)}`;
          ctx.save();
          ctx.font = `bold 12px Orbitron`;
          const textWidth = ctx.measureText(text).width;
          ctx.restore();

          const pillHeight = 16;
          const badgeRadius = pillHeight / 2;
          const badgeX = p.x + textWidth / 2 + 8 + badgeRadius + 2;

          const dx = badgeX - pos.x;
          const dy = p.y - pos.y;
          const hitRadius = badgeRadius + 8;
          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
            if (focusModeActive && selectedPlanets.length === 1 && selectedPlanets[0].id === p.id) {
              focusModeActive = false;
            } else {
              selectedPlanets = [p];
              selectedShips = [];
              focusModeActive = true;
            }
            return;
          }
        }
      }

      // 3.5 Cruiser Build Icon check
      for (const p of serverState.planets) {
        if (p.ownerId === localPlayer.id && !p.inFog && !p.isSpeedPlanet) {
          const displayHomeworldOf = p.homeworldOf;
          const displayIsMilitary = p.isMilitary;

          // Icon/label is rendered at p.x, p.y - p.radius - 8
          const iconX = p.x;
          const iconY = p.y - p.radius - 8;

          const dx = iconX - pos.x;
          const dy = iconY - pos.y;

          let isHit = false;
          if (displayHomeworldOf) {
            const hwOwner = serverState.players.find(pl => pl.id === displayHomeworldOf);
            const nameStr = hwOwner ? (hwOwner.name || "") : "";
            const halfWidth = Math.max(25, (nameStr.length + 3) * 4);
            isHit = Math.abs(dx) <= halfWidth && Math.abs(dy) <= 15;
          } else if (displayIsMilitary) {
            const hitRadius = 18;
            isHit = (dx * dx + dy * dy <= hitRadius * hitRadius);
          } else {
            // For other buildable planets, clicking the name area (which is drawn at nameY = p.y - p.radius - 12) also opens build mode
            const halfWidth = Math.max(25, (p.name ? p.name.length : 10) * 4);
            isHit = Math.abs(dx) <= halfWidth && Math.abs(dy) <= 15;
          }

          if (isHit) {
            const isCurrentlySelected = selectedPlanets.length === 1 && selectedPlanets[0].id === p.id;
            if (isCurrentlySelected) {
              cruiserBuildModeActive = !cruiserBuildModeActive;
            } else {
              selectedPlanets = [p];
              selectedShips = [];
              cruiserBuildModeActive = true;
            }
            return;
          }
        }
      }

      // 4. Planet selection check
      const clickedPlanet = getPlanetAt(x, y);
      if (clickedPlanet) {
        if (clickedPlanet.ownerId === localPlayer.id) {
          const isAlreadySelected = selectedPlanets.some(p => p.id === clickedPlanet.id);
          if (isAlreadySelected) {
            selectedPlanets = selectedPlanets.filter(p => p.id !== clickedPlanet.id);
          } else {
            if (isShift) {
              selectedPlanets.push(clickedPlanet);
            } else {
              selectedPlanets = [clickedPlanet];
              selectedShips = [];
            }
          }
        } else {
          if (!isShift) {
            selectedPlanets = [];
            selectedShips = [];
          }
        }
        return;
      }

      // Clicked empty space
      if (!isShift) {
        selectedPlanets = [];
        selectedShips = [];
      }
      isDraggingCamera = true; // Signals the mousedown handler to start the lasso
      return;
    }

    if (button === 2) {
      // RIGHT CLICK: Issue Orders
      const clickPos = getMouseServerPos(x, y);
      
      let clickedTargetShip = null;
      if (serverState && serverState.ships) {
        for (const ship of serverState.ships) {
          if (!ship.active) continue;
          // Reduced targeting radius: 15px for cruisers, 12px for amoebas, 10px for fleets
          const hitRadius = ship.isCruiser ? 15 : (ship.isAmoeba ? 12 : 10);
          const sdx = ship.x - clickPos.x;
          const sdy = ship.y - clickPos.y;
          if (sdx * sdx + sdy * sdy < hitRadius * hitRadius) {
            clickedTargetShip = ship;
            break;
          }
        }
      }

      // Reduced planet right-click targeting radius to 65% of planet.radius
      let clickedPlanet = null;
      if (serverState && serverState.planets) {
        let bestPlanet = null;
        let bestSurfaceDist = Infinity;
        for (const planet of serverState.planets) {
          const dx = planet.x - clickPos.x;
          const dy = planet.y - clickPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const targetRadius = Math.max(15, 0.65 * planet.radius);
          if (dist <= targetRadius) {
            const surfaceDist = dist - targetRadius;
            if (surfaceDist < bestSurfaceDist) {
              bestSurfaceDist = surfaceDist;
              bestPlanet = planet;
            }
          }
        }
        clickedPlanet = bestPlanet;
      }

      if (clickedTargetShip && selectedShips.length > 0) {
        // Direct target locking on an enemy/amoeba ship
        const selectedCruisers = selectedShips.filter(s => s.isCruiser && !s.isUpgrading);
        const selectedFleets = selectedShips.filter(s => !s.isCruiser && !s.isUpgrading);
        
        if (selectedCruisers.length > 0) {
          socket.emit('setCruiserTarget', { shipIds: selectedCruisers.map(c => c.id), targetType: 'ship', targetId: clickedTargetShip.id, isShift });
        }
        
        if (selectedFleets.length > 0) {
          let fleetIds = selectedFleets.map(f => f.id);
          if (scoutModeNext) {
            const scoutCount = Math.max(3, Math.ceil(fleetIds.length * 0.1));
            fleetIds = fleetIds.slice(0, scoutCount);
          }
          socket.emit('moveShipsToSpace', { shipIds: fleetIds, targetX: clickedTargetShip.x, targetY: clickedTargetShip.y, isWarp: warpOrderNext, speedModifier: speedModifierNext, isShift });
        }
      } else if (clickedPlanet) {
        if (selectedPlanets.length > 0 || selectedShips.length > 0) {
          if (selectedShips.length > 0) {
            const selectedCruisers = selectedShips.filter(s => s.isCruiser && !s.isUpgrading);
            const selectedFleets = selectedShips.filter(s => !s.isCruiser && !s.isUpgrading);
            
            if (selectedCruisers.length > 0) {
              socket.emit('setCruiserTarget', { 
                shipIds: selectedCruisers.map(c => c.id), 
                targetType: 'planet', 
                targetId: clickedPlanet.id,
                clickX: clickPos.x,
                clickY: clickPos.y,
                isShift
              });
            }
            
            if (selectedFleets.length > 0) {
              let fleetIds = selectedFleets.map(f => f.id);
              if (scoutModeNext) {
                const scoutCount = Math.max(3, Math.ceil(fleetIds.length * 0.1));
                fleetIds = fleetIds.slice(0, scoutCount);
              }
              socket.emit('moveShipsToPlanet', { shipIds: fleetIds, targetId: clickedPlanet.id, isWarp: warpOrderNext, speedModifier: speedModifierNext, isShift });
            }
          }

          if (selectedPlanets.length > 0) {
            selectedPlanets.forEach(sourcePlanet => {
              const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
              let launchCost = myPlayer ? 10 + (myPlayer.planetCount || 0) : 10;
              if (myPlayer) {
                const techBonus = Math.floor(Math.sqrt(myPlayer.techScore || 0));
                launchCost = Math.max(0, launchCost - techBonus);
              }
              launchCost = Math.min(250, launchCost);

              const useCredits = myPlayer && myPlayer.useCredits !== false;
              const playerCredits = myPlayer ? (myPlayer.credits || 0) : 0;
              const creditsPaid = useCredits ? Math.min(playerCredits, launchCost) : 0;
              const shipLaunchCost = launchCost - creditsPaid;

              if (sourcePlanet.ships >= shipLaunchCost + 1) {
                socket.emit('sendShips', { sourceId: sourcePlanet.id, targetId: clickedPlanet.id, isWarp: warpOrderNext, speedModifier: speedModifierNext, isBombing: bombOrderNext, fillAmount: null, scoutMode: scoutModeNext, isCruiser: false });
                if (creditsPaid > 0) {
                  floatingAnimations.push({
                    x: sourcePlanet.x,
                    y: sourcePlanet.y,
                    text: `-$${Math.floor(creditsPaid)}`,
                    type: 'dollar',
                    age: 0,
                    duration: 2.5
                  });
                }
                if (shipLaunchCost > 0) {
                  floatingAnimations.push({
                    x: sourcePlanet.x,
                    y: sourcePlanet.y,
                    text: `-${Math.round(shipLaunchCost)}`,
                    type: 'launchCost',
                    age: 0,
                    duration: 2.5
                  });
                }
              }
            });
          }
        }
      } else {
        // Send to space coords
        if (selectedPlanets.length > 0 || selectedShips.length > 0) {
          const targetPos = getMouseServerPos(x, y);
          
          if (selectedShips.length > 0) {
            let shipIds = selectedShips.filter(s => !s.isUpgrading).map(s => s.id);
            if (scoutModeNext) {
              const scoutCount = Math.max(3, Math.ceil(shipIds.length * 0.1));
              shipIds = shipIds.slice(0, scoutCount);
            }
            socket.emit('moveShipsToSpace', { shipIds, targetX: targetPos.x, targetY: targetPos.y, isWarp: warpOrderNext, speedModifier: speedModifierNext, isShift });
          }

          if (selectedPlanets.length > 0) {
            selectedPlanets.forEach(sourcePlanet => {
              const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
              let launchCost = myPlayer ? 10 + (myPlayer.planetCount || 0) : 10;
              if (myPlayer) {
                const techBonus = Math.floor(Math.sqrt(myPlayer.techScore || 0));
                launchCost = Math.max(0, launchCost - techBonus);
              }
              launchCost = Math.min(250, launchCost);

              const useCredits = myPlayer && myPlayer.useCredits !== false;
              const playerCredits = myPlayer ? (myPlayer.credits || 0) : 0;
              const creditsPaid = useCredits ? Math.min(playerCredits, launchCost) : 0;
              const shipLaunchCost = launchCost - creditsPaid;

              if (sourcePlanet.ships >= shipLaunchCost + 1) {
                socket.emit('sendShipsToSpace', { sourceId: sourcePlanet.id, targetX: targetPos.x, targetY: targetPos.y, isWarp: warpOrderNext, speedModifier: speedModifierNext, isBombing: bombOrderNext, scoutMode: scoutModeNext, isCruiser: false });
                if (creditsPaid > 0) {
                  floatingAnimations.push({
                    x: sourcePlanet.x,
                    y: sourcePlanet.y,
                    text: `-$${Math.floor(creditsPaid)}`,
                    type: 'dollar',
                    age: 0,
                    duration: 2.5
                  });
                }
                if (shipLaunchCost > 0) {
                  floatingAnimations.push({
                    x: sourcePlanet.x,
                    y: sourcePlanet.y,
                    text: `-${Math.round(shipLaunchCost)}`,
                    type: 'launchCost',
                    age: 0,
                    duration: 2.5
                  });
                }
              }
            });
          }
        }
      }
      
      // Reset modifier flags after an order
      scoutModeNext = false;
      bombOrderNext = false;
      warpOrderNext = false;
      speedModifierNext = null;
      return;
    }
  }

  function handlePointerMove(x, y, isTouchInput = false) {
    if (isTouchInput || isHoveringSelectionTile) {
      hoveredPlanet = null;
      hoveredShip = null;
      return;
    }

    const serverPos = getMouseServerPos(x, y);
    hoveredPlanet = getPlanetAt(x, y);

    // Detect hovered anomaly (must supercede the planet it is on)
    hoveredAnomaly = null;
    hoveredAnomalyPlanet = null;
    if (serverState && serverState.planets) {
      for (const p of serverState.planets) {
        if (p.anomaly && !p.anomaly.researched) {
          const adx = p.anomaly.x - serverPos.x;
          const ady = p.anomaly.y - serverPos.y;
          const adist = Math.sqrt(adx * adx + ady * ady);
          if (adist <= 15) { // hover threshold of 15 pixels
            hoveredAnomaly = p.anomaly;
            hoveredAnomalyPlanet = p;
            break;
          }
        }
      }
    }

    // Detect hovered ship (prioritize cruisers)
    hoveredShip = null;
    if (serverState && serverState.ships) {
      for (const ship of serverState.ships) {
        if (!ship.active) continue;
        const maxSpread = Math.min(60, 10 + Math.sqrt(ship.count || 1) * 2.5);
        const hoverRadius = ship.count > 1 ? maxSpread + 5 : 15;
        const sdx = ship.x - serverPos.x;
        const sdy = ship.y - serverPos.y;
        if (sdx * sdx + sdy * sdy < hoverRadius * hoverRadius) {
          if (!hoveredShip || (!hoveredShip.isCruiser && ship.isCruiser)) {
            hoveredShip = ship;
          }
        }
      }
    }

    // Hover overrides hierarchy
    if (hoveredAnomaly) {
      hoveredPlanet = null;
      hoveredShip = null;
    } else if (hoveredShip && hoveredShip.isCruiser) {
      hoveredPlanet = null;
    } else if (hoveredPlanet) {
      hoveredShip = null; // Planet overrides non-cruiser ships
    }

    if (!lasso.active) return;
    lasso.endX = serverPos.x;
    lasso.endY = serverPos.y;
  }

  function handlePointerUp() {
    if (!lasso.active) return;

    lasso.active = false;

    // Resolve lasso
    const minX = Math.min(lasso.startX, lasso.endX);
    const maxX = Math.max(lasso.startX, lasso.endX);
    const minY = Math.min(lasso.startY, lasso.endY);
    const maxY = Math.max(lasso.startY, lasso.endY);

    // Minimum drag distance to count as lasso
    if (maxX - minX < 10 && maxY - minY < 10) {
      // Don't clear if planet was already selected via handlePointerDown
      return;
    }

    selectedShips = [];
    if (!serverState || !localPlayer) return;

    for (const ship of serverState.ships) {
      if (ship.ownerId === localPlayer.id && ship.active) {
        if (ship.x >= minX && ship.x <= maxX && ship.y >= minY && ship.y <= maxY) {
          selectedShips.push(ship);
        }
      }
    }

    selectedPlanets = [];
    for (const planet of serverState.planets) {
      if (planet.ownerId === localPlayer.id) {
        if (planet.x >= minX && planet.x <= maxX && planet.y >= minY && planet.y <= maxY) {
          selectedPlanets.push(planet);
        }
      }
    }
  }

  function handleDoubleClickOrTap(x, y) {
    if (!serverState || !localPlayer) return;
    const pos = getMouseServerPos(x, y);

    // 1. Search for friendly cruiser at double-click/tap location
    let clickedCruiser = null;
    if (serverState && serverState.ships) {
      for (const ship of serverState.ships) {
        if (!ship.active || ship.ownerId !== localPlayer.id) continue;
        if (!ship.isCruiser) continue;
        const maxSpread = Math.min(60, 10 + Math.sqrt(ship.count || 1) * 2.5);
        const hitRadius = ship.count > 1 ? maxSpread + 10 : 25;
        const sdx = ship.x - pos.x;
        const sdy = ship.y - pos.y;
        if (sdx * sdx + sdy * sdy < hitRadius * hitRadius) {
          clickedCruiser = ship;
          break;
        }
      }
    }

    if (clickedCruiser) {
      selectedShips = [];
      selectedPlanets = [];
      for (const ship of serverState.ships) {
        if (ship.active && ship.ownerId === localPlayer.id && ship.isCruiser) {
          const dx = ship.x - clickedCruiser.x;
          const dy = ship.y - clickedCruiser.y;
          if (dx * dx + dy * dy <= 200 * 200) {
            selectedShips.push(ship);
          }
        }
      }
      return;
    }

    // 2. Search for friendly planet at double-click/tap location
    const clickedPlanet = getPlanetAt(x, y);
    if (clickedPlanet && clickedPlanet.ownerId === localPlayer.id) {
      selectedPlanets = [];
      selectedShips = [];
      for (const planet of serverState.planets) {
        if (planet.ownerId === localPlayer.id) {
          const dx = planet.x - clickedPlanet.x;
          const dy = planet.y - clickedPlanet.y;
          if (dx * dx + dy * dy <= 400 * 400) {
            selectedPlanets.push(planet);
          }
        }
      }
      return;
    }
  }

  canvas.addEventListener('dblclick', (event) => {
    // Info panels are now tooltips triggered by hover / single tap.
    const cPos = getCanvasPos(event.clientX, event.clientY);
    handleDoubleClickOrTap(cPos.x, cPos.y);
  });

  let mouseTimeout = null;
  let mouseDownStartX = 0;
  let mouseDownStartY = 0;



  canvas.addEventListener('mousedown', (event) => {
    console.log('[DIAG] mousedown', { button: event.button, shift: event.shiftKey, hasServerState: !!serverState, hasLocalPlayer: !!localPlayer });
    const cPos = getCanvasPos(event.clientX, event.clientY);
    const posX = cPos.x;
    const posY = cPos.y;
    if (event.button === 1) { // Middle click = pan only
      if (mouseTimeout) {
        clearTimeout(mouseTimeout);
        mouseTimeout = null;
      }
      lasso.active = false;
      isDraggingCamera = true;
      lastCameraDragX = event.clientX;
      lastCameraDragY = event.clientY;
      return;
    }

    if (event.button !== 0 && event.button !== 2) return;

    mouseDownStartX = posX;
    mouseDownStartY = posY;
    lastCameraDragX = event.clientX;
    lastCameraDragY = event.clientY;
    isDraggingCamera = false; // Reset stale drag state

    handlePointerDown(posX, posY, event.shiftKey, false, event.button);

    if (event.button === 0) {
      if (event.shiftKey) {
        // Shift + Left Click = Lasso
        isDraggingCamera = false;
        const serverPos = getMouseServerPos(posX, posY);
        lasso.active = true;
        lasso.startX = serverPos.x;
        lasso.startY = serverPos.y;
        lasso.endX = serverPos.x;
        lasso.endY = serverPos.y;
      } else {
        // Left click = pan
        isDraggingCamera = true;
      }
    }
  });

  document.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('wheel', (event) => {
    console.log('[DIAG] wheel', { deltaY: event.deltaY, cameraZoom });
    event.preventDefault();
    const cPos = getCanvasPos(event.clientX, event.clientY);
    const mouseX = cPos.x;
    const mouseY = cPos.y;

    const oldServerPos = getMouseServerPos(mouseX, mouseY);

    const zoomFactor = 1.1;
    if (event.deltaY < 0) {
      cameraZoom *= zoomFactor;
    } else {
      cameraZoom /= zoomFactor;
    }
    cameraZoom = Math.max(0.2, Math.min(cameraZoom, 20.0));

    const newServerPos = getMouseServerPos(mouseX, mouseY);
    cameraPanX += (newServerPos.x - oldServerPos.x);
    cameraPanY += (newServerPos.y - oldServerPos.y);
  }, { passive: false });

  let lastMouseEmitTime = 0;

  window.addEventListener('mousemove', (event) => {
    mouseMovedSinceOpen = true;
    lastMouseTarget = event.target;
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;

    if (isDraggingCamera) {
      const dx = event.clientX - lastCameraDragX;
      const dy = event.clientY - lastCameraDragY;
      lastCameraDragX = event.clientX;
      lastCameraDragY = event.clientY;

      const mapWidth = serverState ? (serverState.width || 1920) : 1920;
      const mapHeight = serverState ? (serverState.height || 1620) : 1620;
      const scaleX = canvas.width / mapWidth;
      const scaleY = canvas.height / mapHeight;
      const finalScale = Math.min(scaleX, scaleY) * cameraZoom;

      cameraPanX += (dx * cssToCanvasX) / finalScale;
      cameraPanY += (dy * cssToCanvasY) / finalScale;
    }

    // Always update hover state and lasso
    const cPos = getCanvasPos(event.clientX, event.clientY);
    lastCanvasMouseX = cPos.x;
    lastCanvasMouseY = cPos.y;
    handlePointerMove(cPos.x, cPos.y, false);

    // Tooltip hover check
    let newType = null;
    let newId = null;
    if (hoveredAnomaly) {
      newType = 'anomaly';
      newId = hoveredAnomalyPlanet.id;
    } else if (hoveredShip && hoveredShip.isCruiser) {
      newType = 'ship';
      newId = hoveredShip.id;
    } else if (hoveredPlanet) {
      newType = 'planet';
      newId = hoveredPlanet.id;
    } else if (hoveredShip) {
      newType = 'fleet';
      newId = hoveredShip.id;
    }

    if (newType && (newId !== null && newId !== undefined)) {
      if (activeInfoPanel && activeInfoPanel.type === newType && activeInfoPanel.id === newId) {
        if (infoPanelTimer) {
          clearTimeout(infoPanelTimer);
          infoPanelTimer = null;
        }
      } else {
        if (infoPanelTimer) {
          clearTimeout(infoPanelTimer);
          infoPanelTimer = null;
        }
        openInfoPanel(newType, newId);
      }
    } else {
      checkInfoPanelDismiss();
    }

    const now = Date.now();
    if (now - lastMouseEmitTime > 5000) {
      lastMouseEmitTime = now;
      socket.emit('resetAFK');
      if (afkWarningOverlay && !afkWarningOverlay.classList.contains('hidden')) {
        afkWarningOverlay.classList.add('hidden');
      }
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (mouseTimeout) {
      clearTimeout(mouseTimeout);
      mouseTimeout = null;
    }
    isDraggingCamera = false;
    if (event.button === 1 || event.button === 2) {
      lasso.active = false;
      return;
    }
    handlePointerUp(event);
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartActive = false;
  let touchLongPressed = false;
  let touchTimeout = null;
  let lastTouchTime = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let touchTooltipEntity = null;
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); // Prevent double-firing with simulated mouse events
    const rect = canvas.getBoundingClientRect();
    if (event.touches.length === 2) {
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }
      touchStartActive = false;
      touchLongPressed = false;
      initialPinchDistance = getPinchDistance(event.touches);
      initialPinchZoom = cameraZoom;
      const mid = getPinchMidpoint(event.touches);
      lastPinchMidX = mid.x;
      lastPinchMidY = mid.y;

      // Cancel any lasso when pinching starts
      lasso.active = false;
      return;
    }

    if (event.touches.length === 1) {
      const tx = event.touches[0].clientX;
      const ty = event.touches[0].clientY;
      lastCameraDragX = tx;
      lastCameraDragY = ty;
      
      touchStartX = tx;
      touchStartY = ty;
      touchStartActive = true;
      touchLongPressed = false;
      isDraggingCamera = false;

      // Keep track of touch position and time
      const now = Date.now();
      lastTouchTime = now;
      lastTouchX = tx;
      lastTouchY = ty;

      const cPos = getCanvasPos(tx, ty);

      // Update hover tooltip immediately on touch down!
      handlePointerMove(cPos.x, cPos.y, true);

      // Set hold timer for 450ms (simulates Right-Click Order event button=2)
      touchTimeout = setTimeout(() => {
        if (!touchStartActive) return;
        touchLongPressed = true;
        
        const cPosHold = getCanvasPos(tx, ty);
        const serverPos = getMouseServerPos(cPosHold.x, cPosHold.y);

        // Display beautiful cyber-haptic floating text at command location
        floatingAnimations.push({
          x: serverPos.x,
          y: serverPos.y,
          text: "COMMAND ISSUED",
          color: "#0ff",
          alpha: 1,
          life: 1.0
        });

        // Trigger command orders (button === 2)
        handlePointerDown(cPosHold.x, cPosHold.y, event.shiftKey, true, 2);

        // Allow Lasso Mode if long press starts in empty space with no selection
        const clickedPlanet = getPlanetAt(cPosHold.x, cPosHold.y);
        if (!clickedPlanet && selectedPlanets.length === 0 && selectedShips.length === 0) {
          lasso.active = true;
          lasso.startX = serverPos.x;
          lasso.startY = serverPos.y;
          lasso.endX = serverPos.x;
          lasso.endY = serverPos.y;
        }
      }, 450);
    }
  });

  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;

    if (event.touches.length === 2 && initialPinchDistance) {
      const currentDistance = getPinchDistance(event.touches);
      const mid = getPinchMidpoint(event.touches);

      const zoomFactor = currentDistance / initialPinchDistance;
      const targetZoom = initialPinchZoom * zoomFactor;

      const oldServerPos = getMouseServerPos(mid.x, mid.y);
      cameraZoom = Math.max(0.2, Math.min(targetZoom, 20.0));

      const newServerPos = getMouseServerPos(mid.x, mid.y);
      cameraPanX += (newServerPos.x - oldServerPos.x);
      cameraPanY += (newServerPos.y - oldServerPos.y);

      // Calculate Pan based on mid-point movement
      const dx = mid.x - lastPinchMidX;
      const dy = mid.y - lastPinchMidY;
      lastPinchMidX = mid.x;
      lastPinchMidY = mid.y;

      const mapWidth = serverState ? (serverState.width || 1920) : 1920;
      const mapHeight = serverState ? (serverState.height || 1620) : 1620;
      const scaleX = canvas.width / mapWidth;
      const scaleY = canvas.height / mapHeight;
      const finalScale = Math.min(scaleX, scaleY) * cameraZoom;

      cameraPanX += dx / finalScale;
      cameraPanY += dy / finalScale;

      return;
    }

    if (event.touches.length === 1 && !initialPinchDistance) {
      const tx = event.touches[0].clientX;
      const ty = event.touches[0].clientY;
      const dx = tx - touchStartX;
      const dy = ty - touchStartY;

      // If finger slides significantly (> 10px), cancel hold timer and pan camera instead
      if (touchStartActive && !touchLongPressed) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(touchTimeout);
          touchTimeout = null;
          touchStartActive = false;
          isDraggingCamera = true;
        }
      }

      if (isDraggingCamera) {
        // Clear hovered entities when actively panning to clean up the viewport
        hoveredPlanet = null;
        hoveredShip = null;

        const panDx = tx - lastCameraDragX;
        const panDy = ty - lastCameraDragY;
        lastCameraDragX = tx;
        lastCameraDragY = ty;

        const mapWidth = serverState ? (serverState.width || 1920) : 1920;
        const mapHeight = serverState ? (serverState.height || 1620) : 1620;
        const scaleX = canvas.width / mapWidth;
        const scaleY = canvas.height / mapHeight;
        const finalScale = Math.min(scaleX, scaleY) * cameraZoom;

        cameraPanX += (panDx * cssToCanvasX) / finalScale;
        cameraPanY += (panDy * cssToCanvasY) / finalScale;
      } else {
        // Update hover tooltips dynamically as finger touches or holds
        const cPos = getCanvasPos(tx, ty);
        handlePointerMove(cPos.x, cPos.y, true);
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', (event) => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }

    // Quick tap: trigger selection (button 0 / left-click) only if hold was not fired
    if (touchStartActive && !touchLongPressed) {
      const cPos = getCanvasPos(touchStartX, touchStartY);

      const clickedPlanet = getPlanetAt(cPos.x, cPos.y);
      let clickedShip = null;
      const serverPos = getMouseServerPos(cPos.x, cPos.y);
      if (serverState && serverState.ships) {
        for (const ship of serverState.ships) {
          if (!ship.active) continue;
          const maxSpread = Math.min(60, 10 + Math.sqrt(ship.count || 1) * 2.5);
          const hoverRadius = ship.count > 1 ? maxSpread + 5 : 15;
          const sdx = ship.x - serverPos.x;
          const sdy = ship.y - serverPos.y;
          if (sdx * sdx + sdy * sdy < hoverRadius * hoverRadius) {
            if (!clickedShip || (!clickedShip.isCruiser && ship.isCruiser)) {
              clickedShip = ship;
            }
          }
        }
      }

      let tappedType = null;
      let tappedId = null;
      if (clickedShip && clickedShip.isCruiser) {
        tappedType = 'ship';
        tappedId = clickedShip.id;
      } else if (clickedPlanet) {
        tappedType = 'planet';
        tappedId = clickedPlanet.id;
      } else if (clickedShip) {
        tappedType = 'fleet';
        tappedId = clickedShip.id;
      }

      if (tappedType && (tappedId !== null && tappedId !== undefined)) {
        if (activeInfoPanel && activeInfoPanel.type === tappedType && activeInfoPanel.id === tappedId) {
          closeInfoPanel();
        } else {
          openInfoPanel(tappedType, tappedId);
          panelOpenedThisTick = true;
          setTimeout(() => { panelOpenedThisTick = false; }, 0);
        }
      } else {
        if (activeInfoPanel) {
          closeInfoPanel();
        }
      }

      handlePointerDown(cPos.x, cPos.y, event.shiftKey, true, 0);

      // Check for double tap
      const now = Date.now();
      const timeDiff = now - lastTapTime;
      const dx = touchStartX - lastTapX;
      const dy = touchStartY - lastTapY;
      const distSq = dx * dx + dy * dy;

      if (timeDiff < 300 && distSq < 40 * 40) {
        handleDoubleClickOrTap(cPos.x, cPos.y);
      }

      lastTapTime = now;
      lastTapX = touchStartX;
      lastTapY = touchStartY;
    }

    touchStartActive = false;
    touchLongPressed = false;

    if (event.touches.length < 2) {
      initialPinchDistance = null;
    }
    if (event.touches.length === 0) {
      if (lasso.active) {
        handlePointerUp();
      }
    }
  });

  window.addEventListener('touchcancel', (event) => {
    if (touchTimeout) {
      clearTimeout(touchTimeout);
      touchTimeout = null;
    }
    touchStartActive = false;
    touchLongPressed = false;
    initialPinchDistance = null;
    if (lasso.active) {
      handlePointerUp();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      if (isShiftSelectingInHUD) {
        selectedPlanets = selectedPlanets.filter(p => hudSelectedSet.has(`planet-${p.id}`));
        selectedShips = selectedShips.filter(s => hudSelectedSet.has(`ship-${s.id}`));
        isShiftSelectingInHUD = false;
        hudSelectedSet.clear();
        updateSelectionTiles();
        updateButtonHighlights();
      }
    }
  });

  window.addEventListener('keydown', (event) => {
    if (document.activeElement === document.getElementById('chat-input') ||
        document.activeElement === document.getElementById('config-name-input')) {
      return;
    }
    if (event.repeat) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      if (serverState && localPlayer) {
        if (event.ctrlKey) {
          // Cycle cruisers
          const myCruisers = serverState.ships.filter(s => s.active && s.isCruiser && s.ownerId === localPlayer.id);
          if (myCruisers.length > 0) {
            let currentIndex = myCruisers.findIndex(c => selectedShips.length === 1 && selectedShips[0].id === c.id);
            let nextIndex = (currentIndex + 1) % myCruisers.length;
            if (currentIndex === -1) nextIndex = 0;
            
            const targetCruiser = myCruisers[nextIndex];
            selectedShips = [targetCruiser];
            selectedPlanets = [];
            
            const mapWidth = serverState.width || 1920;
            const mapHeight = serverState.height || 1620;
            cameraPanX = mapWidth / 2 - targetCruiser.x;
            cameraPanY = mapHeight / 2 - targetCruiser.y;
          }
        } else if (event.altKey) {
          // Cycle fleets
          const myFleets = serverState.ships.filter(s => s.active && !s.isCruiser && !s.isReturnPod && !s.isBoardingFleet && !s.isAmoeba && s.ownerId === localPlayer.id);
          if (myFleets.length > 0) {
            let currentIndex = myFleets.findIndex(f => selectedShips.length === 1 && selectedShips[0].id === f.id);
            let nextIndex = (currentIndex + 1) % myFleets.length;
            if (currentIndex === -1) nextIndex = 0;
            
            const targetFleet = myFleets[nextIndex];
            selectedShips = [targetFleet];
            selectedPlanets = [];
            
            const mapWidth = serverState.width || 1920;
            const mapHeight = serverState.height || 1620;
            cameraPanX = mapWidth / 2 - targetFleet.x;
            cameraPanY = mapHeight / 2 - targetFleet.y;
          }
        } else {
          // Cycle planets
          const myPlanets = serverState.planets.filter(p => p.ownerId === localPlayer.id);
          if (myPlanets.length > 0) {
            let currentIndex = myPlanets.findIndex(p => selectedPlanets.length === 1 && selectedPlanets[0].id === p.id);
            let nextIndex = (currentIndex + 1) % myPlanets.length;
            if (currentIndex === -1) nextIndex = 0;
            
            const targetPlanet = myPlanets[nextIndex];
            selectedPlanets = [targetPlanet];
            selectedShips = [];
            
            const mapWidth = serverState.width || 1920;
            const mapHeight = serverState.height || 1620;
            cameraPanX = mapWidth / 2 - targetPlanet.x;
            cameraPanY = mapHeight / 2 - targetPlanet.y;
          }
        }
      }
      return;
    }

    if (cruiserBuildModeActive) {
      const selectedPlanetBuild = selectedPlanets.length === 1 ? selectedPlanets[0] : null;
      if (selectedPlanetBuild && selectedPlanetBuild.ownerId === localPlayer.id && !selectedPlanetBuild.isSpeedPlanet) {
        const key = event.key.toLowerCase();
        if (key === 'e' || key === 'escape') {
          event.preventDefault();
          cruiserBuildModeActive = false;
          return;
        }
        let typeToBuild = null;
        for (const [classType, cfg] of Object.entries(SHIP_CLASSES)) {
          if (cfg.key === key) {
            typeToBuild = classType;
            break;
          }
        }
        if (typeToBuild) {
          event.preventDefault();
          handleClassBuildTrigger(typeToBuild, selectedPlanetBuild);
          return;
        }
        return;
      } else {
        cruiserBuildModeActive = false;
      }
    }

    if (focusModeActive) {
      const planet = getSelectedPlanetFocusQualifiers();
      if (planet) {
        const key = event.key.toLowerCase();
        if (key === 'e' && planet.focusMode !== 'economy') {
          event.preventDefault();
          socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'economy' });
          focusModeActive = false;
          return;
        }
        if (key === 'r' && planet.focusMode !== 'research') {
          event.preventDefault();
          socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'research' });
          focusModeActive = false;
          return;
        }
        if (key === 'g' && planet.focusMode !== 'garrison') {
          event.preventDefault();
          socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'garrison' });
          focusModeActive = false;
          return;
        }
        if (key === 'c' && planet.focusMode !== 'commerce' && planet.maxShips > 100) {
          event.preventDefault();
          socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'commerce' });
          focusModeActive = false;
          return;
        }
        if (key === 'm' && planet.focusMode !== 'mining' && planet.resources && planet.resources.length > 0) {
          event.preventDefault();
          socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'mining' });
          focusModeActive = false;
          return;
        }
        if (key === 't' && planet.focusMode !== 'terraforming') {
          const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
          const techBonus = Math.floor(Math.sqrt((myPlayer ? myPlayer.techScore : 0) || 0));
          const limit = Math.ceil(planet.habitability / 5);
          if (techBonus > limit) {
            event.preventDefault();
            socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'terraforming' });
            focusModeActive = false;
            return;
          }
        }
        if (key === 'h' && planet.focusMode !== 'homeworld') {
          const hasHomeworld = serverState && serverState.planets && localPlayer && serverState.planets.some(p => p.homeworldOf === localPlayer.id);
          if (!hasHomeworld) {
            event.preventDefault();
            socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: 'homeworld' });
            focusModeActive = false;
            return;
          }
        }
        if (key === 'o' || event.key === 'Escape') {
          event.preventDefault();
          focusModeActive = false;
          return;
        }
        return;
      } else {
        focusModeActive = false;
      }
    }

    if (upgradeModeActive) {
      const ship = getSelectedCruiser();
      if (ship) {
        const key = event.key.toLowerCase();
        
        if (ship.isUpgrading) {
          if (key === 'u' || event.key === 'Escape') {
            event.preventDefault();
            upgradeModeActive = false;
          }
          return;
        }
        
        if (key === 'u' || event.key === 'Escape') {
          event.preventDefault();
          upgradeModeActive = false;
          return;
        }

        const qual = getSelectedCruiserUpgradeQualifiers();
        if (qual) {
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

          const maxIndividualLevel = Math.floor((ship.maxHealth || 0) / 10);
          const maxTotalUpgrades = Math.floor((ship.maxHealth || 0) / 5);

          const isAllowed = (propName) => {
            const currentVal = ship[propName] || 0;
            const nextLevel = currentVal + 1;
            let shieldCheck = true;
            if (propName === 'shields') {
              const rawTech = localPlayer ? localPlayer.techScore || 0 : 0;
              const rawExp = localPlayer ? localPlayer.expScore || 0 : 0;
              const shipExp = ship.expScore || 0;
              const techBonus = Math.sqrt(rawTech);
              const expBonus = Math.sqrt(rawExp);
              const shipExpBonus = Math.sqrt(shipExp);
              const baseDeflection = ship.maxHealth + (techBonus + expBonus + shipExpBonus);
              const deflectionRem = 100 - baseDeflection;
              const nextShieldDeflectionBonus = nextLevel * (deflectionRem / 5);
              const newDeflection = baseDeflection + nextShieldDeflectionBonus;
              if (newDeflection > 90) {
                shieldCheck = false;
              }
            }
            const hasTokens = ship.upgradeTokens > 0;
            if (hasTokens) {
              return (currentVal < 5) && (nextLevel <= Math.min(5, maxIndividualLevel)) && shieldCheck;
            }
            return (currentVal < 5) && (currentVal + 1 <= maxIndividualLevel) && (totalUpgrades + 1 <= maxTotalUpgrades) && shieldCheck;
          };



          let triggered = false;
          if (key === 's') {
            event.preventDefault();
            if (isAllowed('sensorarrays')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'sensorarray' });
            triggered = true;
          }
          if (key === 'l') {
            event.preventDefault();
            if (isAllowed('labs')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'lab' });
            triggered = true;
          }
          if (key === 'a') {
            event.preventDefault();
            if (isAllowed('armor')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'armor' });
            triggered = true;
          }
          if (key === 'h') {
            event.preventDefault();
            if (isAllowed('shields')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'shield' });
            triggered = true;
          }
          if (key === 'e') {
            event.preventDefault();
            if (isAllowed('engine')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'engine' });
            triggered = true;
          }
          if (key === 'm') {
            event.preventDefault();
            if (isAllowed('munitions')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'munitions' });
            triggered = true;
          }
          if (key === 't') {
            event.preventDefault();
            if (isAllowed('targeting')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'targeting' });
            triggered = true;
          }
          if (key === 'd') {
            event.preventDefault();
            if (isAllowed('damagecontrol')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'damagecontrol' });
            triggered = true;
          }
          if (key === 'f') {
            event.preventDefault();
            if (isAllowed('fuel_tanker')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'fueltanker' });
            triggered = true;
          }
          if (key === 'i') {
            event.preventDefault();
            if (isAllowed('diplomat')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'diplomat' });
            triggered = true;
          }
          if (key === 'r') {
            event.preventDefault();
            if (isAllowed('marines')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'marines' });
            triggered = true;
          }
          if (key === 'c') {
            event.preventDefault();
            if (isAllowed('command')) socket.emit('upgradeCruiser', { shipId: ship.id, type: 'command' });
            triggered = true;
          }
          if (triggered) {
            upgradeModeActive = false;
            return;
          }
        }
      } else {
        upgradeModeActive = false;
      }
    }

    const numKey = parseInt(event.key);
    if (!isNaN(numKey) && numKey >= 0 && numKey <= 9) {
      if (event.ctrlKey) {
        event.preventDefault();
        controlGroups[numKey] = {
          shipIds: selectedShips.map(s => s.id),
          planetIds: selectedPlanets.map(p => p.id)
        };
        console.log(`Assigned control group ${numKey}:`, controlGroups[numKey]);
      } else if (!event.altKey && !event.shiftKey && !event.metaKey) {
        const group = controlGroups[numKey];
        if (group && ((group.shipIds && group.shipIds.length > 0) || (group.planetIds && group.planetIds.length > 0))) {
          event.preventDefault();
          selectedShips = [];
          selectedPlanets = [];
          
          if (group.shipIds && group.shipIds.length > 0 && serverState && serverState.ships) {
            for (const ship of serverState.ships) {
              if (ship.active && group.shipIds.includes(ship.id)) {
                selectedShips.push(ship);
              }
            }
          }
          
          if (group.planetIds && group.planetIds.length > 0 && serverState && serverState.planets) {
            for (const planet of serverState.planets) {
              if (group.planetIds.includes(planet.id)) {
                selectedPlanets.push(planet);
              }
            }
          }
          console.log(`Reselected control group ${numKey}: ships=`, selectedShips.map(s => s.id), "planets=", selectedPlanets.map(p => p.id));
        }
      }
    }

    if (event.code === 'Pause') {
      event.preventDefault();
      socket.emit('togglePause');
    }
    if (event.key.toLowerCase() === 'w') {
      warpOrderNext = !warpOrderNext;
    }
    if (event.key.toLowerCase() === 'u') {
      const qual = getSelectedCruiserUpgradeQualifiers();
      if (qual) {
        event.preventDefault();
        upgradeModeActive = true;
        return;
      } else {
        const selectedCruisers = getSelectedCruisers();
        if (selectedCruisers.length > 0) {
          event.preventDefault();
          const anyNotUsing = selectedCruisers.some(c => !c.useResources);
          const nextState = anyNotUsing;
          for (const ship of selectedCruisers) {
            ship.useResources = nextState;
            socket.emit('toggleCruiserUseResources', { shipId: ship.id, enabled: nextState });
          }
          return;
        } else if (selectedPlanets.length > 0) {
          event.preventDefault();
          const anyNotUsing = selectedPlanets.some(p => !p.useResources);
          const nextState = anyNotUsing;
          for (const p of selectedPlanets) {
            p.useResources = nextState;
            socket.emit('togglePlanetUseResources', { planetId: p.id, enabled: nextState });
          }
          return;
        }
      }
    }
    if (event.key.toLowerCase() === 'o') {
      const planet = getSelectedPlanetForFocus();
      if (planet) {
        event.preventDefault();
        focusModeActive = true;
        return;
      }
    }
    if (event.key.toLowerCase() === 'b') {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length === 0) {
        bombOrderNext = bombOrderNext === 'eco' ? false : 'eco';
      }
    }
    if (event.key.toLowerCase() === 'p') {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        event.preventDefault();
        const anyNotPatrolling = selectedCruisers.some(c => !c.isPatrolling);
        const nextState = anyNotPatrolling;
        for (const ship of selectedCruisers) {
          ship.isPatrolling = nextState;
          if (nextState) {
            ship.isScouting = false;
            ship.isResearching = false;
            ship.isDiplomacy = false;
          }
          socket.emit('toggleCruiserPatrol', { shipId: ship.id, enabled: nextState });
        }
      }
    }
    if (event.key.toLowerCase() === 'q') {
      bombOrderNext = bombOrderNext === 'ships' ? false : 'ships';
    }
    if (event.key.toLowerCase() === 'l') {
      scoreBoard.classList.toggle('hidden');
    }
    if (event.key.toLowerCase() === 's') {
      const selectedCruisers = selectedShips.filter(s => s.isCruiser && s.ownerId === localPlayer.id);
      if (selectedCruisers.length > 0) {
        event.preventDefault();
        const anyNotScouting = selectedCruisers.some(c => !c.isScouting);
        const nextState = anyNotScouting;
        selectedCruisers.forEach(ship => {
          ship.isScouting = nextState;
          if (nextState) {
            ship.isPatrolling = false;
            ship.isResearching = false;
            ship.isDiplomacy = false;
          }
          socket.emit('toggleCruiserScout', { shipId: ship.id, enabled: nextState });
        });
      } else {
        const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
        const techBonus = myPlayer ? Math.sqrt(myPlayer.techScore || 0) : 0;
        if (techBonus >= 10) {
          scoutModeNext = !scoutModeNext;
        }
      }
    }
    if (event.key.toLowerCase() === 'a') {
      const selectedCruisers = selectedShips.filter(s => s.isCruiser && s.ownerId === localPlayer.id);
      if (selectedCruisers.length > 0) {
        event.preventDefault();
        const anyNotAttacking = selectedCruisers.some(c => !c.scoutAttackEnabled);
        const nextState = anyNotAttacking;
        selectedCruisers.forEach(ship => {
          ship.scoutAttackEnabled = nextState;
          socket.emit('toggleCruiserScoutAttack', { shipId: ship.id, enabled: nextState });
        });
      }
    }


    if (event.key.toLowerCase() === 'd') {
      const selectedCruisers = selectedShips.filter(s => s.isCruiser && s.ownerId === localPlayer.id);
      const hasCruiserInFriendlyWell = selectedCruisers.some(c => !c.isDismantling && isCruiserInFriendlyGravityWell(c));
      if (hasCruiserInFriendlyWell) {
        event.preventDefault();
        const btnDismantle = document.getElementById('btn-dismantle');
        if (btnDismantle) {
          btnDismantle.click();
        }
        return;
      }
    }
    if (event.key.toLowerCase() === 'c') {
      const hasCruiserBase = selectedPlanets.some(p => p.ownerId === localPlayer.id && !p.isSpeedPlanet && (p.isMilitary || (p.ships >= 50 && p.maxShips >= 57)));
      if (hasCruiserBase) {
        event.preventDefault();
        cruiserBuildModeActive = !cruiserBuildModeActive;
      }
    }



    if (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '_') {
      const rect = canvas.getBoundingClientRect();
      const mouseX = canvas.width / 2;
      const mouseY = canvas.height / 2;
      const oldServerPos = getMouseServerPos(mouseX, mouseY);

      const zoomFactor = 1.2;
      if (event.key === '=' || event.key === '+') {
        cameraZoom *= zoomFactor;
      } else {
        cameraZoom /= zoomFactor;
      }
      cameraZoom = Math.max(0.2, Math.min(cameraZoom, 20.0));

      const newServerPos = getMouseServerPos(mouseX, mouseY);
      cameraPanX += (newServerPos.x - oldServerPos.x);
      cameraPanY += (newServerPos.y - oldServerPos.y);
    }
  });
  const elTimer = document.getElementById('game-timer');
  if (elTimer) {
    elTimer.addEventListener('click', (e) => {
      if (e.button === 0) {
        e.preventDefault();
        socket.emit('changeGameSpeed', { direction: 'up' });
      }
    });
    elTimer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      socket.emit('changeGameSpeed', { direction: 'down' });
    });
  }
  document.getElementById('btn-warp').addEventListener('click', () => { warpOrderNext = !warpOrderNext; });
  document.getElementById('btn-bomb').addEventListener('click', () => { bombOrderNext = bombOrderNext === 'eco' ? false : 'eco'; });
  document.getElementById('btn-bomb-ships').addEventListener('click', () => { bombOrderNext = bombOrderNext === 'ships' ? false : 'ships'; });
  document.getElementById('btn-scout').addEventListener('click', () => {
    const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
    const techBonus = myPlayer ? Math.sqrt(myPlayer.techScore || 0) : 0;
    if (techBonus >= 10) {
      scoutModeNext = !scoutModeNext;
    }
  });
  document.getElementById('btn-cruiser').addEventListener('click', () => { cruiserBuildModeActive = !cruiserBuildModeActive; });
  const handleClassBuildTrigger = (classType, selectedPlanetBuild) => {
    if (!selectedPlanetBuild) return;

    // Check if there are saved configurations for this class
    const savedConfigs = JSON.parse(localStorage.getItem('planetwars_ship_configs') || '[]');
    const classConfigs = savedConfigs.filter(cfg => cfg.classType === classType);

    if (classConfigs.length === 0) {
      // Build basic immediately
      const cfg = SHIP_CLASSES[classType];
      if (cfg) {
        const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
        const builtClasses = myPlayer ? (myPlayer.builtClasses || {}) : {};
        
        const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
        const idx = keys.indexOf(classType);
        let isUnlocked = true;
        if (idx > 0 && classType !== 'corvette') {
          const prevClass = keys[idx - 1];
          if (!builtClasses[prevClass]) {
            isUnlocked = false;
          }
        }

        if (isUnlocked) {
          const isFirst = !builtClasses[classType];
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
            if (myPlayer) {
              const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
              const idxKeys = keys.indexOf(classType);
              if (idxKeys > 0) {
                const prevClass = keys[idxKeys - 1];
                const prevCount = (myPlayer.buildCounts && myPlayer.buildCounts[prevClass]) || 0;
                const subsequentBuilds = Math.max(0, prevCount - 1);
                costMult = Math.max(1.0, baseMult - subsequentBuilds * 0.5 * (baseMult - 1.0));
              }
            }
          }
          let costShips = cfg.costShips * costMult;
          if (!(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf)) {
            costShips *= 2;
          }

          const creditsAvailable = selectedPlanetBuild.isMilitary
            ? getCreditsAvailableForConfig(myPlayer)
            : ((isFirst || !(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf))
              ? ((myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0)
              : 0);
          const canAfford = (selectedPlanetBuild.ships + creditsAvailable) >= costShips && (selectedPlanetBuild.maxShips - cfg.costCap) >= 55;
          if (canAfford) {
            socket.emit('buildCapitalShip', { planetId: selectedPlanetBuild.id, classType });
          }
        }
      } else {
        socket.emit('buildCapitalShip', { planetId: selectedPlanetBuild.id, classType });
      }
      activeConfigClassType = null;
    } else {
      if (activeConfigClassType === classType) {
        // Second press -> build basic (with afford validation)
        const cfg = SHIP_CLASSES[classType];
        if (cfg) {
          const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
          const builtClasses = myPlayer ? (myPlayer.builtClasses || {}) : {};
          
          const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
          const idx = keys.indexOf(classType);
          let isUnlocked = true;
          if (idx > 0 && classType !== 'corvette') {
            const prevClass = keys[idx - 1];
            if (!builtClasses[prevClass]) {
              isUnlocked = false;
            }
          }

          if (isUnlocked) {
            const isFirst = !builtClasses[classType];
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
              if (myPlayer) {
                const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
                const idxKeys = keys.indexOf(classType);
                if (idxKeys > 0) {
                  const prevClass = keys[idxKeys - 1];
                  const prevCount = (myPlayer.buildCounts && myPlayer.buildCounts[prevClass]) || 0;
                  const subsequentBuilds = Math.max(0, prevCount - 1);
                  costMult = Math.max(1.0, baseMult - subsequentBuilds * 0.5 * (baseMult - 1.0));
                }
              }
            }
            let costShips = cfg.costShips * costMult;
            if (!(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf)) {
              costShips *= 2;
            }

            const creditsAvailable = selectedPlanetBuild.isMilitary
              ? getCreditsAvailableForConfig(myPlayer)
              : ((isFirst || !(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf))
                ? ((myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0)
                : 0);
            const canAfford = (selectedPlanetBuild.ships + creditsAvailable) >= costShips && (selectedPlanetBuild.maxShips - cfg.costCap) >= 55;
            if (canAfford) {
              socket.emit('buildCapitalShip', { planetId: selectedPlanetBuild.id, classType });
            }
          }
        } else {
          socket.emit('buildCapitalShip', { planetId: selectedPlanetBuild.id, classType });
        }
        activeConfigClassType = null;
      } else {
        // First press -> show configurations
        activeConfigClassType = classType;
      }
    }
  };

  const bindBuildButton = (btnId, classType) => {
    const el = document.getElementById(btnId);
    if (el) {
      el.addEventListener('click', () => {
        const selectedPlanetBuild = selectedPlanets.length === 1 ? selectedPlanets[0] : null;
        if (selectedPlanetBuild) {
          handleClassBuildTrigger(classType, selectedPlanetBuild);
        }
      });
    }
  };
  bindBuildButton('btn-build-corvette', 'corvette');
  bindBuildButton('btn-build-frigate', 'frigate');
  bindBuildButton('btn-build-destroyer', 'destroyer');
  bindBuildButton('btn-build-cruiser', 'cruiser');
  bindBuildButton('btn-build-battlecruiser', 'battlecruiser');
  bindBuildButton('btn-build-battleship', 'battleship');
  bindBuildButton('btn-build-titan', 'titan');
  bindBuildButton('btn-build-mammoth', 'mammoth');
  const elBuildCancel = document.getElementById('btn-build-cancel');
  if (elBuildCancel) {
    elBuildCancel.addEventListener('click', () => {
      cruiserBuildModeActive = false;
    });
  }

  const selCruiserPackage = document.getElementById('sel-cruiser-package');
  if (selCruiserPackage) {
    selCruiserPackage.addEventListener('change', (e) => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const val = e.target.value;
        for (const ship of selectedCruisers) {
          ship.package = val;
          if (val === 'brute' && ship.strategy === 'short') {
            ship.strategy = 'normal';
          }
        }
        socket.emit('setCruiserPackage', { shipIds: selectedCruisers.map(c => c.id), value: val });
      }
    });
  }

  const selCruiserTactics = document.getElementById('sel-cruiser-tactics');
  if (selCruiserTactics) {
    selCruiserTactics.addEventListener('change', (e) => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const val = e.target.value;
        for (const ship of selectedCruisers) {
          ship.tactics = val;
        }
        socket.emit('setCruiserTactics', { shipIds: selectedCruisers.map(c => c.id), value: val });
      }
    });
  }

  const selCruiserStrategy = document.getElementById('sel-cruiser-strategy');
  if (selCruiserStrategy) {
    selCruiserStrategy.addEventListener('change', (e) => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const val = e.target.value;
        for (const ship of selectedCruisers) {
          ship.strategy = val;
        }
        socket.emit('setCruiserStrategy', { shipIds: selectedCruisers.map(c => c.id), value: val });
      }
    });
  }


  const btnPatrolEl = document.getElementById('btn-patrol');
  if (btnPatrolEl) {
    btnPatrolEl.addEventListener('click', () => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const anyNotPatrolling = selectedCruisers.some(c => !c.isPatrolling);
        const nextState = anyNotPatrolling;
        for (const ship of selectedCruisers) {
          ship.isPatrolling = nextState;
          if (nextState) {
            ship.isScouting = false;
            ship.isResearching = false;
            ship.isDiplomacy = false;
          }
          socket.emit('toggleCruiserPatrol', { shipId: ship.id, enabled: nextState });
        }
      }
    });
  }
  const btnCruiserScoutEl = document.getElementById('btn-cruiser-scout');
  if (btnCruiserScoutEl) {
    btnCruiserScoutEl.addEventListener('click', () => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const anyNotScouting = selectedCruisers.some(c => !c.isScouting);
        const nextState = anyNotScouting;
        for (const ship of selectedCruisers) {
          ship.isScouting = nextState;
          if (nextState) {
            ship.isPatrolling = false;
            ship.isResearching = false;
            ship.isDiplomacy = false;
          }
          socket.emit('toggleCruiserScout', { shipId: ship.id, enabled: nextState });
        }
      }
    });
  }
  const btnCruiserAttackEl = document.getElementById('btn-cruiser-attack');
  if (btnCruiserAttackEl) {
    btnCruiserAttackEl.addEventListener('click', () => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const anyNotAttacking = selectedCruisers.some(c => !c.scoutAttackEnabled);
        const nextState = anyNotAttacking;
        for (const ship of selectedCruisers) {
          ship.scoutAttackEnabled = nextState;
          socket.emit('toggleCruiserScoutAttack', { shipId: ship.id, enabled: nextState });
        }
      }
    });
  }

  const btnCruiserUseResourcesEl = document.getElementById('btn-cruiser-use-resources');
  if (btnCruiserUseResourcesEl) {
    btnCruiserUseResourcesEl.addEventListener('click', () => {
      const selectedCruisers = getSelectedCruisers();
      if (selectedCruisers.length > 0) {
        const anyNotUsing = selectedCruisers.some(c => !c.useResources);
        const nextState = anyNotUsing;
        for (const ship of selectedCruisers) {
          ship.useResources = nextState;
          socket.emit('toggleCruiserUseResources', { shipId: ship.id, enabled: nextState });
        }
      } else if (selectedPlanets.length > 0) {
        const anyNotUsing = selectedPlanets.some(p => !p.useResources);
        const nextState = anyNotUsing;
        for (const p of selectedPlanets) {
          p.useResources = nextState;
          socket.emit('togglePlanetUseResources', { planetId: p.id, enabled: nextState });
        }
      }
    });
  }


  const btnDismantleEl = document.getElementById('btn-dismantle');
  if (btnDismantleEl) {
    btnDismantleEl.addEventListener('click', () => {
      const selectedCruisers = getSelectedCruisers();
      const eligibleCruisers = selectedCruisers.filter(c => !c.isDismantling && isCruiserInFriendlyGravityWell(c));
      if (eligibleCruisers.length > 0) {
        if (!confirmingDismantle) {
          confirmingDismantle = true;
          btnDismantleEl.innerHTML = '<span class="btn-icon">♻️</span>Confirm "D"ismantle';
        } else {
          socket.emit('dismantleCruisers', { shipIds: eligibleCruisers.map(c => c.id) });
          for (const c of eligibleCruisers) {
            c.isDismantling = true;
          }
          confirmingDismantle = false;
          btnDismantleEl.innerHTML = '<span class="btn-icon">♻️</span>D';
        }
      }
    });
  }
  const btnUpgradeEl = document.getElementById('btn-upgrade-mode');
  if (btnUpgradeEl) {
    btnUpgradeEl.addEventListener('click', () => {
      const qual = getSelectedCruiserUpgradeQualifiers();
      if (qual) {
        upgradeModeActive = true;
      }
    });
  }



  const btnFocusEl = document.getElementById('btn-focus-mode');
  if (btnFocusEl) {
    btnFocusEl.addEventListener('click', () => {
      const planet = getSelectedPlanetForFocus();
      if (planet) {
        focusModeActive = true;
      }
    });
  }

  const registerFocusBtn = (id, mode) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        const planet = getSelectedPlanetFocusQualifiers();
        if (planet) {
          socket.emit('changePlanetFocus', { planetId: planet.id, focusMode: mode });
          focusModeActive = false;
        }
      });
    }
  };

  registerFocusBtn('btn-focus-economy', 'economy');
  registerFocusBtn('btn-focus-research', 'research');
  registerFocusBtn('btn-focus-garrison', 'garrison');
  registerFocusBtn('btn-focus-commerce', 'commerce');
  registerFocusBtn('btn-focus-mining', 'mining');
  registerFocusBtn('btn-focus-terraforming', 'terraforming');
  registerFocusBtn('btn-focus-homeworld', 'homeworld');

  // Bind Sci-Fi Planetary Resources UI window actions & bank sell button

  window.adjustResourceOffer = (res, amount, e) => {
    if (e) {
      e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
    }
    const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
    if (myPlayer) {
      const curVal = myPlayer.offerPrice?.[res] ?? 3;
      socket.emit('setResourceOfferPrice', { resource: res, value: curVal + amount });
    }
  };
  window.adjustResourceBuy = (res, amount, e) => {
    if (e) {
      e.stopPropagation();
      if (e.preventDefault) e.preventDefault();
    }
    const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
    if (myPlayer) {
      const curVal = myPlayer.buyPrice?.[res] ?? 2;
      socket.emit('setResourceBuyPrice', { resource: res, value: curVal + amount });
    }
  };
  window.toggleResourceSellCard = (res) => {
    socket.emit('toggleResourceSell', { resource: res });
  };
  window.changeSellPriceSetting = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
    if (!myPlayer) return;
    
    const isCtrl = e && e.ctrlKey;
    if (isCtrl) {
      socket.emit('setAllAutoBuysToSellPrice');
      return;
    }
    
    const isRightClick = e && (e.button === 2 || e.type === 'contextmenu');
    const isShift = e && e.shiftKey;
    
    let step = isShift ? 5 : 1;
    if (isRightClick) step = -step;
    
    const currentPrice = myPlayer.sellPriceSetting !== undefined ? myPlayer.sellPriceSetting : 1;
    const newPrice = Math.max(1, currentPrice + step);
    
    socket.emit('changeSellPriceSetting', { value: newPrice });
  };

  const sellForDisplayButton = document.getElementById('player-sell-for-display');
  if (sellForDisplayButton) {
    sellForDisplayButton.addEventListener('click', (e) => {
      window.changeSellPriceSetting(e);
    });
    sellForDisplayButton.addEventListener('contextmenu', (e) => {
      window.changeSellPriceSetting(e);
    });
  }

  const btnSellResources = document.getElementById('btn-sell-resources');
  if (btnSellResources) {
    btnSellResources.addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('sellResourcesToBank');
    });
  }

  const btnCreditsDisplay = document.getElementById('player-credits-display');
  if (btnCreditsDisplay) {
    btnCreditsDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('toggleUseCredits');
    });

    btnCreditsDisplay.addEventListener('mouseenter', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = 'credits';
        const rect = btnCreditsDisplay.getBoundingClientRect();
        tooltipPanel.style.left = `${rect.left + window.scrollX}px`;
        tooltipPanel.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltipPanel.style.display = 'block';
      }
    });

    btnCreditsDisplay.addEventListener('mouseleave', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = '';
        tooltipPanel.style.display = 'none';
      }
    });
  }

  const tradeOptionsDisplayBtn = document.getElementById('player-trade-options-display');
  if (tradeOptionsDisplayBtn) {
    tradeOptionsDisplayBtn.style.cursor = 'pointer';
    tradeOptionsDisplayBtn.style.pointerEvents = 'auto';
    tradeOptionsDisplayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('toggleTradeLimit');
    });
    tradeOptionsDisplayBtn.addEventListener('mouseenter', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = 'trade';
        tooltipPanel.innerHTML = `
          <div style="font-weight: bold; font-size: 0.85rem; color: #ff9800; border-bottom: 1px solid rgba(255, 152, 0, 0.3); padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Trade Options</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #aaa; line-height: 1.3;">
            Toggles auto-resource usage for cruisers. Must be ON to automatically consume resources for special bonuses/costs.
          </div>
        `;
        const rect = tradeOptionsDisplayBtn.getBoundingClientRect();
        tooltipPanel.style.left = `${rect.left + window.scrollX}px`;
        tooltipPanel.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltipPanel.style.display = 'block';
      }
    });
    tradeOptionsDisplayBtn.addEventListener('mouseleave', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = '';
        tooltipPanel.style.display = 'none';
      }
    });
  }

  const commandLimitDisplayBtn = document.getElementById('player-command-limit-display');
  if (commandLimitDisplayBtn) {
    commandLimitDisplayBtn.style.cursor = 'pointer';
    commandLimitDisplayBtn.style.pointerEvents = 'auto';
    commandLimitDisplayBtn.addEventListener('mouseenter', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = 'command';
        tooltipPanel.innerHTML = `
          <div style="font-weight: bold; font-size: 0.85rem; color: #00e5ff; border-bottom: 1px solid rgba(0, 229, 255, 0.3); padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Command Limit</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #aaa; line-height: 1.4;">
            Command capacity. Homeworlds + Garrison planets.<br><br>
            <span style="color: #00e5ff; font-weight: bold;">Calculation:</span><br>
            • Base: 1 + ceil(Planet Count / 3)<br>
            • Garrison Focus: +1 per Garrison planet<br>
            • Full Garrison: +1 per fully garrisoned planet<br>
            • Controlled Homeworlds: +1 per controlled Homeworld<br>
            • Own Homeworld: +1 if controlling own Homeworld
          </div>
        `;
        const rect = commandLimitDisplayBtn.getBoundingClientRect();
        tooltipPanel.style.left = `${rect.left + window.scrollX}px`;
        tooltipPanel.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltipPanel.style.display = 'block';
      }
    });
    commandLimitDisplayBtn.addEventListener('mouseleave', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = '';
        tooltipPanel.style.display = 'none';
      }
    });
  }

  const stockpileCapacityDisplayBtn = document.getElementById('player-stockpile-capacity-display');
  if (stockpileCapacityDisplayBtn) {
    stockpileCapacityDisplayBtn.style.cursor = 'pointer';
    stockpileCapacityDisplayBtn.style.pointerEvents = 'auto';
    stockpileCapacityDisplayBtn.addEventListener('mouseenter', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = 'stockpile';
        tooltipPanel.innerHTML = `
          <div style="font-weight: bold; font-size: 0.85rem; color: #e91e63; border-bottom: 1px solid rgba(233, 30, 99, 0.3); padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Stockpile Capacity</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #aaa; line-height: 1.3;">
            Resource Stockpile Capacity = Command Capacity + Trade Capacity.<br><br>
            If exceeded, a Resource Storage Fee is charged every second:<br>
            <span style="color: #ff5252; font-weight: bold;">Fee = (excess resources / capacity) rounded up</span>,<br>
            deducted from credits first. If out of credits, resources are deducted starting with the highest stockpiles first.
          </div>
        `;
        const rect = stockpileCapacityDisplayBtn.getBoundingClientRect();
        tooltipPanel.style.left = `${rect.left + window.scrollX}px`;
        tooltipPanel.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltipPanel.style.display = 'block';
      }
    });
    stockpileCapacityDisplayBtn.addEventListener('mouseleave', () => {
      const tooltipPanel = document.getElementById('credits-tooltip-panel');
      if (tooltipPanel) {
        tooltipPanel.dataset.source = '';
        tooltipPanel.style.display = 'none';
      }
    });
  }

  const resourcesListForClicks = ['dilithium', 'merculite', 'duranium', 'tritanium', 'antimatter', 'deuterium', 'latinum'];
  for (const res of resourcesListForClicks) {
    const card = document.getElementById(`res-card-${res}`);
    if (card) {
      card.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button === 2) {
          socket.emit('postFulfillOrder', { resource: res });
        } else if (e.ctrlKey) {
          const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
          const priceVal = myPlayer ? (myPlayer.sellPriceSetting ?? 1) : 1;
          socket.emit('createAutoBuyOrder', { resource: res, price: priceVal });
        } else {
          socket.emit('postSellOrder', { resource: res });
        }
      });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }
  }

  socket.on('purchaseSuccess', () => {
    playChaChingSound();
  });

  const btnFocusCancel = document.getElementById('btn-focus-cancel');
  if (btnFocusCancel) {
    btnFocusCancel.addEventListener('click', () => {
      focusModeActive = false;
    });
  }

  const upgradeToSocketTypeMap = {
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
    command: 'command'
  };

  const registerUpgradeBtn = (id, type) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        const qual = getSelectedCruiserUpgradeQualifiers();
        if (qual) {
          const ship = qual.ship;
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

          const maxIndividualLevel = Math.floor((ship.maxHealth || 0) / 10);
          const maxTotalUpgrades = Math.floor((ship.maxHealth || 0) / 5);

          const currentVal = ship[type] || 0;
          const nextLevel = currentVal + 1;

          let shieldCheck = true;
          if (type === 'shields') {
            const rawTech = localPlayer ? localPlayer.techScore || 0 : 0;
            const rawExp = localPlayer ? localPlayer.expScore || 0 : 0;
            const shipExp = ship.expScore || 0;
            const techBonus = Math.sqrt(rawTech);
            const expBonus = Math.sqrt(rawExp);
            const shipExpBonus = Math.sqrt(shipExp);
            const baseDeflection = ship.maxHealth + (techBonus + expBonus + shipExpBonus);
            const deflectionRem = 100 - baseDeflection;
            const nextShieldDeflectionBonus = nextLevel * (deflectionRem / 5);
            const newDeflection = baseDeflection + nextShieldDeflectionBonus;
            if (newDeflection > 90) {
              shieldCheck = false;
            }
          }

          if (ship.upgradeTokens > 0) {
            if (currentVal < 5 && nextLevel <= Math.min(5, maxIndividualLevel) && shieldCheck) {
              const socketType = upgradeToSocketTypeMap[type] || type;
              console.log(`[Upgrade Click] Token Button: ${id}, type: ${type}, socketType: ${socketType}, shipId: ${qual.ship.id}`);
              socket.emit('upgradeCruiser', { shipId: qual.ship.id, type: socketType });
            } else {
              console.log(`[Upgrade Click Rejected] Token limits failed. type: ${type}, currentVal: ${currentVal}, nextLevel: ${nextLevel}, maxLevel: ${maxIndividualLevel}, shieldCheck: ${shieldCheck}`);
            }
            upgradeModeActive = false;
            return;
          }

          if (currentVal < 5 && nextLevel <= maxIndividualLevel && (totalUpgrades + 1) <= maxTotalUpgrades && shieldCheck) {
            const socketType = upgradeToSocketTypeMap[type] || type;
            console.log(`[Upgrade Click] Button: ${id}, type: ${type}, socketType: ${socketType}, shipId: ${qual.ship.id}`);
            socket.emit('upgradeCruiser', { shipId: qual.ship.id, type: socketType });
          } else {
            console.log(`[Upgrade Click Rejected] Limits failed. type: ${type}, currentVal: ${currentVal}, nextLevel: ${nextLevel}, maxLevel: ${maxIndividualLevel}, totalUpgrades: ${totalUpgrades}, maxTotalUpgrades: ${maxTotalUpgrades}`);
          }
          upgradeModeActive = false;
        }
      });
    }
  };

  registerUpgradeBtn('btn-up-sensorarray', 'sensorarrays');
  registerUpgradeBtn('btn-up-lab', 'labs');
  registerUpgradeBtn('btn-up-armor', 'armor');
  registerUpgradeBtn('btn-up-shields', 'shields');
  registerUpgradeBtn('btn-up-engine', 'engine');
  registerUpgradeBtn('btn-up-munitions', 'munitions');
  registerUpgradeBtn('btn-up-targeting', 'targeting');
  registerUpgradeBtn('btn-up-damagecontrol', 'damagecontrol');
  registerUpgradeBtn('btn-up-fueltanker', 'fuel_tanker');
  registerUpgradeBtn('btn-up-diplomat', 'diplomat');
  registerUpgradeBtn('btn-up-marines', 'marines');
  registerUpgradeBtn('btn-up-command', 'command');

  const btnUpCancel = document.getElementById('btn-up-cancel');
  if (btnUpCancel) {
    btnUpCancel.addEventListener('click', () => {
      upgradeModeActive = false;
    });
  }
  function updateButtonHighlights() {
    const toggle = (id, active) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('action-btn-active', !!active);
    };
    toggle('btn-warp', warpOrderNext);
    toggle('btn-bomb', bombOrderNext === 'eco');
    toggle('btn-bomb-ships', bombOrderNext === 'ships');
    toggle('btn-scout', scoutModeNext);
    toggle('btn-cruiser', cruiserBuildModeActive);


  }


  startBtn.addEventListener('click', () => {
    console.log('startBtn clicked!');
    startScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    const fogOfWar = document.getElementById('fog-of-war-checkbox').checked;
    const smallEmpires = document.getElementById('small-empires-checkbox').checked;
    const noRampagers = document.getElementById('no-rampagers-checkbox').checked;
    const enableCheats = document.getElementById('cheats-checkbox').checked;
    const aiCount = parseInt(document.getElementById('ai-count-input').value, 10);
    const productionMultiple = parseFloat(document.getElementById('production-multiple-input').value) || 1.0;
    const mapSize = parseInt(document.getElementById('map-size-input').value, 10) || 2000;
    const planetCount = parseInt(document.getElementById('planet-count-input').value, 10) || 60;
    const clustersInput = document.getElementById('clusters-input');
    const clusters = clustersInput ? (parseInt(clustersInput.value, 10) || 0) : 0;
    const hazardMultiple = parseFloat(document.getElementById('hazard-multiple-input').value);
    const hm = isNaN(hazardMultiple) ? 1.0 : hazardMultiple;
    const timedGameSelect = document.getElementById('timed-game-select');
    let timedGameLimit = timedGameSelect ? timedGameSelect.value : "3600";
    if (timedGameLimit === 'custom') {
      const timedGameInput = document.getElementById('timed-game-input');
      const customMin = timedGameInput ? parseFloat(timedGameInput.value) : 60;
      timedGameLimit = String(Math.round((isNaN(customMin) ? 60 : customMin) * 60));
    }
    let homeworldSizeSetting = homeworldSizeSelect ? homeworldSizeSelect.value : "120";
    if (homeworldSizeSetting === 'custom') {
      const homeworldSizeInput = document.getElementById('homeworld-size-input');
      const customVal = homeworldSizeInput ? parseInt(homeworldSizeInput.value, 10) : 120;
      homeworldSizeSetting = isNaN(customVal) ? "120" : String(customVal);
    }
    let startingCreditsVal = startingCreditsSelect ? startingCreditsSelect.value : "0";
    if (startingCreditsVal === 'custom') {
      const startingCreditsInput = document.getElementById('starting-credits-input');
      const customCredits = startingCreditsInput ? parseInt(startingCreditsInput.value, 10) : 0;
      startingCreditsVal = isNaN(customCredits) ? "0" : String(customCredits);
    }
    const raceSelect = document.getElementById('player-race-select');
    const selectedRace = raceSelect ? raceSelect.value : 'Random';
    if (raceSelect) {
      localStorage.setItem('planetWarsPlayerRace', selectedRace);
    }
    const aiEntrySel = document.getElementById('ai-entry-select');
    const aiEntry = aiEntrySel ? aiEntrySel.value : 'mid';
    const customAiEntryIn = document.getElementById('custom-ai-entry-input');
    const customAiEntryMin = customAiEntryIn ? parseFloat(customAiEntryIn.value) : 5;

    const payload = { fogOfWar, smallEmpires, noRampagers, aiCount: isNaN(aiCount) ? 6 : aiCount, productionMultiple, mapSize, planetCount, clusters, hazardMultiple: hm, timedGameLimit, homeworldSize: homeworldSizeSetting, startingCredits: parseInt(startingCreditsVal, 10), graphicalMode: !!graphicalMode, enableCheats, race: selectedRace, aiEntry, customAiEntryMin: isNaN(customAiEntryMin) ? 5 : customAiEntryMin };

    if (startBtn.textContent === 'START GAME') {
      hasCenteredOnHomeworld = false;
      serverState = null; // Clear old state so we don't draw it while waiting for the new one
      lastKnownPlanets = {}; // Clear cached planet details
      socket.emit('restartGame', payload);
    } else {
      socket.emit('enterGame', payload);
    }
  });

  restartBtn.addEventListener('click', () => {
    console.log('restartBtn clicked!');
    endScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    if (serverState) serverState.isRunning = true;
    megalovaniaPlayed = false;
    const musicCheckbox = document.getElementById('music-checkbox');
    const bgMusic = document.getElementById('bg-music');
    if (musicCheckbox && musicCheckbox.checked && bgMusic) {
      playRandomIntroTrack();
    } else if (bgMusic) {
      bgMusic.pause();
    }

    const fogOfWar = document.getElementById('fog-of-war-checkbox').checked;
    const smallEmpires = document.getElementById('small-empires-checkbox').checked;
    const noRampagers = document.getElementById('no-rampagers-checkbox').checked;
    const aiCount = parseInt(document.getElementById('ai-count-input').value, 10);
    const productionMultiple = parseFloat(document.getElementById('production-multiple-input').value) || 1.0;
    const mapSize = parseInt(document.getElementById('map-size-input').value, 10) || 2000;
    const planetCount = parseInt(document.getElementById('planet-count-input').value, 10) || 60;
    const clustersInput = document.getElementById('clusters-input');
    const clusters = clustersInput ? (parseInt(clustersInput.value, 10) || 0) : 0;
    const hazardMultiple = parseFloat(document.getElementById('hazard-multiple-input').value);
    const hm = isNaN(hazardMultiple) ? 1.0 : hazardMultiple;
    const timedGameSelect = document.getElementById('timed-game-select');
    let timedGameLimit = timedGameSelect ? timedGameSelect.value : "3600";
    if (timedGameLimit === 'custom') {
      const timedGameInput = document.getElementById('timed-game-input');
      const customMin = timedGameInput ? parseFloat(timedGameInput.value) : 60;
      timedGameLimit = String(Math.round((isNaN(customMin) ? 60 : customMin) * 60));
    }
    let homeworldSizeSetting = homeworldSizeSelect ? homeworldSizeSelect.value : "120";
    if (homeworldSizeSetting === 'custom') {
      const homeworldSizeInput = document.getElementById('homeworld-size-input');
      const customVal = homeworldSizeInput ? parseInt(homeworldSizeInput.value, 10) : 120;
      homeworldSizeSetting = isNaN(customVal) ? "120" : String(customVal);
    }
    let startingCreditsVal = startingCreditsSelect ? startingCreditsSelect.value : "0";
    if (startingCreditsVal === 'custom') {
      const startingCreditsInput = document.getElementById('starting-credits-input');
      const customCredits = startingCreditsInput ? parseInt(startingCreditsInput.value, 10) : 0;
      startingCreditsVal = isNaN(customCredits) ? "0" : String(customCredits);
    }
    const aiEntrySel = document.getElementById('ai-entry-select');
    const aiEntry = aiEntrySel ? aiEntrySel.value : 'mid';
    const customAiEntryIn = document.getElementById('custom-ai-entry-input');
    const customAiEntryMin = customAiEntryIn ? parseFloat(customAiEntryIn.value) : 5;

    hasCenteredOnHomeworld = false;
    resetClientModeFlags();
    serverState = null;
    lastKnownPlanets = {}; // Clear cached planet details
    socket.emit('restartGame', { fogOfWar, smallEmpires, noRampagers, aiCount: isNaN(aiCount) ? 6 : aiCount, productionMultiple, mapSize, planetCount, clusters, hazardMultiple: hm, timedGameLimit, homeworldSize: homeworldSizeSetting, startingCredits: parseInt(startingCreditsVal, 10), graphicalMode: !!graphicalMode, aiEntry, customAiEntryMin: isNaN(customAiEntryMin) ? 5 : customAiEntryMin });
  });

  if (lobbyBtn) {
    lobbyBtn.addEventListener('click', () => {
      endScreen.classList.add('hidden');
      startScreen.classList.remove('hidden');
      lockedSettings = false;
      const fogCheck = document.getElementById('fog-of-war-checkbox');
      const aiInput = document.getElementById('ai-count-input');
      if (fogCheck) fogCheck.disabled = false;
      if (aiInput) aiInput.disabled = false;
      startBtn.textContent = 'ENTER GAME';
      if (setupOptionsContainer) setupOptionsContainer.style.display = 'none';
      if (setupNewGameBtn) setupNewGameBtn.style.display = 'block';
    });
  }

  function draw() {
    if (keysDown['ArrowUp']) cameraPanY += 40 / cameraZoom;
    if (keysDown['ArrowDown']) cameraPanY -= 40 / cameraZoom;
    if (keysDown['ArrowLeft']) cameraPanX += 40 / cameraZoom;
    if (keysDown['ArrowRight']) cameraPanX -= 40 / cameraZoom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;

    // Dynamic button visibility
    const selectedCruiser = getSelectedCruiser();
    if (!selectedCruiser || (lastSelectedCruiserId !== null && selectedCruiser.id !== lastSelectedCruiserId)) {
      upgradeModeActive = false;
    }
    lastSelectedCruiserId = selectedCruiser ? selectedCruiser.id : null;
    const upgradeQual = getSelectedCruiserUpgradeQualifiers();

    const btnFocusMode = document.getElementById('btn-focus-mode');
    const focusButtonsMap = {
      'btn-focus-economy': 'economy',
      'btn-focus-research': 'research',
      'btn-focus-garrison': 'garrison',
      'btn-focus-commerce': 'commerce',
      'btn-focus-mining': 'mining',
      'btn-focus-terraforming': 'terraforming',
      'btn-focus-homeworld': 'homeworld'
    };
    const selectedPlanetFocus = getSelectedPlanetForFocus();
    if (!selectedPlanetFocus) {
      focusModeActive = false;
    }
    const focusQual = getSelectedPlanetFocusQualifiers();
    const selectedPlanetBuild = selectedPlanets.length === 1 ? selectedPlanets[0] : null;
    if (!selectedPlanetBuild || selectedPlanetBuild.isSpeedPlanet || selectedPlanetBuild.ownerId !== localPlayer.id) {
      cruiserBuildModeActive = false;
    }
    if (!cruiserBuildModeActive) {
      activeConfigClassType = null;
    }

    const btnUpgradeMode = document.getElementById('btn-upgrade-mode');
    const actionButtonsLeft = document.getElementById('action-buttons-left');
    const stdButtons = ['btn-bomb', 'btn-bomb-ships', 'btn-scout', 'btn-cruiser', 'btn-leaderboard', 'help-btn', 'btn-patrol', 'btn-cruiser-scout', 'btn-cruiser-attack', 'btn-dismantle'];
    const upButtonsMap = {
      'btn-up-sensorarray': 'sensorarrays',
      'btn-up-lab': 'labs',
      'btn-up-armor': 'armor',
      'btn-up-shields': 'shields',
      'btn-up-engine': 'engine',
      'btn-up-munitions': 'munitions',
      'btn-up-targeting': 'targeting',
      'btn-up-damagecontrol': 'damagecontrol',
      'btn-up-fueltanker': 'fuel_tanker',
      'btn-up-diplomat': 'diplomat',
      'btn-up-marines': 'marines',
      'btn-up-command': 'command'
    };

    if (focusModeActive && selectedPlanetFocus) {
      if (actionButtonsLeft) actionButtonsLeft.style.display = 'none';
      if (btnUpgradeMode) btnUpgradeMode.style.display = 'none';
      if (btnFocusMode) btnFocusMode.style.display = 'none';

      for (const btnId of stdButtons) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      for (const btnId of Object.keys(upButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const elUpCancel = document.getElementById('btn-up-cancel');
      if (elUpCancel) elUpCancel.style.display = 'none';

      const focusCost = Math.floor(selectedPlanetFocus.maxShips / 2);
      const creditsAvailable = (myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0;
      const canAffordFocus = (selectedPlanetFocus.ships + creditsAvailable) >= focusCost;
      for (const [btnId, mode] of Object.entries(focusButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) {
          let shouldShow = (selectedPlanetFocus.focusMode !== mode);
          if (mode === 'commerce' && selectedPlanetFocus.maxShips <= 100) {
            shouldShow = false;
          }
          if (mode === 'mining') {
            const hasRes = selectedPlanetFocus.resources && selectedPlanetFocus.resources.length > 0;
            if (!hasRes) {
              shouldShow = false;
            }
          }
          if (mode === 'terraforming') {
            const techBonus = Math.floor(Math.sqrt((myPlayer ? myPlayer.techScore : 0) || 0));
            const limit = Math.ceil(selectedPlanetFocus.habitability / 5);
            if (techBonus <= limit) {
              shouldShow = false;
            }
          }
          if (mode === 'homeworld') {
            const hasHomeworld = serverState && serverState.planets && localPlayer && serverState.planets.some(p => p.homeworldOf === localPlayer.id);
            if (hasHomeworld) {
              shouldShow = false;
            }
          }
          el.style.display = shouldShow ? 'inline-flex' : 'none';
          if (el.style.display === 'inline-flex') {
            const costSpan = el.querySelector('.btn-cost');
            if (costSpan) costSpan.textContent = focusCost;

            if (!canAffordFocus) {
              el.style.opacity = '0.5';
              el.style.pointerEvents = 'none';
            } else {
              el.style.opacity = '1.0';
              el.style.pointerEvents = 'auto';
            }
          }
        }
      }
      const elFocusCancel = document.getElementById('btn-focus-cancel');
      if (elFocusCancel) elFocusCancel.style.display = 'inline-flex';

    } else if (upgradeModeActive && selectedCruiser) {
      if (actionButtonsLeft) actionButtonsLeft.style.display = 'none';
      if (btnUpgradeMode) btnUpgradeMode.style.display = 'none';
      if (btnFocusMode) btnFocusMode.style.display = 'none';

      for (const btnId of Object.keys(focusButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const elFocusCancel = document.getElementById('btn-focus-cancel');
      if (elFocusCancel) elFocusCancel.style.display = 'none';

      for (const btnId of stdButtons) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const namesMap = {
        'btn-up-sensorarray': 'Sensor Array (S)',
        'btn-up-lab': 'Lab (L)',
        'btn-up-armor': 'Armor (A)',
        'btn-up-shields': 'Shields (H)',
        'btn-up-engine': 'Engine (E)',
        'btn-up-munitions': 'Munitions (M)',
        'btn-up-targeting': 'Targeting Computer (T)',
        'btn-up-damagecontrol': 'Damage Control (D)',
        'btn-up-fueltanker': 'Fuel Tanker (F)',
        'btn-up-diplomat': 'Diplomat (I)',
        'btn-up-marines': 'Marines (R)',
        'btn-up-command': 'Command (C)'
      };

      const descMap = {
        'sensorarrays': 'Adds +25 to base sensor range and +25% total range per level to reveal the fog of war',
        'labs': 'Adds +1 Lab research tick speed per level (up to +5) to generate tech points',
        'armor': 'Adds +4 flat + 10% max health armor points per level to withstand damage',
        'shields': 'Shield deflection increases by 1/5 of remaining deflection per level with no cap',
        'engine': 'Adds +3 speed and +3°/sec turn rate per level for highly responsive steering',
        'munitions': 'Adds +1 bomb capacity and +1 splash damage rating per level to standard weapon dogfights',
        'targeting': 'Adds +5% weapon range and +5% laser accuracy hit chance per level in combat',
        'damagecontrol': 'Adds +50% out-of-combat repair and +20% deep-space/in-combat repair rate per level',
        'fuel_tanker': 'Adds +5 fuel capacity, +15 max supplies, and +(25 + level*10)% supply cost discount per level. Reduces speed by -3, accuracy by -5, range by -5 per level',
        'diplomat': 'Adds diplomat subversion to project 1 passive sympathy/min or reduce 1 enemy sympathy/min',
        'marines': 'Adds +1 marine capacity factor per level to drastically boost planetary boarding success',
        'command': 'Gives command points equal to (xp bonus * level) / 4 to ships in sensor range. Stacks. Caps at 1.5 * highest xp bonus among commanders. Points act as local xp bonus and add 1/2 value to speed'
      };

      const totalUpgrades = (selectedCruiser.sensorarrays || 0) +
                            (selectedCruiser.labs || 0) +
                            (selectedCruiser.armor || 0) +
                            (selectedCruiser.shields || 0) +
                            (selectedCruiser.engine || 0) +
                            (selectedCruiser.munitions || 0) +
                            (selectedCruiser.targeting || 0) +
                            (selectedCruiser.damagecontrol || 0) +
                            (selectedCruiser.fuel_tanker || 0) +
                            (selectedCruiser.diplomat || 0) +
                            (selectedCruiser.marines || 0) +
                            (selectedCruiser.command || 0);

      const maxIndividualLevel = Math.floor((selectedCruiser.maxHealth || 0) / 10);
      const maxTotalUpgrades = Math.floor((selectedCruiser.maxHealth || 0) / 5);

      const hasTokens = selectedCruiser.upgradeTokens > 0;

      for (const [btnId, prop] of Object.entries(upButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) {
          const currentVal = selectedCruiser[prop] || 0;
          const nextLevel = currentVal + 1;
          const levelAllowed = nextLevel <= maxIndividualLevel;
          const totalAllowed = (totalUpgrades + 1) <= maxTotalUpgrades;
          const shieldCheck = (prop !== 'shields' || nextLevel * 0.10 <= 0.80);
          const tokenAllowed = hasTokens && (nextLevel <= Math.min(5, maxIndividualLevel));
          
          const displayUpgrade = currentVal < 5 && !selectedCruiser.isUpgrading && shieldCheck && (tokenAllowed || (levelAllowed && totalAllowed));
          
          el.style.display = displayUpgrade ? 'inline-flex' : 'none';
          if (el.style.display === 'inline-flex') {
            const uCost = getUpgradeCostForShip(selectedCruiser, prop);
            const baseName = namesMap[btnId] || 'Upgrade';
            const desc = descMap[prop] || 'Upgrades cruiser capabilities';
            el.setAttribute('title', `${baseName}: ${desc}`);
            const costSpan = el.querySelector('.btn-cost');
            if (costSpan) {
              costSpan.textContent = hasTokens ? '1 Token' : uCost;
            }

            const discountSpan = el.querySelector('.btn-discount');
            if (discountSpan) {
              if (hasTokens) {
                discountSpan.textContent = '';
              } else {
                const disc = getPlayerSpecificDiscountForShip(selectedCruiser, prop);
                discountSpan.textContent = disc !== 0 ? (disc > 0 ? `+${disc}%` : `${disc}%`) : '';
              }
            }

            const creditsAvailable = (myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0;
            const canAfford = hasTokens || (upgradeQual && (upgradeQual.planet.ships + creditsAvailable) >= uCost);
            if (!canAfford) {
              el.style.opacity = '0.5';
              el.style.pointerEvents = 'none';
            } else {
              el.style.opacity = '1.0';
              el.style.pointerEvents = 'auto';
            }
          }
        }
      }
      const elCancel = document.getElementById('btn-up-cancel');
      if (elCancel) elCancel.style.display = 'inline-flex';

    } else if (cruiserBuildModeActive && selectedPlanetBuild) {
      if (actionButtonsLeft) actionButtonsLeft.style.display = 'none';
      if (btnUpgradeMode) btnUpgradeMode.style.display = 'none';
      if (btnFocusMode) btnFocusMode.style.display = 'none';
      for (const btnId of stdButtons) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      for (const btnId of Object.keys(upButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const elUpCancel = document.getElementById('btn-up-cancel');
      if (elUpCancel) elUpCancel.style.display = 'none';
      for (const btnId of Object.keys(focusButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const elFocusCancel = document.getElementById('btn-focus-cancel');
      if (elFocusCancel) elFocusCancel.style.display = 'none';

      for (const [classType, cfg] of Object.entries(SHIP_CLASSES)) {
        const el = document.getElementById(cfg.btnId);
        if (el) {
          const builtClasses = myPlayer ? (myPlayer.builtClasses || {}) : {};
          
          // Check unlock requirement: except for corvettes, previous class must be built
          const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
          const idx = keys.indexOf(classType);
          let isUnlocked = true;
          let lockReason = '';
          if (idx > 0 && classType !== 'corvette') {
            const prevClass = keys[idx - 1];
            if (!builtClasses[prevClass]) {
              isUnlocked = false;
              const prevCfg = SHIP_CLASSES[prevClass];
              lockReason = `Requires building a ${prevCfg.name} first`;
            }
          }

          const isFirst = !builtClasses[classType];
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
            if (myPlayer) {
              const keys = ['corvette', 'destroyer', 'battlecruiser', 'titan', 'mammoth'];
              const idx = keys.indexOf(classType);
              if (idx > 0) {
                const prevClass = keys[idx - 1];
                const prevCount = (myPlayer.buildCounts && myPlayer.buildCounts[prevClass]) || 0;
                const subsequentBuilds = Math.max(0, prevCount - 1);
                costMult = Math.max(1.0, baseMult - subsequentBuilds * 0.5 * (baseMult - 1.0));
              }
            }
          }
          let costShips = cfg.costShips * costMult;
          if (selectedPlanetBuild && !(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf)) {
            costShips *= 2;
          }

          if (costMult > 1) {
            el.style.borderColor = '#ffeb3b';
            el.style.color = '#ffeb3b';
            el.style.boxShadow = '0 0 10px rgba(255, 235, 59, 0.3), inset 0 0 10px rgba(255, 235, 59, 0.3)';
          } else {
            el.style.borderColor = '';
            el.style.color = '';
            el.style.boxShadow = '';
          }

          const creditsAvailable = selectedPlanetBuild.isMilitary
            ? getCreditsAvailableForConfig(myPlayer)
            : ((isFirst || !(selectedPlanetBuild.isMilitary || selectedPlanetBuild.homeworldOf))
              ? ((myPlayer && myPlayer.useCredits !== false) ? (myPlayer.credits || 0) : 0)
              : 0);
          const canAfford = isUnlocked && (selectedPlanetBuild.ships + creditsAvailable) >= costShips && (selectedPlanetBuild.maxShips - cfg.costCap) >= 55;

          if (!canAfford) {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
          } else {
            el.style.opacity = '1.0';
            el.style.pointerEvents = 'auto';
          }

          const costSpan = el.querySelector('.btn-cost');
          if (costSpan) {
            costSpan.textContent = `${costShips}/${cfg.costCap}`;
          }
          const baseName = cfg.name;
          const shortcutKey = cfg.key.toUpperCase();
          let titleStr = '';
          if (!isUnlocked) {
            titleStr = `Build ${baseName} (LOCKED - ${lockReason})`;
          } else if (activeConfigClassType === classType) {
            titleStr = `Build Basic ${baseName} (${shortcutKey}) (Cost: ${costShips} ships/credits, Cap: ${cfg.costCap})`;
          } else {
            titleStr = `Build ${isFirst ? 'Prototype ' : ''}${baseName} (${shortcutKey}) (Credits allowed if toggled)`;
          }
          el.setAttribute('title', titleStr);

          let shouldShow = isUnlocked;
          if (activeConfigClassType && classType !== activeConfigClassType) {
            shouldShow = false;
          }
          el.style.display = shouldShow ? 'inline-flex' : 'none';
        }
      }
      const configBuildButtonsContainer = document.getElementById('config-build-buttons');
      if (configBuildButtonsContainer) {
        if (activeConfigClassType) {
          configBuildButtonsContainer.style.display = 'flex';
          updateConfigBuildButtons(myPlayer, selectedPlanetBuild);
        } else {
          configBuildButtonsContainer.style.display = 'none';
          configBuildButtonsContainer.innerHTML = '';
          configBuildButtonsContainer.removeAttribute('data-class-type');
        }
      }

      const elBuildCancel = document.getElementById('btn-build-cancel');
      if (elBuildCancel) elBuildCancel.style.display = 'inline-flex';

    } else {
      const configBuildButtonsContainer = document.getElementById('config-build-buttons');
      if (configBuildButtonsContainer) {
        configBuildButtonsContainer.style.display = 'none';
      }

      if (actionButtonsLeft) actionButtonsLeft.style.display = 'flex';
      if (btnUpgradeMode) {
        btnUpgradeMode.style.display = 'none';
        const iconSpan = btnUpgradeMode.querySelector('.btn-icon');
        if (upgradeQual) {
          btnUpgradeMode.style.display = 'inline-flex';
          const validProps = [
            'sensorarrays', 'labs', 'armor', 'shields', 'engine',
            'munitions', 'targeting', 'damagecontrol', 'fuel_tanker',
            'diplomat', 'marines'
          ];
          let minCost = Infinity;
          for (const prop of validProps) {
            const currentVal = upgradeQual.ship[prop] || 0;
            const shieldCheck = (prop !== 'shields' || (currentVal + 1) * 0.10 <= 0.80);
            if (currentVal < 5 && shieldCheck) {
              const uCost = getUpgradeCostForShip(upgradeQual.ship, prop);
              if (uCost < minCost) minCost = uCost;
            }
          }
          const hasTokens = upgradeQual.ship.upgradeTokens > 0;
          const displayCost = hasTokens ? '1 Token' : (minCost === Infinity ? 0 : minCost);
          btnUpgradeMode.setAttribute('title', `Upgrade Mode (U) (Cost: ${displayCost})`);
          const costSpan = btnUpgradeMode.querySelector('.btn-cost');
          if (costSpan) {
            costSpan.textContent = hasTokens ? '1 Token' : displayCost;
          }
          if (iconSpan) {
            if (hasTokens) {
              iconSpan.innerHTML = `⭐<span style="font-size: 0.75rem; vertical-align: top; margin-left: 2px;">${upgradeQual.ship.upgradeTokens}</span>`;
            } else {
              iconSpan.textContent = '⚙️';
            }
          }
        } else {
          if (iconSpan) {
            iconSpan.textContent = '⚙️';
          }
        }
      }
      if (btnFocusMode) btnFocusMode.style.display = 'none';

      for (const btnId of Object.keys(focusButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const elFocusCancel = document.getElementById('btn-focus-cancel');
      if (elFocusCancel) elFocusCancel.style.display = 'none';

      const hasMilitary = selectedPlanets.some(p => p.isMilitary);
      const hasCruiserBase = selectedPlanets.some(p => p.ownerId === localPlayer.id && !p.isSpeedPlanet && (p.isMilitary || (p.ships >= 50 && p.maxShips >= 57)));
      if (!hasCruiserBase) {
        cruiserBuildModeActive = false;
      }

      for (const [classType, cfg] of Object.entries(SHIP_CLASSES)) {
        const el = document.getElementById(cfg.btnId);
        if (el) el.style.display = 'none';
      }
      const elBuildCancel = document.getElementById('btn-build-cancel');
      if (elBuildCancel) elBuildCancel.style.display = 'none';

      const btnBomb = document.getElementById('btn-bomb');
      const btnBombShips = document.getElementById('btn-bomb-ships');
      const btnCruiser = document.getElementById('btn-cruiser');
      if (btnBomb) btnBomb.style.display = hasMilitary ? 'inline-flex' : 'none';
      if (btnBombShips) btnBombShips.style.display = hasMilitary ? 'inline-flex' : 'none';
      if (btnCruiser) {
        btnCruiser.style.display = 'none';
        btnCruiser.classList.toggle('action-btn-active', cruiserBuildModeActive);
      }

      const selectedCruisers = getSelectedCruisers();

      const dropdownsEl = document.getElementById('cruiser-dropdowns');
      if (dropdownsEl) {
        if (selectedCruisers.length > 0) {
          dropdownsEl.style.display = 'none';
          const first = selectedCruisers[0];
          const selPackage = document.getElementById('sel-cruiser-package');
          const selTactics = document.getElementById('sel-cruiser-tactics');
          const selStrategy = document.getElementById('sel-cruiser-strategy');
          
          if (selPackage && document.activeElement !== selPackage) {
            selPackage.value = first.package || (first.cruiserStyle === 'Gorn' ? 'brute' : (first.cruiserStyle === 'Romulan' || first.cruiserStyle === 'Tholian' ? 'sniper' : 'ranged'));
          }
          if (selTactics && document.activeElement !== selTactics) {
            let defaultTactics = 'normal';
            if (first.cruiserStyle === 'Tholian' || first.cruiserStyle === 'Lyran') {
              defaultTactics = 'patient';
            } else if (first.cruiserStyle === 'Romulan') {
              defaultTactics = 'frenzied';
            }
            selTactics.value = first.tactics || defaultTactics;
          }
          if (selStrategy && document.activeElement !== selStrategy) {
            let defaultStrategy = 'normal';
            if (first.cruiserStyle === 'Tholian' || first.cruiserStyle === 'Romulan' || first.cruiserStyle === 'Klingon') {
              defaultStrategy = 'long';
            } else if (first.cruiserStyle === 'Gorn') {
              defaultStrategy = 'normal';
            }
            selStrategy.value = first.strategy || defaultStrategy;
          }

          const isBrute = selPackage && selPackage.value === 'brute';
          if (selStrategy) {
            const shortOpt = selStrategy.querySelector('option[value="short"]');
            if (shortOpt) {
              if (isBrute) {
                shortOpt.disabled = true;
                shortOpt.style.display = 'none';
                if (selStrategy.value === 'short') {
                  selStrategy.value = 'normal';
                  for (const ship of selectedCruisers) {
                    ship.strategy = 'normal';
                  }
                  socket.emit('setCruiserStrategy', { shipIds: selectedCruisers.map(c => c.id), value: 'normal' });
                }
              } else {
                shortOpt.disabled = false;
                shortOpt.style.display = '';
              }
            }
          }
        } else {
          dropdownsEl.style.display = 'none';
        }
      }



      const btnPatrol = document.getElementById('btn-patrol');
      if (btnPatrol) {
        btnPatrol.style.display = selectedCruisers.length > 0 ? 'inline-flex' : 'none';
        if (selectedCruisers.length > 0) {
          const anyPatrolling = selectedCruisers.some(c => c.isPatrolling);
          btnPatrol.classList.toggle('action-btn-active', anyPatrolling);
        }
      }

      const btnCruiserScout = document.getElementById('btn-cruiser-scout');
      if (btnCruiserScout) {
        btnCruiserScout.style.display = selectedCruisers.length > 0 ? 'inline-flex' : 'none';
        if (selectedCruisers.length > 0) {
          const anyScouting = selectedCruisers.some(c => c.isScouting);
          btnCruiserScout.classList.toggle('action-btn-active', anyScouting);
        }
      }

      const btnCruiserAttack = document.getElementById('btn-cruiser-attack');
      if (btnCruiserAttack) {
        btnCruiserAttack.style.display = selectedCruisers.length > 0 ? 'inline-flex' : 'none';
        if (selectedCruisers.length > 0) {
          const anyAttacking = selectedCruisers.some(c => c.scoutAttackEnabled);
          btnCruiserAttack.classList.toggle('action-btn-active', anyAttacking);
        }
      }

      const btnCruiserUseResources = document.getElementById('btn-cruiser-use-resources');
      if (btnCruiserUseResources) {
        const showUse = selectedCruisers.length > 0 || (selectedPlanets.length > 0 && selectedPlanets.some(p => p.ownerId === localPlayer.id));
        btnCruiserUseResources.style.display = showUse ? 'inline-flex' : 'none';
        if (selectedCruisers.length > 0) {
          const anyUseRes = selectedCruisers.some(c => c.useResources);
          btnCruiserUseResources.classList.toggle('action-btn-active', anyUseRes);
        } else if (selectedPlanets.length > 0) {
          const anyUseRes = selectedPlanets.some(p => p.useResources);
          btnCruiserUseResources.classList.toggle('action-btn-active', anyUseRes);
        }
      }





      const btnDismantle = document.getElementById('btn-dismantle');
      if (btnDismantle) {
        const showDismantle = selectedCruisers.length > 0 && selectedCruisers.some(c => !c.isDismantling && isCruiserInFriendlyGravityWell(c));
        btnDismantle.style.display = showDismantle ? 'inline-flex' : 'none';
        
        const currentSelectedCruiserIdsStr = selectedCruisers.map(c => c.id).join(',');
        if (currentSelectedCruiserIdsStr !== lastSelectedCruiserIdsStr) {
          confirmingDismantle = false;
          lastSelectedCruiserIdsStr = currentSelectedCruiserIdsStr;
          btnDismantle.innerHTML = '<span class="btn-icon">♻️</span>D';
        }
      }

      const simpleStd = ['btn-leaderboard', 'help-btn'];
      for (const btnId of simpleStd) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'inline-flex';
      }

      for (const btnId of Object.keys(upButtonsMap)) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = 'none';
      }
      const elCancel = document.getElementById('btn-up-cancel');
      if (elCancel) elCancel.style.display = 'none';
    }

    // Hide the Scout mode button until tech bonus 10
    const btnScout = document.getElementById('btn-scout');
    if (btnScout) {
      const myPlayer = (serverState && localPlayer) ? serverState.players.find(p => p.id === localPlayer.id) : null;
      const techBonus = myPlayer ? Math.sqrt(myPlayer.techScore || 0) : 0;
      if (techBonus >= 10 && !focusModeActive && !upgradeModeActive && !cruiserBuildModeActive) {
        btnScout.style.display = 'inline-flex';
      } else {
        btnScout.style.display = 'none';
        if (techBonus < 10) {
          scoutModeNext = false;
        }
      }
    }



    if (!serverState) return;

    if (isNaN(cameraPanX) || !isFinite(cameraPanX)) cameraPanX = 0;
    if (isNaN(cameraPanY) || !isFinite(cameraPanY)) cameraPanY = 0;
    if (isNaN(cameraZoom) || !isFinite(cameraZoom)) cameraZoom = 1;

    const mapWidth = serverState ? (serverState.width || 1920) : 1920;
    const mapHeight = serverState ? (serverState.height || 1620) : 1620;
    const scaleX = canvas.width / mapWidth;
    const scaleY = canvas.height / mapHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const finalScale = baseScale * cameraZoom;
    const centerServerX = mapWidth / 2 - cameraPanX;
    const centerServerY = mapHeight / 2 - cameraPanY;

    const viewW = canvas.width / finalScale;
    const viewH = canvas.height / finalScale;
    const viewMinX = centerServerX - viewW / 2 - 50;
    const viewMaxX = centerServerX + viewW / 2 + 50;
    const viewMinY = centerServerY - viewH / 2 - 50;
    const viewMaxY = centerServerY + viewH / 2 + 50;

    ctx.save();
    try {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(finalScale, finalScale);
      ctx.translate(-centerServerX, -centerServerY);

      // Draw starfield
      if (starfieldEnabled) for (const star of stars) {
        if (star.x < viewMinX || star.x > viewMaxX || star.y < viewMinY || star.y > viewMaxY) continue;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw unexplored cells in transparent yellow
      if (serverState.exploredCells) {
        const cellSize = 100;
        const numCellsX = Math.ceil(mapWidth / cellSize);
        const numCellsY = Math.ceil(mapHeight / cellSize);
        ctx.fillStyle = 'rgba(255, 255, 0, 0.04)';
        for (let cx = 0; cx < numCellsX; cx++) {
          for (let cy = 0; cy < numCellsY; cy++) {
            const key = `${cx}_${cy}`;
            // If it is NOT explored (i.e. not in exploredCells), draw a faint yellow rectangle
            if (!serverState.exploredCells[key]) {
              const rx = cx * cellSize;
              const ry = cy * cellSize;
              if (rx + cellSize >= viewMinX && rx <= viewMaxX && ry + cellSize >= viewMinY && ry <= viewMaxY) {
                ctx.fillRect(rx, ry, cellSize, cellSize);
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.02)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(rx, ry, cellSize, cellSize);
              }
            }
          }
        }
      }

      // Draw connections if planets are selected
      if (selectedPlanets.length > 0) {
        for (const sp of selectedPlanets) {
          for (const p of serverState.planets) {
            if (p.id !== sp.id && !selectedPlanets.some(sel => sel.id === p.id)) {
              ctx.beginPath();
              ctx.moveTo(sp.x, sp.y);
              ctx.lineTo(p.x, p.y);
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }

      // Draw lasso box
      if (lasso.active) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        const x = Math.min(lasso.startX, lasso.endX);
        const y = Math.min(lasso.startY, lasso.endY);
        const w = Math.abs(lasso.endX - lasso.startX);
        const h = Math.abs(lasso.endY - lasso.startY);
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }

      // Draw hazard circles (background)
      if (serverState.storms) {
        for (const storm of serverState.storms) {
          const t = storm.type || 'storm';
          const fillColor = t === 'minefield' ? 'rgba(80, 80, 255, 0.08)' : t === 'nebula' ? 'rgba(255, 60, 60, 0.08)' : 'rgba(255, 255, 0, 0.08)';
          const strokeColor = t === 'minefield' ? 'rgba(80, 80, 255, 0.3)' : t === 'nebula' ? 'rgba(255, 60, 60, 0.3)' : 'rgba(255, 255, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(storm.x, storm.y, storm.radius, 0, Math.PI * 2);
          ctx.fillStyle = fillColor;
          ctx.fill();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }



      if (serverState.fleets) {

        for (const f of serverState.fleets) {
          const owner = serverState.players.find(pl => pl.id === f.ownerId);
          if (owner) {
            const isSelectedCruiserCluster = f.isCruiser && selectedShips.some(ss => {
              if (!ss.isCruiser) return false;
              const rawShip = serverState.ships.find(s => s.id === ss.id);
              if (!rawShip) return false;
              const sx = rawShip.rawServerX !== undefined ? rawShip.rawServerX : rawShip.x;
              const sy = rawShip.rawServerY !== undefined ? rawShip.rawServerY : rawShip.y;
              const distSqRaw = (sx - f.x) * (sx - f.x) + (sy - f.y) * (sy - f.y);
              const distSqVis = (rawShip.x - f.x) * (rawShip.x - f.x) + (rawShip.y - f.y) * (rawShip.y - f.y);
              return distSqRaw < 225 || distSqVis < 225; // within 15 pixels
            });
            if (isSelectedCruiserCluster) continue;

            const pct = hazardSensorReductionPct(f.x, f.y, f.ownerId);
            const drawRadius = Math.max(10, f.radarRange * pct);
            ctx.beginPath();
            ctx.arc(f.x, f.y, drawRadius, 0, Math.PI * 2);

            ctx.strokeStyle = owner.color;
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 10]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;
          }
        }
      }

      let anyBeingResearched = false;
      let anyCompleting = false;

      // Draw scanning beams/cones for anomalies being researched/completed
      for (const p of serverState.planets) {
        if (p.anomaly && !p.anomaly.researched && p.anomaly.beingResearched) {
          const shipId = p.anomaly.completingShipId || p.anomaly.researchingShipId;
          if (shipId) {
            const ship = serverState.ships.find(s => s.id === shipId);
            if (ship) {
              anyBeingResearched = true;
              if (p.anomaly.completing) {
                anyCompleting = true;
              }
              // Target coordinates (anomaly center)
              const tx = p.anomaly.x;
              const ty = p.anomaly.y;
              // Source coordinates (cruiser center)
              const sx = ship.x;
              const sy = ship.y;
              
              // Angle from ship to anomaly
              const angle = Math.atan2(ty - sy, tx - sx);
              
              ctx.save();
              
              // Draw translucent green scanning cone/ray
              // Shimmery effect using a combination of random noise and sine wave over time
              const shimmer = 0.5 + 0.3 * Math.sin(Date.now() / 50) + 0.2 * Math.random();
              const alpha = (p.anomaly.completing ? 0.6 : 0.25) * shimmer;
              
              // Draw cone (a wedge from cruiser to anomaly)
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              // Width of the cone at the target end (narrowed scan beam)
              const coneWidth = p.isDeepSpaceAnomaly ? 4 : 8;
              const perpAngle = angle + Math.PI / 2;
              
              const tx1 = tx - Math.cos(perpAngle) * coneWidth;
              const ty1 = ty - Math.sin(perpAngle) * coneWidth;
              const tx2 = tx + Math.cos(perpAngle) * coneWidth;
              const ty2 = ty + Math.sin(perpAngle) * coneWidth;
              
              ctx.lineTo(tx1, ty1);
              ctx.lineTo(tx2, ty2);
              ctx.closePath();
              
              const grad = ctx.createLinearGradient(sx, sy, tx, ty);
              grad.addColorStop(0, `rgba(0, 255, 100, 0.05)`);
              grad.addColorStop(0.3, `rgba(0, 255, 100, ${alpha * 0.7})`);
              grad.addColorStop(1, `rgba(0, 255, 100, ${alpha})`);
              ctx.fillStyle = grad;
              ctx.fill();
              
              // Draw some shimmery lines/particles inside the cone
              ctx.strokeStyle = `rgba(100, 255, 180, ${alpha * 0.8})`;
              ctx.lineWidth = 1 + Math.random() * 1.5;
              ctx.beginPath();
              // Core beam line
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx, ty);
              ctx.stroke();
              
              // Sparkly outer edges
              ctx.strokeStyle = `rgba(0, 255, 100, ${alpha * 0.4})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx1, ty1);
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx2, ty2);
              ctx.stroke();
              
              ctx.restore();
            }
          }
        }
      }

      // Draw scanning beams/cones for wreckages being scanned
      if (serverState.wreckages) {
        for (const w of serverState.wreckages) {
          if (w.beingScanned && w.scanningShipId) {
            const ship = serverState.ships.find(s => s.id === w.scanningShipId);
            if (ship) {
              anyBeingResearched = true;
              anyCompleting = true;
              const tx = w.x;
              const ty = w.y;
              const sx = ship.x;
              const sy = ship.y;
              
              const angle = Math.atan2(ty - sy, tx - sx);
              
              ctx.save();
              
              const shimmer = 0.5 + 0.3 * Math.sin(Date.now() / 50) + 0.2 * Math.random();
              const alpha = 0.6 * shimmer;
              
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              const coneWidth = 4;
              const perpAngle = angle + Math.PI / 2;
              
              const tx1 = tx - Math.cos(perpAngle) * coneWidth;
              const ty1 = ty - Math.sin(perpAngle) * coneWidth;
              const tx2 = tx + Math.cos(perpAngle) * coneWidth;
              const ty2 = ty + Math.sin(perpAngle) * coneWidth;
              
              ctx.lineTo(tx1, ty1);
              ctx.lineTo(tx2, ty2);
              ctx.closePath();
              
              const grad = ctx.createLinearGradient(sx, sy, tx, ty);
              grad.addColorStop(0, `rgba(0, 255, 100, 0.05)`);
              grad.addColorStop(0.3, `rgba(0, 255, 100, ${alpha * 0.7})`);
              grad.addColorStop(1, `rgba(0, 255, 100, ${alpha})`);
              ctx.fillStyle = grad;
              ctx.fill();
              
              ctx.strokeStyle = `rgba(100, 255, 180, ${alpha * 0.8})`;
              ctx.lineWidth = 1 + Math.random() * 1.5;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx, ty);
              ctx.stroke();
              
              ctx.strokeStyle = `rgba(0, 255, 100, ${alpha * 0.4})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx1, ty1);
              ctx.moveTo(sx, sy);
              ctx.lineTo(tx2, ty2);
              ctx.stroke();
              
              ctx.restore();
            }
          }
        }
      }

      if (anyCompleting) {
        playScanningSound(true);
      } else if (anyBeingResearched) {
        playScanningSound(false);
      }

      // Draw wreckages
      if (serverState.wreckages) {
        for (const w of serverState.wreckages) {
          ctx.save();
          
          // Floating/drifting effect: slight translation and rotation using sine waves
          const timeOffset = w.x + w.y;
          const driftX = Math.sin(Date.now() / 1000 + timeOffset) * 2;
          const driftY = Math.cos(Date.now() / 1200 + timeOffset) * 2;
          const driftAngle = (Date.now() / 5000 + timeOffset) % (Math.PI * 2);
          
          ctx.translate(w.x + driftX, w.y + driftY);
          
          // 1. Draw combat cooldown lock indicator (red dotted outline & countdown)
          const nowTimestamp = Date.now();
          const isLocked = (nowTimestamp - w.lastFightingTime) < 30000;
          if (isLocked) {
            const timeLeft = Math.ceil((30000 - (nowTimestamp - w.lastFightingTime)) / 1000);
            
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(timeLeft + 's', 0, -14);
            ctx.restore();
          }

          // 2. Draw circular scanning progress ring
          if (w.beingScanned && w.scanTimeLeft > 0 && w.scanTimeLeft < 3000) {
            const progressRatio = Math.max(0, Math.min(1.0, (3000 - w.scanTimeLeft) / 3000));
            ctx.save();
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10.0, -Math.PI / 2, -Math.PI / 2 + progressRatio * Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          
          ctx.rotate(driftAngle);
          
          // Render the wreckage as sqrt(cruiser damage) gray squares and sqrt(amoeba damage) green blobs in 100px area (50px radius)
          const idNum = parseInt(w.id.replace(/\D/g, ''), 10) || 0;
          const numSquares = w.cruiserDamage > 0 ? Math.max(1, Math.floor(Math.sqrt(w.cruiserDamage))) : 0;
          const numBlobs = w.amoebaDamage > 0 ? Math.max(1, Math.floor(Math.sqrt(w.amoebaDamage))) : 0;

          for (let i = 0; i < numSquares; i++) {
            const angle = ((idNum * (i + 1) * 17) % 360) * Math.PI / 180;
            const dist = ((idNum * (i + 2) * 23) % 45) + 5; // 5 to 50px (100px area)
            const cx = Math.cos(angle) * dist;
            const cy = Math.sin(angle) * dist;
            
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(((idNum * (i + 3) * 11) % 360) * Math.PI / 180);
            
            // Draw a gray chunk
            const rOffset = (idx) => (((idNum + i * 13 + idx * 7) % 5) - 2);
            ctx.fillStyle = '#64748b'; // gray
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-4 + rOffset(0), -4 + rOffset(1));
            ctx.lineTo(4 + rOffset(2), -4 + rOffset(3));
            ctx.lineTo(4 + rOffset(4), 4 + rOffset(5));
            ctx.lineTo(-4 + rOffset(6), 4 + rOffset(7));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          for (let i = 0; i < numBlobs; i++) {
            const angle = ((idNum * (i + 5) * 29) % 360) * Math.PI / 180;
            const dist = ((idNum * (i + 6) * 31) % 45) + 5; // 5 to 50px (100px area)
            const bx = Math.cos(angle) * dist;
            const by = Math.sin(angle) * dist;
            
            ctx.save();
            ctx.translate(bx, by);
            ctx.fillStyle = 'rgba(0, 220, 80, 0.8)';
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 6;
            const rSize = ((idNum + i * 19) % 3) + 3; // 3 to 5px
            ctx.beginPath();
            ctx.arc(0, 0, rSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          
          ctx.restore();
        }
      }


      for (const p of serverState.planets) {
        if (p.isDeepSpaceAnomaly) {
          if (p.anomaly && !p.anomaly.researched) {
            const diff = p.anomaly.difficulty;
            const cycleTime = (Date.now() + (p.id ? p.id.toString().charCodeAt(0) * 100 : 0)) % 4000;
            let twinkle = 1.0;
            if (cycleTime < 250) {
              twinkle = 1.0 + Math.sin(cycleTime * Math.PI / 250) * 0.8;
            }

            let anomalyColor = '#00ff88';
            if (diff <= 0) {
              anomalyColor = '#00ff88';
            } else if (diff <= 12) {
              anomalyColor = '#ffcc00';
            } else if (diff <= 24) {
              anomalyColor = '#00e5ff';
            } else if (diff <= 48) {
              anomalyColor = '#ff6d00';
            } else {
              anomalyColor = '#ff00ff';
            }

            ctx.save();
            
            if (diff <= 0) {
              const scale = 1.0 + Math.sin(Date.now() / 250) * 0.2;
              const lineLength = 2.5 * scale * twinkle;
              ctx.strokeStyle = anomalyColor;
              ctx.shadowColor = anomalyColor;
              ctx.shadowBlur = 3 * twinkle;
              
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(p.anomaly.x - lineLength, p.anomaly.y);
              ctx.lineTo(p.anomaly.x + lineLength, p.anomaly.y);
              ctx.moveTo(p.anomaly.x, p.anomaly.y - lineLength);
              ctx.lineTo(p.anomaly.x, p.anomaly.y + lineLength);
              ctx.stroke();
              
              ctx.lineWidth = 0.4;
              ctx.beginPath();
              const xScale = 1.0 - Math.sin(Date.now() / 250) * 0.2;
              const xLineLength = 1.25 * xScale * twinkle;
              const offset = xLineLength * 0.7071;
              ctx.moveTo(p.anomaly.x - offset, p.anomaly.y - offset);
              ctx.lineTo(p.anomaly.x + offset, p.anomaly.y + offset);
              ctx.moveTo(p.anomaly.x - offset, p.anomaly.y + offset);
              ctx.lineTo(p.anomaly.x + offset, p.anomaly.y - offset);
              ctx.stroke();
            } else if (diff <= 12) {
              const scale = 1.0 + Math.sin(Date.now() / 150) * 0.3;
              const lineLength = 2.75 * scale * twinkle;
              ctx.strokeStyle = anomalyColor;
              ctx.shadowColor = anomalyColor;
              ctx.shadowBlur = 4 * twinkle;
              
              ctx.lineWidth = 1.0;
              ctx.beginPath();
              ctx.moveTo(p.anomaly.x - lineLength, p.anomaly.y);
              ctx.lineTo(p.anomaly.x + lineLength, p.anomaly.y);
              ctx.moveTo(p.anomaly.x, p.anomaly.y - lineLength);
              ctx.lineTo(p.anomaly.x, p.anomaly.y + lineLength);
              ctx.stroke();
              
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              const xScale = 1.0 - Math.sin(Date.now() / 150) * 0.3;
              const xLineLength = 1.375 * xScale * twinkle;
              const offset = xLineLength * 0.7071;
              ctx.moveTo(p.anomaly.x - offset, p.anomaly.y - offset);
              ctx.lineTo(p.anomaly.x + offset, p.anomaly.y + offset);
              ctx.moveTo(p.anomaly.x - offset, p.anomaly.y + offset);
              ctx.lineTo(p.anomaly.x + offset, p.anomaly.y - offset);
              ctx.stroke();
              
              ctx.fillStyle = anomalyColor;
              ctx.beginPath();
              ctx.arc(p.anomaly.x, p.anomaly.y, 0.75 * twinkle, 0, Math.PI * 2);
              ctx.fill();
            } else if (diff <= 24) {
              const scale = 1.0 + Math.sin(Date.now() / 120) * 0.35;
              const lineLength = 3.0 * scale * twinkle;
              ctx.strokeStyle = anomalyColor;
              ctx.shadowColor = anomalyColor;
              ctx.shadowBlur = 5 * twinkle;
              
              ctx.translate(p.anomaly.x, p.anomaly.y);
              const rotAngle = (Date.now() / 1000) % (Math.PI * 2);
              ctx.rotate(rotAngle * 0.2);
              
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(-lineLength, 0);
              ctx.lineTo(lineLength, 0);
              ctx.moveTo(0, -lineLength);
              ctx.lineTo(0, lineLength);
              ctx.stroke();
              
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              const xScale = 1.0 - Math.sin(Date.now() / 120) * 0.35;
              const xLineLength = 1.5 * xScale * twinkle;
              const offset = xLineLength * 0.7071;
              ctx.moveTo(-offset, -offset);
              ctx.lineTo(offset, offset);
              ctx.moveTo(-offset, offset);
              ctx.lineTo(offset, -offset);
              ctx.stroke();
            } else if (diff <= 48) {
              const scale = 1.0 + Math.sin(Date.now() / 80) * 0.4;
              const lineLength = 3.25 * scale * twinkle;
              ctx.strokeStyle = anomalyColor;
              ctx.shadowColor = anomalyColor;
              ctx.shadowBlur = 6 * twinkle;
              
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(p.anomaly.x - lineLength, p.anomaly.y);
              ctx.lineTo(p.anomaly.x + lineLength, p.anomaly.y);
              ctx.moveTo(p.anomaly.x, p.anomaly.y - lineLength);
              ctx.lineTo(p.anomaly.x, p.anomaly.y + lineLength);
              ctx.stroke();
              
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              const xScale = 1.0 - Math.sin(Date.now() / 80) * 0.4;
              const xLineLength = 1.625 * xScale * twinkle;
              const offset = xLineLength * 0.7071;
              ctx.moveTo(p.anomaly.x - offset, p.anomaly.y - offset);
              ctx.lineTo(p.anomaly.x + offset, p.anomaly.y + offset);
              ctx.moveTo(p.anomaly.x - offset, p.anomaly.y + offset);
              ctx.lineTo(p.anomaly.x + offset, p.anomaly.y - offset);
              ctx.stroke();
              
              ctx.strokeStyle = `rgba(255, 109, 0, ${0.4 * twinkle})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.arc(p.anomaly.x, p.anomaly.y, lineLength * 1.5, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              const jitterX = (Math.random() - 0.5) * 0.8;
              const jitterY = (Math.random() - 0.5) * 0.8;
              const scale = 1.0 + Math.sin(Date.now() / 50) * 0.45;
              const lineLength = 3.5 * scale * twinkle;
              
              const ax = p.anomaly.x + jitterX;
              const ay = p.anomaly.y + jitterY;
              
              ctx.strokeStyle = anomalyColor;
              ctx.shadowColor = anomalyColor;
              ctx.shadowBlur = 8 * twinkle;
              
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(ax - lineLength, ay);
              ctx.lineTo(ax + lineLength, ay);
              ctx.moveTo(ax, ay - lineLength);
              ctx.lineTo(ax, ay + lineLength);
              ctx.stroke();
              
              ctx.lineWidth = 0.75;
              ctx.beginPath();
              const xScale = 1.0 - Math.sin(Date.now() / 50) * 0.45;
              const xLineLength = 1.75 * xScale * twinkle;
              const offset = xLineLength * 0.7071;
              ctx.moveTo(ax - offset, ay - offset);
              ctx.lineTo(ax + offset, ay + offset);
              ctx.moveTo(ax - offset, ay + offset);
              ctx.lineTo(ax + offset, ay - offset);
              ctx.stroke();
              
              ctx.strokeStyle = `rgba(255, 0, 255, ${0.6 * twinkle})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              for (let i = 0; i < 4; i++) {
                const rayAngle = Math.random() * Math.PI * 2;
                const rayDist = (2.5 + Math.random() * 4) * scale * twinkle;
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax + Math.cos(rayAngle) * rayDist, ay + Math.sin(rayAngle) * rayDist);
              }
              ctx.stroke();
            }
            
            ctx.restore();
            
            if (p.anomaly.difficulty > 0 && p.anomaly.progress > 0) {
              const progressRatio = Math.max(0, Math.min(1.0, p.anomaly.progress / p.anomaly.difficulty));
              ctx.save();
              ctx.strokeStyle = anomalyColor;
              ctx.lineWidth = 0.5;
              ctx.shadowBlur = 0;
              ctx.beginPath();
              ctx.arc(p.anomaly.x, p.anomaly.y, 7.5, -Math.PI / 2, -Math.PI / 2 + progressRatio * Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }
          continue;
        }

        const owner = serverState.players.find(pl => pl.id === p.ownerId);
        const isSelected = selectedPlanets.some(sp => sp.id === p.id);

        if (owner) {
          const techBonus = 0.01 * Math.sqrt(owner.techScore || 0);
          const expBonus = 0.01 * Math.sqrt(owner.expScore || 0);
          let baseRadius = p.maxShips * 1.5;
          if (p.isMilitary && p.ships >= p.maxShips) {
            baseRadius *= 1.5;
          }
          const isHuman = owner && !owner.isAI;
          if (isHuman && p.focusMode === 'garrison' && p.ships >= p.maxShips) {
            baseRadius += (p.ships / 2);
          }
          const gravityRadius = baseRadius * (1 + techBonus + expBonus);
          const pct = hazardSensorReductionPct(p.x, p.y, p.ownerId);
          const drawRadius = Math.max(10, gravityRadius * pct);

          ctx.beginPath();
          ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);
          ctx.fillStyle = owner.color;
          ctx.globalAlpha = 0.05;
          ctx.fill();
          ctx.strokeStyle = owner.color;
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 10]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1.0;
        } else {
          let baseRadius = p.maxShips * 1.5;
          const gravityRadius = baseRadius * 0.5;
          const pct = hazardSensorReductionPct(p.x, p.y, null);
          const drawRadius = Math.max(10, gravityRadius * pct);

          ctx.beginPath();
          ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(211, 211, 211, 0.04)';
          ctx.strokeStyle = 'rgba(211, 211, 211, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 10]);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        }

        let drawnPlanetImage = false;
        if (graphicalMode && transparentPlanetsCanvas) {
          const spriteIdx = 2 + (p.id % 78);
          const col = spriteIdx % 8;
          const row = Math.floor(spriteIdx / 8);
          const sx = 12 + col * 94;
          const sy = 26 + row * 94;

          // Clip image to a circle slightly smaller than p.radius to shave off JPEG compression trash
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(
            transparentPlanetsCanvas,
            sx, sy, 94, 94,
            p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2
          );
          ctx.restore();
          
          drawnPlanetImage = true;
        }

        if (!drawnPlanetImage) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          if (owner) {
            ctx.fillStyle = owner.color;
            ctx.shadowColor = owner.color;
            ctx.shadowBlur = 15;
          } else {
            ctx.fillStyle = '#555';
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
          ctx.fill();
        }

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        const isPlanetHovered = (hoveredPlanet && hoveredPlanet.id === p.id) ||
                                (isHoveringSelectionTile && activeInfoPanel && activeInfoPanel.type === 'planet' && activeInfoPanel.id === p.id);
        if (isPlanetHovered) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffeb3b'; // Glowing gold
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#ffeb3b';
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -Date.now() / 150;
          ctx.stroke();
          ctx.restore();
        }

        // Soft cap and current maxships filled circles (only for known planets)
        const isLastKnownPlanet = p.inFog && !p.permanentlyTracked && lastKnownPlanets[p.id] ? true : false;
        if (!p.inFog || p.permanentlyTracked || isLastKnownPlanet) {
          const techBonus = owner ? Math.sqrt(owner.techScore || 0) : 0;
          const threshold = p.sizeClass * ((p.habitability + techBonus) / 100);
          if (threshold > 0) {
            ctx.save();
            
            // Resolve base RGB color from owner or default
            const planetColor = owner ? owner.color : '#555555';
            let r = 85, g = 85, b = 85;
            let clean = planetColor.replace('#', '');
            if (clean.length === 3) {
              clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
            }
            const num = parseInt(clean, 16);
            if (!isNaN(num)) {
              r = (num >> 16) & 255;
              g = (num >> 8) & 255;
              b = num & 255;
            }

            // 1. Lighter version for the soft cap circle (mix with white)
            const lightR = Math.floor(r + (255 - r) * 0.6);
            const lightG = Math.floor(g + (255 - g) * 0.6);
            const lightB = Math.floor(b + (255 - b) * 0.6);
            const softCapFillColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.25)`;
            const softCapStrokeColor = `rgba(${lightR}, ${lightG}, ${lightB}, 0.4)`;

            // 2. Slightly darker version for the current maxships circle (multiply by 0.55)
            const darkR = Math.floor(r * 0.55);
            const darkG = Math.floor(g * 0.55);
            const darkB = Math.floor(b * 0.55);
            const currentMaxShipsFillColor = `rgba(${darkR}, ${darkG}, ${darkB}, 0.35)`;
            const currentMaxShipsStrokeColor = `rgba(${darkR}, ${darkG}, ${darkB}, 0.55)`;

            // Draw soft cap circle first
            ctx.beginPath();
            ctx.arc(p.x, p.y, threshold / 4, 0, Math.PI * 2);
            ctx.fillStyle = softCapFillColor;
            ctx.fill();
            ctx.strokeStyle = softCapStrokeColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw current maxships circle over it
            if (p.maxShips > 0) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.maxShips / 4, 0, Math.PI * 2);
              ctx.fillStyle = currentMaxShipsFillColor;
              ctx.fill();
              ctx.strokeStyle = currentMaxShipsStrokeColor;
              ctx.lineWidth = 1;
              ctx.stroke();
            }

            // 3. Draw faint gray ring for size class (if habitability < 100)
            if (p.habitability < 100 && p.sizeClass > 0) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.sizeClass / 4, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }

            ctx.restore();
          }
        }

        // Revolt warmup counter red ring
        if (p.revoltWarmup && p.revoltWarmup > 0 && p.revoltWarmupMax) {
          ctx.save();
          ctx.beginPath();
          const progress = Math.min(1.0, p.revoltWarmup / p.revoltWarmupMax);
          ctx.arc(p.x, p.y, p.radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = 'rgba(255, 50, 50, 0.85)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        // Diplomacy warmup timer yellow ring (progress encircling the planet)
        if (p.diplomacyWarmupTimer && p.diplomacyWarmupTimer > 0) {
          ctx.save();
          ctx.beginPath();
          const progress = Math.min(1.0, p.diplomacyWarmupTimer / 30);
          ctx.arc(p.x, p.y, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          if (p.activeDiplomatId && serverState.ships && serverState.players) {
            const diplomat = serverState.ships.find(s => s.id === p.activeDiplomatId && s.active);
            if (diplomat) {
              const diplomatOwner = serverState.players.find(pl => pl.id === diplomat.ownerId);
              if (diplomatOwner) {
                const expBonus = Math.sqrt(diplomatOwner.expScore || 0);
                const shipExpBonus = Math.sqrt(diplomat.expScore || 0);
                const MathSquareBase = expBonus + shipExpBonus;
                const currentSym = getEffectiveSympathyClient(p, diplomatOwner.id);
                const disposition = p.disposition ? (p.disposition[diplomatOwner.id] ?? 0) : 0;

                const prefRes = p.preferredResource;
                const initialQty = prefRes ? (diplomatOwner.resources?.[prefRes] || 0) : 0;
                const hasPref = prefRes && initialQty >= 0.1;

                const chanceBase = 30 + disposition + currentSym + MathSquareBase;
                const chancePref = 30 + disposition + currentSym + (MathSquareBase * 3) + 10;
                
                let rawChance = hasPref ? chancePref : chanceBase;
                if (diplomat.cruiserStyle === p.racialAffinity || (diplomatOwner.cruiserStyle === p.racialAffinity)) {
                  rawChance += 20;
                }
                const chancePercent = Math.max(0, Math.round(rawChance));

                ctx.save();
                ctx.font = 'bold 8px Orbitron';
                ctx.fillStyle = 'rgba(255, 255, 0, 0.95)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                let yOffset = 26;
                if (p.isResearch || p.isMilitary || p.isSpeedPlanet) {
                  yOffset = 38;
                }

                const hasDisp = p.disposition && p.disposition[diplomatOwner.id] !== undefined && p.disposition[diplomatOwner.id] !== null;
                let prefix = '';
                if (hasDisp) {
                  const dVal = Math.round(p.disposition[diplomatOwner.id]);
                  let dispEmoji = '';
                  if (dVal < -35) dispEmoji = '😠';
                  else if (dVal < -15) dispEmoji = '😢';
                  else if (dVal < 1) dispEmoji = '😐';
                  else if (dVal < 20) dispEmoji = '🙂';
                  else if (dVal < 40) dispEmoji = '😀';
                  else dispEmoji = '😍';
                  prefix += dispEmoji + ' ';
                }
                if (hasPref) {
                  const resourceEmojis = {
                    antimatter: '🌀',
                    tritanium: '🔩',
                    merculite: '☄️',
                    dilithium: '💎',
                    duranium: '🔲',
                    deuterium: '💧',
                    latinum: '🏺'
                  };
                  const prefEmoji = resourceEmojis[prefRes] || '💎';
                  prefix += prefEmoji + ' ';
                }

                ctx.fillText(`${prefix}${chancePercent}%`, p.x, p.y - p.radius - yOffset);
                ctx.restore();
              }
            }
          }
        }

        let groupNum = null;
        for (let g = 0; g <= 9; g++) {
          if (controlGroups[g] && controlGroups[g].planetIds && controlGroups[g].planetIds.includes(p.id)) {
            groupNum = g;
            break;
          }
        }
        if (groupNum !== null) {
          ctx.save();
          ctx.font = 'bold 10px Orbitron';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(groupNum.toString(), p.x - p.radius * 0.7, p.y - p.radius * 0.7);
          ctx.restore();
        }

        if (planetShields[p.id] > 0) {
          planetShields[p.id] -= 1 / 20;
          if (planetShields[p.id] <= 0) {
            delete planetShields[p.id];
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 0, ${Math.min(1, planetShields[p.id])})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff0';
            ctx.shadowBlur = 10;
            ctx.stroke();
          }
        }

        if (serverState.players) {
          let currentAngle = -Math.PI / 2;
          const ringRadius = p.radius + 6;
          for (const player of serverState.players) {
            const symLevel = getEffectiveSympathyClient(p, player.id);
            if (symLevel > 0) {
              const angleSize = (Math.PI * 2 * symLevel) / p.maxShips;
              ctx.beginPath();
              ctx.arc(p.x, p.y, ringRadius, currentAngle, currentAngle + angleSize);
              ctx.strokeStyle = player.color;
              ctx.lineWidth = 2;
              ctx.stroke();
              currentAngle += angleSize;
            }
          }
        }

        if (p.inRevolt) {
          ctx.save();
          ctx.beginPath();
          const pulseRadius = p.radius + 15 + Math.sin(Date.now() / 100) * 4;
          ctx.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = '#ff3333';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#ff3333';
          ctx.shadowBlur = 12;
          ctx.stroke();

          ctx.font = 'bold 13px Orbitron';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          const alpha = 0.5 + Math.sin(Date.now() / 150) * 0.5;
          ctx.fillStyle = `rgba(255, 51, 51, ${alpha})`;
          ctx.fillText('✊ REVOLTING', p.x, p.y - p.radius - 20);
          ctx.restore();
        }

        if (p.anomaly && !p.anomaly.researched) {
          const diff = p.anomaly.difficulty;
          
          // Occasional twinkle: every 4 seconds, flash brightly for 250ms, offset by planet ID
          const cycleTime = (Date.now() + (p.id ? p.id.toString().charCodeAt(0) * 100 : 0)) % 4000;
          let twinkle = 1.0;
          if (cycleTime < 250) {
            twinkle = 1.0 + Math.sin(cycleTime * Math.PI / 250) * 0.8;
          }

          let anomalyColor = '#00ff88';
          if (diff <= 10) {
            anomalyColor = '#00ff88';
          } else if (diff <= 35) {
            anomalyColor = '#ffcc00';
          } else if (diff <= 60) {
            anomalyColor = '#00e5ff';
          } else if (diff <= 85) {
            anomalyColor = '#ff6d00';
          } else {
            anomalyColor = '#ff00ff';
          }

          ctx.save();
          
          if (diff <= 10) {
            // Tier 1: Faint Spark (Green, Slow Pulse)
            const scale = 1.0 + Math.sin(Date.now() / 250) * 0.2;
            const lineLength = 2.5 * scale * twinkle;
            ctx.strokeStyle = anomalyColor;
            ctx.shadowColor = anomalyColor;
            ctx.shadowBlur = 3 * twinkle;
            ctx.lineWidth = 0.8;
            
            ctx.beginPath();
            ctx.moveTo(p.anomaly.x - lineLength, p.anomaly.y);
            ctx.lineTo(p.anomaly.x + lineLength, p.anomaly.y);
            ctx.moveTo(p.anomaly.x, p.anomaly.y - lineLength);
            ctx.lineTo(p.anomaly.x, p.anomaly.y + lineLength);
            ctx.stroke();
          } else if (diff <= 35) {
            // Tier 2: Glowing Core (Yellow, Medium Pulse + static center dot)
            const scale = 1.0 + Math.sin(Date.now() / 150) * 0.3;
            const lineLength = 2.75 * scale * twinkle;
            ctx.strokeStyle = anomalyColor;
            ctx.shadowColor = anomalyColor;
            ctx.shadowBlur = 4 * twinkle;
            ctx.lineWidth = 1.0;
            
            ctx.beginPath();
            ctx.moveTo(p.anomaly.x - lineLength, p.anomaly.y);
            ctx.lineTo(p.anomaly.x + lineLength, p.anomaly.y);
            ctx.moveTo(p.anomaly.x, p.anomaly.y - lineLength);
            ctx.lineTo(p.anomaly.x, p.anomaly.y + lineLength);
            ctx.stroke();
            
            // Draw center dot
            ctx.fillStyle = anomalyColor;
            ctx.beginPath();
            ctx.arc(p.anomaly.x, p.anomaly.y, 0.75 * twinkle, 0, Math.PI * 2);
            ctx.fill();
          } else if (diff <= 60) {
            // Tier 3: Pulsing Nova (Cyan, Medium Pulse + slight rotation over time)
            const scale = 1.0 + Math.sin(Date.now() / 120) * 0.35;
            const lineLength = 3.0 * scale * twinkle;
            ctx.strokeStyle = anomalyColor;
            ctx.shadowColor = anomalyColor;
            ctx.shadowBlur = 5 * twinkle;
            ctx.lineWidth = 1.2;
            
            // Apply slight rotation around anomaly center
            ctx.translate(p.anomaly.x, p.anomaly.y);
            const rotAngle = (Date.now() / 1000) % (Math.PI * 2);
            ctx.rotate(rotAngle * 0.2); // Slow rotation
            
            ctx.beginPath();
            ctx.moveTo(-lineLength, 0);
            ctx.lineTo(lineLength, 0);
            ctx.moveTo(0, -lineLength);
            ctx.lineTo(0, lineLength);
            ctx.stroke();
          } else if (diff <= 85) {
            // Tier 4: Radiant Star (Orange, Fast Pulse + outer ring)
            const scale = 1.0 + Math.sin(Date.now() / 80) * 0.4;
            const lineLength = 3.25 * scale * twinkle;
            ctx.strokeStyle = anomalyColor;
            ctx.shadowColor = anomalyColor;
            ctx.shadowBlur = 6 * twinkle;
            ctx.lineWidth = 1.4;
            
            ctx.beginPath();
            ctx.moveTo(p.anomaly.x - lineLength, p.anomaly.y);
            ctx.lineTo(p.anomaly.x + lineLength, p.anomaly.y);
            ctx.moveTo(p.anomaly.x, p.anomaly.y - lineLength);
            ctx.lineTo(p.anomaly.x, p.anomaly.y + lineLength);
            ctx.stroke();
            
            // Outer ring
            ctx.strokeStyle = `rgba(255, 109, 0, ${0.4 * twinkle})`;
            ctx.beginPath();
            ctx.arc(p.anomaly.x, p.anomaly.y, lineLength * 1.5, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // Tier 5: Quantum Rift (Magenta, Jittery + electric sparks)
            const jitterX = (Math.random() - 0.5) * 0.8;
            const jitterY = (Math.random() - 0.5) * 0.8;
            const scale = 1.0 + Math.sin(Date.now() / 50) * 0.45;
            const lineLength = 3.5 * scale * twinkle;
            
            const ax = p.anomaly.x + jitterX;
            const ay = p.anomaly.y + jitterY;
            
            ctx.strokeStyle = anomalyColor;
            ctx.shadowColor = anomalyColor;
            ctx.shadowBlur = 8 * twinkle;
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.moveTo(ax - lineLength, ay);
            ctx.lineTo(ax + lineLength, ay);
            ctx.moveTo(ax, ay - lineLength);
            ctx.lineTo(ax, ay + lineLength);
            ctx.stroke();
            
            // Electric sparks/random rays
            ctx.strokeStyle = `rgba(255, 0, 255, ${0.6 * twinkle})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
              const rayAngle = Math.random() * Math.PI * 2;
              const rayDist = (2.5 + Math.random() * 4) * scale * twinkle;
              ctx.moveTo(ax, ay);
              ctx.lineTo(ax + Math.cos(rayAngle) * rayDist, ay + Math.sin(rayAngle) * rayDist);
            }
            ctx.stroke();
          }
          
          ctx.restore();
          
          if (p.anomaly.difficulty > 0 && p.anomaly.progress > 0) {
            const progressRatio = Math.max(0, Math.min(1.0, p.anomaly.progress / p.anomaly.difficulty));
            ctx.save();
            ctx.strokeStyle = anomalyColor;
            ctx.lineWidth = 0.5; // very thin
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(p.anomaly.x, p.anomaly.y, 7.5, -Math.PI / 2, -Math.PI / 2 + progressRatio * Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.shadowBlur = 0;

        if (p.focusTransition) {
          const progress = p.focusTransition.progress || 0;
          const target = p.focusTransition.targetMode;
          const emoji = target === 'research' ? '🔬' : (target === 'garrison' ? '🛡️' : (target === 'commerce' ? '💲' : (target === 'mining' ? '⛏️' : (target === 'terraforming' ? '🌱' : '📈'))));
          
          // 1. Draw glowing rotating progress ring
          ctx.save();
          ctx.beginPath();
          const ringRadius = p.radius + 12;
          ctx.arc(p.x, p.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
          
          ctx.strokeStyle = '#39ff14'; // neon-green
          ctx.lineWidth = 3;
          ctx.shadowColor = '#39ff14';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
          
          // 2. Draw rotating particles orbiting the planet
          ctx.save();
          const particleCount = 6;
          const angleOffset = (Date.now() / 300) % (Math.PI * 2);
          for (let i = 0; i < particleCount; i++) {
            const angle = angleOffset + (i / particleCount) * Math.PI * 2;
            const currentRadius = p.radius + 12 + Math.sin(Date.now() / 100 + i) * 3 * (1 - progress);
            const px = p.x + Math.cos(angle) * currentRadius;
            const py = p.y + Math.sin(angle) * currentRadius;
            
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#0ff'; // cyan glowing particles
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 6;
            ctx.fill();
          }
          ctx.restore();

          // 3. Draw dynamic floating emoji/status above the planet
          ctx.save();
          ctx.font = 'bold 11px Orbitron';
          ctx.fillStyle = '#39ff14';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          const pulse = 1.0 + Math.sin(Date.now() / 150) * 0.1;
          ctx.font = `${Math.floor(13 * pulse)}px sans-serif`;
          ctx.fillText(`${emoji} INCOMING`, p.x, p.y - p.radius - 20);
          ctx.restore();
        }

        const isLastKnown = p.inFog && !p.permanentlyTracked && lastKnownPlanets[p.id];
        if (!p.inFog || p.permanentlyTracked || isLastKnown) {

          const displayShips = isLastKnown ? lastKnownPlanets[p.id].ships : p.ships;
          const displayMaxShips = isLastKnown ? lastKnownPlanets[p.id].maxShips : p.maxShips;
          const text = `${Math.floor(displayShips)} / ${Math.round(displayMaxShips)}`;
          ctx.font = `bold 12px Orbitron`;
          const textWidth = ctx.measureText(text).width;

          const pillHeight = 16;
          
          // Get owner properties to check if human owned
          const displayOwnerId = isLastKnown ? lastKnownPlanets[p.id].ownerId : p.ownerId;
          const displayOwner = serverState.players.find(pl => pl.id === displayOwnerId);
          const isHuman = displayOwner && !displayOwner.isAI;

          // 1. Draw Planet Name & Factory above the planet
          let pName = (isLastKnown ? lastKnownPlanets[p.id].name : p.name) || 'Unknown';
          const nameY = p.y - p.radius - 12;
          let displayName = pName;
          if (graphicalMode) {
            displayName = `${pName} (${Math.floor(displayShips)}/${Math.round(displayMaxShips)})`;
          }
          const displayHomeworldOf = isLastKnown ? lastKnownPlanets[p.id].homeworldOf : p.homeworldOf;
          if (displayHomeworldOf) {
            displayName = `👑 ${displayName}`;
          }

          if (isLastKnown) {
            ctx.fillStyle = '#888';
          } else if (owner) {
            ctx.fillStyle = owner.color;
          } else {
            ctx.fillStyle = '#ffffff';
          }
          ctx.font = 'bold 11px Orbitron';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(displayName, p.x, nameY);
 
          if (!isLastKnown && p.finalRateExceedsOne) {
            const nameWidth = ctx.measureText(displayName).width;
            ctx.save();
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText('🏭', p.x + nameWidth / 2 + 4, nameY);
            ctx.restore();
          }

          // Trade ships indicator for neutral/enemy worlds not at war
          const myPlayer = (serverState && serverState.players && localPlayer) ? (serverState.players.find(pl => pl.id === localPlayer.id) || localPlayer) : localPlayer;
          if (myPlayer && !p.dead) {
            const isOwn = (p.ownerId === myPlayer.id);
            let isNotAtWar = true;
            if (p.ownerId) {
              if (p.ownerId === 'monsters') {
                isNotAtWar = false;
              } else {
                const isAtWar = !!(myPlayer.atWarWith && myPlayer.atWarWith[p.ownerId] && Date.now() < myPlayer.atWarWith[p.ownerId]);
                if (isAtWar) isNotAtWar = false;
              }
            }
            if (!isOwn && isNotAtWar) {
              const tradingShips = Math.floor(getPlanetTradeIncomePerMin(p) * 25);
              if (tradingShips > 0) {
                const nameWidth = ctx.measureText(displayName).width;
                let rightOffset = nameWidth / 2 + 4;
                if (!isLastKnown && p.finalRateExceedsOne) {
                  rightOffset += 16;
                }
                ctx.save();
                ctx.font = 'bold 3.67px Orbitron';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffd700'; // Gold color
                ctx.fillText(tradingShips.toString(), p.x + rightOffset, nameY);
                ctx.restore();
              }
            }
          }

          // 2. Draw special role badges (homeworld, military, research, speed, revolt, rampage) higher up
          const displayIsResearch = isLastKnown ? lastKnownPlanets[p.id].isResearch : p.isResearch;
          const displayIsMilitary = isLastKnown ? lastKnownPlanets[p.id].isMilitary : p.isMilitary;
          const displayIsSpeedPlanet = isLastKnown ? lastKnownPlanets[p.id].isSpeedPlanet : p.isSpeedPlanet;

          if (displayIsResearch) {
            ctx.fillStyle = isLastKnown ? '#888' : (displayOwner ? displayOwner.color : '#fff');
            ctx.font = '14px Arial';
            ctx.fillText("🔬", p.x, nameY - 14);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          } else if (displayIsMilitary) {
            ctx.fillStyle = isLastKnown ? '#888' : (displayOwner ? displayOwner.color : '#fff');
            ctx.font = '14px Arial';
            ctx.fillText("🏭", p.x, nameY - 14);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          } else if (displayIsSpeedPlanet) {
            ctx.fillStyle = isLastKnown ? '#888' : (displayOwner ? displayOwner.color : '#fff');
            ctx.font = '14px Arial';
            ctx.fillText("⚡", p.x, nameY - 14);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          }

          let sympathyForeign = 0;
          if (serverState.players) {
            for (const player of serverState.players) {
              if (player.id !== 'monsters') {
                const symVal = getEffectiveSympathyClient(p, player.id);
                if (!p.ownerId || player.id !== p.ownerId) {
                  sympathyForeign += symVal;
                }
              }
            }
          }
          const sympathyOwner = p.ownerId ? getEffectiveSympathyClient(p, p.ownerId) : 0;
          const ratePerMinute = sympathyForeign - (p.ships / 3) - sympathyOwner;
          const eligibleForRevolt = !isLastKnown && ratePerMinute > 0;

          if (eligibleForRevolt) {
            ctx.save();
            const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 180);
            ctx.globalAlpha = pulse;
            ctx.shadowColor = '#f00';
            ctx.shadowBlur = 10;
            ctx.font = '16px Arial';
            let iconHeight = 14;
            if (displayHomeworldOf || displayIsResearch || displayIsMilitary || displayIsSpeedPlanet) {
              iconHeight = 32;
            }
            ctx.fillText("✊", p.x, nameY - iconHeight);
            ctx.restore();
          }

          if (p.rampageIncubating) {
            ctx.save();
            const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150);
            const bob = Math.sin(Date.now() / 200) * 3;
            ctx.globalAlpha = pulse;
            ctx.shadowColor = '#0f0';
            ctx.shadowBlur = 10;
            ctx.font = '20px sans-serif';
            let iconHeight = 16;
            if (displayHomeworldOf || displayIsResearch || displayIsMilitary || displayIsSpeedPlanet) {
              iconHeight = 34;
            }
            if (eligibleForRevolt) {
              iconHeight += 18;
            }
            ctx.fillText("☣️", p.x, nameY - iconHeight + bob);
            ctx.restore();
          }

          // 3. Stack elements below the planet circle (Race & Resources, Percentages)
          let currentY = p.y + p.radius + 12;

          // A. Race & Resource Icons
          const affinity = isLastKnown ? lastKnownPlanets[p.id].racialAffinity : p.racialAffinity;
          let raceIcon = null;
          if (affinity) {
            const raceIcons = {
              'Federation': '🖖',
              'Romulan': '🦅',
              'Klingon': '⚔️',
              'Gorn': '🦎',
              'Tholian': '🕸️',
              'Lyran': '🐶'
            };
            raceIcon = raceIcons[affinity] || null;
          }

          const hasResources = p.resources && p.resources.length > 0;
          if (hasResources) {
            ctx.save();
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            
            const resourceIcons = {
              dilithium: '💎',
              merculite: '☄️',
              duranium: '🔲',
              tritanium: '🔩',
              antimatter: '🌀',
              deuterium: '💧',
              latinum: '🏺'
            };
            
            let displayString = p.resources.map(r => resourceIcons[r]).join(' ');
            
            ctx.fillText(displayString, p.x, currentY);
            ctx.restore();
            currentY += 14;
          }

          // B. Low Pop or XP Percentages
          if (!isLastKnown) {
            ctx.save();
            ctx.font = 'bold 11px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let drewPercent = false;
            if (owner) {
              if (p.ships < 50) {
                const lowPopMultiplier = 0.10 + 0.02 * Math.max(0, p.ships - 5);
                const prodPercent = Math.round(lowPopMultiplier * 100);
                ctx.fillStyle = '#ffaa00';
                ctx.fillText(`${prodPercent}%`, p.x, currentY);
                drewPercent = true;
              } else if (p.expScore > 0) {
                const xpPercent = Math.round(Math.sqrt(p.expScore));
                ctx.fillStyle = '#66ccff';
                ctx.fillText(`${xpPercent}%`, p.x, currentY);
                drewPercent = true;
              }
            } else if (p.expScore > 0) {
              const xpPercent = Math.round(Math.sqrt(p.expScore));
              ctx.fillStyle = '#66ccff';
              ctx.fillText(`${xpPercent}%`, p.x, currentY);
              drewPercent = true;
            }
            ctx.restore();
            if (drewPercent) {
              currentY += 12;
            }
          }

          // C. Ships / Economy Pill Box (at original position if graphicalMode is false)
          if (!graphicalMode) {
            const pillY = p.y;
            ctx.fillStyle = isLastKnown ? 'rgba(200, 200, 200, 0.4)' : 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(p.x - textWidth / 2 - 8, pillY - pillHeight / 2, textWidth + 16, pillHeight);

            // Draw race and habitability icons to the left of the pill box
            const planetDataForHab = isLastKnown ? lastKnownPlanets[p.id] : p;
            const hName = getHabName(planetDataForHab.habitability);
            const hIcon = habIcons[hName] || '🍀';

            ctx.save();
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            if (raceIcon) {
              ctx.fillText(raceIcon, p.x - textWidth / 2 - 32, pillY);
              ctx.fillText(hIcon, p.x - textWidth / 2 - 20, pillY);
            } else {
              ctx.fillText(hIcon, p.x - textWidth / 2 - 20, pillY);
            }
            ctx.restore();

            if (isHuman) {
              const focus = p.focusMode || 'economy';
              const modeIndicator = focus === 'research' ? '🔬' : (focus === 'garrison' ? '🛡️' : (focus === 'commerce' ? '💲' : (focus === 'mining' ? '⛏️' : (focus === 'terraforming' ? '🌱' : '📈'))));
              const badgeRadius = pillHeight / 2;
              const badgeX = p.x + textWidth / 2 + 8 + badgeRadius + 2;

              // Draw separate circular backdrop for focus badge
              ctx.fillStyle = 'rgba(17, 11, 11, 0.7)';
              ctx.beginPath();
              ctx.arc(badgeX, pillY, badgeRadius, 0, Math.PI * 2);
              ctx.fill();

              // Render emoji badge centered in its circular pill
              ctx.save();
              ctx.font = `${badgeRadius * 1.3}px sans-serif`;
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(modeIndicator, badgeX, pillY);
              ctx.restore();
            }

            let textColor = '#000';
            if (isLastKnown) {
              textColor = '#666';
            } else {
              const techBonus = displayOwner ? Math.sqrt(displayOwner.techScore || 0) : 0;
              const threshold = p.sizeClass * ((p.habitability + techBonus) / 100);
              if (displayMaxShips >= threshold) {
                textColor = '#008800'; // green instead of normal black
              }
            }
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold 12px Orbitron`;
            ctx.fillText(text, p.x, pillY);
          } else {
            // In graphical mode, draw focus mode badge directly to the right of the planet graphic
            if (isHuman) {
              const focus = p.focusMode || 'economy';
              const modeIndicator = focus === 'research' ? '🔬' : (focus === 'garrison' ? '🛡️' : (focus === 'commerce' ? '💲' : (focus === 'mining' ? '⛏️' : (focus === 'terraforming' ? '🌱' : '📈'))));
              const badgeRadius = 10;
              const badgeX = p.x + p.radius + badgeRadius + 4;
              const badgeY = p.y;

              // Draw separate circular backdrop for focus badge
              ctx.fillStyle = 'rgba(17, 11, 11, 0.7)';
              ctx.beginPath();
              ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
              ctx.fill();

              // Render emoji badge centered in its circular pill
              ctx.save();
              ctx.font = `${badgeRadius * 1.3}px sans-serif`;
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(modeIndicator, badgeX, badgeY);
              ctx.restore();
            }

            // Draw race and habitability icons directly to the left of the planet graphic
            const planetDataForHab = isLastKnown ? lastKnownPlanets[p.id] : p;
            const hName = getHabName(planetDataForHab.habitability);
            const hIcon = habIcons[hName] || '🍀';
            const iconRadius = 10;
            const iconY = p.y;

            if (raceIcon) {
              const raceIconX = p.x - p.radius - 38;
              const habIconX = p.x - p.radius - 14;

              // Draw separate circular backdrop for race icon (premium visual style)
              ctx.fillStyle = 'rgba(17, 11, 11, 0.7)';
              ctx.beginPath();
              ctx.arc(raceIconX, iconY, iconRadius, 0, Math.PI * 2);
              ctx.fill();

              // Render emoji badge centered in its circular pill
              ctx.save();
              ctx.font = `${iconRadius * 1.3}px sans-serif`;
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(raceIcon, raceIconX, iconY);
              ctx.restore();

              // Draw separate circular backdrop for habitability icon
              ctx.fillStyle = 'rgba(17, 11, 11, 0.7)';
              ctx.beginPath();
              ctx.arc(habIconX, iconY, iconRadius, 0, Math.PI * 2);
              ctx.fill();

              // Render emoji badge centered in its circular pill
              ctx.save();
              ctx.font = `${iconRadius * 1.3}px sans-serif`;
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(hIcon, habIconX, iconY);
              ctx.restore();
            } else {
              const habIconX = p.x - p.radius - 14;

              // Draw separate circular backdrop for habitability icon
              ctx.fillStyle = 'rgba(17, 11, 11, 0.7)';
              ctx.beginPath();
              ctx.arc(habIconX, iconY, iconRadius, 0, Math.PI * 2);
              ctx.fill();

              // Render emoji badge centered in its circular pill
              ctx.save();
              ctx.font = `${iconRadius * 1.3}px sans-serif`;
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(hIcon, habIconX, iconY);
              ctx.restore();
            }
          }
          let defenderPlanetPenalty = 0;
          let defenderTechPenalty = 0;
          let defenderExpPenalty = 0;

          if (owner) {
            defenderTechPenalty = 0.01 * Math.sqrt(owner.techScore || 0);
            defenderExpPenalty = 0.01 * Math.sqrt(owner.expScore || 0);

            // Calculate defender planet penalty from other defender-friendly planets overlapping p
            if (serverState.planets) {
              for (const otherPlanet of serverState.planets) {
                if (otherPlanet.id !== p.id && otherPlanet.ownerId === owner.id) {
                  const tb = 0.01 * Math.sqrt(owner.techScore || 0);
                  const eb = 0.01 * Math.sqrt(owner.expScore || 0);
                  let baseRadius = otherPlanet.maxShips * 1.5;
                  if (otherPlanet.isMilitary && otherPlanet.ships >= otherPlanet.maxShips) {
                    baseRadius *= 1.5;
                  }
                  const isOtherHuman = owner && !owner.isAI;
                  if (isOtherHuman && otherPlanet.focusMode === 'garrison' && otherPlanet.ships >= otherPlanet.maxShips) {
                    baseRadius += (otherPlanet.ships / 2);
                  }
                  const gr = baseRadius * (1 + tb + eb);
                  const pdx = otherPlanet.x - p.x;
                  const pdy = otherPlanet.y - p.y;
                  if (pdx * pdx + pdy * pdy <= gr * gr) {
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
          }

          let friendlyPlanetBoost = 0;
          if (localPlayer) {
            for (const gp of serverState.planets) {
              if (gp.id === p.id || gp.ownerId !== localPlayer.id) continue;
              const techBonus = 0.01 * Math.sqrt(localPlayer.techScore || 0);
              const expBonus = 0.01 * Math.sqrt(localPlayer.expScore || 0);
              let baseRadius = gp.maxShips * 1.5;
              if (gp.isMilitary && gp.ships >= gp.maxShips) {
                baseRadius *= 1.5;
              }
              const isGpHuman = localPlayer && !localPlayer.isAI;
              if (isGpHuman && gp.focusMode === 'garrison' && gp.ships >= gp.maxShips) {
                baseRadius += (gp.ships / 2);
              }
              const gravityRadius = baseRadius * (1 + techBonus + expBonus);
              const pct = hazardSensorReductionPct(gp.x, gp.y, gp.ownerId);
              const effGravity = Math.max(10, gravityRadius * pct);

              const pdx = gp.x - p.x;
              const pdy = gp.y - p.y;
              if (pdx * pdx + pdy * pdy <= effGravity * effGravity) {
                let mult = 0.002;
                if (gp.isMilitary || gp.focusMode === 'garrison') {
                  if (gp.ships >= gp.maxShips * 2 - 10) {
                    mult = 0.0045;
                  } else if (gp.ships >= gp.maxShips) {
                    mult = 0.003;
                  }
                }
                friendlyPlanetBoost += mult * Math.floor(gp.ships / 10);
              }
            }
          }

          const shipPenalty = 0.01 * Math.floor(p.ships / 5);
          let baseKillChance = 0.8 - shipPenalty - defenderPlanetPenalty + friendlyPlanetBoost - defenderTechPenalty - defenderExpPenalty;

          // Hovered planet combat estimator
          if (hoveredPlanet && hoveredPlanet.id === p.id && (!owner || owner.id !== localPlayer.id) && localPlayer && (selectedShips.length > 0 || selectedPlanets.length > 0)) {
            let totalAttackingships = selectedShips.length;
            for (const sp of selectedPlanets) {
              totalAttackingships += Math.floor(sp.ships / 2);
            }

            if (totalAttackingships > 0) {
              const attackerFleetPenalty = 0.01 * Math.floor(totalAttackingships / 10);
              const attackerTechBonus = 0.01 * Math.sqrt(localPlayer.techScore || 0);
              const attackerExpBonus = 0.01 * Math.sqrt(localPlayer.expScore || 0);

              let maxShipExp = 0;
              for (const s of selectedShips) {
                if (s.expScore > maxShipExp) maxShipExp = s.expScore;
              }
              for (const sp of selectedPlanets) {
                const effectiveExp = sp.expScore || 0;
                if (effectiveExp > maxShipExp) maxShipExp = effectiveExp;
              }
              const attackerLocalExpBonus = 0.01 * Math.sqrt(maxShipExp || 0);
              const defenderLocalExpPenalty = 0.01 * Math.sqrt(p.expScore || 0);

              const humanInvolved = true; // Attacker is localPlayer (always human)
              const humanVsHuman = owner && (!owner.isAI);

              let survivingAICount = 0;
              if (humanVsHuman) {
                const aiOwners = new Set();
                for (const planet of serverState.planets) {
                  if (planet.ownerId) {
                    const pOwner = serverState.players.find(pl => pl.id === planet.ownerId);
                    if (pOwner && pOwner.isAI) {
                      aiOwners.add(pOwner.id);
                    }
                  }
                }
                survivingAICount = aiOwners.size;
              }
              const humanDefenderBonus = humanVsHuman ? (0.02 * survivingAICount) : 0;

              const lastStandPenalty = (humanInvolved && owner && owner.planetCount === 1) ? 0.20 : 0;
              const defenderHomeworldPenalty = (humanInvolved && owner && owner.id === p.homeworldOf) ? 0.20 : 0;
              const attackerHomeworldBonus = (humanInvolved && localPlayer && localPlayer.id === p.homeworldOf && (!owner || owner.id !== localPlayer.id)) ? 0.20 : 0;

              let hazardPenalty = 0;
              if (serverState.storms) {
                for (const storm of serverState.storms) {
                  if (storm.type === 'minefield') continue;
                  const dx = p.x - storm.x;
                  const dy = p.y - storm.y;
                  if (dx * dx + dy * dy <= storm.radius * storm.radius) {
                    const knowledge = (storm.knowledge && typeof storm.knowledge === 'object') ? (storm.knowledge[localPlayer.id] || 0) : (storm.knowledge || 0);
                    const tRed = Math.sqrt(localPlayer.techScore || 0);
                    const eRed = Math.sqrt(localPlayer.expScore || 0);
                    const sRed = Math.sqrt(maxShipExp || 0);
                    const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                    hazardPenalty += eff / 100;
                  }
                }
              }

              const minKillChance = attackerTechBonus + attackerExpBonus + attackerLocalExpBonus;
              const matchesAnySelectedAttacker = selectedShips.some(s => s.cruiserStyle === p.racialAffinity) || 
                                                selectedPlanets.some(sp => sp.racialAffinity === p.racialAffinity) || 
                                                (myPlayer ? myPlayer.cruiserStyle === p.racialAffinity : (localPlayer && localPlayer.cruiserStyle === p.racialAffinity));
              const racialDefenseBonus = !matchesAnySelectedAttacker ? 0.15 : 0;
              const estimatedKillChance = Math.max(minKillChance, baseKillChance - defenderLocalExpPenalty + attackerFleetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - lastStandPenalty - defenderHomeworldPenalty - hazardPenalty - humanDefenderBonus - racialDefenseBonus);
              const displayPercentage = Math.round(estimatedKillChance * 100);

              ctx.fillStyle = '#ff3333';
              ctx.font = `bold 10px Orbitron`;
              ctx.textAlign = 'center';
              ctx.shadowColor = '#000';
              ctx.shadowBlur = 4;
              ctx.fillText(`${displayPercentage}%`, p.x, p.y - pillHeight / 2 - (owner ? 16 : 8));
              if (humanDefenderBonus > 0) {
                ctx.font = `bold 8px Orbitron`;
                ctx.fillStyle = '#ffaa00';
                ctx.fillText(`PvP Def: ${Math.round(humanDefenderBonus * 100)}%`, p.x + 35, p.y - pillHeight / 2 - (owner ? 16 : 8) - 10);
              }
              ctx.shadowBlur = 0;
            }
          }

          if (p.attackerOdds != null) {
            ctx.fillStyle = '#ff3333';
            ctx.fillText(`${p.attackerOdds}%`, p.x, p.y + pillHeight / 2 + 8);
          }
          ctx.shadowBlur = 0;
        }

        if (p.isAICandidate) {
          let badgeOffset = 8;
          const displayHomeworldOf = isLastKnown ? (lastKnownPlanets[p.id] ? lastKnownPlanets[p.id].homeworldOf : null) : p.homeworldOf;
          const displayIsResearch = isLastKnown ? (lastKnownPlanets[p.id] ? lastKnownPlanets[p.id].isResearch : null) : p.isResearch;
          const displayIsMilitary = isLastKnown ? (lastKnownPlanets[p.id] ? lastKnownPlanets[p.id].isMilitary : null) : p.isMilitary;
          const displayIsSpeedPlanet = isLastKnown ? (lastKnownPlanets[p.id] ? lastKnownPlanets[p.id].isSpeedPlanet : null) : p.isSpeedPlanet;
          
          if (displayHomeworldOf || displayIsResearch || displayIsMilitary || displayIsSpeedPlanet) {
            badgeOffset += 18;
          }
          
          let sympathyForeign = 0;
          if (serverState.players) {
            for (const player of serverState.players) {
              if (player.id !== 'monsters') {
                const symVal = getEffectiveSympathyClient(p, player.id);
                if (!p.ownerId || player.id !== p.ownerId) {
                  sympathyForeign += symVal;
                }
              }
            }
          }
          const sympathyOwner = p.ownerId ? getEffectiveSympathyClient(p, p.ownerId) : 0;
          const ratePerMinute = sympathyForeign - (p.ships / 3) - sympathyOwner;
          const eligibleForRevolt = !isLastKnown && ratePerMinute > 0;
          if (eligibleForRevolt) {
            badgeOffset += 18;
          }
          
          ctx.save();
          const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 150);
          ctx.globalAlpha = pulse;
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 10;
          ctx.font = '16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText("✊", p.x, p.y - p.radius - badgeOffset);
          ctx.restore();
        }
      }

      // Defense tooltip on hovered planet
      if (false && hoveredPlanet && serverState.planets) {
        let hp = serverState.planets.find(pp => pp.id === hoveredPlanet.id);
        if (!hp) {
          hoveredPlanet = null;
        } else {
          const isLastKnown = hp.inFog && !hp.permanentlyTracked && lastKnownPlanets[hp.id] ? true : false;
          if (isLastKnown) {
            hp = lastKnownPlanets[hp.id];
          }
          const hpOwner = hp.ownerId ? serverState.players.find(pl => pl.id === hp.ownerId) : null;
          const lines = [];
          let totalDefense = 0;

          // Planet name and type
          let nameLabel = hp.name || 'Unknown';
          if (isLastKnown) {
            nameLabel += ' (Last Known)';
          }
          if (hp.homeworldOf) {
            const hwOwner = serverState.players.find(pl => pl.id === hp.homeworldOf);
            if (hwOwner) nameLabel += ` (👑 ${hwOwner.name})`;
          }
          if (hp.isResearch) nameLabel += ' 🔬';
          if (hp.isMilitary) nameLabel += ' 🏭';
          
          if (hp.isSpeedPlanet) nameLabel += ' ⚡';
          
          lines.push({ label: nameLabel, value: '', color: '#0ff', isHeader: true });

          // Combined Size and Habitability row right after planet name row
          let sizeName = 'Huge';
          const sc = hp.sizeClass || 0;
          if (sc < 65) sizeName = 'Tiny';
          else if (sc < 85) sizeName = 'Small';
          else if (sc < 105) sizeName = 'Average';
          else if (sc < 125) sizeName = 'Large';

          let habName = 'Gaia';
          const hab = hp.habitability || 0;
          if (hab < 20) habName = 'Toxic';
          else if (hab < 30) habName = 'Radiated';
          else if (hab < 40) habName = 'Barren';
          else if (hab < 50) habName = 'Desert';
          else if (hab < 60) habName = 'Tundra';
          else if (hab < 70) habName = 'Swamp';
          else if (hab < 80) habName = 'Jungle';
          else if (hab < 90) habName = 'Ocean';
          else if (hab < 100) habName = 'Arid';
          else if (hab < 120) habName = 'Terran';

          const techBonusForSoftCap = hpOwner ? (hpOwner.techScore || 0) : 0;
          const maxShipsSoftCap = Math.round(sc * ((hab + techBonusForSoftCap) / 100));

          let worldRowColor = '#b0bec5';
          if (hp.maxShips > maxShipsSoftCap) {
            worldRowColor = '#ff3333';
          } else if (hab > 95) {
            worldRowColor = '#4caf50';
          } else if (hab < 75) {
            worldRowColor = '#ffeb3b';
          }

          lines.push({
            isWorldRow: true,
            sizeName: sizeName,
            sizeVal: `(${Math.round(sc)})`,
            habName: habName,
            habVal: `(${Math.round(hab)})`,
            restText: ` World: ${maxShipsSoftCap}`,
            color: worldRowColor
          });

          if (hp.racialAffinity) {
            const raceIcons = {
              'Federation': '🖖',
              'Romulan': '🦅',
              'Klingon': '⚔️',
              'Gorn': '🦎',
              'Tholian': '🕸️',
              'Lyran': '🐶'
            };
            const icon = raceIcons[hp.racialAffinity] || '';
            lines.push({ label: 'Planetary Environment', value: `${icon} ${hp.racialAffinity}`, color: '#e040fb' });
          }

          const resourceMeta = {
            dilithium: { name: 'Dilithium', emoji: '💎' },
            merculite: { name: 'Merculite', emoji: '☄️' },
            duranium: { name: 'Duranium', emoji: '🔲' },
            tritanium: { name: 'Tritanium', emoji: '🔩' },
            antimatter: { name: 'Antimatter', emoji: '🌀' },
            deuterium: { name: 'Deuterium', emoji: '💧' },
            latinum: { name: 'Latinum', emoji: '🏺' }
          };
          if (hp.preferredResource) {
            const meta = resourceMeta[hp.preferredResource];
            if (meta) {
              let valueStr = `${meta.emoji} ${meta.name}`;
              if (hp.maxShips >= 150) {
                valueStr += ' ⭐';
              }
              if (hpOwner) {
                const qty = hpOwner.resources?.[hp.preferredResource] || 0;
                if (qty >= 0.1) {
                  let mult = 1;
                  if (hp.maxShips >= 150) mult = 4;
                  else if (hp.maxShips >= 120) mult = 3;
                  else if (hp.maxShips >= 100) mult = 2;
                  const bonus = Math.sqrt(qty) * mult;
                  valueStr += ` (+${bonus.toFixed(1)}%)`;
                }
              }
              lines.push({ label: 'Preferred Resource', value: valueStr, color: '#ffd740' });
            }
          }

          // Show Diplomacy Chance on neutral/enemy planets
          const isNeutralOrEnemy = !hp.ownerId || hp.ownerId !== localPlayer.id;
          if (isNeutralOrEnemy) {
            const currentSym = getEffectiveSympathyClient(hp, localPlayer.id);
            const expBonus = Math.sqrt(myPlayer.expScore || 0);
            const selectedCruiser = getSelectedCruiser();
            const shipExpBonus = selectedCruiser ? Math.sqrt(selectedCruiser.expScore || 0) : 0;
            const bonusSum = expBonus + shipExpBonus;
            const disposition = hp.disposition?.[localPlayer.id] ?? 0;
            
            let racialBonus = 0;
            if (selectedCruiser && (selectedCruiser.cruiserStyle === hp.racialAffinity || (selectedCruiser.owner && selectedCruiser.owner.cruiserStyle === hp.racialAffinity))) {
              racialBonus = 20;
            }

            const chanceBase = 30 + disposition + currentSym + bonusSum + racialBonus;
            const chancePref = 30 + disposition + currentSym + (bonusSum * 3) + 10 + racialBonus;
            
            const basePercent = Math.max(0, Math.round(chanceBase));
            const prefPercent = Math.max(0, Math.round(chancePref));
            
            const emojis = {
              dilithium: '💎',
              merculite: '☄️',
              duranium: '🔲',
              tritanium: '🔩',
              antimatter: '🌀',
              deuterium: '💧',
              latinum: '🏺'
            };
            if (hp.preferredResource) {
              const prefEmoji = emojis[hp.preferredResource] || '💎';
              lines.push({ 
                label: '🤝 Diplomacy Chance', 
                value: `${basePercent}%, with ${prefEmoji}: ${prefPercent}%`, 
                color: '#4caf50' 
              });
            } else {
              lines.push({ 
                label: '🤝 Diplomacy Chance', 
                value: `${basePercent}%`, 
                color: '#4caf50' 
              });
            }
          }

          // Garrison
          const garrisonPenalty = Math.floor(hp.ships / 5);
          if (garrisonPenalty > 0) {
            totalDefense += garrisonPenalty;
            lines.push({ label: 'Garrison Defense', value: `${garrisonPenalty}%`, color: '#4f4' });
          }

          // Gravity Well Support (Defender Friendly)
          let defenderPlanetPenalty = 0;
          if (hpOwner && serverState.planets) {
            for (const otherPlanet of serverState.planets) {
              if (otherPlanet.id !== hp.id && otherPlanet.ownerId === hpOwner.id) {
                const tb = 0.01 * Math.sqrt(hpOwner.techScore || 0);
                const eb = 0.01 * Math.sqrt(hpOwner.expScore || 0);
                let baseRadius = otherPlanet.maxShips * 1.5;
                if (otherPlanet.isMilitary && otherPlanet.ships >= otherPlanet.maxShips) {
                  baseRadius *= 1.5;
                }
                const isOtherHuman = hpOwner && !hpOwner.isAI;
                if (isOtherHuman && otherPlanet.focusMode === 'garrison' && otherPlanet.ships >= otherPlanet.maxShips) {
                  baseRadius += (otherPlanet.ships / 2);
                }
                const gr = baseRadius * (1 + tb + eb);
                const pdx = otherPlanet.x - hp.x;
                const pdy = otherPlanet.y - hp.y;
                if (pdx * pdx + pdy * pdy <= gr * gr) {
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
          const defPlanetPenaltyPct = Math.round(defenderPlanetPenalty * 100 * 10) / 10;
          if (defPlanetPenaltyPct > 0) {
            totalDefense += defPlanetPenaltyPct;
            lines.push({ label: 'Gravity Well Support', value: `${Math.round(defPlanetPenaltyPct)}%`, color: '#4f4' });
          }

          let hasEnvDefense = false;
          let envLabel = 'Environmental Defense';
          if (hp.racialAffinity) {
            const matchesOurForces = selectedShips.some(s => s.cruiserStyle === hp.racialAffinity) || 
                                     selectedPlanets.some(sp => sp.racialAffinity === hp.racialAffinity) || 
                                     (myPlayer ? myPlayer.cruiserStyle === hp.racialAffinity : (localPlayer && localPlayer.cruiserStyle === hp.racialAffinity));
            if (hpOwner) {
              if (localPlayer && hpOwner.id === localPlayer.id) {
                hasEnvDefense = true;
                envLabel = 'Env Defense (vs non-matching)';
              } else {
                if (!matchesOurForces) {
                  hasEnvDefense = true;
                  envLabel = 'Env Defense (vs attacker)';
                }
              }
            } else {
              if (!matchesOurForces) {
                hasEnvDefense = true;
                envLabel = 'Env Defense (vs attacker)';
              }
            }
          }

          if (hpOwner) {
            const techDef = Math.round(Math.sqrt(hpOwner.techScore || 0) * 100) / 100;
            if (techDef > 0) {
              totalDefense += techDef;
            }
            const expDef = Math.round(Math.sqrt(hpOwner.expScore || 0) * 100) / 100;
            if (expDef > 0) {
              totalDefense += expDef;
            }
            const planetExp = Math.round(Math.sqrt(hp.expScore || 0) * 100) / 100;
            if (planetExp > 0) {
              totalDefense += planetExp;
              lines.push({ label: 'Planet Exp', value: `${Math.round(planetExp)}%`, color: '#4f4' });
            }



            if (hasEnvDefense) {
              totalDefense += 15;
              lines.push({ label: envLabel, value: `15%`, color: '#e040fb' });
            }

            if (hpOwner.id === hp.homeworldOf) {
              totalDefense += 15;
              lines.push({ label: 'Homeworld', value: `15%`, color: '#ff0' });
            }

            if (hpOwner.planetCount === 1) {
              totalDefense += 15;
              lines.push({ label: 'Last stand', value: `15%`, color: '#ff0' });
            }

            // PvP defense bonus (Human vs Human)
            if (localPlayer && !localPlayer.isAI && !hpOwner.isAI) {
              const aiOwners = new Set();
              for (const p of serverState.planets) {
                if (p.ownerId) {
                  const pOwner = serverState.players.find(pl => pl.id === p.ownerId);
                  if (pOwner && pOwner.isAI) {
                    aiOwners.add(p.ownerId);
                  }
                }
              }
              const survivingAICount = aiOwners.size;
              const hvhBonus = survivingAICount * 2;
              if (hvhBonus > 0) {
                totalDefense += hvhBonus;
                lines.push({ label: 'PvP Defense', value: `${hvhBonus}%`, color: '#ff0' });
              }
            }

            // Planet Focus Details
            if (!hpOwner.isAI) {
              const focus = hp.focusMode || 'economy';
              const capitalizedFocus = focus.charAt(0).toUpperCase() + focus.slice(1);
              const cost = Math.floor(hp.maxShips / 2);
              lines.push({ label: 'Focus Mode', value: `${capitalizedFocus} (Change: ${cost} 🪐)`, color: '#ffd740' });
            }
          } else {
            if (hasEnvDefense) {
              totalDefense += 15;
              lines.push({ label: envLabel, value: `15%`, color: '#e040fb' });
            } else {
              lines.push({ label: 'Neutral', value: 'No defense bonuses', color: '#888' });
            }
          }

          // Storm / Nebula defensive support
          if (serverState.storms) {
            const defenseOwner = hpOwner || { techScore: 0, expScore: 0, id: 'neutral' };
            for (const storm of serverState.storms) {
              if (storm.type === 'minefield') continue;
              const sdx = hp.x - storm.x;
              const sdy = hp.y - storm.y;
              if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
                const knowledge = (storm.knowledge && typeof storm.knowledge === 'object') ? (storm.knowledge[defenseOwner.id] || 0) : (storm.knowledge || 0);
                const tRed = Math.sqrt(defenseOwner.techScore || 0);
                const eRed = Math.sqrt(defenseOwner.expScore || 0);
                const sRed = 0; // No ship exp on planet itself
                const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                if (eff > 0) {
                  totalDefense += eff;
                  const label = storm.type === 'nebula' ? 'Nebula Shielding' : 'Ion Interference';
                  lines.push({ label: label, value: `${Math.round(eff)}%`, color: storm.type === 'nebula' ? '#ff4444' : '#ffff44' });
                }
              }
            }
          }

          lines[0].value = totalDefense > 0 ? `🛡️ ${Math.round(totalDefense)}%` : '';

          // Show sympathy levels on the planet tooltip
          if (serverState && serverState.players) {
            for (const pl of serverState.players) {
              if (pl.id !== 'monsters') {
                const symVal = getEffectiveSympathyClient(hp, pl.id);
                if (symVal > 0) {
                  const baseSym = hp.sympathy?.[pl.id] || 0;
                  lines.push({ label: `💖 Sympathy (${pl.name})`, value: `${Math.round(baseSym)}/${Math.round(symVal)}`, color: pl.color });
                }
              }
            }
          }

          // Show disposition levels on the planet tooltip
          if (hp.disposition) {
            for (const [pId, dispVal] of Object.entries(hp.disposition)) {
              if (dispVal !== undefined && dispVal !== null) {
                const targetPlayer = serverState.players.find(pl => pl.id === pId);
                const pName = targetPlayer ? targetPlayer.name : pId;
                const pColor = targetPlayer ? targetPlayer.color : '#e040fb';
                const dVal = Math.round(dispVal);
                let emoji = '';
                if (dVal < -35) emoji = '😠';
                else if (dVal < -15) emoji = '😢';
                else if (dVal < 1) emoji = '😐';
                else if (dVal < 20) emoji = '🙂';
                else if (dVal < 40) emoji = '😀';
                else emoji = '😍';

                let scoreColor = '#ff3333';
                if (dVal > 0) {
                  scoreColor = '#4caf50';
                } else if (dVal > -25) {
                  scoreColor = '#ffeb3b';
                }

                lines.push({ 
                  label: `🎭 Disposition (${pName})`, 
                  value: `${dVal} ${emoji}`, 
                  color: pColor,
                  valueColor: scoreColor
                });
              }
            }
          }

          // Show Trade Income below the disposition rows on canvas planet tooltip
          const planetTradeRatePerMin = getPlanetTradeIncomePerMin(hp);
          if (planetTradeRatePerMin > 0) {
            const effShips = planetTradeRatePerMin * 25;
            const effShipsStr = Number(effShips.toFixed(1)).toString();
            lines.push({
              label: `💰 Trading Ships Active: ${effShipsStr}`,
              value: `+${planetTradeRatePerMin.toFixed(2)}/m`,
              color: '#ffd54f'
            });
          }



          if (serverState.storms) {
            for (const storm of serverState.storms) {
              const dx = hp.x - storm.x, dy = hp.y - storm.y;
              if (dx * dx + dy * dy <= storm.radius * storm.radius) {
                const typeLabel = storm.type === 'minefield' ? 'Minefield' : storm.type === 'nebula' ? 'Nebula' : 'Ion Storm';
                const typeColor = storm.type === 'minefield' ? '#66f' : storm.type === 'nebula' ? '#f66' : '#ff0';
                lines.push({ label: `⚠️ ${typeLabel}`, value: `Int: ${storm.intensity}`, color: typeColor });
              }
            }
          }

          for (const line of lines) {
            if (line.label != null) line.label = formatTooltipString(line.label);
            if (line.value != null) line.value = formatTooltipString(line.value);
          }

          ctx.save();
          const tooltipFont = '11px Orbitron';
          const headerFont = 'bold 12px Orbitron';

          const padding = 10;
          const lineHeight = 18;
          const headerHeight = 22;
          let maxWidth = 0;
          for (const line of lines) {
            ctx.font = line.isHeader ? headerFont : tooltipFont;
            let w = 0;
            if (line.isWorldRow) {
              ctx.font = tooltipFont;
              w += ctx.measureText(line.sizeName).width;
              w += ctx.measureText(' ').width;
              ctx.font = '5.5px Orbitron';
              w += ctx.measureText(line.sizeVal).width;
              ctx.font = tooltipFont;
              w += ctx.measureText(` ${line.habName} `).width;
              ctx.font = '5.5px Orbitron';
              w += ctx.measureText(line.habVal).width;
              ctx.font = tooltipFont;
              w += ctx.measureText(line.restText).width;
            } else {
              w = ctx.measureText((line.label || '') + '  ' + (line.value || '')).width;
            }
            if (w > maxWidth) maxWidth = w;
          }

          const tooltipW = maxWidth + padding * 2 + 10;
          const tooltipH = lines.reduce((h, l) => h + (l.isHeader ? headerHeight : lineHeight), 0) + padding * 2;

          let tooltipX = hp.x + hp.radius + 15;
          let tooltipY = hp.y - tooltipH / 2;

          const mapWidth = serverState.width || 1920;
          const mapHeight = serverState.height || 1620;
          if (tooltipX + tooltipW > mapWidth) tooltipX = hp.x - hp.radius - 15 - tooltipW;
          if (tooltipY < 0) tooltipY = 5;
          if (tooltipY + tooltipH > mapHeight) tooltipY = mapHeight - tooltipH - 5;

          ctx.fillStyle = 'rgba(5, 5, 15, 0.92)';
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 6);
          ctx.fill();
          ctx.stroke();

          let curY = tooltipY + padding;
          for (const line of lines) {
            const lh = line.isHeader ? headerHeight : lineHeight;
            ctx.fillStyle = line.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            if (line.isWorldRow) {
              const segments = [
                { text: line.sizeName, font: tooltipFont },
                { text: ' ', font: tooltipFont },
                { text: line.sizeVal, font: '5.5px Orbitron' },
                { text: ` ${line.habName} `, font: tooltipFont },
                { text: line.habVal, font: '5.5px Orbitron' },
                { text: line.restText, font: tooltipFont }
              ];
              let xOffset = tooltipX + padding;
              for (const seg of segments) {
                ctx.font = seg.font;
                const yOffset = (seg.font === '5.5px Orbitron') ? 2.5 : 0;
                ctx.fillText(seg.text, xOffset, curY + yOffset);
                xOffset += ctx.measureText(seg.text).width;
              }
            } else {
              ctx.font = line.isHeader ? headerFont : tooltipFont;
              ctx.fillText(line.label || '', tooltipX + padding, curY);
              if (line.value) {
                ctx.textAlign = 'right';
                if (line.valueColor) {
                  ctx.fillStyle = line.valueColor;
                }
                ctx.fillText(line.value, tooltipX + tooltipW - padding, curY);
              }
            }
            curY += lh;
          }
          ctx.restore();
        }
      }

      // Fleet tooltip on hovered ship
      if (false && hoveredShip && !hoveredPlanet && serverState && serverState.ships) {
        const hs = serverState.ships.find(ss => ss.id === hoveredShip.id);
        if (!hs) {
          hoveredShip = null;
        } else {
          const hsOwner = hs.ownerId ? serverState.players.find(pl => pl.id === hs.ownerId) : null;
          if (hsOwner) {
          const lines = [];
          let totalAttackMod = 0;

          if (hs.isAmoeba) {
            lines.push({ label: 'Giant Space Amoeba', value: '', color: '#0f0', isHeader: true });
            const currentTotalHealth = Math.floor(hs.health) + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
            const maxTotalHealth = hs.maxHealth + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
            lines.push({ label: 'Health', value: currentTotalHealth + ' / ' + maxTotalHealth, color: '#fff' });
            lines.push({ label: 'Sacs', value: (hs.bombs || 0).toFixed(1) + ' / ' + hs.maxHealth, color: '#ff0' });
            if (hs.isHungry) {
              lines.push({ label: 'Status', value: 'Hungry (will grow)', color: '#f66' });
            } else {
              lines.push({ label: 'Status', value: 'Digesting', color: '#4f4' });
            }
            const displayedMaxHealth = hs.maxHealth + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
            let effectiveRange = 20 + displayedMaxHealth;
            if (hs.bombs > 0) {
              effectiveRange += 10;
            }
            lines.push({ label: 'Attack Range', value: Math.floor(effectiveRange) + 'px', color: '#f88' });
            const techBonus = Math.sqrt(hsOwner.techScore || 0);
            const expBonus = Math.sqrt(hsOwner.expScore || 0);
            const shipExpBonus = Math.sqrt(hs.expScore || 0);
            const bombBonus = (hs.bombs && hs.bombs > 0) ? (hs.bombs * 3) : 0;
            const amoebaHitChance = Math.round(Math.min(100, 10 + techBonus + expBonus + shipExpBonus + hs.maxHealth * 5 + bombBonus)) + '%';
            lines.push({ label: 'Accuracy', value: amoebaHitChance, color: '#f88' });
            const shrugChance = Math.min(95, Math.floor(50 + hs.maxHealth * 1 + (techBonus + expBonus + shipExpBonus) * 1));
            lines.push({ label: 'Deflection', value: shrugChance + '%', color: '#ccc' });
          } else if (hs.isCruiser) {
            let shipClass = "Mammoth";
            if (hs.classType && SHIP_CLASSES[hs.classType]) {
              shipClass = SHIP_CLASSES[hs.classType].name;
            } else {
              if (hs.maxHealth <= 19) shipClass = "Corvette";
              else if (hs.maxHealth <= 24) shipClass = "Frigate";
              else if (hs.maxHealth <= 29) shipClass = "Destroyer";
              else if (hs.maxHealth <= 34) shipClass = "Cruiser";
              else if (hs.maxHealth <= 39) shipClass = "Battlecruiser";
              else if (hs.maxHealth <= 44) shipClass = "Battleship";
              else if (hs.maxHealth <= 49) shipClass = "Titan";
            }

            const raceStyle = hs.cruiserStyle || (hsOwner ? hsOwner.cruiserStyle : null);
            let raceStr = '';
            if (raceStyle) {
              const raceIcons = {
                'Federation': '🖖',
                'Romulan': '🦅',
                'Klingon': '⚔️',
                'Gorn': '🦎',
                'Tholian': '🕸️',
                'Lyran': '🐶'
              };
              const icon = raceIcons[raceStyle] || '';
              raceStr = (icon ? icon + ' ' : '') + raceStyle;
            }

            const headerLabel = hsOwner.name + (raceStr ? ' ' + raceStr : '') + ' ' + (hs.name ? shipClass + ' ' + hs.name : shipClass);
            lines.push({ label: headerLabel, value: '', color: hsOwner.color || '#0ff', isHeader: true });

            lines.push({ label: 'Hull Integrity', value: Math.floor(hs.health) + ' / ' + hs.maxHealth, color: '#fff' });
            if (hs.isCruiser) {
              const totalUpgrades = (hs.sensorarrays || 0) +
                                    (hs.labs || 0) +
                                    (hs.armor || 0) +
                                    (hs.shields || 0) +
                                    (hs.engine || 0) +
                                    (hs.munitions || 0) +
                                    (hs.targeting || 0) +
                                    (hs.damagecontrol || 0) +
                                    (hs.fuel_tanker || 0) +
                                    (hs.diplomat || 0) +
                                    (hs.marines || 0) +
                                    (hs.command || 0);
              const maxTotalUpgrades = Math.floor((hs.maxHealth || 0) / 5);
              const upgradesRemaining = maxTotalUpgrades - totalUpgrades;
              if (upgradesRemaining > 0) {
                lines.push({ label: 'Upgrades Remaining', value: '' + upgradesRemaining, color: '#00e5ff' });
              }
            }

            let fuelLabel = hs.engine > 0 ? `Fuel (${hs.engine})` : 'Fuel';
            if (hs.specialfuel && hs.specialfuel > 0) {
              fuelLabel += '*';
            }
            const fuelVal = Math.floor(hs.fuel || 0) + ' / ' + Math.floor(getMaxFuel(hs));
            const speedVal = (hs.currentSpeed || 0).toFixed(1) + ' / ' + (hs.speed || 30).toFixed(1);
            lines.push({ label: `⚡ Speed`, value: `${speedVal}`, color: '#ffa500' });
            lines.push({ label: `⛽ ${fuelLabel}`, value: `${fuelVal}`, color: (hs.fuel <= 0 ? '#f00' : '#ffa500') });

            if (hs.maxArmor && hs.maxArmor > 0) {
              let armorLabel = `Cruiser Armor (${hs.armor})`;
              if (hs.specialduranium && hs.specialduranium > 0) {
                armorLabel += '*';
              }
              lines.push({ label: armorLabel, value: Math.floor(hs.armorPoints) + ' / ' + Math.floor(hs.maxArmor), color: '#b0bec5' });
            }
            if (hs.sensorarrays > 0) lines.push({ label: `Sensor Array (${hs.sensorarrays})`, value: `📡 Active`, color: '#ffb300' });
            if (hs.labs > 0) lines.push({ label: `Laboratories (${hs.labs})`, value: `🔬 Active`, color: '#00e5ff' });
            if (hs.damagecontrol > 0) lines.push({ label: `Damage Control (${hs.damagecontrol})`, value: `🔧 Active`, color: '#69f0ae' });
            if (hs.fuel_tanker > 0) lines.push({ label: `Fuel Tanker (${hs.fuel_tanker})`, value: `⛽ ${25 + hs.fuel_tanker * 10}% Savings`, color: '#ffa500' });
            if (hs.diplomat > 0) lines.push({ label: `Diplomats (${hs.diplomat})`, value: `🤝 ${hs.diplomat} Active`, color: '#e040fb' });

            let crewVal = `👤 ${Math.floor(hs.crew || 0)} / ${Math.floor(2 * hs.health)}`;
            if (hs.marines > 0) {
              crewVal += `  |  🪖 Marines: ${Math.floor(hs.marineCount || 0)} / ${hs.marines * hs.maxHealth}`;
            }
            lines.push({ label: 'Crew', value: crewVal, color: '#81d4fa' });

            const rawTech = hsOwner.techScore || 0;
            const rawExp = hsOwner.expScore || 0;
            const shipExp = hs.expScore || 0;

            const techBonus = Math.sqrt(rawTech);
            const expBonus = Math.sqrt(rawExp);
            const shipExpBonus = Math.sqrt(shipExp) + (hs.commandPoints || 0);

            const baseDeflection = hs.maxHealth + (techBonus + expBonus + shipExpBonus);
            let shrugChance = Math.floor(baseDeflection);
            if ((hs.bombs || 0) < 1) {
              shrugChance = Math.floor(shrugChance / 2);
            }
            if (hs.specialduranium && hs.specialduranium > 0) {
              shrugChance += 10;
            }
            shrugChance = Math.min(90, shrugChance);
            let deflectionLabel = 'Deflection';
            if (hs.specialduranium && hs.specialduranium > 0) {
              deflectionLabel += '*';
            }

            const maxBombs = getMaxBombs(hs);
            let munitionsDisplay = (hs.bombs || 0).toFixed(1) + ' / ' + maxBombs.toFixed(1);
            let munitionsLabel = hs.munitions > 0 ? `Munitions (${hs.munitions})` : 'Munitions';
            if (hs.specialbombs && hs.specialbombs > 0) {
              munitionsLabel += '*';
            }
            lines.push({ label: `${munitionsLabel}`, value: `${munitionsDisplay}  |  🛡️ ${deflectionLabel}: ${shrugChance}%`, color: '#ffa' });
            if (hs.munitions > 0) {
              lines.push({ label: 'Splash Damage', value: `+${hs.munitions}`, color: '#ffd740' });
            }

            if (hs.maxsupplies > 0) {
              lines.push({ label: 'Supplies', value: `📦 ${Math.floor(hs.supplies || 0)} / ${hs.maxsupplies}`, color: '#ffcc80' });
            }

            const laserTechBonus = Math.floor(techBonus) * 0.01;
            const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
            const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
            const targetingBonus = (hs.targeting || 0) * 5;
            const targetingRangeBonus = (hs.targeting || 0) * 0.05;

            let effectiveRange = baseDogfightRange * 1.10;
            if (hs.bombs > 0) {
              effectiveRange += baseDogfightRange * 0.10;
            }
            effectiveRange = Math.floor(effectiveRange * (1 + targetingRangeBonus));
            if (hs.fuel_tanker && hs.fuel_tanker > 0) {
              effectiveRange = Math.max(5, effectiveRange - hs.fuel_tanker * 5);
            }
            if (hs.specialbombs && hs.specialbombs > 0) {
              effectiveRange += 10;
            }
            if (hs.package === 'brute') {
              effectiveRange *= 0.5;
            } else if (hs.package === 'sniper') {
              effectiveRange *= 1.5;
            }
            effectiveRange = Math.floor(effectiveRange);

            let bombAccuracyBonus = 0;
            if (hs.bombs > 0) {
              bombAccuracyBonus = 10;
              let effTactics = hs.tactics;
              if (!effTactics) {
                if (hs.cruiserStyle === 'Tholian' || hs.cruiserStyle === 'Lyran') {
                  effTactics = 'patient';
                } else if (hs.cruiserStyle === 'Romulan') {
                  effTactics = 'frenzied';
                } else {
                  effTactics = 'normal';
                }
              }
              if (effTactics === 'patient') {
                bombAccuracyBonus = 7;
              } else if (effTactics === 'frenzied') {
                bombAccuracyBonus = 20;
              }
            }

            let hitChanceValue = 10 + targetingBonus + bombAccuracyBonus;
            hitChanceValue += techBonus + expBonus + shipExpBonus;
            if (hs.fuel_tanker && hs.fuel_tanker > 0) {
              hitChanceValue -= hs.fuel_tanker * 5;
            }
            if (hs.specialbombs && hs.specialbombs > 0) {
              hitChanceValue += 10;
            }
            
            let friendlyGrav = 0;
            let enemyGrav = 0;
            if (serverState.planets) {
              for (const gp of serverState.planets) {
                if (!gp.ownerId) continue;
                const gpOwner = serverState.players.find(pl => pl.id === gp.ownerId);
                if (!gpOwner) continue;
                const tb = 0.01 * Math.sqrt(gpOwner.techScore || 0);
                const eb = 0.01 * Math.sqrt(gpOwner.expScore || 0);
                let baseRadius = gp.maxShips * 1.5;
                if (gp.isMilitary && gp.ships >= gp.maxShips) {
                  baseRadius *= 1.5;
                }
                const isGpHuman = gpOwner && !gpOwner.isAI;
                if (isGpHuman && gp.focusMode === 'garrison' && gp.ships >= gp.maxShips) {
                  baseRadius += (gp.ships / 2);
                }
                const gr = baseRadius * (1 + tb + eb);
                const pdx = gp.x - hs.x, pdy = gp.y - hs.y;
                if (pdx * pdx + pdy * pdy <= gr * gr) {
                  let mult = 0.2;
                  if (gp.isMilitary || gp.focusMode === 'garrison') {
                    if (gp.ships >= gp.maxShips * 2 - 10) {
                      mult = 0.45;
                    } else if (gp.ships >= gp.maxShips) {
                      mult = 0.3;
                    }
                  }
                  const strength = mult * Math.floor(gp.ships / 10);
                  if (gp.ownerId === hs.ownerId) {
                    friendlyGrav += strength;
                  } else {
                    enemyGrav += strength;
                  }
                }
              }
            }
            
            let hazardPenalty = 0;
            if (serverState.storms) {
              for (const storm of serverState.storms) {
                if (storm.type === 'minefield') continue;
                const sdx = hs.x - storm.x;
                const sdy = hs.y - storm.y;
                if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
                  const knowledge = typeof storm.knowledge === 'object' ? ((storm.knowledge && storm.knowledge[hsOwner.id]) || 0) : (storm.knowledge || 0);
                  const tRed = Math.sqrt(hsOwner.techScore || 0);
                  const eRed = Math.sqrt(hsOwner.expScore || 0);
                  const sRed = Math.sqrt(hs.expScore || 0);
                  const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                  hazardPenalty += eff;
                }
              }
            }

            const hitChance = Math.round(Math.min(100, Math.max(10.0, hitChanceValue + friendlyGrav - enemyGrav - hazardPenalty))) + '%';

            let volleySizeVal = Math.max(1, Math.floor((hs.maxHealth + hs.health) / 6));
            const cap = Math.floor(hs.health - 2);
            if (volleySizeVal > cap) volleySizeVal = cap;
            if (hs.health <= 2) volleySizeVal = 0;
            const volleySize = volleySizeVal === 0 ? '0 (Disabled)' : volleySizeVal;
            let rangeLabel = 'Range';
            if (hs.specialbombs && hs.specialbombs > 0) {
              rangeLabel += '*';
            }
            let accuracyLabel = hs.targeting > 0 ? `Accuracy (${hs.targeting})` : 'Accuracy';
            if (hs.specialbombs && hs.specialbombs > 0) {
              accuracyLabel += '*';
            }
            lines.push({ label: `🎯 ${accuracyLabel}`, value: `${hitChance}  |  📏 ${rangeLabel}: ${effectiveRange}px`, color: '#f88' });
            
            const netMapBonus = friendlyGrav - enemyGrav - hazardPenalty;
            if (netMapBonus !== 0) {
              const sign = netMapBonus > 0 ? '+' : '';
              const color = netMapBonus > 0 ? '#4f4' : '#f66';
              lines.push({ label: 'Map Bonus', value: `${sign}${Math.round(netMapBonus)}%`, color: color });
            }
            
            // speed modifier
            const sm = hs.speedModifier || 1.0;
            if (sm < 1.0) {
              const speedLabel = sm === 0.25 ? '1/4 speed' : sm === 0.50 ? '1/2 speed' : `${Math.round(sm * 100)}% speed`;
              const saveChance = sm === 0.25 ? 90 : sm === 0.50 ? 75 : 0;
              lines.push({ label: speedLabel, value: saveChance > 0 ? `${saveChance}% save` : '', color: '#aaf' });
            }
            
            lines.push({ label: 'Volley Size', value: volleySize, color: '#ffa' });

            lines.push({ label: 'XP', value: `+${Math.round(shipExpBonus)}`, color: '#00d5ff' });
          } else {
            // Count nearby friendly ships within swarm bonus range (100px)
            const swarmRange = 100;
            const swarmRangesq = swarmRange * swarmRange;
            let nearbyCount = 0;
            let bomberCount = 0;
            let maxShipExp = hs.expScore || 0;
            let avgFlightTime = hs.flightTime || 0;
            let flightTimeCount = 1;
            for (const ship of serverState.ships) {
              if (ship.id === hs.id || ship.ownerId !== hs.ownerId || !ship.active) continue;
              const sdx = ship.x - hs.x;
              const sdy = ship.y - hs.y;
              if (sdx * sdx + sdy * sdy <= swarmRangesq) {
                nearbyCount += (ship.count || 1);
                if (ship.isBomber) bomberCount += (ship.count || 1);
                if ((ship.expScore || 0) > maxShipExp) maxShipExp = ship.expScore || 0;
                avgFlightTime += (ship.flightTime || 0) * (ship.count || 1);
                flightTimeCount += (ship.count || 1);
              }
            }
            avgFlightTime /= flightTimeCount;
            const totalShips = nearbyCount + (hs.count || 1);

            // Header
            lines.push({ label: `${hsOwner.name}'s Fleet`, value: '', color: hsOwner.color || '#0ff', isHeader: true });

            // ship count
            const bomberLabel = bomberCount > 0 ? ` (${bomberCount + (hs.isBomber ? 1 : 0)} bombers)` : '';
            lines.push({ label: 'ships in range', value: `${totalShips}${bomberLabel}`, color: '#ccc' });
            const raceStyle = hs.cruiserStyle || (hsOwner ? hsOwner.cruiserStyle : null);
            if (raceStyle) {
              const raceIcons = {
                'Federation': '🖖',
                'Romulan': '🦅',
                'Klingon': '⚔️',
                'Gorn': '🦎',
                'Tholian': '🕸️',
                'Lyran': '🐶'
              };
              const icon = raceIcons[raceStyle] || '';
              lines.push({ label: 'Race', value: `${icon} ${raceStyle}`, color: '#e040fb' });
            }
            lines.push({ label: 'Base Speed', value: (hs.speed || 30).toFixed(1), color: '#ccc' });
            lines.push({ label: 'Effective Speed', value: (hs.currentSpeed || 0).toFixed(1), color: '#4f4' });

            // swarm bonus
            const swarmBonus = Math.floor(nearbyCount / 10);
            if (swarmBonus > 0) {
              totalAttackMod += swarmBonus;
              lines.push({ label: 'swarm Bonus', value: `${swarmBonus}%`, color: '#4f4' });
            }

            // Tech attack bonus
            const techAtk = Math.round(Math.sqrt(hsOwner.techScore || 0));
            if (techAtk > 0) {
               totalAttackMod += techAtk;
               lines.push({ label: 'Tech Attack', value: `${techAtk}%`, color: '#4f4' });
            }

            // Exp attack bonus
            const expAtk = Math.round(Math.sqrt(hsOwner.expScore || 0));
            if (expAtk > 0) {
               totalAttackMod += expAtk;
               lines.push({ label: 'Exp Attack', value: `${expAtk}%`, color: '#4f4' });
            }

            // ship local exp
            const shipExp = Math.round(Math.sqrt(maxShipExp || 0));
            if (shipExp > 0) {
              totalAttackMod += shipExp;
              lines.push({ label: 'ship Exp', value: `${shipExp}%`, color: '#4f4' });
            }

            // Friendly and Enemy gravity wells (check planets near hovered ship position)
            let friendlyGrav = 0;
            let enemyGrav = 0;
            if (serverState.planets) {
              for (const gp of serverState.planets) {
                if (!gp.ownerId) continue;
                const gpOwner = serverState.players.find(pl => pl.id === gp.ownerId);
                if (!gpOwner) continue;
                const tb = 0.01 * Math.sqrt(gpOwner.techScore || 0);
                const eb = 0.01 * Math.sqrt(gpOwner.expScore || 0);
                let baseRadius = gp.maxShips * 1.5;
                if (gp.isMilitary && gp.ships >= gp.maxShips) {
                  baseRadius *= 1.5;
                }
                const isGpHuman = gpOwner && !gpOwner.isAI;
                if (isGpHuman && gp.focusMode === 'garrison' && gp.ships >= gp.maxShips) {
                  baseRadius += (gp.ships / 2);
                }
                const gr = baseRadius * (1 + tb + eb);
                const pdx = gp.x - hs.x, pdy = gp.y - hs.y;
                if (pdx * pdx + pdy * pdy <= gr * gr) {
                  let mult = 0.2;
                  if (gp.isMilitary || gp.focusMode === 'garrison') {
                    if (gp.ships >= gp.maxShips * 2 - 10) {
                      mult = 0.45;
                    } else if (gp.ships >= gp.maxShips) {
                      mult = 0.3;
                    }
                  }
                  const strength = mult * Math.floor(gp.ships / 10);
                  if (gp.ownerId === hs.ownerId) {
                    friendlyGrav += strength;
                  } else {
                    enemyGrav += strength;
                  }
                }
              }
            }
            let hazardPenalty = 0;
            if (serverState.storms) {
              for (const storm of serverState.storms) {
                if (storm.type === 'minefield') continue;
                const sdx = hs.x - storm.x;
                const sdy = hs.y - storm.y;
                if (sdx * sdx + sdy * sdy <= storm.radius * storm.radius) {
                  const knowledge = typeof storm.knowledge === 'object' ? ((storm.knowledge && storm.knowledge[hsOwner.id]) || 0) : (storm.knowledge || 0);
                  const tRed = Math.sqrt(hsOwner.techScore || 0);
                  const eRed = Math.sqrt(hsOwner.expScore || 0);
                  const sRed = Math.sqrt(maxShipExp || 0);
                  const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                  hazardPenalty += eff;
                }
              }
            }

            if (friendlyGrav > 0) {
              totalAttackMod += friendlyGrav;
            }
            if (enemyGrav > 0) {
              totalAttackMod -= enemyGrav;
            }
            if (hazardPenalty > 0) {
              totalAttackMod -= hazardPenalty;
            }

            const netMapBonus = friendlyGrav - enemyGrav - hazardPenalty;
            if (netMapBonus !== 0) {
              const sign = netMapBonus > 0 ? '+' : '';
              const color = netMapBonus > 0 ? '#4f4' : '#f66';
              lines.push({ label: 'Map Bonus', value: `${sign}${Math.round(netMapBonus)}%`, color: color });
            }

            // speed modifier
            const sm = hs.speedModifier || 1.0;
            if (sm < 1.0) {
              const speedLabel = sm === 0.25 ? '1/4 speed' : sm === 0.50 ? '1/2 speed' : `${Math.round(sm * 100)}% speed`;
              const saveChance = sm === 0.25 ? 90 : sm === 0.50 ? 75 : 0;
              lines.push({ label: speedLabel, value: saveChance > 0 ? `${saveChance}% save` : '', color: '#aaf' });
            }

            // Add Dogfight Hit%
            lines.push({ label: 'Dogfight Hit%', value: `${Math.round(Math.max(1, 10 + totalAttackMod))}%`, color: '#fff' });

            // Attrition info
            const techSafe = Math.sqrt(hsOwner.techScore || 0);
            const expSafe = Math.sqrt(hsOwner.expScore || 0);
            const safeTime = techSafe + expSafe;

            if (avgFlightTime > 0) {
              lines.push({ label: 'Flight Time', value: `${Math.round(avgFlightTime)}s`, color: '#aaa' });
            }
            if (safeTime > 0) {
              lines.push({ label: 'safe Time', value: `${Math.round(safeTime)}s`, color: avgFlightTime >= safeTime ? '#f66' : '#4f4' });
            }

            if (avgFlightTime >= safeTime) {
              const timeExposed = avgFlightTime - safeTime;
              let attritionRate = 1 + Math.floor(timeExposed / 4);
              let attritionLabel = `${attritionRate}%/s`;

              // Check if inside friendly gravity well
              let inFriendlyWell = false;
              if (serverState.planets) {
                for (const planet of serverState.planets) {
                  if (planet.ownerId !== hs.ownerId) continue;
                  const pOwner = serverState.players.find(pl => pl.id === planet.ownerId);
                  if (!pOwner) continue;
                  const tb = 0.01 * Math.sqrt(pOwner.techScore || 0);
                  const eb = 0.01 * Math.sqrt(pOwner.expScore || 0);
                  let baseRadius = planet.maxShips * 1.5;
                  if (planet.isMilitary && planet.ships >= planet.maxShips) {
                    baseRadius *= 1.5;
                  }
                  const isPlanetHuman = pOwner && !pOwner.isAI;
                  if (isPlanetHuman && planet.focusMode === 'garrison' && planet.ships >= planet.maxShips) {
                    baseRadius += (planet.ships / 2);
                  }
                  const gr = baseRadius * (1 + tb + eb);
                  const pdx = hs.x - planet.x, pdy = hs.y - planet.y;
                  if (pdx * pdx + pdy * pdy < gr * gr) {
                    inFriendlyWell = true;
                    break;
                  }
                }
              }
              if (inFriendlyWell) attritionLabel += ' (Ã·3 friendly well)';
              if (hs.isBomber) attritionLabel += ' (Ã·2 bomber)';

              lines.push({ label: 'Attrition', value: attritionLabel, color: '#f66' });
            } else {
              lines.push({ label: 'Attrition', value: 'safe', color: '#4f4' });
            }

          }
          if (serverState.storms) {
            for (const storm of serverState.storms) {
              const dx = hs.x - storm.x, dy = hs.y - storm.y;
              if (dx * dx + dy * dy <= storm.radius * storm.radius) {
                const typeLabel = storm.type === 'minefield' ? 'Minefield' : storm.type === 'nebula' ? 'Nebula' : 'Ion Storm';
                const typeColor = storm.type === 'minefield' ? '#66f' : storm.type === 'nebula' ? '#f66' : '#ff0';
                lines.push({ label: `⚠️ ${typeLabel}`, value: `Int: ${storm.intensity}`, color: typeColor });
              }
            }
          }

          for (const line of lines) {
            if (line.label != null) line.label = formatTooltipString(line.label);
            if (line.value != null) line.value = formatTooltipString(line.value);
          }

          // Render tooltip (same layout as planet tooltip)
          ctx.save();
          const tooltipFont = '11px Orbitron';
          const headerFont = 'bold 12px Orbitron';
          ctx.font = tooltipFont;

          const padding = 10;
          const lineHeight = 18;
          const headerHeight = 22;
          let maxWidth = 0;
          for (const line of lines) {
            ctx.font = line.isHeader ? headerFont : tooltipFont;
            let w;
            if (line.isSpeedBar) {
              const speedText = `${(line.currentSpeed || 0).toFixed(1)} / ${(line.maxSpeed || 0).toFixed(1)}`;
              w = ctx.measureText(line.label + '   ' + speedText).width + 80 + 10;
            } else {
              w = ctx.measureText(line.label + '  ' + (line.value || '')).width;
            }
            if (w > maxWidth) maxWidth = w;
          }

          const tooltipW = maxWidth + padding * 2 + 10;
          const tooltipH = lines.reduce((h, l) => h + (l.isHeader ? headerHeight : lineHeight), 0) + padding * 2;

          const vis = visualShips.get(hs.id);
          const hsX = vis ? vis.x : hs.x;
          const hsY = vis ? vis.y : hs.y;

          let tooltipX = hsX + 20;
          let tooltipY = hsY - tooltipH / 2;

          const mapWidth = serverState.width || 1920;
          const mapHeight = serverState.height || 1620;
          if (tooltipX + tooltipW > mapWidth) tooltipX = hsX - 20 - tooltipW;
          if (tooltipY < 0) tooltipY = 5;
          if (tooltipY + tooltipH > mapHeight) tooltipY = mapHeight - tooltipH - 5;

          ctx.fillStyle = 'rgba(5, 5, 15, 0.92)';
          const strokeRgba = hs.isAmoeba ? '0, 255, 0' : (hsOwner ? (hsOwner.color === '#f00' || hsOwner.color === 'red' ? '255, 100, 100' : '0, 255, 255') : '0, 255, 0');
          ctx.strokeStyle = `rgba(${strokeRgba}, 0.4)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 6);
          ctx.fill();
          ctx.stroke();

          let curY = tooltipY + padding;
          for (const line of lines) {
            const lh = line.isHeader ? headerHeight : lineHeight;
            ctx.font = line.isHeader ? headerFont : tooltipFont;
            ctx.fillStyle = line.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            if (line.isSpeedBar) {
              ctx.fillText(line.label, tooltipX + padding, curY);
              const speedText = `${(line.currentSpeed || 0).toFixed(1)} / ${(line.maxSpeed || 0).toFixed(1)}`;
              const barWidth = 80;
              const barHeight = 8;
              const barX = tooltipX + tooltipW - padding - barWidth;
              const barY = curY + (lh - barHeight) / 2;

              // Draw bar background
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.fillRect(barX, barY, barWidth, barHeight);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.lineWidth = 1;
              ctx.strokeRect(barX, barY, barWidth, barHeight);

              // Draw fill
              const maxS = Math.max(1, line.maxSpeed);
              const fillPct = Math.min(1.0, Math.max(0, line.currentSpeed / maxS));
              const fillWidth = barWidth * fillPct;
              ctx.fillStyle = '#00ffcc';
              ctx.fillRect(barX, barY, fillWidth, barHeight);

              // Text
              ctx.fillStyle = '#ccc';
              ctx.textAlign = 'right';
              ctx.fillText(speedText, barX - 6, curY);
            } else {
              ctx.fillText(line.label, tooltipX + padding, curY);
              if (line.value) {
                ctx.textAlign = 'right';
                ctx.fillText(line.value, tooltipX + tooltipW - padding, curY);
              }
            }
            curY += lh;
          }

          ctx.restore();
        }
      }
    }

      function pseudoRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      }

      function getFormationOffset(formationType, i, renderCount, maxSpread, isInterceptor = false, isBomber = false) {
        let lx = 0;
        let ly = 0;
        const spacing = isBomber ? 10 : (isInterceptor ? 7 : 4);
        switch (formationType) {
          case 'arrow': {
            let row = 0;
            let sum = 0;
            while (sum + row + 5 <= i) {
              sum += row + 5;
              row++;
            }
            const col = i - sum;
            const rowWidth = row + 5;
            const actualRowWidth = Math.min(rowWidth, renderCount - sum);
            const halfCol = (actualRowWidth - 1) / 2;
            lx = -row * spacing;
            ly = (col - halfCol) * spacing;
            break;
          }
          case 'hex': {
            if (i > 0) {
              let ring = 1;
              let index = i - 1;
              while (index >= ring * 6) {
                index -= ring * 6;
                ring++;
              }
              const angle = (index / (ring * 6)) * Math.PI * 2;
              const radius = ring * 5;
              lx = radius * Math.cos(angle);
              ly = radius * Math.sin(angle);
            }
            break;
          }
          case 'circle': {
            if (i > 0) {
              let ring = 1;
              let index = i - 1;
              while (index >= ring * 8) {
                index -= ring * 8;
                ring++;
              }
              const angle = (index / (ring * 8)) * Math.PI * 2;
              const radius = ring * 6;
              lx = radius * Math.cos(angle);
              ly = radius * Math.sin(angle);
            }
            break;
          }
          case 'bullet': {
            const spacing = 4;
            const width = 3;
            const col = i % width;
            const row = Math.floor(i / width);
            const halfCol = (width - 1) / 2;
            lx = -row * spacing;
            ly = (col - halfCol) * spacing;
            break;
          }
          default: {
            const seed = i * 73 + 31;
            const angleOffset = pseudoRandom(seed) * Math.PI * 2;
            const radiusOffset = Math.sqrt(pseudoRandom(seed + 1)) * maxSpread;
            lx = Math.cos(angleOffset) * radiusOffset;
            ly = Math.sin(angleOffset) * radiusOffset;
            break;
          }
        }
        return { lx, ly };
      }

      for (const s of serverState.ships) {
        if (!s.active) continue;

        if (s.rawServerX === undefined) s.rawServerX = s.x;
        if (s.rawServerY === undefined) s.rawServerY = s.y;
        if (s.rawServerAngle === undefined) s.rawServerAngle = s.angle;

        let vis = visualShips.get(s.id);
        if (!vis) {
          vis = { x: s.rawServerX, y: s.rawServerY, angle: s.rawServerAngle };
          visualShips.set(s.id, vis);
        } else {
          // smooth lerp
          const lerpFactor = 0.25; // Adjust for smoothness/latency balance
          vis.x += (s.rawServerX - vis.x) * lerpFactor;
          vis.y += (s.rawServerY - vis.y) * lerpFactor;
          
          let diff = s.rawServerAngle - vis.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          vis.angle += diff * lerpFactor;
        }

        // Apply visual coordinates to the ship object so that all drawing, selection, and laser logic
        // automatically use the smoothly interpolated coordinates!
        s.x = vis.x;
        s.y = vis.y;
        s.angle = vis.angle;

        // Frustum culling: skip drawing if ship is way off-screen
        const isSelected = selectedShips.some(ss => ss.id === s.id);
        const buffer = 150; // generous buffer to account for spread and range circles
        const isOffscreen = s.x < viewMinX - buffer || s.x > viewMaxX + buffer || s.y < viewMinY - buffer || s.y > viewMaxY + buffer;
        if (isOffscreen && !isSelected) {
          continue;
        }

        const owner = serverState.players.find(pl => pl.id === s.ownerId);

        if (s.isBoardingFleet) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fillStyle = owner ? owner.color : '#ff0';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.shadowBlur = 10;
          ctx.shadowColor = owner ? owner.color : '#ff0';
          ctx.fill();
          ctx.stroke();
          
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪖', 0, -6);
          ctx.restore();
          continue;
        }

        if (s.isReturnPod) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fillStyle = owner ? owner.color : '#0ff';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.shadowBlur = 10;
          ctx.shadowColor = owner ? owner.color : '#0ff';
          ctx.fill();
          ctx.stroke();
          
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🤝', 0, -6);
          ctx.restore();
          continue;
        }

        const maxSpread = Math.min(60, 10 + Math.sqrt(s.count || 1) * 2.5);

        if (s.count > 1 || s.isCruiser || s.isAmoeba) {
          let laserTechBonus = 0;
          let expBonus = 0;
          if (owner) {
            const techBonus = Math.floor(Math.sqrt(owner.techScore || 0));
            laserTechBonus = 0.01 * techBonus;
            expBonus = Math.sqrt(owner.expScore || 0);
          }

          let range = 40 * (1 + laserTechBonus);
          if (s.isAmoeba) {
            const displayedMaxHealth = s.maxHealth + (s.maxHealth * (s.maxHealth - 1)) / 2;
            range = 20 + displayedMaxHealth;
            if (s.bombs > 0) {
              range += 10;
            }
            range = Math.floor(range);
          } else if (s.maxHealth > 0) {
            const shipExpBonus = Math.sqrt(s.expScore || 0) + (s.commandPoints || 0);
            const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
            const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
            range = baseDogfightRange * 1.10;
            if (s.bombs > 0) {
              range += baseDogfightRange * 0.10;
            }
            
            // Apply targeting range bonus consistent with Ship.js
            const targetingRangeBonus = (s.targeting || 0) * 0.05;
            range *= (1 + targetingRangeBonus);
            if (s.fuel_tanker && s.fuel_tanker > 0) {
              range = Math.max(5, range - s.fuel_tanker * 5);
            }
            if (s.specialbombs && s.specialbombs > 0) {
              range += 10;
            }
            if (s.package === 'brute') {
              range *= 0.5;
            } else if (s.package === 'sniper') {
              range *= 1.5;
            }
            range = Math.floor(range);
          } else {
            const healthBonus = Math.floor(s.health || 0);
            range = 40 * (1 + laserTechBonus) * (1 + healthBonus * 0.10);
          }

          ctx.save();
          ctx.strokeStyle = 'rgba(255, 60, 60, 0.22)'; // Subtle red
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]); // Light dotted
          
          if (s.isCruiser && !s.isAmoeba) {
            // Draw custom directional firing range envelope for cruisers
            const shipExpBonus = Math.sqrt(s.expScore || 0) + (s.commandPoints || 0);
            const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
            const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);

            let rangeWithoutMunitions = range;
            if (s.bombs > 0) {
              let targetingRangeBonus = 0;
              if (s.targeting > 0) {
                targetingRangeBonus += 0.05;
                if (s.targeting > 1) {
                  targetingRangeBonus += 0.025;
                }
                if (s.targeting > 2) {
                  targetingRangeBonus += 0.025;
                }
              }
              const munitionsBonus = baseDogfightRange * 0.10 * (1 + targetingRangeBonus);
              rangeWithoutMunitions = Math.max(0, range - munitionsBonus);
            }
            const rangeAft = rangeWithoutMunitions * 0.85;
            const rangeFront = range * 1.3;
            let bombRangeBoost = 0;
            let packageMult = 1.0;
            if (s.package === 'brute') {
              packageMult = 0.5;
            } else if (s.package === 'sniper') {
              packageMult = 1.5;
            }
            if (s.bombs > 0) {
              bombRangeBoost = baseDogfightRange * 0.10 * (1 + (s.targeting || 0) * 0.05) * packageMult;
            }
            let specialBombRangeBoost = 0;
            if (s.specialbombs && s.specialbombs > 0) {
              specialBombRangeBoost = 10 * packageMult;
            }
            const rangeSide = Math.floor(range - 0.5 * bombRangeBoost - 0.5 * specialBombRangeBoost);
            
            // 1. Draw outer envelope perimeter
            ctx.beginPath();
            const steps = 180;
            for (let i = 0; i <= steps; i++) {
              const theta = (i * 2 * Math.PI) / steps;
              let diff = theta - (s.angle || 0);
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              
              const absDiff = Math.abs(diff);
              let r = rangeSide;
              if (absDiff <= Math.PI / 4) {
                r = rangeFront;
              } else if (absDiff >= 3 * Math.PI / 4) {
                r = rangeAft;
              }
              
              const px = s.x + Math.cos(theta) * r;
              const py = s.y + Math.sin(theta) * r;
              
              if (i === 0) {
                ctx.moveTo(px, py);
              } else {
                ctx.lineTo(px, py);
              }
            }
            ctx.closePath();
            ctx.stroke();
            
            // 2. Draw partition lines at arc boundaries (+/- 45° and +/- 135°)
            ctx.beginPath();
            const sectorAngles = [
              (s.angle || 0) - Math.PI / 4,
              (s.angle || 0) + Math.PI / 4,
              (s.angle || 0) - 3 * Math.PI / 4,
              (s.angle || 0) + 3 * Math.PI / 4
            ];
            for (const sa of sectorAngles) {
              let diff = sa - (s.angle || 0);
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              
              const absDiff = Math.abs(diff);
              let r = rangeSide;
              if (absDiff <= Math.PI / 4) {
                r = rangeFront;
              } else if (absDiff >= 3 * Math.PI / 4) {
                r = rangeAft;
              }
              
              ctx.moveTo(s.x, s.y);
              ctx.lineTo(s.x + Math.cos(sa) * r, s.y + Math.sin(sa) * r);
            }
            ctx.stroke();
          } else {
            // Draw standard circular range circle for non-cruisers
            ctx.beginPath();
            ctx.arc(s.x, s.y, range, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw scout destination markers if scouting
        if (s.flightTime > 0.5 && s.isScouting && s.scoutTargetX !== null && s.scoutTargetX !== undefined && s.scoutTargetY !== null && s.scoutTargetY !== undefined && owner && localPlayer && owner.id === localPlayer.id) {
          ctx.save();
          // Dotted line from scout to target
          ctx.strokeStyle = isSelected ? 'rgba(0, 255, 200, 0.65)' : 'rgba(0, 255, 200, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.scoutTargetX, s.scoutTargetY);
          ctx.stroke();

          // Target reticle at destination
          ctx.translate(s.scoutTargetX, s.scoutTargetY);
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
          
          const isUnexplored = s.scoutTargetUnexplored || false;
          
          // Glowing shadow
          ctx.shadowBlur = 8;
          ctx.shadowColor = isUnexplored ? '#ffff00' : '#00ffc8';
          
          // Outer circle
          ctx.strokeStyle = isUnexplored 
            ? (isSelected ? 'rgba(255, 255, 0, 0.95)' : 'rgba(255, 255, 0, 0.55)')
            : (isSelected ? 'rgba(0, 255, 200, 0.85)' : 'rgba(0, 255, 200, 0.45)');
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.stroke();

          // Inner filled dot
          ctx.fillStyle = isUnexplored 
            ? (isSelected ? 'rgba(255, 255, 0, 1.0)' : 'rgba(255, 255, 0, 0.8)')
            : (isSelected ? 'rgba(0, 255, 200, 0.95)' : 'rgba(0, 255, 200, 0.55)');
          ctx.beginPath();
          ctx.arc(0, 0, isUnexplored ? 4 : 2, 0, Math.PI * 2);
          ctx.fill();

          // Crosshair lines
          ctx.beginPath();
          ctx.moveTo(-10, 0); ctx.lineTo(-4, 0);
          ctx.moveTo(4, 0); ctx.lineTo(10, 0);
          ctx.moveTo(0, -10); ctx.lineTo(0, -4);
          ctx.moveTo(0, 4); ctx.lineTo(0, 10);
          ctx.stroke();

          // Text label
          if (isSelected) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = isUnexplored ? 'rgba(255, 255, 0, 0.95)' : 'rgba(0, 255, 200, 0.95)';
            ctx.font = 'bold 8px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(isUnexplored ? 'UNEXPLORED SCOUT TARGET' : 'SCOUT DESTINATION', 0, -13);
          }

          ctx.restore();
        }

        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (s.isCruiser) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0ff';
            ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.beginPath();

            // Draw thin path line representing currently scheduled movement and all queued orders
            if (s.flightTime > 0.5) {
              ctx.save();
              ctx.strokeStyle = 'rgba(0, 255, 200, 0.65)';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([3, 4]);
              ctx.beginPath();
              ctx.moveTo(s.x, s.y);

              let lastX = s.x;
              let lastY = s.y;
              let hasPath = false;

              if (s.targetX !== null && s.targetX !== undefined && s.targetY !== null && s.targetY !== undefined) {
                ctx.lineTo(s.targetX, s.targetY);
                lastX = s.targetX;
                lastY = s.targetY;
                hasPath = true;
              }

              if (s.orderQueue && s.orderQueue.length > 0) {
                for (const o of s.orderQueue) {
                  if (o.type === 'moveSpace') {
                    ctx.lineTo(o.targetX, o.targetY);
                    lastX = o.targetX;
                    lastY = o.targetY;
                    hasPath = true;
                  } else if (o.type === 'movePlanet') {
                    const targetPlanet = serverState.planets.find(p => p.id === o.targetId);
                    if (targetPlanet) {
                      const tX = targetPlanet.x + (o.offsetX || 0);
                      const tY = targetPlanet.y + (o.offsetY || 0);
                      ctx.lineTo(tX, tY);
                      lastX = tX;
                      lastY = tY;
                      hasPath = true;
                    }
                  }
                }
              }

              if (hasPath) {
                ctx.stroke();
              }
              ctx.restore();
            }
            
            // Draw cyan sensor range circle (outline only, no fill!)
            let baseCruiserRadar = 25 + s.maxHealth * 2;
            let sensorRange = baseCruiserRadar + 10 * (s.sensorarrays || 0);
            sensorRange *= (1 + 0.25 * (s.sensorarrays || 0));
            if (s.isWarp) sensorRange *= 0.25;
            if (owner) {
              const techScore = owner.techScore || 0;
              const expScore = owner.expScore || 0;
              const playerTechBonus = 0.01 * Math.floor(Math.sqrt(techScore));
              const playerExpBonus = 0.01 * Math.sqrt(expScore);
              const shipXpBonus = Math.sqrt(s.expScore || 0) + (s.commandPoints || 0);
              sensorRange *= (1 + playerTechBonus + playerExpBonus);
              sensorRange *= (1 + 0.03 * shipXpBonus);
            }
            const pct = hazardSensorReductionPct(s.x, s.y, s.ownerId);
            sensorRange = Math.max(10, sensorRange * pct);
            
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.45)'; // Sleek cyan
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]); // Dashed/dotted
            ctx.beginPath();
            ctx.arc(s.x, s.y, sensorRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Draw cyan target lock dotted line to its target
            if (s.cruiserTargetType && s.cruiserTargetId !== null) {
              let tx = null;
              let ty = null;
              if (s.cruiserTargetType === 'planet') {
                const targetP = serverState.planets.find(p => p.id === s.cruiserTargetId);
                if (targetP) {
                  tx = (s.cruiserTargetClickX !== undefined && s.cruiserTargetClickX !== null) ? s.cruiserTargetClickX : targetP.x;
                  ty = (s.cruiserTargetClickY !== undefined && s.cruiserTargetClickY !== null) ? s.cruiserTargetClickY : targetP.y;
                }
              } else if (s.cruiserTargetType === 'ship') {
                const targetS = serverState.ships.find(ship => ship.id === s.cruiserTargetId);
                if (targetS && targetS.active) {
                  tx = targetS.x;
                  ty = targetS.y;
                }
              }
              
              if (tx !== null && ty !== null) {
                ctx.save();
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.55)'; // Glowing cyan
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]); // Dotted targeting reticle line
                
                // Draw target line
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                
                if (s.cruiserTargetType === 'planet') {
                  // Draw target reticle bracket box at target coordinates
                  ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([]);
                  ctx.beginPath();
                  // small bracket box [ ] size 16 around target
                  ctx.strokeRect(tx - 8, ty - 8, 16, 16);
                }
                
                ctx.restore();
              }
            }

            // Draw dotted lines for the orders in the queue
            if (s.flightTime > 0.5 && s.orderQueue && s.orderQueue.length > 0) {
              ctx.save();
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.40)'; // Cyan dotted line
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 4]);
              
              let lastX = s.x;
              let lastY = s.y;
              
              if (s.cruiserTargetType && s.cruiserTargetId !== null) {
                if (s.cruiserTargetType === 'planet') {
                  const targetP = serverState.planets.find(p => p.id === s.cruiserTargetId);
                  if (targetP) {
                    lastX = (s.cruiserTargetClickX !== undefined && s.cruiserTargetClickX !== null) ? s.cruiserTargetClickX : targetP.x;
                    lastY = (s.cruiserTargetClickY !== undefined && s.cruiserTargetClickY !== null) ? s.cruiserTargetClickY : targetP.y;
                  }
                } else if (s.cruiserTargetType === 'ship') {
                  const targetS = serverState.ships.find(ship => ship.id === s.cruiserTargetId);
                  if (targetS && targetS.active) {
                    lastX = targetS.x;
                    lastY = targetS.y;
                  }
                }
              } else if (s.targetX !== null && s.targetY !== null) {
                lastX = s.targetX;
                lastY = s.targetY;
              }
              
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              
              for (const order of s.orderQueue) {
                let tx = null;
                let ty = null;
                
                if (order.type === 'moveSpace') {
                  tx = order.targetX;
                  ty = order.targetY;
                } else if (order.type === 'movePlanet') {
                  const planet = serverState.planets.find(p => p.id === order.targetId);
                  if (planet) {
                    tx = planet.x + (order.offsetX || 0);
                    ty = planet.y + (order.offsetY || 0);
                  }
                } else if (order.type === 'target') {
                  if (order.targetType === 'planet') {
                    const planet = serverState.planets.find(p => p.id === order.targetId);
                    if (planet) {
                      tx = (order.clickX !== null && order.clickX !== undefined) ? order.clickX : planet.x;
                      ty = (order.clickY !== null && order.clickY !== undefined) ? order.clickY : planet.y;
                    }
                  } else if (order.targetType === 'ship') {
                    const targetShip = serverState.ships.find(ship => ship.id === order.targetId);
                    if (targetShip && targetShip.active) {
                      tx = targetShip.x;
                      ty = targetShip.y;
                    }
                  }
                }
                
                if (tx !== null && ty !== null) {
                  ctx.lineTo(tx, ty);
                  
                  // Draw a tiny waypoint marker
                  ctx.save();
                  ctx.fillStyle = 'rgba(0, 255, 255, 0.65)';
                  ctx.beginPath();
                  ctx.arc(tx, ty, 3, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();
                  
                  lastX = tx;
                  lastY = ty;
                }
              }
              ctx.stroke();
              ctx.restore();
            }

            ctx.beginPath();
          } else if (s.count > 1) {
            ctx.arc(s.x, s.y, maxSpread + 4, 0, Math.PI * 2);
          } else if (s.isBomber) {
            ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
          } else if (s.isInterceptor) {
            ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
          } else {
            ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
          }
          ctx.stroke();
        }

        const isShipHovered = (hoveredShip && hoveredShip.id === s.id) ||
                              (isHoveringSelectionTile && activeInfoPanel && (activeInfoPanel.type === 'ship' || activeInfoPanel.type === 'fleet') && activeInfoPanel.id === s.id);
        if (isShipHovered) {
          ctx.save();
          ctx.beginPath();
          let hoverRadius = 15;
          if (s.isCruiser) {
            hoverRadius = 24;
          } else if (s.count > 1) {
            hoverRadius = maxSpread + 8;
          } else if (s.isBomber) {
            hoverRadius = 10;
          } else if (s.isInterceptor) {
            hoverRadius = 8;
          } else {
            hoverRadius = 6;
          }
          ctx.arc(s.x, s.y, hoverRadius, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffeb3b'; // Golden yellow
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ffeb3b';
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -Date.now() / 150;
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = owner ? owner.color : '#fff';
        
        if (s.count > 1 && !s.isCruiser && !s.isAmoeba) {
          let maxRender = 40;
          if (cameraZoom < 0.4) {
            maxRender = 10;
          } else if (cameraZoom < 0.8) {
            maxRender = 25;
          }
          const renderCount = Math.min(maxRender, s.count);
          for (let i = 0; i < renderCount; i++) {
            const { lx, ly } = getFormationOffset(s.formation, i, renderCount, maxSpread, s.isInterceptor, s.isBomber);
            const cos = Math.cos(s.angle || 0);
            const sin = Math.sin(s.angle || 0);
            const drawX = s.x + lx * cos - ly * sin;
            const drawY = s.y + lx * sin + ly * cos;
            
            if (s.isBomber) {
              let angle = 0;
              if (s.targetX !== undefined && s.targetY !== undefined) {
                angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
              }
              const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
              const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
              if (sheet) {
                ctx.drawImage(sheet, angleDeg * 16, 16, 16, 16, drawX - 8, drawY - 8, 16, 16);
              } else {
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(angle + Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(0, -4);
                ctx.lineTo(4, 4);
                ctx.lineTo(-4, 4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
            } else if (s.isInterceptor) {
              let angle = 0;
              if (s.targetX !== undefined && s.targetY !== undefined) {
                angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
              }
              const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
              const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
              if (sheet) {
                ctx.drawImage(sheet, angleDeg * 16, 32, 16, 16, drawX - 8, drawY - 8, 16, 16);
              } else {
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(angle + Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(3, 3);
                ctx.lineTo(-3, 3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
            } else {
              const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
              if (sheet) {
                ctx.drawImage(sheet, 0, 0, 16, 16, drawX - 8, drawY - 8, 16, 16);
              } else {
                ctx.beginPath();
                ctx.arc(drawX, drawY, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          if (s.count > renderCount) {
            ctx.save();
            ctx.font = 'bold 9px "Outfit", "Inter", sans-serif';
            ctx.fillStyle = owner ? owner.color : '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(`+${Math.round(s.count - renderCount)}`, s.x, s.y - maxSpread - 6);
            ctx.fillText(`+${Math.round(s.count - renderCount)}`, s.x, s.y - maxSpread - 6);
            ctx.restore();
          }

          continue;
        }

        ctx.beginPath();
        if (s.isBomber) {
          let angle = 0;
          if (s.targetX !== undefined && s.targetY !== undefined) {
            angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
          }
          const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
          const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
          if (sheet) {
            ctx.drawImage(sheet, angleDeg * 16, 16, 16, 16, s.x - 8, s.y - 8, 16, 16);
            continue;
          } else {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(angle + Math.PI / 2);
            ctx.moveTo(0, -5);
            ctx.lineTo(5, 5);
            ctx.lineTo(-5, 5);
            ctx.restore();
            ctx.closePath();
          }
        } else if (s.isInterceptor) {
          let angle = 0;
          if (s.targetX !== undefined && s.targetY !== undefined) {
            angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
          }
          const angleDeg = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
          const sheet = spriteSheets[s.ownerId] || spriteSheets['neutral'];
          if (sheet) {
            ctx.drawImage(sheet, angleDeg * 16, 32, 16, 16, s.x - 8, s.y - 8, 16, 16);
            continue;
          } else {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(angle + Math.PI / 2);
            ctx.moveTo(0, -3);
            ctx.lineTo(3, 3);
            ctx.lineTo(-3, 3);
            ctx.restore();
            ctx.closePath();
          }
        } else if (s.isAmoeba) {
          const size = (6 + (s.maxHealth || 0) * 1.5);
          const time = Date.now() / 500 + s.id;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = size + Math.sin(time + i) * (size * 0.2);
            const px = s.x + AMOEBA_COS[i] * r;
            const py = s.y + AMOEBA_SIN[i] * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          const oldFill = ctx.fillStyle;
          const oldStroke = ctx.strokeStyle;
          const oldLineWidth = ctx.lineWidth;
          ctx.fillStyle = "rgba(0, 100, 0, 0.7)";
          ctx.strokeStyle = "#0f0";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = oldFill;
          ctx.strokeStyle = oldStroke;
          ctx.lineWidth = oldLineWidth;
          ctx.beginPath();
        } else if (s.isCruiser) {
          ctx.save();
          if (s.isMaterializing && s.materializeProgress !== undefined) {
            ctx.globalAlpha = s.materializeProgress;
          } else if (s.isDismantling && s.dismantleTimer !== undefined && s.dismantleDuration) {
            ctx.globalAlpha = Math.max(0, Math.min(1.0, s.dismantleTimer / s.dismantleDuration));
          }
          let angle = s.angle || 0;
          let ownerPlayer = serverState.players.find(p => p.id === s.ownerId);
          let style = s.cruiserStyle || (ownerPlayer ? ownerPlayer.cruiserStyle : 'Klingon');
          let size = ((6 + (s.maxHealth || 0) * 1.0) / 3.0);
          if (style === 'Romulan' && s.classType === 'corvette') {
            size *= 1.35;
          }

          let cohort = 'scout_group';
          if (s.classType === 'destroyer') {
            cohort = 'destroyer_group';
          } else if (s.classType === 'cruiser' || s.classType === 'battlecruiser') {
            cohort = 'cruiser_group';
          } else if (s.classType === 'battleship' || s.classType === 'titan') {
            cohort = 'battleship_group';
          } else if (s.classType === 'mammoth') {
            cohort = 'mammoth_group';
          }

          let drawnShipImage = false;
          if (graphicalMode && transparentShipsCanvas && !(style === 'Romulan' && s.classType === 'corvette')) {
            let normalizedStyle = style;
            if (normalizedStyle) {
              normalizedStyle = normalizedStyle.charAt(0).toUpperCase() + normalizedStyle.slice(1).toLowerCase();
            }
            if (!FACTION_MAPPING[normalizedStyle]) {
              normalizedStyle = 'Klingon';
            }
            const faction = FACTION_MAPPING[normalizedStyle];
            const classRow = CLASS_MAPPING[s.classType || 'corvette'];
            if (faction && classRow) {
              let scale = (6 + (s.maxHealth || 0)) / 240;
              if (s.classType === 'corvette') {
                scale *= 1.6;
              } else if (s.classType === 'frigate') {
                scale *= 1.4;
              }
              const drawnW = faction.w * scale;
              const drawnH = classRow.h * scale;
              
              ctx.save();
              ctx.translate(s.x, s.y);
              ctx.rotate(angle + Math.PI / 2);
              
              ctx.drawImage(
                transparentShipsCanvas,
                faction.x, classRow.y, faction.w, classRow.h,
                -drawnW / 2, -drawnH / 2, drawnW, drawnH
              );
              ctx.restore();
              drawnShipImage = true;
            }
          }

          if (!drawnShipImage) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(angle + Math.PI / 2);
            ctx.beginPath();

            drawRacialShipHull(ctx, style, cohort, size);
            
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          }

          // Draw special resources indicators (bombs: red, fuel: yellow, duranium: gray)
          if (s.specialbombs > 0 || s.specialfuel > 0 || s.specialduranium > 0) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(angle + Math.PI / 2);

            const dotRadius = Math.max(1.2, size * 0.08);

            const drawDotCluster = (cx, cy, count, fill, stroke, lw) => {
              if (count <= 0) return;
              ctx.fillStyle = fill;
              ctx.strokeStyle = stroke;
              ctx.lineWidth = lw;
              if (count === 1) {
                ctx.beginPath();
                ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              } else {
                const R = dotRadius * 1.5;
                for (let i = 0; i < count; i++) {
                  const theta = (i * 2 * Math.PI) / count;
                  const dx = cx + R * Math.cos(theta);
                  const dy = cy + R * Math.sin(theta);
                  ctx.beginPath();
                  ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                }
              }
            };

            // 1. Special Bombs -> Tiny red dots at laser originating points
            if (s.specialbombs > 0) {
              const leftCount = Math.floor(s.specialbombs / 2);
              const rightCount = Math.ceil(s.specialbombs / 2);
              drawDotCluster(-size * 0.75, size * 0.15, leftCount, '#ff0000', '#000000', dotRadius * 0.3);
              drawDotCluster(size * 0.75, size * 0.15, rightCount, '#ff0000', '#000000', dotRadius * 0.3);
            }

            // 2. Special Fuel -> Tiny yellow dots on engine(s)
            if (s.specialfuel > 0) {
              let engines = [];
              if (style === 'Federation') {
                engines = [
                  { x: size * 0.8, y: size * 0.8 },
                  { x: -size * 0.8, y: size * 0.8 }
                ];
              } else if (style === 'Romulan') {
                engines = [
                  { x: size * 0.5, y: size * 0.25 },
                  { x: -size * 0.5, y: size * 0.25 }
                ];
              } else if (style === 'Gorn') {
                engines = [{ x: 0, y: size * 0.8 }];
              } else if (style === 'Tholian') {
                engines = [{ x: 0, y: size * 0.6 }];
              } else if (style === 'Lyran') {
                engines = [{ x: 0, y: size * 0.9 }];
              } else { // Klingon or default
                engines = [{ x: 0, y: size * 0.6 }];
              }

              const numEngines = engines.length;
              for (let j = 0; j < numEngines; j++) {
                const engine = engines[j];
                const engineCount = Math.floor(s.specialfuel / numEngines) + (j < (s.specialfuel % numEngines) ? 1 : 0);
                drawDotCluster(engine.x, engine.y, engineCount, '#ffff00', '#000000', dotRadius * 0.3);
              }
            }

            // 3. Special Duranium -> Tiny gray dot in the middle of hull
            if (s.specialduranium > 0) {
              drawDotCluster(0, 0, s.specialduranium, '#aaaaaa', '#000000', dotRadius * 0.3);
            }

            ctx.restore();
          }

          // Draw Cruiser Shields as a yellow circle around the ship if within 30s of firing/being fired upon
          if (s.isCruiser && (s.shields || 0) > 0 && (s.shieldShowTimer || 0) > 0 && (s.shieldPoints || 0) > 0) {
            const maxShields = 3 * s.shields;
            const shieldPct = s.shieldPoints / maxShields;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(s.x, s.y, size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffff00'; // Yellow
            
            if (shieldPct > 0.66) {
              ctx.lineWidth = 2.5; // Normal width
            } else if (shieldPct > 0.33) {
              ctx.lineWidth = 1.25; // Narrow line
            } else {
              ctx.lineWidth = 0.5; // Very thin line
            }
            
            ctx.stroke();
            ctx.restore();
          }
          
          // Draw research warmup indicator around the ship
          if (s.isActivelyResearching && s.accumulatedTech !== undefined) {
            ctx.save();
            ctx.beginPath();
            const progress = Math.max(0.0, Math.min(1.0, s.accumulatedTech));
            ctx.arc(s.x, s.y, size + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            ctx.strokeStyle = 'rgba(0, 76, 255, 0.95)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }

          // Draw mini-icons representing active upgrades below the ship when zoomed in (cameraZoom >= 1.0)
          const activeUpgrades = [];
          if ((s.sensorarrays || 0) > 0) activeUpgrades.push({ symbol: '📡', count: s.sensorarrays });
          if ((s.labs || 0) > 0) activeUpgrades.push({ symbol: '🔬', count: s.labs });
          if ((s.shields || 0) > 0) activeUpgrades.push({ symbol: '🌀', count: s.shields });
          if ((s.armor || 0) > 0) activeUpgrades.push({ symbol: '🛡️', count: s.armor });
          if ((s.engine || 0) > 0) activeUpgrades.push({ symbol: '🚀', count: s.engine });
          if ((s.munitions || 0) > 0) activeUpgrades.push({ symbol: '💣', count: s.munitions });
          if ((s.targeting || 0) > 0) activeUpgrades.push({ symbol: '🎯', count: s.targeting });
          if ((s.damagecontrol || 0) > 0) activeUpgrades.push({ symbol: '🔧', count: s.damagecontrol });
          if ((s.fuel_tanker || 0) > 0) activeUpgrades.push({ symbol: '⛽', count: s.fuel_tanker });
          if ((s.diplomat || 0) > 0) activeUpgrades.push({ symbol: '🤝', count: s.diplomat });
          if ((s.marines || 0) > 0) activeUpgrades.push({ symbol: '🪖', count: s.marines });
          if ((s.command || 0) > 0) activeUpgrades.push({ symbol: '👑', count: s.command });

          let upgradesHeight = 0;
          if (cameraZoom >= 1.0 && activeUpgrades.length > 0) {
            const iconSize = 4;
            const spacingX = 5;
            const yOffset = size + 4;
            upgradesHeight = 6; // offset the name by 6px if upgrades are drawn
            
            ctx.save();
            ctx.font = `${iconSize}px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", Orbitron`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const startX = s.x - ((activeUpgrades.length - 1) * spacingX) / 2;
            for (let j = 0; j < activeUpgrades.length; j++) {
              const item = activeUpgrades[j];
              const x = startX + j * spacingX;
              const y = s.y + yOffset;
              
              // Draw the upgrade symbol directly without a decal background
              ctx.fillText(item.symbol, x, y);
              
              // Draw tiny tier level if greater than 1
              if (item.count > 1) {
                ctx.fillStyle = '#39ff14'; // Vibrant neon green
                ctx.font = 'bold 2px Orbitron';
                ctx.fillText(item.count.toString(), x + 2.5, y - 2.0);
                ctx.font = `${iconSize}px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", Orbitron`;
              }
            }
            ctx.restore();
          }

          if (s.isMaterializing) {
            ctx.save();
            ctx.globalAlpha = 0.8 + 0.2 * Math.sin(Date.now() / 150);
            ctx.font = '14px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const bob = 3 * Math.sin(Date.now() / 200);
            ctx.fillText('🔨', s.x, s.y - size - 12 + bob);
            ctx.restore();
          }

          if (s.isDismantling) {
            ctx.save();
            ctx.globalAlpha = 0.8 + 0.2 * Math.sin(Date.now() / 150);
            ctx.font = '14px "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const bob = 3 * Math.sin(Date.now() / 200);
            ctx.fillText('♻️', s.x, s.y - size - 12 + bob);
            ctx.restore();
          }

          if (s.name) {
            ctx.save();
            ctx.font = 'bold 6px Orbitron';
            ctx.fillStyle = ownerPlayer ? ownerPlayer.color : '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(s.name, s.x, s.y + size + 4 + upgradesHeight);
            ctx.restore();
          }

          if (s.isDismantling) {
            ctx.save();
            const barW = 40;
            const barH = 5;
            const barX = s.x - barW / 2;
            const barY = s.y - 25;
            
            ctx.fillStyle = 'rgba(5, 5, 15, 0.92)';
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 2.5);
            ctx.fill();
            ctx.stroke();
            
            const totalDuration = s.dismantleDuration || (s.maxHealth / 2) || 15;
            const remaining = s.dismantleTimer !== undefined ? s.dismantleTimer : 0;
            const progress = Math.max(0, Math.min(1, (totalDuration - remaining) / totalDuration));
            if (progress > 0) {
              ctx.fillStyle = '#f33';
              ctx.shadowColor = '#f33';
              ctx.shadowBlur = 6;
              ctx.beginPath();
              ctx.roundRect(barX, barY, barW * progress, barH, 2.5);
              ctx.fill();
            }
            
            ctx.font = 'bold 8px Orbitron';
            ctx.fillStyle = '#ff3333';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            ctx.fillText('DISMANTLING', s.x, barY - 4);
            
            ctx.restore();
          }

          if (s.isUpgrading) {
            ctx.save();
            const barW = 40;
            const barH = 5;
            const barX = s.x - barW / 2;
            const barY = s.y - 25; // 25px above cruiser center
            
            // Background track
            ctx.fillStyle = 'rgba(5, 5, 15, 0.92)';
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 2.5);
            ctx.fill();
            ctx.stroke();
            
            // Neon progress fill
            const cost = getUpgradeCostForShip(s, s.upgradeType);
            const totalDuration = cost * 0.2;
            const progress = Math.max(0, Math.min(1, (totalDuration - (s.upgradeTimer || 0)) / totalDuration));
            if (progress > 0) {
              ctx.fillStyle = '#0f0';
              ctx.shadowColor = '#0f0';
              ctx.shadowBlur = 6;
              ctx.beginPath();
              ctx.roundRect(barX, barY, barW * progress, barH, 2.5);
              ctx.fill();
            }
            
            // Category text
            ctx.font = 'bold 8px Orbitron';
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 0;
            const upName = (s.upgradeType || 'UPGRADE').toUpperCase();
            ctx.fillText(upName, s.x, barY - 4);
            
            ctx.restore();
          }

          if (ownerPlayer) {
            const rawTech = ownerPlayer.techScore || 0;
            const rawExp = ownerPlayer.expScore || 0;
            const shipExp = s.expScore || 0;
            const techBonus = Math.sqrt(rawTech);
            const expBonus = Math.sqrt(rawExp);
            const shipExpBonus = Math.sqrt(shipExp);
            let hitChanceValue = 10;
            const targetingBonus = (s.targeting || 0) * 10;
            hitChanceValue += targetingBonus;
            if (s.bombs > 0) hitChanceValue += 10;
            hitChanceValue += techBonus + expBonus + shipExpBonus;
            if (hitChanceValue >= 100) {
              ctx.save();
              const starX = s.x + size * 0.6;
              const starY = s.y - size * 0.6;
              const starR = 1.4;
              ctx.translate(starX, starY);
              ctx.beginPath();
              for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * starR, -Math.sin((18 + i * 72) / 180 * Math.PI) * starR);
                ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * starR * 0.5, -Math.sin((54 + i * 72) / 180 * Math.PI) * starR * 0.5);
              }
              ctx.closePath();
              ctx.fillStyle = 'gold';
              ctx.fill();
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 0.2;
              ctx.stroke();
              ctx.restore();
            }

            if (s.isWarp) {
              ctx.save();
              const boltX = s.x - size * 0.6;
              const boltY = s.y - size * 0.6;
              const boltSize = 1.6;
              ctx.translate(boltX, boltY);
              ctx.beginPath();
              ctx.moveTo(0, -boltSize);
              ctx.lineTo(-boltSize * 0.6, boltSize * 0.1);
              ctx.lineTo(0, boltSize * 0.1);
              ctx.lineTo(-boltSize * 0.3, boltSize);
              ctx.lineTo(boltSize * 0.6, -boltSize * 0.2);
              ctx.lineTo(0, -boltSize * 0.2);
              ctx.closePath();
              ctx.fillStyle = '#0f0';
              ctx.fill();
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 0.2;
              ctx.stroke();
              ctx.restore();
            }
          }

          if (s.maxHealth > 0) {
            const barW = size * 1.5;
            const barH = 2;
            let currentY = s.y - size - 4;
            
            const maxFuel = getMaxFuel(s);
            if (s.fuel !== undefined && s.fuel < maxFuel) {
              currentY -= barH;
              ctx.fillStyle = '#555';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#ffa500';
              ctx.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.fuel) / maxFuel), barH);
              currentY -= 1;
            }
            
            if (s.isCruiser && s.bombs !== undefined) {
              const maxBombs = getMaxBombs(s);
              if (s.bombs < maxBombs) {
                currentY -= barH;
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
                ctx.fillStyle = '#a0a0a0';
                ctx.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.bombs) / maxBombs), barH);
                currentY -= 1;
              }
            }
            
            const shipExpBonus = Math.sqrt(s.expScore || 0);
            if (s.isCruiser && (s.expScore || 0) >= 1) {
              currentY -= barH;
              ctx.fillStyle = '#1a3344';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#00d5ff';
              ctx.fillRect(s.x - barW / 2, currentY, barW * Math.min(1.0, shipExpBonus / 20), barH);
              currentY -= 1;
            }
            
            if (s.isCruiser && (s.commandPoints || 0) > 0) {
              currentY -= barH;
              ctx.fillStyle = '#3a0f0f';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#800000';
              ctx.fillRect(s.x - barW / 2, currentY, barW * Math.min(1.0, s.commandPoints / 20), barH);
              currentY -= 1;
            }
            
            if (s.isCruiser && s.maxsupplies > 0) {
              currentY -= barH;
              ctx.fillStyle = '#3a1a4a';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#a855f7';
              ctx.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.supplies || 0) / s.maxsupplies), barH);
              currentY -= 1;
            }
            
            if (s.isCruiser && (s.diplomat || 0) > 0) {
              currentY -= barH;
              ctx.fillStyle = '#443d00';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#ffff00';
              const maxParley = (s.diplomat || 0) * 3;
              const ratio = maxParley > 0 ? Math.min(1.0, Math.max(0, s.parley || 0) / maxParley) : 0;
              ctx.fillRect(s.x - barW / 2, currentY, barW * ratio, barH);
              currentY -= 1;
            }

            if (s.health < s.maxHealth) {
              currentY -= barH;
              ctx.fillStyle = 'red';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#0f0';
              ctx.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.health) / s.maxHealth), barH);
            }
          }
          
          let modeText = '';
          let modeColor = '';
          if (s.isPatrolling) {
            modeText = '⚔️';
            modeColor = '#0ff';
          } else if (s.isScouting) {
            modeText = '🔭';
            modeColor = '#0ff';
          } else if (s.isResearching) {
            modeText = '🔬';
            modeColor = '#0f0';
          } else if (s.isDiplomacy) {
            modeText = '🤝';
            modeColor = '#ff00ff';
          }

          if (modeText) {
            ctx.save();
            ctx.font = 'bold 8px Orbitron';
            ctx.fillStyle = modeColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 6;
            ctx.shadowColor = modeColor;
            ctx.fillText(modeText, s.x + size * 1.6 + 2, s.y);
            ctx.restore();
          }

          let groupNum = null;
          for (let g = 0; g <= 9; g++) {
            if (controlGroups[g] && controlGroups[g].shipIds && controlGroups[g].shipIds.includes(s.id)) {
              groupNum = g;
              break;
            }
          }
          if (groupNum !== null) {
            ctx.save();
            ctx.font = 'bold 7px Orbitron';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(groupNum.toString(), s.x - size * 0.7, s.y - size * 0.7);
            ctx.restore();
          }

          ctx.beginPath();
          ctx.restore();
        } else {
          ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      if (serverState.lasers) {
        for (const laser of serverState.lasers) {
          // Frustum culling for lasers: skip if both endpoints are way off-screen
          const buffer = 150;
          const startOff = laser.startX < viewMinX - buffer || laser.startX > viewMaxX + buffer || laser.startY < viewMinY - buffer || laser.startY > viewMaxY + buffer;
          const endOff = laser.endX < viewMinX - buffer || laser.endX > viewMaxX + buffer || laser.endY < viewMinY - buffer || laser.endY > viewMaxY + buffer;
          if (startOff && endOff) {
            continue;
          }

          const progress = laser.age / laser.duration;
          
          if (laser.isBombAttack) {
            const delay = (laser.index || 0) * 0.24;
            if (laser.age < delay) {
              continue;
            }
            const travelDuration = 1.05;
            if (laser.age > delay + travelDuration) {
              continue;
            }
            const progress = (laser.age - delay) / travelDuration;

            let startPtX = laser.startX;
            let startPtY = laser.startY;
            let endPtX = laser.endX;
            let endPtY = laser.endY;
            
            const seed = Math.sin(laser.startX * 12.9898 + laser.startY * 78.233 + (laser.index || 0)) * 43758.5453;
            const randVal = seed - Math.floor(seed);
            const randVal2 = (seed * 10) - Math.floor(seed * 10);
            
            if (laser.sourceIsCruiser) {
              // Server sets the bomb origin exactly at the center (this.x, this.y)
              startPtX = laser.startX;
              startPtY = laser.startY;
            }
            
            if (laser.targetIsCruiser) {
              const size = (6 + (laser.targetMaxHealth || 6) * 1.0) / 3.0;
              const rotAngle = (laser.targetAngle || 0) + Math.PI / 2;
              let localX = 0;
              let localY = 0;
              const targetPointSeed = Math.floor(randVal * 4);
              if (targetPointSeed === 0) {
                localX = 0;
                localY = -size * 0.7;
              } else if (targetPointSeed === 1) {
                localX = -size * 0.6;
                localY = size * 0.1;
              } else if (targetPointSeed === 2) {
                localX = size * 0.6;
                localY = size * 0.1;
              } else {
                localX = 0;
                localY = size * 0.4;
              }
              const gx = localX * Math.cos(rotAngle) - localY * Math.sin(rotAngle);
              const gy = localX * Math.sin(rotAngle) + localY * Math.cos(rotAngle);
              endPtX = laser.endX + gx;
              endPtY = laser.endY + gy;
            } else if (laser.targetIsPlanet) {
              endPtX = laser.endX + (randVal - 0.5) * 40;
              endPtY = laser.endY + (randVal2 - 0.5) * 40;
            }
            
            const style = laser.cruiserStyle || 'Klingon';
            if (style === 'Lyran') {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(startPtX, startPtY);
              ctx.lineTo(endPtX, endPtY);
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 3.0;
              ctx.globalAlpha = Math.max(0, 1.0 - progress);
              ctx.stroke();
              ctx.restore();
            } else {
              const curX = startPtX + (endPtX - startPtX) * progress;
              const curY = startPtY + (endPtY - startPtY) * progress;
              
              ctx.save();
              ctx.translate(curX, curY);
              
              if (style === 'Federation') {
                ctx.beginPath();
                ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffff00';
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 8;
                ctx.fill();
              } else if (style === 'Tholian') {
                ctx.beginPath();
                ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ff0000';
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 8;
                ctx.fill();
              } else if (style === 'Gorn') {
                ctx.beginPath();
                ctx.arc(0, 0, 4.0, 0, Math.PI * 2);
                ctx.fillStyle = '#ff3300';
                ctx.shadowColor = '#ff3300';
                ctx.shadowBlur = 10;
                ctx.fill();
              } else if (style === 'Romulan') {
                ctx.beginPath();
                ctx.arc(0, 0, 6.0, 0, Math.PI * 2);
                ctx.fillStyle = '#ff0000';
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 12;
                ctx.fill();
              } else {
                const angle = Math.atan2(endPtY - startPtY, endPtX - startPtX);
                ctx.rotate(angle + Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(0, -3);
                ctx.lineTo(1, -1);
                ctx.lineTo(1, 2);
                ctx.lineTo(1.5, 3);
                ctx.lineTo(-1.5, 3);
                ctx.lineTo(-1, 2);
                ctx.lineTo(-1, -1);
                ctx.closePath();
                ctx.fillStyle = '#ff1100';
                ctx.shadowColor = '#ff1100';
                ctx.shadowBlur = 6;
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(0.5, 3);
                ctx.lineTo(0, 4.5 + Math.random() * 1.5);
                ctx.lineTo(-0.5, 3);
                ctx.closePath();
                ctx.fillStyle = '#ffaa00';
                ctx.fill();
              }
              ctx.restore();
            }
            continue;
          }
          
          if (laser.isAmoebaAttack || laser.color === 'amoeba') {
            const numParticles = 8;
            const angle = Math.atan2(laser.endY - laser.startY, laser.endX - laser.startX);
            const dist = Math.sqrt((laser.endX - laser.startX)**2 + (laser.endY - laser.startY)**2);
            const perpAngle = angle + Math.PI / 2;

            for (let i = 0; i < numParticles; i++) {
              // Deterministic pseudo-random seed based on coordinates and index
              const seed = Math.sin(laser.startX * 12.9898 + laser.startY * 78.233 + i) * 43758.5453;
              const randX = seed - Math.floor(seed);
              const randY = (seed * 10) - Math.floor(seed * 10);
              const randSize = (seed * 100) - Math.floor(seed * 100);

              // Vary speed per particle
              const pSpeed = 0.75 + randX * 0.5;
              const pProgress = Math.min(1.0, progress * pSpeed);

              // Spread expands outwards perpendicular to travel path
              const maxSpread = 15 + dist * 0.12;
              const spreadOffset = (randY - 0.5) * maxSpread * Math.sin(pProgress * Math.PI);

              // Position
              const px = laser.startX + (laser.endX - laser.startX) * pProgress + Math.cos(perpAngle) * spreadOffset;
              const py = laser.startY + (laser.endY - laser.startY) * pProgress + Math.sin(perpAngle) * spreadOffset;

              // Size and opacity scaling
              const pRadius = 1.0 + randSize * 2.0;
              const opacity = Math.max(0, 1.0 - pProgress);

              ctx.fillStyle = `rgba(0, 255, 0, ${opacity * 0.85})`;
              const pSize = pRadius * 2;
              ctx.fillRect(px - pRadius, py - pRadius, pSize, pSize);
            }
          } else if (laser.color === 'cruiser-projectile') {
            const curX = laser.startX + (laser.endX - laser.startX) * progress;
            const curY = laser.startY + (laser.endY - laser.startY) * progress;
            ctx.beginPath();
            ctx.arc(curX, curY, 1, 0, Math.PI * 2);
            ctx.fillStyle = "#ff5500";
            ctx.strokeStyle = "#ffff00";
            ctx.lineWidth = 0.4;
            ctx.fill();
            ctx.stroke();
          } else if (laser.color === 'refuel-beam') {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(laser.startX, laser.startY);
            ctx.lineTo(laser.endX, laser.endY);
            ctx.strokeStyle = `rgba(0, 255, 255, ${(0.4 + Math.random() * 0.4) * (1.0 - progress)})`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Energy spark traveling down the beam
            const pulseX = laser.startX + (laser.endX - laser.startX) * progress;
            const pulseY = laser.startY + (laser.endY - laser.startY) * progress;
            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
          } else if (laser.color === 'resupply-beam') {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(laser.startX, laser.startY);
            ctx.lineTo(laser.endX, laser.endY);
            ctx.strokeStyle = `rgba(0, 255, 128, ${(0.4 + Math.random() * 0.4) * (1.0 - progress)})`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#00ff80';
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Supply package/spark traveling down the beam
            const pulseX = laser.startX + (laser.endX - laser.startX) * progress;
            const pulseY = laser.startY + (laser.endY - laser.startY) * progress;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00ff80';
            ctx.shadowBlur = 10;
            ctx.fillRect(pulseX - 2.5, pulseY - 2.5, 5, 5);
            ctx.restore();
          } else {
            // Cinematic staggered normal lasers
            const totalDuration = laser.duration || 0.8;
            const delay = (laser.index || 0) * 0.08; // Staggered by 80ms per laser!
            const laserDuration = 0.25; // Each blast lasts 250ms

            if (laser.age >= delay && laser.age <= delay + laserDuration) {
              const activeProgress = (laser.age - delay) / laserDuration;

              // Find exact start and end coordinates based on ship positions
              let startPtX = laser.startX;
              let startPtY = laser.startY;
              let endPtX = laser.endX;
              let endPtY = laser.endY;

              // Seeded pseudo-random function to choose stable ship offsets
              const seed = Math.sin(laser.startX * 12.9898 + laser.startY * 78.233 + (laser.index || 0)) * 43758.5453;
              const randVal = seed - Math.floor(seed);
              const randVal2 = (seed * 10) - Math.floor(seed * 10);

              // 1. Source Offset (Fleet/Cruiser/Amoeba/Planet)
              if (laser.sourceCount > 1 && !laser.sourceIsCruiser && !laser.sourceIsAmoeba) {
                const sourceRenderCount = Math.min(50, laser.sourceCount);
                const sourceIndex = Math.floor(randVal * sourceRenderCount);
                const sourceMaxSpread = laser.sourceIsBomber ? 10 : Math.min(60, 10 + Math.sqrt(laser.sourceCount) * 2.5);
                const { lx, ly } = getFormationOffset(
                  laser.sourceFormation || 'arrow',
                  sourceIndex,
                  sourceRenderCount,
                  sourceMaxSpread,
                  laser.sourceIsInterceptor,
                  laser.sourceIsBomber
                );
                const cos = Math.cos(laser.sourceAngle || 0);
                const sin = Math.sin(laser.sourceAngle || 0);
                startPtX = laser.startX + lx * cos - ly * sin;
                startPtY = laser.startY + lx * sin + ly * cos;
              } else if (laser.sourceIsCruiser) {
                // The server already calculates the exact alternating left/right wing tip positions (or center for bombs)
                // in startX and startY! So we do not need to add any offset here.
                startPtX = laser.startX;
                startPtY = laser.startY;
              } else if (laser.sourceIsPlanet) {
                // Originate from random spot within planet radius
                startPtX = laser.startX + (randVal - 0.5) * 40;
                startPtY = laser.startY + (randVal2 - 0.5) * 40;
              }

              // 2. Target Offset (Fleet/Cruiser/Amoeba/Planet)
              if (laser.targetCount > 1 && !laser.targetIsCruiser && !laser.targetIsAmoeba) {
                const targetRenderCount = Math.min(50, laser.targetCount);
                const targetIndex = Math.floor(randVal2 * targetRenderCount);
                const targetMaxSpread = laser.targetIsBomber ? 10 : Math.min(60, 10 + Math.sqrt(laser.targetCount) * 2.5);
                const { lx, ly } = getFormationOffset(
                  laser.targetFormation || 'arrow',
                  targetIndex,
                  targetRenderCount,
                  targetMaxSpread,
                  laser.targetIsInterceptor,
                  laser.targetIsBomber
                );
                const cos = Math.cos(laser.targetAngle || 0);
                const sin = Math.sin(laser.targetAngle || 0);
                endPtX = laser.endX + lx * cos - ly * sin;
                endPtY = laser.endY + lx * sin + ly * cos;
              } else if (laser.targetIsCruiser) {
                const size = (6 + (laser.targetMaxHealth || 6) * 1.0) / 3.0;
                const rotAngle = (laser.targetAngle || 0) + Math.PI / 2;
                
                let localX = 0;
                let localY = 0;
                const targetPointSeed = Math.floor(randVal * 4);
                if (targetPointSeed === 0) {
                  // Tip/Bridge impact
                  localX = 0;
                  localY = -size * 0.7;
                } else if (targetPointSeed === 1) {
                  // Left Wing impact
                  localX = -size * 0.6;
                  localY = size * 0.1;
                } else if (targetPointSeed === 2) {
                  // Right Wing impact
                  localX = size * 0.6;
                  localY = size * 0.1;
                } else {
                  // Tail/Engineering impact
                  localX = 0;
                  localY = size * 0.4;
                }
                
                const gx = localX * Math.cos(rotAngle) - localY * Math.sin(rotAngle);
                const gy = localX * Math.sin(rotAngle) + localY * Math.cos(rotAngle);
                endPtX = laser.endX + gx;
                endPtY = laser.endY + gy;
              } else if (laser.targetIsAmoeba) {
                const size = 6 + (laser.targetMaxHealth || 6) * 1.5;
                endPtX = laser.endX + (randVal - 0.5) * size;
                endPtY = laser.endY + (randVal2 - 0.5) * size;
              } else if (laser.targetIsPlanet) {
                // Target a random spot within planet radius
                endPtX = laser.endX + (randVal - 0.5) * 40;
                endPtY = laser.endY + (randVal2 - 0.5) * 40;
              }

              ctx.save();
              ctx.beginPath();
              ctx.moveTo(startPtX, startPtY);
              ctx.lineTo(endPtX, endPtY);
              ctx.strokeStyle = laser.cruiserStyle === 'Tholian' ? '#ffff00' : laser.color;
              // Vary brightness: multiply fading opacity by a random factor between 0.6 and 1.0
              const brightnessFactor = 0.6 + randVal * 0.4;
              ctx.globalAlpha = Math.max(0, 1.0 - activeProgress) * brightnessFactor;
              // Keep it a thin beam (1.5px) instead of randomized widths
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      if (serverState.explosions) {
        for (const exp of serverState.explosions) {
          // Frustum culling for explosions
          const maxRadius = exp.isCatastrophic ? 600 : (exp.isMassive ? 400 : 35);
          if (exp.x < viewMinX - maxRadius || exp.x > viewMaxX + maxRadius || exp.y < viewMinY - maxRadius || exp.y > viewMaxY + maxRadius) {
            continue;
          }

          if (exp.isCatastrophic) {
            // Military planet catastrophic explosion â€” huge dual shockwave
            const alpha = Math.max(0, 1 - exp.age);

            // Inner fireball
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.age * 300, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 68, 0, ${alpha * 0.6})`;
            ctx.fill();

            // Primary shockwave ring
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, exp.age * 600, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
            ctx.lineWidth = 14;
            ctx.stroke();

            // secondary shockwave ring (trailing)
            const trailAge = Math.max(0, exp.age - 0.15);
            if (trailAge > 0) {
              ctx.beginPath();
              ctx.arc(exp.x, exp.y, trailAge * 500, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(255, 200, 50, ${Math.max(0, 1 - trailAge) * 0.7})`;
              ctx.lineWidth = 6;
              ctx.stroke();
            }
          } else if (exp.isFirework) {
            const particleCount = 12;
            const alpha = Math.max(0, 1 - exp.age);
            const radius = exp.age * (exp.size || 25);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 51, 51, ${alpha})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ff3333';
            ctx.shadowBlur = 8;
            for (let p = 0; p < particleCount; p++) {
              const angle = (p / particleCount) * Math.PI * 2 + (exp.age * 0.5);
              const startX = exp.x + Math.cos(angle) * (radius * 0.4);
              const startY = exp.y + Math.sin(angle) * (radius * 0.4);
              const endX = exp.x + Math.cos(angle) * radius;
              const endY = exp.y + Math.sin(angle) * radius;
              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(endX, endY);
              ctx.stroke();
            }
            ctx.restore();
          } else if (exp.isDollarSign) {
            ctx.save();
            const alpha = Math.max(0, 1 - exp.age / 5.0);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#39ff14'; // vibrant neon green
            ctx.font = 'bold 7px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#39ff14';
            ctx.shadowBlur = 4;
            const numDollarSigns = Math.max(1, Math.round(Math.sqrt(exp.amount || 1)));
            const text = '$'.repeat(numDollarSigns);
            const yOffset = exp.age * 10;
            ctx.fillText(text, exp.x, exp.y - 20 - yOffset);
            ctx.restore();
          } else if (exp.color === 'amoeba-shrug') {
            ctx.beginPath();
            const maxRadius = 6;
            ctx.arc(exp.x, exp.y, exp.age * maxRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 0, ${Math.max(0, 1 - exp.age) * 0.6})`;
            ctx.fill();
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 1.0;
            ctx.stroke();
          } else {
            ctx.beginPath();
            const maxRadius = exp.isMassive ? 400 : 35;
            ctx.arc(exp.x, exp.y, exp.age * maxRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, 1 - exp.age)})`;
            ctx.fill();
            ctx.strokeStyle = exp.color;
            ctx.lineWidth = exp.isMassive ? 10 : 3;
            ctx.stroke();
          }
        }
      }

      // Draw hazard text (foreground, on top of planets/ships)
      if (serverState.storms) {
        for (const storm of serverState.storms) {
          const t = storm.type || 'storm';
          const textColor = t === 'minefield' ? '#66f' : t === 'nebula' ? '#f66' : '#ff0';
          const dimColor = t === 'minefield' ? 'rgba(100, 100, 255, 0.7)' : t === 'nebula' ? 'rgba(255, 100, 100, 0.7)' : 'rgba(255, 255, 0, 0.7)';
          ctx.fillStyle = textColor;
          ctx.font = 'bold 12px Orbitron';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          let maxShipExp = 0;
          if (selectedShips && selectedShips.length > 0) {
            for (const s of selectedShips) {
              if ((s.expScore || 0) > maxShipExp) maxShipExp = s.expScore || 0;
            }
          }
          let tR = 0, eR = 0;
          if (localPlayer) {
            const lp = serverState.players.find(p => p.id === localPlayer.id);
            if (lp) {
              tR = Math.sqrt(lp.techScore || 0);
              eR = Math.sqrt(lp.expScore || 0);
            }
          }
          const sR = Math.sqrt(maxShipExp);
          const effKnowledge = (storm.knowledge || 0) + (tR + eR) / 2 + sR;
          const effIntensity = Math.max(0, storm.intensity - effKnowledge);

          if (t === 'minefield') {
            ctx.fillText('Ancient Minefield', storm.x, storm.y - 16);
            ctx.font = '10px Rajdhani';
            ctx.fillText(`Mines: ${storm.mines ?? 0}  Intensity: ${storm.intensity} (${Math.round(effIntensity)})`, storm.x, storm.y);
          } else if (t === 'nebula') {
            ctx.fillText(`${storm.name} Nebula`, storm.x, storm.y - 8);
            ctx.font = '10px Rajdhani';
            ctx.fillText(`Intensity: ${storm.intensity} (${Math.round(effIntensity)})`, storm.x, storm.y + 8);
          } else {
            ctx.fillText(`Ion Storm ${storm.name}`, storm.x, storm.y - 8);
            ctx.font = '10px Rajdhani';
            ctx.fillText(`Intensity: ${storm.intensity} (${Math.round(effIntensity)})  speed: ${storm.speed.toFixed(1)}  Heading: ${Math.round(storm.heading)}\u00B0`, storm.x, storm.y + 8);
          }
        }
      }

      for (let i = floatingAnimations.length - 1; i >= 0; i--) {
        const anim = floatingAnimations[i];
        anim.age += 1 / 20; // 20 FPs update rate

        if (anim.age >= anim.duration) {
          floatingAnimations.splice(i, 1);
          continue;
        }

        const progress = anim.age / anim.duration;

        let drawX = anim.x;
        let drawY = anim.y;
        if (anim.shipId && anim.type !== 'diplomacy_success' && serverState && serverState.ships) {
          const ship = serverState.ships.find(s => s.id === anim.shipId);
          if (ship) {
            drawX = ship.x;
            drawY = ship.y;
            anim.x = ship.x;
            anim.y = ship.y;
          }
        }

        if (anim.type === 'exploration_xp') {
          // Draw a bright, very small starburst
          const radius = 5 * Math.sin(progress * Math.PI); // very small starburst (max radius 5px)
          const alpha = Math.max(0, 1 - progress);
          
          ctx.save();
          // Draw central glow
          ctx.beginPath();
          ctx.arc(drawX, drawY, radius * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
          ctx.shadowColor = '#ffd700'; // gold glow
          ctx.shadowBlur = 4;
          ctx.fill();
          
          // Draw starburst rays
          ctx.strokeStyle = `rgba(255, 235, 59, ${alpha})`; // bright yellow
          ctx.lineWidth = 1.0;
          const rayCount = 8;
          for (let r = 0; r < rayCount; r++) {
            const angle = (r / rayCount) * Math.PI * 2 + (progress * 0.6); // rotates as it expands
            const startLen = radius * 0.3;
            const endLen = radius;
            ctx.beginPath();
            ctx.moveTo(drawX + Math.cos(angle) * startLen, drawY + Math.sin(angle) * startLen);
            ctx.lineTo(drawX + Math.cos(angle) * endLen, drawY + Math.sin(angle) * endLen);
            ctx.stroke();
          }
          
          // Float the XP text above
          ctx.font = 'bold 9px Orbitron';
          ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`; // bright cyan
          ctx.shadowColor = `rgba(0, 229, 255, ${alpha * 0.5})`;
          ctx.shadowBlur = 3;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textYOffset = progress * 16;
          ctx.fillText(`+${anim.text} XP`, drawX, drawY - 6 - textYOffset);
          
          ctx.restore();
          continue;
        }
        // Hold opacity then fade out sharply at the end to "pop"
        const alpha = progress < 0.8 ? 1 : 1 - ((progress - 0.8) * 5);

        let yOffset = progress * 50; // default drift up by 50px
        if (anim.type === 'pref_resource_diplomacy' || anim.type === 'diplomacy_success') {
          yOffset = 0; // strictly moves from start position to target position
        } else if (anim.type === 'beaker') {
          yOffset = progress * 30; // ascends much slower
        } else if (anim.type === 'lightning') {
          yOffset = 0; // doesn't drift up
        } else if (anim.type === 'launchCost') {
          yOffset = -progress * 20; // floats down
        } else if (anim.type === 'colonize') {
          yOffset = progress * 60; // drifts up faster
        } else if (anim.type === 'rampage') {
          yOffset = progress * 100; // shoots up
        } else if (anim.type === 'defeat') {
          yOffset = progress * 80; // drifts up dramatically
        } else if (anim.type === 'lastStand') {
          yOffset = 0; // stationary
        } else if (anim.type === 'homeworldAnim') {
          yOffset = 0; // stationary
        } else if (anim.type === 'enhance') {
          yOffset = progress * 60; // drifts up nicely
        } else if (anim.type === 'diplomacy_failure') {
          const mult = anim.driftYMult !== undefined ? anim.driftYMult : 1.0;
          yOffset = progress * 40 * mult; // float up nicely
        } else if (anim.type === 'outbreak') {
          yOffset = progress * 60; // drifts up nicely
        } else if (anim.type === 'accuracyIndicator') {
          yOffset = progress * (8.0 * anim.duration); // float slower (8.0px/sec)
        } else if (anim.type === 'resource_wanted') {
          yOffset = progress * 60; // drifts up nicely
        } else if (anim.type === 'anomaly_completion') {
          yOffset = progress * 70; // drifts up nicely
        }

        // Grow font
        let fontsize = 8 + (progress * 8);
        if (anim.type === 'pref_resource_diplomacy') {
          fontsize = 12 + (progress * 8); // starts at 12px, grows to 20px
        } else if (anim.type === 'lightning') {
          fontsize = progress * 30; // grows from 0 to 30
        } else if (anim.type === 'launchCost') {
          fontsize = 6.0 + (progress * 12); // grows from 6.0px to 18.0px
        } else if (anim.type === 'colonize') {
          fontsize = 12 + (progress * 10); // grows from 12 to 22
        } else if (anim.type === 'rampage') {
          fontsize = 20 + (progress * 40); // grows huge
        } else if (anim.type === 'defeat') {
          fontsize = 16 + (progress * 30); // grows large
        } else if (anim.type === 'lastStand' || anim.type === 'homeworldAnim') {
          fontsize = 7; // constant size
        } else if (anim.type === 'enhance') {
          fontsize = 12 + (progress * 8); // grows from 12 to 20
        } else if (anim.type === 'diplomacy_success' || anim.type === 'diplomacy_failure') {
          fontsize = 12 + (progress * 8); // grows from 12 to 20
        } else if (anim.type === 'outbreak') {
          fontsize = 16 + (progress * 14); // grows moderately
        } else if (anim.type === 'accuracyIndicator') {
          fontsize = 4; // constant small font size (20% bigger than 10 / 3)
        } else if (anim.type === 'resource_wanted') {
           fontsize = 11 + (progress * 9); // grows from 11px to 20px
        } else if (anim.type === 'revolt') {
           fontsize = 18 + (progress * 22); // starts at 18px, grows to 40px
        } else if (anim.type === 'anomaly_completion') {
           fontsize = 14 + (progress * 12); // starts at 14px, grows to 26px
        }

        ctx.font = `bold ${fontsize}px Orbitron`; // growing font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let xOffset = 0;
        if (anim.type === 'dollar') {
          // Gentle sway: 1.5 cycles, 8px amplitude
          xOffset = Math.sin(progress * Math.PI * 3) * 8;
          ctx.fillStyle = `rgba(255, 255, 220, ${alpha})`; // whiter core for shininess
          ctx.shadowColor = `rgba(255, 215, 0, ${alpha})`; // gold glow
        } else if (anim.type === 'beaker') {
          // sway opposite direction
          xOffset = -Math.sin(progress * Math.PI * 3) * 8;
          ctx.fillStyle = `rgba(220, 255, 220, ${alpha})`;
          ctx.shadowColor = `rgba(0, 255, 0, ${alpha})`; // green glow
        } else if (anim.type === 'lightning') {
          // Jitter in place
          xOffset = (Math.random() - 0.5) * 5;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = `rgba(0, 255, 255, ${alpha})`; // cyan glow
        } else if (anim.type === 'launchCost') {
          // floating down and to the right
          xOffset = progress * 10;
          let brightness = Math.floor(80 + (progress * 175)); // Brightens to white
          ctx.fillStyle = `rgba(255, ${brightness}, ${brightness}, ${alpha})`;
          ctx.shadowColor = `rgba(255, 0, 0, ${alpha})`; // red glow
        } else if (anim.type === 'colonize') {
          xOffset = 0;
          ctx.fillStyle = `rgba(200, 255, 255, ${alpha})`;
          ctx.shadowColor = `rgba(0, 255, 255, ${alpha})`; // cyan glow
        } else if (anim.type === 'rampage') {
          xOffset = (Math.random() - 0.5) * 15; // aggressive jitter
          ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
          ctx.shadowColor = `rgba(255, 0, 0, ${alpha})`; // deep red glow
        } else if (anim.type === 'outbreak') {
          xOffset = (Math.random() - 0.5) * 4; // slight jitter
          ctx.fillStyle = `rgba(150, 255, 150, ${alpha})`; // green/lime color for infection
          ctx.shadowColor = `rgba(0, 255, 0, ${alpha})`; // green glow
        } else if (anim.type === 'defeat') {
          xOffset = (Math.random() - 0.5) * 3;
          const c = anim.color || '#fff';
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = c;
        } else if (anim.type === 'lastStand') {
          xOffset = 0; // stationary
          ctx.fillStyle = anim.color || '#fff';
          ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`; // white glow
        } else if (anim.type === 'homeworldAnim') {
          xOffset = 0; // stationary
          ctx.fillStyle = anim.color || '#fff';
          ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`; // white glow
        } else if (anim.type === 'enhance') {
          xOffset = 0;
          ctx.fillStyle = anim.color || '#fff';
          ctx.shadowColor = anim.color || 'rgba(0, 255, 255, 0.8)';
        } else if (anim.type === 'diplomacy_success') {
          const drift = anim.driftX !== undefined ? anim.driftX * progress : 0;
          const scat = anim.scatterX !== undefined ? anim.scatterX : 0;
          xOffset = Math.sin(progress * Math.PI * 3) * 6 + drift + scat;
          ctx.fillStyle = `rgba(255, 180, 200, ${alpha})`;
          ctx.shadowColor = `rgba(255, 0, 128, ${alpha})`;
        } else if (anim.type === 'diplomacy_failure') {
          xOffset = -Math.sin(progress * Math.PI * 3) * 6;
          ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
          ctx.shadowColor = `rgba(100, 100, 100, ${alpha})`;
        } else if (anim.type === 'accuracyIndicator') {
          xOffset = 0;
          const isPlayerAttacker = (localPlayer && anim.attackerOwnerId === localPlayer.id);
          if (isPlayerAttacker || anim.isBombAttack) {
            ctx.fillStyle = `rgba(60, 255, 60, ${alpha})`; // green
            ctx.shadowColor = `rgba(0, 255, 0, ${alpha})`; // green glow
          } else {
            ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`; // very red
            ctx.shadowColor = `rgba(255, 0, 0, ${alpha})`; // red glow
          }
        } else if (anim.type === 'pref_resource_diplomacy') {
          xOffset = -Math.sin(progress * Math.PI * 3) * 8;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = `rgba(255, 215, 0, ${alpha})`; // Gold shadow glow
        } else if (anim.type === 'resource_wanted') {
          xOffset = Math.sin(progress * Math.PI * 2) * 5;
          ctx.fillStyle = `rgba(255, 223, 0, ${alpha})`; // gold
          ctx.shadowColor = `rgba(255, 140, 0, ${alpha})`; // dark orange glow
        } else if (anim.type === 'revolt') {
          xOffset = (Math.random() - 0.5) * 12; // Jitter text slightly
          ctx.fillStyle = `rgba(255, 51, 51, ${alpha})`; // bright red
          ctx.shadowColor = `rgba(139, 0, 0, ${alpha})`; // deep red glow
        } else if (anim.type === 'anomaly_completion') {
          xOffset = 0;
          ctx.fillStyle = `rgba(0, 255, 204, ${alpha})`; // glowing teal
          ctx.shadowColor = `rgba(0, 255, 204, ${alpha})`;
        } else {
          xOffset = Math.sin(progress * Math.PI * 3) * 8;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`;
        }

        ctx.shadowBlur = 10;
        if (anim.type === 'pref_resource_diplomacy' || anim.type === 'diplomacy_success') {
          if (anim.type === 'diplomacy_success' && anim.shipId && serverState && serverState.ships) {
            const ship = serverState.ships.find(s => s.id === anim.shipId);
            if (ship) {
              anim.endX = ship.x;
              anim.endY = ship.y;
            }
          }
          drawX = anim.startX + (anim.endX - anim.startX) * progress;
          drawY = anim.startY + (anim.endY - anim.startY) * progress;
        }
        ctx.fillText(anim.text, drawX + xOffset, drawY - yOffset);
        ctx.shadowBlur = 0;
      }

    } finally {
      ctx.restore();
      if (serverState && serverState.isPaused) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '40px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.restore();
      }
      updateButtonHighlights();
    }
  }

  // Continuous render loop — keeps the visual state in sync with the camera
  // so that click hit-testing always matches what is on screen.
  function renderLoop() {
    try {
      draw();
      updateInfoPanelContent();
      updateSelectionTiles();
      checkMusicRotation();
    } catch (e) {
      console.error('[PlanetWars] draw() error:', e);
    }
    requestAnimationFrame(renderLoop);
  }
  console.log('[PlanetWars] Starting render loop');
  requestAnimationFrame(renderLoop);
// End of initialization
