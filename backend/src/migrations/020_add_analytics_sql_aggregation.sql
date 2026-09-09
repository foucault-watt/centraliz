-- Déplace l'agrégation de l'onglet Overview (résumé + série temporelle) côté SQL
-- au lieu de rapatrier toutes les lignes d'analytics_events en Node pour les
-- agréger en JS. C'était la cause principale des ~20s de chargement du
-- dashboard admin : un scan complet paginé (1000 lignes/requête) suivi d'un
-- calcul en mémoire, y compris un scan de tout l'historique pour les
-- "previousUsers" (aucune borne basse).

CREATE OR REPLACE FUNCTION public.analytics_get_summary(
  p_start_date timestamptz,
  p_event_types text[] DEFAULT NULL,
  p_excluded_usernames text[] DEFAULT NULL,
  p_allowed_usernames text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT user_username, event_name, module, event_type, created_at
    FROM public.analytics_events
    WHERE created_at >= p_start_date
      AND (p_event_types IS NULL OR event_type = ANY(p_event_types))
      AND (p_excluded_usernames IS NULL OR user_username IS NULL OR user_username <> ALL(p_excluded_usernames))
      AND (p_allowed_usernames IS NULL OR user_username = ANY(p_allowed_usernames))
  ),
  user_events AS (
    SELECT * FROM filtered WHERE user_username IS NOT NULL
  ),
  ordered AS (
    SELECT *, LAG(created_at) OVER (PARTITION BY user_username ORDER BY created_at) AS prev_at
    FROM user_events
  ),
  flagged AS (
    SELECT *, (prev_at IS NULL OR created_at - prev_at > interval '10 minutes')::int AS is_new_session
    FROM ordered
  ),
  sessioned AS (
    SELECT *, SUM(is_new_session) OVER (PARTITION BY user_username ORDER BY created_at) AS session_num
    FROM flagged
  ),
  sessions AS (
    SELECT user_username, session_num,
      min(created_at) AS started_at,
      max(created_at) AS ended_at,
      count(*) AS event_count
    FROM sessioned
    GROUP BY user_username, session_num
  ),
  user_stats AS (
    SELECT user_username,
      count(*) AS total_events,
      count(DISTINCT (created_at AT TIME ZONE 'UTC')::date) AS active_days
    FROM user_events
    GROUP BY user_username
  ),
  user_session_stats AS (
    SELECT user_username, count(*) AS sessions_total
    FROM sessions GROUP BY user_username
  ),
  previous_users AS (
    SELECT DISTINCT user_username
    FROM public.analytics_events
    WHERE created_at < p_start_date
      AND user_username IS NOT NULL
      AND (p_event_types IS NULL OR event_type = ANY(p_event_types))
      AND (p_excluded_usernames IS NULL OR user_username <> ALL(p_excluded_usernames))
      AND (p_allowed_usernames IS NULL OR user_username = ANY(p_allowed_usernames))
  ),
  modules_top AS (
    SELECT module AS name, count(*) AS count
    FROM filtered GROUP BY module ORDER BY count DESC, name ASC LIMIT 12
  ),
  events_top AS (
    SELECT event_name AS name, count(*) AS count
    FROM filtered GROUP BY event_name ORDER BY count DESC, name ASC LIMIT 12
  ),
  event_type_counts AS (
    SELECT event_type, count(*) AS count FROM filtered GROUP BY event_type
  ),
  hour_counts AS (
    SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour, count(*) AS count
    FROM filtered GROUP BY 1
  ),
  weekday_counts AS (
    SELECT EXTRACT(ISODOW FROM created_at AT TIME ZONE 'UTC')::int AS dow, count(*) AS count
    FROM filtered GROUP BY 1
  ),
  groups_top AS (
    SELECT COALESCE(u.group, 'Non renseigne') AS name, count(DISTINCT f.user_username) AS count
    FROM filtered f
    LEFT JOIN public.users u ON u.username = f.user_username
    WHERE f.user_username IS NOT NULL
    GROUP BY 1 ORDER BY count DESC, name ASC LIMIT 12
  ),
  sessions_by_day AS (
    SELECT ((started_at AT TIME ZONE 'UTC')::date)::text AS period, count(*) AS count
    FROM sessions GROUP BY 1 ORDER BY 1
  ),
  returning_preview_base AS (
    SELECT us.user_username AS username,
      COALESCE(u.display_name, us.user_username) AS "displayName",
      COALESCE(u.group, 'Non renseigne') AS group,
      us.total_events AS "totalEvents",
      us.active_days AS "activeDays",
      COALESCE(uss.sessions_total, 0) AS "sessionsTotal"
    FROM user_stats us
    LEFT JOIN user_session_stats uss ON uss.user_username = us.user_username
    LEFT JOIN public.users u ON u.username = us.user_username
    WHERE us.user_username IN (SELECT user_username FROM previous_users)
    ORDER BY "sessionsTotal" DESC, "activeDays" DESC, "totalEvents" DESC
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'totalEvents', (SELECT count(*) FROM filtered),
    'activeUsers', (SELECT count(*) FROM user_stats),
    'dau', (SELECT count(DISTINCT user_username) FROM user_events WHERE created_at >= now() - interval '1 day'),
    'wau', (SELECT count(DISTINCT user_username) FROM user_events WHERE created_at >= now() - interval '7 days'),
    'mau', (SELECT count(DISTINCT user_username) FROM user_events WHERE created_at >= now() - interval '30 days'),
    'recurrentUsers', (SELECT count(*) FROM user_stats WHERE active_days > 1),
    'sessionsTotal', (SELECT count(*) FROM sessions),
    'avgEventsPerSession', COALESCE((SELECT round(avg(event_count)::numeric, 1) FROM sessions), 0),
    'avgSessionDuration', COALESCE((SELECT round((avg(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60))::numeric, 1) FROM sessions), 0),
    'loginCount', (SELECT count(*) FROM filtered WHERE event_name = 'user_logged_in'),
    'firstSeenAt', (SELECT min(created_at) FROM filtered),
    'lastSeenAt', (SELECT max(created_at) FROM filtered),
    'newUsers', GREATEST(
      (SELECT count(*) FROM user_stats) -
      (SELECT count(*) FROM user_stats WHERE user_username IN (SELECT user_username FROM previous_users)),
      0
    ),
    'returningUsers', (SELECT count(*) FROM user_stats WHERE user_username IN (SELECT user_username FROM previous_users)),
    'returningUsersPreview', COALESCE((SELECT jsonb_agg(row_to_json(returning_preview_base)) FROM returning_preview_base), '[]'::jsonb),
    'eventsByModule', COALESCE((SELECT jsonb_agg(row_to_json(modules_top)) FROM modules_top), '[]'::jsonb),
    'topEvents', COALESCE((SELECT jsonb_agg(row_to_json(events_top)) FROM events_top), '[]'::jsonb),
    'eventTypeCounts', COALESCE((SELECT jsonb_object_agg(event_type, count) FROM event_type_counts), '{}'::jsonb),
    'activityByHour', COALESCE((SELECT jsonb_agg(row_to_json(hour_counts)) FROM hour_counts), '[]'::jsonb),
    'activityByWeekday', COALESCE((SELECT jsonb_agg(row_to_json(weekday_counts)) FROM weekday_counts), '[]'::jsonb),
    'usersByGroup', COALESCE((SELECT jsonb_agg(row_to_json(groups_top)) FROM groups_top), '[]'::jsonb),
    'sessionsByDay', COALESCE((SELECT jsonb_agg(row_to_json(sessions_by_day)) FROM sessions_by_day), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.analytics_get_timeseries(
  p_start_date timestamptz,
  p_group_by text DEFAULT 'day',
  p_event_types text[] DEFAULT NULL,
  p_excluded_usernames text[] DEFAULT NULL,
  p_allowed_usernames text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT user_username, event_name, event_type, created_at,
      CASE WHEN p_group_by = 'week'
        THEN (date_trunc('week', created_at AT TIME ZONE 'UTC'))::date
        ELSE (created_at AT TIME ZONE 'UTC')::date
      END AS period
    FROM public.analytics_events
    WHERE created_at >= p_start_date
      AND (p_event_types IS NULL OR event_type = ANY(p_event_types))
      AND (p_excluded_usernames IS NULL OR user_username IS NULL OR user_username <> ALL(p_excluded_usernames))
      AND (p_allowed_usernames IS NULL OR user_username = ANY(p_allowed_usernames))
  ),
  sessions_per_user AS (
    SELECT user_username, period, session_num, min(created_at) AS started_at
    FROM (
      SELECT user_username, period, created_at,
        SUM((prev_at IS NULL OR created_at - prev_at > interval '10 minutes')::int)
          OVER (PARTITION BY user_username ORDER BY created_at) AS session_num
      FROM (
        SELECT user_username, period, created_at,
          LAG(created_at) OVER (PARTITION BY user_username ORDER BY created_at) AS prev_at
        FROM filtered
        WHERE user_username IS NOT NULL
      ) ordered
    ) sessioned
    GROUP BY user_username, period, session_num
  ),
  sessions_by_period AS (
    SELECT period, count(*) AS sessions
    FROM sessions_per_user
    GROUP BY period
  ),
  by_period AS (
    SELECT f.period,
      count(*) AS events,
      count(DISTINCT f.user_username) FILTER (WHERE f.user_username IS NOT NULL) AS "activeUsers",
      COALESCE(s.sessions, 0) AS sessions,
      count(*) FILTER (WHERE f.event_type = 'interaction') AS interactions,
      count(*) FILTER (WHERE f.event_type = 'conversion') AS conversions,
      count(*) FILTER (WHERE f.event_name = 'user_logged_in') AS logins
    FROM filtered f
    LEFT JOIN sessions_by_period s ON s.period = f.period
    GROUP BY f.period, s.sessions
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'period', period::text,
      'events', events,
      'activeUsers', "activeUsers",
      'sessions', sessions,
      'interactions', interactions,
      'conversions', conversions,
      'logins', logins
    ) ORDER BY period
  ), '[]'::jsonb)
  FROM by_period;
$$;

ALTER FUNCTION public.analytics_get_summary(timestamptz, text[], text[], text[]) SET search_path = '';
ALTER FUNCTION public.analytics_get_timeseries(timestamptz, text, text[], text[], text[]) SET search_path = '';

GRANT EXECUTE ON FUNCTION public.analytics_get_summary(timestamptz, text[], text[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_get_timeseries(timestamptz, text, text[], text[], text[]) TO service_role;
