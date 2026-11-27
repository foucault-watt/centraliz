const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { SessionLog } = require('./session-log.cjs');
const { GoDashboard } = require('./go-dashboard.cjs');
const { copyLogs } = require('./copy-logs.cjs');

test('journal preserves all long lines beyond the UI history and masks secrets from each environment', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'centraliz-journal-'));
  let journal;
  t.after(() => {
    journal?.close();
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('centraliz-journal-')) throw new Error('Unsafe cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, 'backend'));
  fs.writeFileSync(path.join(root, '.env'), 'SECRET_API=root-secret');
  fs.writeFileSync(path.join(root, 'backend/.env'), 'SECRET_API=backend-secret');
  journal = new SessionLog({ root, kind: 'go' });
  const screen = new GoDashboard({ stream: { write() {} }, plain: true, journal });
  for (let i = 0; i < 5100; i++) screen.record('backend', `line-${i}`);
  const long = 'untruncated-' + 'x'.repeat(20000);
  screen.record('frontend', long);
  screen.record('backend', 'root-secret backend-secret Authorization: Bearer dynamic-credential');
  const text = journal.read();
  assert(text.includes('line-0')); assert(text.includes('line-5099')); assert(text.includes(long));
  assert(!text.includes('root-secret')); assert(!text.includes('backend-secret')); assert(!text.includes('dynamic-credential'));
  assert.equal(screen.sources.backend.logs.length, 5000);
  screen.finish(); journal.append('BACKEND', 'last stdout drain'); assert(journal.read().includes('last stdout drain'));
});

test('clipboard transfer uses stdin; log content is never executable command text', async () => {
  const text = 'été\n$(malicious)\n`literal`';
  let input, args;
  await copyLogs(text, { platform: 'win32', spawnProcess: (command, commandArgs) => {
    assert.equal(command, 'powershell.exe'); args = commandArgs;
    const child = new EventEmitter(); child.stdin = new EventEmitter();
    child.stdin.end = value => { input = value; queueMicrotask(() => child.emit('close', 0)); };
    return child;
  } });
  assert.equal(input, text); assert(!args.join(' ').includes('malicious'));
});
