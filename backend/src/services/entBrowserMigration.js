const { createHash, randomUUID } = require("node:crypto");
const supabase = require("../utils/supabaseClient");
const loginService = require("./loginService");
const ZimbraService = require("./zimbraService");

const VALID_FOR_MS = 10 * 60_000;

const digest = (value) => createHash("sha256").update(value).digest("hex");

const error = (res, statusCode, code) => res.status(statusCode).json({ code });

const prepare = async (req, res) => {
  const username = req.session.user.userName;
  const { password } = req.body || {};
  if (typeof password !== "string" || !password) {
    return error(res, 400, "ENT_PASSWORD_REQUIRED");
  }
  const { data: user, error: lookupError } = await loginService.getUser(username);
  if (lookupError) return error(res, 503, "ENT_MIGRATION_UNAVAILABLE");
  if (user?.ent_password_storage !== "legacy" || !user.ent_username) {
    return error(res, 409, "ENT_MIGRATION_NOT_APPLICABLE");
  }
  if (!Object.hasOwn(user, "ent_password_migration_id")) {
    return error(res, 503, "ENT_MIGRATION_UNAVAILABLE");
  }
  const ciphertext = await ZimbraService.getStoredPassword(user.ent_username);
  if (ZimbraService.getEncryptionVersion(ciphertext) !== "v2") {
    return error(res, 409, "ENT_MIGRATION_NOT_APPLICABLE");
  }
  await ZimbraService.authenticate(user.ent_username, password);
  const id = randomUUID();
  req.session.entBrowserPasswordMigration = {
    id, username, entUsername: user.ent_username,
    expiresAt: Date.now() + VALID_FOR_MS, ciphertextHash: digest(ciphertext),
  };
  return res.json({ id, entUsername: user.ent_username });
};

const commit = async (req, res) => {
  const username = req.session.user.userName;
  const migration = req.session.entBrowserPasswordMigration;
  if (!migration || migration.username !== username ||
      migration.expiresAt <= Date.now() || req.body?.id !== migration.id) {
    return error(res, 403, "ENT_MIGRATION_CONFIRMATION_REQUIRED");
  }
  const { data: user, error: lookupError } = await loginService.getUser(username);
  if (lookupError) return error(res, 503, "ENT_MIGRATION_UNAVAILABLE");
  if (user?.ent_username !== migration.entUsername) {
    return error(res, 409, "ENT_MIGRATION_CHANGED");
  }
  if (user.ent_password_storage === "browser") {
    return user.ent_password_migration_id === migration.id
      ? res.sendStatus(204)
      : error(res, 409, "ENT_MIGRATION_CHANGED");
  }
  const ciphertext = await ZimbraService.getStoredPassword(migration.entUsername);
  if (digest(ciphertext) !== migration.ciphertextHash) {
    return error(res, 409, "ENT_MIGRATION_CHANGED");
  }
  const result = await supabase.rpc("migrate_ent_v2_to_browser", {
    account_name: username,
    ent_name: migration.entUsername,
    expected_password: ciphertext,
    migration_id: migration.id,
  });
  if (result.error) return error(res, 503, "ENT_MIGRATION_UNAVAILABLE");
  if (!result.data) return error(res, 409, "ENT_MIGRATION_CHANGED");
  delete req.session.zimbraToken;
  req.session.user.ent_password_storage = "browser";
  return res.sendStatus(204);
};

module.exports = { prepare, commit };
