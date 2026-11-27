function restartConfig(env) {
  if (!env.DEPLOY_BACKEND_URL) throw new Error('Configurer DEPLOY_BACKEND_URL pour le redémarrage, ou utiliser --no-restart');
  const secret = env.DEPLOY_RESTART_SECRET || env.SECRET_API;
  if (!secret) throw new Error('SECRET_API absent : configurer le secret local du backend ou utiliser --no-restart');
  let base;
  try { base = new URL(env.DEPLOY_BACKEND_URL); } catch { throw new Error('DEPLOY_BACKEND_URL invalide'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('DEPLOY_BACKEND_URL doit être une URL HTTPS sans identifiants ni paramètres');
  if (base.hostname.split('.').some(label => !label)) throw new Error('DEPLOY_BACKEND_URL contient un nom d’hôte invalide : vérifier les points dans le domaine');
  if (/\/crash\/?$/.test(base.pathname)) throw new Error('DEPLOY_BACKEND_URL doit être l’URL de base du backend, pas l’URL secrète du crash');
  const root = base.href.replace(/\/$/, '');
  return { restartUrl: `${root}/api/${encodeURIComponent(secret)}/crash`, healthUrl: `${root}/api/healthcheck` };
}

async function restartAndWait(config, { fetchImpl = fetch, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, timeoutMs = 90000 } = {}) {
  const health = async () => {
    try {
      const response = await fetchImpl(config.healthUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return { legacy: true };
      try {
        const data = await response.json();
        return typeof data.bootId === 'string' && data.bootId ? { bootId: data.bootId } : { legacy: true };
      } catch { return { legacy: true }; }
    } catch (error) {
      const code = error.cause?.code || error.code;
      if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return { error: 'DNS_UNRESOLVED' };
      if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code)) return { error: 'TLS_INVALID' };
      return {};
    }
  };
  const before = await health();
  if (before.error === 'DNS_UNRESOLVED') throw new Error('Le domaine de DEPLOY_BACKEND_URL ne peut pas être résolu (DNS). Aucune demande de crash envoyée.');
  if (before.error === 'TLS_INVALID') throw new Error('Certificat HTTPS du backend non valide. Aucune demande de crash envoyée.');
  let acknowledgedBoot;
  let response;
  try {
    // Exactly one request. A connection reset may mean the old route exited
    // before flushing its response; never retry this destructive request.
    response = await fetchImpl(config.restartUrl, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch { log('Connexion interrompue pendant la demande ; vérification du retour du serveur.'); }
  if (response) {
    if (!response.ok && ![500, 502, 503, 504].includes(response.status)) throw new Error('La route de redémarrage a refusé la demande. URL et secret masqués.');
    try { const body = await response.json(); if (typeof body.bootId === 'string') acknowledgedBoot = body.bootId; } catch { /* Legacy response is plain text. */ }
  }
  log('Demande envoyée une seule fois. Attente d’une nouvelle instance backend…');
  const previousBoot = before.bootId || acknowledgedBoot;
  const started = now();
  while (now() - started < timeoutMs) {
    await sleep(1000);
    const current = await health();
    if (current.bootId && ((previousBoot && current.bootId !== previousBoot) || (!previousBoot && before.legacy))) {
      log('Nouvelle instance backend confirmée.');
      return { verified: true };
    }
  }
  throw new Error(`Transfert effectué, mais redémarrage non confirmé dans les ${Math.round(timeoutMs / 1000)} secondes. Aucune seconde demande de crash envoyée.`);
}

module.exports = { restartConfig, restartAndWait };
