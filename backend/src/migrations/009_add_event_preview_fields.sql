-- Ajout des champs de présentation des événements

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS short_title text NULL,
ADD COLUMN IF NOT EXISTS event_emoji text NULL;

CREATE INDEX IF NOT EXISTS events_short_title_idx
  ON public.events (short_title);

COMMENT ON COLUMN public.events.short_title IS 'Nom raccourci affiché dans les aperçus du calendrier.';
COMMENT ON COLUMN public.events.event_emoji IS 'Emoji affiché dans les aperçus du calendrier.';
