#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

# Démarrage sans systemd/sudo, pour le développement (WSL). Enchaîne les mêmes
# scripts que la prod (Xvfb, Openbox, mGBA, Lua, mGBA-http), en arrière-plan
# avec des fichiers PID dans $STATE_DIR. Utiliser bin/stop-local.sh pour arrêter.
#
# Exemple :
#   GAME_RUNNER_DIR="$HOME/pokemon-cloud" "$(pwd)/bin/start-local.sh"

start_bg() {
  local name="$1"
  shift
  local pidfile="$STATE_DIR/$name.pid"

  if [[ -f "$pidfile" ]] && kill -0 "$(cat -- "$pidfile")" 2>/dev/null; then
    log "$name déjà lancé (pid $(cat -- "$pidfile"))"
    return 0
  fi

  nohup "$@" >"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$pidfile"
  log "$name démarré (pid $!)"
}

start_bg xvfb "$SCRIPT_DIR/start-xvfb.sh"
sleep 1

start_bg openbox "$SCRIPT_DIR/start-openbox.sh"
sleep 1

start_bg mgba "$SCRIPT_DIR/start-mgba.sh"
sleep 3

"$SCRIPT_DIR/load-lua.sh"

start_bg mgba-http "$SCRIPT_DIR/start-mgba-http.sh"

"$SCRIPT_DIR/healthcheck.sh" --all
