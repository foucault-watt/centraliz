#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

require_command Xvfb
log "démarrage de Xvfb sur $DISPLAY_ID ($SCREEN_GEOMETRY)"
exec Xvfb "$DISPLAY_ID" -screen 0 "$SCREEN_GEOMETRY" -nolisten tcp
