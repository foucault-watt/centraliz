const { test } = require('node:test');
const assert = require('node:assert/strict');
const vault = require('../mcp/clientVault.cjs');
const { createUserSecretSalt } = require('../utils/userSecret');
let rows = [], beforeWrite;
const fakeDb = { from(table) {
  assert.equal(table, 'passwords');
  const filters = []; let values, operation = 'read';
  const query = {
    select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
    update(value) { operation = 'update'; values = value; return query; },
    insert(value) { operation = 'insert'; values = value; return query; },
    maybeSingle() { return query.execute(true); }, single() { return query.execute(true); },
    execute(single = false) {
      if (operation !== 'read' && beforeWrite) { const action = beforeWrite; beforeWrite = null; action(); }
      let found = rows.filter(row => filters.every(([key, value]) => row[key] === value));
      if (operation === 'update') found.forEach(row => Object.assign(row, values));
      if (operation === 'insert') {
        if (rows.some(row => row.ent_username === values.ent_username)) return Promise.resolve({ data: null, error: { code: '23505' } });
        rows.push(values); found = [values];
      }
      return Promise.resolve({ data: single ? found[0] || null : found, error: null });
    },
    then(resolve, reject) { return query.execute().then(resolve, reject); },
  };
  return query;
} };
const clientPath = require.resolve('../utils/supabaseClient');
const original = require.cache[clientPath];
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: fakeDb };
const service = require('./zimbraService');
if (original) require.cache[clientPath] = original; else delete require.cache[clientPath];

test('existing ENT credential migrates in place; server-derived key no longer decrypts and old devices cannot downgrade it', async t => {
  const oldSecret = process.env.SECRET_KEY_CENTRALIZ;
  process.env.SECRET_KEY_CENTRALIZ = 'test-master-key';
  const originalGetEnt = service.getEntUsername;
  service.getEntUsername = async () => 'ent-alice';
  t.after(() => { service.getEntUsername = originalGetEnt; if (oldSecret === undefined) delete process.env.SECRET_KEY_CENTRALIZ; else process.env.SECRET_KEY_CENTRALIZ = oldSecret; });
  const oldKey = createUserSecretSalt('alice'), key = vault.randomSecret();
  const old = service.encryptPassword({ entUsername: 'ent-alice', password: 'ENT-private', userKey: oldKey });
  rows = [{ ent_username: 'ent-alice', encrypted_password: old }];
  const principal = await service.enableClientKey('alice', oldKey, key);
  assert.deepEqual(principal, { username: 'alice', userKey: key });
  assert(rows[0].encrypted_password.startsWith('v3:'));
  assert(!JSON.stringify(rows).includes(old));
  assert.deepEqual(await service.getClientKeyHint('alice'), { userKeyMode: 'client' });
  assert.equal((await service.resolveStoredCredentials('alice', key)).password, 'ENT-private');
  await assert.rejects(service.resolveStoredCredentials('alice', oldKey), { code: 'USER_KEY_INVALID' });
  await assert.rejects(service.storeEncryptedPassword('ent-alice', 'replacement', oldKey), { code: 'USER_KEY_INVALID' });
  assert.deepEqual(await service.enableClientKey('alice', key, vault.randomSecret()), principal);
  await service.storeEncryptedPassword('ent-alice', 'updated-ENT-password', key);
  assert.equal((await service.resolveStoredCredentials('alice', key)).password, 'updated-ENT-password');
});

test('concurrent legacy password writes cannot overwrite a newly migrated key', async t => {
  const oldSecret = process.env.SECRET_KEY_CENTRALIZ;
  process.env.SECRET_KEY_CENTRALIZ = 'test-master-key';
  t.after(() => { if (oldSecret === undefined) delete process.env.SECRET_KEY_CENTRALIZ; else process.env.SECRET_KEY_CENTRALIZ = oldSecret; });
  const oldKey = createUserSecretSalt('alice'), key = vault.randomSecret();
  rows = [{ ent_username: 'ent-alice', encrypted_password: service.encryptPassword({ entUsername: 'ent-alice', password: 'old', userKey: oldKey }) }];
  const migrated = vault.encryptEntPassword('ent-alice', 'new', key);
  beforeWrite = () => { rows[0].encrypted_password = migrated; };
  await assert.rejects(service.storeEncryptedPassword('ent-alice', 'stale', oldKey), { statusCode: 409 });
  assert.equal(rows[0].encrypted_password, migrated);
});
