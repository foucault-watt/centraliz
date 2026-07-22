#!/usr/bin/env bash
set -Eeuo pipefail

readonly BASE="${CENTRALIZ_GAME_DIR:-$HOME/centraliz/game-runner}"
readonly SCRIPT_DIR="$BASE/scripts"
readonly LOG_DIR="$BASE/logs"
readonly DISPLAY_ID="${DISPLAY:-:98}"

export DISPLAY="$DISPLAY_ID"

log() { printf '[start-game] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

mkdir -p "$LOG_DIR"

log "Starting bootstrap on DISPLAY=$DISPLAY_ID"

[[ -x "$SCRIPT_DIR/load-lua.sh" ]] || fail "Missing executable: $SCRIPT_DIR/load-lua.sh"
[[ -x "$SCRIPT_DIR/start-mgba-http.sh" ]] || fail "Missing executable: $SCRIPT_DIR/start-mgba-http.sh"

"$SCRIPT_DIR/load-lua.sh"
"$SCRIPT_DIR/start-mgba-http.sh"

if [[ -x "$SCRIPT_DIR/healthcheck.sh" ]]; then
    log "Running final health check"
    "$SCRIPT_DIR/healthcheck.sh"
fi

log "Bootstrap completed successfully"
