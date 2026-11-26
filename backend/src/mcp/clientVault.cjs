// No server master key: each envelope is unlocked only by a client-held secret.
const crypto = require('node:crypto');
const randomSecret = () => crypto.randomBytes(32).toString('base64url');
const fingerprint = value => crypto.createHash('sha256').update(value).digest('hex');
const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
function keyFor(secret, context) {
  if (!validSecret(secret)) throw new Error('Invalid client secret');
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(secret, 'base64url'), Buffer.alloc(0), Buffer.from(context), 32));
}
function seal(secret, value, context) {
  const iv = crypto.randomBytes(12), key = keyFor(secret, context);
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context));
    const bytes = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), bytes].map(b => b.toString('base64url')).join('.');
  } finally { key.fill(0); }
}
function unseal(secret, envelope, context) {
  const parts = envelope.split('.');
  if (parts.length !== 3) throw new Error('Invalid envelope');
  const [iv, tag, bytes] = parts.map(part => Buffer.from(part, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid envelope authentication data');
  const key = keyFor(secret, context);
  try {
    const cipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8'));
  } finally { key.fill(0); }
}
const passwordContext = entUsername => `centraliz:ent:v3:${entUsername.toLowerCase()}`;
const encryptEntPassword = (entUsername, password, userKey) => 'v3:' + seal(userKey, password, passwordContext(entUsername));
const decryptEntPassword = (entUsername, encrypted, userKey) => unseal(userKey, encrypted.slice(3), passwordContext(entUsername));
module.exports = { randomSecret, fingerprint, validSecret, seal, unseal, encryptEntPassword, decryptEntPassword };
