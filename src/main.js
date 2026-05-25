import { io } from 'socket.io-client';
const keysDown = {};
window.addEventListener('keydown', e => keysDown[e.key] = true);
window.addEventListener('keyup', e => keysDown[e.key] = false);

window.addEventListener('DOMContentLoaded', () => {
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

  const savedPlayerName = localStorage.getItem('planetWarsPlayerName');
  if (savedPlayerName) {
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) nameInput.value = savedPlayerName;
  }

  let localPlayer = null;
  let serverState = null;
  let selectedPlanets = [];
  let selectedShips = [];
  let warpOrderNext = false;

  let speedModifierNext = null;
  let bombOrderNext = false;
  let fillModeNext = false;
  let scoutModeNext = false;
  let interceptorOrderNext = false;
  let cruiserOrderNext = false;

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
  let starfieldEnabled = false;
  let hoveredPlanet = null;
  let hoveredShip = null;

  // UI Elements
  const startScreen = document.getElementById('start-screen');
  const endScreen = document.getElementById('end-screen');
  const gameUI = document.getElementById('game-ui');

  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
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
    controls: '🎮 Controls',
    victory: '⚔️ Victory Conditions',
    planets: '🪐 Planets & Economy',
    ships: '🚀 Ships & Combat',
    cruisers: '🛸 Cruisers & Interceptors',
    hazards: '⚡ Hazards',
    monsters: '🧬 Space Amoebas',
    ai: '🤖 AI & Rampage',
    other: '📡 Other'
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

  let lastSuggestedPlanets = 50;
  let lastSuggestedAI = 5;

  if (planetCountInput && aiCountInput) {
    planetCountInput.addEventListener('input', () => {
      const planets = parseInt(planetCountInput.value, 10) || 0;
      const suggestedAI = Math.floor(planets / 10);
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
        const scale = newSize / 1600;
        const suggestedPlanets = Math.min(60, Math.round(50 * scale));
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
        const scale = newSize / 1600;
        const suggestedPlanets = Math.min(60, Math.round(50 * scale));
        if (parseInt(planetCountInput.value, 10) === lastSuggestedPlanets) {
          planetCountInput.value = suggestedPlanets;
          planetCountInput.dispatchEvent(new Event('input'));
        }
        lastSuggestedPlanets = suggestedPlanets;
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

  startBtn.addEventListener('click', () => {
    console.log('startBtn clicked!');
    const nameInput = document.getElementById('player-name-input');
    if (nameInput && nameInput.value.trim() !== '') {
      socket.emit('setName', nameInput.value.trim());
      localStorage.setItem('planetWarsPlayerName', nameInput.value.trim());
    }

    const musicCheckbox = document.getElementById('music-checkbox');
    const bgMusic = document.getElementById('bg-music');
    if (musicCheckbox && musicCheckbox.checked && bgMusic) {
      bgMusic.volume = 0.3;
      bgMusic.play().catch(e => console.warn('Music play blocked:', e));
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (chatInput && chatInput.classList.contains('hidden')) {
        chatInput.classList.remove('hidden');
        chatInput.focus();
      } else if (chatInput) {
        const text = chatInput.value.trim();
        if (text !== '') {
          socket.emit('chatMessage', text);
        }
        chatInput.value = '';
        chatInput.classList.remove('hidden');
        chatInput.blur();
      }
    }
  });

  socket.on('chatMessage', (msg) => {
    if (chatMessages) {
      const div = document.createElement('div');
      div.className = 'chat-msg';
      div.style.color = msg.color || '#fff';
      div.innerHTML = `<span style="opacity: 0.7">[${msg.sender}]</span> ${msg.text}`;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Remove element after 30 seconds to clean up DOM
      setTimeout(() => {
        if (div.parentNode === chatMessages) {
          chatMessages.removeChild(div);
        }
      }, 31000);
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

  if (resetAfkBtn) {
    resetAfkBtn.addEventListener('click', () => {
      socket.emit('resetAFK');
      afkWarningOverlay.classList.add('hidden');
    });
  }

  let lastPlanetCapacities = {};
  let lastPlanetAssignments = {};
  let lastPlanetRampages = {};
  let lastPlanetStands = {};
  let lastPlanetHomeworlds = {};
  let planetShields = {};
  let floatingAnimations = [];
  let lastPlanetSpyRooted = {};

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
    if (!sounds[type]) return;
    const clone = sounds[type].cloneNode();
    clone.volume = sounds[type].volume;
    clone.play().catch(e => { }); // Ignore autoplay errors
  }

  let audioCtx = null;
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

  let lastExplosionCount = 0;
  let lastLaserCount = 0;

  socket.on('gameStateUpdate', (state) => {
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

    // Center on homeworld and select it on first sync
    if (!hasCenteredOnHomeworld && localPlayer && state.settings && state.width && state.height) {
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
        if (!p.inFog && p.rampageEvent && !lastPlanetRampages[p.id]) {
          floatingAnimations.push({
            x: p.x,
            y: p.y,
            text: 'RAMPAGE!!!',
            type: 'rampage',
            age: 0,
            duration: 4.0
          });
          playSound('rampage');
          lastPlanetRampages[p.id] = true;
        } else if (!p.rampageEvent) {
          lastPlanetRampages[p.id] = false;
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

    serverState = state;

    if (state.explosions) {
      let playNormalExplosion = false;
      let playThud = false;
      for (const e of state.explosions) {
        if (e.age === 0) {
          if (e.color === 'amoeba-shrug') {
            playThud = true;
          } else {
            playNormalExplosion = true;
          }
        }
      }
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

    // startScreen is now hidden by startBtn click
    if (state.isRunning && !endScreen.classList.contains('hidden')) {
      endScreen.classList.add('hidden');
    }

    updateUI();
  });

  function updateUI() {
    if (!serverState || !localPlayer) return;

    const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
    if (!myPlayer) return;

    const pCount = myPlayer.planetCount || 0;
    const totalEconomy = myPlayer.totalCapacity || 0;
    const remainingPlanets = 42 - pCount;
    const techScore = myPlayer.techScore || 0;
    const techBonus = (Math.sqrt(techScore)).toFixed(1);
    const expScore = myPlayer.expScore || 0;
    const expBonus = (0.5 * Math.sqrt(expScore)).toFixed(1);

    if (leaderboardContent) {
      const alivePlayers = serverState.players.filter(p => p.isAlive || p.id === localPlayer.id || (serverState.ships && serverState.ships.some(s => s.active && s.ownerId === p.id)));
      alivePlayers.sort((a, b) => (b.totalCapacity || 0) - (a.totalCapacity || 0));

      const techSorted = [...alivePlayers].sort((a, b) => (b.techScore || 0) - (a.techScore || 0));
      const techLead = techSorted.length > 1 ? ((techSorted[0].techScore || 0) - (techSorted[1].techScore || 0)) : (techSorted[0] ? (techSorted[0].techScore || 0) : 0);
      const techLeadingId = techLead >= 200 ? techSorted[0].id : null;

      const capLeadingId = alivePlayers.length > 1 && (alivePlayers[0].totalCapacity || 0) > 2 * (alivePlayers[1].totalCapacity || 0) ? alivePlayers[0].id : (alivePlayers.length === 1 && (alivePlayers[0].totalCapacity || 0) > 0 ? alivePlayers[0].id : null);

      // Determine bullseye targets: capacity > 4500, OR tech lead >= 200, OR 2x capacity over 2nd
      const bullseyeIds = new Set();
      if (techLeadingId) bullseyeIds.add(techLeadingId);
      if (capLeadingId) bullseyeIds.add(capLeadingId);
      alivePlayers.forEach(p => {
        if ((p.totalCapacity || 0) > 4500) bullseyeIds.add(p.id);
      });

      let galacticCapacity = serverState.galacticCapacity || 1;

      let html = '';
      alivePlayers.forEach(p => {
        const capacity = p.totalCapacity || 0;
        const capacityPercent = galacticCapacity > 0 ? Math.round((capacity / galacticCapacity) * 100) : 0;
        const pTech = Math.floor(Math.sqrt(p.techScore || 0));
        const pExp = Math.floor(0.5 * Math.sqrt(p.expScore || 0));
        const blinkClass = (p.id === techLeadingId || p.id === capLeadingId) ? ' leader-row' : '';
        const bullseye = bullseyeIds.has(p.id) ? '<span style="color: #f00; text-shadow: 0 0 5px #f00; margin-left: 2px;" title="Target!">🎯</span>' : '';

        html += `
            <div class="${blinkClass}" style="display: flex; justify-content: space-between; font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; gap: 5px; color: ${p.color}; text-shadow: 0 0 5px ${p.color};">
              <span style="width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}${bullseye}</span>
              <span style="width: 65px; text-align: center;">+${pTech}%</span>
              <span style="width: 45px; text-align: center;">+${pExp}%</span>
              <span style="min-width: 40px; text-align: right;">${capacityPercent}%</span>
            </div>
          `;
      });
      leaderboardContent.innerHTML = html;
    }

    if (!serverState.isRunning && gameUI.classList.contains('hidden') === false) {
      gameUI.classList.add('hidden');
      endScreen.classList.remove('hidden');
      endTitle.textContent = serverState.gameOverMessage || 'GAME OVER';
      if (pCount > 0) {
        endTitle.style.color = '#0ff';
        endTitle.style.textShadow = '0 0 10px #0ff, 0 0 20px #0ff';
      } else {
        endTitle.style.color = '#f0f';
        endTitle.style.textShadow = '0 0 10px #f0f, 0 0 20px #f0f';
      }
    }
  }

  function getPlanetAt(x, y) {
    if (!serverState) return null;
    const pos = getMouseServerPos(x, y);

    let bestPlanet = null;
    let bestSurfaceDist = Infinity;
    for (const planet of serverState.planets) {
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

  function handlePointerDown(x, y, isShift = false, isTouch = false, button = 0) {
    if (!serverState || !localPlayer) return;


    let clickedShip = null;
    if (serverState && serverState.ships) {
      const pos = getMouseServerPos(x, y);
      for (const ship of serverState.ships) {
        if (!ship.active || ship.ownerId !== localPlayer.id) continue;
        const maxSpread = Math.min(60, 10 + Math.sqrt(ship.count || 1) * 2.5);
        const hitRadius = ship.count > 1 ? maxSpread + 10 : 25;
        const sdx = ship.x - pos.x;
        const sdy = ship.y - pos.y;
        if (sdx * sdx + sdy * sdy < hitRadius * hitRadius) {
          if (!clickedShip || (!clickedShip.isCruiser && ship.isCruiser)) {
            clickedShip = ship;
          }
        }
      }
    }

    let clickedPlanet = null;
    if (!(clickedShip && clickedShip.isCruiser)) {
      clickedPlanet = getPlanetAt(x, y);
    }

    if (button === 2) {
      // RIGHT CLICK: Issue Orders
      if (clickedPlanet) {
        if (selectedPlanets.length > 0 || selectedShips.length > 0) {
          let currentFillNeeded = Infinity;
          if (fillModeNext) {
            if (clickedPlanet.ownerId === localPlayer.id) {
              currentFillNeeded = Math.ceil(Math.max(0, clickedPlanet.maxShips - clickedPlanet.ships));
            } else {
              currentFillNeeded = Math.ceil(Math.max(0, clickedPlanet.ships + 5));
            }
            fillModeNext = false;
          }

          if (selectedShips.length > 0) {
            let shipIds = selectedShips.map(s => s.id);
            if (currentFillNeeded !== Infinity) {
              const tosend = Math.min(shipIds.length, currentFillNeeded);
              shipIds = shipIds.slice(0, tosend);
              currentFillNeeded -= tosend;
            }
            if (shipIds.length > 0) {
              if (scoutModeNext) {
                const scoutCount = Math.max(3, Math.ceil(shipIds.length * 0.1));
                shipIds = shipIds.slice(0, scoutCount);
              }
              socket.emit('moveShipsToPlanet', { shipIds, targetId: clickedPlanet.id, isWarp: warpOrderNext, speedModifier: speedModifierNext });
            }
          }

          if (selectedPlanets.length > 0) {
            selectedPlanets.forEach(sourcePlanet => {
              if (currentFillNeeded === 0) return;
              const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
              let launchCost = myPlayer ? 10 + (myPlayer.planetCount || 0) : 10;
              if (myPlayer) {
                const techBonus = Math.floor(Math.sqrt(myPlayer.techScore || 0));
                launchCost = Math.max(0, launchCost - techBonus);
              }
              if (sourcePlanet.ships >= launchCost + 1) {
                let fillAmount = null;
                if (currentFillNeeded !== Infinity) {
                  fillAmount = currentFillNeeded;
                }
                socket.emit('sendShips', { sourceId: sourcePlanet.id, targetId: clickedPlanet.id, isWarp: warpOrderNext, speedModifier: speedModifierNext, isBombing: bombOrderNext, fillAmount, scoutMode: scoutModeNext, isInterceptor: interceptorOrderNext, isCruiser: cruiserOrderNext });
                if (currentFillNeeded !== Infinity) {
                  const sent = Math.min(Math.floor(sourcePlanet.ships - launchCost), currentFillNeeded);
                  currentFillNeeded = Math.max(0, currentFillNeeded - sent);
                }
                floatingAnimations.push({
                  x: sourcePlanet.x,
                  y: sourcePlanet.y,
                  text: `-${launchCost}`,
                  type: 'launchCost',
                  age: 0,
                  duration: 0.75
                });
              }
            });
          }
        }
      } else {
        // Send to space coords
        if (selectedPlanets.length > 0 || selectedShips.length > 0) {
          const targetPos = getMouseServerPos(x, y);
          
          if (selectedShips.length > 0) {
            let shipIds = selectedShips.map(s => s.id);
            if (scoutModeNext) {
              const scoutCount = Math.max(3, Math.ceil(shipIds.length * 0.1));
              shipIds = shipIds.slice(0, scoutCount);
            }
            socket.emit('moveShipsToSpace', { shipIds, targetX: targetPos.x, targetY: targetPos.y, isWarp: warpOrderNext, speedModifier: speedModifierNext });
          }

          if (selectedPlanets.length > 0) {
            selectedPlanets.forEach(sourcePlanet => {
              const myPlayer = serverState.players.find(p => p.id === localPlayer.id);
              let launchCost = myPlayer ? 10 + (myPlayer.planetCount || 0) : 10;
              if (myPlayer) {
                const techBonus = Math.floor(Math.sqrt(myPlayer.techScore || 0));
                launchCost = Math.max(0, launchCost - techBonus);
              }
              if (sourcePlanet.ships >= launchCost + 1) {
                socket.emit('sendShipsToSpace', { sourceId: sourcePlanet.id, targetX: targetPos.x, targetY: targetPos.y, isWarp: warpOrderNext, speedModifier: speedModifierNext, isBombing: bombOrderNext, scoutMode: scoutModeNext, isInterceptor: interceptorOrderNext, isCruiser: cruiserOrderNext });
                floatingAnimations.push({
                  x: sourcePlanet.x,
                  y: sourcePlanet.y,
                  text: `-${launchCost}`,
                  type: 'launchCost',
                  age: 0,
                  duration: 0.75
                });
              }
            });
          }
        }
      }
      
      // Reset modifier flags after an order
      scoutModeNext = false;
      interceptorOrderNext = false;
      cruiserOrderNext = false;
      bombOrderNext = false;
      warpOrderNext = false;
      speedModifierNext = null;
      return;
    }

    // LEFT CLICK: Select / Lasso
    if (button === 0) {
      if (clickedPlanet) {
        if (clickedPlanet.ownerId === localPlayer.id) {
          const isAlreadyselected = selectedPlanets.some(p => p.id === clickedPlanet.id);
          if (isAlreadyselected) {
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
          // Clicked an enemy planet with left click
          if (!isShift) {
            selectedPlanets = [];
            selectedShips = [];
          }
        }
      } else if (clickedShip && clickedShip.ownerId === localPlayer.id) {
        if (clickedShip.isCruiser) {
          // Cruiser: toggle individual selection
          const isAlreadyselected = selectedShips.some(s => s.id === clickedShip.id);
          if (isAlreadyselected) {
            selectedShips = selectedShips.filter(s => s.id !== clickedShip.id);
          } else {
            if (isShift) {
              selectedShips.push(clickedShip);
            } else {
              selectedShips = [clickedShip];
              selectedPlanets = [];
            }
          }
        } else {
          // Non-cruiser: select all friendly non-cruiser ships within 100px
          const nearbyShips = serverState.ships.filter(s => {
            if (!s.active || s.ownerId !== localPlayer.id) return false;
            if (s.isCruiser) return false;
            const sdx = s.x - clickedShip.x;
            const sdy = s.y - clickedShip.y;
            return sdx * sdx + sdy * sdy <= 100 * 100;
          });
          if (isShift) {
            for (const s of nearbyShips) {
              if (!selectedShips.some(sel => sel.id === s.id)) {
                selectedShips.push(s);
              }
            }
          } else {
            selectedShips = nearbyShips;
            selectedPlanets = [];
          }
        }
      } else {
        // Clicked empty space
        if (!isShift) {
          selectedPlanets = [];
          selectedShips = [];
        }
        isDraggingCamera = true; // Signals the mousedown handler to start the lasso
      }
    }
  }

  function handlePointerMove(x, y) {
    const serverPos = getMouseServerPos(x, y);
    hoveredPlanet = getPlanetAt(x, y);

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

    // Cruiser hover overrides planet hover
    if (hoveredShip && hoveredShip.isCruiser) {
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
    cameraZoom = Math.max(0.2, Math.min(cameraZoom, 5.0));

    const newServerPos = getMouseServerPos(mouseX, mouseY);
    cameraPanX += (newServerPos.x - oldServerPos.x);
    cameraPanY += (newServerPos.y - oldServerPos.y);
  }, { passive: false });

  let lastMouseEmitTime = 0;

  canvas.addEventListener('mousemove', (event) => {
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
    handlePointerMove(cPos.x, cPos.y);

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

      // Update hover tooltip immediately on touch down!
      const cPos = getCanvasPos(tx, ty);
      handlePointerMove(cPos.x, cPos.y);

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
      cameraZoom = Math.max(0.2, Math.min(targetZoom, 5.0));

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
        handlePointerMove(cPos.x, cPos.y);
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
      handlePointerDown(cPos.x, cPos.y, event.shiftKey, true, 0);
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
  window.addEventListener('keydown', (event) => {
    if (document.activeElement === document.getElementById('chat-input')) {
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Pause') {
      event.preventDefault();
      socket.emit('togglePause');
    }
    if (event.key.toLowerCase() === 'w') {
      warpOrderNext = !warpOrderNext;
    }
    if (event.key.toLowerCase() === 'b') {
      bombOrderNext = bombOrderNext === 'eco' ? false : 'eco';
    }
    if (event.key.toLowerCase() === 'q') {
      bombOrderNext = bombOrderNext === 'ships' ? false : 'ships';
    }
    if (event.key.toLowerCase() === 'f') {
      fillModeNext = !fillModeNext;
    }
    if (event.key.toLowerCase() === 'l') {
      scoreBoard.classList.toggle('hidden');
    }
    if (event.key.toLowerCase() === 's') {
      scoutModeNext = !scoutModeNext;
    }
    if (event.key.toLowerCase() === 'i') {
      interceptorOrderNext = !interceptorOrderNext;
    }
    if (event.key.toLowerCase() === 'c') {
      cruiserOrderNext = !cruiserOrderNext;
    }
    if (event.key === '1') speedModifierNext = speedModifierNext === 0.25 ? null : 0.25;
    if (event.key === '2') speedModifierNext = speedModifierNext === 0.50 ? null : 0.50;
    if (event.key === '3') speedModifierNext = speedModifierNext === 1.0 ? null : 1.0;
    if (event.key === '4' || event.key === '0') speedModifierNext = speedModifierNext === 1.0 ? null : 1.0;

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
      cameraZoom = Math.max(0.2, Math.min(cameraZoom, 5.0));

      const newServerPos = getMouseServerPos(mouseX, mouseY);
      cameraPanX += (newServerPos.x - oldServerPos.x);
      cameraPanY += (newServerPos.y - oldServerPos.y);
    }
  });
  document.getElementById('btn-warp').addEventListener('click', () => { warpOrderNext = !warpOrderNext; });
  document.getElementById('btn-bomb').addEventListener('click', () => { bombOrderNext = bombOrderNext === 'eco' ? false : 'eco'; });
  document.getElementById('btn-bomb-ships').addEventListener('click', () => { bombOrderNext = bombOrderNext === 'ships' ? false : 'ships'; });
  document.getElementById('btn-fill').addEventListener('click', () => { fillModeNext = !fillModeNext; });
  document.getElementById('btn-scout').addEventListener('click', () => { scoutModeNext = !scoutModeNext; });
  document.getElementById('btn-interceptor').addEventListener('click', () => { interceptorOrderNext = !interceptorOrderNext; });
  document.getElementById('btn-cruiser').addEventListener('click', () => { cruiserOrderNext = !cruiserOrderNext; });
  document.getElementById('btn-speed-1').addEventListener('click', () => { speedModifierNext = speedModifierNext === 0.25 ? null : 0.25; });
  document.getElementById('btn-speed-2').addEventListener('click', () => { speedModifierNext = speedModifierNext === 0.50 ? null : 0.50; });
  const btnSpd3 = document.getElementById('btn-speed-3'); if (btnSpd3) btnSpd3.addEventListener('click', () => { speedModifierNext = speedModifierNext === 1.0 ? null : 1.0; });

  function updateButtonHighlights() {
    const toggle = (id, active) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('action-btn-active', !!active);
    };
    toggle('btn-speed-1', speedModifierNext === 0.25);
    toggle('btn-speed-2', speedModifierNext === 0.50);
    toggle('btn-speed-3', speedModifierNext === 1.0);
    toggle('btn-warp', warpOrderNext);
    toggle('btn-bomb', bombOrderNext === 'eco');
    toggle('btn-bomb-ships', bombOrderNext === 'ships');
    toggle('btn-fill', fillModeNext);
    toggle('btn-scout', scoutModeNext);
    toggle('btn-interceptor', interceptorOrderNext);
    toggle('btn-cruiser', cruiserOrderNext);
  }


  startBtn.addEventListener('click', () => {
    console.log('startBtn clicked!');
    startScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    const fogOfWar = document.getElementById('fog-of-war-checkbox').checked;
    const smallEmpires = document.getElementById('small-empires-checkbox').checked;
    const noRampagers = document.getElementById('no-rampagers-checkbox').checked;
    const aiCount = parseInt(document.getElementById('ai-count-input').value, 10);
    const productionMultiple = parseFloat(document.getElementById('production-multiple-input').value) || 1.0;
    const mapSize = parseInt(document.getElementById('map-size-input').value, 10) || 1600;
    const planetCount = parseInt(document.getElementById('planet-count-input').value, 10) || 50;
    const hazardMultiple = parseFloat(document.getElementById('hazard-multiple-input').value);
    const hm = isNaN(hazardMultiple) ? 1.0 : hazardMultiple;
    const payload = { fogOfWar, smallEmpires, noRampagers, aiCount: isNaN(aiCount) ? 5 : aiCount, productionMultiple, mapSize, planetCount, hazardMultiple: hm };

    if (startBtn.textContent === 'START GAME') {
      hasCenteredOnHomeworld = false;
      serverState = null; // Clear old state so we don't draw it while waiting for the new one
      socket.emit('restartGame', payload);
    } else {
      socket.emit('enterGame', payload);
    }
  });

  restartBtn.addEventListener('click', () => {
    console.log('startBtn clicked!');
    endScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    if (serverState) serverState.isRunning = true;
    const fogOfWar = document.getElementById('fog-of-war-checkbox').checked;
    const smallEmpires = document.getElementById('small-empires-checkbox').checked;
    const noRampagers = document.getElementById('no-rampagers-checkbox').checked;
    const aiCount = parseInt(document.getElementById('ai-count-input').value, 10);
    const productionMultiple = parseFloat(document.getElementById('production-multiple-input').value) || 1.0;
    const mapSize = parseInt(document.getElementById('map-size-input').value, 10) || 1600;
    const planetCount = parseInt(document.getElementById('planet-count-input').value, 10) || 50;
    const hazardMultiple = parseFloat(document.getElementById('hazard-multiple-input').value);
    const hm = isNaN(hazardMultiple) ? 1.0 : hazardMultiple;
    hasCenteredOnHomeworld = false;
    serverState = null;
    socket.emit('restartGame', { fogOfWar, smallEmpires, noRampagers, aiCount: isNaN(aiCount) ? 5 : aiCount, productionMultiple, mapSize, planetCount, hazardMultiple: hm });
  });

  function draw() {
    if (keysDown['ArrowUp']) cameraPanY += 40 / cameraZoom;
    if (keysDown['ArrowDown']) cameraPanY -= 40 / cameraZoom;
    if (keysDown['ArrowLeft']) cameraPanX += 40 / cameraZoom;
    if (keysDown['ArrowRight']) cameraPanX -= 40 / cameraZoom;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic button visibility
    const btnBomb = document.getElementById('btn-bomb');
    const btnBombShips = document.getElementById('btn-bomb-ships');
    const btnCruiser = document.getElementById('btn-cruiser');
    const hasMilitary = selectedPlanets.some(p => p.isMilitary);
    const hasCruiserBase = selectedPlanets.some(p => p.isMilitary || p.homeworldOf);
    if (btnBomb) btnBomb.style.display = hasMilitary ? 'inline-flex' : 'none';
    if (btnBombShips) btnBombShips.style.display = hasMilitary ? 'inline-flex' : 'none';
    if (btnCruiser) btnCruiser.style.display = hasCruiserBase ? 'inline-flex' : 'none';

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

      const hazardSensorReductionPct = (x, y, ownerId) => {
        let penaltyPct = 0;
        if (!serverState.storms) return 1;
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

      if (serverState.fleets) {

        for (const f of serverState.fleets) {
          const owner = serverState.players.find(pl => pl.id === f.ownerId);
          if (owner) {
            const pct = hazardSensorReductionPct(f.x, f.y, f.ownerId);
            const drawRadius = Math.max(10, f.radarRange * pct);
            ctx.beginPath();
            ctx.arc(f.x, f.y, drawRadius, 0, Math.PI * 2);
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
          }
        }
      }

      for (const p of serverState.planets) {
        const owner = serverState.players.find(pl => pl.id === p.ownerId);
        const isSelected = selectedPlanets.some(sp => sp.id === p.id);

        if (owner) {
          const techBonus = 0.01 * Math.sqrt(owner.techScore || 0);
          const expBonus = 0.005 * Math.sqrt(owner.expScore || 0);
          const gravityRadius = (p.maxShips * 1.5) * (1 + techBonus + expBonus);
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
        }

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

        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
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

        ctx.shadowBlur = 0;

        if (!p.inFog || p.permanentlyTracked) {
          const text = `${Math.floor(p.ships)} / ${p.maxShips}`;
          ctx.font = `bold 12px Orbitron`;
          const textWidth = ctx.measureText(text).width;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          const pillHeight = 16;
          ctx.fillRect(p.x - textWidth / 2 - 8, p.y - pillHeight / 2, textWidth + 16, pillHeight);

          ctx.fillStyle = '#000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, p.x, p.y);

          ctx.fillStyle = '#000';
          ctx.font = 'bold 11px Orbitron';
          const pName = p.name || 'Unknown';
          ctx.fillText(pName, p.x, p.y - pillHeight / 2 - 8);

          if (p.homeworldOf) {
            const hwOwner = serverState.players.find(pl => pl.id === p.homeworldOf);
            if (hwOwner) {
              ctx.fillStyle = hwOwner.color;
              ctx.font = 'bold 12px Orbitron';
              ctx.textAlign = 'center';
              ctx.fillText(`👑 ${hwOwner.name}`, p.x, p.y - p.radius - 8);
              ctx.font = 'bold 11px Orbitron'; // Restore font
            }
          } else if (p.isResearch) {
            ctx.fillStyle = owner ? owner.color : '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("🔬", p.x, p.y - p.radius - 8);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          } else if (p.isMilitary) {
            ctx.fillStyle = owner ? owner.color : '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("🚀", p.x, p.y - p.radius - 8);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          } else if (false) {
            ctx.fillStyle = owner ? owner.color : '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🛸', p.x, p.y - p.radius - 8);
            ctx.font = 'bold 11px Orbitron';
          } else if (p.isSpeedPlanet) {
            ctx.fillStyle = owner ? owner.color : '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("⚡", p.x, p.y - p.radius - 8);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          } else if (false) {
            ctx.fillStyle = owner ? owner.color : '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("🔺", p.x, p.y - p.radius - 8);
            ctx.font = 'bold 11px Orbitron'; // Restore font
          }



          if (owner) {
            if (p.ships < 50) {
              const lowPopMultiplier = 0.10 + 0.02 * Math.max(0, p.ships - 5);
              const prodPercent = Math.round(lowPopMultiplier * 100);
              ctx.fillStyle = '#ffaa00';
              ctx.fillText(`${prodPercent}%`, p.x, p.y + pillHeight / 2 + 8);
            } else if (p.expScore > 0) {
              const xpPercent = (0.5 * Math.sqrt(p.expScore)).toFixed(1);
              ctx.fillStyle = '#66ccff';
              ctx.fillText(`${xpPercent}%`, p.x, p.y + pillHeight / 2 + 8);
            }
          } else if (p.expScore > 0) {
            const xpPercent = (0.5 * Math.sqrt(p.expScore)).toFixed(1);
            ctx.fillStyle = '#66ccff';
            ctx.fillText(`${xpPercent}%`, p.x, p.y + pillHeight / 2 + 8);
          }
          let defenderPlanetPenalty = 0;
          let defenderTechPenalty = 0;
          let defenderExpPenalty = 0;

          if (owner) {
            defenderTechPenalty = 0.01 * Math.sqrt(owner.techScore || 0);
            defenderExpPenalty = 0.005 * Math.sqrt(owner.expScore || 0);

            let defenderCumulativeCapacity = 0;
            for (const gp of serverState.planets) {
              if (gp.id === p.id || gp.ownerId !== p.ownerId) continue;
              const techBonus = 0.01 * Math.sqrt(owner.techScore || 0);
              const expBonus = 0.005 * Math.sqrt(owner.expScore || 0);
              const gravityRadius = (gp.maxShips * 1.5) * (1 + techBonus + expBonus);
              const pct = hazardSensorReductionPct(gp.x, gp.y, gp.ownerId);
              const effGravity = Math.max(10, gravityRadius * pct);

              const pdx = gp.x - p.x;
              const pdy = gp.y - p.y;
              if (pdx * pdx + pdy * pdy <= effGravity * effGravity) {
                defenderCumulativeCapacity += gp.maxShips;
              }
            }
            defenderPlanetPenalty = 0.01 * Math.floor(defenderCumulativeCapacity / 50);
          }

          let friendlyPlanetBoost = 0;
          if (localPlayer) {
            let friendlyCumulativeCapacity = 0;
            for (const gp of serverState.planets) {
              if (gp.id === p.id || gp.ownerId !== localPlayer.id) continue;
              const techBonus = 0.01 * Math.sqrt(localPlayer.techScore || 0);
              const expBonus = 0.005 * Math.sqrt(localPlayer.expScore || 0);
              const gravityRadius = (gp.maxShips * 1.5) * (1 + techBonus + expBonus);
              const pct = hazardSensorReductionPct(gp.x, gp.y, gp.ownerId);
              const effGravity = Math.max(10, gravityRadius * pct);

              const pdx = gp.x - p.x;
              const pdy = gp.y - p.y;
              if (pdx * pdx + pdy * pdy <= effGravity * effGravity) {
                friendlyCumulativeCapacity += gp.maxShips;
              }
            }
            friendlyPlanetBoost = 0.01 * Math.floor(friendlyCumulativeCapacity / 50);
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
              const attackerExpBonus = 0.005 * Math.sqrt(localPlayer.expScore || 0);

              let maxShipExp = 0;
              for (const s of selectedShips) {
                if (s.expScore > maxShipExp) maxShipExp = s.expScore;
              }
              for (const sp of selectedPlanets) {
                const effectiveExp = sp.expScore || 0;
                if (effectiveExp > maxShipExp) maxShipExp = effectiveExp;
              }
              const attackerLocalExpBonus = 0.005 * Math.sqrt(maxShipExp || 0);
              const defenderLocalExpPenalty = 0.005 * Math.sqrt(p.expScore || 0);

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
                    const knowledge = storm.knowledge || 0;
                    const tRed = Math.sqrt(localPlayer.techScore || 0);
                    const eRed = Math.sqrt(localPlayer.expScore || 0);
                    const sRed = Math.sqrt(maxShipExp || 0);
                    const eff = Math.max(0, storm.intensity - knowledge - (tRed + eRed) / 2 - sRed);
                    hazardPenalty += (eff / 2) / 100;
                  }
                }
              }

              const minKillChance = attackerTechBonus + attackerExpBonus + attackerLocalExpBonus;
              const estimatedKillChance = Math.max(minKillChance, baseKillChance - defenderLocalExpPenalty + attackerFleetPenalty + attackerTechBonus + attackerExpBonus + attackerLocalExpBonus + attackerHomeworldBonus - lastStandPenalty - defenderHomeworldPenalty - hazardPenalty - humanDefenderBonus);
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
      }

      // Defense tooltip on hovered planet
      if (hoveredPlanet && serverState.planets) {
        const hp = serverState.planets.find(pp => pp.id === hoveredPlanet.id);
        if (hp) {
          const hpOwner = hp.ownerId ? serverState.players.find(pl => pl.id === hp.ownerId) : null;
          const lines = [];
          let totalDefense = 0;

          // Planet name and type
          let nameLabel = hp.name || 'Unknown';
          if (hp.homeworldOf) {
            const hwOwner = serverState.players.find(pl => pl.id === hp.homeworldOf);
            if (hwOwner) nameLabel += ` (👑 ${hwOwner.name})`;
          }
          if (hp.isResearch) nameLabel += ' 🔬';
          if (hp.isMilitary) nameLabel += ' 🚀';
          
          if (hp.isSpeedPlanet) nameLabel += ' ⚡';
          
          lines.push({ label: nameLabel, value: '', color: '#0ff', isHeader: true });

          // Garrison
          const garrisonPenalty = Math.floor(hp.ships / 5);
          if (garrisonPenalty > 0) {
            totalDefense += garrisonPenalty;
            lines.push({ label: 'Garrison Defense', value: `${garrisonPenalty}%`, color: '#4f4' });
          }

          if (hpOwner) {
            const techDef = Math.round(Math.sqrt(hpOwner.techScore || 0) * 100) / 100;
            if (techDef > 0) {
              totalDefense += techDef;
              lines.push({ label: 'Tech Defense', value: `${techDef.toFixed(1)}%`, color: '#4f4' });
            }
            const expDef = Math.round(0.5 * Math.sqrt(hpOwner.expScore || 0) * 100) / 100;
            if (expDef > 0) {
              totalDefense += expDef;
              lines.push({ label: 'Exp Defense', value: `${expDef.toFixed(1)}%`, color: '#4f4' });
            }
            const planetExp = Math.round(0.5 * Math.sqrt(hp.expScore || 0) * 100) / 100;
            if (planetExp > 0) {
              totalDefense += planetExp;
              lines.push({ label: 'Planet Exp', value: `${planetExp.toFixed(1)}%`, color: '#4f4' });
            }

            let defCap = 0;
            for (const gp of serverState.planets) {
              if (gp.id === hp.id || gp.ownerId !== hp.ownerId) continue;
              const tb = 0.01 * Math.sqrt(hpOwner.techScore || 0);
              const eb = 0.005 * Math.sqrt(hpOwner.expScore || 0);
              const gr = (gp.maxShips * 1.5) * (1 + tb + eb);
              const pdx = gp.x - hp.x, pdy = gp.y - hp.y;
              if (pdx * pdx + pdy * pdy <= gr * gr) defCap += gp.maxShips;
            }
            const gravBonus = Math.floor(defCap / 50);
            if (gravBonus > 0) {
              totalDefense += gravBonus;
              lines.push({ label: 'Gravity Field', value: `${gravBonus}%`, color: '#4f4' });
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
          } else {
            lines.push({ label: 'Neutral', value: 'No defense bonuses', color: '#888' });
          }

          lines[0].value = totalDefense > 0 ? `🛡️ ${Math.round(totalDefense * 10) / 10}%` : '';

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

          ctx.save();
          const tooltipFont = '11px Orbitron';
          const headerFont = 'bold 12px Orbitron';

          const padding = 10;
          const lineHeight = 18;
          const headerHeight = 22;
          let maxWidth = 0;
          for (const line of lines) {
            ctx.font = line.isHeader ? headerFont : tooltipFont;
            const w = ctx.measureText(line.label + '  ' + line.value).width;
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
            ctx.font = line.isHeader ? headerFont : tooltipFont;
            ctx.fillStyle = line.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(line.label, tooltipX + padding, curY);
            if (line.value) {
              ctx.textAlign = 'right';
              ctx.fillText(line.value, tooltipX + tooltipW - padding, curY);
            }
            curY += lh;
          }
          ctx.restore();
        }
      }

      // Fleet tooltip on hovered ship
      if (hoveredShip && !hoveredPlanet && serverState) {
        const hs = hoveredShip;
        const hsOwner = hs.ownerId ? serverState.players.find(pl => pl.id === hs.ownerId) : null;
        if (hsOwner) {
          const lines = [];
          let totalAttackMod = 0;

          if (hs.isAmoeba) {
            lines.push({ label: 'Giant Space Amoeba', value: '', color: '#0f0', isHeader: true });
            const currentTotalHealth = Math.floor(hs.health) + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
            const maxTotalHealth = hs.maxHealth + (hs.maxHealth * (hs.maxHealth - 1)) / 2;
            lines.push({ label: 'Health', value: currentTotalHealth + ' / ' + maxTotalHealth, color: '#fff' });
            lines.push({ label: 'Bomb Sacs', value: Math.floor(hs.bombs || 0) + ' / ' + hs.maxHealth, color: '#ff0' });
            if (hs.isHungry) {
              lines.push({ label: 'Status', value: 'Hungry (will grow)', color: '#f66' });
            } else {
              lines.push({ label: 'Status', value: 'Digesting', color: '#4f4' });
            }
            lines.push({ label: 'Attack Range', value: (50 + (hs.bombs ? hs.bombs * 5 : 0)) + 'px', color: '#f88' });
            const techBonus = Math.sqrt(hsOwner.techScore || 0);
            const expBonus = 0.5 * Math.sqrt(hsOwner.expScore || 0);
            const shipExpBonus = 0.5 * Math.sqrt(hs.expScore || 0);
            const bombBonus = (hs.bombs && hs.bombs > 0) ? (hs.bombs * 3) : 0;
            const amoebaHitChance = Math.min(100, 10 + techBonus + expBonus + shipExpBonus + hs.maxHealth * 5 + bombBonus).toFixed(1) + '%';
            lines.push({ label: 'Accuracy', value: amoebaHitChance, color: '#f88' });
            const shrugChance = Math.min(90, Math.floor(50 + hs.maxHealth * 3 + (techBonus + expBonus + shipExpBonus) * 2));
            lines.push({ label: 'Armor Deflection', value: shrugChance + '%', color: '#ccc' });
          } else if (hs.isCruiser) {
            lines.push({ label: hsOwner.name + ' Cruiser', value: '', color: hsOwner.color || '#0ff', isHeader: true });
            let shipClass = "Titan";
            if (hs.maxHealth < 20) shipClass = "Scout Ship";
            else if (hs.maxHealth < 25) shipClass = "Frigate";
            else if (hs.maxHealth < 30) shipClass = "Destroyer";
            else if (hs.maxHealth <= 35) shipClass = "Cruiser";
            else if (hs.maxHealth <= 45) shipClass = "Battleship";
            lines.push({ label: 'Ship Class', value: shipClass, color: '#aaf' });
            lines.push({ label: 'Hull Integrity', value: Math.floor(hs.health) + ' / ' + hs.maxHealth, color: '#fff' });
            const maxBombs = Math.floor(hs.maxHealth / 5);
            let munitionsDisplay = Math.floor(hs.bombs || 0) + ' / ' + maxBombs;
            lines.push({ label: 'Munitions', value: munitionsDisplay, color: '#ffa' });
            lines.push({ label: 'Fuel Level', value: Math.floor(hs.fuel || 0) + ' / ' + Math.floor(hs.maxHealth / 5), color: (hs.fuel <= 0 ? '#f00' : '#ffa500') });
            const rawTech = hsOwner.techScore || 0;
            const rawExp = hsOwner.expScore || 0;
            const shipExp = hs.expScore || 0;

            const techBonus = Math.sqrt(rawTech);
            const expBonus = 0.5 * Math.sqrt(rawExp);
            const shipExpBonus = 0.5 * Math.sqrt(shipExp);

            let shrugChance = Math.min(75, Math.floor(hs.maxHealth + (techBonus + expBonus + shipExpBonus)));
            if ((hs.bombs || 0) < 1) {
              shrugChance = Math.floor(shrugChance / 2);
            }
            lines.push({ label: 'Armor Deflection', value: shrugChance + '%', color: '#ccc' });

            const laserTechBonus = techBonus * 0.01;
            const xpRangeBonus = (expBonus + shipExpBonus) * 0.10;
            const baseDogfightRange = 40 * (1 + laserTechBonus + xpRangeBonus);
            let effectiveRange = baseDogfightRange * 1.10;
            if (hs.bombs > 0) {
              effectiveRange += baseDogfightRange * 0.10;
            }
            effectiveRange = Math.floor(effectiveRange);
            const healthBonus = Math.floor(hs.health);

            let hitChanceValue = 10;
            if (hs.bombs > 0) hitChanceValue += 10;
            hitChanceValue += techBonus + expBonus + shipExpBonus;
            const hitChance = Math.min(100, hitChanceValue * 2).toFixed(1) + '%';

            const volleySize = Math.max(1, Math.floor((hs.maxHealth + hs.health) / 6));
            lines.push({ label: 'Range', value: effectiveRange, color: '#f88' });
            lines.push({ label: 'Accuracy (Hit Chance)', value: hitChance, color: '#f88' });
            lines.push({ label: 'Volley Size', value: volleySize, color: '#ffa' });

            let friendlyCap = 0;
            if (serverState.planets) {
              for (const gp of serverState.planets) {
                if (gp.ownerId !== hs.ownerId) continue;
                const tb = 0.01 * Math.sqrt(hsOwner.techScore || 0);
                const eb = 0.005 * Math.sqrt(hsOwner.expScore || 0);
                const gr = (gp.maxShips * 1.5) * (1 + tb + eb);
                const pdx = gp.x - hs.x, pdy = gp.y - hs.y;
                if (pdx * pdx + pdy * pdy <= gr * gr) friendlyCap += gp.maxShips;
              }
            }
            if (friendlyCap > 0) {
              lines.push({ label: 'Regeneration', value: 'Active (2 HP/min)', color: '#4f4' });
              if (hs.isWarp) {
                lines.push({ label: 'Refueling', value: 'Offline (In Warp)', color: '#888' });
              } else {
                lines.push({ label: 'Refueling', value: 'Active (6/min)', color: '#4f4' });
              }
            } else {
              lines.push({ label: 'Regeneration', value: 'Offline', color: '#888' });
              if (hs.isWarp) {
                lines.push({ label: 'Deep space', value: 'Consuming Fuel (2/min)', color: '#aaf' });
              } else {
                lines.push({ label: 'Deep space', value: 'Consuming Fuel (1/min)', color: '#aaf' });
              }
            }
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
                nearbyCount++;
                if (ship.isBomber) bomberCount++;
                if ((ship.expScore || 0) > maxShipExp) maxShipExp = ship.expScore || 0;
                avgFlightTime += ship.flightTime || 0;
                flightTimeCount++;
              }
            }
            avgFlightTime /= flightTimeCount;
            const totalShips = nearbyCount + 1;

            // Header
            lines.push({ label: `${hsOwner.name}'s Fleet`, value: '', color: hsOwner.color || '#0ff', isHeader: true });

            // ship count
            const bomberLabel = bomberCount > 0 ? ` (${bomberCount + (hs.isBomber ? 1 : 0)} bombers)` : '';
            lines.push({ label: 'ships in range', value: `${totalShips}${bomberLabel}`, color: '#ccc' });

            // swarm bonus
            const swarmBonus = Math.floor(nearbyCount / 10);
            if (swarmBonus > 0) {
              totalAttackMod += swarmBonus;
              lines.push({ label: 'swarm Bonus', value: `${swarmBonus}%`, color: '#4f4' });
            }

            // Tech attack bonus
            const techAtk = Math.round(Math.sqrt(hsOwner.techScore || 0) * 100) / 100;
            if (techAtk > 0) {
              totalAttackMod += techAtk;
              lines.push({ label: 'Tech Attack', value: `${techAtk.toFixed(1)}%`, color: '#4f4' });
            }

            // Exp attack bonus
            const expAtk = Math.round(0.5 * Math.sqrt(hsOwner.expScore || 0) * 100) / 100;
            if (expAtk > 0) {
              totalAttackMod += expAtk;
              lines.push({ label: 'Exp Attack', value: `${expAtk.toFixed(1)}%`, color: '#4f4' });
            }

            // ship local exp
            const shipExp = Math.round(0.5 * Math.sqrt(maxShipExp || 0) * 100) / 100;
            if (shipExp > 0) {
              totalAttackMod += shipExp;
              lines.push({ label: 'ship Exp', value: `${shipExp.toFixed(1)}%`, color: '#4f4' });
            }

            // Friendly gravity boost (check friendly planets near hovered ship position)
            let friendlyCap = 0;
            if (serverState.planets) {
              for (const gp of serverState.planets) {
                if (gp.ownerId !== hs.ownerId) continue;
                const tb = 0.01 * Math.sqrt(hsOwner.techScore || 0);
                const eb = 0.005 * Math.sqrt(hsOwner.expScore || 0);
                const gr = (gp.maxShips * 1.5) * (1 + tb + eb);
                const pdx = gp.x - hs.x, pdy = gp.y - hs.y;
                if (pdx * pdx + pdy * pdy <= gr * gr) friendlyCap += gp.maxShips;
              }
            }
            const gravAtk = Math.floor(friendlyCap / 50);
            if (gravAtk > 0) {
              totalAttackMod += gravAtk;
              lines.push({ label: 'Gravity support', value: `${gravAtk}%`, color: '#4f4' });
            }

            // speed modifier
            const sm = hs.speedModifier || 1.0;
            if (sm < 1.0) {
              const speedLabel = sm === 0.25 ? '1/4 speed' : sm === 0.50 ? '1/2 speed' : `${Math.round(sm * 100)}% speed`;
              const saveChance = sm === 0.25 ? 90 : sm === 0.50 ? 75 : 0;
              lines.push({ label: speedLabel, value: saveChance > 0 ? `${saveChance}% save` : '', color: '#aaf' });
            }

            // Add Dogfight Hit%
            lines.push({ label: 'Dogfight Hit%', value: `${Math.round(100 + totalAttackMod * 10) / 10}%`, color: '#fff' });

            // Attrition info
            const techSafe = Math.sqrt(hsOwner.techScore || 0);
            const expSafe = 0.5 * Math.sqrt(hsOwner.expScore || 0);
            const safeTime = techSafe + expSafe;

            if (avgFlightTime > 0) {
              lines.push({ label: 'Flight Time', value: `${avgFlightTime.toFixed(1)}s`, color: '#aaa' });
            }
            if (safeTime > 0) {
              lines.push({ label: 'safe Time', value: `${safeTime.toFixed(1)}s`, color: avgFlightTime >= safeTime ? '#f66' : '#4f4' });
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
                  const eb = 0.005 * Math.sqrt(pOwner.expScore || 0);
                  const gr = (planet.maxShips * 1.5) * (1 + tb + eb);
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
          // Hazard effects
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
            const w = ctx.measureText(line.label + '  ' + line.value).width;
            if (w > maxWidth) maxWidth = w;
          }

          const tooltipW = maxWidth + padding * 2 + 10;
          const tooltipH = lines.reduce((h, l) => h + (l.isHeader ? headerHeight : lineHeight), 0) + padding * 2;

          let tooltipX = hs.x + 20;
          let tooltipY = hs.y - tooltipH / 2;

          const mapWidth = serverState.width || 1920;
          const mapHeight = serverState.height || 1620;
          if (tooltipX + tooltipW > mapWidth) tooltipX = hs.x - 20 - tooltipW;
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
            ctx.fillText(line.label, tooltipX + padding, curY);
            if (line.value) {
              ctx.textAlign = 'right';
              ctx.fillText(line.value, tooltipX + tooltipW - padding, curY);
            }
            curY += lh;
          }

          ctx.restore();
        }
      }

      function pseudoRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      }

      function getFormationOffset(formationType, i, renderCount, maxSpread) {
        let lx = 0;
        let ly = 0;
        switch (formationType) {
          case 'straight line': {
            const spacing = 5;
            const halfCount = (renderCount - 1) / 2;
            lx = 0;
            ly = (i - halfCount) * spacing;
            break;
          }
          case 'double line': {
            const spacing = 6;
            const rowSpacing = 5;
            const row = i % 2;
            const col = Math.floor(i / 2);
            const halfCol = (Math.ceil(renderCount / 2) - 1) / 2;
            lx = -row * rowSpacing;
            ly = (col - halfCol) * spacing;
            break;
          }
          case 'chevron': {
            const spacing = 5;
            const angle = Math.PI / 4;
            const side = i % 2 === 0 ? 1 : -1;
            const step = Math.floor((i + 1) / 2);
            lx = -step * spacing * Math.cos(angle);
            ly = side * step * spacing * Math.sin(angle);
            break;
          }
          case 'arrow': {
            let row = 0;
            let sum = 0;
            while (sum + row + 1 <= i) {
              sum += row + 1;
              row++;
            }
            const col = i - sum;
            const halfCol = row / 2;
            lx = -row * 5;
            ly = (col - halfCol) * 5;
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
              const radius = ring * 8;
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
              const radius = ring * 9;
              lx = radius * Math.cos(angle);
              ly = radius * Math.sin(angle);
            }
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
        const owner = serverState.players.find(pl => pl.id === s.ownerId);

        const isSelected = selectedShips.some(ss => ss.id === s.id);
        const maxSpread = Math.min(60, 10 + Math.sqrt(s.count || 1) * 2.5);

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

        ctx.fillStyle = owner ? owner.color : '#fff';
        
        if (s.count > 1 && !s.isCruiser && !s.isAmoeba) {
          const renderCount = Math.min(50, s.count);
          for (let i = 0; i < renderCount; i++) {
            const { lx, ly } = getFormationOffset(s.formation, i, renderCount, maxSpread);
            const cos = Math.cos(s.angle || 0);
            const sin = Math.sin(s.angle || 0);
            const drawX = s.x + lx * cos - ly * sin;
            const drawY = s.y + lx * sin + ly * cos;
            
            ctx.beginPath();
            if (s.isBomber) {
              let angle = 0;
              if (s.targetX !== undefined && s.targetY !== undefined) {
                angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
              }
              ctx.save();
              ctx.translate(drawX, drawY);
              ctx.rotate(angle + Math.PI / 2);
              ctx.moveTo(0, -4);
              ctx.lineTo(4, 4);
              ctx.lineTo(-4, 4);
              ctx.restore();
              ctx.closePath();
              ctx.fill();
            } else if (s.isInterceptor) {
              let angle = 0;
              if (s.targetX !== undefined && s.targetY !== undefined) {
                angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
              }
              ctx.save();
              ctx.translate(drawX, drawY);
              ctx.rotate(angle + Math.PI / 2);
              ctx.moveTo(0, -3);
              ctx.lineTo(3, 3);
              ctx.lineTo(-3, 3);
              ctx.restore();
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.arc(drawX, drawY, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          continue;
        }

        ctx.beginPath();
        if (s.isBomber) {
          let angle = 0;
          if (s.targetX !== undefined && s.targetY !== undefined) {
            angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
          }
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(angle + Math.PI / 2);
          ctx.moveTo(0, -5);
          ctx.lineTo(5, 5);
          ctx.lineTo(-5, 5);
          ctx.restore();
          ctx.closePath();
        } else if (s.isInterceptor) {
          let angle = 0;
          if (s.targetX !== undefined && s.targetY !== undefined) {
            angle = Math.atan2(s.targetY - s.y, s.targetX - s.x);
          }
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(angle + Math.PI / 2);
          ctx.moveTo(0, -3);
          ctx.lineTo(3, 3);
          ctx.lineTo(-3, 3);
          ctx.restore();
          ctx.closePath();
        } else if (s.isAmoeba) {
          const size = (6 + (s.maxHealth || 0) * 1.5);
          ctx.save();
          ctx.translate(s.x, s.y);
          const time = Date.now() / 500 + s.id;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = size + Math.sin(time + i) * (size * 0.2);
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(0, 100, 0, 0.7)";
          ctx.strokeStyle = "#0f0";
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          ctx.beginPath();
        } else if (s.isCruiser) {
          const size = ((6 + (s.maxHealth || 0) * 1.0) / 2.5);
          let angle = s.angle || 0;
          let ownerPlayer = serverState.players.find(p => p.id === s.ownerId);
          let style = ownerPlayer ? ownerPlayer.cruiserStyle : 'Klingon';

          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(angle + Math.PI / 2);
          ctx.beginPath();

          if (style === 'Federation') {
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
          } else if (style === 'Romulan') {
            ctx.moveTo(0, -size * 0.8);
            ctx.lineTo(size * 0.2, -size * 0.6);
            ctx.lineTo(size * 0.8, -size * 0.2);
            ctx.lineTo(size * 1.0, 0);
            ctx.lineTo(size * 0.7, size * 0.6);
            ctx.lineTo(size * 0.3, size * 0.1);
            ctx.lineTo(size * 0.2, size * 0.5);
            ctx.lineTo(-size * 0.2, size * 0.5);
            ctx.lineTo(-size * 0.3, size * 0.1);
            ctx.lineTo(-size * 0.7, size * 0.6);
            ctx.lineTo(-size * 1.0, 0);
            ctx.lineTo(-size * 0.8, -size * 0.2);
            ctx.lineTo(-size * 0.2, -size * 0.6);
          } else if (style === 'Gorn') {
            ctx.moveTo(-size * 0.3, -size * 0.8);
            ctx.lineTo(size * 0.3, -size * 0.8);
            ctx.lineTo(size * 0.4, -size * 0.4);
            ctx.lineTo(size * 0.8, -size * 0.2);
            ctx.lineTo(size * 0.8, size * 0.4);
            ctx.lineTo(size * 0.5, size * 0.4);
            ctx.lineTo(size * 0.5, size * 0.8);
            ctx.lineTo(size * 0.2, size * 0.8);
            ctx.lineTo(size * 0.2, size * 0.6);
            ctx.lineTo(-size * 0.2, size * 0.6);
            ctx.lineTo(-size * 0.2, size * 0.8);
            ctx.lineTo(-size * 0.5, size * 0.8);
            ctx.lineTo(-size * 0.5, size * 0.4);
            ctx.lineTo(-size * 0.8, size * 0.4);
            ctx.lineTo(-size * 0.8, -size * 0.2);
            ctx.lineTo(-size * 0.4, -size * 0.4);
          } else if (style === 'Tholian') {
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.4, -size * 0.4);
            ctx.lineTo(size * 0.9, 0);
            ctx.lineTo(size * 0.4, size * 0.4);
            ctx.lineTo(0, size);
            ctx.lineTo(-size * 0.4, size * 0.4);
            ctx.lineTo(-size * 0.9, 0);
            ctx.lineTo(-size * 0.4, -size * 0.4);
            ctx.moveTo(0, -size * 0.5);
            ctx.lineTo(-size * 0.2, 0);
            ctx.lineTo(0, size * 0.5);
            ctx.lineTo(size * 0.2, 0);
          } else if (style === 'Lyran') {
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
          
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          if (ownerPlayer) {
            const rawTech = ownerPlayer.techScore || 0;
            const rawExp = ownerPlayer.expScore || 0;
            const shipExp = s.expScore || 0;
            const techBonus = Math.sqrt(rawTech);
            const expBonus = 0.5 * Math.sqrt(rawExp);
            const shipExpBonus = 0.5 * Math.sqrt(shipExp);
            let hitChanceValue = 10;
            if (s.bombs > 0) hitChanceValue += 10;
            hitChanceValue += techBonus + expBonus + shipExpBonus;
            if (hitChanceValue * 2 >= 100) {
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
            
            const maxFuel = s.maxHealth / 5;
            if (s.fuel !== undefined && s.fuel < maxFuel) {
              currentY -= barH;
              ctx.fillStyle = '#555';
              ctx.fillRect(s.x - barW / 2, currentY, barW, barH);
              ctx.fillStyle = '#ffa500';
              ctx.fillRect(s.x - barW / 2, currentY, barW * (Math.max(0, s.fuel) / maxFuel), barH);
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
          ctx.beginPath();
        } else {
          ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      if (serverState.lasers) {
        for (const laser of serverState.lasers) {
          const progress = laser.age / laser.duration;
          if (laser.isAmoebaAttack || laser.color === 'amoeba') {
            const numParticles = 12;
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

              ctx.beginPath();
              ctx.arc(px, py, pRadius, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(0, 255, 0, ${opacity * 0.85})`;
              ctx.strokeStyle = `rgba(0, 100, 0, ${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.fill();
              ctx.stroke();
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
          } else {
            ctx.beginPath();
            ctx.moveTo(laser.startX, laser.startY);
            ctx.lineTo(laser.endX, laser.endY);
            ctx.strokeStyle = laser.color;
            ctx.globalAlpha = 1 - progress;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }
        }
      }

      if (serverState.explosions) {
        for (const exp of serverState.explosions) {
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
            ctx.fillText(`Intensity: ${storm.intensity} (${effIntensity.toFixed(1)})`, storm.x, storm.y);
          } else if (t === 'nebula') {
            ctx.fillText(`${storm.name} Nebula`, storm.x, storm.y - 8);
            ctx.font = '10px Rajdhani';
            ctx.fillText(`Intensity: ${storm.intensity} (${effIntensity.toFixed(1)})`, storm.x, storm.y + 8);
          } else {
            ctx.fillText(`Ion Storm ${storm.name}`, storm.x, storm.y - 8);
            ctx.font = '10px Rajdhani';
            ctx.fillText(`Intensity: ${storm.intensity} (${effIntensity.toFixed(1)})  speed: ${storm.speed.toFixed(1)}  Heading: ${Math.round(storm.heading)}\u00B0`, storm.x, storm.y + 8);
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
        // Hold opacity then fade out sharply at the end to "pop"
        const alpha = progress < 0.8 ? 1 : 1 - ((progress - 0.8) * 5);

        let yOffset = progress * 50; // default drift up by 50px
        if (anim.type === 'beaker') {
          yOffset = progress * 30; // ascends much slower
        } else if (anim.type === 'lightning') {
          yOffset = 0; // doesn't drift up
        } else if (anim.type === 'launchCost') {
          yOffset = -progress * 40; // floats down
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
        }

        // Grow font
        let fontsize = 8 + (progress * 8);
        if (anim.type === 'lightning') {
          fontsize = progress * 30; // grows from 0 to 30
        } else if (anim.type === 'launchCost') {
          fontsize = 6.6; // 20% larger than 5.5
        } else if (anim.type === 'colonize') {
          fontsize = 12 + (progress * 10); // grows from 12 to 22
        } else if (anim.type === 'rampage') {
          fontsize = 20 + (progress * 40); // grows huge
        } else if (anim.type === 'defeat') {
          fontsize = 16 + (progress * 30); // grows large
        } else if (anim.type === 'lastStand' || anim.type === 'homeworldAnim') {
          fontsize = 7; // constant size
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
          xOffset = progress * 20;
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
        } else {
          xOffset = Math.sin(progress * Math.PI * 3) * 8;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`;
        }

        ctx.shadowBlur = 10;
        ctx.fillText(anim.text, anim.x + xOffset, anim.y - yOffset);
        ctx.shadowBlur = 0;
      }

      if (serverState.isPaused) {
        const mapWidth = serverState ? (serverState.width || 1920) : 1920;
        const mapHeight = serverState ? (serverState.height || 1620) : 1620;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, mapWidth, mapHeight);
        ctx.fillStyle = '#fff';
        ctx.font = '40px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', mapWidth / 2, mapHeight / 2);
      }

    } finally {
      ctx.restore();
      updateButtonHighlights();
    }
  }

  // Continuous render loop — keeps the visual state in sync with the camera
  // so that click hit-testing always matches what is on screen.
  function renderLoop() {
    try {
      draw();
    } catch (e) {
      console.error('[PlanetWars] draw() error:', e);
    }
    requestAnimationFrame(renderLoop);
  }
  console.log('[PlanetWars] Starting render loop');
  requestAnimationFrame(renderLoop);
});
