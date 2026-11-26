import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  Flame,
  KeyRound,
  Layers3,
  LineChart as LineChartIcon,
  LockKeyhole,
  LogIn,
  Repeat2,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Table2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  ReferenceLine,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { fetchApi } from "../utils/api";
import MuseeAnalyticsPanel from "./MuseeAnalyticsPanel";
import PageHeader from "./PageHeader";
import { BarChart3 as PageIcon } from "lucide-react";

const pageVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut", staggerChildren: 0.045 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
};

const ranges = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "365d", label: "12 mois" },
];

const groupByOptions = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

const tabs = [
  { id: "musee", label: "Le Musée", icon: BarChart3, path: "/analytics/admin/musee" },
  { id: "overview", label: "Aperçu", icon: BarChart3, path: "/analytics/admin" },
  { id: "explorer", label: "Explorer", icon: Table2, path: "/analytics/admin/explorer" },
  { id: "users", label: "Utilisateurs", icon: Users, path: "/analytics/admin/users" },
  { id: "modules", label: "Modules", icon: Layers3, path: "/analytics/admin/modules" },
  { id: "heatmap", label: "Temps forts", icon: Flame, path: "/analytics/admin/heatmap" },
  { id: "acquisition", label: "Acquisition", icon: UserPlus, path: "/analytics/admin/acquisition" },
  { id: "excluded", label: "Exclusions", icon: UserMinus, path: "/analytics/admin/excluded" },
];

const eventTypeOptions = [
  { value: "exposure", label: "Vues", detail: "Pages/modules affichés", icon: Eye },
  { value: "load", label: "Loads", detail: "Chargements automatiques", icon: Clock3 },
  { value: "interaction", label: "Interactions", detail: "Actions explicites", icon: Activity },
  { value: "conversion", label: "Conversions", detail: "Actions à forte valeur", icon: Flame },
  { value: "admin", label: "Admin", detail: "Activité admin", icon: ShieldAlert },
  { value: "system", label: "Système", detail: "Backend/auth", icon: LogIn },
];

const defaultEventTypes = eventTypeOptions.map((item) => item.value);
const moduleColors = ["#1f9d8a", "#2668d9", "#f59e0b", "#dc2626", "#7c3aed", "#0f766e"];

// Graphique "évolution par catégorie" affiché sur la page de détail du
// module correspondant, quand ce module a une dimension catégorielle
// pertinente à suivre dans le temps (cf. propriétés déjà trackées par
// trackProductEvent / analyticsService.trackEvent côté métier).
const moduleCategoryChartConfig = {
  links: {
    eventName: "external_link_clicked",
    propertyKey: "name",
    title: "Évolution des liens utilisés",
    subtitle: "Clics par lien, regroupés par période. Cliquer une pastille masque/affiche le lien.",
    emptyLabel: "Aucun clic sur un lien pour cette période",
  },
  calendars: {
    eventName: "calendar_event_opened,calendar_course_opened",
    propertyKey: "type",
    title: "Évolution des éléments de calendrier consultés",
    subtitle: "Ouvertures de cours/événements par type, regroupées par période.",
    emptyLabel: "Aucune ouverture de calendrier pour cette période",
  },
  events: {
    eventName: "event_opened",
    propertyKey: "event_type",
    title: "Évolution des types d'événements consultés",
    subtitle: "Ouvertures d'événements par type, regroupées par période.",
    emptyLabel: "Aucun événement consulté pour cette période",
  },
  cekilui: {
    eventName: "ceki_game_started",
    propertyKey: "mode",
    title: "Évolution des modes de jeu Cékilui",
    subtitle: "Parties démarrées par mode, regroupées par période.",
    emptyLabel: "Aucune partie démarrée pour cette période",
  },
};

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(value || 0);

const formatDecimal = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value || 0);

// Axes lisibles sur mobile : dates courtes, graduations espacées, axe Y étroit.
const shortPeriod = (value) => {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value || ""));
  if (!match) return value;
  return match[3] ? `${match[3]}/${match[2]}` : `${match[2]}/${match[1].slice(2)}`;
};
const periodAxis = { tick: { fontSize: 11 }, tickFormatter: shortPeriod, minTickGap: 18, tickMargin: 6 };
const categoryAxis = {
  tick: { fontSize: 11 },
  tickFormatter: (value) => (String(value).length > 9 ? `${String(value).slice(0, 8)}…` : value),
  tickMargin: 6,
};
const valueAxis = { allowDecimals: false, tick: { fontSize: 11 }, width: 36 };

const formatDateTime = (value) => {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const buildSearchString = (searchParams, patch = {}) => {
  const next = new URLSearchParams(searchParams);
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") next.delete(key);
    else next.set(key, value);
  });
  const query = next.toString();
  return query ? `?${query}` : "";
};

const sortStateToParam = (sorting, fallback) => {
  const first = sorting?.[0];
  if (!first) return fallback;
  return `${first.id}.${first.desc ? "desc" : "asc"}`;
};

const paramToSortState = (param) => {
  const [id, direction] = String(param || "").split(".");
  if (!id) return [];
  return [{ id, desc: direction !== "asc" }];
};

const parseRouteState = (pathname) => {
  const segments = pathname
    .replace(/^\/analytics\/admin\/?/, "")
    .split("/")
    .filter(Boolean);

  if (!segments.length) return { section: "overview" };
  if (segments[0] === "users" && segments[1]) {
    return {
      section: "users",
      type: "userDetail",
      username: decodeURIComponent(segments[1]),
    };
  }
  if (segments[0] === "modules" && segments[1]) {
    return {
      section: "modules",
      type: "moduleDetail",
      moduleName: decodeURIComponent(segments[1]),
    };
  }
  return { section: segments[0] };
};

const Card = ({ children, className = "" }) => (
  <motion.section
    variants={itemVariants}
    whileHover={{ y: -1 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    className={`rounded-xl border border-gray-200 bg-white shadow-md ${className}`}
  >
    {children}
  </motion.section>
);

const LoadingPanel = ({ label = "Chargement..." }) => (
  <Card className="p-10 text-center text-gray-500">{label}</Card>
);

const ErrorPanel = ({ error }) => (
  <Card className="border-danger/20 bg-danger/10 p-4 text-danger">{error}</Card>
);

const EmptyPanel = ({ label = "Aucune donnée" }) => (
  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-8 text-center text-sm text-gray-500">
    {label}
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle, action }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="text-lg font-bold text-secondary">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-2">
      {action}
      <span className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={19} />
      </span>
    </div>
  </div>
);

const Breadcrumbs = ({ items }) => (
  <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
    {items.map((item, index) => (
      <div key={`${item.label}-${index}`} className="flex items-center gap-2">
        {index > 0 && <ChevronRight size={14} className="text-gray-300" />}
        {item.onClick ? (
          <button
            type="button"
            className="font-semibold text-gray-500 hover:text-primary"
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ) : (
          <span className="font-semibold text-secondary">{item.label}</span>
        )}
      </div>
    ))}
  </div>
);

const StatCard = ({ icon: Icon, label, value, detail, onClick }) => {
  const Tag = onClick ? "button" : "article";
  return (
    <motion.div variants={itemVariants}>
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={`relative w-full h-full overflow-hidden rounded-xl border border-gray-200 bg-white p-3 md:p-4 text-left shadow-md ${
          onClick ? "transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/30" : ""
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-primary/80" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.7rem] md:text-xs font-bold uppercase text-gray-500 leading-tight">{label}</p>
          <span className="hidden sm:inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={18} />
          </span>
        </div>
        <p className="mt-2 md:mt-4 text-2xl md:text-3xl font-extrabold text-secondary break-words">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
        {detail && <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>}
      </Tag>
    </motion.div>
  );
};

const JsonBadges = ({ value }) => {
  const entries = Object.entries(value || {});
  if (!entries.length) return <span className="text-xs text-gray-400">-</span>;

  return (
    <div className="flex max-w-xl flex-wrap gap-1.5">
      {entries.map(([key, item]) => (
        <span
          key={key}
          className="max-w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600"
          title={`${key}: ${String(item)}`}
        >
          {key}: <span className="text-secondary">{String(item)}</span>
        </span>
      ))}
    </div>
  );
};

const MiniBarList = ({ items, labelKey = "name", onClickItem }) => {
  const max = Math.max(...(items || []).map((item) => item.count), 1);
  if (!items?.length) return <EmptyPanel />;

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const clickable = Boolean(onClickItem);
        const Container = clickable ? "button" : "div";
        return (
          <motion.div
            key={item[labelKey]}
            className="space-y-1"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: index * 0.025 }}
          >
            <Container
              type={clickable ? "button" : undefined}
              className={`w-full text-left ${clickable ? "group" : ""}`}
              onClick={clickable ? () => onClickItem(item) : undefined}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-gray-700 group-hover:text-primary">
                  {item[labelKey]}
                </span>
                <span className="text-gray-500">{formatNumber(item.count)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              </div>
            </Container>
          </motion.div>
        );
      })}
    </div>
  );
};

const DataTable = ({
  columns,
  data,
  pagination,
  setPagination,
  sorting,
  setSorting,
  rowCount,
  loading,
  emptyLabel,
}) => {
  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    rowCount: rowCount || 0,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold hover:text-primary"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && "↑"}
                        {header.column.getIsSorted() === "desc" && "↓"}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={columns.length}>
                  Chargement...
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50/80">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={columns.length}>
                  {emptyLabel || "Aucune donnée"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm">
        <span className="font-semibold text-gray-500">
          {formatNumber(rowCount)} ligne(s)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ui-button-secondary min-h-0 px-3 py-1.5 text-xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </button>
          <span className="text-xs font-bold text-gray-500">
            Page {pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </span>
          <button
            type="button"
            className="ui-button-secondary min-h-0 px-3 py-1.5 text-xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </button>
          <select
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-600"
            value={pagination.pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}/page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

const EventTypeFilterBar = ({ eventTypes, setEventTypes, hideExcluded, setHideExcluded }) => (
  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-secondary">
      <SlidersHorizontal size={16} className="text-primary" />
      Filtres globaux
    </div>
    <div className="flex flex-wrap gap-2">
      {eventTypeOptions.map((item) => {
        const active = eventTypes.includes(item.value);
        return (
          <button
            key={item.value}
            type="button"
            className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
              active
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-gray-200 bg-white text-gray-500"
            }`}
            title={item.detail}
            onClick={() =>
              setEventTypes((prev) =>
                active
                  ? prev.length > 1
                    ? prev.filter((type) => type !== item.value)
                    : prev
                  : [...prev, item.value],
              )
            }
          >
            <span className="block font-bold">{item.label}</span>
            <span className="block text-[11px] opacity-75">{item.value}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-primary/30 hover:text-primary"
        onClick={() => setEventTypes(defaultEventTypes)}
      >
        Tout afficher
      </button>
    </div>
    <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-secondary">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={hideExcluded}
        onChange={(event) => setHideExcluded(event.target.checked)}
      />
      Masquer les utilisateurs exclus
      <span className="text-xs font-medium text-gray-500">
        désactivé par défaut pour garder la vue complète
      </span>
    </label>
  </div>
);

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dayLabel = (period, options = { weekday: "long", day: "numeric", month: "short" }) => {
  const date = new Date(`${period}T12:00:00`);
  return Number.isNaN(date.getTime()) ? period : date.toLocaleDateString("fr-FR", options);
};

const isWeekend = (period) => {
  const day = new Date(`${period}T12:00:00`).getDay();
  return day === 0 || day === 6;
};

// Un point par jour de la période, même les jours sans activité (0),
// et une moyenne glissante sur 7 jours.
const buildDailySeries = (points, range, key) => {
  const byDay = new Map((points || []).map((point) => [point.period, point[key] || 0]));
  const days = RANGE_DAYS[range] || 30;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const series = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const period = isoDay(new Date(today.getTime() - offset * DAY_MS));
    series.push({ period, value: byDay.get(period) || 0 });
  }
  return series.map((point, index) => {
    if (index < 6) return { ...point, average: null };
    const window = series.slice(index - 6, index + 1);
    return { ...point, average: Math.round((window.reduce((sum, p) => sum + p.value, 0) / 7) * 10) / 10 };
  });
};

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const TrendTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold capitalize text-secondary">{dayLabel(label)}</p>
      <p className="text-secondary">
        <strong>{formatNumber(point.value)}</strong> {unit}
      </p>
      {point.average !== null && (
        <p className="text-xs text-gray-500">Moyenne 7 jours : {formatDecimal(point.average)}</p>
      )}
    </div>
  );
};

// Les deux courbes les plus regardées : un chiffre clé (moyenne / jour),
// l'évolution sur 7 jours, le record, puis les barres du quotidien
// (week-ends plus pâles) avec la moyenne glissante par-dessus.
const TrendCard = ({ title, icon: Icon, points, range, dataKey, unit, color, extra }) => {
  const series = useMemo(() => buildDailySeries(points, range, dataKey), [points, range, dataKey]);
  const values = series.map((point) => point.value);
  const average = mean(values);
  const last7 = mean(values.slice(-7));
  const previous7 = values.length >= 14 ? mean(values.slice(-14, -7)) : null;
  const delta = previous7 ? Math.round(((last7 - previous7) / previous7) * 100) : null;
  const record = series.reduce((best, point) => (point.value > (best?.value || 0) ? point : best), null);
  const today = series[series.length - 1];
  const gradientId = `trend-${dataKey}`;

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: color }}
          >
            <Icon size={19} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-secondary">{title}</h2>
            <p className="text-xs text-gray-500">Par jour, heure de Paris</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <p className="text-2xl md:text-3xl font-extrabold text-secondary leading-none">{formatDecimal(average)}</p>
            <p className="mt-1 text-xs text-gray-500">en moyenne / jour</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-2xl md:text-3xl font-extrabold text-secondary leading-none">
              {formatDecimal(last7)}
              {delta !== null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} %
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-500">7 derniers jours{delta !== null ? " vs 7 précédents" : ""}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-2xl md:text-3xl font-extrabold text-secondary leading-none">{record?.value ? formatNumber(record.value) : "—"}</p>
            <p className="mt-1 text-xs text-gray-500">
              record{record?.value ? `, ${dayLabel(record.period, { weekday: "short", day: "numeric", month: "short" })}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 h-60 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="period" {...periodAxis} axisLine={false} tickLine={false} />
            <YAxis {...valueAxis} axisLine={false} tickLine={false} />
            <Tooltip content={<TrendTooltip unit={unit} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <ReferenceLine y={average} stroke="#9ca3af" strokeDasharray="4 4" />
            <Bar dataKey="value" name={unit} radius={[5, 5, 0, 0]} maxBarSize={28}>
              {series.map((point) => (
                <Cell
                  key={point.period}
                  fill={`url(#${gradientId})`}
                  fillOpacity={isWeekend(point.period) ? 0.4 : 1}
                  stroke={point.period === today?.period ? color : undefined}
                  strokeWidth={point.period === today?.period ? 2 : 0}
                />
              ))}
            </Bar>
            <Line type="monotone" dataKey="average" name="Moyenne 7 j" stroke="#2c3e50" strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} /> En semaine</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm opacity-40" style={{ backgroundColor: color }} /> Week-end</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-secondary" /> Moyenne 7 jours</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-gray-400" /> Moyenne de la période</span>
        {today && <span className="ml-auto">Aujourd'hui : <strong className="text-secondary">{formatNumber(today.value)}</strong></span>}
        {extra}
      </div>
    </Card>
  );
};

const OverviewTab = ({
  summary,
  timeseries,
  range,
  goToTab,
  openModule,
  openExplorer,
  openUser,
}) => {
  const totals = summary?.totals || {};
  const sessionsPerUser = totals.activeUsers ? totals.sessionsTotal / totals.activeUsers : 0;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <TrendCard
        title="Utilisateurs uniques"
        icon={Users}
        points={timeseries?.points}
        range={range}
        dataKey="activeUsers"
        unit="utilisateurs"
        color="#2668d9"
      />
      <TrendCard
        title="Sessions"
        icon={Repeat2}
        points={timeseries?.points}
        range={range}
        dataKey="sessions"
        unit="sessions"
        color="#f59e0b"
        extra={
          <span>
            ≈ <strong className="text-secondary">{formatDecimal(sessionsPerUser)}</strong> session(s) par utilisateur sur la période
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Users} label="Utilisateurs actifs" value={totals.activeUsers} detail="Sur la période" onClick={() => goToTab("users")} />
        <StatCard icon={CalendarDays} label="DAU / WAU / MAU" value={`${formatNumber(totals.dau)} · ${formatNumber(totals.wau)} · ${formatNumber(totals.mau)}`} detail="Jour · semaine · mois" />
        <StatCard icon={Clock3} label="Durée session" value={`${formatDecimal(totals.avgSessionDuration || 0)} min`} detail={`${formatDecimal(totals.avgEventsPerSession || 0)} actions / session`} />
        <StatCard icon={UserPlus} label="Nouveaux" value={summary?.newVsReturning?.newUsers} detail={`${formatNumber(summary?.newVsReturning?.returningUsers)} récurrents`} onClick={() => goToTab("acquisition")} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle icon={Layers3} title="Modules les plus utilisés" />
          <MiniBarList items={summary?.eventsByModule || []} onClickItem={(item) => openModule(item.name)} />
        </Card>
        <Card className="p-4 md:p-5">
          <SectionTitle icon={Users} title="Les plus présents" subtitle="Les profils qui reviennent le plus sur la période." />
          <div className="divide-y divide-gray-100">
            {(summary?.returningUsersPreview || []).length ? (
              summary.returningUsersPreview.map((item) => (
                <button
                  key={item.username}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-gray-50"
                  onClick={() => openUser(item.username)}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-secondary truncate">{item.displayName}</span>
                    <span className="block text-xs text-gray-500 truncate">
                      {item.group} · {formatNumber(item.activeDays)} jour(s) actifs
                    </span>
                  </span>
                  <span className="ui-badge shrink-0">{formatNumber(item.sessionsTotal)} sessions</span>
                </button>
              ))
            ) : (
              <EmptyPanel label="Pas encore de profils récurrents visibles" />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle icon={Activity} title="Actions fréquentes" />
          <MiniBarList items={summary?.topEvents || []} onClickItem={(item) => openExplorer({ eventName: item.name })} />
        </Card>
        <Card className="p-4 md:p-5">
          <SectionTitle icon={Users} title="Groupes actifs" />
          <MiniBarList items={summary?.usersByGroup || []} onClickItem={(item) => openExplorer({ group: item.name })} />
        </Card>
      </div>

      <details className="group rounded-xl border border-gray-200 bg-white shadow-md">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5 font-bold text-secondary">
          Tous les chiffres
          <ChevronRight size={18} className="text-gray-400 transition-transform group-open:rotate-90" />
        </summary>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 md:px-5 md:pb-5 xl:grid-cols-4">
          <StatCard icon={Activity} label="Événements" value={totals.events} onClick={() => goToTab("explorer")} />
          <StatCard icon={Repeat2} label="Sessions" value={totals.sessionsTotal} />
          <StatCard icon={Eye} label="Vues modules" value={summary?.eventTypeTotals?.exposure} detail="Exposition, pas usage actif" onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "exposure" })} />
          <StatCard icon={Clock3} label="Loads automatiques" value={summary?.eventTypeTotals?.load} onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "load" })} />
          <StatCard icon={Activity} label="Interactions réelles" value={summary?.eventTypeTotals?.interaction} onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "interaction" })} />
          <StatCard icon={Flame} label="Conversions" value={summary?.eventTypeTotals?.conversion} onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "conversion" })} />
          <StatCard icon={LogIn} label="Logins backend" value={totals.loginCount} />
          <StatCard icon={Clock3} label="Heures actives" value={totals.activeHoursCount} detail="Heures distinctes d’usage" />
          <StatCard icon={Users} label="Users récurrents" value={totals.recurrentUsers} detail="Déjà vus avant la période" />
          <StatCard icon={CalendarDays} label="Première activité" value={totals.firstSeenAt ? formatDateTime(totals.firstSeenAt) : "Jamais"} />
          <StatCard icon={Activity} label="Dernière activité" value={totals.lastSeenAt ? formatDateTime(totals.lastSeenAt) : "Jamais"} />
        </div>
      </details>
    </motion.div>
  );
};

const ExplorerTab = ({
  queryState,
  setQueryState,
  eventTypes,
  hideExcluded,
  openUser,
  openModule,
}) => {
  const [events, setEvents] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState(paramToSortState("created_at.desc"));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      range: queryState.range,
      eventTypes: eventTypes.join(","),
      ...(hideExcluded ? { hideExcluded: "true" } : {}),
      ...(queryState.module ? { module: queryState.module } : {}),
      ...(queryState.eventName ? { eventName: queryState.eventName } : {}),
      ...(queryState.username ? { username: queryState.username } : {}),
      ...(queryState.group ? { group: queryState.group } : {}),
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sort: sortStateToParam(sorting, "created_at.desc"),
    }).toString();

    try {
      const response = await fetchApi(`/api/analytics/admin/events?${query}`);
      const data = await response.json();
      setEvents(data.success ? data.events || [] : []);
      setRowCount(data.success ? data.pagination?.total || 0 : 0);
    } catch (error) {
      console.error(error);
      setEvents([]);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [eventTypes, hideExcluded, pagination.pageIndex, pagination.pageSize, queryState, sorting]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "user_username",
        header: "Utilisateur",
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => openUser(row.original.userUsername)}>
            <p className="font-bold text-secondary hover:text-primary">{row.original.userDisplayName}</p>
            <p className="text-xs text-gray-500">{row.original.userUsername || "Anonyme"}</p>
          </button>
        ),
      },
      {
        accessorKey: "module",
        header: "Module",
        cell: ({ row }) => (
          <button type="button" className="ui-badge" onClick={() => openModule(row.original.module)}>
            {row.original.module}
          </button>
        ),
      },
      {
        accessorKey: "event_name",
        header: "Event",
        cell: ({ row }) => <span className="font-semibold text-gray-700">{row.original.eventName}</span>,
      },
      {
        accessorKey: "event_type",
        header: "Type",
        cell: ({ row }) => (
          <span className="rounded-lg border border-primary/15 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
            {row.original.eventType}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <div className="text-xs font-semibold text-gray-600">
            <p>{row.original.source || "backend"}</p>
            <p className={row.original.isAutomatic ? "text-amber-600" : "text-emerald-600"}>
              {row.original.isAutomatic ? "auto" : "manuel"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "properties",
        header: "Propriétés",
        enableSorting: false,
        cell: ({ row }) => <JsonBadges value={row.original.properties} />,
      },
    ],
    [openModule, openUser],
  );

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {[
            ["module", "Module"],
            ["eventName", "Event"],
            ["username", "Utilisateur"],
            ["group", "Groupe"],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs font-bold uppercase text-gray-500">{label}</span>
              <input
                className="ui-field mt-1"
                value={queryState[key] || ""}
                onChange={(event) => {
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  setQueryState({ [key]: event.target.value });
                }}
                placeholder={label}
              />
            </label>
          ))}
          <div className="flex items-end">
            <button
              type="button"
              className="ui-button-secondary w-full"
              onClick={() => {
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setQueryState({
                  module: "",
                  eventName: "",
                  username: "",
                  group: "",
                });
              }}
            >
              <Search size={16} /> Réinitialiser
            </button>
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={events}
        pagination={pagination}
        setPagination={setPagination}
        sorting={sorting}
        setSorting={setSorting}
        rowCount={rowCount}
        loading={loading}
        emptyLabel="Aucun événement pour ces filtres"
      />
    </motion.div>
  );
};

const UsersPage = ({
  queryState,
  setQueryState,
  eventTypes,
  hideExcluded,
  openUser,
}) => {
  const [users, setUsers] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState(paramToSortState("lastSeenAt.desc"));

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      range: queryState.range,
      eventTypes: eventTypes.join(","),
      ...(hideExcluded ? { hideExcluded: "true" } : {}),
      ...(queryState.usersSearch ? { search: queryState.usersSearch } : {}),
      ...(queryState.usersGroup ? { group: queryState.usersGroup } : {}),
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sort: sortStateToParam(sorting, "lastSeenAt.desc"),
    }).toString();

    try {
      const response = await fetchApi(`/api/analytics/admin/users?${query}`);
      const data = await response.json();
      setUsers(data.success ? data.users || [] : []);
      setRowCount(data.success ? data.pagination?.total || 0 : 0);
    } catch (error) {
      console.error(error);
      setUsers([]);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [eventTypes, hideExcluded, pagination.pageIndex, pagination.pageSize, queryState, sorting]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "username",
        header: "Utilisateur",
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => openUser(row.original.username)}>
            <p className="font-bold text-secondary hover:text-primary">
              {row.original.displayName}
            </p>
            <p className="text-xs text-gray-500">{row.original.username}</p>
          </button>
        ),
      },
      { accessorKey: "group", header: "Groupe" },
      { accessorKey: "totalEvents", header: "Events" },
      { accessorKey: "sessionsTotal", header: "Sessions" },
      { accessorKey: "activeDays", header: "Jours actifs" },
      {
        accessorKey: "avgSessionDuration",
        header: "Durée moy.",
        cell: ({ row }) => `${formatDecimal(row.original.avgSessionDuration)} min`,
      },
      {
        accessorKey: "lastSeenAt",
        header: "Dernière activité",
        cell: ({ row }) => formatDateTime(row.original.lastSeenAt),
      },
    ],
    [openUser],
  );

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <label>
            <span className="text-xs font-bold uppercase text-gray-500">Recherche</span>
            <input
              className="ui-field mt-1"
              value={queryState.usersSearch || ""}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setQueryState({ usersSearch: event.target.value });
              }}
              placeholder="Nom ou username"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-gray-500">Groupe</span>
            <input
              className="ui-field mt-1"
              value={queryState.usersGroup || ""}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setQueryState({ usersGroup: event.target.value });
              }}
              placeholder="Groupe"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="ui-button-secondary"
              onClick={() => {
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setQueryState({ usersSearch: "", usersGroup: "" });
              }}
            >
              <Search size={16} /> Réinitialiser
            </button>
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={users}
        pagination={pagination}
        setPagination={setPagination}
        sorting={sorting}
        setSorting={setSorting}
        rowCount={rowCount}
        loading={loading}
        emptyLabel="Aucun utilisateur actif sur cette période"
      />
    </motion.div>
  );
};

const initialsOf = (name) =>
  String(name || "?")
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];

// Calendrier d'activité façon "contributions" : une colonne par semaine,
// une ligne par jour (lundi en haut), intensité = événements du jour.
const ActivityCalendar = ({ points, range, dataKey = "events" }) => {
  const series = useMemo(() => buildDailySeries(points, range, dataKey), [points, range, dataKey]);
  if (!series.length) return null;
  const max = Math.max(1, ...series.map((point) => point.value));
  const first = new Date(`${series[0].period}T12:00:00`);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const cells = [...Array(offset).fill(null), ...series];
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  const activeDays = series.filter((point) => point.value > 0).length;
  // Plus longue série de jours actifs consécutifs.
  let streak = 0;
  let best = 0;
  series.forEach((point) => {
    streak = point.value > 0 ? streak + 1 : 0;
    best = Math.max(best, streak);
  });
  const cellColor = (value) =>
    value
      ? `color-mix(in srgb, var(--color-primary) ${Math.round(25 + (value / max) * 75)}%, white)`
      : "#eef0f3";
  const monthOf = (week) => {
    const day = week.find((cell) => cell && new Date(`${cell.period}T12:00:00`).getDate() <= 7);
    return day ? new Date(`${day.period}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" }) : "";
  };

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] pt-5 text-[0.65rem] text-gray-400">
            {WEEKDAY_INITIALS.map((letter, index) => (
              <span key={index} className="flex h-3.5 md:h-4 items-center">{index % 2 === 0 ? letter : ""}</span>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              <span className="h-4 whitespace-nowrap text-[0.65rem] text-gray-400">{monthOf(week)}</span>
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const cell = week[dayIndex];
                return cell ? (
                  <span
                    key={dayIndex}
                    className="h-3.5 w-3.5 md:h-4 md:w-4 rounded-[3px]"
                    style={{ backgroundColor: cellColor(cell.value) }}
                    title={`${dayLabel(cell.period)} : ${formatNumber(cell.value)} événement(s)`}
                  />
                ) : (
                  <span key={dayIndex} className="h-3.5 w-3.5 md:h-4 md:w-4" />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <span>
          <strong className="text-secondary">{activeDays}</strong> jour(s) actif(s) · plus longue série :{" "}
          <strong className="text-secondary">{best}</strong> jour(s) d'affilée
        </span>
        <span className="flex items-center gap-1.5">
          Moins
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <span key={ratio} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: cellColor(ratio * max) }} />
          ))}
          Plus
        </span>
      </div>
    </div>
  );
};

const UserDetailPage = ({
  username,
  queryState,
  eventTypes,
  hideExcluded,
  goToUsers,
  openModule,
  openExplorer,
}) => {
  const [detail, setDetail] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventRowCount, setEventRowCount] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [sessionRowCount, setSessionRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eventsPagination, setEventsPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [eventsSorting, setEventsSorting] = useState(paramToSortState("created_at.desc"));
  const [sessionsPagination, setSessionsPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [sessionsSorting, setSessionsSorting] = useState(paramToSortState("startedAt.desc"));

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();

        const [summaryResponse, timeseriesResponse] = await Promise.all([
          fetchApi(`/api/analytics/admin/users/${encodeURIComponent(username)}/summary?${query}`),
          fetchApi(`/api/analytics/admin/users/${encodeURIComponent(username)}/timeseries?${query}`),
        ]);
        const summaryData = await summaryResponse.json();
        const timeseriesData = await timeseriesResponse.json();

        setDetail(summaryData.success ? summaryData.user : null);
        setTimeseries(timeseriesData.success ? timeseriesData.timeseries : null);
      } catch (error) {
        console.error(error);
        setDetail(null);
        setTimeseries(null);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [eventTypes, hideExcluded, queryState.range, username]);

  useEffect(() => {
    const loadEvents = async () => {
      const query = new URLSearchParams({
        range: queryState.range,
        eventTypes: eventTypes.join(","),
        ...(hideExcluded ? { hideExcluded: "true" } : {}),
        page: String(eventsPagination.pageIndex + 1),
        pageSize: String(eventsPagination.pageSize),
        sort: sortStateToParam(eventsSorting, "created_at.desc"),
      }).toString();

      try {
        const response = await fetchApi(`/api/analytics/admin/users/${encodeURIComponent(username)}/events?${query}`);
        const data = await response.json();
        setEvents(data.success ? data.events || [] : []);
        setEventRowCount(data.success ? data.pagination?.total || 0 : 0);
      } catch (error) {
        console.error(error);
        setEvents([]);
        setEventRowCount(0);
      }
    };

    loadEvents();
  }, [
    eventTypes,
    eventsPagination.pageIndex,
    eventsPagination.pageSize,
    eventsSorting,
    hideExcluded,
    queryState.range,
    username,
  ]);

  useEffect(() => {
    const loadSessions = async () => {
      const query = new URLSearchParams({
        range: queryState.range,
        eventTypes: eventTypes.join(","),
        ...(hideExcluded ? { hideExcluded: "true" } : {}),
        page: String(sessionsPagination.pageIndex + 1),
        pageSize: String(sessionsPagination.pageSize),
        sort: sortStateToParam(sessionsSorting, "startedAt.desc"),
      }).toString();

      try {
        const response = await fetchApi(`/api/analytics/admin/users/${encodeURIComponent(username)}/sessions?${query}`);
        const data = await response.json();
        setSessions(data.success ? data.sessions || [] : []);
        setSessionRowCount(data.success ? data.pagination?.total || 0 : 0);
      } catch (error) {
        console.error(error);
        setSessions([]);
        setSessionRowCount(0);
      }
    };

    loadSessions();
  }, [
    eventTypes,
    hideExcluded,
    queryState.range,
    sessionsPagination.pageIndex,
    sessionsPagination.pageSize,
    sessionsSorting,
    username,
  ]);

  const eventColumns = useMemo(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
      {
        accessorKey: "module",
        header: "Module",
        cell: ({ row }) => <span className="ui-badge">{row.original.module}</span>,
      },
      {
        accessorKey: "event_name",
        header: "Event",
        cell: ({ row }) => <span className="font-semibold">{row.original.eventName}</span>,
      },
      {
        accessorKey: "event_type",
        header: "Type",
        cell: ({ row }) => <span className="ui-badge">{row.original.eventType}</span>,
      },
      {
        accessorKey: "properties",
        header: "Propriétés",
        enableSorting: false,
        cell: ({ row }) => <JsonBadges value={row.original.properties} />,
      },
    ],
    [],
  );

  const sessionColumns = useMemo(
    () => [
      {
        accessorKey: "startedAt",
        header: "Début",
        cell: ({ row }) => formatDateTime(row.original.startedAt),
      },
      {
        accessorKey: "endedAt",
        header: "Fin",
        cell: ({ row }) => formatDateTime(row.original.endedAt),
      },
      { accessorKey: "eventCount", header: "Events" },
      {
        accessorKey: "durationMinutes",
        header: "Durée",
        cell: ({ row }) => `${formatDecimal(row.original.durationMinutes)} min`,
      },
      {
        accessorKey: "moduleCount",
        header: "Modules",
      },
      {
        accessorKey: "loginEvents",
        header: "Logins",
      },
    ],
    [],
  );

  if (loading && !detail) return <LoadingPanel label="Chargement de la fiche utilisateur..." />;
  if (!detail) return <ErrorPanel error="Impossible de charger cet utilisateur." />;

  const rangeDays = RANGE_DAYS[queryState.range] || 30;
  const favoriteHour = (detail.activityByHour || []).reduce((best, item) => (item.count > (best?.count || 0) ? item : best), null);
  const favoriteDay = (detail.activityByWeekday || []).reduce((best, item) => (item.count > (best?.count || 0) ? item : best), null);
  const sortedModules = [...(detail.modules || [])].sort((a, b) => b.count - a.count);
  const favoriteModule = sortedModules[0] || null;
  const totalModuleEvents = sortedModules.reduce((sum, item) => sum + item.count, 0);
  // Anneau : 5 modules principaux + "Autres".
  const moduleSlices = [
    ...sortedModules.slice(0, 5).map((item) => ({ ...item, label: moduleLabel(item.name) })),
    ...(sortedModules.length > 5
      ? [{ name: "__other", label: "Autres", count: sortedModules.slice(5).reduce((sum, item) => sum + item.count, 0) }]
      : []),
  ];
  const lastSeenDays = detail.lastSeenAt
    ? Math.round((Date.now() - new Date(detail.lastSeenAt).getTime()) / DAY_MS)
    : null;
  const activeRate = rangeDays ? detail.activeDays / rangeDays : 0;
  const regularity =
    activeRate >= 0.6 ? "Utilisateur quotidien" : activeRate >= 0.3 ? "Utilisateur régulier" : activeRate > 0 ? "Utilisateur occasionnel" : "Inactif sur la période";

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Utilisateurs", onClick: goToUsers },
          { label: detail.displayName || username },
        ]}
      />

      <Card className="overflow-hidden">
        <div className="h-16 md:h-20 bg-gradient-to-r from-primary to-primary-dark" />
        <div className="px-4 pb-4 md:px-5 md:pb-5">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4 min-w-0">
              <span className="inline-flex h-16 w-16 md:h-20 md:w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-secondary text-xl md:text-2xl font-bold text-white shadow-md">
                {initialsOf(detail.displayName || username)}
              </span>
              <div className="min-w-0 pb-1">
                <h2 className="text-xl md:text-2xl font-bold text-secondary truncate">{detail.displayName}</h2>
                <p className="text-sm text-gray-500 truncate">
                  {detail.username} · {detail.group}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="ui-button-secondary" onClick={goToUsers}>
                <ArrowLeft size={16} /> Utilisateurs
              </button>
              <button type="button" className="ui-button-secondary" onClick={() => openExplorer({ username: detail.username })}>
                <Table2 size={16} /> Explorer
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`rounded-full px-2.5 py-1 ${lastSeenDays !== null && lastSeenDays <= 1 ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
              Vu {relativeDay(detail.lastSeenAt)}
            </span>
            {detail.firstSeenAt && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                Première activité le {new Date(detail.firstSeenAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{regularity}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Jours actifs"
          value={detail.activeDays}
          detail={`sur ${rangeDays} jours · ${rangeDays ? Math.round((detail.activeDays / rangeDays) * 100) : 0} %`}
        />
        <StatCard
          icon={Repeat2}
          label="Sessions"
          value={detail.sessionsTotal}
          detail={`${formatDecimal(detail.avgSessionDuration)} min en moyenne`}
        />
        <StatCard
          icon={Clock3}
          label="Heure favorite"
          value={favoriteHour ? `${favoriteHour.hour}h` : "—"}
          detail={favoriteDay ? `surtout le ${favoriteDay.name}` : undefined}
        />
        <StatCard
          icon={Layers3}
          label="Module préféré"
          value={favoriteModule ? moduleLabel(favoriteModule.name) : "—"}
          detail={favoriteModule && totalModuleEvents ? `${Math.round((favoriteModule.count / totalModuleEvents) * 100)} % de son activité` : undefined}
        />
      </div>

      <Card className="p-4 md:p-5">
        <SectionTitle
          icon={CalendarDays}
          title="Calendrier d'activité"
          subtitle="Un carré par jour : plus il est foncé, plus la personne a utilisé Centraliz."
        />
        <ActivityCalendar points={timeseries?.points} range={queryState.range} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle icon={Clock3} title="Ses heures" subtitle="Événements par heure, heure de Paris." />
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detail.activityByHour || []} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="hour" tickFormatter={(hour) => `${Number(hour)}h`} tick={{ fontSize: 11 }} minTickGap={10} axisLine={false} tickLine={false} />
                <YAxis {...valueAxis} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(hour) => `${Number(hour)}h–${Number(hour) + 1}h`} />
                <Bar dataKey="count" name="Événements" radius={[4, 4, 0, 0]}>
                  {(detail.activityByHour || []).map((item) => (
                    <Cell key={item.hour} fill={item === favoriteHour ? "var(--color-primary)" : "#93c5fd"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <SectionTitle icon={Layers3} title="Ce qu'elle ou il utilise" subtitle="Répartition de son activité par module." />
          {moduleSlices.length ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moduleSlices} dataKey="count" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                      {moduleSlices.map((slice, index) => (
                        <Cell key={slice.name} fill={moduleColors[index % moduleColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-secondary">{(detail.modules || []).length}</span>
                  <span className="text-xs text-gray-500">modules</span>
                </div>
              </div>
              <div className="w-full space-y-2">
                {moduleSlices.map((slice, index) => (
                  <button
                    key={slice.name}
                    type="button"
                    onClick={() => slice.name !== "__other" && openModule(slice.name)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: moduleColors[index % moduleColors.length] }} />
                      <span className="truncate font-semibold text-secondary">{slice.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      {totalModuleEvents ? Math.round((slice.count / totalModuleEvents) * 100) : 0} %
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPanel label="Aucun module utilisé sur la période" />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle icon={CalendarDays} title="Ses jours" subtitle="Événements par jour de semaine." />
          <div className="h-52 md:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detail.activityByWeekday || []} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tickFormatter={(name) => String(name).slice(0, 3)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis {...valueAxis} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" name="Événements" radius={[4, 4, 0, 0]}>
                  {(detail.activityByWeekday || []).map((item) => (
                    <Cell key={item.name} fill={item === favoriteDay ? "#2668d9" : "#bfdbfe"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 md:p-5">
          <SectionTitle icon={Activity} title="Ses actions les plus fréquentes" />
          <MiniBarList items={detail.topEvents || []} onClickItem={(item) => openExplorer({ username: detail.username, eventName: item.name })} />
        </Card>
      </div>

      <details className="group rounded-xl border border-gray-200 bg-white shadow-md">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 md:p-5 font-bold text-secondary">
          Tous les chiffres
          <ChevronRight size={18} className="text-gray-400 transition-transform group-open:rotate-90" />
        </summary>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4 md:px-5 md:pb-5 xl:grid-cols-4">
          <StatCard icon={Activity} label="Events" value={detail.totalEvents} />
          <StatCard icon={BarChart3} label="Events / session" value={formatDecimal(detail.avgEventsPerSession)} />
          <StatCard icon={Eye} label="Interactions" value={detail.interactionCount} />
          <StatCard icon={Flame} label="Conversions" value={detail.conversionCount} />
          <StatCard icon={LogIn} label="Logins backend" value={detail.loginsBackend} />
          <StatCard icon={Clock3} label="Heures actives" value={detail.activeHoursCount} detail="Créneaux distincts" />
          <StatCard icon={Clock3} label="Loads automatiques" value={detail.loadCount} />
          <StatCard icon={Activity} label="Dernière activité" value={detail.lastSeenAt ? formatDateTime(detail.lastSeenAt) : "Jamais"} />
        </div>
      </details>

      <Card className="p-4 md:p-5">
        <SectionTitle icon={Repeat2} title="Sessions d’usage" subtitle="Découpées automatiquement après 10 minutes d’inactivité." />
        <DataTable
          columns={sessionColumns}
          data={sessions}
          pagination={sessionsPagination}
          setPagination={setSessionsPagination}
          sorting={sessionsSorting}
          setSorting={setSessionsSorting}
          rowCount={sessionRowCount}
          loading={false}
          emptyLabel="Aucune session sur cette période"
        />
      </Card>

      <Card className="p-4 md:p-5">
        <SectionTitle icon={Table2} title="Timeline complète" subtitle="Événements paginés et propriétés déjà nettoyées." />
        <DataTable
          columns={eventColumns}
          data={events}
          pagination={eventsPagination}
          setPagination={setEventsPagination}
          sorting={eventsSorting}
          setSorting={setEventsSorting}
          rowCount={eventRowCount}
          loading={false}
          emptyLabel="Aucun événement utilisateur"
        />
      </Card>
    </motion.div>
  );
};

// Noms lisibles des modules trackés (l'identifiant technique reste en petit).
const MODULE_LABELS = {
  calendars: "Calendriers",
  hp: "Emploi du temps",
  communication: "Mails",
  mail: "Mails",
  links: "Liens",
  notes: "Notes",
  moodle: "Moodle",
  cekilui: "Cékilui",
  bibli: "Bibli",
  musee: "Le Musée",
  events: "Événements",
  auth: "Connexion",
  settings: "Réglages",
  reglages: "Réglages",
  campaigns: "Campagnes",
  pokemon: "Pokémon",
  help: "Aide",
  feedback: "Avis",
  navigation: "Navigation",
};
const moduleLabel = (module) => MODULE_LABELS[module] || module || "—";

const EVENT_TYPE_COLORS = {
  exposure: "#93c5fd",
  load: "#d1d5db",
  interaction: "var(--color-primary)",
  conversion: "#49c16b",
};

const relativeDay = (value) => {
  if (!value) return "jamais";
  const date = new Date(value);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
      new Date(date.getFullYear(), date.getMonth(), date.getDate())) /
      DAY_MS,
  );
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  return `il y a ${diff} jours`;
};

const weekDelta = (values) => {
  if (values.length < 14) return null;
  const last = mean(values.slice(-7));
  const previous = mean(values.slice(-14, -7));
  return previous ? Math.round(((last - previous) / previous) * 100) : null;
};

const DeltaBadge = ({ delta }) =>
  delta === null ? null : (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold ${
        delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
      title="7 derniers jours vs 7 précédents"
    >
      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} %
    </span>
  );

const Sparkline = ({ data, color, id }) => (
  <div className="h-12">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// Barre fine qui montre de quoi est fait l'usage : vues, chargements, actions, conversions.
const EventTypeBar = ({ item }) => {
  const parts = [
    ["exposure", "Vues", item.exposureCount],
    ["load", "Chargements", item.loadCount],
    ["interaction", "Actions", item.interactionCount],
    ["conversion", "Conversions", item.conversionCount],
  ].filter(([, , count]) => count > 0);
  const total = parts.reduce((sum, [, , count]) => sum + count, 0) || 1;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100" title={parts.map(([, label, count]) => `${label} : ${formatNumber(count)}`).join(" · ")}>
      {parts.map(([key, , count]) => (
        <span key={key} style={{ width: `${(count / total) * 100}%`, backgroundColor: EVENT_TYPE_COLORS[key] }} />
      ))}
    </div>
  );
};

const ModulesPage = ({ queryState, eventTypes, hideExcluded, openModule }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadModules = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const response = await fetchApi(`/api/analytics/admin/modules?${query}`);
        const payload = await response.json();
        if (active) setData(payload.success ? payload : null);
      } catch (error) {
        console.error(error);
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadModules();
    return () => {
      active = false;
    };
  }, [eventTypes, hideExcluded, queryState.range]);

  const modules = useMemo(() => {
    const total = data?.activeUsersTotal || 0;
    return (data?.modules || [])
      .filter((item) => item.module)
      .map((item) => {
        const series = buildDailySeries(
          (item.usersTimeline || []).map((point) => ({ period: point.period, users: point.users })),
          queryState.range,
          "users",
        );
        const values = series.map((point) => point.value);
        return {
          ...item,
          label: moduleLabel(item.module),
          reach: total ? Math.round((item.activeUsers / total) * 100) : 0,
          series,
          avgDaily: mean(values),
          delta: weekDelta(values),
        };
      })
      .sort((a, b) => b.activeUsers - a.activeUsers || b.totalEvents - a.totalEvents);
  }, [data, queryState.range]);

  if (loading && !data) return <LoadingPanel label="Chargement des modules..." />;
  if (!modules.length) return <EmptyPanel label="Aucun module utilisé sur la période" />;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Card className="p-4 md:p-5">
        <SectionTitle
          icon={Layers3}
          title="Portée des modules"
          subtitle={`Part des ${formatNumber(data?.activeUsersTotal || 0)} utilisateurs actifs qui ont ouvert chaque module sur la période.`}
        />
        <div className="space-y-2.5">
          {modules.map((item, index) => (
            <button
              key={item.module}
              type="button"
              onClick={() => openModule(item.module)}
              className="group grid w-full grid-cols-[7rem_minmax(0,1fr)_4.5rem] sm:grid-cols-[9rem_minmax(0,1fr)_6rem] items-center gap-3 text-left"
            >
              <span className="truncate text-sm font-semibold text-secondary group-hover:text-primary">{item.label}</span>
              <span className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(item.reach, 1)}%`, backgroundColor: moduleColors[index % moduleColors.length] }}
                />
              </span>
              <span className="text-right text-sm tabular-nums text-gray-500">
                <strong className="text-secondary">{item.reach} %</strong>
                <span className="hidden sm:inline"> · {formatNumber(item.activeUsers)}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {modules.map((item, index) => {
          const color = moduleColors[index % moduleColors.length];
          return (
            <motion.button
              key={item.module}
              type="button"
              variants={itemVariants}
              onClick={() => openModule(item.module)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-secondary truncate">{item.label}</p>
                  <p className="text-[0.7rem] text-gray-400">{item.module}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: color }}>
                  {item.reach} %
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-2xl font-extrabold text-secondary leading-none">
                    {formatDecimal(item.avgDaily)} <DeltaBadge delta={item.delta} />
                  </p>
                  <p className="mt-1 text-xs text-gray-500">personnes / jour en moyenne</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-secondary leading-none">{formatNumber(item.activeUsers)}</p>
                  <p className="mt-1 text-xs text-gray-500">sur la période</p>
                </div>
              </div>

              <div className="mt-2">
                <Sparkline data={item.series} color={color} id={`spark-${index}`} />
              </div>

              <div className="mt-3 space-y-2">
                <EventTypeBar item={item} />
                <p className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
                  <span>{formatNumber(item.sessionsTotal)} sessions · {formatDecimal(item.avgSessionDuration)} min</span>
                  <span>Dernière utilisation : {relativeDay(item.lastSeenAt)}</span>
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        Barre fine :
        {[
          ["exposure", "vues"],
          ["load", "chargements auto"],
          ["interaction", "actions"],
          ["conversion", "conversions"],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[key] }} /> {label}
          </span>
        ))}
      </p>
    </motion.div>
  );
};

const CategoryTimeseriesChart = ({
  moduleName,
  range,
  hideExcluded,
  eventName,
  propertyKey,
  title,
  subtitle,
  emptyLabel = "Aucune donnée pour cette période",
}) => {
  const [groupBy, setGroupBy] = useState("day");
  const [timeseries, setTimeseries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());

  useEffect(() => {
    const loadCategoryTimeseries = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range,
          groupBy,
          eventName,
          propertyKey,
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const response = await fetchApi(
          `/api/analytics/admin/modules/${encodeURIComponent(moduleName)}/category-timeseries?${query}`,
        );
        const data = await response.json();
        setTimeseries(data.success ? data.timeseries : null);
      } catch (error) {
        console.error(error);
        setTimeseries(null);
      } finally {
        setLoading(false);
      }
    };
    loadCategoryTimeseries();
  }, [moduleName, range, groupBy, hideExcluded, eventName, propertyKey]);

  const categories = timeseries?.categories || [];

  const toggleCategory = (name) => {
    setHiddenCategories((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <Card className="p-4 md:p-5">
      <SectionTitle
        icon={LineChartIcon}
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {groupByOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGroupBy(option.value)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                  groupBy === option.value
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-secondary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      {!loading && !categories.length ? (
        <EmptyPanel label={emptyLabel} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((name, index) => {
              const color = moduleColors[index % moduleColors.length];
              const isHidden = hiddenCategories.has(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleCategory(name)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity ${
                    isHidden ? "border-gray-200 text-gray-400 opacity-50" : "border-gray-200 text-secondary"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: isHidden ? "#d1d5db" : color }}
                  />
                  {name}
                </button>
              );
            })}
          </div>

          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries?.points || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="period" {...periodAxis} />
                <YAxis {...valueAxis} />
                <Tooltip />
                {categories
                  .filter((name) => !hiddenCategories.has(name))
                  .map((name) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      name={name}
                      stroke={moduleColors[categories.indexOf(name) % moduleColors.length]}
                      strokeWidth={2.2}
                      dot={false}
                      connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
};

const ModuleDetailPage = ({
  moduleName,
  queryState,
  eventTypes,
  hideExcluded,
  goToModules,
  openUser,
  openExplorer,
}) => {
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [users, setUsers] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [sorting, setSorting] = useState(paramToSortState("totalEvents.desc"));

  useEffect(() => {
    const loadModule = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();

        const [summaryResponse, timeseriesResponse] = await Promise.all([
          fetchApi(`/api/analytics/admin/modules/${encodeURIComponent(moduleName)}/summary?${query}`),
          fetchApi(`/api/analytics/admin/modules/${encodeURIComponent(moduleName)}/timeseries?${query}`),
        ]);
        const summaryData = await summaryResponse.json();
        const timeseriesData = await timeseriesResponse.json();
        setSummary(summaryData.success ? summaryData.module : null);
        setTimeseries(timeseriesData.success ? timeseriesData.timeseries : null);
      } catch (error) {
        console.error(error);
        setSummary(null);
        setTimeseries(null);
      } finally {
        setLoading(false);
      }
    };
    loadModule();
  }, [eventTypes, hideExcluded, moduleName, queryState.range]);

  useEffect(() => {
    const loadUsers = async () => {
      const query = new URLSearchParams({
        range: queryState.range,
        eventTypes: eventTypes.join(","),
        ...(hideExcluded ? { hideExcluded: "true" } : {}),
        page: String(pagination.pageIndex + 1),
        pageSize: String(pagination.pageSize),
        sort: sortStateToParam(sorting, "totalEvents.desc"),
      }).toString();

      try {
        const response = await fetchApi(`/api/analytics/admin/modules/${encodeURIComponent(moduleName)}/users?${query}`);
        const data = await response.json();
        setUsers(data.success ? data.users || [] : []);
        setRowCount(data.success ? data.pagination?.total || 0 : 0);
      } catch (error) {
        console.error(error);
        setUsers([]);
        setRowCount(0);
      }
    };

    loadUsers();
  }, [
    eventTypes,
    hideExcluded,
    moduleName,
    pagination.pageIndex,
    pagination.pageSize,
    queryState.range,
    sorting,
  ]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "username",
        header: "Utilisateur",
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => openUser(row.original.username)}>
            <p className="font-bold text-secondary hover:text-primary">{row.original.displayName}</p>
            <p className="text-xs text-gray-500">{row.original.username}</p>
          </button>
        ),
      },
      { accessorKey: "group", header: "Groupe" },
      { accessorKey: "totalEvents", header: "Events" },
      { accessorKey: "sessionsTotal", header: "Sessions" },
      { accessorKey: "activeDays", header: "Jours actifs" },
      {
        accessorKey: "avgSessionDuration",
        header: "Durée moy.",
        cell: ({ row }) => `${formatDecimal(row.original.avgSessionDuration)} min`,
      },
    ],
    [openUser],
  );

  if (loading && !summary) return <LoadingPanel label="Chargement du module..." />;
  if (!summary) return <ErrorPanel error="Impossible de charger ce module." />;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Modules", onClick: goToModules },
          { label: summary.module },
        ]}
      />

      <PageHeader
        level={2}
        kicker="Module"
        title={moduleLabel(summary.module)}
        subtitle={summary.module}
        actions={
          <>
            <button type="button" className="ui-button-secondary" onClick={goToModules}>
              <ArrowLeft size={16} /> Modules
            </button>
            <button
              type="button"
              className="ui-button-secondary"
              onClick={() => openExplorer({ module: summary.module })}
            >
              <Table2 size={16} /> Explorer
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Activity} label="Events" value={summary.totalEvents} />
        <StatCard icon={Users} label="Utilisateurs" value={summary.activeUsers} />
        <StatCard icon={Repeat2} label="Sessions" value={summary.sessionsTotal} />
        <StatCard icon={Clock3} label="Durée moy. session" value={`${formatDecimal(summary.avgSessionDuration)} min`} />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Eye} label="Vues" value={summary.exposureCount} />
        <StatCard icon={Clock3} label="Loads" value={summary.loadCount} />
        <StatCard icon={Activity} label="Interactions" value={summary.interactionCount} />
        <StatCard icon={Flame} label="Conversions" value={summary.conversionCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle icon={LineChartIcon} title="Évolution du module" />
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries?.points || []}>
                <defs>
                  <linearGradient id="moduleEventsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="period" {...periodAxis} />
                <YAxis {...valueAxis} />
                <Tooltip />
                <Area type="monotone" dataKey="events" name="Événements" stroke="var(--color-primary)" fill="url(#moduleEventsGradient)" strokeWidth={2.8} />
                <Line type="monotone" dataKey="activeUsers" name="Utilisateurs actifs" stroke="#2668d9" strokeWidth={2.2} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#f59e0b" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <SectionTitle icon={Activity} title="Top actions du module" />
          <MiniBarList items={summary.topEvents || []} onClickItem={(item) => openExplorer({ module: summary.module, eventName: item.name })} />
        </Card>
      </div>

      {moduleCategoryChartConfig[summary.module] && (
        <CategoryTimeseriesChart
          moduleName={summary.module}
          range={queryState.range}
          hideExcluded={hideExcluded}
          {...moduleCategoryChartConfig[summary.module]}
        />
      )}

      <Card className="p-4 md:p-5">
        <SectionTitle icon={Users} title="Utilisateurs du module" subtitle="Triable et paginé." />
        <DataTable
          columns={columns}
          data={users}
          pagination={pagination}
          setPagination={setPagination}
          sorting={sorting}
          setSorting={setSorting}
          rowCount={rowCount}
          loading={false}
          emptyLabel="Aucun utilisateur sur ce module"
        />
      </Card>
    </motion.div>
  );
};

const HeatmapTab = ({ queryState, eventTypes, hideExcluded }) => {
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("users");

  useEffect(() => {
    const loadHeatmap = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const response = await fetchApi(`/api/analytics/admin/heatmap?${query}`);
        const data = await response.json();
        setHeatmap(data.success ? data.heatmap : null);
      } catch (error) {
        console.error(error);
        setHeatmap(null);
      } finally {
        setLoading(false);
      }
    };
    loadHeatmap();
  }, [eventTypes, hideExcluded, queryState.range]);

  if (loading) return <LoadingPanel />;

  const cells = heatmap?.cells || [];
  const weekdays = heatmap?.weekdays || [];
  const hours = heatmap?.hours || [];
  const typicalDay = heatmap?.typicalDay || [];
  const modules = heatmap?.modules || [];
  const modulesByHour = heatmap?.modulesByHour || [];
  const valueOf = (cell) => (metric === "users" ? cell?.users || 0 : cell?.count || 0);
  const byKey = new Map(cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]));
  const max = Math.max(...cells.map(valueOf), 1);
  const metricLabel = metric === "users" ? "personnes" : "événements";

  const peakHour = typicalDay.reduce((best, point) => (point.weekday > (best?.weekday || 0) ? point : best), null);
  const peakWeekend = typicalDay.reduce((best, point) => (point.weekend > (best?.weekend || 0) ? point : best), null);
  const weekdayTotal = typicalDay.reduce((sum, point) => sum + point.weekday, 0);
  const weekendTotal = typicalDay.reduce((sum, point) => sum + point.weekend, 0);
  const byWeekday = weekdays.map((weekday) => ({
    weekday,
    value: hours.reduce((sum, hour) => sum + valueOf(byKey.get(`${weekday}-${hour}`)), 0),
  }));
  const peakDay = byWeekday.reduce((best, item) => (item.value > (best?.value || 0) ? item : best), null);
  // Plage où l'on dépasse la moitié du pic : "les gens sont là de 8h à 19h".
  const busyHours = peakHour?.weekday ? typicalDay.filter((point) => point.weekday >= peakHour.weekday / 2) : [];

  const cellStyle = (value) => ({
    backgroundColor: value
      ? `color-mix(in srgb, var(--color-primary) ${Math.round(12 + (value / max) * 88)}%, white)`
      : "#f3f4f6",
  });
  const cellTitle = (weekday, hour, cell) =>
    `${weekday} ${hour}h–${hour + 1}h : ${formatNumber(cell?.users || 0)} personnes, ${formatNumber(cell?.count || 0)} événements`;
  const hourLabel = (hour) => `${hour}h–${Number(hour) + 1}h`;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={Clock3}
          label="Heure de pointe (semaine)"
          value={peakHour?.weekday ? `${peakHour.hour}h` : "—"}
          detail={peakHour?.weekday ? `${formatDecimal(peakHour.weekday)} personnes en moyenne` : undefined}
        />
        <StatCard
          icon={Flame}
          label="Plage chargée"
          value={busyHours.length ? `${busyHours[0].hour}h – ${busyHours[busyHours.length - 1].hour + 1}h` : "—"}
          detail="Au moins la moitié du pic"
        />
        <StatCard
          icon={CalendarDays}
          label="Jour le plus actif"
          value={peakDay?.value ? peakDay.weekday : "—"}
          detail={peakDay?.value ? `${formatNumber(peakDay.value)} ${metricLabel} cumulés` : undefined}
        />
        <StatCard
          icon={Repeat2}
          label="Week-end"
          value={weekdayTotal ? `${Math.round((weekendTotal / weekdayTotal) * 100)} %` : "—"}
          detail={peakWeekend?.weekend ? `de l'activité d'un jour de semaine · pic à ${peakWeekend.hour}h` : "de l'activité d'un jour de semaine"}
        />
      </div>

      <Card className="p-4 md:p-5">
        <SectionTitle
          icon={Flame}
          title="Quand les gens viennent"
          subtitle="Par jour de semaine et par heure, à l'heure de Paris."
          action={
            <div className="flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
              {[
                ["users", "Personnes"],
                ["count", "Événements"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMetric(value)}
                  className={`rounded-full px-3 py-1 ${metric === value ? "bg-white text-secondary shadow-sm" : "text-gray-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />

        {/* PC : jours en lignes, 24 heures en colonnes. */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[760px] grid grid-cols-[88px_repeat(24,minmax(0,1fr))_56px] gap-[3px] text-xs">
            <div />
            {hours.map((hour) => (
              <div key={hour} className="text-center font-semibold text-gray-400">{hour}</div>
            ))}
            <div />
            {weekdays.map((weekday) => (
              <div key={weekday} className="contents">
                <div className="flex items-center font-semibold capitalize text-secondary">{weekday}</div>
                {hours.map((hour) => {
                  const cell = byKey.get(`${weekday}-${hour}`);
                  return (
                    <div
                      key={`${weekday}-${hour}`}
                      className="h-8 rounded"
                      title={cellTitle(weekday, hour, cell)}
                      style={cellStyle(valueOf(cell))}
                    />
                  );
                })}
                <div className="flex items-center justify-end text-gray-500 tabular-nums">
                  {formatNumber(byWeekday.find((item) => item.weekday === weekday)?.value || 0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile : heures en lignes, 7 jours en colonnes. */}
        <div className="md:hidden grid grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-[3px] text-[0.7rem]">
          <div />
          {weekdays.map((weekday) => (
            <div key={weekday} className="text-center font-semibold capitalize text-secondary">{weekday.slice(0, 3)}</div>
          ))}
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex items-center justify-end pr-1 font-semibold text-gray-400">{hour}h</div>
              {weekdays.map((weekday) => {
                const cell = byKey.get(`${weekday}-${hour}`);
                return (
                  <div
                    key={`${weekday}-${hour}`}
                    className="h-5 rounded-sm"
                    title={cellTitle(weekday, hour, cell)}
                    style={cellStyle(valueOf(cell))}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-gray-500">
          <span>Moins</span>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <span key={ratio} className="h-3 w-5 rounded-sm" style={cellStyle(ratio * max)} />
          ))}
          <span>Plus</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle
            icon={Clock3}
            title="Une journée type"
            subtitle="Personnes connectées en moyenne à chaque heure, un jour de semaine vs un jour de week-end."
          />
          <div className="h-60 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={typicalDay} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="typicalWeekday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2668d9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2668d9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} tick={{ fontSize: 11 }} minTickGap={10} axisLine={false} tickLine={false} />
                <YAxis {...valueAxis} allowDecimals axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={hourLabel} formatter={(value) => formatDecimal(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="weekday" name="En semaine" stroke="#2668d9" strokeWidth={2.5} fill="url(#typicalWeekday)" />
                <Area type="monotone" dataKey="weekend" name="Le week-end" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <SectionTitle
            icon={Layers3}
            title="Ce que les gens ouvrent selon l'heure"
            subtitle="Événements des modules les plus utilisés, heure par heure."
          />
          {modules.length ? (
            <div className="h-60 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modulesByHour} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} tick={{ fontSize: 11 }} minTickGap={10} axisLine={false} tickLine={false} />
                  <YAxis {...valueAxis} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={hourLabel} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {modules.map((module, index) => (
                    <Bar
                      key={module}
                      dataKey={module}
                      stackId="modules"
                      fill={moduleColors[index % moduleColors.length]}
                      radius={index === modules.length - 1 ? [4, 4, 0, 0] : 0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyPanel label="Pas assez de données par module" />
          )}
        </Card>
      </div>
    </motion.div>
  );
};



// Barre de progression horizontale avec pourcentage (entonnoir, promos).
const RateBar = ({ label, count, total, rate, color = "var(--color-primary)" }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-semibold text-secondary truncate">{label}</span>
      <span className="shrink-0 text-gray-500">
        <strong className="text-secondary">{formatNumber(count)}</strong>
        {total !== undefined && ` / ${formatNumber(total)}`} · {rate} %
      </span>
    </div>
    <div className="mt-1.5 h-2.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: color }} />
    </div>
  </div>
);

const SetupBadge = ({ ok, label }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${
      ok ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400 line-through"
    }`}
  >
    {label}
  </span>
);

const UserLine = ({ user, date, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2"
  >
    <span className="min-w-0">
      <span className="block font-semibold text-secondary truncate">{user.displayName}</span>
      <span className="block text-xs text-gray-500 truncate">
        {user.group} · {formatDateTime(date)}
      </span>
    </span>
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      <SetupBadge ok={user.hasIcal} label="EDT" />
      <SetupBadge ok={user.hasEntPassword} label="ENT" />
    </span>
  </button>
);

// Remplace l'ancien onglet Rétention : quand arrivent les nouveaux
// utilisateurs, et ont-ils vraiment configuré leur compte ?
const AcquisitionTab = ({ queryState, hideExcluded, openUser }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const response = await fetchApi(`/api/analytics/admin/acquisition?${query}`);
        const payload = await response.json();
        if (!active) return;
        if (payload.success) setData(payload.acquisition);
        else setError(payload.error || "Acquisition indisponible.");
      } catch (loadError) {
        console.error(loadError);
        if (active) setError("Erreur réseau lors du chargement de l'acquisition.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [hideExcluded, queryState.range]);

  if (loading && !data) return <LoadingPanel label="Chargement de l'acquisition..." />;
  if (error) return <ErrorPanel error={error} />;
  if (!data) return null;

  const { totals } = data;
  const periodLabel = data.groupBy === "week" ? "par semaine" : "par jour";

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={UserPlus}
          label="Nouveaux"
          value={totals.newUsers}
          detail={`dont ${formatNumber(totals.newWithIcal)} avec emploi du temps`}
        />
        <StatCard
          icon={Users}
          label="Comptes"
          value={totals.users}
          detail={`${formatNumber(totals.activeUsers)} connectés sur la période`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Emploi du temps"
          value={`${totals.withIcalRate} %`}
          detail={`${formatNumber(totals.withIcal)} comptes configurés`}
        />
        <StatCard
          icon={KeyRound}
          label="Mot de passe ENT"
          value={`${totals.withEntRate} %`}
          detail={`${formatNumber(totals.withEnt)} comptes (mails, Moodle)`}
        />
      </div>

      <Card className="p-4 md:p-5">
        <SectionTitle
          icon={UserPlus}
          title={`Nouveaux utilisateurs ${periodLabel}`}
          subtitle="Arrivée = première connexion enregistrée. La courbe montre le total de comptes."
        />
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="period" {...periodAxis} />
              <YAxis yAxisId="new" {...valueAxis} />
              <YAxis yAxisId="total" orientation="right" {...valueAxis} width={40} />
              <Tooltip labelFormatter={shortPeriod} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="new" dataKey="newUsers" name="Nouveaux" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="new" dataKey="newWithIcal" name="…avec emploi du temps" fill="#49c16b" radius={[6, 6, 0, 0]} />
              <Line yAxisId="total" type="monotone" dataKey="totalUsers" name="Total comptes" stroke="#2c3e50" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle
            icon={CalendarCheck}
            title="Configuration des comptes"
            subtitle="Sur l'ensemble des comptes, pas seulement la période."
          />
          <div className="space-y-4">
            {data.funnel.map((step, index) => (
              <RateBar
                key={step.key}
                label={step.label}
                count={step.count}
                rate={step.rate}
                color={["#2c3e50", "var(--color-primary)", "#2668d9", "#f59e0b"][index]}
              />
            ))}
          </div>
          {totals.neverLogged > 0 && (
            <p className="mt-4 text-xs text-gray-500">
              {formatNumber(totals.neverLogged)} compte(s) sans connexion enregistrée (créés avant le suivi des connexions).
            </p>
          )}
        </Card>

        <Card className="p-4 md:p-5">
          <SectionTitle
            icon={Users}
            title="Emploi du temps par promo"
            subtitle="Part des comptes de chaque promo qui ont ajouté leur lien HP."
          />
          <div className="space-y-4">
            {data.byGroup.map((group) => (
              <RateBar
                key={group.group}
                label={`${group.group}${group.newUsers ? ` · +${group.newUsers}` : ""}`}
                count={group.withIcal}
                total={group.users}
                rate={group.withIcalRate}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4 md:p-5">
          <SectionTitle
            icon={UserPlus}
            title="Derniers arrivés"
            subtitle="Les plus récents d'abord, avec ce qu'ils ont configuré."
          />
          {data.recentUsers.length ? (
            <div className="divide-y divide-gray-100">
              {data.recentUsers.map((user) => (
                <UserLine
                  key={user.username}
                  user={user}
                  date={user.firstLoginAt}
                  onClick={() => openUser(user.username)}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel label="Aucun nouvel utilisateur sur la période" />
          )}
        </Card>

        <Card className="p-4 md:p-5">
          <SectionTitle
            icon={CalendarDays}
            title="Actifs sans emploi du temps"
            subtitle={`${formatNumber(totals.activeWithoutIcal)} personne(s) connectée(s) sur la période sans lien HP : à relancer.`}
          />
          {data.activeWithoutIcal.length ? (
            <div className="divide-y divide-gray-100">
              {data.activeWithoutIcal.map((user) => (
                <UserLine
                  key={user.username}
                  user={user}
                  date={user.lastLoginAt}
                  onClick={() => openUser(user.username)}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel label="Tous les actifs ont mis leur emploi du temps" />
          )}
        </Card>
      </div>
    </motion.div>
  );
};

const ExcludedUsersTab = ({ onChange }) => {
  const [excludedUsers, setExcludedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const loadExcludedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/api/analytics/admin/excluded-users");
      const data = await response.json();
      setExcludedUsers(data.success ? data.excludedUsers || [] : []);
    } catch (error) {
      console.error(error);
      setExcludedUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExcludedUsers();
  }, [loadExcludedUsers]);

  const addExcludedUser = async (event) => {
    event.preventDefault();
    if (!form.username.trim()) return;
    setSaving(true);
    try {
      const response = await fetchApi("/api/analytics/admin/excluded-users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (data.success) {
        setExcludedUsers(data.excludedUsers || []);
        setForm({ username: "", reason: "" });
        onChange?.();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const removeExcludedUser = async (username) => {
    setSaving(true);
    try {
      const response = await fetchApi(
        `/api/analytics/admin/excluded-users/${encodeURIComponent(username)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (data.success) {
        setExcludedUsers(data.excludedUsers || []);
        onChange?.();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Card className="p-4 md:p-5">
        <SectionTitle
          icon={UserMinus}
          title="Utilisateurs exclus"
          subtitle="Ces comptes restent collectés, mais peuvent être masqués des visualisations avec le toggle global."
        />
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_auto]" onSubmit={addExcludedUser}>
          <label>
            <span className="text-xs font-bold uppercase text-gray-500">Username</span>
            <input
              className="ui-field mt-1"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="prenom.nom"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-gray-500">Raison</span>
            <input
              className="ui-field mt-1"
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="admin, test, debug, compte perso..."
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="ui-button" disabled={saving}>
              <UserMinus size={16} /> Ajouter
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-4 md:p-5">
        {loading ? (
          <EmptyPanel label="Chargement des exclusions..." />
        ) : excludedUsers.length ? (
          <div className="space-y-2">
            {excludedUsers.map((item) => (
              <motion.div
                key={item.username}
                variants={itemVariants}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div>
                  <p className="font-bold text-secondary">{item.displayName}</p>
                  <p className="text-xs text-gray-500">
                    {item.username} · {item.group} · {item.reason || "Sans raison"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Ajouté par {item.createdByDisplayName} le {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="ui-button-secondary min-h-0 px-3 py-1.5 text-xs"
                  disabled={saving}
                  onClick={() => removeExcludedUser(item.username)}
                >
                  Retirer
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyPanel label="Aucun utilisateur exclu pour l’instant" />
        )}
      </Card>
    </motion.div>
  );
};

const AnalyticsAdminPage = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeState = useMemo(() => parseRouteState(location.pathname), [location.pathname]);
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState("");
  const [exclusionVersion, setExclusionVersion] = useState(0);

  const range = searchParams.get("range") || "30d";
  const rawEventTypes = (searchParams.get("eventTypes") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const eventTypes = rawEventTypes.length ? rawEventTypes : defaultEventTypes;
  const hideExcluded = searchParams.get("hideExcluded") === "true";

  const queryState = {
    range,
    eventTypes,
    hideExcluded,
    module: searchParams.get("module") || "",
    eventName: searchParams.get("eventName") || "",
    username: searchParams.get("username") || "",
    group: searchParams.get("group") || "",
    usersSearch: searchParams.get("usersSearch") || "",
    usersGroup: searchParams.get("usersGroup") || "",
  };

  const updateQuery = useCallback((patch = {}, { replace = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  const setEventTypes = useCallback((valueOrUpdater) => {
    const nextValue =
      typeof valueOrUpdater === "function"
        ? valueOrUpdater(eventTypes)
        : valueOrUpdater;
    updateQuery({
      eventTypes: nextValue.join(","),
    });
  }, [eventTypes, updateQuery]);

  const setHideExcluded = useCallback((value) => {
    updateQuery({
      hideExcluded: value ? "true" : "",
    });
  }, [updateQuery]);

  const goToPath = useCallback((path, patch = {}) => {
    navigate(`${path}${buildSearchString(searchParams, patch)}`);
  }, [navigate, searchParams]);

  const goToTab = useCallback((tabId) => {
    const tab = tabs.find((item) => item.id === tabId) || tabs[0];
    goToPath(tab.path);
  }, [goToPath]);

  const openUser = useCallback((username) => {
    if (!username) return;
    goToPath(`/analytics/admin/users/${encodeURIComponent(username)}`);
  }, [goToPath]);

  const openModule = useCallback((moduleName) => {
    if (!moduleName) return;
    goToPath(`/analytics/admin/modules/${encodeURIComponent(moduleName)}`);
  }, [goToPath]);

  const openExplorer = useCallback(({ module = "", eventName = "", username = "", group = "", eventTypeOnly = "" } = {}) => {
    if (eventTypeOnly) {
      goToPath("/analytics/admin/explorer", {
        module,
        eventName,
        username,
        group,
        eventTypes: eventTypeOnly,
      });
      return;
    }

    goToPath("/analytics/admin/explorer", {
      module,
      eventName,
      username,
      group,
    });
  }, [goToPath]);

  useEffect(() => {
    if (!user?.is_admin) return;
    if (routeState.section !== "overview") return;

    const loadOverview = async () => {
      setLoadingOverview(true);
      setError("");
      try {
        const query = new URLSearchParams({
          range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const [summaryResponse, timeseriesResponse] = await Promise.all([
          fetchApi(`/api/analytics/admin/summary?${query}`),
          fetchApi(`/api/analytics/admin/timeseries?${query}&groupBy=day`),
        ]);
        const summaryData = await summaryResponse.json();
        const timeseriesData = await timeseriesResponse.json();

        if (!summaryData.success || !timeseriesData.success) {
          setError(summaryData.error || timeseriesData.error || "Impossible de charger les statistiques.");
          return;
        }

        setSummary(summaryData.summary);
        setTimeseries(timeseriesData.timeseries);
      } catch (loadError) {
        console.error(loadError);
        setError("Erreur réseau lors du chargement des statistiques.");
      } finally {
        setLoadingOverview(false);
      }
    };

    loadOverview();
  }, [eventTypes, exclusionVersion, hideExcluded, range, routeState.section, user?.is_admin]);

  if (!user?.is_admin) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold text-secondary">
              Accès admin requis
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Les statistiques produit agrégées sont réservées aux administrateurs.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <PageHeader
        icon={PageIcon}
        kicker="Admin"
        title="Analytics"
        actions={
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold text-secondary">Période</span>
            <select
              className="ui-select"
              value={range}
              onChange={(event) => updateQuery({ range: event.target.value })}
            >
              {ranges.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <Card className="overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-secondary">
            <div className="flex gap-2">
              <LockKeyhole className="mt-0.5 shrink-0 text-primary" size={16} />
              <p>
                Les vues nominatives servent au diagnostic produit interne. Toute
                communication externe doit rester agrégée.
              </p>
            </div>
          </div>

          <EventTypeFilterBar
            eventTypes={eventTypes}
            setEventTypes={setEventTypes}
            hideExcluded={hideExcluded}
            setHideExcluded={setHideExcluded}
          />
        </div>
      </Card>

      <Card className="p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                routeState.section === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "text-secondary hover:bg-primary/10 hover:text-primary"
              }`}
              onClick={() => goToTab(tab.id)}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {error && routeState.section === "overview" ? <ErrorPanel error={error} /> : null}

      {routeState.section === "musee" && (
        <MuseeAnalyticsPanel range={queryState.range || "30d"} hideExcluded={hideExcluded} />
      )}

      {routeState.section === "overview" && (
        loadingOverview ? (
          <LoadingPanel />
        ) : (
          <OverviewTab
            summary={summary}
            timeseries={timeseries}
            range={queryState.range}
            goToTab={goToTab}
            openModule={openModule}
            openExplorer={openExplorer}
            openUser={openUser}
          />
        )
      )}

      {routeState.section === "explorer" && (
        <ExplorerTab
          queryState={queryState}
          setQueryState={updateQuery}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
          openUser={openUser}
          openModule={openModule}
        />
      )}

      {routeState.section === "users" && routeState.type === "userDetail" && (
        <UserDetailPage
          username={routeState.username}
          queryState={queryState}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
          goToUsers={() => goToPath("/analytics/admin/users")}
          openModule={openModule}
          openExplorer={openExplorer}
        />
      )}

      {routeState.section === "users" && routeState.type !== "userDetail" && (
        <UsersPage
          queryState={queryState}
          setQueryState={updateQuery}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
          openUser={openUser}
        />
      )}

      {routeState.section === "modules" && routeState.type === "moduleDetail" && (
        <ModuleDetailPage
          moduleName={routeState.moduleName}
          queryState={queryState}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
          goToModules={() => goToPath("/analytics/admin/modules")}
          openUser={openUser}
          openExplorer={openExplorer}
        />
      )}

      {routeState.section === "modules" && routeState.type !== "moduleDetail" && (
        <ModulesPage
          queryState={queryState}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
          openModule={openModule}
        />
      )}

      {routeState.section === "heatmap" && (
        <HeatmapTab
          queryState={queryState}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
        />
      )}

      {routeState.section === "acquisition" && (
        <AcquisitionTab
          queryState={queryState}
          hideExcluded={hideExcluded}
          openUser={openUser}
        />
      )}

      {routeState.section === "excluded" && (
        <ExcludedUsersTab onChange={() => setExclusionVersion((value) => value + 1)} />
      )}
    </motion.div>
  );
};

export default AnalyticsAdminPage;
