#!/usr/bin/env node
// Analyse une série capturée par capture.cjs : compare l'image complète webp
// lossless (ce que sert le backend aujourd'hui) à plusieurs encodages « delta ».
//
//   node analyze.cjs <dossier>            série réelle, image N comparée à l'image N-1
//   node analyze.cjs <dossier> --scroll   simulation de marche : chaque image est
//                                         décalée de 1 à 16 px et comparée à elle-même
//
// Encodages mesurés (octets de corps HTTP, sans en-têtes) :
//   full        webp lossless de l'image entière (référence = backend actuel)
//   tilesWebp   en-tête (bitmap 75 o ou index 2 o/tuile) + tuiles changées rangées
//               en grille de 30 colonnes, webp lossless
//   tilesPng    idem en PNG (compression 9)
//   tilesZ24    idem, pixels RGB bruts passés à deflate (zlib 9)
//   tilesZ15    idem, pixels en 15 bits (format natif GBA, sans perte) + deflate
//   bbox        rectangle englobant les tuiles changées, webp lossless + 8 o d'en-tête
//   hybrid*     le plus petit entre le delta (tilesWebp ou bbox) et l'image complète (+1 o de type)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let sharp;
try { sharp = require('/home/fwattinne/centraliz/backend/node_modules/sharp'); } catch { sharp = require('sharp'); }

const W = 240, H = 160, T = 8, TX = W / T, TY = H / T, NT = TX * TY; // 30 x 20 = 600 tuiles

async function decode(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H || info.channels !== 3) throw new Error(`format inattendu ${file}`);
  return data;
}

const webp = (buf, w, h) => sharp(buf, { raw: { width: w, height: h, channels: 3 } }).webp({ lossless: true }).toBuffer();
const png = (buf, w, h) => sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();

function tileEqual(a, b, tx, ty) {
  for (let y = 0; y < T; y++) {
    const off = ((ty * T + y) * W + tx * T) * 3;
    if (a.compare(b, off, off + T * 3, off, off + T * 3) !== 0) return false;
  }
  return true;
}

function changedTiles(prev, cur) {
  const list = [];
  for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) if (!tileEqual(prev, cur, tx, ty)) list.push(ty * TX + tx);
  return list;
}

// Range les tuiles changées dans une image 240 x (8 * lignes), 30 tuiles par ligne.
function packTiles(cur, list) {
  const cols = Math.min(list.length, TX), rows = Math.ceil(list.length / TX);
  const w = cols * T, h = rows * T;
  const out = Buffer.alloc(w * h * 3);
  list.forEach((idx, k) => {
    const sx = (idx % TX) * T, sy = Math.floor(idx / TX) * T;
    const dx = (k % TX) * T, dy = Math.floor(k / TX) * T;
    for (let y = 0; y < T; y++) cur.copy(out, ((dy + y) * w + dx) * 3, ((sy + y) * W + sx) * 3, ((sy + y) * W + sx + T) * 3);
  });
  return { buf: out, w, h };
}

function to15bit(rgb) {
  const out = Buffer.alloc((rgb.length / 3) * 2);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 2) out.writeUInt16LE((rgb[i] >> 3) | ((rgb[i + 1] >> 3) << 5) | ((rgb[i + 2] >> 3) << 10), j);
  return out;
}

const headerBytes = (n) => 2 + Math.min(75, 2 * n); // compteur + (bitmap 600 bits ou liste d'index)

async function measure(prev, cur) {
  const r = {};
  let t = Date.now();
  r.full = (await webp(cur, W, H)).length;
  r.msFull = Date.now() - t;
  t = Date.now();
  const list = changedTiles(prev, cur);
  r.msDiff = Date.now() - t;
  r.tiles = list.length;
  if (list.length === 0) return r;
  const { buf, w, h } = packTiles(cur, list);
  const hdr = headerBytes(list.length);
  t = Date.now();
  r.tilesWebp = hdr + (await webp(buf, w, h)).length;
  r.msTilesWebp = Date.now() - t;
  r.tilesPng = hdr + (await png(buf, w, h)).length;
  r.tilesZ24 = hdr + zlib.deflateRawSync(buf, { level: 9 }).length;
  r.tilesZ15 = hdr + zlib.deflateRawSync(to15bit(buf), { level: 9 }).length;
  // rectangle englobant
  const xs = list.map((i) => i % TX), ys = list.map((i) => Math.floor(i / TX));
  const x0 = Math.min(...xs) * T, x1 = (Math.max(...xs) + 1) * T, y0 = Math.min(...ys) * T, y1 = (Math.max(...ys) + 1) * T;
  const bw = x1 - x0, bh = y1 - y0, crop = Buffer.alloc(bw * bh * 3);
  for (let y = 0; y < bh; y++) cur.copy(crop, y * bw * 3, ((y0 + y) * W + x0) * 3, ((y0 + y) * W + x1) * 3);
  r.bbox = 8 + (await webp(crop, bw, bh)).length;
  r.bboxArea = (bw * bh) / (W * H);
  // variantes « hybrides » : le serveur envoie le plus petit des deux (delta ou image complète)
  r.hybridTiles = Math.min(r.full + 1, r.tilesWebp);
  r.hybridBbox = Math.min(r.full + 1, r.bbox);
  return r;
}

// Décale l'image de (dx, dy) ; la bande découverte reprend le bord opposé
// (approximation de « nouvelle portion de carte »).
function shift(img, dx, dy) {
  const out = Buffer.alloc(img.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = (x + dx + W) % W, sy = (y + dy + H) % H;
    img.copy(out, (y * W + x) * 3, (sy * W + sx) * 3, (sy * W + sx) * 3 + 3);
  }
  return out;
}

const KEYS = ['full', 'tilesWebp', 'tilesPng', 'tilesZ24', 'tilesZ15', 'bbox', 'hybridTiles', 'hybridBbox'];
function stats(rows, key) {
  const v = rows.map((r) => r[key]).filter((x) => x !== undefined).sort((a, b) => a - b);
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { n: v.length, mean: Math.round(mean), p50: q(0.5), p95: q(0.95), max: v[v.length - 1] };
}

(async () => {
  const [dir, mode] = process.argv.slice(2);
  const files = fs.readdirSync(dir).filter((f) => /^f\d+\.png$/.test(f)).sort();
  const frames = [];
  let unreadable = 0;
  for (const f of files) {
    try { frames.push(await decode(path.join(dir, f))); } catch { unreadable += 1; }
  }

  if (mode === '--scroll') {
    // 8 images réparties dans la série, décalées horizontalement et verticalement.
    const picks = [...new Set(Array.from({ length: 8 }, (_, k) => Math.floor((k * frames.length) / 8)))].map((i) => frames[i]);
    const out = {};
    for (const d of [1, 2, 4, 8, 16]) {
      const rows = [];
      for (const img of picks) {
        rows.push(await measure(img, shift(img, d, 0)));
        rows.push(await measure(img, shift(img, 0, d)));
      }
      out[`${d}px`] = { tiles: stats(rows, 'tiles'), ...Object.fromEntries(KEYS.map((k) => [k, stats(rows, k)])) };
    }
    console.log(JSON.stringify({ dir, mode: 'scroll', samples: picks.length * 2, results: out }, null, 1));
    return;
  }

  const rows = [];
  let identical = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].equals(frames[i - 1])) { identical += 1; continue; }
    rows.push(await measure(frames[i - 1], frames[i]));
  }
  const timing = fs.existsSync(path.join(dir, 'timing.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'timing.json'))) : [];
  const duration = timing.length ? (timing[timing.length - 1].at + 33) / 1000 : frames.length / 30;
  const sum = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
  const tileHist = { '1-10': 0, '11-50': 0, '51-150': 0, '151-400': 0, '401-600': 0 };
  for (const r of rows) {
    const n = r.tiles;
    tileHist[n <= 10 ? '1-10' : n <= 50 ? '11-50' : n <= 150 ? '51-150' : n <= 400 ? '151-400' : '401-600'] += 1;
  }
  console.log(JSON.stringify({
    dir, frames: frames.length, unreadable, durationS: +duration.toFixed(1),
    identical, identicalPct: +((100 * identical) / Math.max(1, frames.length - 1)).toFixed(1),
    changed: rows.length,
    tiles: stats(rows, 'tiles'), tileHist,
    bytesChangedFrames: Object.fromEntries(KEYS.map((k) => [k, stats(rows, k)])),
    // corps envoyés par seconde à UN joueur (les images identiques coûtent un 304 sans corps)
    bodyBytesPerSecond: Object.fromEntries(KEYS.map((k) => [k, Math.round((k === 'full' ? sum('full') : sum(k)) / duration)])),
    cpuMs: { fullWebp: stats(rows, 'msFull'), diff: stats(rows, 'msDiff'), tilesWebp: stats(rows, 'msTilesWebp') },
  }, null, 1));
})();
