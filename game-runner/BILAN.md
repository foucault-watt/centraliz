# Bilan du projet Pokémon : 26 novembre 2026

Ce bilan s'appuie sur des tests faits à distance sur le serveur (`npm run pokemon:remote`). Il ne reprend pas la documentation.

## Ce qui marche

| Couche | État | Preuve |
|---|---|---|
| Xvfb, Openbox, mGBA (`centraliz-*.service`) | ✅ en marche depuis le 2 nov. (24 j sans interruption) | `systemctl is-active` |
| Émulation | ✅ environ 57 fps | compteur de frames sur 20 s |
| Bug Sync Audio | ✅ corrigé (`audioSync=0`, `videoSync=1`) | `~/.config/mgba/config.ini` |
| Script Lua (port 8888) | ✅ chargé au démarrage par xdotool | journal du 2 nov., port en écoute |
| mGBA-http (port 5000) | ✅ environ 10 ms de latence, en écoute sur 127.0.0.1 seulement | `curl` |
| Boutons (`/mgba-http/button/tap`) | ✅ START et A font bien avancer le jeu | captures avant et après |
| Capture native (`/core/screenshot`) | ✅ PNG 240x160 | `pokemon:remote native` |
| Backend : routes `/api/pokemon/{health,input,frame,frame-status}` | ✅ codées et déployées | fichiers présents sur le serveur |
| Frontend : `Pokemon.jsx` | ✅ codé, onglet masqué (piloté par l'admin des pages de navigation) | |

En bref, toute la chaîne technique fonctionne de bout en bout. Le projet n'est pas bloqué techniquement. Il est bloqué par la persistance, la robustesse et le gameplay collectif.

## Problèmes trouvés

### 1. ✅ Le port Lua 8888 écoutait sur toutes les interfaces (corrigé le 26 nov.)

`mGBASocketServer.lua` faisait `socket.bind(nil, port)`, donc il écoutait sur `0.0.0.0` à l'intérieur du conteneur. Depuis le réseau interne, on pouvait donc :

- appuyer sur les boutons ;
- écrire dans la mémoire du jeu (`core.write8` et `core.write32`) ;
- écrire un save state à un chemin arbitraire (`core.savestatefile`).

Depuis Internet, en revanche, il n'était **pas** joignable. Le port public 8888 est une redirection de l'administrateur vers un autre serveur SSH (OpenSSH 7.4, Debian 9), pas vers le Lua.

**Correctif appliqué :** `socket.bind("127.0.0.1", port)`, puis redémarrage de `centraliz-gba.service`. L'ancien script est sauvegardé dans `scripts/mGBASocketServer.lua.before-localhost-20261126-224424`. Après redémarrage, `ss` montre `127.0.0.1:8888`, la pile est saine (60 fps) et les boutons fonctionnent.

### 2. 🟠 La partie redémarre sur l'écran titre, sans sauvegarde

Un appui sur START depuis l'écran titre lance directement une nouvelle partie : aucune sauvegarde valide n'est chargée. `roms/game.sav` date du 24 mai. Aucun save state n'est fait automatiquement (`state/` est vide). Un redémarrage du service fait donc perdre toute la progression.

### 3. 🟠 La file Lua se bloque

Le serveur Lua traite les connexions une par une. Les requêtes abandonnées par un client (timeouts) s'empilent, et l'API met alors 20 à 40 s à répondre, jusqu'à ce que la file se vide. Le backend utilise un timeout de 3 s et capture à 10 fps : dès que mGBA ralentit, il peut entretenir lui-même ce bouchon.

### 4. 🟡 Défauts dans le backend

- ✅ *(corrigé le 27 nov.)* Image périmée : le backend attend maintenant une image plus récente que la précédente avant de la lire.
- ✅ *(corrigé le 27 nov.)* Cadence de capture dynamique : le serveur capture au rythme du spectateur le plus exigeant (`?fps=`, 30 img/s maximum via `POKEMON_MAX_FPS`, 10 par défaut) et s'arrête au bout de 15 s sans spectateur.
- Aucune file d'attente, aucune limite de débit par utilisateur, aucun historique des commandes. Chaque clic part directement vers mGBA-http.
- `getHealth` appelle `GET /`, qui ne prouve pas que Lua répond. Il faudrait utiliser `/core/currentFrame`.
- Le message d'erreur parle encore de « WSL ».

### 5. 🟡 Écart entre le dépôt et le serveur

- Le dépôt contient une version refaite (`game-runner/bin/gamectl.sh`, unités systemd dont `centraliz-mgba-http.service`). **Elle n'est pas déployée** : le serveur utilise encore les anciens `game-runner/scripts/*.sh`, avec 6 copies de sauvegarde de `load-lua.sh`.
- `centraliz-mgba-http.service` n'existe pas : mGBA-http reste un processus enfant lancé par `nohup`.
- `mGBASocketServer.lua` n'est pas versionné.

### 6. ⚪ Ménage à faire sur le serveur

- `logs/mgba-http.log` : 7,8 millions de lignes, environ 1,2 Go sans compression. Aucune rotation.
- 19 fichiers `core.*` (dumps de plantage du 28 mai) dans `game-runner/`.
- Une quarantaine de captures de debug dans `logs/`.

## Ce qui reste pour une première version jouable

1. ~~**Sécurité** : brancher le Lua sur 127.0.0.1~~ (fait le 26 nov.).
2. **Persistance** : save state automatique toutes les 10 min avec rotation, et restauration au démarrage. Avant ça, sauvegarder `game.sav`.
3. **Backend** : une file d'attente unique, une limite par utilisateur, une boucle de capture qui ne tourne qu'en présence de spectateurs, le correctif du fichier de capture périmé, et un health check basé sur les frames.
4. **Frontend** : rouvrir l'onglet Pokémon pour une promo de test depuis l'admin, et le vérifier sur la prod.
5. **Exploitation** : déployer `gamectl.sh` ou fusionner ses améliorations dans `scripts/`, ajouter la rotation de `mgba-http.log`, et demander à l'administrateur l'unité `centraliz-mgba-http.service`.

## Outils créés

- `tools/pokemon-remote.cjs` (`npm run pokemon:remote`) : diagnostic, captures, boutons, logs, exec, get/put et redémarrage à distance.
- `docs/agents/pokemon-server.md` : mode d'emploi et pièges, référencé depuis `AGENTS.md`.
