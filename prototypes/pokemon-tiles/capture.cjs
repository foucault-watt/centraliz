#!/usr/bin/env node
// Capture une série d'images natives via mGBA-http, en lecture seule (aucun bouton).
// À lancer SUR le serveur : node capture.cjs <dossier> <secondes> [fps]
// Écrit <dossier>/f00000.png ... et <dossier>/timing.json.
const http = require('http');
const fs = require('fs');
const path = require('path');

const [dir, secondsArg, fpsArg] = process.argv.slice(2);
const seconds = Number(secondsArg || 20);
const fps = Number(fpsArg || 30);
fs.mkdirSync(dir, { recursive: true });

function screenshot(file) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: 5000, method: 'POST',
      path: `/core/screenshot?path=${encodeURIComponent(file)}`,
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

(async () => {
  const interval = 1000 / fps;
  const start = Date.now();
  const timing = [];
  let i = 0;
  while (Date.now() - start < seconds * 1000) {
    const t0 = Date.now();
    const file = path.join(dir, `f${String(i).padStart(5, '0')}.png`);
    try {
      const code = await screenshot(file);
      timing.push({ i, at: t0 - start, ms: Date.now() - t0, code });
    } catch (e) {
      timing.push({ i, at: t0 - start, ms: Date.now() - t0, error: e.message });
    }
    i += 1;
    const wait = interval - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  await new Promise((r) => setTimeout(r, 1000)); // laisse mGBA finir d'écrire la dernière image
  fs.writeFileSync(path.join(dir, 'timing.json'), JSON.stringify(timing));
  const ms = timing.map((t) => t.ms).sort((a, b) => a - b);
  console.log(`${timing.length} captures en ${seconds} s (${(timing.length / seconds).toFixed(1)} img/s), latence médiane ${ms[ms.length >> 1]} ms`);
})();
