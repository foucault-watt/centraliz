-- Refonte du module Notes : stockage des snapshots, règles de masquage persistantes
-- et journaux techniques de rafraîchissement.

CREATE TABLE IF NOT EXISTS public.grade_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  ent_username text NULL,
  source text NOT NULL DEFAULT 'manual_refresh'::text,
  status text NOT NULL DEFAULT 'success'::text,
  parser_version text NOT NULL DEFAULT 'v1'::text,
  raw_csv text NULL,
  raw_csv_sha256 text NULL,
  parsed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  csv_row_count integer NULL,
  parsed_entry_count integer NULL,
  visible_entry_count integer NULL,
  hidden_entry_count integer NULL,
  unmapped_module_count integer NULL,
  refresh_duration_ms integer NULL,
  error_message text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_latest boolean NOT NULL DEFAULT false,

  CONSTRAINT grade_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT grade_snapshots_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT grade_snapshots_status_check
    CHECK (status IN ('success', 'partial', 'failed')),
  CONSTRAINT grade_snapshots_source_check
    CHECK (source IN ('first_import', 'manual_refresh', 'scheduled_refresh', 'debug_import')),
  CONSTRAINT grade_snapshots_counts_check
    CHECK (
      COALESCE(csv_row_count, 0) >= 0
      AND COALESCE(parsed_entry_count, 0) >= 0
      AND COALESCE(visible_entry_count, 0) >= 0
      AND COALESCE(hidden_entry_count, 0) >= 0
      AND COALESCE(unmapped_module_count, 0) >= 0
      AND COALESCE(refresh_duration_ms, 0) >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS grade_snapshots_latest_username_idx
  ON public.grade_snapshots (username)
  WHERE is_latest = true;

CREATE INDEX IF NOT EXISTS grade_snapshots_username_created_at_idx
  ON public.grade_snapshots (username, created_at DESC);

CREATE INDEX IF NOT EXISTS grade_snapshots_status_idx
  ON public.grade_snapshots (status);

CREATE INDEX IF NOT EXISTS grade_snapshots_payload_gin_idx
  ON public.grade_snapshots USING gin (parsed_payload);

COMMENT ON TABLE public.grade_snapshots IS 'Snapshots figés du module notes. Un snapshot correspond à un import/parsing de CSV prêt à afficher.';
COMMENT ON COLUMN public.grade_snapshots.raw_csv IS 'CSV brut stocké pour audit/debug. Peut être NULL si on décide de ne conserver que le payload normalisé.';
COMMENT ON COLUMN public.grade_snapshots.parsed_payload IS 'Payload JSONB normalisé prêt pour le front et les recalculs métier.';
COMMENT ON COLUMN public.grade_snapshots.is_latest IS 'Identifie le snapshot actuellement affiché par défaut à l''ouverture de la page notes.';

CREATE TABLE IF NOT EXISTS public.grade_hidden_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  match_strategy text NOT NULL DEFAULT 'entry_fingerprint'::text,
  entry_fingerprint text NULL,
  module_name text NULL,
  assessment_name text NULL,
  assessment_type text NULL,
  grade_value text NULL,
  assessment_date date NULL,
  reason text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_matched_at timestamp with time zone NULL,

  CONSTRAINT grade_hidden_rules_pkey PRIMARY KEY (id),
  CONSTRAINT grade_hidden_rules_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT grade_hidden_rules_match_strategy_check
    CHECK (match_strategy IN ('entry_fingerprint', 'module_assessment_grade', 'module_assessment_date', 'module_only')),
  CONSTRAINT grade_hidden_rules_match_fields_check
    CHECK (
      entry_fingerprint IS NOT NULL
      OR module_name IS NOT NULL
      OR assessment_name IS NOT NULL
      OR assessment_date IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS grade_hidden_rules_username_active_idx
  ON public.grade_hidden_rules (username, active);

CREATE INDEX IF NOT EXISTS grade_hidden_rules_entry_fingerprint_idx
  ON public.grade_hidden_rules (entry_fingerprint)
  WHERE entry_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS grade_hidden_rules_module_assessment_idx
  ON public.grade_hidden_rules (username, module_name, assessment_name);

COMMENT ON TABLE public.grade_hidden_rules IS 'Règles utilisateur de masquage des notes afin d''exclure des doublons, rattrapages ou lignes parasites des calculs.';
COMMENT ON COLUMN public.grade_hidden_rules.entry_fingerprint IS 'Identifiant stable dérivé d''une ligne de note normalisée. Prioritaire quand disponible.';
COMMENT ON COLUMN public.grade_hidden_rules.match_strategy IS 'Stratégie de rapprochement à appliquer sur les nouvelles lignes lors d''un refresh.';

CREATE OR REPLACE FUNCTION public.touch_grade_hidden_rules_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grade_hidden_rules_updated_at ON public.grade_hidden_rules;

CREATE TRIGGER trg_grade_hidden_rules_updated_at
BEFORE UPDATE ON public.grade_hidden_rules
FOR EACH ROW
EXECUTE FUNCTION public.touch_grade_hidden_rules_updated_at();

CREATE TABLE IF NOT EXISTS public.grade_refresh_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  snapshot_id uuid NULL,
  step text NOT NULL,
  level text NOT NULL DEFAULT 'info'::text,
  message text NOT NULL,
  details jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT grade_refresh_logs_pkey PRIMARY KEY (id),
  CONSTRAINT grade_refresh_logs_username_fkey FOREIGN KEY (username)
    REFERENCES public.users (username) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT grade_refresh_logs_snapshot_id_fkey FOREIGN KEY (snapshot_id)
    REFERENCES public.grade_snapshots (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT grade_refresh_logs_level_check
    CHECK (level IN ('info', 'warn', 'error')),
  CONSTRAINT grade_refresh_logs_step_check
    CHECK (step IN ('auth', 'download', 'parse', 'mapping', 'compute', 'store', 'serve', 'debug'))
);

CREATE INDEX IF NOT EXISTS grade_refresh_logs_username_created_at_idx
  ON public.grade_refresh_logs (username, created_at DESC);

CREATE INDEX IF NOT EXISTS grade_refresh_logs_snapshot_idx
  ON public.grade_refresh_logs (snapshot_id)
  WHERE snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS grade_refresh_logs_level_idx
  ON public.grade_refresh_logs (level);

CREATE INDEX IF NOT EXISTS grade_refresh_logs_details_gin_idx
  ON public.grade_refresh_logs USING gin (details);

COMMENT ON TABLE public.grade_refresh_logs IS 'Journal technique détaillé des rafraîchissements de notes pour diagnostic auth/download/parsing/mapping/calcul.';
COMMENT ON COLUMN public.grade_refresh_logs.details IS 'Contexte structuré utile au debug : compteurs, modules non mappés, réponses techniques, timings, etc.';

CREATE OR REPLACE VIEW public.grade_latest_snapshots AS
SELECT *
FROM public.grade_snapshots
WHERE is_latest = true;
