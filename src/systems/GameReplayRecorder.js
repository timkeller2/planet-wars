/**
 * Compact full-game replay recorder (2–5 Hz).
 * Samples a FoW-off world snapshot for later god's-eye playback.
 * Designed to stay off the critical path: pure data capture, no deep clones of live objects.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);
const MAX_REPLAYS = 10;
/** Target sample period when fleet counts are low (4 Hz). */
const SAMPLE_MS_FAST = 250;
/** Sample period under heavy load (2 Hz). */
const SAMPLE_MS_SLOW = 500;
/** Soft cap: if more frames accumulate, thin older half by dropping every other frame. */
const MAX_FRAMES_SOFT = 20000;

function shipKind(s) {
  if (!s) return 0;
  if (s.isGoldenAmoeba) return 12;
  if (s.isAmoeba) return 11;
  if (s.isCruiser) {
    const ct = (s.classType || '').toLowerCase();
    if (ct.includes('mammoth')) return 10;
    if (ct.includes('titan')) return 9;
    if (ct.includes('battle')) return 8;
    if (ct.includes('destroy')) return 7;
    if (ct.includes('corvette')) return 6;
    return 6; // default capital
  }
  if (s.isReturnPod) return 4;
  if (s.isBoardingFleet) return 3;
  if (s.isMarineFleet) return 5;
  if (s.isBomber) return 1;
  if (s.isInterceptor) return 2;
  return 0;
}

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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatLocalDateTime(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function sanitizeFilePart(s) {
  return String(s || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'Player';
}

export class GameReplayRecorder {
  constructor(replaysDir) {
    this.replaysDir = replaysDir;
    this.reset();
  }

  reset() {
    this.active = false;
    this.frames = [];
    this.players = [];
    this.playerIndex = new Map();
    this.planetBase = {};
    this.width = 0;
    this.height = 0;
    this.lastSampleGameTime = -Infinity;
    this.startedAt = null;
    this.startedAtMs = 0;
    this.gameOverMessage = null;
    this.sampleIntervalMs = SAMPLE_MS_FAST;
  }

  ensureDir() {
    if (!fs.existsSync(this.replaysDir)) {
      fs.mkdirSync(this.replaysDir, { recursive: true });
    }
  }

  /**
   * Begin recording for a new match (call after map init when setting is on).
   */
  start(game) {
    this.reset();
    if (!game) return;
    this.active = true;
    this.startedAtMs = Date.now();
    this.startedAt = formatLocalDateTime(new Date(this.startedAtMs));
    this.width = game.width || 0;
    this.height = game.height || 0;
    this._rebuildPlayerIndex(game);
    // Immediate first frame so t=0 is not empty
    this.sample(game, true);
    console.log(`[GameReplay] Recording started (${this.startedAt})`);
  }

  _rebuildPlayerIndex(game) {
    this.players = [];
    this.playerIndex = new Map();
    if (!game || !game.allPlayers) return;
    for (let i = 0; i < game.allPlayers.length; i++) {
      const p = game.allPlayers[i];
      if (!p) continue;
      this.playerIndex.set(p.id, i);
      this.players.push({
        id: p.id,
        name: p.name || p.id,
        color: p.color || '#888',
        isAI: !!p.isAI
      });
    }
  }

  _ownerIdx(owner) {
    if (!owner) return -1;
    if (this.playerIndex.has(owner.id)) return this.playerIndex.get(owner.id);
    // Late join / new AI — append
    const i = this.players.length;
    this.playerIndex.set(owner.id, i);
    this.players.push({
      id: owner.id,
      name: owner.name || owner.id,
      color: owner.color || '#888',
      isAI: !!owner.isAI
    });
    return i;
  }

  /**
   * Sample if enough game-time has elapsed (or force).
   * Uses gameTime so pause does not create duplicate frames.
   */
  sample(game, force = false) {
    if (!this.active || !game) return;
    const gt = game.gameTime || 0;
    // Adaptive rate: more ships → 2 Hz
    const shipCount = game.ships ? game.ships.length : 0;
    this.sampleIntervalMs = shipCount > 350 ? SAMPLE_MS_SLOW : SAMPLE_MS_FAST;
    if (!force && gt - this.lastSampleGameTime < this.sampleIntervalMs) return;
    this.lastSampleGameTime = gt;

    // Refresh player list lightly (names/colors may change)
    if (game.allPlayers && game.allPlayers.length !== this.players.length) {
      this._rebuildPlayerIndex(game);
    } else if (game.allPlayers) {
      for (const p of game.allPlayers) {
        const idx = this.playerIndex.get(p.id);
        if (idx !== undefined && this.players[idx]) {
          this.players[idx].name = p.name || p.id;
          this.players[idx].color = p.color || this.players[idx].color;
          this.players[idx].isAI = !!p.isAI;
        }
      }
    }

    const P = []; // planets dynamic
    if (game.planets) {
      for (const p of game.planets) {
        if (!p || p.isDeepSpaceAnomaly) continue;
        const id = p.id;
        if (!this.planetBase[id]) {
          this.planetBase[id] = {
            x: Math.round(p.x),
            y: Math.round(p.y),
            r: Math.round(p.radius || 20),
            n: p.name || '',
            h: p.habitability || 0,
            m: p.minerals || 4,
            sc: p.sizeClass || 0
          };
        } else {
          // Radius can change (growth)
          const r = Math.round(p.radius || 20);
          if (r !== this.planetBase[id].r) this.planetBase[id].r = r;
        }
        // flags: bit0 homeworld, bit1 dead, bit2 research, bit3 military, bit4 revolt, bit5 rampage
        let flags = 0;
        if (p.isHomeworld) flags |= 1;
        if (p.dead) flags |= 2;
        if (p.isResearch) flags |= 4;
        if (p.isMilitary) flags |= 8;
        if (p.inRevolt) flags |= 16;
        if (p.rampageEvent) flags |= 32;
        P.push([
          id,
          this._ownerIdx(p.owner),
          Math.round(p.ships || 0),
          Math.round(p.maxShips || 0),
          flags
        ]);
      }
    }

    // Flat fleets (non-cruiser / non-amoeba): [id, x10, y10, oi, kind, ang100, count]
    const S = [];
    // Capital / amoeba: compact objects
    const C = [];
    if (game.ships) {
      for (const s of game.ships) {
        if (!s || !s.active) continue;
        const kind = shipKind(s);
        const oi = this._ownerIdx(s.owner);
        if (s.isCruiser || s.isAmoeba) {
          C.push([
            s.id,
            Math.round(s.x * 10) / 10,
            Math.round(s.y * 10) / 10,
            oi,
            kind,
            Math.round((s.angle || 0) * 100) / 100,
            Math.round(s.health || 0),
            Math.round(s.maxHealth || 0),
            s.name || '',
            s.classType || classTypeFromKind(kind) || '',
            Math.round(s.armorPoints || 0),
            Math.round(s.shieldPoints || 0),
            s.cruiserStyle || null
          ]);
        } else {
          S.push(
            s.id,
            Math.round(s.x * 10) / 10,
            Math.round(s.y * 10) / 10,
            oi,
            kind,
            Math.round((s.angle || 0) * 100) / 100,
            s.count || 1
          );
        }
      }
    }

    // Sparse FX (cap counts to bound size)
    const E = [];
    if (game.explosions) {
      let n = 0;
      for (const e of game.explosions) {
        if (!e || n >= 40) break;
        E.push([
          Math.round(e.x),
          Math.round(e.y),
          Math.round(e.size || 10),
          e.color || '#ff0',
          Math.round((e.age || 0) * 10) / 10,
          Math.round((e.duration || 1) * 10) / 10
        ]);
        n++;
      }
    }
    const L = [];
    if (game.lasers) {
      let n = 0;
      for (const l of game.lasers) {
        if (!l || n >= 60) break;
        L.push([
          Math.round(l.startX),
          Math.round(l.startY),
          Math.round(l.endX),
          Math.round(l.endY),
          l.color || '#0ff',
          Math.round((l.age || 0) * 10) / 10,
          Math.round((l.duration || 0.3) * 10) / 10
        ]);
        n++;
      }
    }

    // Player scores every frame (small)
    const pl = [];
    if (game.allPlayers) {
      for (const p of game.allPlayers) {
        pl.push([
          this._ownerIdx(p),
          Math.round(p.techScore || 0),
          Math.round(p.expScore || 0),
          Math.round(p.happinessScore || 0),
          Math.round(p.credits || 0)
        ]);
      }
    }

    this.frames.push({ t: Math.round(gt), P, S, C, E, L, pl });

    if (this.frames.length > MAX_FRAMES_SOFT) {
      // Thin: drop every other frame in the older half
      const half = Math.floor(this.frames.length / 2);
      const thinned = [];
      for (let i = 0; i < half; i += 2) thinned.push(this.frames[i]);
      for (let i = half; i < this.frames.length; i++) thinned.push(this.frames[i]);
      this.frames = thinned;
      console.log(`[GameReplay] Thinned frames to ${this.frames.length} (soft cap)`);
    }
  }

  /**
   * Finalize and write gzipped JSON. Returns meta or null.
   */
  async finalizeAndSave(game, gameOverMessage = null) {
    if (!this.active) return null;
    this.active = false;
    if (game) {
      this.sample(game, true);
      this.width = game.width || this.width;
      this.height = game.height || this.height;
    }
    this.gameOverMessage = gameOverMessage || (game && game.gameOverMessage) || null;

    if (!this.frames.length) {
      console.log('[GameReplay] No frames captured — skip save');
      this.reset();
      return null;
    }

    const humanNames = this.players
      .filter(p => p && !p.isAI && p.id !== 'monsters' && p.id !== 'monster')
      .map(p => p.name || p.id);
    const namePart = humanNames.length
      ? humanNames.map(sanitizeFilePart).join('_')
      : 'NoHumans';
    const title = `${this.startedAt} — ${humanNames.length ? humanNames.join(', ') : 'No human players'}`;
    const fileStamp = this.startedAt.replace(/[: ]/g, (c) => (c === ':' ? '-' : '_'));
    const fileName = `${fileStamp}__${namePart}.json.gz`;

    const durationMs = this.frames[this.frames.length - 1].t - this.frames[0].t;
    const doc = {
      v: 1,
      hz: Math.round(1000 / ((this.sampleIntervalMs || SAMPLE_MS_FAST))),
      width: this.width,
      height: this.height,
      startedAt: this.startedAt,
      startedAtMs: this.startedAtMs,
      title,
      durationMs: Math.max(0, durationMs),
      gameOverMessage: this.gameOverMessage,
      players: this.players,
      planetBase: this.planetBase,
      frames: this.frames
    };

    try {
      this.ensureDir();
      const json = JSON.stringify(doc);
      const gz = await gzipAsync(Buffer.from(json, 'utf8'));
      const filePath = path.join(this.replaysDir, fileName);
      await fs.promises.writeFile(filePath, gz);
      const sizeMb = (gz.length / (1024 * 1024)).toFixed(2);
      console.log(`[GameReplay] Saved ${fileName} (${this.frames.length} frames, ${sizeMb} MB gz) — ${title}`);
      const meta = {
        id: fileName,
        fileName,
        title,
        durationMs: doc.durationMs,
        startedAt: this.startedAt,
        frameCount: this.frames.length,
        sizeBytes: gz.length,
        gameOverMessage: this.gameOverMessage,
        humanPlayers: humanNames
      };
      this.upsertIndex(meta);
      this.pruneOldReplays();
      this.reset();
      return meta;
    } catch (e) {
      console.error('[GameReplay] Save failed', e);
      this.reset();
      return null;
    }
  }

  discard() {
    if (this.active || this.frames.length) {
      console.log('[GameReplay] Discarding in-progress recording');
    }
    this.reset();
  }

  indexPath() {
    return path.join(this.replaysDir, 'index.json');
  }

  readIndex() {
    try {
      const p = this.indexPath();
      if (!fs.existsSync(p)) return [];
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  writeIndex(entries) {
    try {
      fs.writeFileSync(this.indexPath(), JSON.stringify(entries.slice(0, MAX_REPLAYS), null, 2), 'utf8');
    } catch (e) {
      console.error('[GameReplay] writeIndex failed', e);
    }
  }

  upsertIndex(meta) {
    const list = this.readIndex().filter(e => e && e.fileName !== meta.fileName);
    list.unshift({
      id: meta.fileName,
      fileName: meta.fileName,
      title: meta.title,
      durationMs: meta.durationMs || 0,
      sizeBytes: meta.sizeBytes || 0,
      startedAt: meta.startedAt,
      frameCount: meta.frameCount || 0,
      humanPlayers: meta.humanPlayers || [],
      mtime: Date.now()
    });
    this.writeIndex(list.slice(0, MAX_REPLAYS));
  }

  pruneOldReplays() {
    try {
      this.ensureDir();
      const files = fs.readdirSync(this.replaysDir)
        .filter(f => f.endsWith('.json.gz'))
        .map(f => {
          const full = path.join(this.replaysDir, f);
          const st = fs.statSync(full);
          return { f, full, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      const keep = new Set(files.slice(0, MAX_REPLAYS).map(x => x.f));
      for (let i = MAX_REPLAYS; i < files.length; i++) {
        try {
          fs.unlinkSync(files[i].full);
          console.log(`[GameReplay] Pruned old replay ${files[i].f}`);
        } catch (e) {
          console.error('[GameReplay] Prune failed', files[i].f, e);
        }
      }
      // Sync index to remaining files
      const idx = this.readIndex().filter(e => e && keep.has(e.fileName));
      // Add any files missing from index
      for (const f of files.slice(0, MAX_REPLAYS)) {
        if (!idx.find(e => e.fileName === f.f)) {
          let title = f.f.replace(/\.json\.gz$/i, '');
          const m = title.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})(?:-\d{2})?__(.+)$/);
          if (m) title = `${m[1]} ${m[2]}:${m[3]} — ${m[4].split('_').join(', ')}`;
          idx.push({ id: f.f, fileName: f.f, title, sizeBytes: 0, mtime: f.mtime, durationMs: 0 });
        }
      }
      idx.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      this.writeIndex(idx.slice(0, MAX_REPLAYS));
    } catch (e) {
      console.error('[GameReplay] pruneOldReplays error', e);
    }
  }

  listReplays() {
    try {
      this.ensureDir();
      // Prefer index (has clean titles); fall back to directory scan
      let list = this.readIndex();
      const onDisk = new Set(
        fs.readdirSync(this.replaysDir).filter(f => f.endsWith('.json.gz'))
      );
      list = list.filter(e => e && onDisk.has(e.fileName));
      for (const f of onDisk) {
        if (!list.find(e => e.fileName === f)) {
          const full = path.join(this.replaysDir, f);
          let stSize = 0;
          let mtime = 0;
          try {
            const st = fs.statSync(full);
            stSize = st.size;
            mtime = st.mtimeMs;
          } catch (_) { /* ignore */ }
          let title = f.replace(/\.json\.gz$/i, '');
          const m = title.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})(?:-\d{2})?__(.+)$/);
          if (m) title = `${m[1]} ${m[2]}:${m[3]} — ${m[4].split('_').join(', ')}`;
          list.push({ id: f, fileName: f, title, sizeBytes: stSize, mtime, durationMs: 0 });
        }
      }
      // Refresh sizes from disk
      for (const e of list) {
        try {
          const st = fs.statSync(path.join(this.replaysDir, e.fileName));
          e.sizeBytes = st.size;
          e.mtime = e.mtime || st.mtimeMs;
        } catch (_) { /* ignore */ }
      }
      list.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      return list.slice(0, MAX_REPLAYS);
    } catch (e) {
      console.error('[GameReplay] listReplays error', e);
      return [];
    }
  }

  getReplayPath(fileName) {
    if (!fileName || typeof fileName !== 'string') return null;
    const base = path.basename(fileName);
    if (!base.endsWith('.json.gz')) return null;
    if (base.includes('..')) return null;
    const full = path.join(this.replaysDir, base);
    if (!fs.existsSync(full)) return null;
    return full;
  }

  deleteReplay(fileName) {
    const full = this.getReplayPath(fileName);
    if (!full) return false;
    try {
      fs.unlinkSync(full);
      this.writeIndex(this.readIndex().filter(e => e && e.fileName !== path.basename(fileName)));
      return true;
    } catch (e) {
      console.error('[GameReplay] delete failed', e);
      return false;
    }
  }
}

export { expandGameReplayFrame } from './gameReplayExpand.js';
export { MAX_REPLAYS, SAMPLE_MS_FAST, SAMPLE_MS_SLOW };
