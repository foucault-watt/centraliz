import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  Flame,
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
  Line,
  LineChart,
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

const tabs = [
  { id: "overview", label: "Aperçu", icon: BarChart3, path: "/analytics/admin" },
  { id: "explorer", label: "Explorer", icon: Table2, path: "/analytics/admin/explorer" },
  { id: "users", label: "Utilisateurs", icon: Users, path: "/analytics/admin/users" },
  { id: "sessions", label: "Sessions", icon: Repeat2, path: "/analytics/admin/sessions" },
  { id: "modules", label: "Modules", icon: Layers3, path: "/analytics/admin/modules" },
  { id: "heatmap", label: "Temps forts", icon: Flame, path: "/analytics/admin/heatmap" },
  { id: "retention", label: "Rétention", icon: Repeat2, path: "/analytics/admin/retention" },
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

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(value || 0);

const formatDecimal = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value || 0);

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
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
        className={`relative w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 text-left shadow-md ${
          onClick ? "transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/30" : ""
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-primary/80" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={18} />
          </span>
        </div>
        <p className="mt-4 text-3xl font-extrabold text-secondary">
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

const OverviewTab = ({
  summary,
  timeseries,
  goToTab,
  openModule,
  openExplorer,
  openUser,
}) => (
  <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard icon={Activity} label="Événements" value={summary?.totals?.events} onClick={() => goToTab("explorer")} />
      <StatCard icon={Users} label="Utilisateurs actifs" value={summary?.totals?.activeUsers} onClick={() => goToTab("users")} />
      <StatCard icon={Repeat2} label="Sessions" value={summary?.totals?.sessionsTotal} detail="Connexions d’usage" onClick={() => goToTab("sessions")} />
      <StatCard icon={CalendarDays} label="DAU" value={summary?.totals?.dau} />
      <StatCard icon={Repeat2} label="WAU" value={summary?.totals?.wau} />
      <StatCard icon={BarChart3} label="MAU" value={summary?.totals?.mau} />
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Eye} label="Vues modules" value={summary?.eventTypeTotals?.exposure} detail="Exposition, pas usage actif" onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "exposure" })} />
      <StatCard icon={Clock3} label="Loads automatiques" value={summary?.eventTypeTotals?.load} detail="Fetchs et chargements data" onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "load" })} />
      <StatCard icon={Activity} label="Interactions réelles" value={summary?.eventTypeTotals?.interaction} detail="Intentions utilisateur" onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "interaction" })} />
      <StatCard icon={Flame} label="Conversions produit" value={summary?.eventTypeTotals?.conversion} detail="Actions à forte valeur" onClick={() => openExplorer({ eventName: "", module: "", eventTypeOnly: "conversion" })} />
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={LineChartIcon} label="Events / session" value={formatDecimal(summary?.totals?.avgEventsPerSession || 0)} detail="Moyenne d’usage" />
      <StatCard icon={Clock3} label="Durée session" value={`${formatDecimal(summary?.totals?.avgSessionDuration || 0)} min`} />
      <StatCard icon={LogIn} label="Logins backend" value={summary?.totals?.loginCount} detail="Auth explicites" />
      <StatCard icon={CalendarDays} label="Nouveaux users" value={summary?.newVsReturning?.newUsers} detail={`${formatNumber(summary?.newVsReturning?.returningUsers)} récurrents`} />
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Clock3} label="Heures actives" value={summary?.totals?.activeHoursCount} detail="Heures distinctes d’usage" />
      <StatCard icon={Users} label="Users récurrents" value={summary?.totals?.recurrentUsers} detail="Déjà vus avant la période" onClick={() => goToTab("retention")} />
      <StatCard icon={CalendarDays} label="Première activité" value={summary?.totals?.firstSeenAt ? formatDateTime(summary.totals.firstSeenAt) : "Jamais"} />
      <StatCard icon={Activity} label="Dernière activité" value={summary?.totals?.lastSeenAt ? formatDateTime(summary.totals.lastSeenAt) : "Jamais"} />
    </div>

    <Card className="p-5">
      <SectionTitle
        icon={LineChartIcon}
        title="Usage dans le temps"
        subtitle="Événements, utilisateurs actifs et sessions d’usage."
      />
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeseries?.points || []}>
            <defs>
              <linearGradient id="eventsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="events" name="Événements" stroke="var(--color-primary)" fill="url(#eventsGradient)" strokeWidth={2.8} />
            <Line type="monotone" dataKey="activeUsers" name="Utilisateurs actifs" stroke="#2668d9" strokeWidth={2.2} />
            <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#f59e0b" strokeWidth={2.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <SectionTitle icon={Layers3} title="Modules les plus utilisés" />
        <MiniBarList items={summary?.eventsByModule || []} onClickItem={(item) => openModule(item.name)} />
      </Card>
      <Card className="p-5">
        <SectionTitle icon={Activity} title="Actions fréquentes" />
        <MiniBarList items={summary?.topEvents || []} onClickItem={(item) => openExplorer({ eventName: item.name })} />
      </Card>
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="p-5 xl:col-span-2">
        <SectionTitle icon={CalendarDays} title="Activité par jour de semaine" subtitle="Pour repérer les rythmes forts de Centraliz." />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary?.activityByWeekday || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Événements" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={Users} title="Groupes actifs" subtitle="Lecture rapide par cohorte existante." />
        <MiniBarList items={summary?.usersByGroup || []} onClickItem={(item) => openExplorer({ group: item.name })} />
      </Card>
    </div>

    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <SectionTitle icon={Repeat2} title="Sessions par jour" subtitle="Pour distinguer retour, fréquence et simple volume d’events." />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={summary?.sessionsByDay || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" name="Sessions" stroke="#f59e0b" strokeWidth={2.6} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={Users} title="Utilisateurs récurrents" subtitle="Les profils les plus présents sur la période." />
        <div className="space-y-3">
          {(summary?.returningUsersPreview || []).length ? (
            summary.returningUsersPreview.map((item) => (
              <button
                key={item.username}
                type="button"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                onClick={() => openUser(item.username)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-secondary">{item.displayName}</p>
                    <p className="text-xs text-gray-500">{item.username} · {item.group}</p>
                  </div>
                  <span className="ui-badge">{formatNumber(item.sessionsTotal)} sessions</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {formatNumber(item.activeDays)} jour(s) actifs · {formatNumber(item.totalEvents)} events
                </p>
              </button>
            ))
          ) : (
            <EmptyPanel label="Pas encore de profils récurrents visibles" />
          )}
        </div>
      </Card>
    </div>
  </motion.div>
);

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

const SessionsPage = ({
  queryState,
  setQueryState,
  eventTypes,
  hideExcluded,
  openUser,
  openExplorer,
}) => {
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState(paramToSortState("startedAt.desc"));

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({
      range: queryState.range,
      eventTypes: eventTypes.join(","),
      ...(hideExcluded ? { hideExcluded: "true" } : {}),
      ...(queryState.username ? { username: queryState.username } : {}),
      ...(queryState.group ? { group: queryState.group } : {}),
      ...(queryState.module ? { module: queryState.module } : {}),
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sort: sortStateToParam(sorting, "startedAt.desc"),
    }).toString();

    try {
      const response = await fetchApi(`/api/analytics/admin/sessions?${query}`);
      const data = await response.json();
      setSessions(data.success ? data.sessions || [] : []);
      setSummary(data.success ? data.summary || null : null);
      setRowCount(data.success ? data.pagination?.total || 0 : 0);
    } catch (error) {
      console.error(error);
      setSessions([]);
      setSummary(null);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [eventTypes, hideExcluded, pagination.pageIndex, pagination.pageSize, queryState, sorting]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "userUsername",
        header: "Utilisateur",
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => openUser(row.original.userUsername)}>
            <p className="font-bold text-secondary hover:text-primary">{row.original.userDisplayName}</p>
            <p className="text-xs text-gray-500">{row.original.userUsername}</p>
          </button>
        ),
      },
      {
        accessorKey: "startedAt",
        header: "Début",
        cell: ({ row }) => formatDateTime(row.original.startedAt),
      },
      {
        accessorKey: "durationMinutes",
        header: "Durée",
        cell: ({ row }) => `${formatDecimal(row.original.durationMinutes)} min`,
      },
      { accessorKey: "eventCount", header: "Events" },
      { accessorKey: "loginEvents", header: "Logins" },
      {
        accessorKey: "moduleCount",
        header: "Modules",
        cell: ({ row }) => (
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {(row.original.modules || []).slice(0, 3).map((moduleName) => (
              <button
                key={moduleName}
                type="button"
                className="ui-badge"
                onClick={() => openExplorer({ module: moduleName, username: row.original.userUsername })}
              >
                {moduleName}
              </button>
            ))}
            {(row.original.modules || []).length > 3 ? (
              <span className="text-xs text-gray-400">+{row.original.modules.length - 3}</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "topEvents",
        header: "Top actions",
        enableSorting: false,
        cell: ({ row }) => <JsonBadges value={Object.fromEntries((row.original.topEvents || []).slice(0, 3).map((item) => [item.name, item.count]))} />,
      },
    ],
    [openExplorer, openUser],
  );

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Repeat2} label="Sessions" value={summary?.sessionsTotal} detail="Connexions d’usage" />
        <StatCard icon={Users} label="Utilisateurs" value={summary?.activeUsers} />
        <StatCard icon={Clock3} label="Durée moy." value={`${formatDecimal(summary?.avgSessionDuration || 0)} min`} />
        <StatCard icon={Activity} label="Events / session" value={formatDecimal(summary?.avgEventsPerSession || 0)} />
      </div>

      <Card className="p-4">
        <SectionTitle icon={Repeat2} title="Exploration des sessions" subtitle="Une session se coupe après 10 minutes sans activité." />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ["username", "Utilisateur"],
            ["group", "Groupe"],
            ["module", "Module"],
          ].map(([key, label]) => (
            <label key={key}>
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
                setQueryState({ username: "", group: "", module: "" });
              }}
            >
              <Search size={16} /> Réinitialiser
            </button>
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={sessions}
        pagination={pagination}
        setPagination={setPagination}
        sorting={sorting}
        setSorting={setSorting}
        rowCount={rowCount}
        loading={loading}
        emptyLabel="Aucune session sur cette période"
      />
    </motion.div>
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

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Utilisateurs", onClick: goToUsers },
          { label: detail.displayName || username },
        ]}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button type="button" className="ui-button-secondary mb-3" onClick={goToUsers}>
              <ArrowLeft size={16} /> Retour aux utilisateurs
            </button>
            <p className="text-sm font-bold uppercase tracking-wide text-primary">Fiche utilisateur</p>
            <h1 className="mt-1 text-2xl font-bold text-secondary md:text-3xl">
              {detail.displayName}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {detail.username} · {detail.group}
            </p>
          </div>
          <button
            type="button"
            className="ui-button-secondary"
            onClick={() => openExplorer({ username: detail.username })}
          >
            <Table2 size={16} /> Ouvrir dans Explorer
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Activity} label="Events" value={detail.totalEvents} />
        <StatCard icon={Repeat2} label="Sessions" value={detail.sessionsTotal} detail="Connexions d’usage" />
        <StatCard icon={Clock3} label="Durée moy. session" value={`${formatDecimal(detail.avgSessionDuration)} min`} />
        <StatCard icon={LogIn} label="Logins backend" value={detail.loginsBackend} detail="Réauth explicites" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Jours actifs" value={detail.activeDays} />
        <StatCard icon={BarChart3} label="Events / session" value={formatDecimal(detail.avgEventsPerSession)} />
        <StatCard icon={Eye} label="Interactions" value={detail.interactionCount} />
        <StatCard icon={Flame} label="Conversions" value={detail.conversionCount} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Heures actives" value={detail.activeHoursCount} detail="Créneaux distincts" />
        <StatCard icon={CalendarDays} label="Première activité" value={detail.firstSeenAt ? formatDateTime(detail.firstSeenAt) : "Jamais"} />
        <StatCard icon={Activity} label="Dernière activité" value={detail.lastSeenAt ? formatDateTime(detail.lastSeenAt) : "Jamais"} />
        <StatCard icon={Clock3} label="Loads automatiques" value={detail.loadCount} detail="Bruit technique séparé" />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={LineChartIcon} title="Activité quotidienne" subtitle="Événements, sessions et logins backend par jour." />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries?.points || []}>
                <defs>
                  <linearGradient id="userEventsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="events" name="Événements" stroke="var(--color-primary)" fill="url(#userEventsGradient)" strokeWidth={2.8} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#f59e0b" strokeWidth={2.2} />
                <Line type="monotone" dataKey="logins" name="Logins backend" stroke="#dc2626" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={Clock3} title="Heures d’activité" subtitle="Quand cet utilisateur utilise Centraliz." />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detail.activityByHour || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Événements" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle icon={CalendarDays} title="Activité par jour de semaine" subtitle="Lecture simple des habitudes réelles de cet utilisateur." />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={detail.activityByWeekday || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Événements" fill="#2668d9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={Layers3} title="Modules préférés" />
          <MiniBarList items={detail.modules || []} onClickItem={(item) => openModule(item.name)} />
        </Card>
        <Card className="p-5">
          <SectionTitle icon={Activity} title="Top actions" />
          <MiniBarList items={detail.topEvents || []} onClickItem={(item) => openExplorer({ username: detail.username, eventName: item.name })} />
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle icon={BarChart3} title="Répartition par type d’event" />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={detail.eventTypes || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Événements" radius={[8, 8, 0, 0]}>
                {(detail.eventTypes || []).map((_, index) => (
                  <Cell key={index} fill={moduleColors[index % moduleColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
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

      <Card className="p-5">
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

const ModulesPage = ({
  queryState,
  eventTypes,
  hideExcluded,
  openModule,
}) => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const response = await fetchApi(`/api/analytics/admin/modules?${query}`);
        const data = await response.json();
        setModules(data.success ? data.modules || [] : []);
      } catch (error) {
        console.error(error);
        setModules([]);
      } finally {
        setLoading(false);
      }
    };
    loadModules();
  }, [eventTypes, hideExcluded, queryState.range]);

  if (loading) return <LoadingPanel />;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Card className="p-5">
        <SectionTitle icon={Layers3} title="Modules" subtitle="Chaque ligne ouvre une page dédiée plus détaillée." />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => (
            <motion.button
              key={item.module}
              type="button"
              variants={itemVariants}
              onClick={() => openModule(item.module)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-bold text-secondary">{item.module}</span>
                <span className="ui-badge">{formatNumber(item.totalEvents)} events</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-500">
                <div>
                  <p className="text-xs font-bold uppercase">Utilisateurs</p>
                  <p className="mt-1 font-semibold text-secondary">{formatNumber(item.activeUsers)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase">Sessions</p>
                  <p className="mt-1 font-semibold text-secondary">{formatNumber(item.sessionsTotal)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase">Interactions</p>
                  <p className="mt-1 font-semibold text-secondary">{formatNumber(item.interactionCount)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase">Conversions</p>
                  <p className="mt-1 font-semibold text-secondary">{formatNumber(item.conversionCount)}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>
    </motion.div>
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

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button type="button" className="ui-button-secondary mb-3" onClick={goToModules}>
              <ArrowLeft size={16} /> Retour aux modules
            </button>
            <p className="text-sm font-bold uppercase tracking-wide text-primary">Module</p>
            <h1 className="mt-1 text-2xl font-bold text-secondary md:text-3xl">
              {summary.module}
            </h1>
          </div>
          <button
            type="button"
            className="ui-button-secondary"
            onClick={() => openExplorer({ module: summary.module })}
          >
            <Table2 size={16} /> Ouvrir dans Explorer
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Activity} label="Events" value={summary.totalEvents} />
        <StatCard icon={Users} label="Utilisateurs" value={summary.activeUsers} />
        <StatCard icon={Repeat2} label="Sessions" value={summary.sessionsTotal} />
        <StatCard icon={Clock3} label="Durée moy. session" value={`${formatDecimal(summary.avgSessionDuration)} min`} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Eye} label="Vues" value={summary.exposureCount} />
        <StatCard icon={Clock3} label="Loads" value={summary.loadCount} />
        <StatCard icon={Activity} label="Interactions" value={summary.interactionCount} />
        <StatCard icon={Flame} label="Conversions" value={summary.conversionCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={LineChartIcon} title="Évolution du module" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries?.points || []}>
                <defs>
                  <linearGradient id="moduleEventsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="events" name="Événements" stroke="var(--color-primary)" fill="url(#moduleEventsGradient)" strokeWidth={2.8} />
                <Line type="monotone" dataKey="activeUsers" name="Utilisateurs actifs" stroke="#2668d9" strokeWidth={2.2} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#f59e0b" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={Activity} title="Top actions du module" />
          <MiniBarList items={summary.topEvents || []} onClickItem={(item) => openExplorer({ module: summary.module, eventName: item.name })} />
        </Card>
      </div>

      <Card className="p-5">
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

  const max = Math.max(...(heatmap?.cells || []).map((cell) => cell.count), 1);
  const byKey = new Map((heatmap?.cells || []).map((cell) => [`${cell.weekday}-${cell.hour}`, cell]));

  return (
    <Card className="p-5">
      <SectionTitle
        icon={Flame}
        title="Temps forts"
        subtitle="Activité agrégée par heure et jour de semaine."
      />
      <div className="overflow-x-auto">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[110px_repeat(24,minmax(28px,1fr))] gap-1 text-xs">
            <div />
            {(heatmap?.hours || []).map((hour) => (
              <div key={hour} className="text-center font-bold text-gray-400">
                {hour}
              </div>
            ))}
            {(heatmap?.weekdays || []).map((weekday) => (
              <div key={weekday} className="contents">
                <div className="flex items-center font-bold capitalize text-secondary">
                  {weekday}
                </div>
                {(heatmap?.hours || []).map((hour) => {
                  const cell = byKey.get(`${weekday}-${hour}`) || { count: 0 };
                  const intensity = cell.count / max;
                  return (
                    <div
                      key={`${weekday}-${hour}`}
                      className="h-8 rounded-md border border-white"
                      title={`${weekday} ${hour}h: ${cell.count} événements`}
                      style={{
                        backgroundColor: `rgba(31, 157, 138, ${0.08 + intensity * 0.82})`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const RetentionTab = ({ queryState, eventTypes, hideExcluded }) => {
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRetention = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          range: queryState.range,
          eventTypes: eventTypes.join(","),
          ...(hideExcluded ? { hideExcluded: "true" } : {}),
        }).toString();
        const response = await fetchApi(`/api/analytics/admin/retention?${query}`);
        const data = await response.json();
        setRetention(data.success ? data.retention : null);
      } catch (error) {
        console.error(error);
        setRetention(null);
      } finally {
        setLoading(false);
      }
    };
    loadRetention();
  }, [eventTypes, hideExcluded, queryState.range]);

  if (loading) return <LoadingPanel />;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Utilisateurs actifs" value={retention?.activeUsers} />
        <StatCard icon={Repeat2} label="Sessions / user" value={formatDecimal(retention?.avgSessionsPerUser || 0)} />
        <StatCard icon={CalendarDays} label="Buckets jours" value={retention?.activeDayBuckets?.length} />
        <StatCard icon={Layers3} label="Buckets modules" value={retention?.moduleBreadth?.length} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <SectionTitle icon={Repeat2} title="Fréquence de retour" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retention?.activeDayBuckets || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Utilisateurs" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={Layers3} title="Largeur d’usage" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retention?.moduleBreadth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Utilisateurs" radius={[8, 8, 0, 0]}>
                  {(retention?.moduleBreadth || []).map((_, index) => (
                    <Cell key={index} fill={moduleColors[index % moduleColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={Clock3} title="Sessions par utilisateur" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retention?.sessionBreadth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Utilisateurs" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <SectionTitle icon={Flame} title="Utilisateurs les plus récurrents" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(retention?.stickyUsers || []).map((item) => (
            <div key={item.username} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="font-bold text-secondary">{item.displayName || item.username}</p>
              <p className="text-xs text-gray-500">{item.username}</p>
              <p className="mt-1 text-sm text-gray-500">
                {item.activeDays} jour(s) actifs · {item.moduleCount} module(s) · {item.sessionsTotal} session(s)
              </p>
            </div>
          ))}
        </div>
      </Card>
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
      <Card className="p-5">
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

      <Card className="p-5">
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
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-primary">
                Analytics produit
              </p>
              <h1 className="mt-1 text-2xl font-bold text-secondary md:text-3xl">
                Console d’analyse Centraliz
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-600">
                Chiffres exacts, sessions d’usage et drilldowns admin dédiés.
              </p>
            </div>
            <label className="block min-w-44 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
              <span className="text-sm font-semibold text-secondary">Période</span>
              <select
                className="ui-select mt-1"
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
          </div>

          <div className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-secondary">
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

      {routeState.section === "overview" && (
        loadingOverview ? (
          <LoadingPanel />
        ) : (
          <OverviewTab
            summary={summary}
            timeseries={timeseries}
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

      {routeState.section === "sessions" && (
        <SessionsPage
          queryState={queryState}
          setQueryState={updateQuery}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
          openUser={openUser}
          openExplorer={openExplorer}
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

      {routeState.section === "retention" && (
        <RetentionTab
          queryState={queryState}
          eventTypes={eventTypes}
          hideExcluded={hideExcluded}
        />
      )}

      {routeState.section === "excluded" && (
        <ExcludedUsersTab onChange={() => setExclusionVersion((value) => value + 1)} />
      )}
    </motion.div>
  );
};

export default AnalyticsAdminPage;
