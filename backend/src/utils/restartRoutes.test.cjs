const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installRestartRoutes, skipSensitiveRequest } = require('./restartRoutes');

test('the URL route responds before exit and does not require a user session', () => {
  const routes = new Map(), exits = [], pending = [];
  const app = { get: (path, handler) => routes.set(path, handler), use: (path, handler) => routes.set(path, handler) };
  installRestartRoutes(app, { secret: 'test-secret', bootId: 'boot', exit: code => exits.push(code), schedule: callback => pending.push(callback) });
  const res = new EventEmitter(); res.set = () => res; res.status = code => { res.code = code; return res; }; res.json = body => { res.body = body; };
  routes.get('/api/test-secret/crash')({}, res);
  assert.equal(res.code, 202); assert.equal(res.body.bootId, 'boot'); assert.equal(exits.length, 0);
  res.emit('finish'); assert.equal(pending.length, 1); pending[0](); assert.deepEqual(exits, [1]);
});

test('missing secrets do not create a guessable crash URL', () => {
  const app = { get() {}, use: () => assert.fail('no crash route without secret') };
  installRestartRoutes(app);
});

test('URLs and referrers containing the secret are not recorded by HTTP logging', () => {
  assert.equal(skipSensitiveRequest({ url: '/api/private-secret/crash' }, 'private-secret'), true);
  assert.equal(skipSensitiveRequest({ url: '/other', headers: { referer: 'https://example.test/api/private-secret/crash' } }, 'private-secret'), true);
  assert.equal(skipSensitiveRequest({ url: '/api/moodle' }, 'private-secret'), false);
  assert.equal(skipSensitiveRequest({ url: '/api/mcp/oauth/authorize?code=private-code' }), true);
  assert.equal(skipSensitiveRequest({ url: '/other', headers: { referer: 'https://centraliz.test/api/mcp/oauth/consent?code=private-code' } }), true);
  assert.equal(skipSensitiveRequest({ url: '/api/mcp', headers: { authorization: 'Bearer private-token' } }), true);
});
