const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createRoutes = require("./musee.cjs");
const id = "00000000-0000-4000-8000-000000000001";

test("public tracking accepts a guest; admin summary remains protected", async t => {
  const tracked = [];
  const app = express();
  app.use(express.json());
  app.use("/musee", createRoutes({
    analyticsService: { trackEvent: event => tracked.push(event), getMuseeStats: async () => ({ players: 1 }) },
    authMiddleware: (req, res, next) => req.headers["x-test-admin"] ? next() : res.sendStatus(401),
    adminMiddleware: (req, res, next) => req.headers["x-test-admin"] === "yes" ? next() : res.sendStatus(403),
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/musee`;
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    eventName: "musee_play_clicked", anonymousId: id, module: "admin", userUsername: "spoof",
    properties: { session_id: id, event_id: id },
  }) });
  assert.equal(response.status, 202);
  assert.equal(tracked[0].module, "musee");
  assert.equal(tracked[0].userUsername, undefined);
  assert.equal((await fetch(`${url}/summary`)).status, 401);
  assert.equal((await fetch(`${url}/summary`, { headers: { "x-test-admin": "no" } })).status, 403);
  assert.equal((await fetch(`${url}/summary`, { headers: { "x-test-admin": "yes" } })).status, 200);
  assert.equal((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName: "arbitrary" }) })).status, 400);
});
