#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

require_command openbox
require_command xdpyinfo

for _ in $(seq 1 20); do
  if xdpyinfo -display "$DISPLAY_ID" >/dev/null 2>&1; then
    log "démarrage d'Openbox sur $DISPLAY_ID"
    exec env DISPLAY="$DISPLAY_ID" openbox
  fi
  sleep 0.5
done

fail "Xvfb n'est pas prêt sur $DISPLAY_ID"
