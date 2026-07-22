#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

require_command ffmpeg
output="${1:-$LOG_DIR/screen-$(date +%Y%m%d-%H%M%S).png}"
mkdir -p "$(dirname -- "$output")"

ffmpeg -y -v error \
  -f x11grab \
  -video_size "${SCREEN_GEOMETRY%x24}" \
  -i "$DISPLAY_ID" \
  -frames:v 1 \
  -update 1 \
  "$output"

log "capture créée: $output"
