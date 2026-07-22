#!/usr/bin/env bash
set -u

readonly DISPLAY_ID="${DISPLAY:-:98}"
readonly LUA_PORT="${LUA_PORT:-8888}"
readonly HTTP_PORT="${MGBA_HTTP_PORT:-5000}"
readonly HEALTH_URL="${MGBA_HTTP_HEALTH_URL:-http://127.0.0.1:${HTTP_PORT}/core/currentFrame}"

errors=0
ok() { printf '[OK]   %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*"; errors=$((errors+1)); }

check_process() {
    if pgrep -f "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1"; fi
}
check_port() {
    if ss -ltn | grep -Eq "[:.]${2}[[:space:]]"; then ok "$1 — port $2"; else bad "$1 — port $2"; fi
}

check_process "Xvfb $DISPLAY_ID" "Xvfb[[:space:]]+$DISPLAY_ID"
check_process "Openbox" "openbox"
check_process "mGBA" "mgba-qt"
check_process "mGBA-http" "/mgba-http"
check_port "Lua socket" "$LUA_PORT"
check_port "mGBA-http socket" "$HTTP_PORT"

if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
    ok "mGBA-http API"
else
    bad "mGBA-http API — $HEALTH_URL"
fi

(( errors == 0 )) && { printf '[healthcheck] All checks passed\n'; exit 0; }
printf '[healthcheck] %d check(s) failed\n' "$errors"
exit 1
