#!/usr/bin/env bash

set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"

usage() {
  printf 'Usage: %s {start|stop|restart|status|health|logs|screenshot}\n' "$0"
}

action="${1:-}"
case "$action" in
  start)
    sudo systemctl start centraliz-mgba-http.service
    "$SCRIPT_DIR/healthcheck.sh" --all
    ;;
  stop)
    sudo systemctl stop centraliz-mgba-http.service centraliz-gba.service centraliz-openbox.service centraliz-xvfb.service
    ;;
  restart)
    sudo systemctl stop centraliz-mgba-http.service centraliz-gba.service centraliz-openbox.service centraliz-xvfb.service
    sudo systemctl start centraliz-mgba-http.service
    "$SCRIPT_DIR/healthcheck.sh" --all
    ;;
  status)
    systemctl status --no-pager centraliz-xvfb.service centraliz-openbox.service centraliz-gba.service centraliz-mgba-http.service
    ;;
  health)
    "$SCRIPT_DIR/healthcheck.sh" --all
    ;;
  logs)
    journalctl -f -u centraliz-xvfb.service -u centraliz-openbox.service -u centraliz-gba.service -u centraliz-mgba-http.service
    ;;
  screenshot)
    "$SCRIPT_DIR/screenshot.sh" "${2:-}"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
