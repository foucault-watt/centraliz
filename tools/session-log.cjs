const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { strip } = require('./terminal-renderer.cjs');

function createRedactor(root) {
  const entries = Object.entries(process.env);
  for (const relative of ['.env', 'backend/.env', 'frontend/.env']) {
    const file = path.join(root, relative);
    if (fs.existsSync(file)) entries.push(...Object.entries(require('dotenv').parse(fs.readFileSync(file))));
  }
  const secrets = [...new Set(entries.filter(([key, value]) => /SECRET|PASSWORD|TOKEN|PRIVATE_KEY|SUPABASE_KEY/.test(key) && value?.length > 3)
    .flatMap(([, value]) => [value, encodeURIComponent(value)]))].sort((a, b) => b.length - a.length);
  return value => {
    let text = strip(value).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
    for (const secret of secrets) text = text.split(secret).join('[MASQUÉ]');
    return text.replace(/("(?:cookie|sessionID|userSecretSalt|password|authorization|access_token|refresh_token|userKey)"\s*:\s*)"[^"\r\n]*"/gi, '$1"[MASQUÉ]"')
      .replace(/(Authorization\s*[:=]\s*(?:Bearer|Basic)\s+)\S+/gi, '$1[MASQUÉ]')
      .replace(/((?:cookie|sessionID|userSecretSalt)\s*[:=]\s*).*/gi, '$1[MASQUÉ]');
  };
}

class SessionLog {
  constructor({ root, kind }) {
    if (!['go', 'rezo'].includes(kind)) throw new Error('Type de journal invalide');
    this.redact = createRedactor(root);
    const directory = path.join(root, 'logs/cli');
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, `${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.log`);
    this.fd = fs.openSync(this.file, 'wx', 0o600);
    fs.writeFileSync(path.join(directory, `latest-${kind}.txt`), path.basename(this.file));
  }
  append(source, text) {
    const line = `${new Date().toISOString()} [${source}] ${this.redact(text)}\n`;
    // Child stdout can drain just after the UI closes; keep those final lines.
    if (this.fd === null) fs.appendFileSync(this.file, line); else fs.writeSync(this.fd, line);
  }
  read() { return fs.readFileSync(this.file, 'utf8'); }
  close() { if (this.fd !== null) { fs.closeSync(this.fd); this.fd = null; } }
}

function showLatest(root, kind) {
  if (!['go', 'rezo'].includes(kind)) throw new Error('Utilisation : npm run logs -- go|rezo');
  const directory = path.join(root, 'logs/cli');
  const name = fs.readFileSync(path.join(directory, `latest-${kind}.txt`), 'utf8').trim();
  if (path.basename(name) !== name || !name.startsWith(kind + '-') || !name.endsWith('.log')) throw new Error('Journal invalide');
  fs.createReadStream(path.join(directory, name)).pipe(process.stdout);
}
module.exports = { SessionLog, createRedactor, showLatest };
