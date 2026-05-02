-- Ajoute une taxonomie explicite pour distinguer exposition, chargement automatique,
-- interaction utilisateur, conversion produit, activité admin et système.

ALTER TABLE public.analytics_events
ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'interaction',
ADD COLUMN IF NOT EXISTS is_automatic boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS source text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'analytics_events_event_type_check'
  ) THEN
    ALTER TABLE public.analytics_events
    ADD CONSTRAINT analytics_events_event_type_check
      CHECK (event_type IN ('exposure', 'load', 'interaction', 'conversion', 'admin', 'system'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'analytics_events_source_check'
  ) THEN
    ALTER TABLE public.analytics_events
    ADD CONSTRAINT analytics_events_source_check
      CHECK (source IS NULL OR source IN ('frontend', 'backend', 'system'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.analytics_excluded_users (
  username text NOT NULL,
  reason text NULL,
  created_by text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT analytics_excluded_users_pkey PRIMARY KEY (username),
  CONSTRAINT analytics_excluded_users_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT analytics_excluded_users_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS analytics_events_type_created_at_idx
  ON public.analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_source_created_at_idx
  ON public.analytics_events (source, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_automatic_created_at_idx
  ON public.analytics_events (is_automatic, created_at DESC);

COMMENT ON COLUMN public.analytics_events.event_type IS
  'Taxonomie produit: exposure, load, interaction, conversion, admin ou system.';

COMMENT ON COLUMN public.analytics_events.is_automatic IS
  'True pour les chargements automatiques déclenchés sans interaction explicite.';

COMMENT ON COLUMN public.analytics_events.source IS
  'Origine de l’événement: frontend, backend ou system.';

COMMENT ON TABLE public.analytics_excluded_users IS
  'Utilisateurs pouvant être masqués des statistiques analytics sans supprimer leurs événements bruts.';
