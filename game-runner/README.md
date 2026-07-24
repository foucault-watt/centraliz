# Centraliz game runner

Ce dossier contient le workflow serveur du jeu Pokémon. Il remplace les anciens scripts manuels `start-game-foreground.sh`, `start-game-nymous.sh` et le fichier corrompu `restart-ui.sh.save`.

Le backend et le frontend ne sont pas concernés par cette étape.

## Chaîne de démarrage

```text
Xvfb :98
  -> Openbox
    -> mGBA 0.10.5 + ROM
      -> chargement du Lua + port 8888
        -> mGBA-http + port 5000
```

Chaque composant est un service systemd distinct. Un échec de chargement du Lua empêche mGBA-http de démarrer silencieusement dans un état inutilisable.

## Fichiers non versionnés à placer sur le serveur

```text
roms/game.gba
roms/game.sav
tools/mgba-http/mgba-http
tools/mgba-http/mGBASocketServer.lua
config/game-runner.env
```

La ROM, les sauvegardes, le binaire téléchargé, les logs et les save states sont volontairement ignorés par Git.

## Installation

Depuis `/home/fwattinne/centraliz/game-runner` :

```bash
cp config/game-runner.env.example config/game-runner.env
nano config/game-runner.env
sudo CENTRALIZ_RUN_USER=fwattinne \
  CENTRALIZ_GAME_RUNNER_DIR=/home/fwattinne/centraliz/game-runner \
  ./install-systemd.sh
```

Le compte du service doit rester `fwattinne`, car ses préférences mGBA contiennent le réglage indispensable :

```text
Sync Audio = désactivé
Sync Video = activé
```

## Utilisation quotidienne

```bash
./bin/gamectl.sh restart
./bin/gamectl.sh status
./bin/gamectl.sh health
./bin/gamectl.sh logs
./bin/gamectl.sh screenshot
./bin/gamectl.sh stop
./bin/gamectl.sh start
```

`restart` relance toute la chaîne et termine par un contrôle automatique du display, de Lua sur 8888 et de mGBA-http sur 5000.

## Premier démarrage

1. Vérifier tous les chemins dans `config/game-runner.env`.
2. Vérifier que `mgba-http` est exécutable.
3. Confirmer manuellement les réglages Sync Audio/Sync Video pour `fwattinne`.
4. Lancer `./bin/gamectl.sh restart`.
5. Si l'automatisation graphique échoue, faire une capture et ajuster uniquement les coordonnées dans la configuration.

Le chargeur Lua saisit le chemin complet de `mGBASocketServer.lua`. Il ne dépend plus de l'entrée « Load Recent Script » mémorisée par mGBA.

## Dépendances Debian

Le serveur doit fournir au minimum : `xvfb`, `openbox`, `xdotool`, `ffmpeg`, `curl`, `x11-utils`, mGBA 0.10.5 et le binaire mGBA-http.

## Développement local (WSL, sans systemd)

Les scripts `bin/*.sh` sont paramétrés par variables d'environnement (voir
`bin/common.sh`) et ne dépendent pas de systemd : `bin/start-local.sh` et
`bin/stop-local.sh` les enchaînent directement, en arrière-plan, avec des
fichiers PID dans `$STATE_DIR`.

Prérequis dans le WSL de dev :

```bash
sudo apt install xvfb openbox xdotool ffmpeg x11-utils curl mgba-qt
```

Si la ROM, `mgba-http` et le script Lua vivent déjà ailleurs que dans ce
dossier (ex. `~/pokemon-cloud/{roms,tools/mgba-http}`), il suffit de pointer
`GAME_RUNNER_DIR` dessus — les chemins par défaut de `common.sh`
(`$GAME_RUNNER_DIR/roms/game.gba`, `$GAME_RUNNER_DIR/tools/mgba-http/...`)
correspondent déjà à cette arborescence :

```bash
GAME_RUNNER_DIR="$HOME/pokemon-cloud" ./bin/start-local.sh
# ...
GAME_RUNNER_DIR="$HOME/pokemon-cloud" ./bin/stop-local.sh
```

Logs et PID atterrissent alors dans `$GAME_RUNNER_DIR/logs` et
`$GAME_RUNNER_DIR/state`. Le `DISPLAY_ID` par défaut (`:98`) convient aussi en
local tant qu'aucune autre instance Xvfb ne l'utilise déjà.

### Configuration du backend Node en dev (Node sous Windows, mGBA-http dans WSL)

Node et mGBA-http ne partagent pas le même système de fichiers : il faut deux
chemins explicites, sans conversion automatique — **mais le fichier de
capture doit rester sur le disque Windows monté** (ex. dans le dépôt), jamais
dans le filesystem natif de WSL (`~`, `/home/...`).

Pourquoi : WSL accède au disque Windows via `/mnt/c/...` (montage `drvfs`,
passthrough direct, sans cache). C'est la direction inverse — Windows qui lit
un chemin natif WSL via `\\wsl.localhost\...` — qui est mise en cache côté
Windows et ne reflète pas les réécritures fréquentes d'un même fichier
(testé et confirmé : le fichier changeait bien côté WSL pendant que Windows
relisait indéfiniment la même version en cache). En gardant le fichier côté
Windows, les deux processus y accèdent chacun par leur chemin natif, sans
jamais traverser cette route défaillante :

```bash
# .env du backend
MGBA_HTTP_BASE_URL=http://localhost:5000

# Chemin tel que mGBA-http (dans WSL) doit écrire le fichier de capture —
# l'équivalent /mnt/c/... du chemin par défaut (backend/src/data/pokemon-stream/latest.png).
POKEMON_MGBA_CAPTURE_PATH=/mnt/c/code/centraliz/backend/src/data/pokemon-stream/latest.png

# POKEMON_NODE_FRAME_PATH n'a pas besoin d'être défini : Node lit par défaut
# backend/src/data/pokemon-stream/latest.png, qui est déjà ce même fichier
# vu depuis Windows.
```

En production, Node et mGBA-http tournent sur le même hôte Linux : seul
`POKEMON_MGBA_CAPTURE_PATH` est nécessaire, `POKEMON_NODE_FRAME_PATH` retombe
sur la même valeur par défaut.

## Diagnostic rapide

```bash
./bin/healthcheck.sh --display
./bin/healthcheck.sh --lua
./bin/healthcheck.sh --http
journalctl -u centraliz-gba.service -n 100 --no-pager
```

Si le display fonctionne mais pas le port 8888, le problème se situe dans mGBA ou le chargement Lua. Si 8888 fonctionne mais pas 5000, le problème se situe dans mGBA-http.
