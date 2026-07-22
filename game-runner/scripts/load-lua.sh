#!/usr/bin/env bash
set -Eeuo pipefail

readonly BASE="${CENTRALIZ_GAME_DIR:-$HOME/centraliz/game-runner}"
readonly LOG_DIR="$BASE/logs"
readonly DISPLAY_ID="${DISPLAY:-:98}"
readonly LUA_PORT="${LUA_PORT:-8888}"
readonly WAIT_TIMEOUT="${MGBA_WAIT_TIMEOUT:-30}"
readonly LUA_TIMEOUT="${LUA_WAIT_TIMEOUT:-20}"
readonly SCREENSHOT_OK="$LOG_DIR/lua-bootstrap.png"
readonly SCREENSHOT_ERROR="$LOG_DIR/lua-bootstrap-error.png"

export DISPLAY="$DISPLAY_ID"

log() { printf '[load-lua] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

take_screenshot() {
    local output="$1"
    command -v ffmpeg >/dev/null 2>&1 || return 0
    ffmpeg -y -v error -f x11grab -video_size 1024x768 -i "$DISPLAY_ID"         -frames:v 1 -update 1 "$output" || true
}

on_exit() {
    local code=$?
    if (( code != 0 )); then
        log "Bootstrap failed; writing diagnostic screenshot"
        take_screenshot "$SCREENSHOT_ERROR"
    fi
}
trap on_exit EXIT

mkdir -p "$LOG_DIR"
command -v xdotool >/dev/null 2>&1 || fail "xdotool is not installed"
command -v ss >/dev/null 2>&1 || fail "ss is not installed"

xdotool getmouselocation >/dev/null 2>&1 || fail "Cannot connect to X display $DISPLAY_ID"

if ss -ltn | grep -Eq "[:.]${LUA_PORT}[[:space:]]"; then
    log "Lua server already listens on port $LUA_PORT"
    trap - EXIT
    exit 0
fi

log "Waiting for a visible mGBA window"
MGBA_WINDOW=""
for ((i=1; i<=WAIT_TIMEOUT; i++)); do
    MGBA_WINDOW="$(xdotool search --onlyvisible --class 'mgba' 2>/dev/null | head -n 1 || true)"
    [[ -n "$MGBA_WINDOW" ]] || MGBA_WINDOW="$(xdotool search --onlyvisible --name 'mGBA' 2>/dev/null | head -n 1 || true)"
    [[ -n "$MGBA_WINDOW" ]] && break
    sleep 1
done

[[ -n "$MGBA_WINDOW" ]] || fail "No visible mGBA window found after ${WAIT_TIMEOUT}s"

log "Activating mGBA window $MGBA_WINDOW"
xdotool windowactivate --sync "$MGBA_WINDOW"
sleep 1

log "Opening Tools > Scripting"
xdotool mousemove --window "$MGBA_WINDOW" 500 218
sleep 0.2
xdotool click 1
sleep 0.6
xdotool mousemove --window "$MGBA_WINDOW" 500 355
sleep 0.2
xdotool click 1
sleep 1.5

log "Loading recent Lua script"
xdotool mousemove 15 25
sleep 0.2
xdotool click 1
sleep 1
xdotool mousemove 90 80
sleep 1.5
xdotool mousemove 140 80
sleep 0.5
xdotool mousemove 180 80
sleep 0.5
xdotool mousemove 230 80
sleep 0.8
xdotool click 1
sleep 2

log "Waiting for Lua socket on port $LUA_PORT"
for ((i=1; i<=LUA_TIMEOUT; i++)); do
    if ss -ltn | grep -Eq "[:.]${LUA_PORT}[[:space:]]"; then
        take_screenshot "$SCREENSHOT_OK"
        trap - EXIT
        log "Lua server is listening on port $LUA_PORT"
        exit 0
    fi
    sleep 1
done

fail "Lua server did not open port $LUA_PORT after ${LUA_TIMEOUT}s"
