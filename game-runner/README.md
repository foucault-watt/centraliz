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

## Diagnostic rapide

```bash
./bin/healthcheck.sh --display
./bin/healthcheck.sh --lua
./bin/healthcheck.sh --http
journalctl -u centraliz-gba.service -n 100 --no-pager
```

Si le display fonctionne mais pas le port 8888, le problème se situe dans mGBA ou le chargement Lua. Si 8888 fonctionne mais pas 5000, le problème se situe dans mGBA-http.
