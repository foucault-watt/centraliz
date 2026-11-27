import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchApi } from "../../utils/api";

// Panneau de debug : cadence demandée / reçue / capturée,
// latence, volumes, et l'historique des 60 dernières secondes.

const PRIMARY = "var(--color-primary, #2563eb)";
const MUTED = "#9ca3af";

const kb = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} Mo` : `${(bytes / 1024).toFixed(1)} Ko`;
const fps = (value) => `${value.toFixed(1)} img/s`;
const ms = (value) => `${Math.round(value)} ms`;

// Statut du serveur toutes les 2 s. On mesure aussi l'aller-retour de cette
// petite requête : en mode flux, les images n'ont plus de requête à chronométrer.
function useServerStatus() {
  const [server, setServer] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const startedAt = Date.now();
      try {
        const response = await fetchApi("/api/pokemon/frame-status", { method: "GET" });
        const data = await response.json();
        if (!cancelled && response.ok) setServer({ ...data, rttMs: Date.now() - startedAt });
      } catch {
        if (!cancelled) setServer(null);
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return server;
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <dt className="text-[0.7rem] font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-secondary">{value}</dd>
      {hint && <dd className="text-xs tabular-nums text-gray-500">{hint}</dd>}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</dl>
    </div>
  );
}

const secondsAgo = (points) => (t) => {
  const last = points.length ? points[points.length - 1].t : t;
  const delta = Math.round((last - t) / 1000);
  return delta === 0 ? "maint." : `-${delta} s`;
};

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      {payload.map((item) => (
        <p key={item.dataKey} className="tabular-nums text-secondary">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: item.color }} />
          {item.name} : <strong>{Number(item.value).toFixed(item.dataKey === "rtt" ? 0 : 1)}</strong> {unit}
        </p>
      ))}
    </div>
  );
}

function FpsChart({ history }) {
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-bold uppercase tracking-wider text-gray-500">
        Images par seconde (60 s)
      </figcaption>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="t" tickFormatter={secondsAgo(history)} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip unit="img/s" />} labelFormatter={() => ""} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="fresh" name="Reçues (nouvelles)" stroke={PRIMARY} strokeWidth={2} fill={PRIMARY} fillOpacity={0.15} isAnimationActive={false} dot={false} />
            <Line type="stepAfter" dataKey="asked" name="Demandées" stroke={MUTED} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function LatencyChart({ history }) {
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-bold uppercase tracking-wider text-gray-500">
        Aller-retour d'une requête, en ms (60 s)
      </figcaption>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="t" tickFormatter={secondsAgo(history)} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip unit="ms" />} labelFormatter={() => ""} />
            <Area type="monotone" dataKey="rtt" name="Aller-retour" stroke={PRIMARY} strokeWidth={2} fill={PRIMARY} fillOpacity={0.15} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function DebugPanel({ targetFps, stats, mode = "polling" }) {
  const server = useServerStatus();
  const streaming = mode === "sse";
  const rttMs = streaming ? server?.rttMs ?? 0 : stats.rttMs;
  const delayMs = stats.ageMs ? stats.ageMs + rttMs / 2 : 0;
  // Le jeu ne produit pas forcément autant d'images différentes que demandé
  // (personnage immobile, menus) : l'écart se mesure par rapport à ce que le
  // serveur voit changer, plafonné par la demande.
  const produced = server && !server.demo
    ? Math.min(targetFps, (server.captureFps || 0) * (1 - (server.unchangedRatio || 0)))
    : null;

  return (
    <section
      aria-label="Debug"
      className="mx-auto w-full max-w-3xl space-y-5 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-secondary">Debug du flux</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              streaming ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
            }`}
          >
            {streaming ? "Flux continu (SSE)" : "Interrogation (secours)"}
          </span>
          {server?.demo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Mode démo local</span>}
        </div>
      </div>

      <Group title="Demandé, reçu, capturé">
        <Stat label="Demandé" value={fps(targetFps)} hint="par ce navigateur" />
        <Stat
          label="Reçu (nouvelles)"
          value={fps(stats.freshPerSec)}
          hint={produced == null ? "images différentes" : `sur ~${produced.toFixed(1)} différentes produites par le jeu`}
        />
        {streaming ? (
          <Stat label="Requêtes" value={fps(stats.requestsPerSec)} hint={`${fps(stats.pushedPerSec)} poussées par le serveur`} />
        ) : (
          <Stat
            label="Requêtes"
            value={fps(stats.requestsPerSec)}
            hint={`${Math.round(stats.notModifiedRatio * 100)} % inchangées (304)`}
          />
        )}
        <Stat
          label="Capturé (serveur)"
          value={server && !server.demo ? fps(server.captureFps || 0) : "—"}
          hint={server && !server.demo ? `${Math.round((server.unchangedRatio || 0) * 100)} % identiques · ${server.viewers ?? 0} spectateur(s) · ${server.streams ?? 0} en flux` : "pas de capture en démo"}
        />
      </Group>

      <Group title="Latence">
        <Stat label="Aller-retour" value={ms(rttMs)} hint={streaming ? "mesuré sur la requête de statut" : "requête → image reçue"} />
        <Stat label="Âge à l'envoi" value={ms(stats.ageMs)} hint="capture → départ serveur" />
        <Stat label="Retard estimé" value={ms(delayMs)} hint="capture → écran" />
        <Stat label="Capture serveur" value={server && !server.demo ? ms(server.captureMs || 0) : "—"} hint="mGBA + encodage" />
      </Group>

      <Group title="Volume">
        <Stat label="Image" value={kb(stats.bytesPerFrame)} hint={`débit ${kb(stats.bytesPerSecond)}/s`} />
        <Stat
          label="Dernière minute"
          value={kb(stats.minute.bytes)}
          hint={streaming
            ? `${stats.minute.pushed} images poussées · ${stats.minute.requests} req. · ${stats.minute.errors} err.`
            : `${stats.minute.fresh} nouvelles / ${stats.minute.requests} req. · ${stats.minute.notModified} inchangées · ${stats.minute.errors} err.`}
        />
        <Stat
          label="Depuis l'ouverture"
          value={kb(stats.session.bytes)}
          hint={`${stats.session.fresh} nouvelles / ${stats.session.requests} req. · ${stats.session.errors} err.`}
        />
        <Stat
          label="Pour 30 joueurs"
          value={`${kb(stats.bytesPerSecond * 30)}/s`}
          hint={streaming ? "30 connexions ouvertes, 0 requête/s" : `${Math.round(stats.requestsPerSec * 30)} requêtes/s`}
        />
      </Group>

      <FpsChart history={stats.history} />
      <LatencyChart history={stats.history} />
    </section>
  );
}
