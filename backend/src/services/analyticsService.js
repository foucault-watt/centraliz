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
const MAX_SCAN_ROWS = 10000;

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

const getExcludedUsernames = async () => {
  const { data, error } = await supabase
    .from("analytics_excluded_users")
    .select("username");

  if (error) throw error;
  return (data || []).map((entry) => entry.username);
};

const getEventsSince = async (startDate, select = "*", filters = {}) => {
  let query = supabase
    .from("analytics_events")
    .select(select)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true })
    .limit(MAX_SCAN_ROWS);

  const eventTypes = parseEventTypes(filters.eventTypes);
  if (eventTypes.length) query = query.in("event_type", eventTypes);

  if (filters.hideExcluded === "true" || filters.hideExcluded === true) {
    const excluded = filters.excludedUsernames || (await getExcludedUsernames());
    if (excluded.length) query = query.not("user_username", "in", toPostgrestInList(excluded));
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
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

const applyEventFilters = async (query, filters = {}) => {
  const start = getRangeStart(filters.range);
  query = query.gte("created_at", start.toISOString());

  if (filters.module) query = query.eq("module", filters.module);
  if (filters.eventName) query = query.eq("event_name", filters.eventName);
  const eventTypes = parseEventTypes(filters.eventTypes);
  if (eventTypes.length) query = query.in("event_type", eventTypes);
  if (filters.exactUsername) query = query.eq("user_username", filters.exactUsername);
  else if (filters.username) query = query.ilike("user_username", `%${filters.username}%`);

  if (filters.hideExcluded === "true" || filters.hideExcluded === true) {
    const excluded = await getExcludedUsernames();
    if (excluded.length) query = query.not("user_username", "in", toPostgrestInList(excluded));
  }

  const groupUsernames = await getUsernamesForGroup(filters.group);
  if (groupUsernames) {
    if (!groupUsernames.length) return { query, forceEmpty: true };
    query = query.in("user_username", groupUsernames);
  }

  return { query, forceEmpty: false };
};

const buildUserSummaries = async ({ range = "30d", search, group, eventTypes, hideExcluded } = {}) => {
  const start = getRangeStart(range);
  const excludedUsernames = hideExcluded === "true" || hideExcluded === true
    ? await getExcludedUsernames()
    : [];
  const events = await getEventsSince(
    start,
    "user_username, event_name, event_type, module, created_at",
    { eventTypes, hideExcluded, excludedUsernames },
  );
  const users = await getUsersByUsername([...uniqueUsers(events)]);
  const summaries = new Map();

  events.forEach((event) => {
    if (!event.user_username) return;
    const user = users.get(event.user_username);
    if (!user) return;
    if (group && user.group !== group) return;
    if (
      search &&
      !user.username.toLowerCase().includes(String(search).toLowerCase()) &&
      !user.displayName.toLowerCase().includes(String(search).toLowerCase())
    ) {
      return;
    }

    if (!summaries.has(user.username)) {
      summaries.set(user.username, {
        username: user.username,
        displayName: user.displayName,
        group: user.group,
        totalEvents: 0,
        activeDays: new Set(),
        modules: new Map(),
        events: new Map(),
        firstActivity: event.created_at,
        lastActivity: event.created_at,
      });
    }

    const summary = summaries.get(user.username);
    summary.totalEvents += 1;
    summary.activeDays.add(new Date(event.created_at).toISOString().slice(0, 10));
    increment(summary.modules, event.module);
    increment(summary.events, event.event_name);
    if (new Date(event.created_at) < new Date(summary.firstActivity)) {
      summary.firstActivity = event.created_at;
    }
    if (new Date(event.created_at) > new Date(summary.lastActivity)) {
      summary.lastActivity = event.created_at;
    }
  });

  return [...summaries.values()].map((summary) => ({
    ...summary,
    activeDays: summary.activeDays.size,
    modules: toSortedArray(summary.modules, 6),
    topEvents: toSortedArray(summary.events, 6),
  }));
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
    const start = getRangeStart(range);
    const excludedUsernames =
      hideExcluded === "true" || hideExcluded === true
        ? await getExcludedUsernames()
        : [];
    const events = await getEventsSince(
      start,
      "user_username, event_name, event_type, is_automatic, source, module, created_at, properties",
      { eventTypes, hideExcluded, excludedUsernames },
    );

    const users = uniqueUsers(events);
    const modules = new Map();
    const eventNames = new Map();
    const eventTypesMap = new Map();
    const activeDaysByUser = new Map();
    const hourly = new Map();
    const weekdays = new Map();

    events.forEach((event) => {
      increment(modules, event.module);
      increment(eventNames, event.event_name);
      increment(eventTypesMap, event.event_type || "interaction");

      const parsed = new Date(event.created_at);
      increment(hourly, String(parsed.getHours()).padStart(2, "0"));
      increment(weekdays, parsed.toLocaleDateString("fr-FR", { weekday: "long" }));

      if (event.user_username) {
        if (!activeDaysByUser.has(event.user_username)) {
          activeDaysByUser.set(event.user_username, new Set());
        }
        activeDaysByUser
          .get(event.user_username)
          .add(parsed.toISOString().slice(0, 10));
      }
    });

    const now = new Date();
    const activeSince = (days) => {
      const threshold = new Date(now);
      threshold.setDate(threshold.getDate() - days);
      return uniqueUsers(
        events.filter((event) => new Date(event.created_at) >= threshold),
      ).size;
    };

    let previousQuery = supabase
      .from("analytics_events")
      .select("user_username")
      .lt("created_at", start.toISOString())
      .not("user_username", "is", null)
      .limit(MAX_SCAN_ROWS);

    const parsedEventTypes = parseEventTypes(eventTypes);
    if (parsedEventTypes.length) previousQuery = previousQuery.in("event_type", parsedEventTypes);
    if (excludedUsernames.length) {
      previousQuery = previousQuery.not(
        "user_username",
        "in",
        toPostgrestInList(excludedUsernames),
      );
    }

    const { data: previousEvents, error: previousError } = await previousQuery;

    if (previousError) throw previousError;

    const previousUsers = uniqueUsers(previousEvents || []);
    const returningUsers = [...users].filter((username) =>
      previousUsers.has(username),
    ).length;
    const newUsers = Math.max(users.size - returningUsers, 0);

    const userGroups = new Map();
    const usersByUsername = await getUsersByUsername([...users]);
    [...users].forEach((username) => {
      increment(userGroups, usersByUsername.get(username)?.group || "Non renseigne");
    });

    const recurrentUsers = [...activeDaysByUser.values()].filter(
      (days) => days.size > 1,
    ).length;

    return {
      range: VALID_RANGES[range] ? range : "30d",
      totals: {
        events: events.length,
        activeUsers: users.size,
        dau: activeSince(1),
        wau: activeSince(7),
        mau: activeSince(30),
        recurrentUsers,
      },
      newVsReturning: { newUsers, returningUsers },
      eventsByModule: toSortedArray(modules, 12),
      topEvents: toSortedArray(eventNames, 12),
      eventsByType: toSortedArray(eventTypesMap, 10),
      eventTypeTotals: {
        exposure: eventTypesMap.get("exposure") || 0,
        load: eventTypesMap.get("load") || 0,
        interaction: eventTypesMap.get("interaction") || 0,
        conversion: eventTypesMap.get("conversion") || 0,
        admin: eventTypesMap.get("admin") || 0,
        system: eventTypesMap.get("system") || 0,
      },
      activityByHour: [...Array(24)].map((_, hour) => {
        const label = String(hour).padStart(2, "0");
        return { hour: label, count: hourly.get(label) || 0 };
      }),
      activityByWeekday: toSortedArray(weekdays, 7),
      usersByGroup: toSortedArray(userGroups, 12),
    };
  },

  async getTimeseries({ range = "30d", groupBy = "day", eventTypes, hideExcluded } = {}) {
    const start = getRangeStart(range);
    const safeGroupBy = groupBy === "week" ? "week" : "day";
    const excludedUsernames =
      hideExcluded === "true" || hideExcluded === true
        ? await getExcludedUsernames()
        : [];
    const events = await getEventsSince(
      start,
      "user_username, event_name, event_type, module, created_at",
      { eventTypes, hideExcluded, excludedUsernames },
    );

    const buckets = new Map();
    events.forEach((event) => {
      const key = getPeriodKey(event.created_at, safeGroupBy);
      if (!buckets.has(key)) {
        buckets.set(key, { period: key, events: 0, users: new Set() });
      }
      const bucket = buckets.get(key);
      bucket.events += 1;
      if (event.user_username) bucket.users.add(event.user_username);
    });

    return {
      range: VALID_RANGES[range] ? range : "30d",
      groupBy: safeGroupBy,
      points: [...buckets.values()]
        .map((bucket) => ({
          period: bucket.period,
          events: bucket.events,
          activeUsers: bucket.users.size,
        }))
        .sort((a, b) => a.period.localeCompare(b.period)),
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

    let query = supabase
      .from("analytics_events")
      .select("id, user_username, event_name, event_type, is_automatic, source, module, properties, created_at", {
        count: "exact",
      });

    const filtered = await applyEventFilters(query, {
      range,
      module,
      eventName,
      eventTypes,
      username,
      exactUsername,
      group,
      hideExcluded,
    });

    if (filtered.forceEmpty) {
      return { events: [], pagination: { ...pagination, total: 0, pageCount: 0 } };
    }

    const { data, error, count } = await filtered.query
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
      ["lastActivity", "firstActivity", "totalEvents", "activeDays", "username"],
      "lastActivity.desc",
    );

    const summaries = await buildUserSummaries({
      range,
      search,
      group,
      eventTypes,
      hideExcluded,
    });
    summaries.sort((a, b) => {
      const aValue = a[parsedSort.field];
      const bValue = b[parsedSort.field];
      if (aValue === bValue) return a.username.localeCompare(b.username);
      if (typeof aValue === "number") {
        return parsedSort.ascending ? aValue - bValue : bValue - aValue;
      }
      return parsedSort.ascending
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    const rows = summaries.slice(pagination.from, pagination.to + 1);

    return {
      users: rows,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: summaries.length,
        pageCount: Math.ceil(summaries.length / pagination.pageSize),
        sort: parsedSort.value,
      },
    };
  },

  async getUserDetail(username, { range = "30d", eventTypes, hideExcluded } = {}) {
    const users = await getUsersByUsername([username]);
    const user = users.get(username);
    if (!user) return null;

    const summaries = await buildUserSummaries({
      range,
      search: username,
      eventTypes,
      hideExcluded,
    });
    const summary = summaries.find((item) => item.username === username) || {
      username,
      displayName: user.displayName,
      group: user.group,
      totalEvents: 0,
      activeDays: 0,
      modules: [],
      topEvents: [],
      firstActivity: null,
      lastActivity: null,
    };

    const start = getRangeStart(range);
    let query = supabase
      .from("analytics_events")
      .select("event_name, event_type, module, created_at")
      .eq("user_username", username)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_SCAN_ROWS);

    const parsedEventTypes = parseEventTypes(eventTypes);
    if (parsedEventTypes.length) query = query.in("event_type", parsedEventTypes);

    const { data, error } = await query;

    if (error) throw error;

    const timeline = new Map();
    (data || []).forEach((event) => {
      const key = getPeriodKey(event.created_at);
      if (!timeline.has(key)) timeline.set(key, { period: key, events: 0 });
      timeline.get(key).events += 1;
    });

    return {
      ...summary,
      timeline: [...timeline.values()].sort((a, b) => a.period.localeCompare(b.period)),
    };
  },

  async getUserEvents(username, query = {}) {
    return this.getEvents({
      ...query,
      exactUsername: username,
    });
  },

  async getModules({ range = "30d", eventTypes, hideExcluded } = {}) {
    const start = getRangeStart(range);
    const excludedUsernames =
      hideExcluded === "true" || hideExcluded === true
        ? await getExcludedUsernames()
        : [];
    const events = await getEventsSince(
      start,
      "user_username, event_name, event_type, module, created_at",
      { eventTypes, hideExcluded, excludedUsernames },
    );

    const modules = new Map();
    events.forEach((event) => {
      if (!modules.has(event.module)) {
        modules.set(event.module, {
          module: event.module,
          totalEvents: 0,
          users: new Set(),
          events: new Map(),
          days: new Map(),
          firstActivity: event.created_at,
          lastActivity: event.created_at,
        });
      }
      const item = modules.get(event.module);
      item.totalEvents += 1;
      if (event.user_username) item.users.add(event.user_username);
      increment(item.events, event.event_name);
      increment(item.days, getPeriodKey(event.created_at));
      if (new Date(event.created_at) < new Date(item.firstActivity)) {
        item.firstActivity = event.created_at;
      }
      if (new Date(event.created_at) > new Date(item.lastActivity)) {
        item.lastActivity = event.created_at;
      }
    });

    return {
      modules: [...modules.values()]
        .map((item) => ({
          module: item.module,
          totalEvents: item.totalEvents,
          activeUsers: item.users.size,
          topEvents: toSortedArray(item.events, 8),
          timeline: [...item.days.entries()]
            .map(([period, count]) => ({ period, count }))
            .sort((a, b) => a.period.localeCompare(b.period)),
          firstActivity: item.firstActivity,
          lastActivity: item.lastActivity,
        }))
        .sort((a, b) => b.totalEvents - a.totalEvents),
    };
  },

  async getRetention({ range = "30d", eventTypes, hideExcluded } = {}) {
    const start = getRangeStart(range);
    const excludedUsernames =
      hideExcluded === "true" || hideExcluded === true
        ? await getExcludedUsernames()
        : [];
    const events = await getEventsSince(
      start,
      "user_username, event_type, created_at, module",
      { eventTypes, hideExcluded, excludedUsernames },
    );
    const users = new Map();

    events.forEach((event) => {
      if (!event.user_username) return;
      if (!users.has(event.user_username)) {
        users.set(event.user_username, {
          username: event.user_username,
          activeDays: new Set(),
          modules: new Set(),
          events: 0,
        });
      }
      const user = users.get(event.user_username);
      user.activeDays.add(new Date(event.created_at).toISOString().slice(0, 10));
      user.modules.add(event.module);
      user.events += 1;
    });

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

    [...users.values()].forEach((user) => {
      const days = user.activeDays.size;
      if (days <= 1) increment(buckets, "1 jour actif");
      else if (days <= 3) increment(buckets, "2-3 jours actifs");
      else if (days <= 7) increment(buckets, "4-7 jours actifs");
      else increment(buckets, "8+ jours actifs");

      const modules = user.modules.size;
      if (modules <= 1) increment(moduleBreadth, "1 module");
      else if (modules <= 3) increment(moduleBreadth, "2-3 modules");
      else increment(moduleBreadth, "4+ modules");
    });

    return {
      range: VALID_RANGES[range] ? range : "30d",
      activeUsers: users.size,
      activeDayBuckets: [...buckets.entries()].map(([name, count]) => ({ name, count })),
      moduleBreadth: [...moduleBreadth.entries()].map(([name, count]) => ({ name, count })),
      stickyUsers: [...users.values()]
        .map((user) => ({
          username: user.username,
          activeDays: user.activeDays.size,
          moduleCount: user.modules.size,
          events: user.events,
        }))
        .sort((a, b) => b.activeDays - a.activeDays || b.events - a.events)
        .slice(0, 20),
    };
  },

  async getHeatmap({ range = "30d", eventTypes, hideExcluded } = {}) {
    const start = getRangeStart(range);
    const excludedUsernames =
      hideExcluded === "true" || hideExcluded === true
        ? await getExcludedUsernames()
        : [];
    const events = await getEventsSince(
      start,
      "user_username, event_type, created_at",
      { eventTypes, hideExcluded, excludedUsernames },
    );
    const weekdays = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const cells = new Map();

    weekdays.forEach((weekday) => {
      for (let hour = 0; hour < 24; hour += 1) {
        cells.set(`${weekday}-${hour}`, { weekday, hour, count: 0 });
      }
    });

    events.forEach((event) => {
      const parsed = new Date(event.created_at);
      const weekday = parsed.toLocaleDateString("fr-FR", { weekday: "long" });
      const hour = parsed.getHours();
      const key = `${weekday}-${hour}`;
      if (cells.has(key)) cells.get(key).count += 1;
    });

    return {
      range: VALID_RANGES[range] ? range : "30d",
      weekdays,
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
