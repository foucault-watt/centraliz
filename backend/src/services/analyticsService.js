const supabase = require("../utils/supabaseClient");

const VALID_RANGES = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

const VALID_EVENT_TYPES = new Set([
  "exposure",
  "load",
  "interaction",
  "conversion",
  "admin",
  "system",
]);

const VALID_SOURCES = new Set(["frontend", "backend", "system"]);

const SENSITIVE_KEYS = new Set([
  "admin_response",
  "assessment_name",
  "content",
  "correct_answer",
  "details",
  "email",
  "encrypted_password",
  "ent_username",
  "expediteur",
  "from",
  "grade",
  "grade_value",
  "grade_raw",
  "ical",
  "ical_link",
  "link",
  "mail",
  "mail_content",
  "mailcontent",
  "message",
  "password",
  "photo_name",
  "raw_csv",
  "rawcsv",
  "recipient",
  "recipients",
  "sender",
  "subject",
  "text",
  "to",
  "token",
  "zimbra_token",
]);

const MAX_PROPERTY_KEYS = 20;
const MAX_STRING_LENGTH = 120;
const MAX_PAGE_SIZE = 100;
const FETCH_BATCH_SIZE = 1000;
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

const EVENT_TYPE_ORDER = [
  "exposure",
  "load",
  "interaction",
  "conversion",
  "admin",
  "system",
];

const WEEKDAYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

const normalizeKey = (key) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

const normalizeIdentifier = (value, fallback) => {
  const normalized = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
};

const sanitizePrimitive = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map((item) => sanitizePrimitive(item))
      .filter((item) => item !== null);
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
};

const sanitizeProperties = (properties = {}) => {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }

  return Object.entries(properties)
    .slice(0, MAX_PROPERTY_KEYS)
    .reduce((acc, [rawKey, rawValue]) => {
      const key = normalizeKey(rawKey);
      if (!key || SENSITIVE_KEYS.has(key)) return acc;

      const value = sanitizePrimitive(rawValue);
      if (value !== null && value !== undefined) acc[key] = value;
      return acc;
    }, {});
};

const getUserFromReq = (req) =>
  req?.session?.user?.userName || req?.session?.user?.username || null;

const getRangeStart = (range = "30d") => {
  const days = VALID_RANGES[range] || VALID_RANGES["30d"];
  const start = new Date();
  start.setDate(start.getDate() - days);
  return start;
};

const parsePagination = ({ page = 1, pageSize = 25 } = {}) => {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedPageSize = Math.min(
    Math.max(parseInt(pageSize, 10) || 25, 1),
    MAX_PAGE_SIZE,
  );
  const from = (parsedPage - 1) * parsedPageSize;

  return {
    page: parsedPage,
    pageSize: parsedPageSize,
    from,
    to: from + parsedPageSize - 1,
  };
};

const parseSort = (sort, allowedFields, fallback = "created_at.desc") => {
  const [rawField, rawDirection] = String(sort || fallback).split(".");
  const field = allowedFields.includes(rawField) ? rawField : fallback.split(".")[0];
  const direction = rawDirection === "asc" ? "asc" : "desc";
  return { field, ascending: direction === "asc", value: `${field}.${direction}` };
};

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseEventTypes = (value) =>
  parseCsv(value).filter((eventType) => VALID_EVENT_TYPES.has(eventType));

const normalizeEventType = (value, fallback = "interaction") =>
  VALID_EVENT_TYPES.has(value) ? value : fallback;

const normalizeSource = (value, fallback = "backend") =>
  VALID_SOURCES.has(value) ? value : fallback;

const toPostgrestInList = (values) =>
  `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(",")})`;

const getPeriodKey = (date, groupBy = "day") => {
  const parsed = new Date(date);
  if (groupBy === "week") {
    const weekStart = new Date(parsed);
    const day = weekStart.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setUTCDate(weekStart.getUTCDate() + diff);
    return weekStart.toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
};

const increment = (map, key, amount = 1) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
};

const toSortedArray = (map, limit = 10) =>
  [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);

const uniqueUsers = (events) =>
  new Set(events.map((event) => event.user_username).filter(Boolean));

const safeDateValue = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const round = (value, digits = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const getDurationMinutes = (startAt, endAt) => {
  const start = safeDateValue(startAt);
  const end = safeDateValue(endAt);
  if (!start || !end) return 0;
  return Math.max((end.getTime() - start.getTime()) / 60000, 0);
};

const getExcludedUsernames = async () => {
  const { data, error } = await supabase
    .from("analytics_excluded_users")
    .select("username");

  if (error) throw error;
  return (data || []).map((entry) => entry.username);
};

const getUsersByUsername = async (usernames) => {
  const unique = [...new Set((usernames || []).filter(Boolean))];
  if (!unique.length) return new Map();

  const { data, error } = await supabase
    .from("users")
    .select("username, display_name, group")
    .in("username", unique);

  if (error) throw error;

  return new Map(
    (data || []).map((user) => [
      user.username,
      {
        username: user.username,
        displayName: user.display_name || user.username,
        group: user.group || "Non renseigne",
      },
    ]),
  );
};

const getUsernamesForGroup = async (group) => {
  if (!group) return null;

  const { data, error } = await supabase
    .from("users")
    .select("username")
    .eq("group", group);

  if (error) throw error;
  return (data || []).map((user) => user.username);
};

const applyEventQueryFilters = (query, filters = {}) => {
  if (filters.startDate) query = query.gte("created_at", filters.startDate.toISOString());
  if (filters.beforeDate) query = query.lt("created_at", filters.beforeDate.toISOString());
  if (filters.module) query = query.eq("module", filters.module);
  if (filters.eventName) query = query.eq("event_name", filters.eventName);
  if (filters.eventTypes?.length) query = query.in("event_type", filters.eventTypes);
  if (filters.exactUsername) query = query.eq("user_username", filters.exactUsername);
  else if (filters.username) query = query.ilike("user_username", `%${filters.username}%`);

  if (filters.allowedUsernames) {
    if (!filters.allowedUsernames.length) return null;
    query = query.in("user_username", filters.allowedUsernames);
  }

  if (filters.excludedUsernames?.length) {
    query = query.not("user_username", "in", toPostgrestInList(filters.excludedUsernames));
  }

  return query;
};

const resolveEventFilters = async (filters = {}) => {
  const eventTypes = parseEventTypes(filters.eventTypes);
  const hideExcluded = filters.hideExcluded === "true" || filters.hideExcluded === true;
  const excludedUsernames = hideExcluded ? await getExcludedUsernames() : [];
  const allowedUsernames = await getUsernamesForGroup(filters.group);

  return {
    startDate: filters.range ? getRangeStart(filters.range) : filters.startDate,
    beforeDate: filters.beforeDate,
    module: filters.module || null,
    eventName: filters.eventName || null,
    eventTypes,
    username: filters.username || null,
    exactUsername: filters.exactUsername || null,
    allowedUsernames,
    excludedUsernames,
  };
};

const fetchAllRows = async (buildQuery) => {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + FETCH_BATCH_SIZE - 1;
    const query = buildQuery(from, to);
    if (!query) return rows;

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) break;
    from += FETCH_BATCH_SIZE;
  }

  return rows;
};

const fetchEvents = async (filters = {}, select = "*") => {
  const resolved = await resolveEventFilters(filters);

  if (resolved.allowedUsernames && !resolved.allowedUsernames.length) {
    return [];
  }

  return fetchAllRows((from, to) => {
    let query = supabase
      .from("analytics_events")
      .select(select)
      .order("created_at", { ascending: true })
      .range(from, to);

    query = applyEventQueryFilters(query, resolved);
    return query;
  });
};

const buildSessions = (events, timeoutMs = SESSION_TIMEOUT_MS) => {
  const sessions = [];
  const sortedEvents = [...(events || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const lastSessions = new Map();

  sortedEvents.forEach((event) => {
    if (!event.user_username) return;

    const eventAt = safeDateValue(event.created_at);
    if (!eventAt) return;

    const previousSession = lastSessions.get(event.user_username);
    const needsNewSession =
      !previousSession ||
      eventAt.getTime() - previousSession.lastEventAt.getTime() > timeoutMs;

    const session = needsNewSession
      ? {
          id: `${event.user_username}:${event.created_at}:${sessions.length + 1}`,
          userUsername: event.user_username,
          startedAt: event.created_at,
          endedAt: event.created_at,
          lastEventAt: eventAt,
          eventCount: 0,
          modules: new Set(),
          eventNames: new Map(),
          eventTypes: new Map(),
          loginEvents: 0,
        }
      : previousSession;

    if (needsNewSession) {
      sessions.push(session);
      lastSessions.set(event.user_username, session);
    }

    session.eventCount += 1;
    session.endedAt = event.created_at;
    session.lastEventAt = eventAt;
    session.modules.add(event.module || "general");
    increment(session.eventNames, event.event_name || "unknown_event");
    increment(session.eventTypes, event.event_type || "interaction");
    if (event.event_name === "user_logged_in") session.loginEvents += 1;
  });

  return sessions.map((session) => ({
    ...session,
    durationMinutes: round(getDurationMinutes(session.startedAt, session.endedAt), 1),
    moduleCount: session.modules.size,
    modules: [...session.modules].sort(),
    topEvents: toSortedArray(session.eventNames, 6),
    eventTypeCounts: EVENT_TYPE_ORDER.reduce((acc, eventType) => {
      acc[eventType] = session.eventTypes.get(eventType) || 0;
      return acc;
    }, {}),
  }));
};

const buildSessionMetrics = (sessions) => {
  const totalEvents = sessions.reduce((sum, session) => sum + session.eventCount, 0);
  const totalDuration = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const sessionsByDay = new Map();

  sessions.forEach((session) => {
    increment(sessionsByDay, getPeriodKey(session.startedAt));
  });

  return {
    sessionsTotal: sessions.length,
    avgEventsPerSession: sessions.length ? round(totalEvents / sessions.length, 1) : 0,
    avgSessionDuration: sessions.length ? round(totalDuration / sessions.length, 1) : 0,
    sessionsByDay: [...sessionsByDay.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period)),
  };
};

const buildUserSummaries = async (filters = {}) => {
  const events = await fetchEvents(
    filters,
    "user_username, event_name, event_type, module, created_at",
  );
  const sessions = buildSessions(events);
  const users = await getUsersByUsername([...uniqueUsers(events)]);
  const summaries = new Map();

  events.forEach((event) => {
    if (!event.user_username) return;
    const user = users.get(event.user_username);
    if (!user) return;

    if (
      filters.search &&
      !user.username.toLowerCase().includes(String(filters.search).toLowerCase()) &&
      !user.displayName.toLowerCase().includes(String(filters.search).toLowerCase())
    ) {
      return;
    }

    if (!summaries.has(user.username)) {
      summaries.set(user.username, {
        username: user.username,
        displayName: user.displayName,
        group: user.group,
        totalEvents: 0,
        activeDaysSet: new Set(),
        activeHoursSet: new Set(),
        modulesMap: new Map(),
        eventsMap: new Map(),
        eventTypesMap: new Map(),
        firstSeenAt: event.created_at,
        lastSeenAt: event.created_at,
        loginsBackend: 0,
        sessionsTotal: 0,
        totalSessionDuration: 0,
        totalSessionEvents: 0,
        sessionsByDayMap: new Map(),
      });
    }

    const summary = summaries.get(event.user_username);
    const parsed = safeDateValue(event.created_at);
    summary.totalEvents += 1;
    summary.activeDaysSet.add(getPeriodKey(event.created_at));
    if (parsed) summary.activeHoursSet.add(parsed.getUTCHours());
    increment(summary.modulesMap, event.module);
    increment(summary.eventsMap, event.event_name);
    increment(summary.eventTypesMap, event.event_type || "interaction");
    if (event.event_name === "user_logged_in") summary.loginsBackend += 1;

    if (new Date(event.created_at) < new Date(summary.firstSeenAt)) {
      summary.firstSeenAt = event.created_at;
    }
    if (new Date(event.created_at) > new Date(summary.lastSeenAt)) {
      summary.lastSeenAt = event.created_at;
    }
  });

  sessions.forEach((session) => {
    const summary = summaries.get(session.userUsername);
    if (!summary) return;
    summary.sessionsTotal += 1;
    summary.totalSessionDuration += session.durationMinutes;
    summary.totalSessionEvents += session.eventCount;
    increment(summary.sessionsByDayMap, getPeriodKey(session.startedAt));
  });

  return [...summaries.values()].map((summary) => ({
    username: summary.username,
    displayName: summary.displayName,
    group: summary.group,
    totalEvents: summary.totalEvents,
    activeDays: summary.activeDaysSet.size,
    activeHoursCount: summary.activeHoursSet.size,
    firstSeenAt: summary.firstSeenAt,
    lastSeenAt: summary.lastSeenAt,
    loginsBackend: summary.loginsBackend,
    sessionsTotal: summary.sessionsTotal,
    avgEventsPerSession: summary.sessionsTotal
      ? round(summary.totalSessionEvents / summary.sessionsTotal, 1)
      : 0,
    avgSessionDuration: summary.sessionsTotal
      ? round(summary.totalSessionDuration / summary.sessionsTotal, 1)
      : 0,
    exposureCount: summary.eventTypesMap.get("exposure") || 0,
    loadCount: summary.eventTypesMap.get("load") || 0,
    interactionCount: summary.eventTypesMap.get("interaction") || 0,
    conversionCount: summary.eventTypesMap.get("conversion") || 0,
    adminCount: summary.eventTypesMap.get("admin") || 0,
    systemCount: summary.eventTypesMap.get("system") || 0,
    modules: toSortedArray(summary.modulesMap, 8),
    topEvents: toSortedArray(summary.eventsMap, 8),
    sessionsByDay: [...summary.sessionsByDayMap.entries()]
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period)),
  }));
};

const buildActivityByHour = (events) => {
  const hours = new Map();
  events.forEach((event) => {
    const parsed = safeDateValue(event.created_at);
    if (!parsed) return;
    increment(hours, String(parsed.getUTCHours()).padStart(2, "0"));
  });

  return [...Array(24)].map((_, hour) => {
    const label = String(hour).padStart(2, "0");
    return { hour: label, count: hours.get(label) || 0 };
  });
};

const buildActivityByWeekday = (events) => {
  const weekdays = new Map();
  events.forEach((event) => {
    const parsed = safeDateValue(event.created_at);
    if (!parsed) return;
    increment(weekdays, parsed.toLocaleDateString("fr-FR", { weekday: "long" }));
  });

  return WEEKDAYS.map((weekday) => ({
    name: weekday,
    count: weekdays.get(weekday) || 0,
  }));
};

const enrichEvents = async (events) => {
  const users = await getUsersByUsername(events.map((event) => event.user_username));
  return events.map((event) => {
    const user = users.get(event.user_username);
    return {
      id: event.id,
      userUsername: event.user_username,
      userDisplayName: user?.displayName || event.user_username || "Anonyme",
      userGroup: user?.group || "Non renseigne",
      eventName: event.event_name,
      eventType: event.event_type || "interaction",
      isAutomatic: Boolean(event.is_automatic),
      source: event.source || "backend",
      module: event.module,
      properties: event.properties || {},
      createdAt: event.created_at,
    };
  });
};

const sortItems = (items, parsedSort, stableKey = "username") => {
  const rows = [...items];
  rows.sort((a, b) => {
    const aValue = a[parsedSort.field];
    const bValue = b[parsedSort.field];
    if (aValue === bValue) return String(a[stableKey] || "").localeCompare(String(b[stableKey] || ""));
    if (typeof aValue === "number" && typeof bValue === "number") {
      return parsedSort.ascending ? aValue - bValue : bValue - aValue;
    }
    return parsedSort.ascending
      ? String(aValue || "").localeCompare(String(bValue || ""))
      : String(bValue || "").localeCompare(String(aValue || ""));
  });
  return rows;
};

const paginateRows = (rows, pagination, sortValue) => ({
  rows: rows.slice(pagination.from, pagination.to + 1),
  pagination: {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: rows.length,
    pageCount: Math.ceil(rows.length / pagination.pageSize),
    sort: sortValue,
  },
});

const buildTimeseriesPoints = (events, sessions, groupBy = "day") => {
  const buckets = new Map();

  events.forEach((event) => {
    const key = getPeriodKey(event.created_at, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, {
        period: key,
        events: 0,
        activeUsers: new Set(),
        interactions: 0,
        conversions: 0,
        logins: 0,
      });
    }

    const bucket = buckets.get(key);
    bucket.events += 1;
    if (event.user_username) bucket.activeUsers.add(event.user_username);
    if (event.event_type === "interaction") bucket.interactions += 1;
    if (event.event_type === "conversion") bucket.conversions += 1;
    if (event.event_name === "user_logged_in") bucket.logins += 1;
  });

  sessions.forEach((session) => {
    const key = getPeriodKey(session.startedAt, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, {
        period: key,
        events: 0,
        activeUsers: new Set(),
        interactions: 0,
        conversions: 0,
        logins: 0,
      });
    }

    const bucket = buckets.get(key);
    bucket.sessions = (bucket.sessions || 0) + 1;
  });

  return [...buckets.values()]
    .map((bucket) => ({
      period: bucket.period,
      events: bucket.events,
      activeUsers: bucket.activeUsers.size,
      sessions: bucket.sessions || 0,
      interactions: bucket.interactions,
      conversions: bucket.conversions,
      logins: bucket.logins || 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
};

const buildModuleSummaries = async (filters = {}) => {
  const events = await fetchEvents(
    filters,
    "user_username, event_name, event_type, module, created_at",
  );
  const sessions = buildSessions(events);
  const sessionsByModule = new Map();

  sessions.forEach((session) => {
    session.modules.forEach((moduleName) => {
      if (!sessionsByModule.has(moduleName)) sessionsByModule.set(moduleName, []);
      sessionsByModule.get(moduleName).push(session);
    });
  });

  const modules = new Map();
  events.forEach((event) => {
    if (!modules.has(event.module)) {
      modules.set(event.module, {
        module: event.module,
        totalEvents: 0,
        users: new Set(),
        eventsMap: new Map(),
        eventTypesMap: new Map(),
        timelineMap: new Map(),
        firstSeenAt: event.created_at,
        lastSeenAt: event.created_at,
      });
    }

    const summary = modules.get(event.module);
    summary.totalEvents += 1;
    if (event.user_username) summary.users.add(event.user_username);
    increment(summary.eventsMap, event.event_name);
    increment(summary.eventTypesMap, event.event_type || "interaction");
    increment(summary.timelineMap, getPeriodKey(event.created_at));
    if (new Date(event.created_at) < new Date(summary.firstSeenAt)) {
      summary.firstSeenAt = event.created_at;
    }
    if (new Date(event.created_at) > new Date(summary.lastSeenAt)) {
      summary.lastSeenAt = event.created_at;
    }
  });

  return [...modules.values()]
    .map((summary) => {
      const moduleSessions = sessionsByModule.get(summary.module) || [];
      const sessionMetrics = buildSessionMetrics(moduleSessions);

      return {
        module: summary.module,
        totalEvents: summary.totalEvents,
        activeUsers: summary.users.size,
        sessionsTotal: sessionMetrics.sessionsTotal,
        avgEventsPerSession: sessionMetrics.avgEventsPerSession,
        avgSessionDuration: sessionMetrics.avgSessionDuration,
        exposureCount: summary.eventTypesMap.get("exposure") || 0,
        loadCount: summary.eventTypesMap.get("load") || 0,
        interactionCount: summary.eventTypesMap.get("interaction") || 0,
        conversionCount: summary.eventTypesMap.get("conversion") || 0,
        topEvents: toSortedArray(summary.eventsMap, 8),
        timeline: [...summary.timelineMap.entries()]
          .map(([period, count]) => ({ period, count }))
          .sort((a, b) => a.period.localeCompare(b.period)),
        firstSeenAt: summary.firstSeenAt,
        lastSeenAt: summary.lastSeenAt,
      };
    })
    .sort((a, b) => b.totalEvents - a.totalEvents || a.module.localeCompare(b.module));
};

const buildGlobalSessions = async (filters = {}) => {
  const events = await fetchEvents(
    filters,
    "user_username, event_name, event_type, module, created_at",
  );
  const users = await getUsersByUsername([...uniqueUsers(events)]);
  const sessions = buildSessions(events)
    .map((session) => {
      const user = users.get(session.userUsername);
      return {
        ...session,
        userDisplayName: user?.displayName || session.userUsername,
        userGroup: user?.group || "Non renseigne",
      };
    })
    .filter((session) => {
      if (filters.module && !session.modules.includes(filters.module)) return false;
      if (filters.username) {
        const needle = String(filters.username).toLowerCase();
        if (
          !session.userUsername.toLowerCase().includes(needle) &&
          !session.userDisplayName.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      if (filters.group && session.userGroup !== filters.group) return false;
      return true;
    });

  return sessions;
};

const analyticsService = {
  VALID_RANGES,
  sanitizeProperties,

  async trackEvent({
    req,
    userUsername,
    anonymousId,
    eventName,
    module,
    eventType = "interaction",
    isAutomatic = false,
    source = "backend",
    properties = {},
  }) {
    try {
      const safeEventName = normalizeIdentifier(eventName, "unknown_event");
      const safeModule = normalizeIdentifier(module, "general");
      const finalUserUsername = userUsername || getUserFromReq(req);
      const finalEventType =
        safeModule === "analytics"
          ? "admin"
          : normalizeEventType(eventType, "interaction");

      const { error } = await supabase.from("analytics_events").insert([
        {
          user_username: finalUserUsername || null,
          anonymous_id: anonymousId || null,
          event_name: safeEventName,
          module: safeModule,
          event_type: finalEventType,
          is_automatic: Boolean(isAutomatic),
          source: normalizeSource(source, "backend"),
          properties: sanitizeProperties(properties),
        },
      ]);

      if (error) console.error("[Analytics] Insertion impossible:", error);
    } catch (error) {
      console.error("[Analytics] Erreur best-effort:", error);
    }
  },

  async getSummary({ range = "30d", eventTypes, hideExcluded } = {}) {
    const startDate = getRangeStart(range);
    const events = await fetchEvents(
      { range, eventTypes, hideExcluded },
      "user_username, event_name, event_type, module, created_at",
    );
    const sessions = buildSessions(events);
    const sessionMetrics = buildSessionMetrics(sessions);
    const users = uniqueUsers(events);
    const modules = new Map();
    const eventNames = new Map();
    const eventTypesMap = new Map();
    const activeDaysByUser = new Map();
    const totalEventsByUser = new Map();
    const userGroups = new Map();
    const usersByUsername = await getUsersByUsername([...users]);

    events.forEach((event) => {
      increment(modules, event.module);
      increment(eventNames, event.event_name);
      increment(eventTypesMap, event.event_type || "interaction");

      const dayKey = getPeriodKey(event.created_at);
      if (event.user_username) {
        increment(totalEventsByUser, event.user_username);
        if (!activeDaysByUser.has(event.user_username)) {
          activeDaysByUser.set(event.user_username, new Set());
        }
        activeDaysByUser.get(event.user_username).add(dayKey);
      }
    });

    [...users].forEach((username) => {
      increment(userGroups, usersByUsername.get(username)?.group || "Non renseigne");
    });

    const activeSince = (days) => {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - days);
      return uniqueUsers(
        events.filter((event) => new Date(event.created_at) >= threshold),
      ).size;
    };

    const previousUsers = uniqueUsers(
      await fetchEvents(
        {
          eventTypes,
          hideExcluded,
          beforeDate: startDate,
        },
        "user_username, created_at",
      ),
    );
    const returningUsers = [...users].filter((username) => previousUsers.has(username)).length;
    const newUsers = Math.max(users.size - returningUsers, 0);
    const recurrentUsers = [...activeDaysByUser.values()].filter((days) => days.size > 1).length;
    const firstSeenAt = events[0]?.created_at || null;
    const lastSeenAt = events[events.length - 1]?.created_at || null;
    const loginCount = events.filter((event) => event.event_name === "user_logged_in").length;
    const sessionCountByUser = new Map();
    sessions.forEach((session) => {
      increment(sessionCountByUser, session.userUsername);
    });
    const returningUsersPreview = [...users]
      .filter((username) => previousUsers.has(username))
      .map((username) => ({
        username,
        displayName: usersByUsername.get(username)?.displayName || username,
        group: usersByUsername.get(username)?.group || "Non renseigne",
        totalEvents: totalEventsByUser.get(username) || 0,
        activeDays: activeDaysByUser.get(username)?.size || 0,
        sessionsTotal: sessionCountByUser.get(username) || 0,
      }))
      .sort(
        (a, b) =>
          b.sessionsTotal - a.sessionsTotal ||
          b.activeDays - a.activeDays ||
          b.totalEvents - a.totalEvents,
      )
      .slice(0, 6);
    const activeHoursCount = buildActivityByHour(events).filter((item) => item.count > 0).length;

    return {
      range: VALID_RANGES[range] ? range : "30d",
      totals: {
        events: events.length,
        activeUsers: users.size,
        dau: activeSince(1),
        wau: activeSince(7),
        mau: activeSince(30),
        recurrentUsers,
        sessionsTotal: sessionMetrics.sessionsTotal,
        avgEventsPerSession: sessionMetrics.avgEventsPerSession,
        avgSessionDuration: sessionMetrics.avgSessionDuration,
        loginCount,
        firstSeenAt,
        lastSeenAt,
        activeHoursCount,
      },
      firstSeenAt,
      lastSeenAt,
      activeHoursCount,
      newVsReturning: { newUsers, returningUsers },
      returningUsersPreview,
      eventsByModule: toSortedArray(modules, 12),
      topEvents: toSortedArray(eventNames, 12),
      eventsByType: EVENT_TYPE_ORDER.map((eventType) => ({
        name: eventType,
        count: eventTypesMap.get(eventType) || 0,
      })),
      eventTypeTotals: {
        exposure: eventTypesMap.get("exposure") || 0,
        load: eventTypesMap.get("load") || 0,
        interaction: eventTypesMap.get("interaction") || 0,
        conversion: eventTypesMap.get("conversion") || 0,
        admin: eventTypesMap.get("admin") || 0,
        system: eventTypesMap.get("system") || 0,
      },
      activityByHour: buildActivityByHour(events),
      activityByWeekday: buildActivityByWeekday(events),
      usersByGroup: toSortedArray(userGroups, 12),
      sessionsByDay: sessionMetrics.sessionsByDay,
    };
  },

  async getTimeseries({ range = "30d", groupBy = "day", eventTypes, hideExcluded } = {}) {
    const safeGroupBy = groupBy === "week" ? "week" : "day";
    const events = await fetchEvents(
      { range, eventTypes, hideExcluded },
      "user_username, event_name, event_type, module, created_at",
    );
    const sessions = buildSessions(events);

    return {
      range: VALID_RANGES[range] ? range : "30d",
      groupBy: safeGroupBy,
      points: buildTimeseriesPoints(events, sessions, safeGroupBy),
    };
  },

  async getEvents({
    range,
    module,
    eventName,
    eventTypes,
    username,
    exactUsername,
    group,
    hideExcluded,
    page,
    pageSize,
    sort,
  } = {}) {
    const pagination = parsePagination({ page, pageSize });
    const parsedSort = parseSort(
      sort,
      ["created_at", "module", "event_name", "event_type", "source", "user_username"],
      "created_at.desc",
    );
    const resolved = await resolveEventFilters({
      range,
      module,
      eventName,
      eventTypes,
      username,
      exactUsername,
      group,
      hideExcluded,
    });

    if (resolved.allowedUsernames && !resolved.allowedUsernames.length) {
      return { events: [], pagination: { ...pagination, total: 0, pageCount: 0, sort: parsedSort.value } };
    }

    let query = supabase
      .from("analytics_events")
      .select(
        "id, user_username, event_name, event_type, is_automatic, source, module, properties, created_at",
        { count: "exact" },
      );

    query = applyEventQueryFilters(query, resolved);
    const { data, error, count } = await query
      .order(parsedSort.field, { ascending: parsedSort.ascending })
      .range(pagination.from, pagination.to);

    if (error) throw error;

    return {
      events: await enrichEvents(data || []),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: count || 0,
        pageCount: Math.ceil((count || 0) / pagination.pageSize),
        sort: parsedSort.value,
      },
    };
  },

  async getUsers({ range, search, group, eventTypes, hideExcluded, page, pageSize, sort } = {}) {
    const pagination = parsePagination({ page, pageSize });
    const parsedSort = parseSort(
      sort,
      [
        "lastSeenAt",
        "firstSeenAt",
        "totalEvents",
        "activeDays",
        "username",
        "sessionsTotal",
        "avgEventsPerSession",
        "avgSessionDuration",
      ],
      "lastSeenAt.desc",
    );

    const summaries = await buildUserSummaries({
      range,
      search,
      group,
      eventTypes,
      hideExcluded,
    });
    const sorted = sortItems(summaries, parsedSort);
    const paginated = paginateRows(sorted, pagination, parsedSort.value);

    return {
      users: paginated.rows,
      pagination: paginated.pagination,
    };
  },

  async getUserSummary(username, { range = "30d", eventTypes, hideExcluded } = {}) {
    const [userMap, summaries, events] = await Promise.all([
      getUsersByUsername([username]),
      buildUserSummaries({
        range,
        eventTypes,
        hideExcluded,
      }),
      fetchEvents(
        {
          range,
          eventTypes,
          hideExcluded,
          exactUsername: username,
        },
        "user_username, event_name, event_type, module, created_at",
      ),
    ]);

    const user = userMap.get(username);
    if (!user) return null;

    const detail = summaries.find((item) => item.username === username) || {
      username,
      displayName: user.displayName,
      group: user.group,
      totalEvents: 0,
      activeDays: 0,
      sessionsTotal: 0,
      avgEventsPerSession: 0,
      avgSessionDuration: 0,
      modules: [],
      topEvents: [],
      firstSeenAt: null,
      lastSeenAt: null,
      sessionsByDay: [],
      activeHoursCount: 0,
      exposureCount: 0,
      loadCount: 0,
      interactionCount: 0,
      conversionCount: 0,
      adminCount: 0,
      systemCount: 0,
      loginsBackend: 0,
    };

    const sessions = buildSessions(events);
    const sessionsByDayMap = new Map();
    sessions.forEach((session) => {
      increment(sessionsByDayMap, getPeriodKey(session.startedAt));
    });

    const eventsByDayMap = new Map();
    const eventTypeMap = new Map();
    events.forEach((event) => {
      increment(eventsByDayMap, getPeriodKey(event.created_at));
      increment(eventTypeMap, event.event_type || "interaction");
    });

    return {
      ...detail,
      eventTypes: EVENT_TYPE_ORDER.map((eventType) => ({
        name: eventType,
        count: eventTypeMap.get(eventType) || 0,
      })),
      eventsByDay: [...eventsByDayMap.entries()]
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      sessionsByDay: [...sessionsByDayMap.entries()]
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      activityByHour: buildActivityByHour(events),
      activityByWeekday: buildActivityByWeekday(events),
      sessionsPreview: sessions
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 10),
    };
  },

  async getUserTimeseries(username, { range = "30d", eventTypes, hideExcluded } = {}) {
    const events = await fetchEvents(
      {
        range,
        eventTypes,
        hideExcluded,
        exactUsername: username,
      },
      "user_username, event_name, event_type, module, created_at",
    );
    const sessions = buildSessions(events);

    return {
      range: VALID_RANGES[range] ? range : "30d",
      points: buildTimeseriesPoints(events, sessions, "day"),
      sessionsByDay: buildSessionMetrics(sessions).sessionsByDay,
    };
  },

  async getUserSessions(username, { range, eventTypes, hideExcluded, page, pageSize, sort } = {}) {
    const pagination = parsePagination({ page, pageSize });
    const parsedSort = parseSort(
      sort,
      ["startedAt", "endedAt", "eventCount", "durationMinutes", "moduleCount"],
      "startedAt.desc",
    );
    const events = await fetchEvents(
      {
        range,
        eventTypes,
        hideExcluded,
        exactUsername: username,
      },
      "user_username, event_name, event_type, module, created_at",
    );

    const sessions = buildSessions(events);
    const sorted = sortItems(sessions, parsedSort, "id");
    const paginated = paginateRows(sorted, pagination, parsedSort.value);

    return {
      sessions: paginated.rows,
      pagination: paginated.pagination,
    };
  },

  async getUserDetail(username, filters = {}) {
    return this.getUserSummary(username, filters);
  },

  async getUserEvents(username, query = {}) {
    return this.getEvents({
      ...query,
      exactUsername: username,
    });
  },

  async getModules({ range = "30d", eventTypes, hideExcluded } = {}) {
    return {
      modules: await buildModuleSummaries({ range, eventTypes, hideExcluded }),
    };
  },

  async getModuleSummary(module, { range = "30d", eventTypes, hideExcluded } = {}) {
    const modules = await buildModuleSummaries({
      range,
      eventTypes,
      hideExcluded,
      module,
    });

    return modules.find((item) => item.module === module) || null;
  },

  async getModuleTimeseries(module, { range = "30d", eventTypes, hideExcluded } = {}) {
    const events = await fetchEvents(
      { range, eventTypes, hideExcluded, module },
      "user_username, event_name, event_type, module, created_at",
    );
    const sessions = buildSessions(events).filter((session) => session.modules.includes(module));

    return {
      range: VALID_RANGES[range] ? range : "30d",
      points: buildTimeseriesPoints(events, sessions, "day"),
    };
  },

  async getModuleUsers(module, { range, eventTypes, hideExcluded, page, pageSize, sort } = {}) {
    const pagination = parsePagination({ page, pageSize });
    const parsedSort = parseSort(
      sort,
      [
        "lastSeenAt",
        "firstSeenAt",
        "totalEvents",
        "activeDays",
        "username",
        "sessionsTotal",
        "avgEventsPerSession",
        "avgSessionDuration",
      ],
      "totalEvents.desc",
    );

    const summaries = await buildUserSummaries({
      range,
      eventTypes,
      hideExcluded,
    });

    const filtered = summaries.filter((summary) =>
      (summary.modules || []).some((item) => item.name === module),
    );
    const sorted = sortItems(filtered, parsedSort);
    const paginated = paginateRows(sorted, pagination, parsedSort.value);

    return {
      users: paginated.rows,
      pagination: paginated.pagination,
    };
  },

  async getRetention({ range = "30d", eventTypes, hideExcluded } = {}) {
    const summaries = await buildUserSummaries({ range, eventTypes, hideExcluded });
    const buckets = new Map([
      ["1 jour actif", 0],
      ["2-3 jours actifs", 0],
      ["4-7 jours actifs", 0],
      ["8+ jours actifs", 0],
    ]);
    const moduleBreadth = new Map([
      ["1 module", 0],
      ["2-3 modules", 0],
      ["4+ modules", 0],
    ]);
    const sessionBreadth = new Map([
      ["1 session", 0],
      ["2-3 sessions", 0],
      ["4-7 sessions", 0],
      ["8+ sessions", 0],
    ]);

    summaries.forEach((user) => {
      if (user.activeDays <= 1) increment(buckets, "1 jour actif");
      else if (user.activeDays <= 3) increment(buckets, "2-3 jours actifs");
      else if (user.activeDays <= 7) increment(buckets, "4-7 jours actifs");
      else increment(buckets, "8+ jours actifs");

      const moduleCount = user.modules.length;
      if (moduleCount <= 1) increment(moduleBreadth, "1 module");
      else if (moduleCount <= 3) increment(moduleBreadth, "2-3 modules");
      else increment(moduleBreadth, "4+ modules");

      if (user.sessionsTotal <= 1) increment(sessionBreadth, "1 session");
      else if (user.sessionsTotal <= 3) increment(sessionBreadth, "2-3 sessions");
      else if (user.sessionsTotal <= 7) increment(sessionBreadth, "4-7 sessions");
      else increment(sessionBreadth, "8+ sessions");
    });

    return {
      range: VALID_RANGES[range] ? range : "30d",
      activeUsers: summaries.length,
      avgSessionsPerUser: summaries.length
        ? round(summaries.reduce((sum, user) => sum + user.sessionsTotal, 0) / summaries.length, 1)
        : 0,
      activeDayBuckets: [...buckets.entries()].map(([name, count]) => ({ name, count })),
      moduleBreadth: [...moduleBreadth.entries()].map(([name, count]) => ({ name, count })),
      sessionBreadth: [...sessionBreadth.entries()].map(([name, count]) => ({ name, count })),
      stickyUsers: summaries
        .map((user) => ({
          username: user.username,
          displayName: user.displayName,
          activeDays: user.activeDays,
          moduleCount: user.modules.length,
          events: user.totalEvents,
          sessionsTotal: user.sessionsTotal,
          avgSessionDuration: user.avgSessionDuration,
        }))
        .sort(
          (a, b) =>
            b.activeDays - a.activeDays ||
            b.sessionsTotal - a.sessionsTotal ||
            b.events - a.events,
        )
        .slice(0, 20),
    };
  },

  async getSessions({ range, eventTypes, hideExcluded, username, group, module, page, pageSize, sort } = {}) {
    const pagination = parsePagination({ page, pageSize });
    const parsedSort = parseSort(
      sort,
      ["startedAt", "endedAt", "eventCount", "durationMinutes", "moduleCount", "userUsername"],
      "startedAt.desc",
    );

    const sessions = await buildGlobalSessions({
      range,
      eventTypes,
      hideExcluded,
      username,
      group,
      module,
    });

    const sorted = sortItems(sessions, parsedSort, "id");
    const paginated = paginateRows(sorted, pagination, parsedSort.value);
    const totalDuration = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const totalEvents = sessions.reduce((sum, session) => sum + session.eventCount, 0);
    const uniqueUsersCount = new Set(sessions.map((session) => session.userUsername)).size;

    return {
      sessions: paginated.rows,
      pagination: paginated.pagination,
      summary: {
        sessionsTotal: sessions.length,
        activeUsers: uniqueUsersCount,
        avgSessionDuration: sessions.length ? round(totalDuration / sessions.length, 1) : 0,
        avgEventsPerSession: sessions.length ? round(totalEvents / sessions.length, 1) : 0,
      },
    };
  },

  async getHeatmap({ range = "30d", eventTypes, hideExcluded } = {}) {
    const events = await fetchEvents(
      { range, eventTypes, hideExcluded },
      "user_username, event_type, created_at",
    );
    const cells = new Map();

    WEEKDAYS.forEach((weekday) => {
      for (let hour = 0; hour < 24; hour += 1) {
        cells.set(`${weekday}-${hour}`, { weekday, hour, count: 0 });
      }
    });

    events.forEach((event) => {
      const parsed = safeDateValue(event.created_at);
      if (!parsed) return;
      const weekday = parsed.toLocaleDateString("fr-FR", { weekday: "long" });
      const hour = parsed.getUTCHours();
      const key = `${weekday}-${hour}`;
      if (cells.has(key)) cells.get(key).count += 1;
    });

    return {
      range: VALID_RANGES[range] ? range : "30d",
      weekdays: WEEKDAYS,
      hours: [...Array(24)].map((_, hour) => hour),
      cells: [...cells.values()],
    };
  },

  async getExcludedUsers() {
    const { data, error } = await supabase
      .from("analytics_excluded_users")
      .select("username, reason, created_by, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const users = await getUsersByUsername([
      ...(data || []).map((entry) => entry.username),
      ...(data || []).map((entry) => entry.created_by),
    ]);

    return {
      excludedUsers: (data || []).map((entry) => ({
        username: entry.username,
        displayName: users.get(entry.username)?.displayName || entry.username,
        group: users.get(entry.username)?.group || "Non renseigne",
        reason: entry.reason || "",
        createdBy: entry.created_by,
        createdByDisplayName:
          users.get(entry.created_by)?.displayName || entry.created_by || "Systeme",
        createdAt: entry.created_at,
      })),
    };
  },

  async addExcludedUser({ username, reason, createdBy }) {
    const safeUsername = String(username || "").trim();
    if (!safeUsername) {
      const error = new Error("Username requis.");
      error.status = 400;
      throw error;
    }

    const { error } = await supabase.from("analytics_excluded_users").upsert(
      [
        {
          username: safeUsername,
          reason: String(reason || "").trim().slice(0, 160) || null,
          created_by: createdBy || null,
        },
      ],
      { onConflict: "username" },
    );

    if (error) throw error;
    return this.getExcludedUsers();
  },

  async removeExcludedUser(username) {
    const safeUsername = String(username || "").trim();
    if (!safeUsername) {
      const error = new Error("Username requis.");
      error.status = 400;
      throw error;
    }

    const { error } = await supabase
      .from("analytics_excluded_users")
      .delete()
      .eq("username", safeUsername);

    if (error) throw error;
    return this.getExcludedUsers();
  },
};

module.exports = analyticsService;
