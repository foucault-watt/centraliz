const { test } = require("node:test");
const assert = require("node:assert/strict");

// The test invokes the registered handlers without opening a network listener.
const clientPath = require.resolve("../utils/supabaseClient");
const analyticsPath = require.resolve("../services/analyticsService");
require.cache[clientPath] = { exports: {} };
require.cache[analyticsPath] = { exports: { trackEvent() {} } };
const service = require("../services/zimbraService");
const router = require("./zimbra");

const handlers = (path, method) => router.stack.find(
  ({ route }) => route?.path === path && route.methods[method],
).route.stack.map(({ handle }) => handle);

const response = () => ({
  statusCode: 200,
  headers: {},
  set(name, value) { this.headers[name] = value; return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("browser mode ignores rememberMe and only uses the password for the current Zimbra call", async (t) => {
  const post = handlers("/", "post").at(-1);
  const detail = handlers("/mail/:id", "post").at(-1);
  const authenticate = t.mock.method(service, "authenticate", async () => ({}));
  t.mock.method(service, "parseMails", async () => []);
  t.mock.method(service, "linkEntUsername", async () => {});
  const save = t.mock.method(service, "storeEncryptedPassword", async () => {});
  const getRaw = t.mock.method(service, "getRawMailContent", async () => "email");
  const user = { userName: "alice", ent_password_storage: "browser" };
  const req = {
    session: { user },
    headers: { "x-user-key": "legacy-key" },
    body: { ent_username: "ent-alice", password: "example-password", rememberMe: true },
    params: { id: "1" },
  };
  const listResponse = response();
  await post(req, listResponse);
  assert.equal(listResponse.body.success, true);
  assert.deepEqual(authenticate.mock.calls[0].arguments, ["ent-alice", "example-password"]);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(req.session.zimbraToken, undefined);
  assert.equal(listResponse.headers["Cache-Control"], "no-store");

  const detailResponse = response();
  await detail(req, detailResponse);
  assert.equal(detailResponse.body.content, "email");
  assert.equal(getRaw.mock.callCount(), 1);
  assert.equal(req.session.zimbraToken, undefined);

  const legacyResponse = response();
  await post({ ...req, session: { user: { ...user, ent_password_storage: "legacy" } }, userKey: "legacy-key" }, legacyResponse);
  assert.equal(legacyResponse.body.success, true);
  assert.equal(save.mock.callCount(), 1);
});

test("browser mode blocks the legacy automatic login even with a user key", () => {
  const guard = handlers("/auto-auth", "post")[1];
  const res = response();
  guard({ session: { user: { ent_password_storage: "browser" } } }, res,
    () => assert.fail("The legacy authentication route ran"));
  assert.equal(res.statusCode, 428);
  assert.equal(res.body.code, "ENT_PASSWORD_REQUIRED");
});

test("a session on the second device cannot use its pre-migration mail token", async (t) => {
  const database = require("../utils/supabaseClient");
  database.from = () => ({
    select() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: { ent_password_storage: "browser" } }; },
  });
  t.after(() => { delete database.from; });
  const req = {
    session: { user: { userName: "alice", ent_password_storage: "legacy" }, zimbraToken: "old-token" },
  };
  const res = response();
  await router.stack[0].handle(req, res, () => {});
  assert.equal(req.session.zimbraToken, undefined);
  await handlers("/mails", "get").at(-1)(req, res);
  assert.equal(res.statusCode, 428);
  assert.equal(res.body.code, "ENT_PASSWORD_REQUIRED");
});

test("notes and CSV in browser mode require credentials for this request", async (t) => {
  const database = require("../utils/supabaseClient");
  const grades = require("../services/gradesService");
  const csv = require("../services/csvService");
  const query = {
    select() { return this; },
    eq() { return this; },
    async single() {
      return { data: { ent_username: "ent-alice", ent_password_storage: "browser" } };
    },
  };
  database.from = (table) => {
    assert.equal(table, "users");
    return query;
  };
  t.after(() => { delete database.from; });
  const stored = t.mock.method(service, "getStoredPassword", async () => {
    assert.fail("Legacy password was read");
  });

  await assert.rejects(
    grades.refreshGrades("alice", { rememberMe: true, userKey: "legacy-key" }),
    { statusCode: 428 },
  );
  const res = response();
  await csv.downloadCSV({
    session: { user: { userName: "alice", ent_password_storage: "browser" } },
    body: { rememberMe: true, ent_username: "ent-alice" },
  }, res);
  assert.equal(res.statusCode, 428);
  assert.equal(stored.mock.callCount(), 0);
});

test("notes keep using the historical credentials when the storage column is absent", async (t) => {
  const database = require("../utils/supabaseClient");
  const grades = require("../services/gradesService");
  const missingColumn = {
    code: "42703", message: "column users.ent_password_storage does not exist",
  };
  database.from = (table) => {
    assert.equal(table, "users");
    let columns;
    return {
      select(value) { columns = value; return this; },
      eq(field, value) {
        assert.equal(field, "username");
        assert.equal(value, "alice");
        return this;
      },
      async single() {
        return columns.includes("ent_password_storage")
          ? { data: null, error: missingColumn }
          : { data: { ent_username: "ent-alice" }, error: null };
      },
    };
  };
  t.after(() => { delete database.from; });
  t.mock.method(service, "hasStoredPassword", async () => true);

  assert.deepEqual(await grades.getCredentialStatus("alice"), {
    entUsername: "ent-alice", hasStoredPassword: true,
  });
  const stored = t.mock.method(service, "getStoredPassword", async () => {
    throw Object.assign(new Error("Test stopped before connecting to WebAurion"), {
      statusCode: 503, code: "TEST_STOP",
    });
  });
  await assert.rejects(grades.refreshGrades("alice"), { statusCode: 503 });
  assert.deepEqual(stored.mock.calls[0].arguments, ["ent-alice"]);
});
