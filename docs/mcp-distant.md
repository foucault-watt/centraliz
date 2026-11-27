# MCP Moodle distant : première version

Le MCP distant est intégré à Express, désactivé par défaut. Il réutilise les
collecteurs Moodle et le résolveur ENT. Aucun service supplémentaire ni port 3002
public n'est nécessaire. Le port 3002 reste réservé au prototype local.

## Modèle de protection

L'ancien `userSecretSalt` est un HMAC calculable avec `SECRET_KEY_CENTRALIZ` et
le nom du compte. Le placer dans le téléphone n'en fait pas un secret indépendant
du serveur. Ajouter OAuth autour de ce chiffrement ne règle pas cette faiblesse.

Lors du consentement, une clé aléatoire de 256 bits est générée dans le navigateur.
Le mot de passe ENT existant est remplacé **dans la même ligne** par un chiffré
`v3:` AES-256-GCM. Ce format dépend de la clé personnelle, pas du secret serveur.
Le nom ENT et la version sont liés au chiffré par les données authentifiées.
La migration utilise une mise à jour conditionnelle sur l'ancien chiffré pour
éviter qu'une opération concurrente écrase la nouvelle clé.

La clé personnelle est conservée dans le stockage local du navigateur sous
`centraliz.entKey:<compte>`. Elle ne figure pas dans la session Centraliz, ni dans
`/api/auth/status`. Une réponse perdue après migration ne doit pas faire perdre
cette clé : une sauvegarde temporaire locale précède la requête.

OAuth utilise les handlers du SDK MCP installé : code d'autorisation, PKCE S256,
clients publics (`none`), codes à usage unique, scope unique `moodle:read` et
vérification de la ressource. Les URLs de retour sont préautorisées **à l'identique**.
Il n'y a ni wildcard ni téléchargement de métadonnées depuis un client_id arbitraire.

Chaque code/jeton est un secret aléatoire indépendant de 256 bits. Le registre
serveur conserve son empreinte SHA-256 et une enveloppe chiffrée contenant
l'identité et la clé personnelle. L'enveloppe est chiffrée avec AES-256-GCM et une
clé HKDF dérivée **du code/jeton brut**, absent du stockage serveur. Type,
empreinte, client, autorisation, expiration, ressource et paramètres du code sont
authentifiés. Une clé serveur ou une empreinte ne déverrouille pas l'enveloppe.

Les jetons d'accès durent 10 minutes. Les jetons de renouvellement sont remplacés
à chaque utilisation ; la réutilisation d'un ancien jeton révoque toute la famille.
L'autorisation expire après 90 jours au maximum : l'utilisateur doit alors la
renouveler avec sa clé locale. Plusieurs assistants peuvent partager la même clé
personnelle, avec des autorisations révocables séparément. Le profil MCP est
identifié par un UUID stable, pas par l'identifiant ENT.

### Ce que cela ne garantit pas

- Un attaquant contrôlant le processus pendant un appel peut capturer le jeton,
  la clé personnelle et le mot de passe utilisé. Les sessions Moodle en mémoire
  restent aussi des accès exploitables. Ce n'est pas du calcul aveugle.
- Le client MCP conserve une autorisation qui permet le déverrouillage. Son vol
  et la compromission de ce client sont donc des risques de sécurité.
- Le navigateur conserve la clé, même après une déconnexion Centraliz. Un script
  malveillant sur cette origine ou une personne utilisant le même profil navigateur
  peut la récupérer. Utiliser un appareil personnel et protéger toute l'origine.
- Les anciens chiffrés présents dans les sauvegardes, exports ou historiques ne
  sont pas transformés par la migration. Pour invalider un ancien mot de passe
  récupérable, il faut le changer auprès de l'ENT, puis mettre à jour le mot de
  passe dans Centraliz depuis l'appareil possédant la nouvelle clé.
- Perdre toutes les clés locales et toutes les autorisations ne permet pas de
  retrouver le secret grâce au serveur. Il n'y a volontairement pas de récupération
  par clé maître. Une procédure de réinitialisation reste à concevoir.
- Cette version n'a pas encore été essayée avec un vrai compte ChatGPT. Les tests
  couvrent le protocole et le client SDK, pas les capacités du produit à exploiter
  chaque type de fichier binaire. Le fichier est renvoyé sans extraction de texte.

## Activation pour l'essai ChatGPT

Déployer ensemble le backend **et le frontend** : les anciens frontends peuvent
effacer/remplacer la clé locale en rafraîchissant l'état de connexion. Ne pas migrer
un compte tant que ce frontend n'est pas en place.

Configurer dans `backend/.env` :

```dotenv
MCP_REMOTE_ENABLED=true
MCP_PUBLIC_URL=https://centraliz.it/api/mcp
MCP_REDIRECT_URIS=[]
```

Cette première configuration expose la découverte OAuth, mais **n'autorise aucune
connexion**, car la liste des URLs de retour est vide. Elle permet de commencer
la création du connecteur ChatGPT. Copier ensuite l'URL de retour exacte indiquée
dans la gestion du connecteur et remplacer `[]` par `["https://URL-EXACTE"]`, puis
redémarrer le backend. Ne pas la
déduire d'un exemple trouvé sur Internet. Sélectionner l'enregistrement dynamique
(DCR) quand ce choix est proposé ; le serveur n'annonce pas CIMD. Les clients
utilisent PKCE et l'authentification du client `none`, sans secret statique.

Le frontend et le MCP doivent partager la même origine publique pour que la clé
locale soit accessible aux deux. L'application utilise désormais `SESSION_SECRET`
(recommandé, aléatoire et indépendant) ou `SECRET_KEY_CENTRALIZ` pour signer les
sessions, à la place de l'ancienne constante dans le code. Ce changement déconnecte
les sessions existantes au premier déploiement.

Le reverse proxy doit acheminer vers le backend :

```text
/api/mcp
/api/mcp/oauth/*
/.well-known/oauth-protected-resource/api/mcp
/.well-known/oauth-authorization-server/api/mcp/oauth
```

Le SDK sert aussi `/.well-known/oauth-authorization-server` à la racine. Les
réponses de découverte doivent être du JSON, jamais la page HTML du frontend ni
la réponse mise en cache du service worker. Exemple Nginx à adapter par l'hébergeur
si `/api/` est déjà correctement transmis :

```nginx
location ^~ /.well-known/oauth- {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Redémarrer le backend après configuration. Vérifier :

```text
GET https://centraliz.it/api/mcp
  -> 401 avec WWW-Authenticate et resource_metadata
GET https://centraliz.it/.well-known/oauth-protected-resource/api/mcp
  -> JSON avec resource et authorization_servers
GET https://centraliz.it/.well-known/oauth-authorization-server/api/mcp/oauth
  -> JSON avec authorize/token/register/revoke et S256
```

Dans ChatGPT, ajouter l'URL MCP avec OAuth selon l'interface disponible sur le
compte/l'espace, puis lancer la connexion. Le navigateur doit être connecté à
Centraliz et le compte ENT doit déjà être lié. La page demande le consentement
explicite avant de migrer le chiffrement. Si l'utilisateur n'est pas connecté à
Centraliz, elle propose une connexion dans un autre onglet, puis un retour à la
page de consentement. Le parcours initial sans compte Centraliz/ENT prélié n'est
pas encore implémenté.

Gestion et sauvegarde de la clé :
`https://centraliz.it/api/mcp/oauth/consent/connections`.
Une connexion autorisée permet de récupérer les PDF sans garder Centraliz ouvert.
La clé n'est jamais à coller dans une conversation. Le prototype local accepte
la sauvegarde via `--key-file <chemin>` pour les comptes migrés.

## Stockage et exploitation

Le registre est `backend/data/mcp-oauth/store.json`, exclu de Git et du manifeste
de déploiement. Il conserve des enveloppes, des empreintes et des métadonnées,
jamais les jetons bruts, les clés ou les mots de passe. Les nouveaux fichiers
reçoivent les permissions 0600 et le dossier 0700 sous Unix. Les écritures se font
par remplacement de fichier temporaire. Il n'y a pas de nouvelle table Supabase.

**Une seule instance Node doit écrire ce registre.** Le stockage actuel n'est pas
adapté à plusieurs processus/replicas et ne fournit pas de verrou distribué. Le
volume doit être persistant ; sa perte impose la reconnexion des assistants, mais
ne déchiffre pas les comptes. Pour une montée en charge, remplacer l'adaptateur
par un stockage transactionnel partagé, sans changer le format des enveloppes.

Les URLs MCP/OAuth et leurs référents ne sont pas inscrits dans Morgan. Il faut
également désactiver/masquer les paramètres OAuth et en-têtes Authorization dans
les logs du reverse proxy, de l'APM et de tout intermédiaire. Ne jamais y journaliser
les corps de token/approve, ni les réponses OAuth. Les sauvegardes mémoire/core
dumps peuvent contenir des secrets actifs.

Révoquer une autorisation invalide ses jetons ; le pool Moodle est fermé pour
éliminer ses sessions en mémoire (dans cette version, les autres sessions Moodle
du pool seront aussi recréées au prochain appel). Révoquer ne remet pas le mot de
passe sous l'ancien chiffrement.

## Vérification locale

```powershell
npm --prefix backend run test:mcp
```

Les tests HTTP utilisent un serveur éphémère local et des identifiants fictifs.
Ils vérifient PKCE, les URLs de retour, le consentement avec CSRF/Origin,
l'identité imposée côté serveur, les octets du PDF, le profil stable, la rotation,
le rejeu et la révocation. Les tests de migration utilisent un faux adaptateur
Supabase pour vérifier les mises à jour conditionnelles et l'impossibilité d'un
retour accidentel à l'ancien chiffrement. Les tests du script navigateur couvrent
la perte de réponse après migration. Aucun compte réel n'est migré par ces tests.

Références : [autorisation MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
[authentification ChatGPT](https://developers.openai.com/plugins/build/auth).
