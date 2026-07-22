#!/usr/bin/env bash
set -Eeuo pipefail

readonly BASE="${CENTRALIZ_GAME_DIR:-$HOME/centraliz/game-runner}"
readonly LOG_DIR="$BASE/logs"
readonly DISPLAY_ID="${DISPLAY:-:98}"
readonly OUTPUT="${1:-$LOG_DIR/screen.png}"

mkdir -p "$(dirname "$OUTPUT")"

ffmpeg -y -v error -f x11grab -video_size 1024x768 -i "$DISPLAY_ID"     -frames:v 1 -update 1 "$OUTPUT"

printf '[capture-screen] %s\n' "$OUTPUT"
