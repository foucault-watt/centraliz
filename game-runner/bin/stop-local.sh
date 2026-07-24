#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

# Arrêt symétrique de bin/start-local.sh : termine les processus lancés en
# arrière-plan via leurs fichiers PID, dans l'ordre inverse du démarrage.

for name in mgba-http mgba openbox xvfb; do
  pidfile="$STATE_DIR/$name.pid"

  if [[ -f "$pidfile" ]]; then
    pid="$(cat -- "$pidfile")"

    if kill -0 "$pid" 2>/dev/null; then
      log "arrêt de $name (pid $pid)"
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f -- "$pidfile"
  fi
done
