const path = require('node:path');
const { spawn } = require('node:child_process');
const { GoDashboard } = require('./go-dashboard.cjs');
const { SessionLog } = require('./session-log.cjs');
const { handleHistoryKey } = require('./terminal-controls.cjs');

function commands(root, npmCli = process.env.npm_execpath) {
  if (npmCli) return ['frontend', 'backend'].map(source => ({ source, args: [npmCli, '--prefix', source, 'run', source === 'frontend' ? 'start' : 'dev'], cwd: root }));
  return [
    { source: 'frontend', args: [path.join(root, 'frontend/scripts/run-with-musee.cjs'), 'start'], cwd: path.join(root, 'frontend') },
    { source: 'backend', args: [require.resolve('nodemon/bin/nodemon.js', { paths: [path.join(root, 'backend')] }), '--ignore', 'data/*', 'server.js'], cwd: path.join(root, 'backend') },
  ];
}

async function stopOwned(children) {
  await Promise.all(children.filter(child => child.pid && child.exitCode === null && child.signalCode == null).map(child => {
    if (process.platform === 'win32') return new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.once('error', () => { child.kill(); resolve(); }); killer.once('close', resolve);
    });
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }));
}

function startDevelopment({ root, dashboard, spawnProcess = spawn, stopProcess = stopOwned, npmCli }) {
  const children = []; let stopping = false, resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const stop = async (code = 0) => {
    if (stopping) return done;
    stopping = true;
    await stopProcess(children);
    resolveDone(code);
    return done;
  };
  for (const spec of commands(root, npmCli)) {
    const child = spawnProcess(process.execPath, spec.args, { cwd: spec.cwd, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }, detached: process.platform !== 'win32', windowsHide: true });
    children.push(child);
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding?.('utf8');
      let pending = '';
      stream.on('data', data => {
        const lines = (pending + data.toString()).split(/[\r\n]+/);
        pending = lines.pop();
        for (const line of lines) dashboard.record(spec.source, line);
      });
      stream.on('end', () => { if (pending) dashboard.record(spec.source, pending); });
    }
    child.once('error', () => { dashboard.record(spec.source, 'ERREUR : démarrage du processus impossible.'); dashboard.sources[spec.source].state = 'ERREUR'; stop(1); });
    child.once('close', code => { if (!stopping) { dashboard.record(spec.source, `Processus terminé (code ${code ?? 'signal'}).`); stop(code || 0); } });
  }
  return { children, done, stop };
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--plain', '--demo'].includes(arg))) throw new Error('Options : --plain ou --demo');
  const root = path.resolve(__dirname, '..');
  const dashboard = new GoDashboard({ plain: args.includes('--plain'), journal: new SessionLog({ root, kind: 'go' }) });
  let manager;
  const stop = () => manager?.stop(0);
  const onKey = (text, key = {}) => {
    if (key.ctrl && key.name === 'c') return stop();
    if (handleHistoryKey(dashboard, key)) return;
    if (key.name === 'f') dashboard.focus = 'frontend';
    if (key.name === 'b') dashboard.focus = 'backend';
    if (key.name === 'a') dashboard.focus = 'all';
    if (key.name === 'p') dashboard.paused = !dashboard.paused;
    dashboard.render(true);
  };
  const previousRaw = process.stdin.isRaw;
  try {
    if (args.includes('--demo')) {
      for (const [source, text] of [['frontend', 'Préparation du Musée…'], ['backend', 'Serveur backend lancé sur localhost:3001'],
        ['frontend', 'VITE ready in 632 ms'], ['frontend', 'Application disponible sur http://localhost:3000'], ['backend', '[Moodle] session_reused · 182 ms'],
        ['backend', '[Moodle] resource_cache_hit · 14 ms']]) dashboard.record(source, text);
      dashboard.render(); await new Promise(resolve => setTimeout(resolve, 6000)); return;
    }
    manager = startDevelopment({ root: path.resolve(__dirname, '..'), dashboard });
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    if (dashboard.animated && process.stdin.isTTY) {
      require('node:readline').emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true); process.stdin.on('keypress', onKey); process.stdin.resume();
    }
    process.exitCode = await manager.done;
  } catch (error) {
    process.exitCode = 1;
    throw error;
  } finally {
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    process.stdin.removeListener('keypress', onKey);
    if (process.stdin.isTTY && process.stdin.setRawMode) process.stdin.setRawMode(Boolean(previousRaw));
    if (dashboard.animated) process.stdin.pause();
    dashboard.finish(!process.exitCode);
  }
}

if (require.main === module) main().catch(() => { console.error('Impossible de lancer Centraliz. Vérifiez les dépendances frontend/backend.'); process.exitCode = 1; });
module.exports = { commands, stopOwned, startDevelopment, main };
