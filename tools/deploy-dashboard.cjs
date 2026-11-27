const { formatBytes } = require("./upload-with-progress.cjs");
const { TerminalRenderer, strip, clip, pad } = require('./terminal-renderer.cjs');
const duration = seconds => seconds < 60 ? `${Math.floor(seconds)} s` : `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} s`;

class Dashboard {
  constructor({ stream = process.stdout, plain = false, verbose = false, clock = () => Date.now(), journal = null } = {}) {
    this.stream = stream; this.animated = Boolean(stream.isTTY && !plain); this.color = this.animated && !process.env.NO_COLOR;
    this.verbose = verbose; this.clock = clock; this.started = clock(); this.steps = []; this.logs = []; this.tick = 0; this.previous = 0; this.progress = null;
    this.mode = "MISE EN ORBITE";
    this.journal = journal; this.scrollOffset = 0; this.renderer = new TerminalRenderer(stream);
    if (this.animated) { this.timer = setInterval(() => this.render(), 100); this.timer.unref(); }
  }
  neon(text, start = [42, 240, 225], end = [185, 95, 255]) {
    if (!this.color) return text;
    return [...text].map((char, i, all) => {
      const rgb = start.map((value, channel) => Math.round(value + (end[channel] - value) * i / Math.max(1, all.length - 1)));
      return `\x1b[38;2;${rgb.join(';')}m${char}`;
    }).join('') + '\x1b[0m';
  }
  setSteps(names) { this.steps = names.map(name => ({ name, state: 'pending' })); this.render(); }
  begin(name) { this.steps.find(step => step.name === name).state = 'active'; this.progress = null; this.log(`→ ${name}`); }
  complete(name, detail = '') { const step = this.steps.find(step => step.name === name); step.state = 'done'; step.detail = detail; this.progress = null; this.log(`✓ ${name}${detail ? ' · ' + detail : ''}`); }
  fail(name) { const step = this.steps.find(step => step.name === name); if (step) step.state = 'failed'; this.mode = 'TRANSMISSION INTERROMPUE'; this.render(); }
  log(line) {
    const clean = this.clean(line);
    if (!clean.trim()) return;
    this.journal?.append('REZO', clean);
    this.logs.push(clean); if (this.logs.length > 5000) this.logs.shift();
    if (!this.animated) this.stream.write(clean + '\n');
  }
  update(progress) { this.progress = progress; if (!this.animated) {
    const now = this.clock();
    if (!this.lastPlain || now - this.lastPlain >= 2000 || progress.uploadedFiles === progress.totalFiles) {
      this.lastPlain = now;
      this.log(`${progress.totalBytes ? Math.floor(100 * progress.uploadedBytes / progress.totalBytes) : 100}% · ${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)} · ${formatBytes(progress.bytesPerSecond)}/s · ${progress.uploadedFiles}/${progress.totalFiles} fichiers`);
    }
  } }
  clean(line) { return this.journal ? this.journal.redact(line) : strip(line).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ''); }
  scrollBy(amount) { this.scrollOffset = Math.max(0, Math.min(5000, this.scrollOffset + amount)); this.render(true); }
  visibleLogs(logs, count) {
    const end = Math.max(count, logs.length - Math.min(this.scrollOffset, Math.max(0, logs.length - count)));
    return logs.slice(Math.max(0, end - count), end);
  }
  showLogs() {
    if (!this.animated) return;
    clearInterval(this.timer); this.renderer.leave(); this.animated = false;
    this.stream.write(this.journal ? this.journal.read() : this.logs.join('\n') + '\n');
    this.stream.write(`\nMODE LOGS COMPLETS · défilement et sélection natifs${this.journal ? '\nJournal : ' + this.journal.file : ''}\n`);
  }
  async copyLogs() {
    try {
      await require('./copy-logs.cjs').copyLogs(this.journal ? this.journal.read() : this.logs.join('\n'));
      this.notice = 'Journal intégral copié dans le presse-papiers';
    } catch (error) { this.notice = error.message; }
    if (!this.animated) this.stream.write(this.notice + '\n');
    this.render(true);
  }
  lines() {
    const width = Math.max(22, Math.min(this.stream.columns || 100, 112) - 2), inner = width - 4;
    const box = text => `│ ${pad(clip(text, inner), inner)} │`;
    const rows = ['╭' + '─'.repeat(width - 2) + '╮'];
    if (inner >= 56 && (this.stream.rows || 36) >= 32) {
      const glyphs = [
        [' ███ ', '█   █', '█    ', '█   █', ' ███ '],
        ['█████', '█    ', '████ ', '█    ', '█████'],
        ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
        ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
        ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
        [' ███ ', '█   █', '█████', '█   █', '█   █'],
        ['█    ', '█    ', '█    ', '█    ', '█████'],
        ['█████', '  █  ', '  █  ', '  █  ', '█████'],
        ['█████', '   █ ', '  █  ', ' █   ', '█████'],
      ];
      for (let line = 0; line < 5; line++) rows.push(box(' '.repeat(Math.floor((inner - 53) / 2)) + glyphs.map(glyph => glyph[line]).join(' ')));
    } else rows.push(box('✦   C E N T R A L I Z   ✦'));
    rows.push(box('DEPLOYMENT CONTROL // SFTP UPLINK'), box(`${this.mode}   ${['◐', '◓', '◑', '◒'][this.tick++ % 4]}   ${duration((this.clock() - this.started) / 1000)}`));
    rows.push('├' + '─'.repeat(width - 2) + '┤');
    for (const step of this.steps) rows.push(box(`${{ pending: '○', active: '◉', done: '✓', failed: '✕' }[step.state]}  ${step.name}${step.detail ? '  ·  ' + step.detail : ''}`));
    rows.push('├' + '─'.repeat(width - 2) + '┤');
    if (this.progress) {
      const p = this.progress, fraction = p.totalBytes ? Math.min(1, p.uploadedBytes / p.totalBytes) : 1;
      const size = Math.max(8, inner - 7), filled = Math.floor(fraction * size);
      rows.push(box(`${'█'.repeat(filled)}${'░'.repeat(size - filled)} ${Math.floor(fraction * 100)}%`));
      rows.push(box(`${formatBytes(p.uploadedBytes)} / ${formatBytes(p.totalBytes)}  •  ${formatBytes(p.bytesPerSecond)}/s`));
      rows.push(box(`${p.uploadedFiles}/${p.totalFiles} fichiers  •  ETA ${p.bytesPerSecond > 0 ? duration((p.totalBytes - p.uploadedBytes) / p.bytesPerSecond) : 'calcul…'}`));
      rows.push(box('↳ ' + p.file));
    } else rows.push(box('ENVIRONNEMENT & DONNÉES BACKEND PRÉSERVÉS'));
    rows.push('├' + '─'.repeat(width - 2) + '┤');
    const logCount = Math.max(1, Math.min(5, (this.stream.rows || 36) - rows.length - 3));
    for (const log of this.visibleLogs(this.logs, logCount)) rows.push(box(log));
    rows.push(box(this.notice || `${this.scrollOffset ? 'HISTORIQUE · ' : ''}PgUp/PgDn · Fin direct · L logs complets · C copier`));
    rows.push('╰' + '─'.repeat(width - 2) + '╯');
    return rows;
  }
  render() {
    if (!this.animated || this.closed) return;
    this.renderer.draw(this.lines().map(line => this.neon(line)));
  }
  finish(success = true) {
    if (this.closed) return;
    this.mode = success ? 'MISSION ACCOMPLIE' : 'MISSION INTERROMPUE';
    clearInterval(this.timer); this.closed = true;
    if (this.animated) {
      this.renderer.leave();
      if (this.verbose) this.stream.write(this.journal ? this.journal.read() : this.logs.join('\n') + '\n');
    }
    const width = Math.max(22, Math.min(this.stream.columns || 88, 88) - 2);
    const border = '─'.repeat(width - 2);
    const box = text => `│ ${pad(clip(text, width - 4), width - 4)} │`;
    const rows = ['╭' + border + '╮', box('✦  CENTRALIZ // DÉPLOIEMENT'),
      box(`${success ? '✓' : '✕'} ${this.mode}  ·  ${duration((this.clock() - this.started) / 1000)}`),
      '├' + border + '┤'];
    for (const step of this.steps.filter(step => !['Préparation', 'Connexion SFTP', 'Bilan'].includes(step.name) && step.state !== 'pending')) {
      rows.push(box(`${step.state === 'done' ? '✓' : '✕'} ${step.name}`));
      if (step.detail) rows.push(box(`  ${step.detail}`));
    }
    if (this.journal) rows.push('├' + border + '┤', box('Journal complet → npm run logs -- rezo'));
    rows.push('╰' + border + '╯');
    this.stream.write('\n' + rows.map(line => this.neon(line)).join('\n') + '\n\n');
    // Preserve the full diagnostic even when it exceeds the summary card width.
    if (!success) {
      const error = this.logs.findLast(line => /ERREUR\s*:/i.test(line));
      if (error) this.stream.write(error + '\n\n');
    }
    if (this.verbose && this.journal) this.stream.write(`Journal intégral : ${this.journal.file}\n`);
    this.journal?.close();
  }
}
module.exports = { Dashboard, clip, duration };
