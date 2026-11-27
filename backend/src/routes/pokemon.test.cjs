const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const express = require("express");

// Faux modules injectés avant de charger la route.
const stub = (rel, exports) => {
  const file = require.resolve(path.join(__dirname, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
let frameId = "abc";
stub("../middlewares/auth", (req, res, next) => { req.session = { user: { userName: "alice" } }; next(); });
const streamSubscribers = new Set();
stub("../services/pokemonService", {
  clampFps: (v) => (Number(v) > 0 ? Math.min(Number(v), 30) : null),
  subscribe: ({ onFrame }) => {
    streamSubscribers.add(onFrame);
    onFrame({ id: "first", buffer: Buffer.from("premiere"), capturedAt: Date.now() });
    return () => streamSubscribers.delete(onFrame);
  },
  ALLOWED_BUTTONS: ["A"],
  getFrameBuffer: () => ({ buffer: Buffer.from("webp-bytes"), format: "webp", lastFrameAt: new Date().toISOString(), frameId, ageMs: 12 }),
});

const router = require("./pokemon");

test("répond 304 sans corps quand le navigateur a déjà l'image", async () => {
  const app = express();
  app.use("/api/pokemon", router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/pokemon/frame?fps=30`;
  try {
    const first = await fetch(base);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("etag"), '"abc"');
    assert.equal(first.headers.get("x-frame-age-ms"), "12");
    assert.equal((await first.arrayBuffer()).byteLength, 10);

    const same = await fetch(base, { headers: { "If-None-Match": '"abc"', "Cache-Control": "no-cache" } });
    assert.equal(same.status, 304);
    assert.equal((await same.arrayBuffer()).byteLength, 0);

    frameId = "def";
    const changed = await fetch(base, { headers: { "If-None-Match": '"abc"' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.headers.get("etag"), '"def"');
  } finally {
    server.close();
  }
});

// Lit un flux SSE jusqu'à `count` événements.
async function readEvents(response, count) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const events = [];
  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    let index;
    while ((index = text.indexOf("\n\n")) >= 0) {
      const block = text.slice(0, index);
      text = text.slice(index + 2);
      const event = /^event: (.+)$/m.exec(block);
      const data = /^data: (.+)$/m.exec(block);
      if (event && data) events.push({ event: event[1], data: JSON.parse(data[1]) });
    }
  }
  return { events, reader };
}

test("le flux SSE envoie les images au fil de l'eau et se désabonne à la déconnexion", async () => {
  const app = express();
  app.use("/api/pokemon", router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/pokemon`;
  try {
    const response = await fetch(`${base}/stream?fps=30`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.equal(response.headers.get("x-accel-buffering"), "no");

    setTimeout(() => {
      for (const onFrame of streamSubscribers) onFrame({ id: "second", buffer: Buffer.from("seconde"), capturedAt: Date.now() });
    }, 100);
    const { events, reader } = await readEvents(response, 2);
    assert.deepEqual(events.map((e) => e.data.id), ["first", "second"]);
    assert.equal(Buffer.from(events[1].data.img, "base64").toString(), "seconde");
    assert.equal(streamSubscribers.size, 1);

    await reader.cancel();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(streamSubscribers.size, 0, "désabonné après la déconnexion");
  } finally {
    server.close();
  }
});

test("le test public du flux envoie 10 ticks espacés puis se ferme", async () => {
  const app = express();
  app.use("/api/pokemon", router);
  const server = app.listen(0);
  try {
    const started = Date.now();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pokemon/stream-test`);
    const { events } = await readEvents(response, 10);
    assert.equal(events.length, 10);
    assert.ok(Date.now() - started >= 2000, "les ticks arrivent au fil de l'eau");
  } finally {
    server.close();
  }
});
