const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createMoodleService, runCollector } = require("./moodleService");

test("Moodle logs stages and duration without credentials or raw errors", async () => {
  const logs = [];
  const service = createMoodleService({
    logger: { log: message => logs.push(message) },
    credentialsService: { resolveStoredCredentials: async () => ({
      entUsername: "private-username", password: "private-password", encryptedPassword: "private-ciphertext",
    }) },
    collect: async () => { throw new Error("private-password ticket=secret-ticket"); },
  });
  await assert.rejects(service.listCourses("private-centraliz-user", "private-key"));
  assert.ok(logs.some(line => line.includes('"event":"credentials_resolved"')));
  assert.ok(logs.some(line => line.includes('"event":"failed"') && line.includes('"stage":"collection"')));
  assert.ok(logs.every(line => !line.includes("private-") && !line.includes("secret-ticket")));
  const entries = logs.map(line => JSON.parse(line.replace(/^\[Moodle\] /, "")));
  assert.equal(new Set(entries.map(entry => entry.requestId)).size, 1);
  assert.ok(entries.every(entry => Number.isFinite(entry.durationMs)));
});

test("a missing Python executable is identified without logging credentials", async () => {
  const previousPython = process.env.MOODLE_PYTHON;
  const logs = [];
  process.env.MOODLE_PYTHON = path.join(__dirname, "__missing_moodle_python__");
  try {
    await assert.rejects(runCollector({ entUsername: "private-user", password: "private-password" }, {
      log: (event, fields) => logs.push({ event, ...fields }),
    }), { code: "MOODLE_COLLECTION_FAILED" });
    assert.ok(logs.some(entry => entry.event === "collector_spawn_failed" && entry.reason === "ENOENT"));
    assert.equal(JSON.stringify(logs).includes("private-"), false);
  } finally {
    if (previousPython === undefined) delete process.env.MOODLE_PYTHON;
    else process.env.MOODLE_PYTHON = previousPython;
  }
});
