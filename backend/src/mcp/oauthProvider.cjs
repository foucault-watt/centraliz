const { randomUUID } = require('node:crypto');
const { InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const { randomSecret, fingerprint, validSecret, seal, unseal } = require('./clientVault.cjs');
const SCOPE = 'moodle:read';
const ACCESS_MS = 10 * 60 * 1000, GRANT_MS = 90 * 86400000, CODE_MS = 120000;
const contextFor = record => JSON.stringify(['centraliz:mcp:v1', record.kind, record.id, record.clientId, record.grantId, record.expires, record.resource, record.redirectUri || '', record.challenge || '']);

function createOAuthProvider({ store, resource, redirectUris, clock = Date.now, onAuthorize, onRevoke = () => {} }) {
  const allowed = new Set(redirectUris);
  const invalid = () => new InvalidGrantError('Autorisation invalide ou expirée. Reconnectez le MCP.');
  const requireResource = value => { if (value && String(value) !== resource) throw new InvalidTargetError('Ressource MCP incorrecte.'); };
  const requireScope = scopes => { if (scopes?.some(scope => scope !== SCOPE)) throw new InvalidScopeError('Seule la lecture Moodle est autorisée.'); };
  function revoke(state, grantId) {
    if (state.grants[grantId]) state.grants[grantId].revoked = true;
    for (const [id, record] of Object.entries(state.records)) if (record.grantId === grantId) delete state.records[id];
  }
  function prune(state) {
    for (const [id, record] of Object.entries(state.records)) if (record.expires <= clock()) delete state.records[id];
    for (const [id, grant] of Object.entries(state.grants)) if (grant.expires <= clock()) delete state.grants[id];
  }
  function recordFor(state, kind, secret, meta, principal, expires) {
    const id = fingerprint(secret);
    const record = { id, kind, ...meta, resource, expires };
    record.envelope = seal(secret, principal, contextFor(record));
    state.records[id] = record;
  }
  function getRecord(state, secret, kind, clientId) {
    if (!validSecret(secret)) throw invalid();
    const record = state.records[fingerprint(secret)];
    if (!record || record.kind !== kind || (clientId && record.clientId !== clientId) || record.expires <= clock()) throw invalid();
    const grant = state.grants[record.grantId];
    if (!grant || grant.revoked || grant.expires <= clock()) throw invalid();
    return record;
  }
  function unlock(record, secret) {
    try { return unseal(secret, record.envelope, contextFor(record)); }
    catch { throw invalid(); }
  }
  function issueTokens(state, record, principal) {
    const access = randomSecret(), refresh = randomSecret();
    const meta = { clientId: record.clientId, grantId: record.grantId };
    recordFor(state, 'access', access, meta, principal, Math.min(clock() + ACCESS_MS, state.grants[record.grantId].expires));
    recordFor(state, 'refresh', refresh, meta, principal, state.grants[record.grantId].expires);
    return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: Math.floor(Math.min(ACCESS_MS, state.grants[record.grantId].expires - clock()) / 1000), scope: SCOPE };
  }
  const provider = {
    rememberConsent(csrf, clientId, params) {
      store.transaction(state => {
        prune(state);
        state.records[fingerprint(csrf)] = { kind: 'consent', clientId, paramsHash: fingerprint(JSON.stringify(params)), expires: clock() + 10 * 60000 };
      });
    },
    consumeConsent(csrf, clientId, params) {
      store.transaction(state => {
        const id = fingerprint(csrf), consent = state.records[id];
        if (!consent || consent.kind !== 'consent' || consent.clientId !== clientId || consent.expires <= clock() || consent.paramsHash !== fingerprint(JSON.stringify(params))) throw invalid();
        delete state.records[id];
      });
    },
    clientsStore: {
      getClient: id => { const clients = store.read().clients; return Object.hasOwn(clients, id) ? clients[id] : undefined; },
      registerClient(client) {
        if (client.token_endpoint_auth_method !== 'none' || client.client_secret || !client.redirect_uris?.length || client.redirect_uris.length > 8
          || client.redirect_uris.some(uri => !allowed.has(uri))) throw new InvalidClientMetadataError('Client public PKCE et URL de retour préautorisée requis.');
        const value = { client_id: randomUUID(), client_id_issued_at: Math.floor(clock() / 1000),
          client_name: String(client.client_name || 'Assistant MCP').slice(0, 100), redirect_uris: client.redirect_uris,
          token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: SCOPE };
        store.transaction(state => {
          prune(state);
          if (Object.keys(state.clients).length >= 500) throw new InvalidClientMetadataError('Limite de clients atteinte.');
          state.clients[value.client_id] = value;
        });
        return value;
      },
    },
    async authorize(client, params, res) {
      requireResource(params.resource); requireScope(params.scopes);
      if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge) || !allowed.has(params.redirectUri)) throw invalid();
      await onAuthorize(client, { ...params, resource: resource, scopes: [SCOPE] }, res);
    },
    issueCode(principal, client, params) {
      requireResource(params.resource); requireScope(params.scopes);
      if (!allowed.has(params.redirectUri) || !/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge) || !validSecret(principal.userKey)) throw invalid();
      const code = randomSecret();
      store.transaction(state => {
        prune(state);
        const grantId = randomUUID();
        state.profiles ||= {};
        const profileKey = fingerprint(principal.username);
        state.profiles[profileKey] ||= randomUUID();
        state.grants[grantId] = { username: principal.username, clientId: client.client_id, created: clock(), expires: clock() + GRANT_MS, revoked: false };
        recordFor(state, 'code', code, { grantId, clientId: client.client_id, challenge: params.codeChallenge, redirectUri: params.redirectUri }, { ...principal, profileId: state.profiles[profileKey] }, clock() + CODE_MS);
      });
      return code;
    },
    async challengeForAuthorizationCode(client, code) { return getRecord(store.read(), code, 'code', client.client_id).challenge; },
    async exchangeAuthorizationCode(client, code, _verifier, redirectUri, target) {
      requireResource(target);
      return store.transaction(state => {
        prune(state);
        const record = getRecord(state, code, 'code', client.client_id);
        if (record.redirectUri !== redirectUri) throw invalid();
        const principal = unlock(record, code);
        delete state.records[record.id];
        return issueTokens(state, record, principal);
      });
    },
    async exchangeRefreshToken(client, refresh, scopes, target) {
      requireResource(target); requireScope(scopes);
      let replayed = false;
      const result = store.transaction(state => {
        prune(state);
        const record = getRecord(state, refresh, 'refresh', client.client_id);
        if (record.spent) { revoke(state, record.grantId); replayed = true; return null; }
        const principal = unlock(record, refresh);
        // Retain only a fingerprint tombstone to detect refresh-token reuse.
        delete record.envelope; record.spent = true;
        return issueTokens(state, record, principal);
      });
      if (replayed) { onRevoke(); throw invalid(); }
      return result;
    },
    async verifyAccessToken(token) {
      try {
        const record = getRecord(store.read(), token, 'access');
        const { profileId, ...principal } = unlock(record, token);
        return { token, clientId: record.clientId, scopes: [SCOPE], expiresAt: record.expires / 1000,
          resource: new URL(resource), extra: { principal, profileId } };
      } catch { throw new InvalidTokenError('Autorisation MCP invalide ou expirée.'); }
    },
    async revokeToken(client, request) {
      if (!validSecret(request.token)) return;
      let changed = false;
      store.transaction(state => {
        const record = state.records[fingerprint(request.token)];
        if (record?.clientId === client.client_id) { revoke(state, record.grantId); changed = true; }
      });
      if (changed) onRevoke();
    },
    listGrants(username) {
      const state = store.read();
      return Object.entries(state.grants).filter(([, g]) => g.username === username && !g.revoked && g.expires > clock())
        .map(([id, g]) => ({ id, clientName: state.clients[g.clientId]?.client_name || 'Assistant MCP', created: g.created, expires: g.expires }));
    },
    revokeGrant(username, id) {
      store.transaction(state => { if (state.grants[id]?.username === username) revoke(state, id); });
      onRevoke();
    },
  };
  return provider;
}
module.exports = { createOAuthProvider, SCOPE, ACCESS_MS, GRANT_MS };
