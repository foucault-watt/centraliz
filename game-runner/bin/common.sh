#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
GAME_RUNNER_DIR="${GAME_RUNNER_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
GAME_RUNNER_CONFIG="${GAME_RUNNER_CONFIG:-$GAME_RUNNER_DIR/config/game-runner.env}"

if [[ -r "$GAME_RUNNER_CONFIG" ]]; then
  # Le fichier est administré localement et ne doit pas contenir de commandes.
  # shellcheck disable=SC1090
  source "$GAME_RUNNER_CONFIG"
fi

DISPLAY_ID="${DISPLAY_ID:-:98}"
SCREEN_GEOMETRY="${SCREEN_GEOMETRY:-1024x768x24}"
LOG_DIR="${LOG_DIR:-$GAME_RUNNER_DIR/logs}"
STATE_DIR="${STATE_DIR:-$GAME_RUNNER_DIR/state}"
MGBA_BIN="${MGBA_BIN:-/usr/games/mgba-qt}"
ROM_PATH="${ROM_PATH:-$GAME_RUNNER_DIR/roms/game.gba}"
LUA_SCRIPT_PATH="${LUA_SCRIPT_PATH:-$GAME_RUNNER_DIR/tools/mgba-http/mGBASocketServer.lua}"
MGBA_HTTP_BIN="${MGBA_HTTP_BIN:-$GAME_RUNNER_DIR/tools/mgba-http/mgba-http}"
LUA_HOST="${LUA_HOST:-127.0.0.1}"
LUA_PORT="${LUA_PORT:-8888}"
MGBA_HTTP_URL="${MGBA_HTTP_URL:-http://127.0.0.1:5000}"

mkdir -p "$LOG_DIR" "$STATE_DIR"

log() {
  printf '[game-runner] %s\n' "$*"
}

fail() {
  printf '[game-runner] ERREUR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "commande introuvable: $1"
}

require_file() {
  [[ -f "$1" ]] || fail "fichier introuvable: $1"
}

wait_for_tcp() {
  local host="$1"
  local port="$2"
  local timeout="$3"
  local deadline=$((SECONDS + timeout))

  while ((SECONDS < deadline)); do
    if (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}
