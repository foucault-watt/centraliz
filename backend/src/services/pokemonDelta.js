const sharp = require("sharp");

// Rectangle modifié entre deux images (pixels bruts de même taille).
//
// Plusieurs spectateurs reçoivent en général la même suite d'images : le
// rectangle (base -> image) est calculé une seule fois et partagé, via un
// petit cache borné de promesses (clé « baseId>id »). Un spectateur en
// retard a une autre base : son rectangle est calculé à part.
//
// Coût mesuré : comparaison < 1 ms, encodage webp du rectangle 1 à 3 ms.

const DELTA_CACHE_LIMIT = 64;
// Au-delà de cette part de l'écran (marche : tout défile), le rectangle pèse
// autant que l'image entière (mesuré : −0,4 %) : on ne l'encode même pas.
const MAX_AREA_RATIO = 0.9;

// Plus petit rectangle qui contient tous les pixels différents, ou null si
// les deux images sont identiques. Les lignes inchangées sont écartées par
// Buffer.compare (natif) ; on ne parcourt octet par octet que les lignes
// changées, depuis chaque bord.
function changedRect(a, b, width, height, channels) {
  const stride = width * channels;
  let top = -1;
  let bottom = -1;
  let left = stride;
  let right = -1;
  for (let y = 0; y < height; y += 1) {
    const start = y * stride;
    if (a.compare(b, start, start + stride, start, start + stride) === 0) continue;
    if (top < 0) top = y;
    bottom = y;
    let i = 0;
    while (i < left && a[start + i] === b[start + i]) i += 1;
    if (i < left) left = i;
    let j = stride - 1;
    while (j > right && a[start + j] === b[start + j]) j -= 1;
    if (j > right) right = j;
  }
  if (top < 0) return null;
  const x = Math.floor(left / channels);
  return { x, y: top, w: Math.floor(right / channels) - x + 1, h: bottom - top + 1 };
}

// Copie les pixels du rectangle dans un Buffer compact.
function cropRaw(raw, width, channels, { x, y, w, h }) {
  const stride = width * channels;
  const rowBytes = w * channels;
  const out = Buffer.allocUnsafe(rowBytes * h);
  for (let row = 0; row < h; row += 1) {
    const start = (y + row) * stride + x * channels;
    raw.copy(out, row * rowBytes, start, start + rowBytes);
  }
  return out;
}

function encodeRectWebp(pixels, { w, h, channels }) {
  return sharp(pixels, { raw: { width: w, height: h, channels } }).webp({ lossless: true }).toBuffer();
}

// `encodeRect(pixels, { w, h, channels })` -> Promise<Buffer> : injectable
// pour les tests. `delta(base, target)` -> Promise<{ x, y, w, h, base64 }>
// ou null (images identiques, tailles différentes, ou rectangle couvrant
// presque tout l'écran) : l'image entière part alors.
function createDeltaEncoder({
  encodeRect = encodeRectWebp,
  limit = DELTA_CACHE_LIMIT,
  maxAreaRatio = MAX_AREA_RATIO,
  now = () => performance.now(),
} = {}) {
  const cache = new Map(); // "baseId>id" -> Promise
  const counters = { computed: 0, shared: 0, empty: 0, tooLarge: 0, encoded: 0, compareMs: 0, encodeMs: 0 };

  async function compute(base, target) {
    const { width, height, channels } = target;
    if (base.width !== width || base.height !== height || base.channels !== channels) return null;
    if (base.raw.length !== target.raw.length) return null;
    const t0 = now();
    const rect = changedRect(base.raw, target.raw, width, height, channels);
    counters.compareMs += now() - t0;
    if (!rect) {
      counters.empty += 1;
      return null;
    }
    if (rect.w * rect.h > maxAreaRatio * width * height) {
      counters.tooLarge += 1;
      return null;
    }
    const t1 = now();
    const webp = await encodeRect(cropRaw(target.raw, width, channels, rect), { ...rect, channels });
    counters.encodeMs += now() - t1;
    counters.encoded += 1;
    return { ...rect, base64: webp.toString("base64") };
  }

  return {
    delta(base, target) {
      const key = `${base.id}>${target.id}`;
      let promise = cache.get(key);
      if (promise) {
        counters.shared += 1;
        cache.delete(key); // remise en tête
      } else {
        counters.computed += 1;
        promise = compute(base, target);
        // Un échec ne reste pas en cache : la prochaine demande réessaie.
        promise.catch(() => {
          if (cache.get(key) === promise) cache.delete(key);
        });
      }
      cache.set(key, promise);
      if (cache.size > limit) cache.delete(cache.keys().next().value);
      return promise;
    },
    stats() {
      const round = (ms, n) => Math.round((ms / (n || 1)) * 100) / 100;
      return {
        computed: counters.computed,
        shared: counters.shared,
        empty: counters.empty,
        tooLarge: counters.tooLarge,
        encoded: counters.encoded,
        avgCompareMs: round(counters.compareMs, counters.computed),
        avgEncodeMs: round(counters.encodeMs, counters.encoded),
      };
    },
    size: () => cache.size,
  };
}

module.exports = { createDeltaEncoder, changedRect, cropRaw, encodeRectWebp, DELTA_CACHE_LIMIT, MAX_AREA_RATIO };
