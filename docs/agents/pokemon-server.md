# Serveur de jeu Pokémon : accès et tests à distance

Les tests du serveur de jeu se font depuis le poste de dev avec `tools/pokemon-remote.cjs`. Il n'y a pas besoin de demander à l'utilisateur d'aller sur le serveur ni d'envoyer des captures à la main.

## Connexion

- Les identifiants sont ceux du `.env` racine : `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD`.
- **Port 8887**, pas 22 (`SFTP_PORT`, défaut 8887). Sur le port 22, la connexion expire : c'est la cause de l'échec des tentatives précédentes.
- Le compte `fwattinne` a un **vrai shell SSH**, pas seulement SFTP. On peut lancer des commandes et pas seulement transférer des fichiers.
- Pas de `sudo`, pas de `git` sur le serveur. Le dépôt n'y est pas cloné : les fichiers y sont copiés.

## Commandes

```powershell
npm run pokemon:remote -- status        # diagnostic OK/FAIL, code de sortie 1 si un FAIL
npm run pokemon:remote -- native        # vraie image du jeu 240x160 via mGBA-http
npm run pokemon:remote -- press START A # appuie sur des boutons puis capture native
npm run pokemon:remote -- screenshot    # capture X11 de la fenêtre mGBA (menus Qt, dialogues)
npm run pokemon:remote -- logs 50       # log mGBA-http + journal systemd
npm run pokemon:remote -- exec "ss -ltnp"
npm run pokemon:remote -- get /chemin/distant [local]
npm run pokemon:remote -- put local /chemin/distant
npm run pokemon:remote -- restart       # systemctl restart centraliz-gba.service + diagnostic
npm run pokemon:remote -- stream-check  # vérifie depuis l'extérieur que le flux SSE des images passe nginx sans être retenu ; sinon, cherche la taille de bourrage qui le débloque (POKEMON_SSE_PAD_BYTES, 16 Ko par défaut)
```

Les captures sont écrites dans `logs/pokemon/`, qui est ignoré par Git. Pour les lire, ouvrir le PNG avec l'outil de lecture d'image.

Le module exporte aussi `connect`, `run`, `download`, `upload` pour écrire des scripts ponctuels.

## Pièges connus

- **Git Bash convertit les chemins** `/tmp/...` en chemins Windows. Préfixer avec `MSYS_NO_PATHCONV=1` pour `get` et `put` lancés depuis Bash. PowerShell n'a pas ce problème.
- **La capture X11 peut être figée** alors que l'émulation tourne : mGBA ne redessine sa fenêtre Xvfb qu'après activation. Pour savoir si le jeu avance, se fier au compteur de frames (`status`) et à `native`, jamais à deux captures X11 identiques.
- **Le CPU de mGBA ne prouve rien** : environ 3 % suffisent à 60 fps.
- **File de requêtes côté Lua** : le serveur Lua traite les connexions une par une. Des requêtes abandonnées (timeouts) s'accumulent et rendent l'API lente (20 à 40 s) pendant un moment, puis elle redevient rapide (environ 10 ms). Avant de conclure qu'elle est bloquée, relancer `status`.
- **Après `press`**, une transition d'écran peut prendre plus d'une seconde. Si l'image n'a pas changé, refaire `native`.
- Le jeu est partagé : appuyer sur des boutons change vraiment la partie. Ne jamais sauvegarder en jeu ni charger de save state sans accord.

## Architecture (rappel)

`Node backend → mGBA-http 127.0.0.1:5000 → Lua :8888 → mGBA Qt 0.10.5 (Xvfb :98, Openbox)`, lancé par `centraliz-gba.service`, qui appelle `game-runner/scripts/start-game-nymous.sh` sur le serveur. Pour le détail, voir `game-runner/CENTRALIZ_POKEMON_CONTEXTE_COMPLET_IA.md`. Pour l'état du projet, voir `game-runner/BILAN.md`.

## Vitesse de la partie

Le curseur réservé aux admins règle la cadence de la partie partagée à 60, 90 ou 120 FPS via les raccourcis du menu « FPS target ». Le réglage a été vérifié à chaud avec `audioSync=0` et `videoSync=1`, la configuration du serveur public.

Dans « Settings → Shortcuts → Audio/Video → FPS target », associer les raccourcis suivants. Sur une nouvelle instance, ils peuvent aussi être déclarés dans `qt.ini`.

```ini
[shortcutKey]
fpsTarget.60=Ctrl+Alt+1
fpsTarget.90=Ctrl+Alt+2
fpsTarget.120=Ctrl+Alt+3
```

Renseigner `POKEMON_SPEED_DISPLAY` dans l'environnement du backend avec le display de l'instance. Le backend doit pouvoir lire la fenêtre mGBA via `xdotool`. Laisser l'affichage du FPS actif (`showFps=1`) et la fenêtre du jeu au premier plan. Sans cette configuration, la commande est indisponible.

Le réglage « Cible FPS » de la page règle la cadence du flux d'images vers le navigateur. Il est plafonné à 30 pour tout le monde, admins compris, en flux continu SSE comme en mode de secours HTTP. La capture suit le spectateur le plus exigeant, dans cette limite.

Le mode natif « Fast forward » plafonné active l'attente audio même avec `audioSync=0`. Sur la partie publique sans sortie audio, un essai a bloqué le compteur. La sélection de 60 dans « Audio/Video → FPS target » a rétabli le jeu dans le même processus. Tester les nouveaux réglages sur un display indépendant, avec une copie de la ROM et un répertoire de configuration dédié.
