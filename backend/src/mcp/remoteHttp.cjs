const express = require('express');
const { randomSecret } = require('./clientVault.cjs');
const { createOAuthProvider, SCOPE } = require('./oauthProvider.cjs');
const { createOAuthStore } = require('./oauthStore.cjs');
const { consentPage, escape, keyBackupControls } = require('./consentPage.cjs');
const { authorizationHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/authorize.js');
const { tokenHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/token.js');
const { revocationHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/revoke.js');
const { clientRegistrationHandler } = require('@modelcontextprotocol/sdk/server/auth/handlers/register.js');
const { mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const { requireBearerAuth } = require('@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMoodleMcpServer } = require('./moodleServer.cjs');
const BASE = '/api/mcp/oauth';

function remoteConfig(env) {
  if (env.MCP_REMOTE_ENABLED !== 'true') return null;
  const resource = new URL(env.MCP_PUBLIC_URL);
  if (resource.protocol !== 'https:' || resource.pathname !== '/api/mcp' || resource.search || resource.hash || resource.username || resource.password) throw new Error('MCP_PUBLIC_URL doit être https://votre-domaine/api/mcp');
  if (env.URL_FRONT && new URL(env.URL_FRONT).origin !== resource.origin) throw new Error('Le MCP et le frontend doivent partager la même origine publique pour la clé locale');
  const redirectUris = JSON.parse(env.MCP_REDIRECT_URIS || '[]');
  if (!Array.isArray(redirectUris) || redirectUris.some(uri => {
    try { const u = new URL(uri); return u.protocol !== 'https:' || !!u.hash || !!u.username || !!u.password; } catch { return true; }
  })) throw new Error('MCP_REDIRECT_URIS doit être un tableau d’URLs HTTPS exactes de retour OAuth');
  return { publicUrl: resource.href, redirectUris };
}

function createRemoteMcpRouter({ publicUrl, redirectUris, storeFile, store = createOAuthStore(storeFile), credentialsService, moodleService }) {
  const router = express.Router();
  const resource = new URL(publicUrl), origin = resource.origin, issuer = origin + BASE, pageUrl = issuer + '/consent';
  function privatePage(req, res, next) {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
    next();
  }
  router.use([BASE, resource.pathname], privatePage);
  // OAuth and MCP are not cookie-authorized API calls. Browser origins are limited.
  router.use(resource.pathname, (req, res, next) => {
    if (req.headers.origin && req.headers.origin !== origin) return res.sendStatus(403);
    next();
  });
  const provider = createOAuthProvider({ store, resource: resource.href, redirectUris,
    onRevoke: () => moodleService.close?.(),
    onAuthorize: async (client, params, res) => {
      const req = res.req;
      const csrf = randomSecret();
      provider.rememberConsent(csrf, client.client_id, params);
      req.session.mcpConsent = { clientId: client.client_id, params, csrf, expires: Date.now() + 10 * 60000 };
      res.redirect(pageUrl);
    },
  });
  const endpointLimit = { validate: { trustProxy: false } };
  router.use(BASE + '/authorize', authorizationHandler({ provider, rateLimit: endpointLimit }));
  router.use(BASE + '/token', tokenHandler({ provider, rateLimit: endpointLimit }));
  router.use(BASE + '/register', clientRegistrationHandler({ clientsStore: provider.clientsStore, rateLimit: endpointLimit }));
  router.use(BASE + '/revoke', revocationHandler({ provider, rateLimit: endpointLimit }));
  const metadata = { issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token', registration_endpoint: issuer + '/register',
    revocation_endpoint: issuer + '/revoke', response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], revocation_endpoint_auth_methods_supported: ['none'], scopes_supported: [SCOPE] };
  router.use(mcpAuthMetadataRouter({ oauthMetadata: metadata, resourceServerUrl: resource, scopesSupported: [SCOPE], resourceName: 'Centraliz Moodle' }));
  // Path-based issuer discovery, plus fallback for clients using OIDC-style discovery.
  router.get(['/.well-known/oauth-authorization-server' + BASE, BASE + '/.well-known/oauth-authorization-server'], (req, res) => res.set('Cache-Control', 'no-store').json(metadata));
  router.get(resource.pathname + '/metadata', (req, res) => res.json({ resource: resource.href, authorization_servers: [issuer], scopes_supported: [SCOPE] }));

  function signedIn(req, res, next) {
    if (req.session?.user?.userName) return next();
    res.status(401).set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
      .type('html').send('<!doctype html><html lang="fr"><meta charset="utf-8"><title>Connexion Centraliz</title><p>Connectez-vous à Centraliz dans le nouvel onglet, puis revenez ici.</p><a href="/api/auth/login" target="_blank" rel="noopener noreferrer">Se connecter à Centraliz</a><p><a href="">Continuer après connexion</a></p></html>');
  }
  function requireConsent(req, res, next) {
    const consent = req.session?.mcpConsent;
    if (!consent || consent.expires <= Date.now()) return res.status(400).json({ error: 'Connexion expirée. Relancez la connexion depuis votre assistant.' });
    next();
  }
  function browserPost(req, res, next) {
    if (req.get('origin') !== origin || !req.body?.csrf || req.body.csrf !== req.session?.mcpConsent?.csrf) return res.sendStatus(403);
    next();
  }
  router.get(BASE + '/consent', signedIn, requireConsent, async (req, res) => {
    try {
      const username = req.session.user.userName, client = await provider.clientsStore.getClient(req.session.mcpConsent.clientId);
      if (!client) return res.sendStatus(400);
      const hint = await credentialsService.getClientKeyHint(username), nonce = randomSecret();
      res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
      res.type('html').send(consentPage({ username, clientName: client.client_name, csrf: req.session.mcpConsent.csrf,
        nonce, protectedKey: hint.userKeyMode === 'client', pageUrl }));
    } catch { res.status(503).json({ error: 'Vérification du compte ENT impossible.' }); }
  });
  router.post(BASE + '/consent/approve', signedIn, requireConsent, browserPost, async (req, res) => {
    const consent = req.session.mcpConsent;
    // Also consumed transactionally below: Express sessions are per-request copies.
    delete req.session.mcpConsent;
    try {
      provider.consumeConsent(consent.csrf, consent.clientId, consent.params);
      const username = req.session.user.userName;
      const client = await provider.clientsStore.getClient(consent.clientId);
      if (!client) return res.sendStatus(400);
      const hint = await credentialsService.getClientKeyHint(username);
      const currentKey = hint.userKeyMode === 'client' ? req.body.currentKey : hint.userSecretSalt;
      const principal = await credentialsService.enableClientKey(username, currentKey, req.body.candidateKey);
      const code = provider.issueCode(principal, client, consent.params);
      // Never retain key material in the Centraliz session, including older sessions.
      delete req.session.user.userSecretSalt;
      const redirect = new URL(consent.params.redirectUri);
      redirect.searchParams.set('code', code);
      if (consent.params.state) redirect.searchParams.set('state', consent.params.state);
      res.json({ redirect: redirect.href });
    } catch { res.status(409).json({ error: 'Compte ENT absent, clé incorrecte ou connexion modifiée. Rechargez la connexion. La clé de secours reste dans ce navigateur.' }); }
    finally { delete req.body.currentKey; delete req.body.candidateKey; }
  });
  router.get(BASE + '/consent/connections', signedIn, (req, res) => {
    const csrf = randomSecret();
    req.session.mcpManagement = { csrf, expires: Date.now() + 10 * 60000 };
    const grants = provider.listGrants(req.session.user.userName);
    const nonce = randomSecret();
    res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`).type('html')
      .send(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Connexions Moodle</title><h1>Mes assistants connectés</h1>${grants.map(g => `<form method="post" action="${BASE}/consent/revoke"><p>${escape(g.clientName)} · expire le ${new Date(g.expires).toISOString().slice(0, 10)}</p><input type="hidden" name="csrf" value="${csrf}"><input type="hidden" name="grantId" value="${g.id}"><button>Révoquer</button></form>`).join('') || '<p>Aucune connexion active.</p>'}<p>Révoquer l’assistant ne supprime pas la clé personnelle de ce navigateur et ne rétablit pas l’ancien chiffrement.</p>${keyBackupControls(req.session.user.userName, nonce)}</html>`);
  });
  router.post(BASE + '/consent/revoke', express.urlencoded({ extended: false, limit: '8kb' }), signedIn, (req, res) => {
    if (req.get('origin') !== origin || !req.session.mcpManagement || req.session.mcpManagement.expires <= Date.now() || req.body.csrf !== req.session.mcpManagement.csrf) return res.sendStatus(403);
    provider.revokeGrant(req.session.user.userName, req.body.grantId);
    res.redirect(BASE + '/consent/connections');
  });
  const authenticate = requireBearerAuth({ verifier: provider, requiredScopes: [SCOPE], expectedResource: resource, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource) });
  router.all(resource.pathname, authenticate, async (req, res) => {
    const server = createMoodleMcpServer({ moodleService, principal: req.auth.extra.principal, profileId: req.auth.extra.profileId });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.once('close', () => { transport.close(); server.close(); delete req.auth; });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch { if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' }); }
  });
  return { router, provider };
}
module.exports = { createRemoteMcpRouter, remoteConfig, BASE };
