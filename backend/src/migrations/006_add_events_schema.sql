-- Création des événements internes affichés dans EventCalendar

CREATE TABLE IF NOT EXISTS public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone NULL,
  location text NOT NULL,
  event_type text NOT NULL,
  ecoles text[] NOT NULL,
  photo_url text NULL,
  photo_path text NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT events_title_not_blank CHECK (char_length(trim(title)) > 0),
  CONSTRAINT events_description_not_blank CHECK (char_length(trim(description)) > 0),
  CONSTRAINT events_location_not_blank CHECK (char_length(trim(location)) > 0),
  CONSTRAINT events_type_not_blank CHECK (char_length(trim(event_type)) > 0),
  CONSTRAINT events_ecoles_non_empty CHECK (cardinality(ecoles) > 0)
);

CREATE INDEX IF NOT EXISTS events_event_date_idx
  ON public.events (event_date);

CREATE INDEX IF NOT EXISTS events_created_by_idx
  ON public.events (created_by);

CREATE OR REPLACE FUNCTION public.touch_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;

CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.touch_events_updated_at();

COMMENT ON TABLE public.events IS 'Événements internes créés par les utilisateurs ayant un rôle d''association.';
