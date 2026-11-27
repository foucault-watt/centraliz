const test = require("node:test");
const assert = require("node:assert");
const svc = require("./pokemonActivityService");

function memoryStore() {
  const rows = [];
  const seen = new Map();
  let id = 0;
  return {
    async insert(row) {
      if (row.dedupe_key && rows.some((r) => r.dedupe_key === row.dedupe_key)) return null;
      const full = { id: ++id, deleted: false, created_at: new Date(id * 1000).toISOString(), ...row };
      rows.push(full);
      return full;
    },
    async list({ after, before, limit }) {
      let out = rows.filter((r) => !r.deleted);
      if (after) return out.filter((r) => r.id > after).slice(0, limit);
      if (before) out = out.filter((r) => r.id < before);
      return out.sort((a, b) => b.id - a.id).slice(0, limit);
    },
    async markDeleted(target) {
      const row = rows.find((r) => r.id === target && r.kind === "chat");
      if (row) row.deleted = true;
      return Boolean(row);
    },
    async eventsAfter(after) {
      return rows.filter((r) => r.kind === "event" && !r.deleted && r.id > after);
    },
    async getLastSeen(u) { return seen.has(u) ? seen.get(u) : null; },
    async setLastSeen(u, v) { seen.set(u, v); },
    async latestId() { return id; },
  };
}

const alice = { username: "alice", displayName: "Alice" };

test("chat : nettoie, refuse le vide et le trop long, limite le débit", async () => {
  svc.setStoreForTests(memoryStore());
  assert.equal((await svc.postChat(alice, "   ")).status, 400);
  assert.equal((await svc.postChat(alice, "x".repeat(svc.MAX_CHAT_LENGTH + 1))).status, 400);
  const ok = await svc.postChat(alice, "  salut\n\nà  tous ", 10_000);
  assert.equal(ok.status, 201);
  assert.equal(ok.item.text, "salut à tous");
  assert.equal(ok.item.author, "Alice");
  assert.equal((await svc.postChat(alice, "encore", 10_500)).status, 429);
  assert.equal((await svc.postChat(alice, "encore", 10_000 + svc.CHAT_COOLDOWN_MS)).status, 201);
  assert.equal((await svc.postChat({}, "anonyme")).status, 401);
});

test("événements idempotents grâce à la clé de déduplication", async () => {
  svc.setStoreForTests(memoryStore());
  const first = await svc.recordEvent({ type: "badge", text: "Badge Roche obtenu", dedupeKey: "badge:1" });
  const again = await svc.recordEvent({ type: "badge", text: "Badge Roche obtenu", dedupeKey: "badge:1" });
  assert.ok(first);
  assert.equal(again, null);
  assert.equal((await svc.getFeed()).length, 1);
});

test("fil : ordre chronologique, nouveautés avec after, pagination avec before", async () => {
  svc.setStoreForTests(memoryStore());
  for (let i = 1; i <= 5; i++) await svc.recordEvent({ type: "capture", text: `capture ${i}` });
  const last3 = await svc.getFeed({ limit: 3 });
  assert.deepEqual(last3.map((i) => i.id), [3, 4, 5]);
  assert.deepEqual((await svc.getFeed({ before: 3, limit: 10 })).map((i) => i.id), [1, 2]);
  assert.deepEqual((await svc.getFeed({ after: 3 })).map((i) => i.id), [4, 5]);
  assert.equal(last3[0].author, null); // un événement n'a pas d'auteur
});

test("un message supprimé disparaît du fil, un événement ne peut pas l'être", async () => {
  svc.setStoreForTests(memoryStore());
  await svc.recordEvent({ type: "badge", text: "Badge" });
  const msg = await svc.postChat(alice, "spam", 50_000);
  assert.equal(await svc.deleteChat(1), false);
  assert.equal(await svc.deleteChat(msg.item.id), true);
  assert.deepEqual((await svc.getFeed()).map((i) => i.kind), ["event"]);
});

test("résumé : première visite silencieuse, puis événements manqués seulement", async () => {
  svc.setStoreForTests(memoryStore());
  await svc.recordEvent({ type: "badge", text: "ancien" });
  assert.equal((await svc.getSummary("bob")).firstVisit, true);
  await svc.recordEvent({ type: "badge", text: "Badge Cascade obtenu" });
  await svc.recordEvent({ type: "capture", text: "Rattata capturé" });
  await svc.postChat(alice, "hello", 90_000); // le chat ne compte pas
  const summary = await svc.getSummary("bob");
  assert.equal(summary.total, 2);
  assert.deepEqual(summary.byType, { badge: 1, capture: 1 });
  assert.deepEqual(summary.highlights, ["Badge Cascade obtenu", "Rattata capturé"]);
  assert.equal((await svc.getSummary("bob")).total, 0); // curseur avancé
});
