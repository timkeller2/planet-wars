/**
 * Compute the newest mtime among files that go into a portable local-host package.
 * Used to decide whether releases/*.zip is stale vs current game sources.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ROOT_FILES = [
  'server.js',
  'package.json',
  'package-lock.json',
  'index.html',
  'style.css',
  'vite.config.js',
  'federation_viewer.html',
];

const ROOT_DIRS = ['src', 'public', path.join('scripts', 'portable')];

const EXTRA_FILES = [
  path.join('scripts', 'pack-portable.mjs'),
  path.join('scripts', 'portable-source-stamp.mjs'),
];

const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'releases',
  '.portable-cache',
  '.git',
  'saves',
  'logs',
  'scratch',
  '.vite',
]);

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === '.DS_Store' || ent.name === 'Thumbs.db') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIR_NAMES.has(ent.name)) continue;
      walkFiles(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
}

/**
 * @returns {{ latestMtimeMs: number, latestFile: string|null, fileCount: number, checkedAt: string }}
 */
export function getPortableSourceStamp(root = ROOT) {
  const files = [];
  for (const f of ROOT_FILES) {
    const full = path.join(root, f);
    if (fs.existsSync(full)) files.push(full);
  }
  for (const f of EXTRA_FILES) {
    const full = path.join(root, f);
    if (fs.existsSync(full)) files.push(full);
  }
  for (const d of ROOT_DIRS) {
    walkFiles(path.join(root, d), files);
  }

  let latestMtimeMs = 0;
  let latestFile = null;
  for (const full of files) {
    try {
      const st = fs.statSync(full);
      const t = st.mtimeMs;
      if (t > latestMtimeMs) {
        latestMtimeMs = t;
        latestFile = path.relative(root, full).replace(/\\/g, '/');
      }
    } catch {
      // ignore transient files
    }
  }

  return {
    latestMtimeMs,
    latestFile,
    fileCount: files.length,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * True if package builtAt (ISO string or ms) is at least as new as source stamp.
 * Allows a 2s skew so a pack that starts just after a save still counts as current.
 */
export function isPortablePackageUpToDate(builtAt, stamp, skewMs = 2000) {
  if (!builtAt || !stamp || !stamp.latestMtimeMs) return false;
  const builtMs = typeof builtAt === 'number' ? builtAt : Date.parse(builtAt);
  if (!Number.isFinite(builtMs)) return false;
  return builtMs + skewMs >= stamp.latestMtimeMs;
}
