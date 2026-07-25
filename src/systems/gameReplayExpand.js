/**
 * Browser-safe expansion of compact full-game replay frames into client gameState shape.
 */

function classTypeFromKind(kind) {
  switch (kind) {
    case 6: return 'corvette';
    case 7: return 'destroyer';
    case 8: return 'battlecruiser';
    case 9: return 'titan';
    case 10: return 'mammoth';
    default: return null;
  }
}

/**
 * Expand a compact replay document + frame index into a client-friendly game state.
 */
export function expandGameReplayFrame(doc, frameIndex) {
  if (!doc || !doc.frames || !doc.frames.length) return null;
  const idx = Math.max(0, Math.min(doc.frames.length - 1, frameIndex | 0));
  const frame = doc.frames[idx];
  const players = (doc.players || []).map((p, i) => {
    const score = (frame.pl || []).find(row => row[0] === i) || null;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      isAI: !!p.isAI,
      techScore: score ? score[1] : 0,
      expScore: score ? score[2] : 0,
      happinessScore: score ? score[3] : 0,
      credits: score ? score[4] : 0,
      resources: {},
      atWarWith: {},
      isAlive: true
    };
  });
  const playerByIdx = (oi) => {
    if (oi == null || oi < 0 || oi >= players.length) return null;
    return players[oi];
  };

  const planets = [];
  const base = doc.planetBase || {};
  for (const row of (frame.P || [])) {
    const [id, oi, ships, maxShips, flags] = row;
    const b = base[id] || base[String(id)] || {};
    const owner = playerByIdx(oi);
    planets.push({
      id,
      x: b.x || 0,
      y: b.y || 0,
      radius: b.r || 20,
      name: b.n || '',
      habitability: b.h || 0,
      minerals: b.m || 4,
      sizeClass: b.sc || 0,
      ownerId: owner ? owner.id : null,
      ships: ships || 0,
      maxShips: maxShips || 0,
      isHomeworld: !!(flags & 1),
      dead: !!(flags & 2),
      isResearch: !!(flags & 4),
      isMilitary: !!(flags & 8),
      inRevolt: !!(flags & 16),
      rampageEvent: !!(flags & 32),
      inFog: false
    });
  }

  const ships = [];
  const flatShips = [];
  for (const c of (frame.C || [])) {
    const [id, x, y, oi, kind, ang, health, maxHealth, name, classType, armorPts, shieldPts, cruiserStyle] = c;
    const owner = playerByIdx(oi);
    const isAmoeba = kind === 11 || kind === 12;
    ships.push({
      id,
      x,
      y,
      angle: ang || 0,
      ownerId: owner ? owner.id : null,
      active: true,
      isCruiser: !isAmoeba,
      isAmoeba,
      isGoldenAmoeba: kind === 12,
      name: name || '',
      classType: classType || classTypeFromKind(kind) || 'corvette',
      health: health || 0,
      maxHealth: maxHealth || 0,
      armorPoints: armorPts || 0,
      shieldPoints: shieldPts || 0,
      cruiserStyle: cruiserStyle || null,
      count: 1
    });
  }
  const S = frame.S || [];
  for (let i = 0; i < S.length; i += 7) {
    const id = S[i];
    const x = S[i + 1];
    const y = S[i + 2];
    const oi = S[i + 3];
    const kind = S[i + 4];
    const ang = S[i + 5];
    const count = S[i + 6];
    flatShips.push(
      id, x, y, count || 1, oi, 1,
      kind === 1 ? 1 : 0,
      kind === 2 ? 1 : 0,
      kind === 3 ? 1 : 0,
      kind === 4 ? 1 : 0,
      ang || 0,
      x, y,
      0, 0, 0, 0,
      kind === 5 ? 1 : 0,
      0, 15, 0
    );
  }

  const explosions = (frame.E || []).map(e => ({
    x: e[0], y: e[1], size: e[2], color: e[3], age: e[4], duration: e[5]
  }));
  const lasers = (frame.L || []).map(l => ({
    startX: l[0], startY: l[1], endX: l[2], endY: l[3],
    color: l[4], age: l[5], duration: l[6]
  }));

  return {
    planets,
    ships,
    flatShips,
    fleets: [],
    explosions,
    lasers,
    storms: [],
    wreckages: [],
    chunks: [],
    players,
    isPaused: false,
    isRunning: true,
    gameOverMessage: null,
    settings: { fogOfWar: false },
    timeRemaining: null,
    elapsedTime: (frame.t || 0) / 1000,
    gameSpeed: 1,
    width: doc.width,
    height: doc.height,
    gameStartTime: doc.startedAtMs || 0,
    exploredCells: [],
    marketPrices: {},
    resourceRarities: {},
    isGameReplay: true,
    replayTitle: doc.title,
    replayFrameIndex: idx,
    replayFrameCount: doc.frames.length,
    replayTimeMs: frame.t || 0,
    replayDurationMs: doc.durationMs || 0,
    gameOverMessageFinal: doc.gameOverMessage || null
  };
}
