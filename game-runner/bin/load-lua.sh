#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

require_command xdotool
require_file "$LUA_SCRIPT_PATH"

export DISPLAY="$DISPLAY_ID"

window_timeout="${WINDOW_TIMEOUT_SECONDS:-30}"
lua_timeout="${LUA_TIMEOUT_SECONDS:-30}"
main_name="${MGBA_WINDOW_NAME:-mGBA}"
scripting_name="${SCRIPTING_WINDOW_NAME:-Scripting}"

find_window() {
  local name="$1"
  local timeout="$2"
  local deadline=$((SECONDS + timeout))
  local window_id=""

  while ((SECONDS < deadline)); do
    window_id="$(xdotool search --onlyvisible --name "$name" 2>/dev/null | tail -n 1 || true)"
    if [[ -n "$window_id" ]]; then
      printf '%s\n' "$window_id"
      return 0
    fi
    sleep 1
  done

  return 1
}

if wait_for_tcp "$LUA_HOST" "$LUA_PORT" 1; then
  log "Lua écoute déjà sur $LUA_HOST:$LUA_PORT"
  exit 0
fi

log "attente de la fenêtre mGBA"
main_window="$(find_window "$main_name" "$window_timeout")" || fail "fenêtre mGBA introuvable"
xdotool windowactivate --sync "$main_window"

# Ouvre Tools > Scripting avec des coordonnées relatives à la fenêtre principale.
xdotool mousemove --window "$main_window" "${TOOLS_MENU_X:-500}" "${TOOLS_MENU_Y:-218}" click 1
sleep 0.5
xdotool mousemove --window "$main_window" "${SCRIPTING_ITEM_X:-500}" "${SCRIPTING_ITEM_Y:-355}" click 1

log "attente de la fenêtre Scripting"
scripting_window="$(find_window "$scripting_name" "$window_timeout")" || fail "fenêtre Scripting introuvable"
xdotool windowactivate --sync "$scripting_window"

# Ouvre File > Load script..., puis saisit toujours le chemin exact du Lua.
# Cela évite de dépendre de la liste fragile « Load Recent Script ».
xdotool mousemove --window "$scripting_window" "${SCRIPT_FILE_MENU_X:-15}" "${SCRIPT_FILE_MENU_Y:-25}" click 1
sleep 0.5
xdotool mousemove --window "$scripting_window" "${LOAD_SCRIPT_ITEM_X:-15}" "${LOAD_SCRIPT_ITEM_Y:-55}" click 1
sleep 1
xdotool key --clearmodifiers ctrl+l
sleep 0.2
xdotool type --clearmodifiers --delay 1 "$LUA_SCRIPT_PATH"
xdotool key --clearmodifiers Return

log "attente du serveur Lua sur $LUA_HOST:$LUA_PORT"
wait_for_tcp "$LUA_HOST" "$LUA_PORT" "$lua_timeout" || fail "Lua n'écoute pas après ${lua_timeout}s"
log "script Lua chargé"
