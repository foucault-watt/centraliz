const test = require("node:test");
const assert = require("node:assert/strict");
const authRouter = require("../src/routes/auth");

function getRouteHandler(path, method) {
  const layer = authRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method]
  );
  return layer.route.stack[0].handle;
}

function createJsonResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return this;
    },
    clearCookie() {
      return this;
    },
  };
}

test("auth status route reports authentication state", () => {
  const statusHandler = getRouteHandler("/status", "get");

  const unauthenticatedRes = createJsonResponse();
  statusHandler({ session: {} }, unauthenticatedRes);
  assert.deepEqual(unauthenticatedRes.payload, { authenticated: false, user: null });

  const authenticatedRes = createJsonResponse();
  statusHandler(
    { session: { user: { userName: "alice", displayName: "Alice" } } },
    authenticatedRes
  );
  assert.equal(authenticatedRes.payload.authenticated, true);
});

test("auth logout route destroys session and returns 204", () => {
  const logoutHandler = getRouteHandler("/logout", "post");
  let destroyed = false;
  const req = {
    session: {
      destroy(callback) {
        destroyed = true;
        callback();
      },
    },
  };
  const res = createJsonResponse();

  logoutHandler(req, res);

  assert.equal(destroyed, true);
  assert.equal(res.statusCode, 204);
});
