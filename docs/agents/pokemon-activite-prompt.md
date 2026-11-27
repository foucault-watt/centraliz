# Prompt : suite du fil d'activité Pokémon (à donner à une IA en local)

Tu travailles sur le dépôt `centraliz`. Lis d'abord `AGENTS.md`, `docs/agents/pokemon-server.md` et `WEBSOCKET.md`.
Branche à reprendre : `ccr-99858876-8q2fbq` (`git fetch origin ccr-99858876-8q2fbq && git checkout ccr-99858876-8q2fbq`).

## Contexte
Une seule partie **Pokémon Rouge Feu en français (FireRed FR)** tourne dans mGBA sur un serveur, partagée par tous les utilisateurs de Centraliz. On veut que les gens suivent l'avancée : historique des faits marquants (badges, captures...), résumé « depuis ta dernière visite », et chat entre joueurs.

## Déjà fait (commit 298f4cf)
- `backend/src/migrations/024_add_pokemon_activity.sql` : tables `pokemon_activity` (événements + chat, une seule table) et `pokemon_last_seen`. **Pas encore appliquée** sur Supabase : à faire quand l'utilisateur est d'accord.
- `backend/src/services/pokemonActivityService.js` (+ tests `.test.cjs`) : `recordEvent({type, text, payload, dedupeKey})` idempotent, `postChat`, `getFeed`, `deleteChat`, `getSummary`.
- Routes dans `backend/src/routes/pokemon.js` : `GET /activity`, `POST /chat`, `DELETE /chat/:id` (admin), `GET /summary`.
- UI : `frontend/src/components/pokemon/ActivityPanel.jsx`, branchée dans `Pokemon.jsx`. Rafraîchissement par polling toutes les 3 s.

## À faire (par ordre)
1. **Valider la lecture mémoire** (étape bloquante, rien n'a été testé). Avec `npm run pokemon:remote` (identifiants SFTP dans le `.env` racine, port 8887), vérifier que mGBA-http expose la lecture de la RAM (voir son Swagger : `http://localhost:5000/swagger/v0.8.2/swagger.json` sur le serveur) et lire quelques octets connus. **Ne jamais appuyer sur un bouton, sauvegarder en jeu ni charger de save state** sans l'accord de l'utilisateur : la partie est partagée et réelle.
2. **Cartographier la mémoire de FireRed FR** : les adresses diffèrent entre versions (US/FR/...). Ne pas les inventer de mémoire : les vérifier sur la ROM réelle (titre via `/core/getgametitle`, comparaison avec la décompilation `pret/pokefirered` et les cartes RAM de la communauté). Nécessaire : flags de badges, flags d'histoire, équipe (espèce, niveau), Pokédex (vus/capturés), carte courante, temps de jeu. Attention aux données de sauvegarde (SaveBlock) dont les adresses peuvent bouger : prévoir de retrouver leurs pointeurs.
3. **Service de détection** `backend/src/services/pokemonEventDetector.js` : lit la RAM toutes les 1 à 2 s, compare à l'état précédent, appelle `recordEvent` avec un `dedupeKey` stable (ex. `badge:3`, `dex:caught:25`). Persister le dernier état connu pour ne pas rejouer d'événements après un redémarrage. Lectures en série, avec timeout court : le serveur Lua traite les connexions une par une et se dégrade si on l'inonde. Ignorer les lectures incohérentes (écran de chargement, transition). Mode démo local (`pokemonDemoService`) : ne rien lire.
4. **Tests** : logique de comparaison testée avec des états simulés (pas d'émulateur).
5. **Finitions possibles** : page « Progression » (badges, Pokédex, équipe), mise en forme du résumé par un LLM (avec cache), passage du chat sur le WebSocket (`registerHandler("pokemon.chat", ...)`) si le polling ne suffit plus.

## Décisions déjà prises
- ROM : FireRed FR. Chat ouvert à tous les utilisateurs connectés. Historique conservé à vie pour les moments clés.
- Un seul fil mêlant événements et chat, avec filtre tout / événements / chat.
- Le polling `/api/pokemon/activity` est exclu des logs Morgan (voir `backend/src/config/app.js`).

## Pièges connus
- Dans l'environnement cloud où ceci a été écrit, `express` et `sharp` n'étaient pas installés : 4 tests Pokémon du backend y échouaient déjà. En local, lance `npm --prefix backend install` puis `node --test backend/src/services/pokemon*.test.cjs backend/src/routes/pokemon*.test.cjs`.
- Frontend : `npm --prefix frontend install`, puis `npx vitest run src/components/Pokemon` et `npx vite build`.
- Le projet est en français (code commenté, messages, commits).

Quand tu as fini une étape, commit sur la branche (pas de PR sauf demande) et résume ce qui reste.
