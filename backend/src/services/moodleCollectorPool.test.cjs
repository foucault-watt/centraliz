const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createCollectorPool } = require("./moodleCollectorPool.cjs");

test("persistent workers reuse a process, coalesce identical calls and isolate accounts", async t => {
  let spawned = 0, requests = 0, active = 0, maximum = 0;
  const children = [];
  const pool = createCollectorPool({ spawnProcess: () => {
    spawned++;
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin = new EventEmitter(); child.exitCode = null;
    child.kill = () => { child.exitCode = 0; child.emit("close"); };
    child.stdin.end = () => { child.exitCode = 0; child.emit("close"); };
    child.stdin.write = line => {
      const request = JSON.parse(line); requests++; active++; maximum = Math.max(maximum, active);
      setTimeout(() => { active--; child.stdout.emit("data", Buffer.from(JSON.stringify({ [request.operation]: [{ name: request.entUsername }] }) + "\n")); }, 10);
    };
    children.push(child); return child;
  } });
  t.after(() => pool.close());
  const credentials = { entUsername: "ent-a", password: "private" };
  const options = { operation: "courses", accountKey: "account-a", log: () => {} };
  const [a, b] = await Promise.all([pool.collect(credentials, options), pool.collect(credentials, options)]);
  assert.deepEqual(a, b); assert.equal(requests, 1); assert.equal(spawned, 1);
  a[0].name = "mutated"; assert.equal(b[0].name, "ent-a");
  await Promise.all([pool.collect(credentials, options), pool.collect(credentials, { ...options, operation: "sections", courseId: 12 })]);
  assert.equal(maximum, 1); assert.equal(spawned, 1);
  await pool.collect(credentials, { ...options, accountKey: "another-account" });
  assert.equal(spawned, 2);
  await pool.collect({ ...credentials, password: "changed" }, options);
  assert.equal(spawned, 3); assert.equal(children[0].exitCode, 0);
});
