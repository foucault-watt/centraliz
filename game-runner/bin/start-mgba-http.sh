#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

require_file "$MGBA_HTTP_BIN"
[[ -x "$MGBA_HTTP_BIN" ]] || fail "binaire non exécutable: $MGBA_HTTP_BIN"

log "démarrage de mGBA-http"
cd -- "$(dirname -- "$MGBA_HTTP_BIN")"
exec "$MGBA_HTTP_BIN"
