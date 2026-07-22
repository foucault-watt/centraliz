const test = require("node:test");
const assert = require("node:assert/strict");
const { createRedisSessionResources } = require("../src/config/session");

test("session config requires SESSION_SECRET", () => {
  assert.throws(
    () => createRedisSessionResources({ REDIS_URL: "redis://127.0.0.1:6379" }),
    /Missing required environment variable: SESSION_SECRET/
  );
});

test("session config requires REDIS_URL", () => {
  assert.throws(
    () => createRedisSessionResources({ SESSION_SECRET: "secret" }),
    /Missing required environment variable: REDIS_URL/
  );
});

test("session config creates redis-backed store resources", () => {
  const resources = createRedisSessionResources({
    SESSION_SECRET: "secret",
    REDIS_URL: "redis://127.0.0.1:6379",
  });

  assert.ok(resources.redisClient);
  assert.equal(resources.sessionSecret, "secret");
  assert.equal(resources.redisClient.options.url, "redis://127.0.0.1:6379");
  assert.equal(resources.sessionStore.constructor.name, "RedisStore");
});
