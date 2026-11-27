const { test } = require('node:test');
const assert = require('node:assert/strict');
const { restartConfig, restartAndWait } = require('./deploy-restart.cjs');

const config = restartConfig({ DEPLOY_BACKEND_URL: 'https://example.test', SECRET_API: 'private-secret' });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test('one crash request followed by health checks confirms a changed boot identifier', async () => {
  const calls = [], logs = []; let tick = 0, checks = 0;
  const result = await restartAndWait(config, {
    fetchImpl: async url => {
      calls.push(url);
      if (url === config.restartUrl) return response({ bootId: 'old' }, 202);
      return response({ bootId: ++checks >= 3 ? 'new' : 'old' });
    }, sleep: async () => { tick += 1000; }, now: () => tick, log: line => logs.push(line),
  });
  assert.equal(result.verified, true);
  assert.equal(calls.filter(url => url === config.restartUrl).length, 1);
  assert(!logs.join('\n').includes('private-secret'));
});

test('a connection reset from the legacy crash route is never retried', async () => {
  let crashes = 0, health = 0, tick = 0;
  const result = await restartAndWait(config, {
    fetchImpl: async url => {
      if (url === config.restartUrl) { crashes++; throw new Error('sensitive URL details'); }
      return ++health === 1 ? response(null, 404) : response({ bootId: 'new' });
    }, sleep: async () => { tick += 1000; }, now: () => tick,
  });
  assert.equal(result.verified, true); assert.equal(crashes, 1);
});

test('an unchanged healthy process is not mistaken for a successful restart', async () => {
  let crashes = 0, tick = 0;
  await assert.rejects(restartAndWait(config, {
    fetchImpl: async url => { if (url === config.restartUrl) crashes++; return response({ bootId: 'same' }); },
    sleep: async () => { tick += 1000; }, now: () => tick, timeoutMs: 3000,
  }), /non confirmé/);
  assert.equal(crashes, 1);
});

test('a refused restart fails without disclosing the URL or secret', async () => {
  await assert.rejects(restartAndWait(config, {
    fetchImpl: async url => response({}, url === config.restartUrl ? 403 : 200),
  }), error => !error.message.includes('private-secret') && /refusé/.test(error.message));
  assert.throws(() => restartConfig({ DEPLOY_BACKEND_URL: 'http://example.test', SECRET_API: 'secret' }));
  assert.throws(() => restartConfig({ DEPLOY_BACKEND_URL: 'https://example.test' }));
  assert.throws(() => restartConfig({ DEPLOY_BACKEND_URL: 'https://centraliz..it', SECRET_API: 'secret' }), /nom d’hôte invalide/);
  assert.throws(() => restartConfig({ DEPLOY_BACKEND_URL: 'https://example.test/api/secret/crash', SECRET_API: 'secret' }), /URL de base/);
});

test('a gateway error from the exiting legacy backend still verifies recovery without retrying crash', async () => {
  let crashes = 0, checks = 0, tick = 0;
  const result = await restartAndWait(config, {
    fetchImpl: async url => {
      if (url === config.restartUrl) { crashes++; return response({}, 502); }
      return ++checks === 1 ? response({}, 404) : response({ bootId: 'new' });
    }, sleep: async () => { tick += 1000; }, now: () => tick,
  });
  assert.equal(result.verified, true); assert.equal(crashes, 1);
});

test('DNS failure is reported immediately and never attempts a crash', async () => {
  let calls = 0;
  await assert.rejects(restartAndWait(config, {
    fetchImpl: async url => {
      calls++; assert.equal(url, config.healthUrl);
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }, sleep: () => assert.fail('must not wait for a DNS failure'),
  }), /DNS.*Aucune demande de crash/);
  assert.equal(calls, 1);
});
