#!/usr/bin/env bash
# One-command production startup:
#   1. Install/update the Terraria dedicated server (no-op when current)
#   2. Build the dashboard client when sources changed
#   3. Serve the dashboard + API on PORT
#
# Flags:
#   --force    re-download the Terraria server even when up to date
#   --rebuild  rebuild the client even when nothing changed
set -euo pipefail
cd "$(dirname "$0")"

FORCE=false
REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --rebuild) REBUILD=true ;;
    *) echo "[Start] Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

log()  { echo "[Start] $*"; }
warn() { echo "[Start] WARNING: $*" >&2; }
die()  { echo "[Start] ERROR: $*" >&2; exit 1; }

[ -d node_modules/express ] || die "Dependencies are not installed. Run 'npm install' first."
[ -x node_modules/.bin/vite ] || die "vite is missing. Dev dependencies are required to build the client; run 'npm install' (not --production)."

# --- 1. Terraria server update ----------------------------------------------

updater_args=()
if $FORCE; then
  updater_args+=(--force)
fi

if [ ! -f terraria/.version ]; then
  node scripts/update-server.mjs "${updater_args[@]}" \
    || die "Terraria server is not installed and the update failed."
else
  node scripts/update-server.mjs "${updater_args[@]}" \
    || warn "Update check failed; starting with the existing Terraria install."
fi

# --- 2. Build the client when sources are newer than dist/ ------------------

needs_build=false
if $REBUILD || [ ! -f dist/index.html ]; then
  needs_build=true
elif [ -n "$(find client -type f -not -path '*/node_modules/*' -newer dist/index.html -print -quit)" ]; then
  needs_build=true
fi

if $needs_build; then
  log "Building dashboard client..."
  npx vite build client/ || die "Client build failed."
  log "Client build complete."
else
  log "Dashboard client is up to date; skipping build."
fi

# --- 3. Start the dashboard --------------------------------------------------

log "Starting dashboard (production)..."
export NODE_ENV=production
exec node server.js
