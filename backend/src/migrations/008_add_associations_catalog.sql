-- Catalogue autonome des associations

CREATE TABLE IF NOT EXISTS public.associations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  association_slug text NOT NULL,
  association_name text NOT NULL,
  description text NULL,
  created_by text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT associations_pkey PRIMARY KEY (id),
  CONSTRAINT associations_association_slug_key UNIQUE (association_slug),
  CONSTRAINT associations_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS associations_slug_idx
  ON public.associations (association_slug);

COMMENT ON TABLE public.associations IS 'Catalogue des associations géré par l''administration.';

INSERT INTO public.associations (association_slug, association_name)
SELECT DISTINCT ua.association_slug, ua.association_name
FROM public.user_associations ua
ON CONFLICT (association_slug) DO NOTHING;
