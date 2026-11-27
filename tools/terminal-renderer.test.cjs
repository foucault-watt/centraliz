const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Dashboard } = require('./deploy-dashboard.cjs');
const { TerminalRenderer, stringWidth, clip } = require('./terminal-renderer.cjs');
const { strip } = require('./terminal-renderer.cjs');

test('deployment ends with a compact summary and retains full logs on demand', () => {
  for (const verbose of [false, true]) {
    const writes = [];
    let closed = false;
    const screen = new Dashboard({
      stream: { isTTY: true, columns: 88, rows: 30, write: text => writes.push(text) },
      clock: () => 15000, verbose,
      journal: { redact: text => text, append() {}, read: () => 'full historical transcript\n', close: () => { closed = true; } },
    });
    clearInterval(screen.timer);
    screen.setSteps(['Backend', 'Redémarrage backend']);
    screen.complete('Backend', '90 fichiers · 754.4 Ko');
    screen.complete('Redémarrage backend', 'nouvelle instance vérifiée');
    writes.length = 0;
    screen.finish();
    const output = strip(writes.join(''));
    assert.equal(output.includes('full historical transcript'), verbose);
    assert(output.includes('MISSION ACCOMPLIE'));
    assert(output.includes('90 fichiers · 754.4 Ko'));
    assert(output.includes('nouvelle instance vérifiée'));
    assert(output.includes('npm run logs -- rezo'));
    assert(closed);
    const count = writes.length;
    screen.finish();
    assert.equal(writes.length, count);
  }
});

test('failed deployment keeps the full error below the compact card', () => {
  const writes = [];
  const screen = new Dashboard({ stream: { isTTY: true, columns: 40, rows: 30, write: text => writes.push(text) } });
  clearInterval(screen.timer);
  screen.setSteps(['Backend']);
  screen.fail('Backend');
  const error = 'ERREUR : ' + 'diagnostic détaillé '.repeat(20);
  screen.log(error);
  writes.length = 0;
  screen.finish(false);
  const output = strip(writes.join(''));
  assert(output.includes('MISSION INTERROMPUE'));
  assert(output.includes(error));
});

test('unchanged frames write nothing and updates never erase the screen', () => {
  const writes = [];
  const screen = new Dashboard({ stream: { isTTY: true, columns: 100, rows: 30, write: text => writes.push(text) }, clock: () => 0 });
  clearInterval(screen.timer);
  screen.lines = () => ['fixed header', 'progress 10%', 'fixed footer'];
  screen.render();
  writes.length = 0;
  screen.render();
  assert.deepEqual(writes, []);
  screen.lines = () => ['fixed header', 'progress 20%', 'fixed footer'];
  screen.render();
  assert(!writes.join('').includes('fixed header'));
  assert(!/\x1b\[(?:[0123])?J/.test(writes.join('')));
  assert(writes.join('').includes('\x1b[?2026h'));
  screen.finish();
});

test('frames stay in bounds after Unicode, shortening and terminal resize without clearing', () => {
  const writes = [];
  const stream = { columns: 12, rows: 4, write: text => writes.push(text) };
  const renderer = new TerminalRenderer(stream);
  renderer.draw(['你好 emoji 😀', 'second', 'third', 'must not scroll']);
  assert(renderer.previous.length <= 3);
  assert(renderer.previous.every(line => stringWidth(line) <= 11));
  writes.length = 0;
  renderer.draw(['short']);
  assert(writes.join('').includes(' '.repeat(6))); // old content is overwritten, not erased first
  assert(!writes.join('').includes('must not scroll'));
  stream.columns = 8; stream.rows = 3;
  renderer.draw(['你好你好你好', 'small', 'outside']);
  assert(renderer.previous.length <= 2);
  assert(renderer.previous.every(line => stringWidth(line) <= 7));
  assert.equal(stringWidth(clip('😀😀😀', 5)), 5);
  renderer.leave();
  assert(writes.join('').includes('\x1b[?1049l'));
});

test('switching to native logs restores the normal screen and stops cursor updates', () => {
  const writes = [];
  const screen = new Dashboard({ stream: { isTTY: true, columns: 100, rows: 30, write: text => writes.push(text) } });
  clearInterval(screen.timer);
  screen.log('first full log'); screen.render(); screen.showLogs();
  assert(writes.join('').includes('first full log'));
  assert(writes.join('').includes('\x1b[?1049l'));
  writes.length = 0;
  screen.log('next full log'); screen.render();
  assert.equal(writes.join(''), 'next full log\n');
  screen.finish();
});
