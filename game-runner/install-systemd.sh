#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  printf 'Lancez ce script avec sudo.\n' >&2
  exit 1
fi

RUN_USER="${CENTRALIZ_RUN_USER:-fwattinne}"
RUN_HOME="${CENTRALIZ_RUN_HOME:-$(getent passwd "$RUN_USER" | cut -d: -f6)}"
GAME_RUNNER_DIR="${CENTRALIZ_GAME_RUNNER_DIR:-$RUN_HOME/centraliz/game-runner}"
SOURCE_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"

[[ -n "$RUN_HOME" && -d "$RUN_HOME" ]] || { printf 'Utilisateur ou home invalide: %s\n' "$RUN_USER" >&2; exit 1; }
[[ "$GAME_RUNNER_DIR" = /* ]] || { printf 'Le chemin game-runner doit être absolu.\n' >&2; exit 1; }
[[ -d "$GAME_RUNNER_DIR/bin" ]] || { printf 'Dossier incomplet: %s\n' "$GAME_RUNNER_DIR" >&2; exit 1; }

if [[ ! -f "$GAME_RUNNER_DIR/config/game-runner.env" ]]; then
  cp "$GAME_RUNNER_DIR/config/game-runner.env.example" "$GAME_RUNNER_DIR/config/game-runner.env"
  chown "$RUN_USER" "$GAME_RUNNER_DIR/config/game-runner.env"
  printf 'Configuration créée: %s\n' "$GAME_RUNNER_DIR/config/game-runner.env"
  printf 'Vérifiez ses chemins avant de démarrer les services.\n'
fi

chmod +x "$GAME_RUNNER_DIR"/bin/*.sh "$GAME_RUNNER_DIR/install-systemd.sh"

for template in "$SOURCE_DIR"/systemd/*.service.in; do
  unit_name="$(basename -- "$template" .in)"
  sed \
    -e "s|@RUN_USER@|$RUN_USER|g" \
    -e "s|@RUN_HOME@|$RUN_HOME|g" \
    -e "s|@GAME_RUNNER_DIR@|$GAME_RUNNER_DIR|g" \
    "$template" >"/etc/systemd/system/$unit_name"
done

systemctl daemon-reload
systemctl enable centraliz-xvfb.service centraliz-openbox.service centraliz-gba.service centraliz-mgba-http.service

printf 'Services installés. Après vérification de la configuration, lancez:\n'
printf '  %s/bin/gamectl.sh restart\n' "$GAME_RUNNER_DIR"
