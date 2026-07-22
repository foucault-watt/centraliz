const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;

function requireEnv(name, env = process.env) {
  const value = env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createRedisSessionResources(env = process.env) {
  const sessionSecret = requireEnv("SESSION_SECRET", env);
  const redisUrl = requireEnv("REDIS_URL", env);

  let redisClient;
  try {
    redisClient = createClient({ url: redisUrl });
  } catch (error) {
    throw new Error(`Invalid Redis configuration: ${error.message}`);
  }

  const sessionStore = new RedisStore({ client: redisClient });

  return { sessionSecret, redisClient, sessionStore };
}

async function initializeSession(env = process.env) {
  const { sessionSecret, redisClient, sessionStore } =
    createRedisSessionResources(env);

  try {
    await redisClient.connect();
  } catch (error) {
    throw new Error(`Unable to connect to Redis: ${error.message}`);
  }

  redisClient.on("error", (error) => {
    console.error("[Session] Redis client error:", error.message);
  });

  return session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.SECURE === "true",
      httpOnly: true,
      sameSite: "lax",
    },
  });
}

module.exports = {
  createRedisSessionResources,
  initializeSession,
};
