# Canal WebSocket Centraliz

Canal WebSocket générique et authentifié, partagé par toutes les futures
fonctionnalités temps réel (Pokémon collectif, chat éventuel, ...). Un seul
canal pour toute l'application — pas un canal par fonctionnalité.

## Principe

- Le serveur HTTP (`backend/server.js`) est créé explicitement via
  `http.createServer(app)`, ce qui permet d'écouter l'événement `upgrade` et
  d'y attacher un `WebSocketServer` (`backend/src/ws/index.js`), en plus des
  routes Express classiques. Même process, même port.
- L'authentification réutilise exactement le même middleware
  `express-session` que les routes HTTP (`backend/src/config/app.js`,
  export `sessionMiddleware`), rejoué manuellement sur la requête d'upgrade.
  Pas de session valide → upgrade refusé (401), avant même que la connexion
  ne devienne un WebSocket.
- L'origine de la requête d'upgrade doit correspondre à `URL_FRONT`, sinon
  la connexion est refusée (403) au niveau TCP (`socket.destroy()`).

## Enveloppe des messages

Tous les messages, dans les deux sens, suivent le même format JSON versionné :

```json
{ "v": 1, "type": "namespace.action", "requestId": "abc-123", "payload": {} }
```

- `v` : version du protocole (actuellement `1`).
- `type` : `"namespace.action"`, ex. `"pokemon.vote"`. Les handlers sont
  enregistrés par type via `registerHandler(type, fn)` exporté par
  `backend/src/ws/index.js` — un module métier (Pokémon, chat, ...) n'a pas
  besoin de modifier ce fichier pour ajouter ses propres types.
- `requestId` : identifiant fourni par l'émetteur, renvoyé tel quel dans la
  réponse/erreur correspondante pour corréler requête/réponse côté client.
- `payload` : contenu spécifique au type de message.

Un message invalide (JSON cassé, version non supportée, type inconnu,
`requestId` non-string) reçoit en retour une enveloppe `type: "error"` avec
le même `requestId` et un `payload.code` explicite.

## Fiabilité de la connexion

- **Heartbeat** : ping serveur toutes les 30s ; une connexion qui ne répond
  pas par un pong avant le ping suivant est terminée (`ws.terminate()`).
- **Taille max des messages** : 64 Ko (`maxPayload` du `WebSocketServer`).
- **Arrêt du serveur** : sur `SIGTERM`/`SIGINT`, toutes les connexions
  reçoivent un close propre (code `1001`, "going away") avant l'arrêt du
  process (voir `backend/server.js`).
- **Reconnexion client** : le client (`frontend/src/utils/ws.js`) se
  reconnecte automatiquement avec un backoff exponentiel (1s → 30s max) en
  cas de coupure non volontaire. Les messages envoyés pendant une
  déconnexion sont perdus (pas de file d'attente, pas de rejeu au retour de
  la connexion).

## Configuration Nginx requise

Le frontend et le backend étant servis sous le même domaine en production,
le `location` nginx qui proxifie déjà les requêtes vers le backend Node
(port `3001`) doit aussi transmettre les en-têtes d'upgrade WebSocket et
desserrer le timeout de lecture par défaut (60s), qui couperait sinon une
connexion inactive plus longtemps entre deux heartbeats :

```nginx
location /api {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;

    # Nécessaire pour que les requêtes d'upgrade WebSocket soient transmises
    # telles quelles au lieu d'être traitées comme du HTTP classique.
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Le heartbeat applicatif ping/pong toutes les 30s suffit à garder la
    # connexion active ; on garde une marge confortable au-delà du défaut
    # nginx (60s) pour ne jamais couper une connexion saine.
    proxy_read_timeout 120s;
}
```

**Vérification** : après déploiement, `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" https://<domaine>/api` doit répondre `101 Switching Protocols` (ou `401`/`403` selon la session/l'origine, mais jamais une erreur nginx 502/504 avant même d'atteindre le backend).
