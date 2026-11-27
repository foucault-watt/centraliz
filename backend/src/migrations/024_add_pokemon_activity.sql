-- Fil d'activité de la partie Pokémon partagée : événements de jeu
-- (badges, captures, ...) et messages de chat dans une seule table, pour
-- qu'un seul curseur (id) suffise à tout lire dans l'ordre.
CREATE TABLE public.pokemon_activity (
  id bigint GENERATED ALWAYS AS IDENTITY,
  kind text NOT NULL CHECK (kind IN ('event', 'chat')),
  type text NOT NULL,                 -- 'badge', 'capture', ... ou 'message'
  username text,                      -- auteur d'un message (NULL pour un événement de jeu)
  display_name text,
  text text NOT NULL,                 -- texte affiché
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,                    -- évite de rejouer un événement après un redémarrage
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pokemon_activity_pkey PRIMARY KEY (id),
  CONSTRAINT pokemon_activity_dedupe_unique UNIQUE (dedupe_key)
);

CREATE INDEX pokemon_activity_kind_id_idx ON public.pokemon_activity (kind, id DESC);

-- Dernier élément du fil vu par chaque utilisateur, pour le résumé
-- « depuis ta dernière visite ».
CREATE TABLE public.pokemon_last_seen (
  username text NOT NULL,
  last_seen_id bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pokemon_last_seen_pkey PRIMARY KEY (username)
);

-- Accès uniquement via le backend (clé service) : aucune politique publique.
ALTER TABLE public.pokemon_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokemon_last_seen ENABLE ROW LEVEL SECURITY;
