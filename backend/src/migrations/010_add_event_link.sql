-- Ajoute un lien optionnel sur les événements associatifs.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_link text NULL;
