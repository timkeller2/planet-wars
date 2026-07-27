/**
 * Build a portable local-host package (Option 3):
 * game + production deps + prebuilt client + portable Node + start scripts.
 *
 * Usage:
 *   node scripts/pack-portable.mjs
 *   node scripts/pack-portable.mjs --platform win-x64
 *   node scripts/pack-portable.mjs --platform win-x64 --skip-node
 *   node scripts/pack-portable.mjs --platform all
 *
 * Output: releases/AmoebaWars-local-host-<platform>.zip
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { spawnSync, execFileSync } from 'child_process';
import { createWriteStream } from 'fs';
import { getPortableSourceStamp } from './portable-source-stamp.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const RELEASES = path.join(ROOT, 'releases');
const CACHE = path.join(ROOT, '.portable-cache');

/** Pin a known-good Node for hosts (LTS line). */
const NODE_VERSION = process.env.PORTABLE_NODE_VERSION || '22.14.0';

const PLATFORMS = {
  'win-x64': {
    nodeDist: `node-v${NODE_VERSION}-win-x64`,
    nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`,
    archiveExt: '.zip',
    starter: 'start.bat',
  },
  'darwin-arm64': {
    nodeDist: `node-v${NODE_VERSION}-darwin-arm64`,
    nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
    archiveExt: '.tar.gz',
    starter: 'start.sh',
  },
  'darwin-x64': {
    nodeDist: `node-v${NODE_VERSION}-darwin-x64`,
    nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.gz`,
    archiveExt: '.tar.gz',
    starter: 'start.sh',
  },
  'linux-x64': {
    nodeDist: `node-v${NODE_VERSION}-linux-x64`,
    nodeUrl: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz`,
    archiveExt: '.tar.xz',
    starter: 'start.sh',
  },
};

const COPY_ROOT_FILES = [
  'server.js',
  'package.json',
  'package-lock.json',
  'index.html',
  'style.css',
  'vite.config.js',
  'federation_viewer.html',
];

const COPY_DIRS = ['src', 'public'];

function parseArgs(argv) {
  const out = { platform: null, skipNode: false, skipBuild: false, skipNpm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--platform' || a === '-p') out.platform = argv[++i];
    else if (a === '--skip-node') out.skipNode = true;
    else if (a === '--skip-build') out.skipBuild = true;
    else if (a === '--skip-npm') out.skipNpm = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function log(msg) {
  console.log(`[pack-portable] ${msg}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirFiltered(src, dest, ignoreNames = new Set()) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignoreNames.has(entry.name)) continue;
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(from, to, ignoreNames);
    } else if (entry.isFile()) {
      copyFile(from, to);
    }
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    const file = createWriteStream(dest);
    const get = (u, redirects = 0) => {
      const lib = u.startsWith('https') ? https : http;
      lib.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects > 8) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          res.resume();
          get(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed ${res.statusCode}: ${u}`));
          res.resume();
          return;
        }
        const total = Number(res.headers['content-length'] || 0);
        let got = 0;
        let lastPct = -1;
        res.on('data', (chunk) => {
          got += chunk.length;
          if (total > 0) {
            const pct = Math.floor((got / total) * 100);
            if (pct >= lastPct + 10) {
              lastPct = pct;
              process.stdout.write(`\r[pack-portable] download ${pct}%`);
            }
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            if (total > 0) process.stdout.write('\n');
            resolve(dest);
          });
        });
      }).on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (_) { /* ignore */ }
        reject(err);
      });
    };
    get(url);
  });
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    stdio: 'inherit',
    shell: opts.shell ?? false,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (r.status !== 0) {
    throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(' ')}`);
  }
}

function detectDefaultPlatform() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'win32' && a === 'x64') return 'win-x64';
  if (p === 'darwin' && a === 'arm64') return 'darwin-arm64';
  if (p === 'darwin' && a === 'x64') return 'darwin-x64';
  if (p === 'linux' && a === 'x64') return 'linux-x64';
  return 'win-x64';
}

async function ensureNodeRuntime(platformKey, stagingRoot) {
  const meta = PLATFORMS[platformKey];
  const cacheName = `${meta.nodeDist}${meta.archiveExt}`;
  const cachePath = path.join(CACHE, cacheName);
  if (!fs.existsSync(cachePath)) {
    log(`Downloading Node ${NODE_VERSION} for ${platformKey}…`);
    await downloadFile(meta.nodeUrl, cachePath);
  } else {
    log(`Using cached Node archive: ${cacheName}`);
  }

  const runtimeNode = path.join(stagingRoot, 'runtime', 'node');
  rmrf(runtimeNode);
  ensureDir(path.join(stagingRoot, 'runtime'));

  const extractDir = path.join(CACHE, `extract-${platformKey}`);
  rmrf(extractDir);
  ensureDir(extractDir);

  if (meta.archiveExt === '.zip') {
    if (process.platform === 'win32') {
      execFileSync('powershell.exe', [
        '-NoProfile', '-Command',
        `Expand-Archive -LiteralPath '${cachePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
      ], { stdio: 'inherit' });
    } else {
      run('unzip', ['-q', '-o', cachePath, '-d', extractDir]);
    }
  } else if (meta.archiveExt === '.tar.gz') {
    run('tar', ['-xzf', cachePath, '-C', extractDir]);
  } else if (meta.archiveExt === '.tar.xz') {
    run('tar', ['-xJf', cachePath, '-C', extractDir]);
  }

  // Extracted folder is usually node-vXX-platform/
  const extractedRoot = path.join(extractDir, meta.nodeDist);
  const source = fs.existsSync(extractedRoot) ? extractedRoot : extractDir;
  // Move contents into runtime/node (flat for win: node.exe at root of node/)
  fs.renameSync(source, runtimeNode);

  // Cleanup extract shell if rename left empty parent
  try { rmrf(extractDir); } catch (_) { /* ignore */ }

  if (platformKey.startsWith('win')) {
    if (!fs.existsSync(path.join(runtimeNode, 'node.exe'))) {
      throw new Error('Portable Node extract missing node.exe');
    }
  } else {
    if (!fs.existsSync(path.join(runtimeNode, 'bin', 'node'))) {
      throw new Error('Portable Node extract missing bin/node');
    }
  }
  log(`Portable Node ready at runtime/node`);
}

function zipDirectory(sourceDir, zipPath) {
  rmrf(zipPath);
  ensureDir(path.dirname(zipPath));
  // Zip the folder itself so unzip yields AmoebaWars-local-host-<platform>/start.bat
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`
    ], { stdio: 'inherit' });
  } else {
    const parent = path.dirname(sourceDir);
    const base = path.basename(sourceDir);
    run('zip', ['-r', '-q', zipPath, base], { cwd: parent });
  }
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Zip was not created: ${zipPath}`);
  }
  const mb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  log(`Created ${path.relative(ROOT, zipPath)} (${mb} MB)`);
}

async function packPlatform(platformKey, opts) {
  if (!PLATFORMS[platformKey]) {
    throw new Error(`Unknown platform: ${platformKey}. Known: ${Object.keys(PLATFORMS).join(', ')}`);
  }

  ensureDir(RELEASES);
  ensureDir(CACHE);

  if (!opts.skipBuild) {
    log('Building client (vite)…');
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { shell: process.platform === 'win32' });
  } else {
    log('Skipping client build (--skip-build)');
  }

  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/index.html missing — run without --skip-build or npm run build first');
  }

  const packageName = `AmoebaWars-local-host-${platformKey}`;
  const staging = path.join(RELEASES, `staging-${platformKey}`);
  const packageRoot = path.join(staging, packageName);
  rmrf(staging);
  ensureDir(packageRoot);

  log(`Staging ${packageName}…`);

  for (const f of COPY_ROOT_FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) copyFile(src, path.join(packageRoot, f));
  }
  for (const d of COPY_DIRS) {
    copyDirFiltered(path.join(ROOT, d), path.join(packageRoot, d));
  }
  copyDirFiltered(path.join(ROOT, 'dist'), path.join(packageRoot, 'dist'));

  // Portable starters + readme
  copyFile(path.join(ROOT, 'scripts', 'portable', 'start.bat'), path.join(packageRoot, 'start.bat'));
  copyFile(path.join(ROOT, 'scripts', 'portable', 'start.sh'), path.join(packageRoot, 'start.sh'));
  copyFile(path.join(ROOT, 'scripts', 'portable', 'README-HOST.txt'), path.join(packageRoot, 'README-HOST.txt'));

  // Production package.json (force production start)
  const pkgPath = path.join(packageRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.start = 'node server.js';
    // Keep vite only if needed for rebuilds; hosts use prebuilt dist
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // Snapshot source stamp at pack start (before long npm/node steps so we capture game state)
  const sourceStamp = getPortableSourceStamp(ROOT);
  const builtAt = new Date().toISOString();

  // Write version stamp
  fs.writeFileSync(path.join(packageRoot, 'HOST_PACKAGE.json'), JSON.stringify({
    name: packageName,
    platform: platformKey,
    nodeVersion: NODE_VERSION,
    builtAt,
    sourceLatestMtimeMs: sourceStamp.latestMtimeMs,
    sourceLatestFile: sourceStamp.latestFile,
    sourceFileCount: sourceStamp.fileCount,
    gameVersion: (JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version) || '0.0.0',
  }, null, 2) + '\n');

  if (!opts.skipNpm) {
    log('Installing production npm dependencies into package…');
    run(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--omit=dev', '--no-audit', '--no-fund'],
      { cwd: packageRoot, shell: process.platform === 'win32' }
    );
  }

  if (!opts.skipNode) {
    await ensureNodeRuntime(platformKey, packageRoot);
  } else {
    log('Skipping portable Node (--skip-node) — start scripts will fail until runtime/node is added');
  }

  // Empty saves dir so hosts have a writable place
  ensureDir(path.join(packageRoot, 'saves', 'ship_configs'));
  ensureDir(path.join(packageRoot, 'saves', 'game_replays'));
  fs.writeFileSync(path.join(packageRoot, 'saves', '.gitkeep'), '');

  const zipPath = path.join(RELEASES, `${packageName}.zip`);
  // finishedAt is the package identity for "is this newer than current sources?"
  const finishedAt = new Date().toISOString();
  log('Zipping package…');
  zipDirectory(packageRoot, zipPath);

  // Write manifest next to zip
  const manifest = {
    platform: platformKey,
    fileName: path.basename(zipPath),
    sizeBytes: fs.statSync(zipPath).size,
    nodeVersion: NODE_VERSION,
    builtAt: finishedAt,
    sourceLatestMtimeMs: sourceStamp.latestMtimeMs,
    sourceLatestFile: sourceStamp.latestFile,
    sourceFileCount: sourceStamp.fileCount,
  };
  fs.writeFileSync(path.join(RELEASES, `${packageName}.json`), JSON.stringify(manifest, null, 2) + '\n');

  // Keep staging for debugging? Remove to save disk.
  rmrf(staging);
  return manifest;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/pack-portable.mjs [--platform win-x64|darwin-arm64|darwin-x64|linux-x64|all]
  --skip-node   Do not download/bundle Node
  --skip-build  Skip vite build
  --skip-npm    Skip npm install --omit=dev in package`);
    process.exit(0);
  }

  let platforms = [];
  if (!opts.platform || opts.platform === 'default') {
    platforms = [detectDefaultPlatform()];
  } else if (opts.platform === 'all') {
    platforms = Object.keys(PLATFORMS);
  } else {
    platforms = [opts.platform];
  }

  log(`Platforms: ${platforms.join(', ')} (Node ${NODE_VERSION})`);
  const results = [];
  for (const p of platforms) {
    // Only build client once
    const platformOpts = { ...opts, skipBuild: opts.skipBuild || results.length > 0 };
    results.push(await packPlatform(p, platformOpts));
  }
  log('Done.');
  console.log(JSON.stringify({ ok: true, packages: results }, null, 2));
}

main().catch((err) => {
  console.error('[pack-portable] FAILED:', err.message || err);
  process.exit(1);
});
