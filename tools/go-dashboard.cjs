const { Dashboard, clip, duration } = require('./deploy-dashboard.cjs');
const { pad } = require('./terminal-renderer.cjs');

class GoDashboard extends Dashboard {
  constructor(options = {}) {
    super(options);
    this.sources = { frontend: { label: 'FRONTEND', state: 'DÉMARRAGE', logs: [] }, backend: { label: 'BACKEND', state: 'DÉMARRAGE', logs: [] } };
    this.focus = 'all'; this.paused = false;
  }
  record(source, line) {
    const clean = this.clean(line);
    if (!clean.trim()) return;
    const item = this.sources[source];
    const time = new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour12: false });
    this.journal?.append(item.label, clean);
    item.logs.push(`${time} ${clean}`); if (item.logs.length > 5000) item.logs.shift();
    if (source === 'frontend') {
      if (/\bready in\b|\bhmr update\b|\bpage reload\b/i.test(clean)) item.state = 'PRÊT';
      else if (/Internal server error|Pre-transform error|Failed to load/i.test(clean)) item.state = 'ERREUR';
      else if (/Démarrage React|Build React|Export web|musee [123]\/3/i.test(clean)) item.state = 'COMPILATION';
    } else {
      if (/Serveur backend lanc|listening|server.*(?:started|running)/i.test(clean)) item.state = 'PRÊT';
      else if (/app crashed/i.test(clean)) item.state = 'ERREUR';
      else if (/restarting due to changes/i.test(clean)) item.state = 'REDÉMARRAGE';
    }
    if (!this.animated) this.stream.write(`[${item.label}] ${clean}\n`);
  }
  render(force = false) { if (this.sources && (!this.paused || force)) super.render(); }
  showLogs() {
    if (!this.journal) this.logs = [...this.sources.frontend.logs, ...this.sources.backend.logs];
    super.showLogs();
  }
  neon(text, ...colors) { return this.color && text.includes('ERREUR') ? `\x1b[38;2;255;100;135m${text}\x1b[0m` : super.neon(text, ...colors); }
  lines() {
    const width = Math.max(24, Math.min(this.stream.columns || 110, 150) - 2);
    const box = text => '│ ' + pad(clip(text, width - 4), width - 4) + ' │';
    const divider = '├' + '─'.repeat(width - 2) + '┤';
    const rows = ['╭' + '─'.repeat(width - 2) + '╮', box('✦  C E N T R A L I Z  //  LIVE DEV CONTROL'),
      box(`http://localhost:3000  ⇄  http://localhost:3001  ·  ${duration((this.clock() - this.started) / 1000)}`), divider];
    const count = Math.max(1, Math.min(22, (this.stream.rows || 36) - 12));
    const keys = this.focus === 'all' ? ['frontend', 'backend'] : [this.focus];
    if (keys.length === 2 && width >= 96) {
      const leftWidth = Math.floor((width - 7) / 2), rightWidth = width - 7 - leftWidth;
      const pair = (a, b) => '│ ' + pad(clip(a, leftWidth), leftWidth) + ' │ ' + pad(clip(b, rightWidth), rightWidth) + ' │';
      rows.push(pair(`◉ FRONTEND · ${this.sources.frontend.state}`, `◉ BACKEND · ${this.sources.backend.state}`));
      rows.push('├' + '─'.repeat(leftWidth + 2) + '┼' + '─'.repeat(rightWidth + 2) + '┤');
      const left = this.visibleLogs(this.sources.frontend.logs, count), right = this.visibleLogs(this.sources.backend.logs, count);
      for (let i = 0; i < count; i++) rows.push(pair(left[i] || '', right[i] || ''));
    } else {
      const size = keys.length === 2 ? Math.max(2, Math.floor((count - 2) / 2)) : count;
      for (const key of keys) {
        const source = this.sources[key];
        rows.push(box(`◉ ${source.label} · ${source.state}`));
        const logs = this.visibleLogs(source.logs, size);
        for (let i = 0; i < size; i++) rows.push(box(logs[i] || ''));
        rows.push(divider);
      }
    }
    rows.push(divider, box(`${this.paused ? 'PAUSE · ' : ''}F front  B back  A les deux  P pause  L logs · Ctrl+C arrêt`),
      box(this.notice || `${this.scrollOffset ? 'HISTORIQUE · ' : ''}PgUp/PgDn · Début ancien · Fin direct · C copier tout`),
      '╰' + '─'.repeat(width - 2) + '╯');
    return rows;
  }
  finish(success = true) {
    this.paused = false;
    for (const source of Object.values(this.sources)) if (source.state !== 'ERREUR') source.state = 'ARRÊTÉ';
    this.render(); clearInterval(this.timer); this.closed = true;
    if (this.animated) { this.renderer.leave(); this.stream.write(this.journal ? this.journal.read() : [...this.sources.frontend.logs, ...this.sources.backend.logs].join('\n') + '\n'); }
    this.stream.write(`${success ? '✓' : '✕'} Session Centraliz terminée · ${duration((this.clock() - this.started) / 1000)}\n`);
    if (this.journal) { this.stream.write(`Journal intégral : ${this.journal.file}\n`); this.journal.close(); }
  }
}
module.exports = { GoDashboard };
