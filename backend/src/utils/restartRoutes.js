const { randomUUID } = require('crypto');

function installRestartRoutes(app, { secret, exit = code => process.exit(code), schedule = setTimeout, bootId = randomUUID() } = {}) {
  app.get(['/healthcheck', '/api/healthcheck'], (req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok', bootId }));
  // Preserve the existing URL and exit code used by the hosting supervisor.
  // An absent secret must never expose /api/undefined/crash.
  if (!secret) return;
  let scheduled = false;
  app.use(`/api/${secret}/crash`, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!scheduled) {
      scheduled = true;
      res.once('finish', () => schedule(() => exit(1), 100));
    }
    res.status(202).json({ status: 'restarting', bootId });
  });
}

function skipSensitiveRequest(req, secret) {
  // OAuth codes/credentials must not enter HTTP logs, including via Referer.
  if ([req.originalUrl || req.url || '', req.headers?.referer || ''].some(value => /(?:\/api\/mcp(?:[/?#]|$)|\/\.well-known\/oauth-|\/api\/auth\/(?:endpoint|ent-browser-migration)(?:[/?#]|$))/.test(value))) return true;
  return ['/healthcheck', '/api/healthcheck'].includes(req.url) || Boolean(secret &&
    [req.originalUrl || req.url || '', req.headers?.referer || ''].some(value => value.includes(secret) || value.includes(encodeURIComponent(secret))));
}

module.exports = { installRestartRoutes, skipSensitiveRequest };
