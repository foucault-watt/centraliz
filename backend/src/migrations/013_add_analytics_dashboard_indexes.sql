-- Index utiles pour l'exploration admin du dashboard analytics.

CREATE INDEX IF NOT EXISTS analytics_events_properties_gin_idx
  ON public.analytics_events USING gin (properties);

CREATE INDEX IF NOT EXISTS analytics_events_user_module_created_at_idx
  ON public.analytics_events (user_username, module, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_module_event_created_at_idx
  ON public.analytics_events (module, event_name, created_at DESC);
