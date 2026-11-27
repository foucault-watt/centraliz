const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');
const { createPlan, remotePath } = require('./deploy-plan.cjs');
const { executeDeployment, flags } = require('./deploy-runner.cjs');
const { Dashboard } = require('./deploy-dashboard.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'centraliz-deploy-'));
  t.after(() => {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('centraliz-deploy-')) throw new Error('Unsafe cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const put = (name, data = 'source') => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
  for (const file of ['frontend/build/index.html', 'frontend/build/static/main.js', 'backend/server.js', 'backend/package.json', 'backend/package-lock.json',
    'backend/src/services/app.js', 'backend/src/config/app.js', 'backend/src/migrations/001.sql', 'prototypes/moodle/courses.py', 'prototypes/moodle/requirements.txt']) put(file);
  for (const file of ['backend/.env', 'backend/node_modules/private.js', 'backend/src/data/runtime.json', 'backend/src/services/app.test.cjs',
    'backend/src/services/.env', 'backend/src/services/logs/private.js', 'backend/server.log', 'prototypes/moodle/.venv/private.py',
    'prototypes/moodle/test_courses.py', 'prototypes/moodle/run-result.json']) put(file, 'private');
  return { root, put };
}
const env = { SFTP_HOST: 'test', SFTP_USER: 'test', SFTP_PASSWORD: 'test-secret', SFTP_REMOTE_PATH: '/srv/public', SFTP_BACKEND_REMOTE_PATH: '/srv/backend' };
const options = { frontend: true, backend: true, skipBuild: true, dryRun: false, noRestart: true };
const silent = () => new Dashboard({ stream: { write() {} }, plain: true });

function fakeSftp({ failRename = false, symlink = null } = {}) {
  const remote = new Map([
    ['/srv/backend/.env', Buffer.from('production-secret')], ['/srv/backend/src/data/runtime.json', Buffer.from('production-data')],
    ['/srv/backend/backend.log', Buffer.from('production-log')], ['/srv/backend/extra.txt', Buffer.from('server-only')],
    ['/srv/backend/src/services/app.js', Buffer.from('old-code')], ['/srv/public/old.js', Buffer.from('old-frontend')],
  ]);
  const deletedDirectories = [], deletedFiles = [], renames = [];
  return { remote, deletedDirectories, deletedFiles, renames,
    async connect() {}, async end() {}, async mkdir() {},
    async put(bytes, file) { remote.set(file, Buffer.from(bytes)); },
    async exists(file) { return file === symlink ? 'l' : remote.has(file) ? '-' : 'd'; },
    async rmdir(dir) { deletedDirectories.push(dir); for (const file of remote.keys()) if (file.startsWith(dir + '/')) remote.delete(file); },
    createWriteStream(file) {
      const chunks = [];
      const stream = new Writable({ write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); stream.bytesWritten += chunk.length; done(); },
        final(done) { remote.set(file, Buffer.concat(chunks)); done(); } });
      stream.bytesWritten = 0; return stream;
    },
    async posixRename(from, to) {
      if (failRename) throw new Error('atomic rename unsupported');
      renames.push([from, to]); remote.set(to, remote.get(from)); remote.delete(from);
    },
    async delete(file) { deletedFiles.push(file); remote.delete(file); },
  };
}

test('deployment plan excludes secrets, runtime data, dependencies and tests', t => {
  const { root } = fixture(t);
  const targets = createPlan({ root, env });
  const files = targets.flatMap(target => target.files.map(file => path.relative(root, file).replaceAll('\\', '/')));
  assert(files.includes('backend/src/services/app.js'));
  assert(files.includes('backend/src/migrations/001.sql'));
  assert(files.includes('prototypes/moodle/courses.py'));
  assert(!files.some(file => /private|\.env|runtime|\.test\.|server\.log|test_courses|run-result/.test(file)));
  assert.equal(targets.find(target => target.id === 'collectors').remoteDir, '/srv/prototypes/moodle');
});

test('backend overlay preserves production environment, data, logs and server-only files', async t => {
  const { root } = fixture(t);
  const sftp = fakeSftp();
  const preserved = [...sftp.remote].filter(([file]) => file.startsWith('/srv/backend/') && !file.endsWith('app.js'));
  await executeDeployment({ root, env, options, dashboard: silent(), createClient: () => sftp });
  for (const [file, bytes] of preserved) assert.deepEqual(sftp.remote.get(file), bytes);
  assert.equal(sftp.remote.get('/srv/backend/src/services/app.js').toString(), 'source');
  assert.deepEqual(sftp.deletedDirectories, ['/srv/public']);
  assert(!sftp.remote.has('/srv/public/old.js'));
  assert(sftp.renames.length > 0);
  assert(sftp.renames.every(([from]) => path.posix.basename(from).startsWith('.centraliz-upload-')));
});

test('dry-run neither builds nor creates a network client, even without deployment configuration', async t => {
  const { root } = fixture(t);
  await executeDeployment({ root, env: {}, options: { ...options, dryRun: true, skipBuild: false }, dashboard: silent(),
    createClient: () => assert.fail('network forbidden'), build: () => assert.fail('build forbidden') });
});

test('missing backend configuration and overlapping destinations fail before frontend deletion', async t => {
  const { root } = fixture(t);
  for (const values of [{ ...env, SFTP_BACKEND_REMOTE_PATH: '' }, { ...env, SFTP_BACKEND_REMOTE_PATH: '/srv/public/backend' }]) {
    await assert.rejects(executeDeployment({ root, env: values, options, dashboard: silent(), createClient: () => assert.fail('no network') }));
  }
  for (const value of ['/', '/var/www', '/srv/../public', 'relative', '/srv\\backend']) assert.throws(() => remotePath(value, 'target'));
});

test('remote symlink is rejected before any destructive frontend action', async t => {
  const { root } = fixture(t); const sftp = fakeSftp({ symlink: '/srv/backend/src' });
  await assert.rejects(executeDeployment({ root, env, options, dashboard: silent(), createClient: () => sftp }), /lien refusé/);
  assert.deepEqual(sftp.deletedDirectories, []);
});

test('failed atomic replacement leaves existing backend code intact and deletes only its temporary upload', async t => {
  const { root } = fixture(t); const sftp = fakeSftp({ failRename: true });
  await assert.rejects(executeDeployment({ root, env, options: { ...options, frontend: false }, dashboard: silent(), createClient: () => sftp }), /atomic rename/);
  assert.equal(sftp.remote.get('/srv/backend/src/services/app.js').toString(), 'old-code');
  assert.deepEqual(sftp.deletedDirectories, []);
  assert(sftp.deletedFiles.every(file => path.posix.basename(file).startsWith('.centraliz-upload-')));
});

test('unsupported atomic replacement blocks the entire transfer before frontend deletion', async t => {
  const { root } = fixture(t); const sftp = fakeSftp({ failRename: true });
  await assert.rejects(executeDeployment({ root, env, options, dashboard: silent(), createClient: () => sftp }), /atomic rename/);
  assert.deepEqual(sftp.deletedDirectories, []);
  assert.equal(sftp.remote.get('/srv/public/old.js').toString(), 'old-frontend');
  assert(sftp.deletedFiles.every(file => path.posix.basename(file).startsWith('.centraliz-upload-')));
});

test('build failure prevents all transfers', async t => {
  const { root } = fixture(t);
  await assert.rejects(executeDeployment({ root, env, options: { ...options, skipBuild: false }, dashboard: silent(),
    build: async () => { throw new Error('build failed'); }, createClient: () => assert.fail('network forbidden') }), /build failed/);
});

test('restart is invoked only after all uploads succeed and never on failed or simulated deployment', async t => {
  const { root } = fixture(t);
  const restartEnv = { ...env, DEPLOY_BACKEND_URL: 'https://example.test', SECRET_API: 'private-secret' };
  const sftp = fakeSftp(); let restarted = 0;
  await executeDeployment({ root, env: restartEnv, options: { ...options, noRestart: false }, dashboard: silent(), createClient: () => sftp,
    restart: async () => { restarted++; assert(sftp.remote.has('/srv/prototypes/moodle/courses.py')); assert(sftp.remote.has('/srv/backend/src/services/app.js')); } });
  assert.equal(restarted, 1);
  await assert.rejects(executeDeployment({ root, env: restartEnv, options: { ...options, noRestart: false }, dashboard: silent(), createClient: () => fakeSftp({ failRename: true }),
    restart: async () => assert.fail('no restart after failed transfer') }));
  await executeDeployment({ root, env: {}, options: { ...options, noRestart: false, dryRun: true }, dashboard: silent(), createClient: () => assert.fail('no network'),
    restart: async () => assert.fail('no restart in dry run') });
});

test('dashboard stays within terminal width and plain mode has no escape sequences', () => {
  let output = '';
  const dashboard = new Dashboard({ stream: { columns: 44, write: value => { output += value; } }, plain: true, clock: () => 1000 });
  dashboard.setSteps(['Préparation', 'Backend']); dashboard.begin('Backend');
  dashboard.update({ uploadedBytes: 100, totalBytes: 200, uploadedFiles: 1, totalFiles: 2, bytesPerSecond: 50, file: 'very-long-path/'.repeat(20) });
  assert(dashboard.lines().every(line => [...line].length <= 42));
  dashboard.finish(); assert(!output.includes('\x1b'));
  assert.throws(() => flags(['--frontend-only', '--backend-only']));
});
