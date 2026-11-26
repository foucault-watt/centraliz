const { test } = require("node:test");
const assert = require("node:assert/strict");

const databasePath = require.resolve("../utils/supabaseClient");
require.cache[databasePath] = { exports: {} };
const database = require(databasePath);
const login = require("./loginService");
const zimbra = require("./zimbraService");
const migration = require("./entBrowserMigration");

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  sendStatus(code) { return this.status(code); },
  json(body) { this.body = body; return this; },
});

const fixture = (t, username = "alice") => {
  const user = {
    username, ent_username: `ent-${username}`,
    ent_password_storage: "legacy", ent_password_migration_id: null,
  };
  const req = {
    session: { user: { userName: user.username }, zimbraToken: "fixture-token" },
    body: { password: "fixture-password" },
    secure: true,
  };
  const stored = { ciphertext: "v2:fixture" };
  t.mock.method(login, "getUser", async (currentUsername) => {
    assert.equal(currentUsername, username);
    return { data: user };
  });
  t.mock.method(zimbra, "getStoredPassword", async () => stored.ciphertext);
  return { user, req, stored };
};

test("validates the password with the ENT, returns no password and deletes only the expected V2", async (t) => {
  const { user, req, stored } = fixture(t);
  const decrypt = t.mock.method(zimbra, "decryptPassword", () => {
    assert.fail("The migration decrypted the original server copy");
  });
  const validate = t.mock.method(zimbra, "authenticate", async () => ({}));
  database.rpc = async (name, args) => {
    assert.equal(name, "migrate_ent_v2_to_browser");
    assert.deepEqual(args, {
      account_name: "alice", ent_name: "ent-alice",
      expected_password: stored.ciphertext, migration_id: req.body.id,
    });
    user.ent_password_storage = "browser";
    user.ent_password_migration_id = args.migration_id;
    return { data: true };
  };
  t.after(() => { delete database.rpc; });
  const apply = t.mock.method(database, "rpc");

  const beforeValidation = response();
  await migration.commit(req, beforeValidation);
  assert.equal(beforeValidation.statusCode, 403);

  const prepared = response();
  await migration.prepare(req, prepared);
  assert.deepEqual(validate.mock.calls[0].arguments, ["ent-alice", "fixture-password"]);
  assert.deepEqual(prepared.body, { id: prepared.body.id, entUsername: "ent-alice" });
  assert.equal(decrypt.mock.callCount(), 0);
  assert(!JSON.stringify(req.session).includes("fixture-password"));
  assert.equal(apply.mock.callCount(), 0);

  req.body = { id: prepared.body.id };
  stored.ciphertext = "v2:password-changed";
  const stale = response();
  await migration.commit(req, stale);
  assert.equal(stale.statusCode, 409);
  assert.equal(apply.mock.callCount(), 0);

  stored.ciphertext = "v2:fixture";
  const committed = response();
  await migration.commit(req, committed);
  assert.equal(committed.statusCode, 204);
  assert.equal(apply.mock.callCount(), 1);
  assert.equal(req.session.zimbraToken, undefined);
  const retry = response();
  await migration.commit(req, retry);
  assert.equal(retry.statusCode, 204);
  assert.equal(apply.mock.callCount(), 1);
});

test("rejects missing or invalid passwords without preparing a migration", async (t) => {
  const { req } = fixture(t);
  const validate = t.mock.method(zimbra, "authenticate", async () => {
    throw Object.assign(new Error("Invalid credentials"), { code: "ENT_CREDENTIALS_INVALID" });
  });
  const missing = response();
  await migration.prepare({ ...req, body: {} }, missing);
  assert.equal(missing.statusCode, 400);
  assert.equal(validate.mock.callCount(), 0);
  await assert.rejects(migration.prepare(req, response()), { code: "ENT_CREDENTIALS_INVALID" });
  assert.equal(req.session.entBrowserPasswordMigration, undefined);
});

test("refuses historical V1 and the separate V3 format", async (t) => {
  const { req, stored } = fixture(t);
  for (const ciphertext of ["fixture-v1", "v3:fixture-v3"]) {
    stored.ciphertext = ciphertext;
    const result = response();
    await migration.prepare(req, result);
    assert.equal(result.statusCode, 409);
    assert.equal(req.session.entBrowserPasswordMigration, undefined);
  }
});

test("another V2 account can prepare a migration, and only that account can confirm it", async (t) => {
  const { req } = fixture(t, "bob");
  t.mock.method(zimbra, "authenticate", async () => ({}));
  const prepared = response();
  await migration.prepare(req, prepared);
  assert.equal(prepared.statusCode, 200);
  assert.equal(prepared.body.entUsername, "ent-bob");

  req.body = { id: prepared.body.id };
  req.session.user.userName = "alice";
  const blocked = response();
  await migration.commit(req, blocked);
  assert.equal(blocked.statusCode, 403);
});
