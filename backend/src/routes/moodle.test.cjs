const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const routes = require("./moodle");
const { createMoodleService } = require("../services/moodleService");

test("Moodle uses the session identity and existing ENT resolver, without returning credentials", async t => {
  const resolutions = [];
  const credentials = { entUsername: "ent-alice", password: "private-password", encryptedPassword: "private-ciphertext" };
  const moodleService = createMoodleService({
    credentialsService: { resolveStoredCredentials: async (...args) => {
      resolutions.push(args);
      if (args[1] === "invalid") throw Object.assign(new Error(credentials.password), { code: "USER_KEY_INVALID" });
      return credentials;
    } },
    collect: async data => {
      assert.equal(data, credentials);
      return [{ name: "Maths", url: "https://moodle.centralelille.fr/course/view.php?id=1" }];
    },
  });
  const app = express();
  app.use(express.json());
  app.use("/moodle", routes({
    authMiddleware: (req, res, next) => {
      if (!req.headers["x-test-session"]) return res.sendStatus(401);
      req.session = { user: { userName: "alice" } };
      next();
    }, moodleService,
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/moodle/courses`;
  assert.equal((await fetch(url, { method: "POST" })).status, 401);
  const missingKey = await fetch(url, { method: "POST", headers: { "x-test-session": "yes" } });
  assert.equal(missingKey.status, 428);
  assert.deepEqual(resolutions, []);
  const response = await fetch(url, { method: "POST", headers: {
    "x-test-session": "yes", "X-User-Key": "local-key", "Content-Type": "application/json",
  }, body: JSON.stringify({ username: "bob", ent_username: "ent-bob", password: "ignored" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.courses.length, 1);
  assert.deepEqual(resolutions, [["alice", "local-key"]]);
  assert.equal(JSON.stringify(body).includes("private"), false);
  const invalidKey = await fetch(url, { method: "POST", headers: { "x-test-session": "yes", "X-User-Key": "invalid" } });
  assert.equal(invalidKey.status, 401);
  assert.deepEqual(await invalidKey.json(), { error: "Clé utilisateur invalide", code: "USER_KEY_INVALID", action: "relogin_sso" });
});

test("the authenticated file endpoint returns bytes, not a Moodle link", async t => {
  const bytes = Buffer.from("original-file\x00\xff", "latin1");
  const calls = [];
  const moodleService = {
    downloadFile: async (...args) => {
      calls.push(args);
      return { name: "support été.pdf", mimeType: "application/pdf", blob: bytes.toString("base64") };
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/moodle", routes({ moodleService, authMiddleware: (req, res, next) => {
    if (!req.headers["x-test-session"]) return res.sendStatus(401);
    req.session = { user: { userName: "alice" } }; next();
  } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/moodle/courses/12/resources/7/file`;
  assert.equal((await fetch(url, { method: "POST" })).status, 401);
  assert.equal(calls.length, 0);
  const result = await fetch(url, { method: "POST", headers: { "x-test-session": "yes", "X-User-Key": "key" } });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "application/pdf");
  assert.match(result.headers.get("content-disposition"), /support%20%C3%A9t%C3%A9.pdf/);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
  assert.deepEqual(calls, [["alice", "key", 12, 7, 0]]);
});
