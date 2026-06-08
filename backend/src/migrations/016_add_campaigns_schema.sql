-- Système de campagnes configurables pour Centraliz.

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'alert',
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  body text NULL,
  placement text NOT NULL DEFAULT 'global',
  presentation text NOT NULL DEFAULT 'modal',
  priority integer NOT NULL DEFAULT 100,
  dismiss_mode text NOT NULL DEFAULT 'dismissible',
  response_mode text NOT NULL DEFAULT 'none',
  frequency_mode text NOT NULL DEFAULT 'once',
  max_impressions integer NULL,
  cooldown_minutes integer NOT NULL DEFAULT 0,
  start_at timestamp with time zone NULL,
  end_at timestamp with time zone NULL,
  created_by text NULL,
  updated_by text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT campaigns_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT campaigns_type_check CHECK (
    type IN ('alert', 'poll', 'prompt', 'announcement', 'stack')
  ),
  CONSTRAINT campaigns_status_check CHECK (
    status IN ('draft', 'active', 'paused', 'archived')
  ),
  CONSTRAINT campaigns_placement_check CHECK (
    placement IN ('global', 'page-scoped')
  ),
  CONSTRAINT campaigns_presentation_check CHECK (
    presentation IN ('modal', 'banner', 'toast', 'bottom-sheet')
  ),
  CONSTRAINT campaigns_dismiss_mode_check CHECK (
    dismiss_mode IN ('dismissible', 'persistent', 'hide-forever')
  ),
  CONSTRAINT campaigns_response_mode_check CHECK (
    response_mode IN ('none', 'optional', 'required')
  ),
  CONSTRAINT campaigns_frequency_mode_check CHECK (
    frequency_mode IN (
      'once',
      'always',
      'until_dismissed',
      'until_response',
      'until_end_date',
      'max_n_times'
    )
  )
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.campaign_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  block_type text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_blocks_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT campaign_blocks_type_check CHECK (
    block_type IN ('text', 'cta', 'poll', 'textarea', 'event-highlight')
  )
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.campaign_targets (
  campaign_id uuid NOT NULL,
  page_paths text[] NOT NULL DEFAULT '{}'::text[],
  groups text[] NOT NULL DEFAULT '{}'::text[],
  include_usernames text[] NOT NULL DEFAULT '{}'::text[],
  exclude_usernames text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_targets_pkey PRIMARY KEY (campaign_id),
  CONSTRAINT campaign_targets_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns (id) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.campaign_delivery_states (
  campaign_id uuid NOT NULL,
  username text NOT NULL,
  impressions_count integer NOT NULL DEFAULT 0,
  dismissed_at timestamp with time zone NULL,
  completed_at timestamp with time zone NULL,
  hidden_forever boolean NOT NULL DEFAULT false,
  last_seen_at timestamp with time zone NULL,
  last_interacted_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_delivery_states_pkey PRIMARY KEY (campaign_id, username),
  CONSTRAINT campaign_delivery_states_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT campaign_delivery_states_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.campaign_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  campaign_block_id uuid NOT NULL,
  username text NOT NULL,
  response_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_responses_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_responses_unique_block_response UNIQUE (campaign_block_id, username),
  CONSTRAINT campaign_responses_campaign_id_fkey FOREIGN KEY (campaign_id)
    REFERENCES public.campaigns (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT campaign_responses_campaign_block_id_fkey FOREIGN KEY (campaign_block_id)
    REFERENCES public.campaign_blocks (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT campaign_responses_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT campaign_responses_type_check CHECK (
    response_type IN ('poll', 'text')
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS campaigns_status_priority_idx
  ON public.campaigns (status, priority ASC, start_at ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS campaign_blocks_campaign_id_position_idx
  ON public.campaign_blocks (campaign_id, position ASC);

CREATE INDEX IF NOT EXISTS campaign_delivery_states_username_idx
  ON public.campaign_delivery_states (username, updated_at DESC);

CREATE INDEX IF NOT EXISTS campaign_responses_campaign_id_idx
  ON public.campaign_responses (campaign_id, created_at DESC);

COMMENT ON TABLE public.campaigns IS
  'Campagnes de communication produit, sondages et annonces pilotées par des données.';
COMMENT ON TABLE public.campaign_blocks IS
  'Blocs de contenu rendus par le runtime frontend sans exécution de code arbitraire.';
COMMENT ON TABLE public.campaign_targets IS
  'Ciblage d''une campagne par routes, groupes et exceptions utilisateurs.';
COMMENT ON TABLE public.campaign_delivery_states IS
  'Etat utilisateur par campagne: impressions, dismiss, completion et masquage.';
COMMENT ON TABLE public.campaign_responses IS
  'Réponses utilisateurs associées aux blocs interactifs des campagnes.';
