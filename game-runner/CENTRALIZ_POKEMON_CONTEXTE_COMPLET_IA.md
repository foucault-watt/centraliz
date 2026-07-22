# Centraliz Pokémon collaboratif — Contexte complet pour une autre IA

> Document de transmission technique et fonctionnelle.
>
> Objectif : permettre à une autre IA, un développeur ou un administrateur de reprendre le projet sans devoir reconstituer tout l’historique.
>
> Dernière consolidation : juillet 2026.

---

# 1. Résumé exécutif

Le projet consiste à intégrer à **Centraliz** une expérience de jeu Pokémon GBA collaborative inspirée de **Twitch Plays Pokémon**.

Une ROM Pokémon tourne en continu dans l’émulateur **mGBA** sur un serveur Linux Debian sans écran physique. Les utilisateurs de Centraliz doivent pouvoir envoyer des commandes depuis une interface web. Ces commandes transitent par le backend, puis par un pont HTTP vers un script Lua exécuté dans mGBA.

L’architecture fonctionnelle visée est :

```text
Utilisateurs
    │
    ▼
Frontend Centraliz en React
    │
    ▼
Backend Centraliz en Node.js
    │
    ▼
API HTTP locale mGBA-http — port 5000
    │
    ▼
Socket TCP du script Lua mGBA — port 8888
    │
    ▼
mGBA
    │
    ▼
ROM Pokémon GBA
```

La pile graphique côté serveur est :

```text
Xvfb :98
    │
    ▼
Openbox
    │
    ▼
mGBA Qt 0.10.5
```

La pile de contrôle est :

```text
mGBA
    │ charge
    ▼
mGBASocketServer.lua
    │ écoute sur localhost:8888
    ▼
mGBA-http
    │ écoute sur localhost:5000
    ▼
Backend Node.js
```

Le principal blocage historique provenait d’un réglage mGBA : **la synchronisation audio était activée sur un serveur sans périphérique audio**. mGBA attendait un flux audio inexistant et la boucle d’émulation ne progressait pas correctement.

Le correctif critique est :

```text
Tools > Settings > Gameplay
Sync Audio : désactivé
Sync Video : activé
```

Cette configuration est enregistrée dans le profil Linux de l’utilisateur :

```text
fwattinne
```

Le service mGBA doit donc continuer à être exécuté sous cet utilisateur, sauf migration explicite et reproduction de la configuration.

---

# 2. Finalité du projet

## 2.1 Expérience utilisateur visée

Le produit final doit permettre à plusieurs utilisateurs connectés à Centraliz de :

- voir l’écran du jeu dans leur navigateur ;
- envoyer des commandes de type haut, bas, gauche, droite, A, B, Start, Select ;
- participer collectivement à une partie unique persistante ;
- observer les actions des autres utilisateurs ;
- reprendre la partie après un redémarrage du serveur ;
- conserver l’historique minimal des commandes et événements ;
- disposer d’une expérience suffisamment stable pour rester disponible en continu.

## 2.2 Objectifs techniques

Les objectifs techniques principaux sont :

- faire tourner la ROM 24 h/24 ;
- isoler le contrôle du jeu du frontend ;
- ne pas exposer directement mGBA-http à Internet ;
- contrôler le débit des commandes ;
- empêcher un utilisateur de monopoliser le jeu ;
- générer un affichage navigateur quasi temps réel ;
- sauvegarder régulièrement la partie ;
- restaurer un état cohérent après incident ;
- journaliser les erreurs ;
- détecter automatiquement les composants indisponibles ;
- éviter les processus dupliqués ;
- rendre le système maintenable malgré l’absence de droits `sudo` pour le développeur principal.

---

# 3. Stack technique

## 3.1 Application Centraliz

- Frontend : React
- Backend : Node.js
- Base de données et services associés : Supabase
- Communication frontend/backend : à confirmer selon le code actuel
- Communication backend/jeu : HTTP local vers mGBA-http
- Authentification et gestion des utilisateurs : probablement via Supabase, à confirmer dans le dépôt

## 3.2 Serveur de jeu

- Système : Debian Linux
- Utilisateur d’exécution : `fwattinne`
- Émulateur : mGBA Qt 0.10.5
- Affichage virtuel : Xvfb
- Gestionnaire de fenêtres : Openbox
- Automatisation GUI : xdotool
- Captures d’écran : ffmpeg
- Script embarqué : Lua
- Pont HTTP : mGBA-http
- Gestion des processus principaux : systemd

## 3.3 Réseau local

Ports connus :

```text
8888/tcp : socket Lua ouvert dans mGBA
5000/tcp : API HTTP mGBA-http
```

Ces services doivent idéalement rester accessibles uniquement en local :

```text
127.0.0.1
```

Le backend Node.js est le composant qui doit exposer une interface sécurisée au frontend.

---

# 4. Architecture fonctionnelle détaillée

## 4.1 Envoi d’une commande

Flux attendu :

```text
1. Un utilisateur clique sur un bouton dans React.
2. Le frontend envoie une commande au backend Node.js.
3. Le backend authentifie et valide l’utilisateur.
4. Le backend applique les règles de débit et de priorité.
5. La commande est ajoutée à une file d’attente.
6. Un worker retire la commande de la file.
7. Le backend appelle mGBA-http.
8. mGBA-http transmet la commande au serveur Lua.
9. Lua agit sur les boutons de l’émulateur.
10. mGBA exécute l’action dans la ROM.
```

Exemples de commandes :

```text
UP
DOWN
LEFT
RIGHT
A
B
START
SELECT
```

Une commande de type « tap » doit généralement produire :

```text
appui
courte attente
relâchement
```

## 4.2 Lecture de l’état

Le backend peut utiliser mGBA-http pour :

- obtenir le titre du jeu ;
- obtenir le numéro de frame courant ;
- déclencher une capture ;
- sauvegarder un état ;
- charger un état ;
- envoyer un bouton.

Endpoints connus ou envisagés :

```text
GET  /core/getgametitle
GET  /core/currentFrame
POST /core/screenshot
POST /core/savestatefile
POST /core/loadstatefile
POST /mgba-http/button/tap
```

Les noms exacts et formats de payload doivent être confirmés dans le Swagger local :

```text
http://localhost:5000/index.html
http://localhost:5000/swagger/v0.8.2/swagger.json
```

## 4.3 Affichage navigateur

La GBA produit une image native de :

```text
240 × 160 pixels
```

L’approche initiale recommandée est une succession de captures PNG plutôt qu’un flux vidéo lourd.

Fréquence proposée :

```text
2 à 5 images par seconde
```

Rendu frontend :

```css
image-rendering: pixelated;
```

Avantages :

- architecture simple ;
- faible complexité d’encodage ;
- bande passante raisonnable ;
- cohérent avec le rendu pixel art ;
- débogage facile.

Inconvénients :

- latence visuelle supérieure à une vraie vidéo ;
- succession de requêtes ou nécessité d’un canal poussé ;
- coût CPU des captures si elles sont trop fréquentes ;
- risque de surcharge si chaque client déclenche ses propres captures.

La capture doit donc être mutualisée côté serveur : une seule production d’image, diffusée à tous les clients.

---

# 5. Organisation des fichiers

Chemin racine principal :

```text
/home/fwattinne/centraliz
```

Organisation connue :

```text
/home/fwattinne/centraliz/
├── frontend/
├── backend/
└── game-runner/
    ├── roms/
    │   ├── game.gba
    │   └── game.sav
    ├── logs/
    ├── state/
    ├── scripts/
    │   ├── start-game-nymous.sh
    │   ├── load-lua.sh
    │   ├── start-mgba-http.sh
    │   ├── healthcheck.sh
    │   └── capture-screen.sh
    └── tools/
        └── mgba-http/
            ├── mgba-http
            ├── mGBASocketServer.lua
            ├── index.html
            └── swagger/
```

Chemins importants :

```text
ROM :
/home/fwattinne/centraliz/game-runner/roms/game.gba

Sauvegarde classique :
/home/fwattinne/centraliz/game-runner/roms/game.sav

Binaire mGBA-http :
/home/fwattinne/centraliz/game-runner/tools/mgba-http/mgba-http

Script Lua :
/home/fwattinne/centraliz/game-runner/tools/mgba-http/mGBASocketServer.lua

Scripts d’exploitation :
/home/fwattinne/centraliz/game-runner/scripts

Logs :
/home/fwattinne/centraliz/game-runner/logs

État de processus et save states :
/home/fwattinne/centraliz/game-runner/state
```

---

# 6. Contraintes d’administration

Le compte `fwattinne` ne possède pas de droits `sudo`.

Conséquences :

- il ne peut pas modifier directement `/etc/systemd/system/*.service` ;
- il ne peut pas installer ou modifier des services système sans l’administrateur ;
- il peut modifier les scripts situés dans son répertoire personnel ;
- il peut contrôler certains services avec `systemctl` si l’administrateur lui a accordé les permissions nécessaires ;
- il peut consulter les logs avec `journalctl -u ...` si les permissions le permettent ;
- les évolutions d’infrastructure doivent minimiser les interventions administrateur.

Le compromis actuel consiste à faire appeler un script modifiable par `fwattinne` depuis le service `centraliz-gba.service`.

---

# 7. Services systemd connus

L’administrateur a construit une chaîne de trois services :

```text
centraliz-xvfb.service
        ↓
centraliz-openbox.service
        ↓
centraliz-gba.service
```

Chaque service dépend du précédent.

Comportement décrit par l’administrateur :

- démarrer `centraliz-gba.service` démarre automatiquement Openbox et Xvfb si nécessaire ;
- arrêter Xvfb entraîne d’abord l’arrêt des services dépendants ;
- `centraliz-gba.service` lance mGBA Qt ;
- après le démarrage de mGBA, il lance :
  `/home/fwattinne/centraliz/game-runner/scripts/start-game-nymous.sh` ;
- la variable `DISPLAY` est fournie par le service ;
- le display actuellement configuré est `:98`.

Commandes d’exploitation :

```bash
systemctl start centraliz-gba.service
systemctl stop centraliz-gba.service
systemctl restart centraliz-gba.service
systemctl status centraliz-gba.service
journalctl -u centraliz-gba.service
journalctl -u centraliz-gba.service -f
```

Vérification de la chaîne :

```bash
systemctl status centraliz-{xvfb,openbox,gba}.service
```

Les fichiers exacts des unités systemd ne sont pas présents dans cette documentation. Toute IA doit éviter d’inventer leur contenu.

---

# 8. Affichage virtuel

## 8.1 Xvfb

Xvfb fournit un serveur X virtuel sur une machine sans écran physique.

Configuration connue :

```text
DISPLAY=:98
Résolution : 1024x768
Profondeur : 24 bits
```

Commande équivalente typique :

```bash
Xvfb :98 -screen 0 1024x768x24
```

## 8.2 Openbox

Openbox gère les fenêtres Qt de mGBA dans l’affichage virtuel.

Commande équivalente :

```bash
DISPLAY=:98 openbox
```

## 8.3 mGBA

Commande équivalente :

```bash
DISPLAY=:98 /usr/games/mgba-qt \
  /home/fwattinne/centraliz/game-runner/roms/game.gba
```

La commande exacte du service doit être vérifiée avec :

```bash
systemctl cat centraliz-gba.service
```

si l’utilisateur dispose du droit de lecture.

---

# 9. Chargement du script Lua

## 9.1 Pourquoi xdotool est utilisé

Dans la configuration actuelle, le script Lua n’est pas chargé de manière fiable par une simple option de ligne de commande de mGBA.

Le chargement est automatisé à travers l’interface graphique :

```text
Tools
→ Scripting
→ File
→ Load Recent Script
→ mGBASocketServer.lua
```

mGBA mémorise le dernier script Lua chargé dans les préférences de l’utilisateur.

## 9.2 Fragilité

L’automatisation dépend encore de coordonnées graphiques.

Elle peut casser si :

- la fenêtre mGBA change de taille ;
- le menu change ;
- le thème Qt modifie la géométrie ;
- une boîte de dialogue apparaît ;
- la fenêtre n’a pas le focus ;
- mGBA démarre plus lentement ;
- le dernier script mémorisé n’est plus le bon ;
- un autre processus utilise le même display.

## 9.3 Critère de succès

Le succès ne doit pas être déterminé seulement par l’exécution de clics.

Le véritable critère est :

```text
un processus écoute sur le port TCP 8888
```

Commande :

```bash
ss -ltnp | grep 8888
```

Message Lua attendu :

```text
mGBA script server 0.8.2 ready. Listening on port 8888
```

---

# 10. Scripts serveur actuels

## 10.1 `start-game-nymous.sh`

Rôle :

- point d’entrée appelé par `centraliz-gba.service` ;
- récupère `DISPLAY`, normalement `:98` ;
- appelle `load-lua.sh` ;
- appelle `start-mgba-http.sh` ;
- lance `healthcheck.sh` ;
- s’arrête en erreur si une étape obligatoire échoue.

Il ne doit pas relancer lui-même Xvfb, Openbox ou mGBA.

## 10.2 `load-lua.sh`

Rôle :

- vérifier la présence de `xdotool` et `ss` ;
- vérifier la connexion à `DISPLAY` ;
- éviter un rechargement si le port 8888 est déjà ouvert ;
- attendre une fenêtre visible mGBA ;
- activer la fenêtre ;
- naviguer dans les menus ;
- charger le script récent ;
- attendre l’ouverture du port 8888 ;
- prendre une capture de succès ou d’échec.

Variables configurables :

```text
CENTRALIZ_GAME_DIR
DISPLAY
LUA_PORT
MGBA_WAIT_TIMEOUT
LUA_WAIT_TIMEOUT
```

Valeurs par défaut :

```text
CENTRALIZ_GAME_DIR=$HOME/centraliz/game-runner
DISPLAY=:98
LUA_PORT=8888
MGBA_WAIT_TIMEOUT=30
LUA_WAIT_TIMEOUT=20
```

Captures :

```text
logs/lua-bootstrap.png
logs/lua-bootstrap-error.png
```

## 10.3 `start-mgba-http.sh`

Rôle :

- vérifier que Lua écoute sur 8888 ;
- vérifier si l’API répond déjà sur 5000 ;
- refuser de démarrer si le port 5000 est occupé par un service incohérent ;
- gérer un fichier PID ;
- supprimer un PID obsolète ;
- lancer mGBA-http avec `nohup` ;
- rediriger les logs ;
- attendre que l’API réponde ;
- échouer proprement si le processus quitte ou ne devient pas sain.

Fichiers utilisés :

```text
logs/mgba-http.log
state/mgba-http.pid
```

Variables configurables :

```text
CENTRALIZ_GAME_DIR
LUA_PORT
MGBA_HTTP_PORT
MGBA_HTTP_START_TIMEOUT
MGBA_HTTP_HEALTH_URL
```

Valeurs par défaut :

```text
LUA_PORT=8888
MGBA_HTTP_PORT=5000
MGBA_HTTP_START_TIMEOUT=20
MGBA_HTTP_HEALTH_URL=http://127.0.0.1:5000/core/currentFrame
```

Limite majeure :

mGBA-http est lancé en arrière-plan depuis un script appelé par systemd, mais il n’est pas un service systemd indépendant.

Conséquences :

- systemd ne surveille pas directement sa santé ;
- il peut rester vivant après un redémarrage de mGBA ;
- il peut mourir plus tard sans redémarrage automatique ;
- son cycle de vie n’est pas parfaitement couplé à celui de la pile.

La solution définitive reste un service dédié créé par l’administrateur.

## 10.4 `healthcheck.sh`

Contrôles :

- Xvfb ;
- Openbox ;
- mGBA Qt ;
- mGBA-http ;
- port Lua 8888 ;
- port HTTP 5000 ;
- endpoint `/core/currentFrame`.

Sortie :

```text
[OK] ...
[FAIL] ...
```

Code de sortie :

```text
0 : tout est sain
1 : au moins un contrôle a échoué
```

## 10.5 `capture-screen.sh`

Rôle :

- capturer une image du display ;
- utiliser `ffmpeg` et `x11grab` ;
- écrire par défaut dans `logs/screen.png`.

Exemples :

```bash
~/centraliz/game-runner/scripts/capture-screen.sh

~/centraliz/game-runner/scripts/capture-screen.sh \
  /tmp/centraliz-screen.png
```

---

# 11. mGBA-http

## 11.1 Rôle

mGBA-http est un serveur web local qui expose une API HTTP.

Lancement manuel :

```bash
cd ~/centraliz/game-runner/tools/mgba-http
./mgba-http
```

Sortie observée :

```text
Now listening on: http://localhost:5000
Application started. Press Ctrl+C to shut down.
Hosting environment: Production
Content root path: /home/fwattinne/centraliz/game-runner/tools/mgba-http
```

Le processus reste au premier plan lorsqu’il est lancé manuellement. C’est normal pour un serveur web.

## 11.2 Dépendance à Lua

mGBA-http communique avec le script Lua sur :

```text
127.0.0.1:8888
```

Si Lua n’est pas chargé :

```text
Connection refused 127.0.0.1:8888
```

Cela signifie généralement :

- mGBA-http est démarré ;
- mais le serveur Lua n’écoute pas.

## 11.3 Tests rapides

```bash
curl -m 3 http://localhost:5000/core/getgametitle
curl -m 3 http://localhost:5000/core/currentFrame
```

Vérification du port :

```bash
ss -ltnp | grep 5000
```

Logs :

```bash
tail -f ~/centraliz/game-runner/logs/mgba-http.log
```

---

# 12. Incident majeur historique : synchronisation audio

## 12.1 Symptômes

Avec mGBA 0.10.1 puis pendant les investigations :

- fenêtre mGBA présente ;
- titre du jeu visible ;
- écran gris ou blanc ;
- aucun FPS apparent ;
- ROM ne progressant pas ;
- Lua inactif ;
- mGBA-http bloqué ou incapable de communiquer ;
- erreurs ALSA ;
- messages Qt/OpenGL.

Message notable :

```text
QOpenGLContext::swapBuffers() called with non-exposed window
```

## 12.2 Hypothèses explorées

- bug OpenGL ;
- problème Xvfb ;
- problème Qt ;
- sandbox systemd ;
- problème ROM ;
- problème Lua ;
- problème xdotool ;
- version mGBA ;
- absence de périphérique audio.

## 12.3 Cause réelle

Le serveur ne possède pas de périphérique audio.

mGBA était configuré pour synchroniser l’émulation sur l’audio :

```text
Sync Audio = activé
```

Le flux audio attendu n’existait pas.

Résultat :

```text
la boucle d’émulation ne progressait pas correctement
```

## 12.4 Correctif appliqué

Dans mGBA :

```text
Tools
→ Settings
→ Gameplay
```

Réglages :

```text
Sync Audio : désactivé
Sync Video : activé
```

Puis :

```bash
systemctl restart centraliz-gba.service
```

## 12.5 Conséquence opérationnelle

La configuration est liée au profil de l’utilisateur Linux `fwattinne`.

Il faut :

- exécuter mGBA sous `fwattinne` ;
- conserver son dossier de configuration ;
- vérifier ces réglages après migration ;
- ne pas réinitialiser les préférences mGBA sans précaution.

---

# 13. Version mGBA

Version serveur actuelle connue :

```text
mGBA 0.10.5
```

Ancienne version problématique :

```text
mGBA 0.10.1
```

La ROM, mGBA-http et Lua avaient fonctionné en environnement WSL avec une version plus récente, ce qui a aidé à isoler le problème serveur.

Toute mise à jour de mGBA doit être validée avec :

- démarrage de la ROM ;
- progression des frames ;
- chargement Lua ;
- port 8888 ;
- communication mGBA-http ;
- capture d’écran ;
- sauvegarde et restauration.

---

# 14. Sauvegardes

## 14.1 Sauvegarde classique

Fichier :

```text
roms/game.sav
```

Il s’agit de la sauvegarde native du jeu.

Avantages :

- format naturel du jeu ;
- robuste ;
- indépendant d’un état exact de l’émulateur.

Limites :

- ne capture pas l’état exact entre deux sauvegardes du jeu ;
- peut perdre quelques minutes de progression.

## 14.2 Save states

Endpoints envisagés :

```text
/core/savestatefile
/core/loadstatefile
```

Stockage proposé :

```text
state/
```

Stratégie recommandée :

```text
state/
├── latest.ss
├── previous.ss
├── hourly/
└── daily/
```

Règles proposées :

- état toutes les 5 à 15 minutes ;
- rotation de plusieurs versions ;
- sauvegarde native conservée ;
- copie externe périodique ;
- validation d’un état avant suppression des anciens ;
- ne jamais dépendre d’un seul fichier.

## 14.3 Reprise après redémarrage

Ordre recommandé :

```text
1. démarrer Xvfb ;
2. démarrer Openbox ;
3. démarrer mGBA avec la ROM ;
4. charger Lua ;
5. démarrer mGBA-http ;
6. vérifier les frames ;
7. charger le dernier save state valide si prévu ;
8. reprendre les commandes utilisateurs.
```

Attention : charger automatiquement un save state à chaque démarrage peut écraser une sauvegarde native plus récente si la stratégie n’est pas cohérente.

---

# 15. Backend Node.js — responsabilités recommandées

Le backend ne doit pas être un simple proxy aveugle vers mGBA-http.

Il doit gérer :

- authentification ;
- autorisation ;
- validation des commandes ;
- limitation de débit ;
- file d’attente ;
- sérialisation des actions ;
- gestion des conflits ;
- journalisation ;
- métriques ;
- erreurs de mGBA-http ;
- état de disponibilité du jeu ;
- diffusion des captures ;
- règles de gameplay collectif.

## 15.1 File d’attente

Une file est indispensable pour éviter :

- commandes simultanées ;
- touches qui se chevauchent ;
- surcharge de mGBA-http ;
- comportements non déterministes ;
- abus.

Structure logique :

```text
command_id
user_id
button
created_at
status
executed_at
error
```

États possibles :

```text
queued
processing
executed
rejected
failed
expired
```

## 15.2 Règles de débit

Exemples :

- une commande par utilisateur toutes les 500 ms à 2 s ;
- limite globale de commandes par seconde ;
- taille maximale de file ;
- expiration des commandes trop anciennes ;
- priorité éventuelle aux commandes de modération ;
- blocage temporaire en cas d’abus.

## 15.3 Sécurité

Ne pas exposer directement :

```text
localhost:5000
localhost:8888
```

Le frontend ne doit jamais appeler mGBA-http directement.

Le backend doit appliquer une liste blanche stricte de boutons.

Exemple :

```text
UP DOWN LEFT RIGHT A B START SELECT
```

Aucune chaîne arbitraire ne doit être envoyée à mGBA-http.

---

# 16. Frontend React — responsabilités recommandées

Le frontend doit afficher :

- écran du jeu ;
- commandes disponibles ;
- état de connexion ;
- latence approximative ;
- file ou historique récent ;
- utilisateur ayant envoyé la dernière action ;
- état du serveur ;
- éventuelles règles du mode de jeu.

États d’interface :

```text
online
degraded
reconnecting
offline
maintenance
```

Le frontend doit gérer :

- perte de connexion ;
- image temporairement indisponible ;
- backend lent ;
- commande refusée ;
- commande expirée ;
- utilisateur non authentifié.

---

# 17. Captures et diffusion

## 17.1 Capture X11

Commande utilisée :

```bash
ffmpeg -y -v error \
  -f x11grab \
  -video_size 1024x768 \
  -i :98 \
  -frames:v 1 \
  -update 1 \
  ~/centraliz/game-runner/logs/test.png
```

Cette capture prend tout le display, pas seulement la zone 240 × 160 du jeu.

À terme, il peut être utile de :

- rogner la zone du jeu ;
- utiliser une capture native mGBA ;
- éviter les menus et bordures ;
- normaliser la taille ;
- générer un cache de la dernière image ;
- servir l’image avec des en-têtes anti-cache adaptés.

## 17.2 Erreur de chemin

Une erreur :

```text
Could not open file: logs/test.png
```

peut simplement signifier que le dossier relatif n’existe pas depuis le répertoire courant.

Préférer des chemins absolus.

---

# 18. Observabilité

## 18.1 Logs systemd

```bash
journalctl -u centraliz-gba.service
journalctl -u centraliz-gba.service -f
journalctl -u centraliz-gba.service --since today
```

## 18.2 Logs applicatifs

```text
logs/mgba-http.log
logs/lua-bootstrap.png
logs/lua-bootstrap-error.png
logs/screen.png
```

## 18.3 Vérifications réseau

```bash
ss -ltnp | grep -E '5000|8888'
```

## 18.4 Vérifications processus

```bash
ps aux | grep -E 'Xvfb|openbox|mgba|mgba-http' | grep -v grep
```

## 18.5 Vérification fonctionnelle

```bash
curl -m 3 http://127.0.0.1:5000/core/currentFrame
sleep 2
curl -m 3 http://127.0.0.1:5000/core/currentFrame
```

Les deux réponses doivent indiquer une progression de frame.

---

# 19. Procédure de diagnostic

## 19.1 La fenêtre mGBA n’apparaît pas

Vérifier :

```bash
systemctl status centraliz-xvfb.service
systemctl status centraliz-openbox.service
systemctl status centraliz-gba.service
echo "$DISPLAY"
ps aux | grep mgba
```

## 19.2 mGBA est visible mais la ROM ne progresse pas

Vérifier en priorité :

```text
Sync Audio désactivé
Sync Video activé
utilisateur Linux = fwattinne
version mGBA = 0.10.5
```

Puis :

```bash
journalctl -u centraliz-gba.service -f
```

## 19.3 Le port 8888 ne s’ouvre pas

Causes probables :

- script Lua non chargé ;
- mauvais script récent ;
- xdotool a cliqué au mauvais endroit ;
- fenêtre non focalisée ;
- menu différent ;
- mGBA pas prêt ;
- Lua a levé une erreur ;
- port déjà occupé.

Actions :

```bash
export DISPLAY=:98
~/centraliz/game-runner/scripts/load-lua.sh
ls -l ~/centraliz/game-runner/logs/lua-bootstrap*
ss -ltnp | grep 8888
```

## 19.4 Le port 5000 ne s’ouvre pas

Vérifier :

```bash
~/centraliz/game-runner/scripts/start-mgba-http.sh
tail -n 100 ~/centraliz/game-runner/logs/mgba-http.log
ss -ltnp | grep 5000
```

## 19.5 Le port 5000 est ouvert mais l’API échoue

Possibilités :

- mGBA-http est actif mais Lua ne répond pas ;
- ancien processus connecté à un ancien mGBA ;
- endpoint incorrect ;
- processus bloqué ;
- incompatibilité de version.

Tester :

```bash
curl -v --max-time 3 http://127.0.0.1:5000/core/currentFrame
curl -v --max-time 3 http://127.0.0.1:5000/core/getgametitle
ss -ltnp | grep -E '5000|8888'
```

## 19.6 Redémarrage complet

```bash
systemctl restart centraliz-gba.service
journalctl -u centraliz-gba.service -f
```

Puis :

```bash
~/centraliz/game-runner/scripts/healthcheck.sh
```

---

# 20. Risques connus

## 20.1 xdotool par coordonnées

Risque élevé de fragilité.

Améliorations :

- utiliser des raccourcis clavier ;
- cibler explicitement la fenêtre ;
- analyser les titres ;
- prendre des captures intermédiaires ;
- ajouter plusieurs tentatives ;
- vérifier le port après chaque tentative ;
- réinitialiser les menus avant de cliquer.

## 20.2 mGBA-http non supervisé directement

Risque :

- crash silencieux ;
- processus orphelin ;
- incohérence après redémarrage de mGBA ;
- difficulté d’arrêt propre.

Solution définitive :

```text
centraliz-mgba-http.service
```

à créer par l’administrateur.

## 20.3 Dépendance au profil utilisateur

Risque :

- perte des préférences mGBA ;
- retour du bug audio ;
- mauvais script récent ;
- différence entre lancement manuel et service.

## 20.4 Exposition réseau

Les ports 5000 et 8888 ne doivent pas être publiquement accessibles.

## 20.5 ROM et droits

La légalité de la ROM dépend de sa provenance et des droits détenus. La documentation technique ne doit pas distribuer la ROM ni intégrer son contenu.

## 20.6 Sauvegardes

Un save state unique peut être corrompu. Toujours conserver plusieurs versions et la sauvegarde native.

---

# 21. Roadmap recommandée

## Phase 1 — Stabilisation serveur

- confirmer que mGBA tourne en continu ;
- confirmer la progression des frames ;
- fiabiliser le chargement Lua ;
- démarrer mGBA-http automatiquement ;
- ajouter un service dédié quand l’administrateur est disponible ;
- formaliser les logs ;
- ajouter une procédure de restauration.

## Phase 2 — Intégration backend

- créer un client mGBA-http ;
- ajouter une liste blanche de commandes ;
- créer une file d’attente ;
- ajouter des limites de débit ;
- gérer les erreurs ;
- ajouter un endpoint d’état ;
- enregistrer l’historique minimal.

## Phase 3 — Affichage

- produire une image mutualisée ;
- diffuser au frontend ;
- gérer la reconnexion ;
- mesurer la latence ;
- rogner correctement la zone du jeu.

## Phase 4 — Persistance

- automatiser les save states ;
- rotation des sauvegardes ;
- sauvegarde externe ;
- test régulier de restauration.

## Phase 5 — Production

- monitoring ;
- alertes ;
- service mGBA-http dédié ;
- sécurité réseau ;
- documentation d’exploitation ;
- tests de charge ;
- stratégie anti-abus ;
- procédure de maintenance.

---

# 22. Décisions à confirmer

Une autre IA doit demander ou vérifier avant de modifier profondément le système :

- contenu exact des unités systemd ;
- commande exacte de lancement de mGBA ;
- utilisateur et groupe des services ;
- endpoint exact utilisé pour les boutons ;
- format JSON de mGBA-http ;
- méthode de diffusion des images ;
- choix entre polling, WebSocket ou Server-Sent Events ;
- stratégie de sauvegarde ;
- règles de gouvernance des commandes ;
- gestion des utilisateurs ;
- architecture actuelle du backend Centraliz ;
- degré d’accès réseau aux ports 5000 et 8888 ;
- comportement attendu à l’arrêt de `centraliz-gba.service`.

---

# 23. Principes à respecter par une autre IA

1. Ne pas modifier les services systemd sans connaître leur contenu.
2. Ne pas supposer que l’utilisateur possède `sudo`.
3. Ne pas relancer Xvfb, Openbox ou mGBA depuis les scripts applicatifs si systemd les gère déjà.
4. Toujours conserver `DISPLAY=:98`, sauf décision explicite de migration.
5. Toujours vérifier le port 8888 après le chargement Lua.
6. Toujours vérifier l’API 5000 après le lancement de mGBA-http.
7. Ne jamais utiliser un `pkill -f` large sans contrôle.
8. Préserver le profil mGBA de `fwattinne`.
9. Maintenir `Sync Audio` désactivé.
10. Ne pas exposer mGBA-http directement au frontend.
11. Utiliser des chemins absolus.
12. Sauvegarder les scripts avant remplacement.
13. Distinguer les faits connus des hypothèses.
14. Privilégier des changements réversibles.
15. Tester chaque couche séparément.

---

# 24. Commandes de référence

## État des services

```bash
systemctl status centraliz-{xvfb,openbox,gba}.service
```

## Redémarrage

```bash
systemctl restart centraliz-gba.service
```

## Logs

```bash
journalctl -u centraliz-gba.service -f
```

## Processus

```bash
ps aux | grep -E 'Xvfb|openbox|mgba|mgba-http' | grep -v grep
```

## Ports

```bash
ss -ltnp | grep -E '5000|8888'
```

## API

```bash
curl -m 3 http://127.0.0.1:5000/core/getgametitle
curl -m 3 http://127.0.0.1:5000/core/currentFrame
```

## Scripts

```bash
export DISPLAY=:98

~/centraliz/game-runner/scripts/load-lua.sh
~/centraliz/game-runner/scripts/start-mgba-http.sh
~/centraliz/game-runner/scripts/healthcheck.sh
~/centraliz/game-runner/scripts/capture-screen.sh
```

## Logs mGBA-http

```bash
tail -f ~/centraliz/game-runner/logs/mgba-http.log
```

---

# 25. Résumé ultra-condensé

```text
Centraliz héberge un Pokémon GBA collaboratif.

Serveur :
Debian + Xvfb :98 + Openbox + mGBA Qt 0.10.5.

Contrôle :
Node.js → mGBA-http :5000 → Lua :8888 → mGBA → ROM.

Services :
centraliz-xvfb.service
centraliz-openbox.service
centraliz-gba.service

Le service GBA appelle :
~/centraliz/game-runner/scripts/start-game-nymous.sh

Ce script :
charge Lua
démarre mGBA-http
lance un health check

Bug historique critique :
Sync Audio était activé sans périphérique audio.

Correctif :
Sync Audio désactivé
Sync Video activé
profil Linux fwattinne conservé.

Faiblesse principale :
chargement Lua par xdotool avec coordonnées.

Limite actuelle :
mGBA-http n’est pas encore un vrai service systemd indépendant.
```
