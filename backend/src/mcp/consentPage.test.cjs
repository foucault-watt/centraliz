const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { consentPage, keyBackupControls } = require('./consentPage.cjs');
const { randomSecret } = require('./clientVault.cjs');

test('browser saves the new key before migration, keeps it on lost response, and recovers it on retry', async () => {
  const data = new Map(); let submitted;
  async function run(protectedKey, response) {
    const elements = Object.fromEntries(['connect', 'key', 'keyLabel', 'agree', 'status'].map(id => [id, { value: '', hidden: false }]));
    const html = consentPage({ username: 'alice', clientName: '<script>evil</script>', csrf: 'csrf', nonce: 'nonce', protectedKey, pageUrl: 'https://centraliz.test/api/mcp/oauth/consent' });
    assert(!html.includes('<script>evil</script>'));
    const script = html.match(/<script nonce="nonce">([\s\S]*)<\/script>/)[1];
    const context = { document: { getElementById: id => elements[id] },
      localStorage: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) },
      crypto: webcrypto, Uint8Array, btoa: text => Buffer.from(text, 'binary').toString('base64'),
      location: { assign(url) { context.redirect = url; } },
      fetch: async (url, options) => {
        submitted = JSON.parse(options.body);
        assert.equal(data.get('centraliz.entKeyPending:alice'), submitted.candidateKey);
        return response();
      },
    };
    vm.runInNewContext(script, context);
    await elements.connect.onclick();
    return context;
  }
  await run(false, () => { throw Error('Response lost after migration'); });
  const saved = data.get('centraliz.entKeyPending:alice');
  assert(saved);
  const recovered = await run(true, () => ({ ok: true, json: async () => ({ redirect: 'https://assistant.test/cb?code=example' }) }));
  assert.equal(submitted.currentKey, saved);
  assert.equal(data.get('centraliz.entKey:alice'), saved);
  assert.equal(data.get('centraliz.entKeyPending:alice'), undefined);
  assert.equal(recovered.redirect, 'https://assistant.test/cb?code=example');
});

test('backup and restore stay in the browser and produce a key file usable by the local MCP', async () => {
  const key = randomSecret(), data = new Map([['centraliz.entKey:alice', key]]), elements = { backup: {}, restore: {}, backupStatus: {} };
  let exported;
  const html = keyBackupControls('alice', 'nonce'), script = html.match(/<script nonce="nonce">([\s\S]*)<\/script>/)[1];
  vm.runInNewContext(script, {
    document: { getElementById: id => elements[id], createElement: () => ({ click() {} }) },
    localStorage: { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) },
    Blob: class { constructor(parts) { exported = parts.join(''); } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout: fn => fn(),
  });
  elements.backup.onclick();
  assert.equal(exported.trim(), key);
  data.clear();
  await elements.restore.onchange({ target: { files: [{ size: exported.length, text: async () => exported }] } });
  assert.equal(data.get('centraliz.entKey:alice'), key);
  assert.equal(data.get('centraliz.userSecretSalt'), key);
});
