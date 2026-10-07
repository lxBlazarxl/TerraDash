#!/usr/bin/env bash
# Development startup: API server + Vite dev server with hot reload.
set -euo pipefail
cd "$(dirname "$0")"

log() { echo "[Dev] $*"; }
die() { echo "[Dev] ERROR: $*" >&2; exit 1; }

[ -d node_modules/express ] || die "Dependencies are not installed. Run 'npm install' first."
[ -x node_modules/.bin/vite ] || die "vite is missing. Run 'npm install'."

log "Starting API server..."
node server.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

log "Starting Vite dev server (Ctrl+C to stop both)..."
npx vite client/
