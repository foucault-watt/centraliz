# Centraliz : La plateforme qui simplifie ta vie étudiante 🚀

## 🌟 Description

**Centraliz** est l’outil indispensable pour tous les étudiants de **Centrale Lille**, **ITEEM** et **ENSCL**. Plus besoin de jongler entre Hypperplanning, Web Aurion et le CLA ! Centraliz regroupe en un seul endroit les ressources dont tu as besoin pour t'organiser.

### 🎯 Que peux-tu faire avec Centraliz ?

- 📅 **Accès rapide aux calendriers de cours** : Parce que l'interface d'hypperplanning est bien moche.
- 🎉 **Agenda CLA des événements et soirées** : Pour ne rater plus aucun torchtôt.
- 📝 **Consultation des notes** : Uniquement si t'es à ITEEM sinon t'as sûrement pas de DS.
- 📧 **Affichage des emails Zimbra** : Ce serait dommage de rater un mail de l'admin.

Centraliz, le site indispensable pour que tu te concentres sur l’essentiel : apprendre et profiter de la vie étudiante. 🎓🎉

## 📱 PWA

Centraliz est maintenant une Progressive Web App (PWA). Tu peux l'installer sur ton appareil pour un accès rapide et une expérience utilisateur améliorée.

## 👤 Auteur

- **Foucault Wattinne**  
  Étudiant à l’ITEEM, avec une passion pour la tech et l'innovation.

## 📬 Contact

Tu as des questions ou des idées pour améliorer Centraliz ? Fais-le moi savoir, je suis tout ouïe !

- ✉️ Email : [foucault.wattinne@iteem.centralelille.fr](mailto:foucault.wattinne@iteem.centralelille.fr)
- 📱 Messenger : [@foucaultwatt](https://m.me/fukowatt)
- 🔗 Projet sur GitHub : [Découvre le projet ici](https://github.com/foucault-watt/centraliz)

## 🔔 Nouveautés à venir

- 🔕 Notifications de nouveaux mails
- 📊 Historique et évolution des notes
- ⚙️ Widgets Android pour un accès encore plus rapide

---

_Rends-toi la vie à Centrale plus facile avec Centraliz !_

## Jeu optionnel : Le Musée

`npm run go`, `npm run build` et `npm run rezo` préparent automatiquement le jeu
avant React. Le dépôt frère `../le-musee` est détecté par défaut (donc
`C:/code/le-musee` pour un checkout dans `C:/code/centraliz`). Un autre chemin
peut être fourni via `LE_MUSEE_DIR`.

- Projet présent : son `tools/export-web.ps1` refait l’export, puis les fichiers
  sont copiés dans `frontend/public/games/le-musee/`. La page `/musee` et son
  entrée de navigation sont incluses. L’export Godot et le build React affichent
  leur progression en direct ; `npm run rezo` poursuit avec le déploiement habituel.
- Projet absent : aucune route, entrée de menu ou ressource du jeu n’est incluse.
  Une ancienne copie générée est supprimée avant le build. React fonctionne sans
  Godot sur cette machine. Relancer le serveur de développement après avoir
  ajouté ou retiré le dépôt du jeu.
- Projet présent mais export défaillant : la commande échoue et `rezo` ne déploie
  pas une version incomplète. Il faut Godot, PowerShell (`pwsh` hors Windows) et
  les modèles web attendus par le dépôt du jeu. `GODOT` permet de choisir le moteur.

Les sources et images originales restent dans le dépôt Le Musée. Les fichiers
copiés sont ignorés par Git. Le jeu est téléchargé au clic sur « Jouer » ; sa
progression reste locale au navigateur, sans synchronisation au compte.
La page `/musee` est publique et ne demande aucun compte Centraliz, sans menu : c’est
le lien à partager. Dans l’app, le menu mène à `/le-musee`, avec connexion et menu,
qui reste en place après une actualisation. Les autres pages et les rapports
administrateur gardent leur authentification habituelle.

Vérifications locales : `npm --prefix frontend run test:musee-build` puis
`npm --prefix frontend test -- --watchAll=false --runInBand Musee.test.js`.
Le serveur doit servir `.wasm` avec `application/wasm`. Activer gzip/Brotli sur
les ressources du jeu pour réduire le transfert ; aucun réglage serveur n’est
modifié par ce build. Comme les autres routes React, `/musee` nécessite le fallback
vers l’index de Centraliz ; les chemins `/games/le-musee/*` servent les vrais fichiers.

Sur PC, la page conserve un cadre 16:9, y compris en plein écran avec des bandes
noires si nécessaire. Sur petit écran ou avec un pointeur tactile principal, « Jouer »
ouvre le jeu sur toute la page et demande le plein écran natif. Là où il est absent
ou refusé (iPhone Safari), le jeu couvre quand même la page, sous les barres du
navigateur ; l’ajout à l’écran d’accueil permet de les masquer. Le jeu gère lui-même
le format : vertical sur téléphone (il demande de tourner un téléphone tenu à
l’horizontale), vertical et horizontal sur tablette.

Le téléversement SFTP affiche le pourcentage en octets, le volume envoyé, la vitesse
courante en Ko/s ou Mo/s et le nombre de fichiers terminés. La progression utilise
les écritures acquittées par SFTP, y compris pendant l’envoi des gros fichiers.
Les dix transferts simultanés sont conservés ; la barre est arrêtée en cas d’erreur.
Vérification sans connexion serveur : `node --test tools/upload-with-progress.test.cjs`.

Le lien à partager après déploiement est `https://centraliz.it/musee`.
Le rapport du jeu est dans `/analytics/admin/musee` (administrateur uniquement).
Il montre les joueurs connectés, les navigateurs anonymes, les démarrages,
les réussites et le temps actif par niveau. Le suivi se dégrade silencieusement
si l’API est indisponible ; il ne synchronise pas la sauvegarde.

`npm run rezo` construit le frontend puis transfère le frontend, le code backend
et les collecteurs Moodle par SFTP. Le backend est mis à jour sans suppression
de ses fichiers distants, puis redémarré via sa route secrète existante. Les
événements analytics apparaissent après cette mise à jour et ce redémarrage.

## Déploiement SFTP et tableau de bord

Le MCP Moodle distant (OAuth et clé personnelle conservée par le client) est
désactivé par défaut. Voir [son modèle de sécurité et son activation ChatGPT](docs/mcp-distant.md)
avant de migrer un compte ou d'activer la route publique.

La commande affiche un tableau de bord animé cyan/violet : build React et export
du Musée, connexion, progression réelle en octets, débit, ETA et bilan. Les sorties
du build apparaissent dans un journal intégré. Les logs complets sont sauvegardés
et accessibles avec `npm run logs -- rezo`. Une carte compacte termine le déploiement ;
`--verbose` réaffiche aussi le journal à la fin. `--plain` fournit un journal sans animations ni séquences ANSI.
Le mode non interactif utilise automatiquement ce journal simple.

```powershell
npm run rezo                       # Build puis transfert frontend + backend
npm run rezo:demo                  # Démonstration animée, sans réseau ni build
npm run rezo -- --dry-run          # Manifeste détaillé, sans build ni connexion
npm run rezo -- --backend-only     # Code backend et collecteurs uniquement
npm run rezo -- --frontend-only    # Ancien périmètre frontend uniquement
npm run rezo -- --skip-build       # Utilise le build frontend déjà présent
npm run rezo -- --no-restart       # Transfert seul, sans demande de redémarrage
npm run deploy                    # Transfert complet, sans reconstruire le frontend
npm run test:deploy                # Tests avec SFTP simulé, sans serveur réel
```

Dans le fichier `.env` racine, conserver les identifiants SFTP existants et ajouter
**`SFTP_BACKEND_REMOTE_PATH`**, qui doit désigner le dossier contenant `server.js`
et `package.json` du backend sur le serveur :

```dotenv
SFTP_REMOTE_PATH=/chemin/du/site/public
SFTP_BACKEND_REMOTE_PATH=/chemin/du/site/backend
SFTP_PORT=8887
DEPLOY_BACKEND_URL=https://centraliz.it
```

Le port reste 8887 par défaut. Le chemin des collecteurs est déduit du dossier
backend : `/chemin/du/site/prototypes/moodle`. Cette disposition correspond aux
chemins utilisés par le service Moodle. Les trois destinations doivent être
distinctes et non imbriquées. L'absence d'un chemin ou une destination dangereuse
bloque l'exécution avant le build et avant toute suppression du frontend.

**Frontend :** le dossier `frontend/build` remplace le répertoire public distant,
comme auparavant. Aucun fichier à conserver ne doit se trouver dans ce répertoire.

**Backend :** seuls `server.js`, `package.json`, `package-lock.json`, les sources
JS/CJS/MJS sous `src/{config,middlewares,routes,services,utils,ws,mcp}` et les
migrations SQL sont envoyés. Les six fichiers applicatifs Python/requirements du
collecteur Moodle sont envoyés séparément. Les tests et fichiers cachés sont exclus.

Les `.env*`, logs, `src/data`, uploads, téléchargements, dépendances, caches,
environnements Python, navigateurs et scripts de migration de comptes ne sont pas
envoyés. **Tout fichier uniquement présent sur le serveur reste en place**, même
s'il s'agit d'un ancien fichier de code supprimé localement. Les données statiques
de `src/data` et l'initialisation d'un nouveau serveur nécessitent un traitement
distinct : cette commande met à jour une installation existante.

Chaque fichier backend est envoyé dans un fichier temporaire du même dossier,
puis remplacé avec l'extension SFTP OpenSSH `posix-rename`. Si l'extension n'est
pas disponible, la commande échoue ; elle ne supprime pas l'ancienne destination
pour contourner ce problème. Le support du remplacement est testé avec des
fichiers temporaires vides avant tout effacement du frontend. Les liens symboliques sources ou dans les dossiers
de destination sont refusés. En cas d'échec, seuls les temporaires de cette
commande sont nettoyés. Après une interruption brutale, un temporaire peut rester.
Le remplacement est atomique **par fichier**, pas pour l'ensemble du déploiement :
un échec peut laisser une partie du code mise à jour, à compléter en relançant.

La commande n'exécute pas `npm install`, de migrations SQL
ou d'installation Python/Chromium. Ces étapes restent à effectuer sur le VPS si
les dépendances ou le runtime ont changé. Aucun mot de passe n'est affiché par
le déploiement.

### Redémarrage après transfert

Quand le backend est inclus, le redémarrage est activé par défaut. Renseigner
`DEPLOY_BACKEND_URL` avec son URL publique HTTPS, sans le chemin de crash. Le
secret est lu dans `DEPLOY_RESTART_SECRET`, à défaut `SECRET_API` du `.env` racine,
puis `SECRET_API` du fichier `backend/.env`. Il doit correspondre au `SECRET_API`
de l'environnement distant. Aucune session utilisateur Centraliz n'est nécessaire.

La commande termine tous les transferts, ferme SFTP, puis appelle **une seule
fois** l'URL existante `/api/<secret>/crash`. Une coupure de connexion ne provoque
pas une seconde demande : l'ancienne route pouvait quitter avant d'envoyer sa
réponse. Le script attend ensuite jusqu'à 90 secondes le changement de `bootId`
sur `/api/healthcheck`. Un backend joignable avec l'ancien identifiant ne suffit
pas à déclarer le redémarrage réussi. La vérification fonctionne aussi au premier
déploiement lorsque l'ancien backend ne possède pas encore ce point de santé.

La route conserve le code de sortie 1 attendu par le superviseur de l'association,
en envoyant désormais la réponse avant la sortie. L'hébergeur reste responsable
de relancer le processus : cette commande ne peut pas démarrer seule un serveur
arrêté. Si le retour n'est pas confirmé, les fichiers restent transférés et la
commande termine en erreur avec un message distinct.

Ni `--dry-run`, ni `--demo`, ni `--frontend-only`, ni un transfert échoué ne
déclenchent cette route. `--no-restart` permet de désactiver explicitement l'étape.
Sans cette option, une configuration de redémarrage manquante bloque avant le
build et les transferts. L'URL secrète n'est pas affichée par le script et les
requêtes contenant le secret sont exclues du journal HTTP du backend. Le secret
reste toutefois dans le chemin URL, donc peut encore figurer dans les logs du
reverse proxy de l'hébergeur ou l'historique lors d'un appel manuel au navigateur.

## Tableau de bord de développement

`npm run go` conserve les commandes frontend `start` et backend `dev`, mais sépare
leurs sorties dans deux colonnes : frontend cyan, backend violet. Les panneaux
affichent l'heure des messages, les états démarrage/compilation/prêt/erreur et les
URLs locales. Un terminal étroit empile les deux panneaux. L'historique interactif
garde 5 000 lignes par source ; le fichier journal conserve l'intégralité des
messages, y compris les longues lignes tronquées à l'affichage.

```powershell
npm run go                 # Tableau de bord interactif
npm run go:demo            # Aperçu fictif, aucun serveur lancé
npm run go -- --plain      # Logs complets préfixés, sans animations
npm run test:go            # Tests locaux sans lancement des serveurs
```

Raccourcis : **F** agrandit le frontend, **B** le backend, **A** affiche les deux,
**P** fige/reprend l'affichage (les logs continuent d'être collectés), **Ctrl+C**
arrête les deux arbres de processus démarrés par cette commande. Les autres
processus Node de la machine ne sont pas ciblés. Si l'un des processus surveillés
se termine, son voisin est également arrêté. Le mode sans terminal interactif
utilise automatiquement les logs simples.

### Rendu stable et récupération des logs (`go` et `rezo`)

Le moteur commun utilise un écran alternatif, des positions de curseur absolues
et un rendu différentiel. Il n'efface plus l'écran avant de redessiner et n'écrit
rien pour une image inchangée. Les mises à jour sont regroupées par le mode VT
« synchronized output » lorsque le terminal le prend en charge. Les largeurs
Unicode et la taille du terminal sont prises en compte pour éviter les retours
à la ligne qui provoquaient le défilement du tableau.

Un écran interactif n'est pas le scrollback natif du terminal. Pour naviguer et
copier les logs :

- **PgUp / PgDn** : remonter/descendre dans l'historique du tableau ; **Début**
  remonte au plus ancien message conservé, **Fin** revient au direct.
- **L** : quitter le tableau et afficher le journal intégral, puis continuer en
  logs classiques. Le défilement et la sélection natifs du terminal fonctionnent
  alors normalement. Ce choix reste actif jusqu'à la fin de la commande.
- **C** sous Windows : copier le journal intégral courant dans le presse-papiers,
  sans le tronquer à la fenêtre ou à l'historique interactif. Cela remplace le
  contenu du presse-papiers uniquement sur cette action utilisateur.

Chaque exécution crée un fichier UTF-8 sous `logs/cli/`, ignoré par Git et jamais
envoyé par SFTP. Le chemin est affiché à la fin ou en mode **L**. Les secrets connus
dans les fichiers d'environnement et les champs usuels de connexion sont masqués
avant affichage, sauvegarde ou copie. L'écran normal du terminal est restauré à
l'arrêt, puis le journal complet y est réaffiché pour pouvoir le sélectionner.
Le fichier reste la référence pour une session dépassant la limite de scrollback
du terminal. Les journaux ne sont pas supprimés automatiquement.

On peut aussi afficher le dernier journal dans un autre terminal, pendant que les
serveurs tournent ou après leur arrêt :

```powershell
npm run logs -- go
npm run logs -- rezo
npm run test:terminal
```

`DEPLOY_BACKEND_URL` reste l'URL **de base** HTTPS du backend, par exemple
`https://centraliz.it`. Ne pas y mettre le chemin `/api/<secret>/crash` : celui-ci
est construit par le script à partir du secret local.
