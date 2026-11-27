// Fil d'activité de la partie Pokémon : événements de jeu + chat.
// Toute la logique est ici ; le stockage est injecté (Supabase en production,
// mémoire dans les tests).

const MAX_CHAT_LENGTH = 300;
const CHAT_COOLDOWN_MS = 2000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const lastChatAt = new Map(); // username -> timestamp du dernier message

function createSupabaseStore() {
  const supabase = require("../utils/supabaseClient");
  const fail = (error) => {
    if (error) throw new Error(error.message || "Erreur base de données");
  };
  return {
    async insert(row) {
      const { data, error } = await supabase.from("pokemon_activity").insert(row).select().single();
      // 23505 = clé de déduplication déjà présente : l'événement existe déjà.
      if (error && error.code === "23505") return null;
      fail(error);
      return data;
    },
    async list({ after, before, limit }) {
      let query = supabase.from("pokemon_activity").select("*").eq("deleted", false);
      if (after) query = query.gt("id", after).order("id", { ascending: true });
      else {
        if (before) query = query.lt("id", before);
        query = query.order("id", { ascending: false });
      }
      const { data, error } = await query.limit(limit);
      fail(error);
      return data || [];
    },
    async markDeleted(id) {
      const { data, error } = await supabase
        .from("pokemon_activity")
        .update({ deleted: true })
        .eq("id", id)
        .eq("kind", "chat")
        .select("id");
      fail(error);
      return (data || []).length > 0;
    },
    async eventsAfter(id) {
      const { data, error } = await supabase
        .from("pokemon_activity")
        .select("id, type, text")
        .eq("kind", "event")
        .eq("deleted", false)
        .gt("id", id)
        .order("id", { ascending: true })
        .limit(MAX_LIMIT);
      fail(error);
      return data || [];
    },
    async getLastSeen(username) {
      const { data, error } = await supabase
        .from("pokemon_last_seen")
        .select("last_seen_id")
        .eq("username", username)
        .maybeSingle();
      fail(error);
      return data ? Number(data.last_seen_id) : null;
    },
    async setLastSeen(username, id) {
      const { error } = await supabase
        .from("pokemon_last_seen")
        .upsert({ username, last_seen_id: id, updated_at: new Date().toISOString() });
      fail(error);
    },
    async latestId() {
      const { data, error } = await supabase
        .from("pokemon_activity")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      fail(error);
      return data && data[0] ? Number(data[0].id) : 0;
    },
  };
}

let store = null;
const getStore = () => (store ||= createSupabaseStore());
function setStoreForTests(fake) {
  store = fake;
  lastChatAt.clear();
}

const toItem = (row) => ({
  id: Number(row.id),
  kind: row.kind,
  type: row.type,
  author: row.kind === "chat" ? row.display_name || row.username : null,
  username: row.kind === "chat" ? row.username : null,
  text: row.text,
  createdAt: row.created_at,
});

function clampLimit(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanChatText(value) {
  // Espaces et caractères de contrôle écrasés : pas de message vide ni multi-lignes.
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Événement de jeu détecté (badge, capture...). `dedupeKey` rend l'appel idempotent.
async function recordEvent({ type, text, payload = {}, dedupeKey = null }) {
  if (!type || !text) throw new Error("type et text requis");
  const row = await getStore().insert({
    kind: "event",
    type,
    text: String(text).slice(0, 300),
    payload,
    dedupe_key: dedupeKey,
  });
  return row ? toItem(row) : null;
}

async function postChat({ username, displayName }, rawText, now = Date.now()) {
  const text = cleanChatText(rawText);
  if (!username) return { status: 401, error: "Connexion requise." };
  if (!text) return { status: 400, error: "Message vide." };
  if (text.length > MAX_CHAT_LENGTH) {
    return { status: 400, error: `Message trop long (${MAX_CHAT_LENGTH} caractères maximum).` };
  }
  const previous = lastChatAt.get(username) || 0;
  if (now - previous < CHAT_COOLDOWN_MS) {
    return { status: 429, error: "Doucement, un message toutes les 2 secondes." };
  }
  lastChatAt.set(username, now);
  const row = await getStore().insert({
    kind: "chat",
    type: "message",
    username,
    display_name: displayName || username,
    text,
  });
  return { status: 201, item: toItem(row) };
}

// Sans `after` : les `limit` derniers éléments, du plus ancien au plus récent
// (`before` pagine vers le passé). Avec `after` : les nouveautés, dans l'ordre.
async function getFeed({ after, before, limit } = {}) {
  const rows = await getStore().list({
    after: parseId(after),
    before: parseId(before),
    limit: clampLimit(limit),
  });
  const items = rows.map(toItem);
  return after ? items : items.reverse();
}

async function deleteChat(id) {
  const parsed = parseId(id);
  if (!parsed) return false;
  return getStore().markDeleted(parsed);
}

// « Depuis ta dernière visite » : événements de jeu manqués, puis curseur avancé.
// Première visite : on pose le curseur sans rien afficher.
async function getSummary(username) {
  const s = getStore();
  const [lastSeen, latest] = await Promise.all([s.getLastSeen(username), s.latestId()]);
  if (lastSeen === null) {
    await s.setLastSeen(username, latest);
    return { firstVisit: true, since: 0, total: 0, byType: {}, highlights: [] };
  }
  const events = await s.eventsAfter(lastSeen);
  const byType = {};
  for (const event of events) byType[event.type] = (byType[event.type] || 0) + 1;
  if (latest > lastSeen) await s.setLastSeen(username, latest);
  return {
    firstVisit: false,
    since: lastSeen,
    total: events.length,
    byType,
    highlights: events.slice(-5).map((event) => event.text),
  };
}

module.exports = {
  MAX_CHAT_LENGTH,
  CHAT_COOLDOWN_MS,
  recordEvent,
  postChat,
  getFeed,
  deleteChat,
  getSummary,
  cleanChatText,
  setStoreForTests,
};
