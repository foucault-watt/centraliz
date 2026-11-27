const path = require('node:path');
const { Dashboard } = require('./deploy-dashboard.cjs');
const { flags, executeDeployment } = require('./deploy-runner.cjs');
const { SessionLog } = require('./session-log.cjs');
const { attachControls } = require('./terminal-controls.cjs');

async function demo(dashboard) {
  dashboard.mode = 'DÉMONSTRATION // AUCUN TRANSFERT';
  dashboard.setSteps(['Préparation', 'Build frontend', 'Connexion SFTP', 'Frontend', 'Backend', 'Collecteurs Moodle', 'Redémarrage backend', 'Bilan']);
  for (const name of dashboard.steps.map(step => step.name)) {
    dashboard.begin(name);
    if (['Frontend', 'Backend', 'Collecteurs Moodle'].includes(name)) {
      for (let i = 0; i <= 24; i++) {
        dashboard.update({ uploadedBytes: i * 512000, totalBytes: 24 * 512000, uploadedFiles: i * 3, totalFiles: 72,
          bytesPerSecond: 2400000, file: name === 'Frontend' ? 'static/js/main.js' : 'src/services/moodleService.js' });
        await new Promise(resolve => setTimeout(resolve, 65));
      }
    } else { dashboard.log(`${name} · démonstration locale`); await new Promise(resolve => setTimeout(resolve, 250)); }
    dashboard.complete(name);
  }
  dashboard.log('Démo terminée : aucun build, aucune connexion réseau.');
}

async function main({ buildDefault = true, args = process.argv.slice(2) } = {}) {
  let dashboard;
  let cleanupKeys = () => {};
  const cancel = () => { cleanupKeys(); dashboard?.log('Commande interrompue par l’utilisateur.'); dashboard?.finish(false); process.exit(130); };
  process.once('SIGINT', cancel);
  try {
    const options = flags(args);
    const root = path.resolve(__dirname, '..');
    if (!options.demo) require('dotenv').config({ path: path.join(root, '.env') });
    const env = { ...process.env };
    if (!options.demo && !options.noRestart && options.backend && !env.SECRET_API && !env.DEPLOY_RESTART_SECRET) {
      const file = path.join(root, 'backend/.env');
      if (require('node:fs').existsSync(file)) env.SECRET_API = require('dotenv').parse(require('node:fs').readFileSync(file)).SECRET_API;
    }
    dashboard = new Dashboard({ ...options, plain: options.plain || options.dryRun, journal: new SessionLog({ root, kind: 'rezo' }) });
    cleanupKeys = attachControls(dashboard, cancel);
    if (options.demo) await demo(dashboard);
    else await executeDeployment({ root, env, options: { ...options, skipBuild: options.skipBuild || !buildDefault }, dashboard,
      createClient: () => new (require('ssh2-sftp-client'))() });
    dashboard.finish(true);
  } catch (error) {
    let message = error.message;
    for (const [key, value] of Object.entries(process.env)) {
      if (/PASSWORD|SECRET|TOKEN|PRIVATE_KEY/.test(key) && value?.length > 3) message = message.split(value).join('[masqué]');
    }
    if (dashboard) { dashboard.log(`ERREUR : ${message}`); dashboard.finish(false); }
    else process.stderr.write(message + '\n');
    process.exitCode = 1;
  } finally { cleanupKeys(); process.removeListener('SIGINT', cancel); }
}

module.exports = { main, demo };
