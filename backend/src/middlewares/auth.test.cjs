const { test } = require("node:test");
const assert = require("node:assert/strict");
const auth = require("./auth");

test("rejected authentication never logs cookies or session identifiers", () => {
  const previousWarn = console.warn;
  const previousDebug = console.debug;
  const previousBypass = process.env.DEV_AUTH_BYPASS;
  const logs = [];
  console.warn = console.debug = (...args) => logs.push(args.join(" "));
  process.env.DEV_AUTH_BYPASS = "false";
  let status;
  try {
    auth({ ip: "::1", headers: { cookie: "remember_me=private-token" }, sessionID: "private-session" }, {
      status: value => { status = value; return { json: () => {} }; },
    }, () => assert.fail("unauthenticated request must be rejected"));
    assert.equal(status, 401);
    assert.equal(logs.some(line => line.includes("private-")), false);
  } finally {
    console.warn = previousWarn;
    console.debug = previousDebug;
    if (previousBypass === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = previousBypass;
  }
});
