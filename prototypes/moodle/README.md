# Accès Moodle dans Centraliz

Fonctions disponibles : connexion CAS, cours, sections, ressources et transfert
des fichiers originaux. Un MCP HTTP local réutilise le service backend. Aucun
texte de document n'est extrait et aucun moteur IA n'est exécuté côté serveur.

## MCP local

Depuis la racine du dépôt, après installation des dépendances backend :

```powershell
npm --prefix backend run mcp
```

Le terminal accepte l'identifiant **ENT ou Centraliz**. Il retrouve le compte
canonique `users.username`, vérifie sa liaison ENT puis dérive la clé avec cette
identité. Un compte inconnu, ambigu ou une erreur de base bloque le lancement
avec un message précis. On peut aussi fournir l'identifiant au démarrage :

```powershell
npm --prefix backend run mcp -- --user MON_IDENTIFIANT_CENTRALIZ
```

Le backend lit sa configuration habituelle dans `backend/.env`. Il dérive la
clé utilisateur avec `createUserSecretSalt`, puis réutilise les identifiants ENT
stockés avec le service existant. Aucune session du navigateur ou connexion
simultanée depuis un téléphone n'est nécessaire. Le mot de passe ENT ne doit pas
figurer dans les arguments, les outils ou la configuration d'un client MCP.

Le serveur écoute exclusivement sur `http://127.0.0.1:3002/mcp` en Streamable HTTP.
Le compte est fixé au lancement, jamais dans les arguments des outils.
Relier l'ENT dans l'interface ne change pas le compte choisi au lancement du MCP.
Si un ancien lanceur a été démarré avec l'identifiant ENT traité comme un compte
Centraliz, l'arrêter avec Ctrl+C et le relancer avec cette version corrigée.
Ce mode de développement fait confiance aux processus de la machine locale et
ne fournit pas encore OAuth multiutilisateur. **Ne pas publier ce point d'entrée
par un tunnel ou un proxy VPS.** La future route publique devra identifier
l'utilisateur via un jeton OAuth avant d'appeler le même service.

Pour tester avec MCP Inspector, lancer dans un autre terminal :

```powershell
npx @modelcontextprotocol/inspector
```

Sélectionner Streamable HTTP et l'URL locale ci-dessus. L'origine web Inspector
standard `http://localhost:6274` (ou `127.0.0.1:6274`) est autorisée. Les autres
origines navigateur et les hôtes non locaux sont refusés.

Outils :

| Outil | Paramètres |
| --- | --- |
| `lister_mes_cours` | aucun |
| `lister_ressources_cours` | `courseId` (le paramètre `id` du lien du cours) |
| `lister_fichiers_ressource` | `courseId`, `moduleId` renvoyé dans les ressources |
| `recuperer_fichier` | `courseId`, `moduleId`, `fileIndex` (0 par défaut) |

### Fichiers originaux

Les activités Moodle de type **Fichier** (`resource`) et **Dossier** (`folder`)
sont prises en charge pour le téléchargement. Pour un dossier, commencer par
`lister_fichiers_ressource`, puis sélectionner le `fileIndex` souhaité.
Les autres activités restent consultables par leurs liens Moodle.

`recuperer_fichier` renvoie le nom, le MIME, la taille et le SHA-256 du fichier,
ainsi qu'une ressource MCP embarquée avec `blob` en base64. Le base64 transporte
les octets originaux sans conversion ; il n'est pas placé dans un message texte.
Le client peut aussi appeler `resources/read` avec l'URI
`moodle://courses/{courseId}/resources/{moduleId}/files/{fileIndex}`.

Le client IA doit savoir lire ou sauvegarder les ressources MCP binaires.
Un blob MCP ne garantit pas une pièce jointe native dans l'interface ChatGPT :
cette intégration spécifique n'est pas encore réalisée. Aucun appel à une API
d'IA, OCR, extraction de texte ou conversion de document n'est ajouté.

La limite est de **20 Mio par fichier**, vérifiée pendant la lecture réseau.
Les octets sont conservés en mémoire dans le cache court décrit ci-dessous. Le
backend vérifie leur taille et empreinte avant transmission. Les identifiants sont
revérifiés à chaque opération ; les cours et ressources autorisés sont rafraîchis
au maximum toutes les 60 secondes. Seuls les modules trouvés dans un cours inscrit sont lus.
Les redirections vers un autre domaine sont refusées.

Dans Centraliz, « Télécharger » sur une ressource Fichier appelle également le
backend et télécharge le fichier original, au lieu de renvoyer seulement le lien
Moodle. Les liens vers les fichiers ne sont pas des liens publics créés par ce service.

## Intégration

La page `/moodle` de Centraliz appelle `POST /api/moodle/courses` via `fetchApi`.
Le backend utilise la session Centraliz et `X-User-Key`, puis appelle
`ZimbraService.resolveStoredCredentials(username, userKey)` : le compte ENT lié
et le mot de passe sont récupérés et déchiffrés par le code existant.
Il ne faut pas transmettre de nom d'utilisateur ou de mot de passe à cette route.
Si les identifiants sont absents, les configurer dans la page Mails existante.

Le collecteur Python reçoit les identifiants par un pipe privé stdin et renvoie
les résultats JSON sur stdout. Les erreurs brutes ne sont
pas journalisées. Seuls les événements structurés autorisés de stderr sont
repris dans les logs du backend. Un processus et un navigateur persistants sont
isolés par compte Centraliz, clé utilisateur et identifiants ENT. Les appels d'un
même compte sont sérialisés ; les requêtes identiques simultanées sont regroupées.
Aucune session, capture ou trace de navigateur n'est enregistrée sur disque.

### Latence et durée des caches

- Session Moodle réutilisée entre les outils, avec reconnexion si elle a expiré.
- Cours, sections et fichiers gardés en mémoire au maximum 60 secondes, sans
  prolongation de cette durée lors des lectures. La visibilité de changements de
  droits ou de documents peut donc prendre jusqu'à 60 secondes.
- Les identifiants stockés sont relus et déchiffrés à chaque appel avant tout
  accès au collecteur. Une clé incorrecte ne permet pas de bénéficier d'un cache.
- Les changements d'identifiants éliminent l'ancien processus du même compte.
- Maximum 4 processus par instance de service ; fermeture après 2 minutes sans
  requête. Les documents retenus par chaque processus sont limités à 40 Mio.
- La liste des fichiers conserve les octets déjà reçus pour que le téléchargement
  suivant ou `resources/read` ne redemande pas le même document à Moodle.
- Tout échec de collecte invalide la session et ses caches. Une redirection vers
  l'authentification pendant une navigation réutilisée permet une seule tentative
  automatique de reconnexion.

Les événements `session_reused`, `courses_cache_hit`, `sections_cache_hit`,
`resource_cache_hit` et `request_coalesced` permettent de vérifier le gain. Les
durées incluent l'attente de la file par compte. Le premier appel et les appels
après fermeture du collecteur restent soumis au coût initial CAS/Chromium.

Après redémarrage du MCP, mesurer trois appels réels successifs avec :

```powershell
npm --prefix backend run mcp:bench
```

La sortie indique la version du serveur (0.2.0 pour le collecteur persistant), la
durée et le nombre de cours uniquement. Elle ne contient pas les titres ni les secrets.

### Logs backend

Les lignes préfixées `[Moodle]` apparaissent dans la console backend et dans les
fichiers `backend/src/data/backend-JJ-MM-AA.log` via le service de logs existant.
Chaque collecte porte un `requestId`, un événement et une durée `durationMs`.
Les événements suivent la résolution des identifiants, le lancement du processus,
les étapes Playwright, puis le succès (nombre de cours) ou l'échec.

- `collector_spawn_failed` avec `reason: ENOENT` : exécutable Python introuvable.
- `stage_failed` avec `workerStage: runtime_imports` : import du runtime impossible.
- `stage_failed` avec `workerStage: browser_start` : échec du lancement Chromium.
- `stage_failed` avec `workerStage: cas_open`, `cas_form` ou `cas_submit` : navigation ou formulaire CAS.
- `stage_failed` avec `workerStage: moodle_authentication` : retour authentifié vers Moodle non confirmé.
- `stage_failed` avec `workerStage: courses_*` : échec de lecture de la liste.
- `reason: COURSE_GROUP_FILTER_MISSING` : regroupement attendu absent.
- `reason: COURSE_PAGINATION_UNSUPPORTED` : contrôles insuffisants pour garantir une liste complète.
- `reason: COURSE_PAGINATION_STALLED` : pagination bloquée ou limite de sécurité atteinte.
- `courses_frontend_request` : lecture par le module web Moodle lorsque le menu ne propose pas de regroupement exhaustif.
- `reason: COURSE_FRONTEND_*` : module indisponible, délai dépassé, réponse invalide ou requête refusée.
- `collector_timeout` : délai global de 180 secondes dépassé.

Les mots de passe, clés utilisateur, identifiants, cookies, tickets CAS, noms des
cours et erreurs brutes ne sont pas inclus dans ces nouveaux logs. Pour diagnostiquer
un échec, rechercher toutes les lignes portant le même `requestId`.

Le collecteur est temporairement conservé ici avec son outil de vérification
interactif ; le service applicatif se trouve dans `backend/src/services/moodleService.js`.

## Installation locale (Python 3.14, PowerShell)

Depuis la racine du dépôt :

```powershell
python -m venv --without-pip prototypes/moodle/.venv
python -m pip --python prototypes/moodle/.venv/Scripts/python.exe install -r prototypes/moodle/requirements.txt
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/prototypes/moodle/.browsers"
prototypes/moodle/.venv/Scripts/python.exe -m playwright install chromium
```

Lancer ensuite Centraliz avec son environnement habituel (`npm run go`).
Le backend détecte ce Python automatiquement. Pour un autre environnement,
définir `MOODLE_PYTHON` avec le chemin de l'exécutable Python disposant de Playwright.
Sur Linux, utiliser `.venv/bin/python` et installer les dépendances système de
Chromium selon la [documentation Playwright](https://playwright.dev/python/docs/browsers).
Le déploiement de ce runtime n'est pas automatisé par ce changement.

## Vérifications

```powershell
node --test backend/src/routes/moodle.test.cjs
node --test backend/src/mcp/moodleServer.test.cjs backend/src/services/moodleService.test.cjs
prototypes/moodle/.venv/Scripts/python.exe -m unittest discover -s prototypes/moodle -v
npm --prefix frontend test -- --watchAll=false --runInBand --runTestsByPath src/components/MoodleCourses.test.js src/utils/api.test.js
```

Pour le test autonome avec saisie masquée locale :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File prototypes/moodle/run.ps1
```

`inspect_login.py` inspecte uniquement les attributs du formulaire public, sans
identifiants ni valeurs de champs. `run-result.json`, ignoré par Git, ne contient
que l'état du test interactif et éventuellement le nombre de cours.

Le parcours CAS a été vérifié avec Playwright. L'utilisateur a confirmé l'affichage
des cours depuis Centraliz et le téléchargement d'un fichier original. Une lecture
de 15 sections est également confirmée dans les logs d'un appel réel. Le transport
MCP est testé avec le client SDK officiel et un fichier binaire simulé ; la
compatibilité du rendu des fichiers avec chaque assistant reste à vérifier.

Les filtres et l'option « tous » de l'aperçu Moodle s'appuient sur les
[attributs standards Moodle](https://github.com/moodle/moodle/tree/MOODLE_405_STABLE/blocks/myoverview/templates).
Le collecteur utilise l'option « tous » lorsqu'elle existe, sinon il parcourt les
pages jusqu'à la désactivation du bouton suivant. Il ignore les pages précédentes
conservées dans le DOM mais masquées. Si les contrôles ne permettent pas de confirmer
la fin de la liste, ou si aucun cours n'est extrait, la collecte échoue explicitement.
Les filtres d'affichage peuvent être mémorisés par Moodle.

Si les filtres `allincludinghidden` et `all` sont absents, le collecteur appelle
`block_myoverview/repository.getEnrolledCoursesByTimeline` dans la page authentifiée,
avec la classification `allincludinghidden` et une pagination contrôlée. Il utilise
ainsi le [chargement AJAX de l'aperçu Moodle](https://github.com/moodle/moodle/blob/MOODLE_405_STABLE/blocks/myoverview/amd/src/repository.js).
Cette requête utilise la session créée par Playwright, sans jeton d'API externe,
sans changement d'identité ni nouveau stockage d'identifiants. Son fonctionnement
sur l'instance de Centrale Lille a été confirmé avec 75 cours dans les logs réels.
