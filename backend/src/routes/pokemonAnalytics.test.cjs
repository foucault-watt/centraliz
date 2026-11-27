const assert = require("node:assert/strict");
const test = require("node:test");

const events = [];
const databasePath = require.resolve("../utils/supabaseClient");
require.cache[databasePath] = {
  exports: {
    from(table) {
      assert.equal(table, "analytics_events");
      let rows = events;
      return {
        async insert(entries) {
          events.push(...entries.map((entry) => ({
            ...entry,
            created_at: new Date().toISOString(),
          })));
          return {};
        },
        select() { return this; },
        order() { return this; },
        range() { return this; },
        gte() { return this; },
        eq(column, value) {
          rows = rows.filter((row) => row[column] === value);
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows }).then(resolve, reject);
        },
      };
    },
  },
};

let frameAgeMs = 100;
const pokemonService = {
  isDemo: false,
  getFrameBuffer() {
    return { format: "webp", buffer: Buffer.from("frame"), ageMs: frameAgeMs };
  },
  async sendInput(button) {
    if (button !== "A") throw Object.assign(new Error("Bouton invalide"), { status: 400 });
    return { success: true, button };
  },
};
require.cache[require.resolve("../services/pokemonService")] = { exports: pokemonService };

const routes = require("./pokemon");
const analyticsService = require("../services/analyticsService");
const inactivityMs = 10 * 60 * 1000;

test("Pokémon apparaît dans Analytics Admin avant la première utilisation", async () => {
  const { modules } = await analyticsService.getModules();
  const summary = await analyticsService.getModuleSummary("pokemon");
  assert.deepEqual(modules, [summary]);
  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.lastSeenAt, null);
  assert.equal(await analyticsService.getModuleSummary("inconnu"), null);
});

test("seul le début de chaque activité Pokémon réelle est compté par compte", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);

  function request(path, { method = "GET", username = "alice", body } = {}) {
    const { route } = routes.stack.find(({ route }) => route.path === path);
    const req = { method, session: { user: { userName: username } }, body, query: {}, get() {} };
    return new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader() {},
        send() { resolve(this.statusCode); },
        json() { resolve(this.statusCode); },
      };
      route.dispatch(req, res, reject);
    });
  }

  const input = (button, username) => request("/input", {
    method: "POST",
    body: { button },
    username,
  });

  frameAgeMs = 60000;
  assert.equal(await request("/frame"), 200);
  assert.equal(await input("invalid"), 400);
  assert.equal(events.length, 0);

  frameAgeMs = 100;
  assert.equal(await request("/frame"), 200);
  assert.equal(await input("A"), 200);
  now += inactivityMs - 1;
  await Promise.all([request("/frame"), request("/frame"), input("A"), input("A")]);
  assert.deepEqual(events.map(({ user_username, event_name, event_type }) => [user_username, event_name, event_type]), [
    ["alice", "pokemon_stream_viewed", "exposure"],
    ["alice", "pokemon_play_started", "interaction"],
  ]);

  pokemonService.isDemo = true;
  await request("/frame", { username: "bob" });
  await input("A", "bob");
  assert.equal(events.length, 2);
  pokemonService.isDemo = false;
  await request("/frame", { username: "bob" });
  assert.equal(events.length, 3);

  now += inactivityMs;
  await request("/frame");
  const summary = await analyticsService.getModuleSummary("pokemon");
  assert.equal(summary.activeUsers, 2);
  assert.equal(summary.exposureCount, 3);
  assert.equal(summary.interactionCount, 1);
});

test("une session de jeu donne une seule ligne pokemon_session, avec le résumé du navigateur", async (t) => {
  const pokemonSessions = require("../services/pokemonSessions");
  pokemonSessions.resetForTests();
  let now = Date.parse("2026-11-27T14:00:00Z");
  t.mock.method(Date, "now", () => now);
  const before = events.length;

  function call(path, { method = "GET", body, headers = {} } = {}) {
    const { route } = routes.stack.find(({ route }) => route.path === path);
    const req = {
      method, url: path, headers, body, query: {}, sessionID: "sid-carol",
      session: { user: { userName: "carol" } },
      get(name) { return headers[name.toLowerCase()]; },
    };
    return new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        setHeader() {},
        send() { resolve(this.statusCode); },
        json() { resolve(this.statusCode); },
        end() { resolve(this.statusCode); },
      };
      route.dispatch(req, res, reject);
    });
  }

  for (let i = 0; i < 20; i += 1) {
    assert.equal(await call("/frame"), 200);
    if (i === 5) assert.equal(await call("/input", { method: "POST", body: { button: "A" } }), 200);
    now += 1000;
  }
  assert.equal(await call("/session-stats", { method: "POST", body: "pas du json" }), 400);
  assert.equal(await call("/session-stats", {
    method: "POST",
    body: JSON.stringify({ frames: 19, bytes: 95, rttHist: [19, 0, 0, 0, 0, 0, 0, 0, 0, 0], rttSum: 570 }),
  }), 204);

  pokemonSessions.sweep(now + pokemonSessions.IDLE_MS);
  await new Promise((resolve) => setImmediate(resolve));
  const rows = events.slice(before).filter((event) => event.event_name === "pokemon_session");
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.user_username, "carol");
  assert.equal(row.event_type, "system");
  assert.equal(row.properties.watched_s, 19);
  assert.equal(row.properties.inputs, 1);
  assert.equal(row.properties.mode, "polling");
  assert.equal(row.properties.server_frames, 20);
  assert.equal(row.properties.server_bytes, 100);
  assert.equal(row.properties.client_frames, 19);
  assert.equal(row.properties.rtt_avg_ms, 30);
  assert.equal(pokemonSessions.percentileFromHistogram(row.properties.rtt_hist), 50);
  assert.equal(row.properties.played_s, 30);
  assert.deepEqual(row.properties.daily.map(([, watchedMs, playedMs]) => [watchedMs, playedMs]), [[19000, 30000]]);
});
