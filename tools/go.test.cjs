const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { GoDashboard } = require('./go-dashboard.cjs');
const { commands, startDevelopment } = require('./go.cjs');

function dashboard(columns = 120) {
  let text = '';
  const screen = new GoDashboard({ plain: true, stream: { columns, rows: 32, write: value => { text += value; } } });
  return { screen, output: () => text };
}

test('dev command preserves frontend start and backend dev scripts', () => {
  const specs = commands('/repo', '/npm-cli.js');
  assert.deepEqual(specs.map(spec => spec.args), [
    ['/npm-cli.js', '--prefix', 'frontend', 'run', 'start'],
    ['/npm-cli.js', '--prefix', 'backend', 'run', 'dev'],
  ]);
});

test('logs stay in their own panes, states update and narrow terminals stack them', () => {
  const { screen, output } = dashboard();
  screen.record('frontend', '[centraliz] Démarrage React (Musée inclus)…'); assert.equal(screen.sources.frontend.state, 'COMPILATION');
  screen.record('frontend', 'VITE v7.3.7  ready in 632 ms');
  screen.record('backend', 'Serveur backend lancé sur localhost:3001');
  assert.equal(screen.sources.frontend.state, 'PRÊT'); assert.equal(screen.sources.backend.state, 'PRÊT');
  screen.record('frontend', '[vite] Internal server error: Failed to resolve import'); assert.equal(screen.sources.frontend.state, 'ERREUR');
  screen.record('frontend', '[vite] hmr update /src/App.jsx'); assert.equal(screen.sources.frontend.state, 'PRÊT');
  assert(!screen.sources.frontend.logs.some(line => line.includes('Serveur backend')));
  assert(screen.lines().every(line => [...line].length <= 118));
  screen.stream.columns = 50;
  assert(screen.lines().every(line => [...line].length <= 48));
  screen.paused = true; screen.record('backend', 'still captured');
  assert(screen.sources.backend.logs.at(-1).includes('still captured'));
  assert(!output().includes('\x1b'));
  screen.finish();
});

test('stopping dev closes only its two owned children; a failed process stops its sibling', async () => {
  const { screen } = dashboard();
  const spawned = [], stopped = [];
  const manager = startDevelopment({ root: '/repo', npmCli: '/npm-cli.js', dashboard: screen,
    spawnProcess: (command, args, options) => {
      const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = spawned.length + 100;
      spawned.push({ child, command, args, options }); return child;
    }, stopProcess: async children => stopped.push(...children),
  });
  spawned[0].child.stdout.emit('data', Buffer.from('VITE v7.3.7  ready in 632 ms\n'));
  spawned[1].child.stderr.emit('data', Buffer.from('[nodemon] app crashed\n'));
  assert.equal(screen.sources.backend.state, 'ERREUR');
  spawned[1].child.emit('close', 1);
  assert.equal(await manager.done, 1);
  await manager.stop();
  assert.deepEqual(stopped, spawned.map(entry => entry.child));
  assert.equal(spawned.length, 2);
  screen.finish(false);
});
