const path = require('node:path');
// Use the same Unicode cell-width implementation as our existing progress UI.
const stringWidth = require(require.resolve('string-width', { paths: [path.dirname(require.resolve('cli-progress/package.json'))] }));
const strip = text => String(text).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
const segments = new Intl.Segmenter('fr', { granularity: 'grapheme' });
function clip(text, columns) {
  const plain = strip(text);
  if (stringWidth(plain) <= columns) return plain;
  let result = '', width = 0;
  for (const { segment } of segments.segment(plain)) {
    const size = stringWidth(segment);
    if (width + size > Math.max(0, columns - 1)) break;
    result += segment; width += size;
  }
  return columns > 0 ? result + '…' : '';
}
const pad = (text, columns) => text + ' '.repeat(Math.max(0, columns - stringWidth(text)));

class TerminalRenderer {
  constructor(stream) { this.stream = stream; this.previous = []; this.active = false; }
  draw(lines) {
    if (!this.active) {
      this.stream.write('\x1b[?1049h\x1b[?25l');
      this.active = true;
    }
    const height = Math.max(1, (this.stream.rows || 36) - 1);
    const width = Math.max(1, (this.stream.columns || 100) - 1);
    const frame = lines.slice(0, height).map(line => stringWidth(line) <= width ? line : clip(line, width));
    let update = '';
    for (let row = 0; row < Math.min(height, Math.max(frame.length, this.previous.length)); row++) {
      const next = frame[row] || '', old = this.previous[row] || '';
      if (next === old) continue;
      const trailing = Math.max(0, Math.min(width, stringWidth(old)) - stringWidth(next));
      update += `\x1b[${row + 1};1H` + next + ' '.repeat(trailing);
    }
    this.previous = frame;
    if (update) this.stream.write('\x1b[?2026h' + update + '\x1b[?2026l');
  }
  leave() {
    if (this.active) this.stream.write('\x1b[?2026l\x1b[?25h\x1b[?1049l');
    this.active = false; this.previous = [];
  }
}
module.exports = { TerminalRenderer, strip, clip, pad, stringWidth };
