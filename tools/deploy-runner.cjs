const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createPlan, validateRemoteTargets } = require('./deploy-plan.cjs');
const { uploadWithProgress, formatBytes } = require('./upload-with-progress.cjs');
const { restartConfig, restartAndWait } = require('./deploy-restart.cjs');

function flags(args) {
  const known = new Set(['--dry-run', '--frontend-only', '--backend-only', '--skip-build', '--plain', '--verbose', '--demo', '--no-restart']);
  for (const arg of args) if (!known.has(arg)) throw new Error(`Option inconnue : ${arg}`);
  if (args.includes('--frontend-only') && args.includes('--backend-only')) throw new Error('Choisir frontend-only ou backend-only');
  return { dryRun: args.includes('--dry-run'), frontend: !args.includes('--backend-only'), backend: !args.includes('--frontend-only'),
    skipBuild: args.includes('--skip-build'), plain: args.includes('--plain'), verbose: args.includes('--verbose'), demo: args.includes('--demo'), noRestart: args.includes('--no-restart') };
}

function buildFrontend(root, dashboard, spawnBuild = spawn) {
  return new Promise((resolve, reject) => {
    const child = spawnBuild(process.execPath, [path.join(root, 'frontend/scripts/run-with-musee.cjs'), 'build'], {
      cwd: path.join(root, 'frontend'), env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const streams = new Map();
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding?.('utf8');
      streams.set(stream, '');
      stream.on('data', data => {
        const lines = (streams.get(stream) + data.toString()).split(/[\r\n]+/);
        streams.set(stream, lines.pop());
        for (const line of lines) dashboard.log(line);
      });
    }
    child.on('error', reject);
    child.on('close', code => {
      for (const remainder of streams.values()) if (remainder) dashboard.log(remainder);
      if (code === 0) resolve(); else reject(new Error('Build frontend en échec : aucun transfert effectué'));
    });
  });
}

async function executeDeployment({ root, env, options, dashboard, createClient, build = buildFrontend, restart = restartAndWait }) {
  let sftp, step = 'Préparation';
  const shouldRestart = options.backend && !options.noRestart;
  const stepNames = ['Préparation', ...(options.frontend && !options.skipBuild && !options.dryRun ? ['Build frontend'] : []), 'Connexion SFTP',
    ...(options.frontend ? ['Frontend'] : []), ...(options.backend ? ['Backend', 'Collecteurs Moodle'] : []), ...(shouldRestart ? ['Redémarrage backend'] : []), 'Bilan'];
  dashboard.setSteps(stepNames);
  const begin = name => { step = name; dashboard.begin(name); };
  try {
    begin('Préparation');
    let targets = createPlan({ root, env, ...options, strict: !options.dryRun });
    const restartSettings = shouldRestart && !options.dryRun ? restartConfig(env) : null;
    if (!options.dryRun) {
      for (const key of ['SFTP_HOST', 'SFTP_USER', 'SFTP_PASSWORD']) if (!env[key]) throw new Error(`Configuration manquante : ${key}`);
      const port = Number(env.SFTP_PORT || 8887);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SFTP_PORT invalide');
    }
    dashboard.complete('Préparation', `${targets.reduce((sum, target) => sum + target.files.length, 0)} fichiers applicatifs`);
    if (options.dryRun) {
      for (const target of targets) {
        dashboard.log(`${target.label} → ${target.remoteDir || '[chemin SFTP à configurer]'} · ${target.files.length} fichiers · ${formatBytes(target.bytes)}`);
        dashboard.log(target.replaceDirectory ? '  Politique frontend : remplacement du répertoire après build.' : '  Politique : ajouts et remplacements uniquement ; aucune suppression distante.');
        if (!target.files.length) dashboard.log('  Aucun fichier prêt ; build ou sources requis avant transfert.');
        for (const file of target.files) dashboard.log(`  ${target.label}/${path.relative(target.localDir, file).split(path.sep).join('/')}`);
      }
      dashboard.log('Protégés backend : .env*, données, logs, uploads, node_modules, caches et environnements Python.');
      dashboard.log('APERÇU : aucun build, aucune connexion réseau, aucune modification distante.');
      for (const name of stepNames.slice(1)) dashboard.complete(name, 'simulation');
      return { targets, dryRun: true };
    }
    if (options.frontend && !options.skipBuild) {
      begin('Build frontend'); await build(root, dashboard); dashboard.complete('Build frontend');
      targets = createPlan({ root, env, ...options });
    }
    for (const target of targets) if (!target.files.length) throw new Error(`Aucun fichier prêt pour ${target.label}`);
    begin('Connexion SFTP');
    sftp = createClient();
    await sftp.connect({ host: env.SFTP_HOST, port: Number(env.SFTP_PORT || 8887), username: env.SFTP_USER, password: env.SFTP_PASSWORD });
    await validateRemoteTargets(sftp, targets);
    // Check replacement support before clearing the frontend. Only our own
    // uniquely named empty probes are created and removed here.
    for (const target of targets.filter(target => target.atomic)) {
      await sftp.mkdir(target.remoteDir, true);
      const probe = path.posix.join(target.remoteDir, `.centraliz-upload-${randomUUID()}`);
      const replacement = path.posix.join(target.remoteDir, `.centraliz-upload-${randomUUID()}`);
      try {
        await sftp.put(Buffer.alloc(0), probe);
        await sftp.put(Buffer.alloc(0), replacement);
        await sftp.posixRename(probe, replacement);
      } finally {
        for (const file of [probe, replacement]) { try { await sftp.delete(file); } catch {} }
      }
    }
    dashboard.complete('Connexion SFTP', 'destinations vérifiées');
    for (const target of targets) {
      begin(target.label);
      if (target.replaceDirectory && await sftp.exists(target.remoteDir)) await sftp.rmdir(target.remoteDir, true);
      await sftp.mkdir(target.remoteDir, true);
      await uploadWithProgress({ sftp, ...target, onProgress: info => dashboard.update(info) });
      dashboard.complete(target.label, `${target.files.length} fichiers · ${formatBytes(target.bytes)}`);
    }
    if (shouldRestart) {
      await sftp.end(); sftp = null;
      begin('Redémarrage backend');
      await restart(restartSettings, { log: line => dashboard.log(line) });
      dashboard.complete('Redémarrage backend', 'nouvelle instance vérifiée');
    }
    begin('Bilan');
    dashboard.log(shouldRestart ? 'Transfert et redémarrage terminés. Dépendances et migrations restent manuelles.' : 'Transfert terminé. Dépendances, migrations et redémarrage restent manuels.');
    dashboard.log('Aucun environnement, log ou fichier de données backend n’a été envoyé ni supprimé.');
    dashboard.complete('Bilan', 'transfert réussi');
    return { targets, dryRun: false };
  } catch (error) { dashboard.fail(step); throw error; }
  finally { if (sftp) await sftp.end(); }
}

module.exports = { flags, buildFrontend, executeDeployment };
