-- Ajout du stockage des rôles d'association synchronisés depuis CLA

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS has_association_role boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.user_associations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  association_slug text NOT NULL,
  association_name text NOT NULL,
  role text NOT NULL,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT user_associations_pkey PRIMARY KEY (id),
  CONSTRAINT user_associations_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_associations_unique_triplet_idx
  ON public.user_associations (username, association_slug, role);

CREATE INDEX IF NOT EXISTS user_associations_username_idx
  ON public.user_associations (username);

COMMENT ON TABLE public.user_associations IS 'Rôles d''association d''un utilisateur, synchronisés depuis CLA à chaque login.';
