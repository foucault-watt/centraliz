# Analytics produit Centraliz

Centraliz utilise deux niveaux d'analytics :

- Umami pour l'audience web globale : pages vues, sources, acquisition, SEO.
- `analytics_events` pour l'usage produit interne : modules consultes, actions importantes, retention et utilisateurs actifs.

## Ajouter un evenement

Toujours passer par le service centralise cote backend :

```js
const analyticsService = require("../services/analyticsService");

analyticsService.trackEvent({
  req,
  eventName: "event_created",
  module: "events",
  properties: {
    has_photo: Boolean(req.file),
    event_type: req.body.event_type,
  },
});
```

Cote frontend, utiliser uniquement le helper best-effort :

```js
import { trackProductEvent } from "../utils/analytics";

trackProductEvent("external_link_clicked", "links", { link_id: link.id });
```

## Regles de minimisation

Ne jamais stocker dans `properties` :

- contenu, sujet, expediteur ou identifiant d'un mail ;
- note precise, intitule detaille d'epreuve, CSV brut ou moyenne personnelle ;
- mot de passe, token, lien iCal, message prive ou texte de feedback ;
- donnees destinees a identifier une personne dans une presentation externe.

Un evenement doit mesurer une action produit utile. S'il ne sert pas a une decision produit, ne pas l'ajouter.

Eviter en particulier les evenements automatiques declenches a chaque chargement de page ou de route (`module_viewed`, `calendar_loaded` existaient et ont ete retires en 2026-09 : ils representaient ~47% des lignes de la table sans rien apprendre qu'on ne sache deja via les events metier plus precis comme `calendar_period_changed` ou `mail_list_loaded`).

## Dashboard admin

Les statistiques agregées sont disponibles sur `/analytics/admin` pour les administrateurs. Les vues par compte et par module sont également réservées aux administrateurs.

### Pokémon

Le module est disponible dans Analytics Admin, onglet Modules, même sans activité
sur la période choisie. Le serveur enregistre les événements suivants.

- `pokemon_stream_viewed` pour la première image récente servie au compte.
- `pokemon_play_started` pour la première commande de jeu transmise avec succès.
- `pokemon_session` pour le bilan d’une session d’un navigateur. La page Pokémon
  envoie un résumé réseau à `/api/pokemon/session-stats` toutes les minutes et
  à la fermeture. Le serveur agrège les durées et le trafic, puis enregistre
  le bilan à la fin de la session ou lors d’un arrêt normal. Un flux continu
  est découpé toutes les six heures. Les durées du graphique sont réparties
  par jour civil à Paris.

Chaque type d’activité est compté à nouveau après dix minutes d’inactivité du
compte pour ce type. Le mode démo est exclu de la collecte.

## Retention

La retention cible des evenements bruts est de 24 mois. Purge SQL recommandee :

```sql
DELETE FROM public.analytics_events
WHERE created_at < now() - interval '24 months';
```

## Le Musée : page publique et analytics de jeu

La page `/musee` ne requiert pas de compte. Elle charge le jeu sur demande,
sur PC, tablette et téléphone. `POST /api/analytics/musee` est public mais n’accepte que les
événements du protocole du jeu, des identifiants aléatoires et des métriques bornées.
L’identité d’un compte vient de la session serveur, jamais du corps de la requête.
Un identifiant aléatoire de navigateur est conservé localement pour les visiteurs.
Il ne permet pas de connaître leur identité ni de les reconnaître sur un autre appareil.
Aucun nouveau schéma/table ni accès direct navigateur à Supabase n’est ajouté.

Événements : `musee_play_clicked`, `musee_game_ready`, `musee_level_started`,
`musee_level_checkpoint` (toutes les 30 secondes actives),
`musee_level_completed` et `musee_level_left`. Propriétés : identifiant de niveau,
de tentative/session/événement, reprise/debug/réussite, secondes actives,
déplacements valides, fiches ouvertes et réponses montrées. La page reçoit les
messages uniquement de son iframe et de la même origine. Les tentatives quittées
à la fermeture ont au plus la dernière mesure reçue ; la livraison est best-effort.

Le rapport `/analytics/admin/musee` et `GET /api/analytics/musee/summary` sont
protégés par les middlewares session et administrateur existants. Les exclusions
sont respectées sans supprimer les visiteurs anonymes. Les essais debug sont exclus.
Les instantanés cumulatifs sont fusionnés au maximum par tentative, pas additionnés.
Le taux de réussite utilise la cohorte des tentatives commencées pendant la période.
Une tentative sans réussite observée n’est pas automatiquement un abandon définitif.
La durée médiane est celle de la tentative réussie, pas le temps total cumulé sur
toutes les reprises d’un niveau. Un joueur passant de visiteur anonyme à compte
connecté peut apparaître comme deux participants ; les navigateurs ne sont pas
une mesure exacte de personnes physiques.

La collecte ne bloque jamais le jeu et ne synchronise aucune progression.
La table `analytics_events` et sa politique de rétention existante sont réutilisées.
Les données envoyées par le client sont déclaratives, pas une validation anti-triche.
