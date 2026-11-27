import { useCallback, useEffect, useRef, useState } from "react";
import { Medal, MessageCircle, Send, Trash2 } from "lucide-react";
import { fetchApi } from "../../utils/api";

// Fil d'activité de la partie : événements de jeu (badges, captures...) et
// chat des joueurs, dans une seule liste. Un récapitulatif « depuis la dernière
// visite » s'affiche à l'ouverture s'il s'est passé quelque chose.

const POLL_MS = 3000;
// Toutes les N actualisations, on relit la fin du fil en entier pour retirer
// les messages supprimés par un admin depuis un autre poste.
const FULL_RELOAD_EVERY = 10;
const FULL_LIMIT = 50;
const MAX_LENGTH = 300;
const FILTERS = [
  { id: "all", label: "Tout" },
  { id: "event", label: "Événements" },
  { id: "chat", label: "Chat" },
];

const time = (iso) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

async function getJson(path) {
  const response = await fetchApi(path, { method: "GET" });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function useSummary() {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getJson("/api/pokemon/summary")
      .then((data) => {
        if (!cancelled && !data.firstVisit && data.total > 0) setSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return [summary, () => setSummary(null)];
}

function useFeed() {
  const [items, setItems] = useState([]);
  const lastId = useRef(0);

  const merge = useCallback((incoming) => {
    if (!incoming.length) return;
    setItems((current) => {
      const known = new Set(current.map((item) => item.id));
      const merged = [...current, ...incoming.filter((item) => !known.has(item.id))];
      return merged.sort((a, b) => a.id - b.id).slice(-200);
    });
    lastId.current = Math.max(lastId.current, ...incoming.map((item) => item.id));
  }, []);

  // Fin du fil relue en entier : tout élément connu dans cette plage mais
  // absent de la réponse a été supprimé.
  const reconcile = useCallback((fresh) => {
    if (!fresh.length) return;
    const oldest = Math.min(...fresh.map((item) => item.id));
    const ids = new Set(fresh.map((item) => item.id));
    setItems((current) => current.filter((item) => item.id < oldest || ids.has(item.id)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let polls = 0;
    const load = async () => {
      const full = !lastId.current || polls % FULL_RELOAD_EVERY === 0;
      polls += 1;
      try {
        const query = full ? `?limit=${FULL_LIMIT}` : `?after=${lastId.current}`;
        const data = await getJson(`/api/pokemon/activity${query}`);
        if (cancelled) return;
        if (full) reconcile(data.items || []);
        merge(data.items || []);
      } catch {
        // On garde le fil déjà affiché.
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [merge, reconcile]);

  const remove = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  return { items, merge, remove };
}

export default function ActivityPanel({ isAdmin = false }) {
  const [summary, dismissSummary] = useSummary();
  const { items, merge, remove } = useFeed();
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const visible = items.filter((item) => filter === "all" || item.kind === filter);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible.length]);

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetchApi("/api/pokemon/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Message non envoyé.");
      merge([data.item]);
      setText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (item) => {
    if (!window.confirm(`Supprimer le message de ${item.author} pour tous les joueurs ?`)) return;
    setError("");
    try {
      const response = await fetchApi(`/api/pokemon/chat/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      remove(item.id);
    } catch {
      setError("Message non supprimé. Réessayer.");
    }
  };

  return (
    <section aria-label="Activité de la partie" className="space-y-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
      {summary && (
        <div className="rounded-xl bg-primary/10 p-3 text-sm text-secondary">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">
              Depuis la dernière visite : {summary.total} événement{summary.total > 1 ? "s" : ""}
            </p>
            <button type="button" onClick={dismissSummary} className="text-xs text-gray-500 underline">
              Fermer
            </button>
          </div>
          <ul className="mt-1 list-disc pl-5 text-gray-600">
            {summary.highlights.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-secondary">
          <MessageCircle size={16} className="text-primary" />
          Activité
        </h2>
        <div role="group" aria-label="Filtrer" className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === f.id ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul ref={listRef} className="max-h-72 space-y-1.5 overflow-y-auto lg:max-h-96" aria-live="polite">
        {visible.length === 0 && (
          <li className="text-sm text-gray-500">Aucun message pour l'instant.</li>
        )}
        {visible.map((item) =>
          item.kind === "event" ? (
            <li key={item.id} className="flex items-baseline gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
              <Medal size={14} className="shrink-0 self-center" aria-hidden="true" />
              <span className="flex-1">{item.text}</span>
              <span className="shrink-0 text-xs tabular-nums text-amber-700/70">{time(item.createdAt)}</span>
            </li>
          ) : (
            <li key={item.id} className="group flex items-baseline gap-2 px-1 text-sm">
              <span className="shrink-0 text-xs tabular-nums text-gray-400">{time(item.createdAt)}</span>
              <span className="flex-1 break-words">
                <span className="font-semibold text-secondary">{item.author}</span>{" "}
                <span className="text-gray-700">{item.text}</span>
              </span>
              {isAdmin && (
                <button
                  type="button"
                  aria-label="Supprimer le message"
                  onClick={() => deleteMessage(item)}
                  className="self-center text-gray-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ),
        )}
      </ul>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_LENGTH}
          placeholder="Un message pour les autres joueurs…"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Envoyer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
