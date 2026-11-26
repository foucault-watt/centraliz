import { ArrowDown, ArrowUp, Gamepad2, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchApi } from "../utils/api";
import LoadingSkeleton from "./LoadingSkeleton";

const minutes = (value) => (value == null ? "—" : `${Math.round((value / 60) * 10) / 10} min`);

const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const PANEL = "rounded-2xl border border-gray-200/80 bg-white shadow-sm";

const Stat = ({ label, value, detail }) => (
  <div className={`${PANEL} p-3 md:p-4`}>
    <p className="text-[0.7rem] md:text-xs font-bold uppercase text-gray-500">{label}</p>
    <p className="mt-1 text-2xl font-extrabold text-secondary">{value}</p>
    {detail && <p className="text-xs text-gray-500">{detail}</p>}
  </div>
);

const PlayerName = ({ entry }) => {
  const name = entry.displayName || entry.label;
  if (!entry.account) return <span className="text-gray-500">{name}</span>;
  return (
    <a
      className="font-semibold text-primary hover:underline"
      href={`/analytics/admin/users/${encodeURIComponent(entry.account)}?module=musee`}
    >
      {name}
    </a>
  );
};

// Tableau triable : clic sur un en-tête pour trier, re-clic pour inverser.
const SortableTable = ({ columns, rows, initialSort, rowKey, empty }) => {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const column = columns.find((col) => col.key === sort.key);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const va = column.sortValue(a);
      const vb = column.sortValue(b);
      const order = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.desc ? -order : order;
    });
  }, [columns, rows, sort]);

  if (!rows.length) return <p className="p-4 text-sm text-gray-500">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {columns.map((col) => {
              const active = sort.key === col.key;
              return (
                <th key={col.key} className={`whitespace-nowrap px-3 py-2.5 font-semibold ${col.align === "right" ? "text-right" : ""}`}>
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => setSort({ key: col.key, desc: active ? !sort.desc : true })}
                      className={`inline-flex items-center gap-1 hover:text-secondary ${active ? "text-secondary" : ""}`}
                    >
                      {col.label}
                      {active && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((row, index) => (
            <tr key={rowKey(row, index)} className="hover:bg-gray-50/70">
              {columns.map((col) => (
                <td key={col.key} className={`whitespace-nowrap px-3 py-2.5 ${col.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LevelChips = ({ started = [], completed = [] }) => {
  if (!started.length) return <span className="text-gray-400">—</span>;
  const done = new Set(completed);
  return (
    <span className="flex flex-wrap gap-1">
      {started.map((level) => (
        <span
          key={level}
          className={`rounded px-1.5 py-0.5 text-[0.7rem] font-semibold ${
            done.has(level) ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}
          title={done.has(level) ? "Réussi" : "Commencé"}
        >
          {level}
        </span>
      ))}
    </span>
  );
};

const SESSION_COLUMNS = [
  { key: "player", label: "Joueur", render: (s) => <PlayerName entry={s} />, sortValue: (s) => (s.displayName || s.label).toLowerCase() },
  { key: "startedAt", label: "Date", render: (s) => dateTime(s.startedAt), sortValue: (s) => s.startedAt || "" },
  { key: "activeSeconds", label: "Temps actif", align: "right", render: (s) => minutes(s.activeSeconds), sortValue: (s) => s.activeSeconds },
  { key: "completed", label: "Réussis", align: "right", render: (s) => s.levelsCompleted.length, sortValue: (s) => s.levelsCompleted.length },
  { key: "levels", label: "Niveaux", render: (s) => <LevelChips started={s.levelsStarted} completed={s.levelsCompleted} /> },
  {
    key: "ready",
    label: "Jeu chargé",
    render: (s) => (s.ready ? <span className="text-emerald-600">Oui</span> : <span className="text-amber-600">Non</span>),
    sortValue: (s) => Number(s.ready),
  },
];

const PLAYER_COLUMNS = [
  { key: "player", label: "Joueur", render: (p) => <PlayerName entry={p} />, sortValue: (p) => (p.displayName || p.label).toLowerCase() },
  { key: "group", label: "Promo", render: (p) => p.group || "—", sortValue: (p) => p.group || "" },
  { key: "lastPlayedAt", label: "Dernière partie", render: (p) => dateTime(p.lastPlayedAt), sortValue: (p) => p.lastPlayedAt || "" },
  { key: "sessions", label: "Sessions", align: "right", render: (p) => p.sessions ?? "—", sortValue: (p) => p.sessions || 0 },
  { key: "completed", label: "Réussis", align: "right", render: (p) => p.levelsCompleted.length, sortValue: (p) => p.levelsCompleted.length },
  { key: "activeSeconds", label: "Temps actif", align: "right", render: (p) => minutes(p.activeSeconds), sortValue: (p) => p.activeSeconds },
  { key: "levels", label: "Niveaux", render: (p) => <LevelChips started={p.levelsStarted} completed={p.levelsCompleted} /> },
];

const LEVEL_COLUMNS = [
  { key: "level", label: "Niveau", render: (l) => <span className="font-semibold text-secondary">{l.levelId}</span>, sortValue: (l) => l.index },
  { key: "players", label: "Joueurs", align: "right", render: (l) => l.players, sortValue: (l) => l.players },
  { key: "starts", label: "Tentatives", align: "right", render: (l) => l.starts, sortValue: (l) => l.starts },
  {
    key: "rate",
    label: "Réussite",
    render: (l) => (
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
          <span className="block h-full bg-emerald-500" style={{ width: `${l.completionRate}%` }} />
        </span>
        <span className="tabular-nums">{`${l.completionRate} %`}</span>
      </span>
    ),
    sortValue: (l) => l.completionRate,
  },
  { key: "median", label: "Durée médiane", align: "right", render: (l) => minutes(l.medianCompletionSeconds), sortValue: (l) => l.medianCompletionSeconds ?? -1 },
  { key: "moves", label: "Déplacements", align: "right", render: (l) => l.moves, sortValue: (l) => l.moves },
  { key: "details", label: "Fiches", align: "right", render: (l) => l.detailViews, sortValue: (l) => l.detailViews },
  { key: "reveals", label: "Réponses montrées", align: "right", render: (l) => l.answerReveals, sortValue: (l) => l.answerReveals },
];

const Section = ({ icon: Icon, title, subtitle, children }) => (
  <section className={PANEL}>
    <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-3">
      <span className="hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={17} />
      </span>
      <div>
        <h3 className="font-bold text-secondary">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </header>
    {children}
  </section>
);

export default function MuseeAnalyticsPanel({ range = "30d", hideExcluded = true }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSummary(null); setError("");
    fetchApi(`/api/analytics/musee/summary?range=${encodeURIComponent(range)}&hideExcluded=${hideExcluded}`)
      .then(async response => {
        if (response.status === 404) {
          throw new Error("L’API des statistiques du Musée est absente du serveur. Le backend Centraliz doit être mis à jour puis redémarré.");
        }
        if (response.status === 401) throw new Error("Ta session a expiré. Reconnecte-toi à Centraliz.");
        if (response.status === 403) throw new Error("Ces statistiques sont réservées aux administrateurs.");
        if (!response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Le serveur ne renvoie pas les statistiques au format attendu. Vérifie le routage de l’API.");
        }
        const data = await response.json();
        if (!response.ok || !data.success || !data.summary) throw new Error("Statistiques du Musée indisponibles.");
        if (active) setSummary(data.summary);
      }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [range, hideExcluded]);

  if (error) return <p role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-danger">{error}</p>;
  if (!summary) return <LoadingSkeleton label="Chargement des statistiques du Musée…" rows={4} />;

  const sessionList = summary.sessionList || [];
  const completedTotal = summary.levels.reduce((sum, level) => sum + level.completions, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Joueurs" value={summary.players} detail={`${summary.accounts} connectés · ${summary.anonymousBrowsers} anonymes`} />
        <Stat label="Sessions" value={summary.sessions} detail={`${summary.readySessions} avec le jeu chargé`} />
        <Stat label="Clics sur Jouer" value={summary.playClicks} />
        <Stat label="Niveaux réussis" value={completedTotal} />
      </div>

      <Section
        icon={Gamepad2}
        title="Sessions"
        subtitle="Chaque partie lancée, la plus récente d'abord. En vert : niveau réussi, en gris : commencé."
      >
        <SortableTable
          columns={SESSION_COLUMNS}
          rows={sessionList}
          initialSort={{ key: "startedAt", desc: true }}
          rowKey={(row) => row.sessionId}
          empty="Aucune session sur cette période."
        />
      </Section>

      <Section icon={Users} title="Joueurs" subtitle="Qui joue, depuis quand, et jusqu'où.">
        <SortableTable
          columns={PLAYER_COLUMNS}
          rows={summary.participants}
          initialSort={{ key: "lastPlayedAt", desc: true }}
          rowKey={(row, index) => row.account || `${row.label}-${index}`}
          empty="Aucun joueur sur cette période."
        />
      </Section>

      <Section
        icon={Trophy}
        title="Niveaux"
        subtitle="Les durées comptent le temps actif. Le taux compare les tentatives commencées pendant la période."
      >
        <SortableTable
          columns={LEVEL_COLUMNS}
          rows={summary.levels}
          initialSort={{ key: "level", desc: false }}
          rowKey={(row) => row.levelId}
          empty="Aucune tentative commencée sur cette période."
        />
      </Section>

      <p className="text-xs text-gray-500">
        Un navigateur anonyme ne permet pas d’identifier une personne. Les essais en mode debug sont exclus. Une tentative sans réussite observée peut encore être en cours ou être reprise plus tard.
      </p>
    </div>
  );
}
