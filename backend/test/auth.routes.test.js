const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const session = require("express-session");
const authRoutes = require("../src/routes/auth");

function createServer() {
  const app = express();
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );

  app.get("/test/login", (req, res) => {
    req.session.user = { userName: "alice", displayName: "Alice" };
    res.status(204).end();
  });

  app.use("/api/auth", authRoutes);
  return http.createServer(app);
}

function request(server, path, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

test("auth status and logout keep working", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const unauthenticated = await request(server, "/api/auth/status");
  assert.equal(unauthenticated.status, 200);
  assert.deepEqual(JSON.parse(unauthenticated.body), { authenticated: false, user: null });

  const login = await request(server, "/test/login");
  const cookie = login.headers["set-cookie"][0].split(";")[0];
  assert.ok(cookie.includes("connect.sid"));

  const authenticated = await request(server, "/api/auth/status", {
    headers: { Cookie: cookie },
  });
  assert.equal(authenticated.status, 200);
  assert.equal(JSON.parse(authenticated.body).authenticated, true);

  const logout = await request(server, "/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logout.status, 204);

  const afterLogout = await request(server, "/api/auth/status", {
    headers: { Cookie: cookie },
  });
  assert.equal(afterLogout.status, 200);
  assert.equal(JSON.parse(afterLogout.body).authenticated, false);
});
