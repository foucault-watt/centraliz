const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createRemoteMcpRouter, remoteConfig, BASE } = require('./remoteHttp.cjs');
const { createOAuthProvider, ACCESS_MS } = require('./oauthProvider.cjs');
const { createOAuthStore } = require('./oauthStore.cjs');
const vault = require('./clientVault.cjs');
const resource = 'https://centraliz.test/api/mcp', callback = 'https://assistant.test/callback';

test('real HTTP OAuth PKCE -> MCP original file -> rotated refresh -> revocation; disk cannot unlock accounts', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'centraliz-mcp-'));
  const storeFile = path.join(temp, 'store.json');
  const key = vault.randomSecret(), verifier = vault.randomSecret(), password = 'ENT-secret-never-persist';
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  let protectedKey = false, encrypted = 'legacy-record';
  const calls = [], bytes = Buffer.from('%PDF-original\0\xff', 'latin1');
  const app = express();
  app.use(session({ secret: 'test-only-cookie-secret', resave: false, saveUninitialized: false }));
  app.use(express.json());
  // Test-only sign-in seam; production uses the existing Centraliz session.
  app.use((req, res, next) => { if (req.get('x-test-user')) req.session.user = { userName: req.get('x-test-user') }; next(); });
  const credentialsService = {
    getClientKeyHint: async () => protectedKey ? { userKeyMode: 'client' } : { userKeyMode: 'legacy', userSecretSalt: 'old-key' },
    enableClientKey: async (username, old, candidate) => {
      assert.equal(username, 'alice'); assert.equal(old, 'old-key'); assert.equal(candidate, key);
      encrypted = vault.encryptEntPassword('ent-alice', password, key); protectedKey = true;
      return { username, userKey: key };
    },
  };
  const moodleService = {
    listCourses: async (...args) => { calls.push(args); return [{ id: 12 }]; },
    downloadFile: async (...args) => { calls.push(args); return { name: 'cours.pdf', mimeType: 'application/pdf', size: bytes.length, blob: bytes.toString('base64') }; },
    close() {},
  };
  const remote = createRemoteMcpRouter({ publicUrl: resource, redirectUris: [callback], storeFile, credentialsService, moodleService });
  app.use(remote.router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let client;
  t.after(async () => { await client?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true }); });
  const post = (route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), redirect: 'manual' });
  const token = body => fetch(base + BASE + '/token', { method: 'POST', body: new URLSearchParams(body) });
  const registration = await post(BASE + '/register', { client_name: 'Test assistant', redirect_uris: [callback], token_endpoint_auth_method: 'none' });
  assert.equal(registration.status, 201, await registration.clone().text());
  const registered = await registration.json();
  assert.equal(registered.client_secret, undefined);
  assert.equal((await post(BASE + '/register', { redirect_uris: ['https://evil.test/cb'], token_endpoint_auth_method: 'none' })).status, 400);
  const denied = await fetch(base + '/api/mcp', { method: 'POST' });
  assert.equal(denied.status, 401); assert(denied.headers.get('www-authenticate').includes('/.well-known/oauth-protected-resource/api/mcp'));
  const prm = await (await fetch(base + '/.well-known/oauth-protected-resource/api/mcp')).json();
  assert.equal(prm.resource, resource);
  const discover = await (await fetch(base + '/.well-known/oauth-authorization-server' + BASE)).json();
  assert.equal(discover.issuer, 'https://centraliz.test' + BASE);
  const authQuery = new URLSearchParams({ client_id: registered.client_id, response_type: 'code', redirect_uri: callback,
    code_challenge: challenge, code_challenge_method: 'S256', scope: 'moodle:read', resource, state: 'state-123' });
  const begin = await fetch(base + BASE + '/authorize?' + authQuery, { headers: { 'x-test-user': 'alice' }, redirect: 'manual' });
  assert.equal(begin.status, 302);
  const cookie = begin.headers.get('set-cookie').split(';')[0];
  const page = await fetch(base + BASE + '/consent', { headers: { cookie } });
  assert.equal(page.status, 200);
  assert(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const html = await page.text(), csrf = html.match(/"csrf":"([^"]+)"/)[1];
  assert(!html.includes('old-key'));
  assert.equal((await post(BASE + '/consent/approve', { csrf, candidateKey: key }, { cookie, origin: 'https://evil.test' })).status, 403);
  const approve = await post(BASE + '/consent/approve', { csrf, candidateKey: key }, { cookie, origin: 'https://centraliz.test' });
  assert.equal(approve.status, 200, await approve.clone().text());
  const redirect = new URL((await approve.json()).redirect), code = redirect.searchParams.get('code');
  assert.equal(redirect.origin, 'https://assistant.test'); assert.equal(redirect.searchParams.get('state'), 'state-123');
  const args = { client_id: registered.client_id, grant_type: 'authorization_code', redirect_uri: callback, resource, code };
  assert.equal((await token({ ...args, code_verifier: vault.randomSecret() })).status, 400);
  assert.equal((await token({ ...args, code_verifier: verifier, redirect_uri: 'https://evil.test/cb' })).status, 400);
  const exchange = await token({ ...args, code_verifier: verifier });
  assert.equal(exchange.status, 200, await exchange.clone().text());
  const tokens = await exchange.json();
  const restored = createOAuthProvider({ store: createOAuthStore(storeFile), resource, redirectUris: [callback], onAuthorize() {} });
  assert.equal((await restored.verifyAccessToken(tokens.access_token)).extra.principal.userKey, key);
  assert.equal((await token({ ...args, code_verifier: verifier })).status, 400);
  client = new Client({ name: 'test-client', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/api/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + tokens.access_token } } }));
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 5);
  assert.equal(tools.find(tool => tool.name === 'whoami')._meta['openai/profile'], true);
  const profile = (await client.callTool({ name: 'whoami', arguments: {} })).structuredContent;
  assert(profile.id); assert(!profile.id.includes('alice'));
  await client.callTool({ name: 'lister_mes_cours', arguments: { username: 'bob' } });
  assert.deepEqual(calls.at(-1), ['alice', key]);
  const file = await client.callTool({ name: 'recuperer_fichier', arguments: { courseId: 12, moduleId: 7 } });
  assert.deepEqual(Buffer.from(file.content.find(c => c.type === 'resource').resource.blob, 'base64'), bytes);
  await client.close(); client = null;
  const refreshArgs = { grant_type: 'refresh_token', client_id: registered.client_id, refresh_token: tokens.refresh_token, resource };
  assert.equal((await token({ ...refreshArgs, resource: 'https://evil.test/mcp' })).status, 400);
  const renewed = await token(refreshArgs); assert.equal(renewed.status, 200);
  const next = await renewed.json(); assert.notEqual(next.refresh_token, tokens.refresh_token);
  assert.equal((await remote.provider.verifyAccessToken(next.access_token)).extra.profileId, profile.id);
  assert.equal((await token(refreshArgs)).status, 400); // Replay revokes the whole grant.
  assert.equal((await fetch(base + '/api/mcp', { headers: { authorization: 'Bearer ' + next.access_token } })).status, 401);
  // Verify the actual SDK revocation endpoint, not just the provider method.
  const anotherCode = remote.provider.issueCode({ username: 'alice', userKey: key }, registered,
    { redirectUri: callback, codeChallenge: challenge, resource, scopes: ['moodle:read'] });
  const another = await (await token({ ...args, code: anotherCode, code_verifier: verifier })).json();
  const revoked = await fetch(base + BASE + '/revoke', { method: 'POST', body: new URLSearchParams({ client_id: registered.client_id, token: another.refresh_token }) });
  assert.equal(revoked.status, 200);
  await assert.rejects(remote.provider.verifyAccessToken(another.access_token));
  const disk = fs.readFileSync(storeFile, 'utf8');
  for (const secret of [key, password, verifier, code, tokens.access_token, tokens.refresh_token, next.access_token, next.refresh_token]) assert(!disk.includes(secret));
  assert.equal(vault.decryptEntPassword('ent-alice', encrypted, key), password);
  assert.throws(() => vault.decryptEntPassword('ent-alice', encrypted, vault.randomSecret()));
});

test('token envelopes persist across restart, bind identity and expire; revocation is owner-scoped', async () => {
  let now = 100000;
  const store = createOAuthStore();
  const create = () => createOAuthProvider({ store, resource, redirectUris: [callback], clock: () => now, onAuthorize() {} });
  let provider = create();
  const client = await provider.clientsStore.registerClient({ token_endpoint_auth_method: 'none', redirect_uris: [callback] });
  const principal = { username: 'alice', userKey: vault.randomSecret() };
  const params = { redirectUri: callback, codeChallenge: vault.randomSecret(), resource, scopes: ['moodle:read'] };
  const code = provider.issueCode(principal, client, params);
  const tokens = await provider.exchangeAuthorizationCode(client, code, undefined, callback, new URL(resource));
  provider = create();
  assert.deepEqual((await provider.verifyAccessToken(tokens.access_token)).extra.principal, principal);
  const [grant] = provider.listGrants('alice');
  provider.revokeGrant('bob', grant.id);
  await provider.verifyAccessToken(tokens.access_token);
  now += ACCESS_MS;
  await assert.rejects(provider.verifyAccessToken(tokens.access_token));
  const next = await provider.exchangeRefreshToken(client, tokens.refresh_token, undefined, new URL(resource));
  provider.revokeGrant('alice', grant.id);
  await assert.rejects(provider.verifyAccessToken(next.access_token));
  await assert.rejects(provider.exchangeRefreshToken(client, next.refresh_token));
  assert.equal(provider.listGrants('alice').length, 0);
});

test('AEAD binds envelopes to the account and token record; server master secret cannot unlock v3', () => {
  const key = vault.randomSecret(), enc = vault.encryptEntPassword('alice', 'private-password', key);
  assert.throws(() => vault.decryptEntPassword('bob', enc, key));
  const serverDerived = crypto.createHmac('sha256', 'server-master-key').update('alice').digest('hex');
  assert.throws(() => vault.decryptEntPassword('alice', enc, serverDerived));
  const envelope = vault.seal(key, { userKey: key }, 'access:client:grant:resource');
  assert.throws(() => vault.unseal(key, envelope, 'access:other-client:grant:resource'));
  const [iv, tag, bytes] = envelope.split('.');
  assert.throws(() => vault.unseal(key, [iv, Buffer.from(tag, 'base64url').subarray(0, 4).toString('base64url'), bytes].join('.'), 'access:client:grant:resource'));
});

test('consent is single-use even with parallel request-session copies', () => {
  const store = createOAuthStore(), provider = createOAuthProvider({ store, resource, redirectUris: [callback], onAuthorize() {} });
  const csrf = vault.randomSecret(), params = { redirectUri: callback };
  provider.rememberConsent(csrf, 'client', params);
  provider.consumeConsent(csrf, 'client', structuredClone(params));
  assert.throws(() => provider.consumeConsent(csrf, 'client', structuredClone(params)));
});

test('remote feature is off by default and rejects insecure public configuration', () => {
  assert.equal(remoteConfig({}), null);
  assert.deepEqual(remoteConfig({ MCP_REMOTE_ENABLED: 'true', MCP_PUBLIC_URL: resource, MCP_REDIRECT_URIS: '[]' }).redirectUris, []);
  assert.throws(() => remoteConfig({ MCP_REMOTE_ENABLED: 'true', MCP_PUBLIC_URL: 'http://centraliz.test/api/mcp' }));
  assert.throws(() => remoteConfig({ MCP_REMOTE_ENABLED: 'true', MCP_PUBLIC_URL: resource, MCP_REDIRECT_URIS: '["https://user:pass@evil.test/"]' }));
  assert.deepEqual(remoteConfig({ MCP_REMOTE_ENABLED: 'true', MCP_PUBLIC_URL: resource, MCP_REDIRECT_URIS: JSON.stringify([callback]) }), { publicUrl: resource, redirectUris: [callback] });
});

test('discovery-only mode cannot register or authorize any client before callbacks are configured', async () => {
  const provider = createOAuthProvider({ store: createOAuthStore(), resource, redirectUris: [], onAuthorize: () => assert.fail('no authorization without allowed callback') });
  assert.throws(() => provider.clientsStore.registerClient({ redirect_uris: [callback], token_endpoint_auth_method: 'none' }));
  await assert.rejects(provider.authorize({ client_id: 'client' }, { redirectUri: callback, codeChallenge: vault.randomSecret() }));
});
