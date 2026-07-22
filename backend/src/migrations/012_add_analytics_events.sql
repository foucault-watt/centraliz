-- Analytics produit interne Centraliz.
-- Umami reste la source de vérité pour l'audience web globale ; cette table
-- ne doit contenir que des événements produit minimisés et utiles.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_username text NULL,
  anonymous_id text NULL,
  event_name text NOT NULL,
  module text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT analytics_events_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_events_user_username_fkey FOREIGN KEY (user_username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT analytics_events_event_name_not_blank CHECK (char_length(trim(event_name)) > 0),
  CONSTRAINT analytics_events_module_not_blank CHECK (char_length(trim(module)) > 0)
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON public.analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_module_created_at_idx
  ON public.analytics_events (module, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_event_name_created_at_idx
  ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_username_created_at_idx
  ON public.analytics_events (user_username, created_at DESC);

COMMENT ON TABLE public.analytics_events IS
  'Evenements produit internes agregeables. Ne pas stocker de contenu sensible, de contenu de mails, de notes detaillees, de mots de passe, de tokens ou de texte libre utilisateur.';

COMMENT ON COLUMN public.analytics_events.user_username IS
  'Identifiant interne nullable utilise uniquement pour calculer activite, retention, cohortes et suppression/anonymisation.';

COMMENT ON COLUMN public.analytics_events.properties IS
  'Metadonnees minimales non sensibles. Interdit: contenu de mails, sujets, expediteurs, notes precises, CSV brut, liens iCal, tokens, mots de passe, texte de feedback.';

COMMENT ON COLUMN public.analytics_events.created_at IS
  'Les evenements bruts ont une retention cible de 24 mois.';

-- Purge manuelle recommandee pour la retention des evenements bruts :
-- DELETE FROM public.analytics_events
-- WHERE created_at < now() - interval '24 months';
