-- Ajout du rattachement des événements à une association

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS association_slug text NULL,
ADD COLUMN IF NOT EXISTS association_name text NULL;

CREATE INDEX IF NOT EXISTS events_association_slug_idx
  ON public.events (association_slug);

CREATE INDEX IF NOT EXISTS events_association_name_idx
  ON public.events (association_name);

COMMENT ON COLUMN public.events.association_slug IS 'Slug de l''association propriétaire de l''événement.';
COMMENT ON COLUMN public.events.association_name IS 'Nom lisible de l''association propriétaire de l''événement.';