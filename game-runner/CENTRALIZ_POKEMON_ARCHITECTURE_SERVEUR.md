# Centraliz Pokémon — Architecture serveur et exploitation

> **Version mise à jour après validation complète de la pile le 21 juillet 2026.**
>
> Cette version remplace la documentation serveur précédente pour l’état courant.

---

# 0. État courant validé

La commande suivante démarre désormais toute la pile avec succès :

```bash
systemctl restart centraliz-gba.service
```

État observé :

```text
centraliz-gba.service : active (running)
ExecStartPost          : status=0/SUCCESS
Xvfb :98               : OK
Openbox                : OK
mGBA 0.10.5            : OK
Lua                    : port 8888 ouvert
mGBA-http              : port 5000 ouvert
API /core/currentFrame : OK
healthcheck            : All checks passed
```

Le journal de réussite contient notamment :

```text
[start-game] Running final health check
[OK]   Xvfb :98
[OK]   Openbox
[OK]   mGBA
[OK]   mGBA-http
[OK]   Lua socket — port 8888
[OK]   mGBA-http socket — port 5000
[OK]   mGBA-http API
[healthcheck] All checks passed
[start-game] Bootstrap completed successfully
```

---

# 0.1 Corrections désormais validées

## Attente de la fenêtre mGBA

`ExecStartPost` démarre immédiatement après le lancement du processus mGBA, avant que sa fenêtre graphique existe. L’ancien script cherchait la fenêtre une seule fois, échouait, puis faisait échouer tout le service.

`load-lua.sh` attend maintenant jusqu’à 30 secondes la fenêtre principale mGBA avant de continuer. Cette attente est indispensable sous systemd.

## Géométrie mGBA imposée

La fenêtre principale est replacée de façon déterministe :

```text
taille demandée : 480 × 340
position         : x=272, y=202
```

```bash
xdotool windowsize "$MGBA_WINDOW" 480 340
xdotool windowmove "$MGBA_WINDOW" 272 202
```

## Coordonnées validées dans mGBA

```text
Tools     : 477,210
Scripting : 515,313
```

## Nettoyage des anciennes fenêtres Scripting

Avant d’en ouvrir une nouvelle, le script ferme toutes les fenêtres dont le titre est exactement `Scripting`. Cela évite les doublons et la sélection d’une ancienne fenêtre.

## Géométrie Scripting imposée

```text
taille demandée : 800 × 620
position         : x=110, y=80
```

## Coordonnées validées dans Scripting

```text
File               : 120,80
Load Recent Script : 195,135
Transition 1        : 245,135
Transition 2        : 285,135
Sous-menu final     : 335,135
```

## Critère réel de succès

Le chargement Lua n’est considéré réussi que lorsque le port TCP 8888 est ouvert :

```bash
ss -ltnp | grep 8888
```

## Démarrage automatique de mGBA-http

Après l’ouverture du port 8888, `start-mgba-http.sh` :

- évite les doublons ;
- vérifie le port 5000 ;
- utilise un fichier PID ;
- lance le binaire avec `nohup` ;
- attend que `/core/currentFrame` réponde ;
- écrit dans `logs/mgba-http.log`.

## Réglage mGBA critique toujours requis

```text
Sync Audio : désactivé
Sync Video : activé
```

Les erreurs ALSA visibles dans le journal ne sont pas bloquantes tant que les frames progressent et que la pile passe le healthcheck.

---

# 0.2 Unité systemd réellement observée

Les directives principales de `centraliz-gba.service` sont :

```ini
[Unit]
Description=Centraliz mGBA-HTTP server
Documentation=https://centraliz.it
After=network.target centraliz-openbox.service
Requires=centraliz-openbox.service

[Service]
Type=simple
User=fwattinne
Group=fwattinne
WorkingDirectory=/home/fwattinne/centraliz/game-runner
ExecStart=/usr/games/mgba-qt /home/fwattinne/centraliz/game-runner/roms/game.gba
ExecStartPost=/home/fwattinne/centraliz/game-runner/scripts/start-game-nymous.sh
```

Protections observées :

```ini
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_NETLINK AF_UNIX
RestrictNamespaces=false
NoNewPrivileges=true
LockPersonality=true
SystemCallFilter=@system-service
RemoveIPC=true
ProtectClock=true
ProtectKernelLogs=true
ProtectHostname=true
ProtectProc=invisible
```

La pile fonctionne avec ces protections dans l’état actuel.

---

# 0.3 Séquence complète désormais fonctionnelle

```text
1. systemd démarre Xvfb sur :98.
2. systemd démarre Openbox.
3. systemd lance mGBA 0.10.5 avec la ROM.
4. ExecStartPost lance start-game-nymous.sh.
5. load-lua.sh attend la fenêtre mGBA.
6. la fenêtre principale est replacée.
7. les anciennes fenêtres Scripting sont fermées.
8. Tools > Scripting est ouvert.
9. la fenêtre Scripting est attendue et replacée.
10. File > Load Recent Script est exécuté.
11. Lua ouvre 127.0.0.1:8888.
12. la fenêtre Scripting est fermée.
13. start-mgba-http.sh lance mGBA-http.
14. mGBA-http ouvre 127.0.0.1:5000.
15. healthcheck.sh valide tous les composants.
16. ExecStartPost retourne SUCCESS.
17. centraliz-gba.service reste active (running).
```

---

# 0.4 Captures de diagnostic actuelles

```text
logs/01-mgba-positioned.png
logs/02-tools-open.png
logs/03-scripting-open.png
logs/04-scripting-positioned.png
logs/05-scripting-file-open.png
logs/06-recent-script-menu.png
logs/07-lua-loaded.png
logs/lua-bootstrap-error.png
```

Elles permettent de localiser précisément une future régression des clics.

---

# 0.5 Sauvegarde recommandée de la version stable

```bash
cp ~/centraliz/game-runner/scripts/load-lua.sh \
  ~/centraliz/game-runner/scripts/load-lua.sh.STABLE-$(date +%Y%m%d-%H%M%S)

cp ~/centraliz/game-runner/scripts/start-game-nymous.sh \
  ~/centraliz/game-runner/scripts/start-game-nymous.sh.STABLE-$(date +%Y%m%d-%H%M%S)

cp ~/centraliz/game-runner/scripts/start-mgba-http.sh \
  ~/centraliz/game-runner/scripts/start-mgba-http.sh.STABLE-$(date +%Y%m%d-%H%M%S)

cp ~/centraliz/game-runner/scripts/healthcheck.sh \
  ~/centraliz/game-runner/scripts/healthcheck.sh.STABLE-$(date +%Y%m%d-%H%M%S)
```

---


> Documentation dédiée à l’infrastructure serveur.
>
> Ce document ne décrit pas en détail le frontend ou la logique métier globale. Il se concentre sur les processus Linux, les dépendances, les scripts, les ports, les fichiers, les logs et les procédures d’exploitation.

---

# 1. Vue générale

Le serveur exécute une ROM Pokémon GBA dans mGBA sur une machine Debian sans écran physique.

La pile complète est :

```text
systemd
│
├── centraliz-xvfb.service
│       └── Xvfb :98
│
├── centraliz-openbox.service
│       └── Openbox sur DISPLAY=:98
│
└── centraliz-gba.service
        ├── mGBA Qt 0.10.5
        └── start-game-nymous.sh
                ├── load-lua.sh
                │       └── mGBASocketServer.lua
                │               └── TCP 127.0.0.1:8888
                │
                ├── start-mgba-http.sh
                │       └── mGBA-http
                │               └── HTTP 127.0.0.1:5000
                │
                └── healthcheck.sh
```

La pile réseau interne est :

```text
Backend Node.js
    │ HTTP
    ▼
127.0.0.1:5000
mGBA-http
    │ TCP
    ▼
127.0.0.1:8888
Lua dans mGBA
    │
    ▼
mGBA
    │
    ▼
game.gba
```

---

# 2. Contraintes importantes

## 2.1 Absence de droits sudo

L’utilisateur `fwattinne` n’est pas administrateur.

Il peut :

- modifier les fichiers de son répertoire personnel ;
- modifier les scripts appelés par le service ;
- lancer les commandes systemctl autorisées ;
- lire les logs autorisés ;
- lancer des tests manuels.

Il ne peut pas :

- modifier `/etc/systemd/system` ;
- créer un nouveau service système ;
- installer des paquets ;
- changer les permissions système ;
- modifier les unités sans intervention de l’administrateur.

## 2.2 Affichage virtuel

Le display officiel est :

```text
:98
```

Ne pas utiliser `:99` dans les scripts courants.

Un ancien Xvfb avait déjà utilisé `:99`, ce qui a conduit l’administrateur à configurer les services sur `:98`.

## 2.3 Profil utilisateur mGBA

mGBA doit utiliser le profil de :

```text
fwattinne
```

Le profil contient notamment :

```text
Sync Audio = désactivé
Sync Video = activé
dernier script Lua chargé = mGBASocketServer.lua
```

Une exécution sous un autre utilisateur peut réintroduire le blocage audio ou perdre le script récent.

---

# 3. Arborescence serveur recommandée

```text
/home/fwattinne/centraliz/game-runner/
├── roms/
│   ├── game.gba
│   └── game.sav
├── logs/
│   ├── mgba-http.log
│   ├── lua-bootstrap.png
│   ├── lua-bootstrap-error.png
│   └── screen.png
├── state/
│   ├── mgba-http.pid
│   └── save-states/
├── scripts/
│   ├── start-game-nymous.sh
│   ├── load-lua.sh
│   ├── start-mgba-http.sh
│   ├── healthcheck.sh
│   ├── capture-screen.sh
│   └── archive/
└── tools/
    └── mgba-http/
        ├── mgba-http
        ├── mGBASocketServer.lua
        ├── index.html
        └── swagger/
```

Permissions attendues :

```bash
chmod +x ~/centraliz/game-runner/scripts/*.sh
chmod +x ~/centraliz/game-runner/tools/mgba-http/mgba-http
```

---

# 4. Services systemd

## 4.1 Chaîne de dépendances

Selon l’administrateur :

```text
centraliz-xvfb.service
        ↓
centraliz-openbox.service
        ↓
centraliz-gba.service
```

Chaque service dépend du précédent.

Effet attendu :

```text
systemctl start centraliz-gba.service
```

démarre automatiquement :

```text
Xvfb
Openbox
mGBA
script de bootstrap
```

À l’inverse, l’arrêt de Xvfb doit provoquer l’arrêt des services dépendants dans l’ordre approprié.

## 4.2 Commandes usuelles

```bash
systemctl start centraliz-gba.service
systemctl stop centraliz-gba.service
systemctl restart centraliz-gba.service
systemctl status centraliz-gba.service
```

État global :

```bash
systemctl status centraliz-{xvfb,openbox,gba}.service
```

Logs :

```bash
journalctl -u centraliz-gba.service
journalctl -u centraliz-gba.service -f
journalctl -u centraliz-gba.service --since today
```

## 4.3 Inspection en lecture seule

Si autorisé :

```bash
systemctl cat centraliz-xvfb.service
systemctl cat centraliz-openbox.service
systemctl cat centraliz-gba.service
```

Ne pas supposer la présence de directives précises sans avoir vu les unités.

---

# 5. Processus graphiques

## 5.1 Xvfb

Rôle :

- créer un serveur X virtuel ;
- fournir un écran à mGBA ;
- permettre les captures avec ffmpeg ;
- permettre l’automatisation avec xdotool.

Configuration :

```text
DISPLAY=:98
1024x768
24 bits
```

Vérification :

```bash
pgrep -af 'Xvfb.*:98'
```

## 5.2 Openbox

Rôle :

- gérer les fenêtres dans Xvfb ;
- rendre le comportement de la fenêtre Qt plus prévisible ;
- permettre le focus et la navigation de menus.

Vérification :

```bash
pgrep -af openbox
```

## 5.3 mGBA Qt

Rôle :

- exécuter la ROM ;
- héberger le script Lua ;
- fournir les commandes et captures ;
- gérer les sauvegardes.

Vérification :

```bash
pgrep -af mgba-qt
```

Capture visuelle :

```bash
DISPLAY=:98 \
~/centraliz/game-runner/scripts/capture-screen.sh \
~/centraliz/game-runner/logs/manual-check.png
```

---

# 6. Séquence de démarrage détaillée

## Étape 1 — Xvfb

Condition de réussite :

```text
un processus Xvfb écoute sur DISPLAY=:98
```

## Étape 2 — Openbox

Condition de réussite :

```text
Openbox fonctionne sur :98
```

## Étape 3 — mGBA

Condition de réussite :

- processus `mgba-qt` présent ;
- fenêtre visible dans Xvfb ;
- ROM chargée ;
- frames en progression.

## Étape 4 — Bootstrap

Le service appelle :

```text
/home/fwattinne/centraliz/game-runner/scripts/start-game-nymous.sh
```

Le script reçoit normalement :

```text
DISPLAY=:98
```

## Étape 5 — Chargement Lua

`load-lua.sh` :

1. vérifie le display ;
2. vérifie si 8888 est déjà ouvert ;
3. attend la fenêtre mGBA ;
4. active la fenêtre ;
5. ouvre `Tools > Scripting` ;
6. charge le script récent ;
7. attend le port 8888 ;
8. prend une capture.

## Étape 6 — mGBA-http

`start-mgba-http.sh` :

1. vérifie 8888 ;
2. teste l’API sur 5000 ;
3. vérifie que le port 5000 n’est pas occupé de manière incohérente ;
4. vérifie le PID ;
5. lance le binaire ;
6. écrit dans `mgba-http.log` ;
7. attend une réponse HTTP ;
8. retourne une erreur si le démarrage échoue.

## Étape 7 — Health check

`healthcheck.sh` vérifie l’ensemble.

---

# 7. Description des scripts

## 7.1 `start-game-nymous.sh`

Chemin :

```text
/home/fwattinne/centraliz/game-runner/scripts/start-game-nymous.sh
```

Responsabilité :

```text
orchestration uniquement
```

Ordre :

```text
load-lua.sh
start-mgba-http.sh
healthcheck.sh
```

Il ne doit pas :

- tuer Xvfb ;
- relancer Openbox ;
- lancer mGBA ;
- utiliser `pkill -f` ;
- choisir un autre display ;
- contenir toute la logique xdotool ;
- contenir toute la logique de gestion de PID.

## 7.2 `load-lua.sh`

Dépendances :

```text
bash
xdotool
ss
ffmpeg
```

Entrées :

```text
DISPLAY
CENTRALIZ_GAME_DIR
LUA_PORT
MGBA_WAIT_TIMEOUT
LUA_WAIT_TIMEOUT
```

Sorties :

```text
port 8888 ouvert
capture de succès ou d’échec
code de sortie
```

Points fragiles :

- coordonnées de menus ;
- recherche de fenêtre ;
- dernier script récent ;
- délai de démarrage.

## 7.3 `start-mgba-http.sh`

Dépendances :

```text
bash
ss
curl
nohup
readlink
kill
```

Entrées :

```text
CENTRALIZ_GAME_DIR
LUA_PORT
MGBA_HTTP_PORT
MGBA_HTTP_START_TIMEOUT
MGBA_HTTP_HEALTH_URL
```

Sorties :

```text
processus mgba-http
port 5000
fichier PID
fichier log
```

Fichier PID :

```text
/home/fwattinne/centraliz/game-runner/state/mgba-http.pid
```

Log :

```text
/home/fwattinne/centraliz/game-runner/logs/mgba-http.log
```

## 7.4 `healthcheck.sh`

Dépendances :

```text
pgrep
ss
curl
```

Contrôles :

```text
Xvfb :98
Openbox
mgba-qt
mgba-http
port 8888
port 5000
/core/currentFrame
```

## 7.5 `capture-screen.sh`

Dépendance :

```text
ffmpeg
```

Exemple :

```bash
DISPLAY=:98 \
~/centraliz/game-runner/scripts/capture-screen.sh \
~/centraliz/game-runner/logs/test.png
```

---

# 8. Variables d’environnement

## Variables communes

```text
CENTRALIZ_GAME_DIR
DISPLAY
```

Valeurs par défaut :

```text
CENTRALIZ_GAME_DIR=$HOME/centraliz/game-runner
DISPLAY=:98
```

## Lua

```text
LUA_PORT=8888
MGBA_WAIT_TIMEOUT=30
LUA_WAIT_TIMEOUT=20
```

## mGBA-http

```text
MGBA_HTTP_PORT=5000
MGBA_HTTP_START_TIMEOUT=20
MGBA_HTTP_HEALTH_URL=http://127.0.0.1:5000/core/currentFrame
```

Les valeurs fournies par systemd ont priorité sur les valeurs par défaut des scripts.

---

# 9. Ports et sécurité

## 9.1 Port 8888

Service :

```text
serveur TCP Lua dans mGBA
```

Usage :

```text
mGBA-http → Lua
```

Vérification :

```bash
ss -ltnp | grep 8888
```

## 9.2 Port 5000

Service :

```text
API HTTP mGBA-http
```

Usage :

```text
backend Node.js → mGBA-http
```

Vérification :

```bash
ss -ltnp | grep 5000
```

## 9.3 Règle de sécurité

Les deux ports doivent rester locaux.

À vérifier :

```bash
ss -ltnp | grep -E '5000|8888'
```

Préférer :

```text
127.0.0.1:5000
127.0.0.1:8888
```

Éviter :

```text
0.0.0.0:5000
0.0.0.0:8888
```

sauf décision d’architecture explicite et filtrage réseau approprié.

---

# 10. Gestion du processus mGBA-http

## 10.1 Pourquoi il bloque le terminal

Lancement manuel :

```bash
./mgba-http
```

Le processus reste au premier plan car il s’agit d’un serveur web.

Le terminal est attaché au processus jusqu’à :

```text
Ctrl+C
```

## 10.2 Lancement actuel automatisé

Le script utilise :

```text
nohup
redirection vers un fichier
lancement en arrière-plan
fichier PID
```

Le processus n’occupe donc plus le terminal du script.

## 10.3 Détection de doublon

Le script vérifie :

1. l’endpoint HTTP ;
2. le port 5000 ;
3. le fichier PID ;
4. l’existence du processus ;
5. le chemin de l’exécutable.

Il refuse de tuer un processus ambigu.

## 10.4 Cas incohérents

### API répond déjà

Action :

```text
ne pas relancer
```

### Port 5000 occupé, API muette

Action :

```text
échouer et demander un diagnostic
```

### PID obsolète

Action :

```text
supprimer le fichier PID
```

### PID correspondant à un autre processus

Action :

```text
ne pas tuer
échouer
```

### mGBA-http existe mais ne répond pas

Action actuelle :

```text
échouer
```

Évolution possible :

- ajouter un script d’arrêt contrôlé ;
- vérifier l’exécutable ;
- envoyer SIGTERM ;
- attendre ;
- relancer.

Cette évolution doit être validée avant implémentation.

---

# 11. Journaux

## systemd

```bash
journalctl -u centraliz-gba.service -f
```

Le script de bootstrap écrit dans la sortie standard et doit donc apparaître dans le journal du service.

Préfixes :

```text
[start-game]
[load-lua]
[mgba-http]
[healthcheck]
```

## mGBA-http

```text
~/centraliz/game-runner/logs/mgba-http.log
```

Consultation :

```bash
tail -f ~/centraliz/game-runner/logs/mgba-http.log
```

## Captures

```text
lua-bootstrap.png
lua-bootstrap-error.png
screen.png
```

Ces captures servent de preuve visuelle lors d’un échec xdotool.

---

# 12. Procédure d’installation des scripts

## 12.1 Sauvegarde

```bash
cd ~/centraliz/game-runner/scripts

cp start-game-nymous.sh \
  start-game-nymous.sh.backup-$(date +%Y%m%d-%H%M%S)
```

## 12.2 Copie

Copier :

```text
start-game-nymous.sh
load-lua.sh
start-mgba-http.sh
healthcheck.sh
capture-screen.sh
```

dans :

```text
~/centraliz/game-runner/scripts/
```

## 12.3 Permissions

```bash
chmod +x ~/centraliz/game-runner/scripts/*.sh
```

## 12.4 Test syntaxique

```bash
bash -n ~/centraliz/game-runner/scripts/start-game-nymous.sh
bash -n ~/centraliz/game-runner/scripts/load-lua.sh
bash -n ~/centraliz/game-runner/scripts/start-mgba-http.sh
bash -n ~/centraliz/game-runner/scripts/healthcheck.sh
bash -n ~/centraliz/game-runner/scripts/capture-screen.sh
```

## 12.5 Test manuel

```bash
export DISPLAY=:98

~/centraliz/game-runner/scripts/load-lua.sh
~/centraliz/game-runner/scripts/start-mgba-http.sh
~/centraliz/game-runner/scripts/healthcheck.sh
```

## 12.6 Test via service

```bash
systemctl restart centraliz-gba.service
journalctl -u centraliz-gba.service -f
```

---

# 13. Procédure d’exploitation quotidienne

## Démarrer

```bash
systemctl start centraliz-gba.service
```

## Arrêter

```bash
systemctl stop centraliz-gba.service
```

Attention : puisque mGBA-http n’est pas encore un vrai service dépendant, vérifier s’il reste actif après l’arrêt.

```bash
pgrep -af mgba-http
ss -ltnp | grep 5000
```

## Redémarrer

```bash
systemctl restart centraliz-gba.service
```

## Vérifier

```bash
~/centraliz/game-runner/scripts/healthcheck.sh
```

## Voir les logs

```bash
journalctl -u centraliz-gba.service -f
tail -f ~/centraliz/game-runner/logs/mgba-http.log
```

---

# 14. Procédure de diagnostic par couche

## Couche 1 — systemd

```bash
systemctl status centraliz-{xvfb,openbox,gba}.service
```

## Couche 2 — processus

```bash
ps aux | grep -E 'Xvfb|openbox|mgba|mgba-http' | grep -v grep
```

## Couche 3 — display

```bash
DISPLAY=:98 xdotool getmouselocation
```

## Couche 4 — capture

```bash
DISPLAY=:98 \
~/centraliz/game-runner/scripts/capture-screen.sh \
~/centraliz/game-runner/logs/diagnostic.png
```

## Couche 5 — Lua

```bash
ss -ltnp | grep 8888
```

## Couche 6 — HTTP

```bash
ss -ltnp | grep 5000
curl -v --max-time 3 http://127.0.0.1:5000/core/currentFrame
```

## Couche 7 — progression

```bash
curl -s http://127.0.0.1:5000/core/currentFrame
sleep 2
curl -s http://127.0.0.1:5000/core/currentFrame
```

---

# 15. Pannes typiques

## 15.1 `Cannot connect to X display :98`

Causes :

- Xvfb absent ;
- variable DISPLAY incorrecte ;
- permissions X ;
- service pas démarré.

## 15.2 `No visible mGBA window found`

Causes :

- mGBA non lancé ;
- titre ou classe de fenêtre différente ;
- démarrage trop lent ;
- fenêtre non visible ;
- mauvais display.

## 15.3 Lua n’ouvre pas 8888

Causes :

- mauvais clic ;
- menu non ouvert ;
- mauvais script récent ;
- script Lua en erreur ;
- mGBA bloqué ;
- ancienne instance sur un autre display.

## 15.4 `Connection refused 127.0.0.1:8888`

Interprétation :

```text
mGBA-http fonctionne
Lua ne fonctionne pas ou n’est pas chargé
```

## 15.5 Port 5000 déjà occupé

Identifier :

```bash
ss -ltnp | grep 5000
ps aux | grep mgba-http
```

Ne pas tuer aveuglément.

## 15.6 mGBA-http se lance puis quitte

Lire :

```bash
tail -n 200 ~/centraliz/game-runner/logs/mgba-http.log
```

Vérifier :

- architecture du binaire ;
- droits d’exécution ;
- dépendances ;
- répertoire courant ;
- port 5000 ;
- port 8888.

## 15.7 ROM figée

Vérifier en priorité :

```text
Sync Audio désactivé
Sync Video activé
service sous fwattinne
```

---

# 16. Arrêt propre

La solution actuelle automatise et valide le démarrage complet. La gestion de l’arrêt de mGBA-http reste toutefois à améliorer.

Un arrêt propre devrait idéalement :

```text
1. arrêter les nouvelles commandes ;
2. vider ou abandonner proprement la file ;
3. sauvegarder l’état ;
4. arrêter mGBA-http ;
5. arrêter mGBA ;
6. arrêter Openbox ;
7. arrêter Xvfb.
```

Comme mGBA-http est lancé hors supervision directe, son arrêt doit être vérifié.

Script futur possible :

```text
stop-mgba-http.sh
```

Comportement souhaité :

- lire le PID ;
- vérifier l’exécutable ;
- envoyer SIGTERM ;
- attendre ;
- supprimer le PID ;
- ne jamais tuer un PID ambigu.

---

# 17. Améliorations recommandées

## Priorité haute

- demander un vrai `centraliz-mgba-http.service` ;
- définir clairement son cycle de vie ;
- coupler son arrêt à `centraliz-gba.service` ;
- ajouter une politique `Restart=on-failure` ;
- sécuriser l’écoute locale ;
- fiabiliser le chargement Lua.

## Priorité moyenne

- créer `stop-mgba-http.sh` ;
- ajouter un watchdog ;
- vérifier la progression des frames ;
- ajouter une rotation de logs ;
- ajouter des timestamps aux logs shell ;
- créer un rapport de santé JSON ;
- surveiller l’espace disque.

## Priorité basse

- remplacer xdotool par une méthode d’initialisation Lua plus directe ;
- éliminer Openbox si une solution headless native devient fiable ;
- remplacer les captures X11 par des captures natives ;
- conteneuriser certains composants si cela apporte une vraie valeur.

---

# 18. Proposition de futur service mGBA-http

Cette section est informative. L’utilisateur ne peut pas l’installer sans administrateur.

Objectif :

```text
centraliz-mgba-http.service
```

Caractéristiques souhaitées :

- utilisateur `fwattinne` ;
- dépendance à `centraliz-gba.service` ;
- attente du port 8888 ;
- répertoire de travail mGBA-http ;
- démarrage du binaire au premier plan ;
- redémarrage sur échec ;
- logs journalctl ;
- arrêt automatique avec la pile.

L’administrateur devra choisir entre :

```text
Requires=
Wants=
After=
PartOf=
BindsTo=
```

selon le couplage voulu.

Ne pas fournir une unité définitive sans examiner les unités existantes.

---

# 19. Vérifications après modification

Après tout changement de script :

```bash
bash -n ~/centraliz/game-runner/scripts/*.sh
```

Puis :

```bash
systemctl restart centraliz-gba.service
```

Observer :

```bash
journalctl -u centraliz-gba.service -f
```

Contrôler :

```bash
~/centraliz/game-runner/scripts/healthcheck.sh
```

Vérifier l’absence de doublons :

```bash
pgrep -af mgba-http
pgrep -af mgba-qt
```

Vérifier les ports :

```bash
ss -ltnp | grep -E '5000|8888'
```

Vérifier la progression :

```bash
curl -s http://127.0.0.1:5000/core/currentFrame
sleep 2
curl -s http://127.0.0.1:5000/core/currentFrame
```

---

# 20. Checklist de mise en production

```text
[ ] DISPLAY est :98 partout
[ ] Xvfb démarre automatiquement
[ ] Openbox démarre automatiquement
[ ] mGBA démarre automatiquement
[ ] mGBA tourne sous fwattinne
[ ] Sync Audio est désactivé
[ ] Sync Video est activé
[ ] Lua ouvre 8888
[ ] mGBA-http ouvre 5000
[ ] Les ports écoutent uniquement en local
[ ] Les frames progressent
[ ] Une commande de bouton fonctionne
[ ] Une capture fonctionne
[ ] Une sauvegarde fonctionne
[ ] Une restauration fonctionne
[ ] Les logs sont accessibles
[ ] Les scripts passent bash -n
[ ] Aucun processus dupliqué
[ ] L’arrêt ne laisse pas de processus orphelin
[ ] Le disque ne se remplit pas avec les logs ou captures
[ ] Le backend ne permet que les boutons autorisés
```

---

# 21. Résumé opérationnel

```text
Commande principale :
systemctl restart centraliz-gba.service

Logs :
journalctl -u centraliz-gba.service -f

Health check :
~/centraliz/game-runner/scripts/healthcheck.sh

Lua :
port 8888

mGBA-http :
port 5000
log logs/mgba-http.log
PID state/mgba-http.pid

Display :
:98

Utilisateur :
fwattinne

Correctif critique :
Sync Audio OFF
Sync Video ON

Faiblesses restantes :
xdotool par coordonnées absolues + mGBA-http hors supervision systemd directe
```
