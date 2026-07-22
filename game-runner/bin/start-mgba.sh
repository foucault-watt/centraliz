#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

require_file "$MGBA_BIN"
require_file "$ROM_PATH"

log "démarrage de mGBA avec $(basename -- "$ROM_PATH") sur $DISPLAY_ID"
log "rappel: Sync Audio doit être désactivé et Sync Video activé pour ce compte"
exec env DISPLAY="$DISPLAY_ID" "$MGBA_BIN" "$ROM_PATH"
