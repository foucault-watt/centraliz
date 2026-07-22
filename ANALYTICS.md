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

trackProductEvent("module_viewed", "notes", { route: "/notes" });
```

## Regles de minimisation

Ne jamais stocker dans `properties` :

- contenu, sujet, expediteur ou identifiant d'un mail ;
- note precise, intitule detaille d'epreuve, CSV brut ou moyenne personnelle ;
- mot de passe, token, lien iCal, message prive ou texte de feedback ;
- donnees destinees a identifier une personne dans une presentation externe.

Un evenement doit mesurer une action produit utile. S'il ne sert pas a une decision produit, ne pas l'ajouter.

## Dashboard admin

Les statistiques agregées sont disponibles sur `/analytics/admin` pour les administrateurs. La vue n'expose pas les logs individuels.

## Retention

La retention cible des evenements bruts est de 24 mois. Purge SQL recommandee :

```sql
DELETE FROM public.analytics_events
WHERE created_at < now() - interval '24 months';
```
