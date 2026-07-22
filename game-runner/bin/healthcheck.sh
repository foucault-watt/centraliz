#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

scope="${1:---all}"
failed=0

check_display() {
  if command -v xdpyinfo >/dev/null 2>&1 && xdpyinfo -display "$DISPLAY_ID" >/dev/null 2>&1; then
    log "OK display $DISPLAY_ID"
  else
    log "KO display $DISPLAY_ID"
    failed=1
  fi
}

check_lua() {
  if wait_for_tcp "$LUA_HOST" "$LUA_PORT" 1; then
    log "OK Lua $LUA_HOST:$LUA_PORT"
  else
    log "KO Lua $LUA_HOST:$LUA_PORT"
    failed=1
  fi
}

check_http() {
  require_command curl
  if curl --fail --silent --show-error --max-time 3 "$MGBA_HTTP_URL/core/getgametitle" >/dev/null; then
    log "OK mGBA-http $MGBA_HTTP_URL"
  else
    log "KO mGBA-http $MGBA_HTTP_URL"
    failed=1
  fi
}

case "$scope" in
  --display) check_display ;;
  --lua) check_lua ;;
  --http) check_http ;;
  --all) check_display; check_lua; check_http ;;
  *) fail "usage: $0 [--display|--lua|--http|--all]" ;;
esac

exit "$failed"
