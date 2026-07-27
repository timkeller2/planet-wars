#!/usr/bin/env bash
# Amoeba Wars local host launcher (portable Node)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

NODE_DIR="$ROOT/runtime/node"
PORT="${PORT:-5173}"
export NODE_ENV=production
export PORT

echo ""
echo " ============================================"
echo "  AMOEBA WARS  -  Local Host (portable Node)"
echo " ============================================"
echo ""

# Official Node tarball layouts: bin/node under the extracted folder
if [[ -x "$NODE_DIR/bin/node" ]]; then
  NODE_BIN="$NODE_DIR/bin/node"
  NPM_BIN="$NODE_DIR/bin/npm"
elif [[ -x "$NODE_DIR/node" ]]; then
  NODE_BIN="$NODE_DIR/node"
  NPM_BIN="$NODE_DIR/npm"
else
  echo "[ERROR] Portable Node not found under runtime/node"
  echo "Re-download the Install Local Host package for your platform."
  exit 1
fi

if [[ ! -f "$ROOT/server.js" ]]; then
  echo "[ERROR] server.js missing. Unzip the full package first."
  exit 1
fi

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "[ERROR] Client build missing (dist/index.html)."
  exit 1
fi

export PATH="$(dirname "$NODE_BIN"):$PATH"

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "[setup] Installing production dependencies (first run)..."
  if [[ -x "$NPM_BIN" ]]; then
    "$NPM_BIN" install --omit=dev --no-audit --no-fund
  else
    "$NODE_BIN" "$(dirname "$NODE_BIN")/npm" install --omit=dev --no-audit --no-fund
  fi
fi

echo "[host] Using portable Node: $NODE_BIN"
echo "[host] Server: http://localhost:$PORT"
echo "[host] LAN clients can join via this machine's IP on port $PORT."
echo "[host] Press Ctrl+C to stop the server."
echo ""

# Open browser after a short delay (best-effort)
(
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT/" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT/" || true
  fi
) &

exec "$NODE_BIN" "$ROOT/server.js"
