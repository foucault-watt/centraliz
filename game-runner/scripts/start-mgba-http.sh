#!/usr/bin/env bash
set -Eeuo pipefail

readonly BASE="${CENTRALIZ_GAME_DIR:-$HOME/centraliz/game-runner}"
readonly TOOL_DIR="$BASE/tools/mgba-http"
readonly BINARY="$TOOL_DIR/mgba-http"
readonly LOG_DIR="$BASE/logs"
readonly STATE_DIR="$BASE/state"
readonly PID_FILE="$STATE_DIR/mgba-http.pid"
readonly LOG_FILE="$LOG_DIR/mgba-http.log"
readonly LUA_PORT="${LUA_PORT:-8888}"
readonly HTTP_PORT="${MGBA_HTTP_PORT:-5000}"
readonly START_TIMEOUT="${MGBA_HTTP_START_TIMEOUT:-20}"
readonly HEALTH_URL="${MGBA_HTTP_HEALTH_URL:-http://127.0.0.1:${HTTP_PORT}/core/currentFrame}"

log() { printf '[mgba-http] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }
port_is_open() { ss -ltn | grep -Eq "[:.]${1}[[:space:]]"; }
api_responds() { curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; }
pid_is_running() { [[ "$1" =~ ^[0-9]+$ ]] && kill -0 "$1" 2>/dev/null; }

mkdir -p "$LOG_DIR" "$STATE_DIR"
command -v ss >/dev/null 2>&1 || fail "ss is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
[[ -x "$BINARY" ]] || fail "Binary missing or not executable: $BINARY"

port_is_open "$LUA_PORT" || fail "Lua server is not listening on port $LUA_PORT"

if api_responds; then
    log "mGBA-http already responds on port $HTTP_PORT"
    exit 0
fi

if port_is_open "$HTTP_PORT"; then
    fail "Port $HTTP_PORT is occupied but the API does not respond"
fi

if [[ -f "$PID_FILE" ]]; then
    old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if pid_is_running "$old_pid"; then
        current_exe="$(readlink -f "/proc/$old_pid/exe" 2>/dev/null || true)"
        expected_exe="$(readlink -f "$BINARY")"
        [[ "$current_exe" == "$expected_exe" ]]             && fail "mGBA-http exists with PID $old_pid but its API does not respond"
        fail "PID file points to another process; refusing to kill it"
    fi
    rm -f "$PID_FILE"
fi

log "Starting mGBA-http"
(
    cd "$TOOL_DIR"
    nohup "$BINARY" >>"$LOG_FILE" 2>&1 &
    printf '%s\n' "$!" >"$PID_FILE"
)

new_pid="$(cat "$PID_FILE")"
for ((i=1; i<=START_TIMEOUT; i++)); do
    if api_responds; then
        log "mGBA-http ready on port $HTTP_PORT (PID $new_pid)"
        exit 0
    fi
    if ! pid_is_running "$new_pid"; then
        rm -f "$PID_FILE"
        fail "mGBA-http exited during startup; inspect $LOG_FILE"
    fi
    sleep 1
done

fail "mGBA-http did not become ready after ${START_TIMEOUT}s; inspect $LOG_FILE"
