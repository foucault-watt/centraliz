#!/usr/bin/env node
// Mesure le gain du rectangle « delta » du flux SSE, avec le vrai
// createSseSender (faux res) et le vrai encodeur sharp.
//
//   node prototypes/pokemon-delta/measure.cjs <dossier>      série réelle de capture.cjs
//                                                             (f00000.png..., timing.json)
//   node prototypes/pokemon-delta/measure.cjs --synthetic    série reconstituée à partir des
//                                                             4 scènes réelles de pokemon-tiles
//   option --viewers=N : N spectateurs sur le même encodeur partagé (défaut 10)
//
// Compare « image entière seule » (deltas: null, comportement d'avant) et
// « avec delta ». Les octets comptés sont ceux des événements SSE écrits.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { EventEmitter } = require("events");

const ROOT = path.join(__dirname, "..", "..");
const sharp = require(path.join(ROOT, "backend", "node_modules", "sharp"));
const { createSseSender } = require(path.join(ROOT, "backend", "src", "services", "pokemonSse"));
const { createDeltaEncoder, changedRect } = require(path.join(ROOT, "backend", "src", "services", "pokemonDelta"));

const W = 240;
const H = 160;
const FPS = 30;
const args = process.argv.slice(2);
const viewers = Number((args.find((a) => a.startsWith("--viewers=")) || "--viewers=10").split("=")[1]);

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] || 0;
const stat = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mean = s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0;
  return { n: s.length, mean: +mean.toFixed(2), p95: +pct(s, 95).toFixed(2), max: +(s.at(-1) || 0).toFixed(2) };
};

// --- Séries d'images (Buffers RGB bruts W×H×3) -------------------------------

async function decode(file) {
  const { data } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

async function loadReal(dir) {
  const files = fs.readdirSync(dir).filter((f) => /^f\d+\.png$/.test(f)).sort();
  let timing = [];
  try { timing = JSON.parse(fs.readFileSync(path.join(dir, "timing.json"), "utf8")); } catch {}
  const out = [];
  for (let i = 0; i < files.length; i += 1) {
    try {
      out.push({ at: timing[i] ? timing[i].at : (i * 1000) / FPS, raw: await decode(path.join(dir, files[i])), scene: path.basename(dir) });
    } catch {
      // image illisible (écriture en cours) : ignorée comme par le backend
    }
  }
  return out;
}

// Copie un bloc (sx, sy, w, h) de src vers (dx, dy) de dst.
function blit(dst, src, sx, sy, dx, dy, w, h) {
  for (let y = 0; y < h; y += 1) {
    const yy = dy + y;
    if (yy < 0 || yy >= H || sy + y < 0 || sy + y >= H) continue;
    src.copy(dst, (yy * W + dx) * 3, ((sy + y) * W + sx) * 3, ((sy + y) * W + sx + w) * 3);
  }
}
// Défilement (avec bouclage) de dx, dy pixels.
function scroll(src, dx, dy) {
  const out = Buffer.alloc(src.length);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const sx = (((x + dx) % W) + W) % W;
      const sy = (((y + dy) % H) + H) % H;
      src.copy(out, (y * W + x) * 3, (sy * W + sx) * 3, (sy * W + sx) * 3 + 3);
    }
  }
  return out;
}

async function loadSynthetic() {
  const dir = path.join(ROOT, "prototypes", "pokemon-tiles", "scenes");
  const [s1, s2, s3, s4] = await Promise.all(["s1", "s2", "s3", "s4"].map((s) => decode(path.join(dir, `${s}.png`))));
  const frames = [];
  const push = (raw, scene) => frames.push({ at: (frames.length * 1000) / FPS, raw, scene });
  const seconds = (s) => Math.round(s * FPS);

  // 1. Immobile (labo) : une petite animation 16×16 qui alterne toutes les 8 captures.
  {
    const alt = Buffer.from(s1);
    blit(alt, s1, 32, 32, 112, 64, 16, 16);
    for (let i = 0; i < seconds(7); i += 1) push(Math.floor(i / 8) % 2 ? alt : s1, "immobile");
  }
  // 2. Marche : 16 px en 8 captures (2 px/capture à 30 img/s), puis 10 captures à l'arrêt.
  {
    let offset = 0;
    for (let i = 0; i < seconds(7); ) {
      for (let k = 0; k < 8 && i < seconds(7); k += 1, i += 1) { offset += 2; push(scroll(s2, offset, 0), "marche"); }
      for (let k = 0; k < 10 && i < seconds(7); k += 1, i += 1) push(scroll(s2, offset, 0), "marche");
    }
  }
  // 3. Dialogue : la boîte de texte (bas de l'écran) se remplit lettre à lettre.
  {
    const blank = Buffer.from(s3);
    const box = { x: 16, y: 118, w: 208, h: 34 };
    for (let y = box.y; y < box.y + box.h; y += 1) blank.fill(248, (y * W + box.x) * 3, (y * W + box.x + box.w) * 3);
    for (let i = 0; i < seconds(8); i += 1) {
      const shown = Math.min(box.w * 2, (i >> 1) * 6); // 6 px (une lettre) toutes les 2 captures, 2 lignes
      const f = Buffer.from(blank);
      const line1 = Math.min(shown, box.w);
      blit(f, s3, box.x, box.y, box.x, box.y, line1, box.h / 2);
      if (shown > box.w) blit(f, s3, box.x, box.y + box.h / 2, box.x, box.y + box.h / 2, shown - box.w, box.h / 2);
      push(f, "dialogue");
    }
  }
  // 4. Combat : le sprite adverse ondule (±1 px toutes les 6 captures), la barre de PV descend.
  {
    for (let i = 0; i < seconds(8); i += 1) {
      const f = Buffer.from(s4);
      const bob = Math.floor(i / 6) % 2;
      if (bob) { const sprite = Buffer.from(s4); blit(f, sprite, 140, 16, 140, 17, 64, 56); }
      const hp = Math.max(0, 48 - Math.floor(i / 4));
      for (let y = 34; y < 37; y += 1) f.fill(40, (y * W + 50 + hp) * 3, (y * W + 98) * 3);
      push(f, "combat");
    }
  }
  return frames;
}

// --- Rejeu dans createSseSender ----------------------------------------------

function fakeRes() {
  const res = new EventEmitter();
  res.bytes = 0;
  res.counts = {};
  res.write = (chunk) => {
    res.bytes += chunk.length;
    const kind = (/event: (\w+)/.exec(chunk) || [])[1] || "autre";
    res.counts[kind] = (res.counts[kind] || 0) + 1;
    return true;
  };
  return res;
}

async function replay(series, label) {
  // Pipeline du service de capture : SHA-1, image différente -> webp + pixels bruts.
  const published = [];
  const encodeFullMs = [];
  const cache = new Map();
  let lastId = null;
  for (const { at, raw, scene } of series) {
    const id = crypto.createHash("sha1").update(raw).digest("base64url").slice(0, 16);
    if (id === lastId) continue;
    lastId = id;
    let entry = cache.get(id);
    if (!entry) {
      const t0 = performance.now();
      const buffer = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).webp({ lossless: true }).toBuffer();
      encodeFullMs.push(performance.now() - t0);
      entry = { buffer, base64: buffer.toString("base64") };
      cache.set(id, entry);
    }
    published.push({ id, buffer: entry.buffer, base64: entry.base64, raw, width: W, height: H, channels: 3, capturedAt: at, scene });
  }
  const durationS = (series.at(-1).at - series[0].at) / 1000 + 1 / FPS;

  async function run(useDelta, nViewers) {
    let pending = Promise.resolve();
    const deltaMs = [];
    const shared = useDelta ? createDeltaEncoder() : null;
    const deltas = useDelta
      ? {
          delta(base, target) {
            const t0 = performance.now();
            const p = shared.delta(base, target);
            p.then(() => deltaMs.push(performance.now() - t0), () => {});
            pending = p;
            return p;
          },
        }
      : null;
    const conns = Array.from({ length: nViewers }, () => {
      const res = fakeRes();
      return { res, sender: createSseSender(res, { fps: 1000, padBytes: 0, now: () => clock, deltas }) };
    });
    let clock = 0;
    const perScene = {};
    for (const f of published) {
      clock = f.capturedAt + 1000;
      const before = conns[0].res.bytes;
      conns.forEach((c) => c.sender.offer(f));
      await pending.catch(() => {});
      await new Promise((r) => setImmediate(r));
      const s = (perScene[f.scene] = perScene[f.scene] || { bytes: 0, frames: 0 });
      s.bytes += conns[0].res.bytes - before;
      s.frames += 1;
    }
    return { res: conns[0].res, stats: conns[0].sender.stats, deltaMs, perScene, encoder: shared && shared.stats() };
  }

  const full = await run(false, 1);
  const delta = await run(true, 1);
  const multi = await run(true, viewers);

  // Coût de la seule comparaison, image par image.
  const compareMs = [];
  for (let i = 1; i < published.length; i += 1) {
    const t0 = performance.now();
    changedRect(published[i - 1].raw, published[i].raw, W, H, 3);
    compareMs.push(performance.now() - t0);
  }

  const scenes = Object.keys(full.perScene).map((scene) => {
    const secs = series.filter((f) => f.scene === scene).length / FPS;
    const a = full.perScene[scene].bytes / secs / 1024;
    const b = delta.perScene[scene].bytes / secs / 1024;
    return { scene, seconds: +secs.toFixed(1), changedFrames: full.perScene[scene].frames, fullKoS: +a.toFixed(1), deltaKoS: +b.toFixed(1), gainPct: +((1 - b / a) * 100).toFixed(0) };
  });

  return {
    label,
    captures: series.length,
    durationS: +durationS.toFixed(1),
    publishedFrames: published.length,
    totals: {
      fullKoS: +(full.res.bytes / durationS / 1024).toFixed(1),
      deltaKoS: +(delta.res.bytes / durationS / 1024).toFixed(1),
      gainPct: +((1 - delta.res.bytes / full.res.bytes) * 100).toFixed(0),
    },
    events: { full: full.res.counts, delta: delta.res.counts },
    senderStats: delta.stats,
    scenes,
    cpuMs: {
      fullWebpEncode: stat(encodeFullMs),
      compareOnly: stat(compareMs),
      deltaCompareEncode: stat(delta.deltaMs),
      encoder: delta.encoder,
    },
    viewers: { n: viewers, computed: multi.encoder.computed, shared: multi.encoder.shared },
  };
}

(async () => {
  const synthetic = args.includes("--synthetic");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!synthetic && !dir) {
    console.error("Usage : measure.cjs <dossier> | --synthetic [--viewers=N]");
    process.exit(1);
  }
  const series = synthetic ? await loadSynthetic() : await loadReal(dir);
  const result = await replay(series, synthetic ? "synthétique (scènes réelles s1-s4)" : dir);
  console.log(JSON.stringify(result, null, 1));
})();
