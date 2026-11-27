import { ArrowDown, ArrowUp, BarChart3, Gamepad2, Gauge, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchApi } from "../utils/api";
import LoadingSkeleton from "./LoadingSkeleton";

// Sessions de jeu Pokémon : une ligne par session et par appareil côté
// serveur (événement « pokemon_session »), agrégée par /admin/pokemon/summary.

const PANEL = "rounded-2xl border border-gray-200/80 bg-white shadow-sm";
const RANGES = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
];
const WATCHED_COLOR = "var(--color-primary)";
const PLAYED_COLOR = "#f59e0b";
const BUTTON_LABELS = { UP: "Haut", DOWN: "Bas", LEFT: "Gauche", RIGHT: "Droite", A: "A", B: "B", START: "Start" };

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
export const formatNumber = (value) => (value == null ? "—" : numberFormat.format(value));

export const formatMinutes = (value) => {
  if (value == null) return "—";
  if (value < 60) return `${formatNumber(value)} min`;
  const hours = Math.floor(value / 60);
  return `${hours} h ${String(Math.round(value - hours * 60)).padStart(2, "0")}`;
};

export const formatBytes = (value) => {
  if (!value) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${formatNumber(value / 1024 ** index)} ${units[index]}`;
};

const sessionsLabel = (count) => `${formatNumber(count)} session${count > 1 ? "s" : ""}`;

const formatMs = (value) => (value == null ? "—" : `${formatNumber(value)} ms`);

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

const shortDay = (value) => {
  const [, month, day] = String(value).split("-");
  return day && month ? `${day}/${month}` : value;
};

const Stat = ({ label, value, detail }) => (
  <div className={`${PANEL} p-3 md:p-4`}>
    <p className="text-[0.7rem] font-bold uppercase text-gray-500 md:text-xs">{label}</p>
    <p className="mt-1 text-2xl font-extrabold tabular-nums text-secondary">{value}</p>
    {detail && <p className="text-xs text-gray-500">{detail}</p>}
  </div>
);

const Section = ({ icon: Icon, title, subtitle, action, children }) => (
  <section className={PANEL}>
    <header className="flex flex-wrap items-start gap-3 border-b border-gray-100 px-4 py-3">
      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:inline-flex">
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-secondary">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);

// Barre de proportion avec libellé et valeur (pas de camembert).
const ShareBar = ({ label, value, share, color = "var(--color-primary)" }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-semibold text-secondary">{label}</span>
      <span className="tabular-nums text-gray-600">
        {value} <span className="text-gray-400">· {share} %</span>
      </span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full" style={{ width: `${Math.min(share, 100)}%`, background: color }} />
    </div>
  </div>
);

const Metric = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
    <span className="text-gray-600">{label}</span>
    <span className="font-semibold tabular-nums text-secondary">{value}</span>
  </div>
);

const PLAYER_COLUMNS = [
  {
    key: "player",
    label: "Joueur",
    render: (p) => (
      <a className="font-semibold text-primary hover:underline" href={`/analytics/admin/users/${encodeURIComponent(p.username)}?module=pokemon`}>
        {p.displayName || p.username}
      </a>
    ),
    sortValue: (p) => (p.displayName || p.username).toLowerCase(),
  },
  { key: "group", label: "Promo", render: (p) => p.group || "—", sortValue: (p) => p.group || "" },
  { key: "sessions", label: "Sessions", align: "right", render: (p) => formatNumber(p.sessions), sortValue: (p) => p.sessions },
  { key: "watched", label: "Temps regardé", align: "right", render: (p) => formatMinutes(p.watchedMinutes), sortValue: (p) => p.watchedMinutes },
  { key: "played", label: "Temps joué", align: "right", render: (p) => formatMinutes(p.playedMinutes), sortValue: (p) => p.playedMinutes },
  { key: "inputs", label: "Inputs", align: "right", render: (p) => formatNumber(p.inputs), sortValue: (p) => p.inputs },
  {
    key: "devices",
    label: "Appareils",
    render: (p) => (p.devices || []).map((d) => (d === "mobile" ? "Téléphone" : "Ordinateur")).join(", ") || "—",
  },
  { key: "last", label: "Dernière venue", render: (p) => dateTime(p.lastSeenAt), sortValue: (p) => p.lastSeenAt || "" },
];

const SortableTable = ({ columns, rows, initialSort, empty }) => {
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
          {sorted.map((row) => (
            <tr key={row.username} className="hover:bg-gray-50/70">
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

const DailyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-secondary">{shortDay(label)}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center gap-2 text-gray-700">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.name} : <span className="font-semibold tabular-nums">{formatMinutes(item.value)}</span>
        </p>
      ))}
      <p className="mt-1 text-gray-500">
        {point.sessions} session{point.sessions > 1 ? "s" : ""} · {point.players} joueur{point.players > 1 ? "s" : ""}
      </p>
    </div>
  );
};

const RangeToggle = ({ range, setRange }) => (
  <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Période">
    {RANGES.map((item) => (
      <button
        key={item.id}
        type="button"
        aria-pressed={range === item.id}
        onClick={() => setRange(item.id)}
        className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
          range === item.id ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-secondary"
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default function PokemonAnalyticsPanel({ initialRange = "30d", hideExcluded = true }) {
  const [range, setRange] = useState(initialRange === "7d" ? "7d" : "30d");
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setSummary(null);
    setError("");
    fetchApi(`/api/analytics/admin/pokemon/summary?range=${range}&hideExcluded=${hideExcluded}`)
      .then(async (response) => {
        if (response.status === 404) throw new Error("Route absente du serveur : le backend doit être mis à jour puis redémarré.");
        if (response.status === 401) throw new Error("Session expirée : reconnexion nécessaire.");
        if (response.status === 403) throw new Error("Statistiques réservées aux administrateurs.");
        const data = await response.json();
        if (!response.ok || !data.success || !data.summary) throw new Error("Statistiques Pokémon indisponibles.");
        if (active) setSummary(data.summary);
      })
      .catch((err) => {
        if (active) setError(err.message || "Statistiques Pokémon indisponibles.");
      });
    return () => {
      active = false;
    };
  }, [range, hideExcluded]);

  const toggle = <RangeToggle range={range} setRange={setRange} />;

  if (error) {
    return (
      <Section icon={Gamepad2} title="Sessions de jeu" action={toggle}>
        <p role="alert" className="p-4 text-sm text-red-600">{error}</p>
      </Section>
    );
  }
  if (!summary) {
    return (
      <Section icon={Gamepad2} title="Sessions de jeu" action={toggle}>
        <div className="p-4"><LoadingSkeleton label="Chargement des sessions…" rows={3} card={false} /></div>
      </Section>
    );
  }

  const { totals, daily, players, technical: tech } = summary;
  const sessionsByMode = tech.modes || {};
  const modeTotal = (sessionsByMode.sse || 0) + (sessionsByMode.polling || 0) + (sessionsByMode.mixed || 0);
  const deviceTotal = (tech.devices?.mobile || 0) + (tech.devices?.desktop || 0);
  const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0);
  const maxButton = Math.max(...tech.buttons.map((b) => b.count), 0);
  const maxBucket = Math.max(...(tech.rttHistogram || []).map((b) => b.count), 0);

  return (
    <div className="space-y-4">
      <Section
        icon={Gamepad2}
        title="Sessions de jeu"
        subtitle="Une ligne par session et par appareil, enregistrée à la fin de la session."
        action={toggle}
      >
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Joueurs uniques" value={formatNumber(totals.players)} detail={`${formatNumber(totals.activePlayers)} avec au moins un input`} />
          <Stat label="Sessions" value={formatNumber(totals.sessions)} />
          <Stat label="Temps regardé" value={formatMinutes(totals.watchedMinutes)} />
          <Stat label="Temps joué" value={formatMinutes(totals.playedMinutes)} />
          <Stat label="Inputs" value={formatNumber(totals.inputs)} />
          <Stat label="Durée moyenne" value={formatMinutes(totals.avgSessionMinutes)} detail="regardée par session" />
        </div>
      </Section>

      <Section icon={BarChart3} title="Minutes par jour" subtitle="Temps regardé et temps joué, à l'heure de Paris.">
        <div className="h-64 p-3 md:h-72 md:p-4">
          {totals.sessions ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} barGap={2} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11 }} minTickGap={12} tickMargin={6} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} axisLine={false} tickLine={false} />
                <Tooltip content={<DailyTooltip />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="watchedMinutes" name="Regardé" fill={WATCHED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="playedMinutes" name="Joué" fill={PLAYED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-gray-500">Aucune session sur la période.</p>
          )}
        </div>
      </Section>

      <Section icon={Trophy} title="Classement des joueurs" subtitle="Clic sur un en-tête pour trier.">
        <SortableTable columns={PLAYER_COLUMNS} rows={players} initialSort={{ key: "watched", desc: true }} empty="Aucun joueur sur la période." />
      </Section>

      <Section icon={Gauge} title="Technique" subtitle="Mesures du serveur et des navigateurs, résumées par session.">
        <div className="grid grid-cols-1 gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase text-gray-500">Données envoyées</h4>
            <Metric label="Total" value={formatBytes(tech.serverBytes)} />
            <Metric label="Par session" value={formatBytes(tech.bytesPerSession)} />
            <Metric label="Par minute regardée" value={formatBytes(tech.bytesPerMinute)} />
            <Metric label="Images envoyées" value={formatNumber(tech.serverFrames)} />
            <Metric label="Reçues par les navigateurs" value={formatBytes(tech.clientBytes)} />
          </div>

          <div>
            <h4 className="mb-1 text-xs font-bold uppercase text-gray-500">Latence</h4>
            <Metric label="Aller-retour moyen" value={formatMs(tech.rttAvgMs)} />
            <Metric label="Aller-retour p95" value={formatMs(tech.rttP95Ms)} />
            <Metric label="Retard moyen de l'image" value={formatMs(tech.delayAvgMs)} />
            <Metric label="Images reçues par seconde" value={formatNumber(tech.fpsAvg)} />
            <Metric label="Mesures" value={formatNumber(tech.rttSamples)} />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-gray-500">Mode et appareil</h4>
            <ShareBar label="Flux SSE (temps regardé)" value={formatMinutes((totals.watchedMinutes * tech.sseTimeShare) / 100)} share={tech.sseTimeShare} />
            <ShareBar
              label="Secours ou mixte (sessions)"
              value={`${formatNumber((sessionsByMode.polling || 0) + (sessionsByMode.mixed || 0))} / ${formatNumber(modeTotal)}`}
              share={pct((sessionsByMode.polling || 0) + (sessionsByMode.mixed || 0), modeTotal)}
              color="#94a3b8"
            />
            <ShareBar
              label="Téléphone"
              value={sessionsLabel(tech.devices?.mobile || 0)}
              share={pct(tech.devices?.mobile || 0, deviceTotal)}
            />
            <ShareBar
              label="Ordinateur"
              value={sessionsLabel(tech.devices?.desktop || 0)}
              share={pct(tech.devices?.desktop || 0, deviceTotal)}
            />
          </div>

          <div className="md:col-span-1 xl:col-span-1">
            <h4 className="mb-2 text-xs font-bold uppercase text-gray-500">Inputs par bouton</h4>
            <ul className="space-y-1.5">
              {tech.buttons.map((b) => (
                <li key={b.button} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm">
                  <span className="font-semibold text-secondary">{BUTTON_LABELS[b.button] || b.button}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full" style={{ width: `${maxButton ? (b.count / maxButton) * 100 : 0}%`, background: WATCHED_COLOR }} />
                  </span>
                  <span className="tabular-nums text-gray-600">
                    {formatNumber(b.count)} <span className="text-gray-400">· {b.share} %</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-1 xl:col-span-2">
            <h4 className="mb-2 text-xs font-bold uppercase text-gray-500">Répartition des allers-retours</h4>
            {tech.rttSamples ? (
              <ul className="space-y-1.5">
                {tech.rttHistogram.map((bucket) => (
                  <li key={bucket.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-sm">
                    <span className="tabular-nums text-gray-600">{bucket.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full" style={{ width: `${maxBucket ? (bucket.count / maxBucket) * 100 : 0}%`, background: WATCHED_COLOR }} />
                    </span>
                    <span className="tabular-nums text-gray-600">{formatNumber(bucket.count)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Aucune mesure sur la période.</p>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
