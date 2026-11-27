const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Synchronous transactions are serial within the single backend process.
// Never put this file under a static directory. Only ciphertext and metadata live here.
function createOAuthStore(file) {
  let state = { version: 1, clients: {}, records: {}, grants: {}, profiles: {} };
  if (file && fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('OAuth store symlink refused');
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (state.version !== 1 || !state.clients || !state.records || !state.grants) throw new Error('Invalid OAuth store');
  }
  function transaction(change) {
    const next = structuredClone(state);
    const result = change(next);
    if (file) {
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const temp = file + '.' + randomUUID() + '.tmp';
      try {
        fs.writeFileSync(temp, JSON.stringify(next), { flag: 'wx', mode: 0o600 });
        fs.renameSync(temp, file);
      } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    }
    state = next;
    return result;
  }
  return { read: () => structuredClone(state), transaction };
}
module.exports = { createOAuthStore };
