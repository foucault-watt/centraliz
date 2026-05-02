import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock3,
  Eye,
  Flame,
  Layers3,
  LineChart as LineChartIcon,
  LockKeyhole,
  Repeat2,
  Search,
  ShieldAlert,
  Table2,
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
  { id: "overview", label: "Aperçu", icon: BarChart3 },
  { id: "explorer", label: "Explorer", icon: Table2 },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "modules", label: "Modules", icon: Layers3 },
  { id: "heatmap", label: "Temps forts", icon: Flame },
  { id: "retention", label: "Rétention", icon: Repeat2 },
];

const moduleColors = ["#1f9d8a", "#2668d9", "#f59e0b", "#dc2626", "#7c3aed", "#0f766e"];

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(value || 0);

const formatDateTime = (value) => {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const toQueryString = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  return query.toString();
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

const StatCard = ({ icon: Icon, label, value, detail }) => (
  <motion.article
    variants={itemVariants}
    whileHover={{ y: -2 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-md"
  >
    <div className="absolute inset-x-0 top-0 h-1 bg-primary/80" />
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={18} />
      </span>
    </div>
    <p className="mt-4 text-3xl font-extrabold text-secondary">
      {formatNumber(value)}
    </p>
    {detail && <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>}
  </motion.article>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div>
      <h2 className="text-lg font-bold text-secondary">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon size={19} />
    </span>
  </div>
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

const MiniBarList = ({ items, labelKey = "name" }) => {
  const max = Math.max(...(items || []).map((item) => item.count), 1);
  if (!items?.length) return <EmptyPanel />;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <motion.div
          key={item[labelKey]}
          className="space-y-1"
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.025 }}
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-gray-700">
              {item[labelKey]}
            </span>
            <span className="text-gray-500">{formatNumber(item.count)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      ))}
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
        <table className="w-full min-w-[820px] text-left text-sm">
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
            onChange={(event) =>
              table.setPageSize(Number(event.target.value))
            }
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

const OverviewTab = ({ summary, timeseries }) => (
  <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard icon={Activity} label="Événements" value={summary?.totals?.events} />
      <StatCard icon={Users} label="Utilisateurs actifs" value={summary?.totals?.activeUsers} />
      <StatCard icon={CalendarDays} label="DAU" value={summary?.totals?.dau} />
      <StatCard icon={Repeat2} label="WAU" value={summary?.totals?.wau} />
      <StatCard icon={BarChart3} label="MAU" value={summary?.totals?.mau} />
    </div>

    <Card className="p-5">
      <SectionTitle
        icon={LineChartIcon}
        title="Utilisateurs actifs"
        subtitle="Courbe par jour sur les comptes connectés."
      />
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeseries?.points || []}>
            <defs>
              <linearGradient id="activeUsersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="activeUsers"
              name="Utilisateurs actifs"
              stroke="var(--color-primary)"
              strokeWidth={3}
              fill="url(#activeUsersGradient)"
            />
            <Line type="monotone" dataKey="events" name="Événements" stroke="#2668d9" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle icon={Layers3} title="Modules les plus utilisés" />
        <MiniBarList items={summary?.eventsByModule || []} />
      </Card>
      <Card className="p-5">
        <SectionTitle icon={Activity} title="Actions fréquentes" />
        <MiniBarList items={summary?.topEvents || []} />
      </Card>
    </div>
  </motion.div>
);

const ExplorerTab = ({ range }) => {
  const [events, setEvents] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ module: "", eventName: "", username: "", group: "" });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState(paramToSortState("created_at.desc"));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const query = toQueryString({
      range,
      ...filters,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sort: sortStateToParam(sorting, "created_at.desc"),
    });
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
  }, [filters, pagination.pageIndex, pagination.pageSize, range, sorting]);

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
          <div>
            <p className="font-bold text-secondary">{row.original.userDisplayName}</p>
            <p className="text-xs text-gray-500">{row.original.userUsername || "Anonyme"}</p>
          </div>
        ),
      },
      {
        accessorKey: "module",
        header: "Module",
        cell: ({ row }) => <span className="ui-badge">{row.original.module}</span>,
      },
      {
        accessorKey: "event_name",
        header: "Event",
        cell: ({ row }) => <span className="font-semibold text-gray-700">{row.original.eventName}</span>,
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
                value={filters[key]}
                onChange={(event) => {
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  setFilters((prev) => ({ ...prev, [key]: event.target.value }));
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
                setFilters({ module: "", eventName: "", username: "", group: "" });
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
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

const UsersTab = ({ range, onSelectUser }) => {
  const [users, setUsers] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ search: "", group: "" });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState(paramToSortState("lastActivity.desc"));

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const query = toQueryString({
      range,
      ...filters,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sort: sortStateToParam(sorting, "lastActivity.desc"),
    });
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
  }, [filters, pagination.pageIndex, pagination.pageSize, range, sorting]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "username",
        header: "Utilisateur",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left"
            onClick={() => onSelectUser(row.original.username)}
          >
            <p className="font-bold text-secondary hover:text-primary">
              {row.original.displayName}
            </p>
            <p className="text-xs text-gray-500">{row.original.username}</p>
          </button>
        ),
      },
      { accessorKey: "group", header: "Groupe" },
      { accessorKey: "totalEvents", header: "Events" },
      { accessorKey: "activeDays", header: "Jours actifs" },
      {
        accessorKey: "modules",
        header: "Modules",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.modules || []).slice(0, 4).map((module) => (
              <span key={module.name} className="ui-badge">
                {module.name}
              </span>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "lastActivity",
        header: "Dernière activité",
        cell: ({ row }) => formatDateTime(row.original.lastActivity),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            className="ui-button-secondary min-h-0 px-3 py-1.5 text-xs"
            onClick={() => onSelectUser(row.original.username)}
          >
            <Eye size={14} /> Voir
          </button>
        ),
      },
    ],
    [onSelectUser],
  );

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <label>
            <span className="text-xs font-bold uppercase text-gray-500">Recherche</span>
            <input
              className="ui-field mt-1"
              value={filters.search}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setFilters((prev) => ({ ...prev, search: event.target.value }));
              }}
              placeholder="Nom ou username"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-gray-500">Groupe</span>
            <input
              className="ui-field mt-1"
              value={filters.group}
              onChange={(event) => {
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                setFilters((prev) => ({ ...prev, group: event.target.value }));
              }}
              placeholder="Groupe"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="ui-button-secondary"
              onClick={() => setFilters({ search: "", group: "" })}
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

const UserDetailPanel = ({ username, range, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [events, setEvents] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState(paramToSortState("created_at.desc"));

  useEffect(() => {
    if (!username) return;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const query = toQueryString({ range });
        const response = await fetchApi(`/api/analytics/admin/users/${username}?${query}`);
        const data = await response.json();
        setDetail(data.success ? data.user : null);
      } catch (error) {
        console.error(error);
        setDetail(null);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [range, username]);

  const loadEvents = useCallback(async () => {
    if (!username) return;
    const query = toQueryString({
      range,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      sort: sortStateToParam(sorting, "created_at.desc"),
    });
    const response = await fetchApi(`/api/analytics/admin/users/${username}/events?${query}`);
    const data = await response.json();
    setEvents(data.success ? data.events || [] : []);
    setRowCount(data.success ? data.pagination?.total || 0 : 0);
  }, [pagination.pageIndex, pagination.pageSize, range, sorting, username]);

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
        accessorKey: "properties",
        header: "Propriétés",
        enableSorting: false,
        cell: ({ row }) => <JsonBadges value={row.original.properties} />,
      },
    ],
    [],
  );

  if (!username) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[80] bg-secondary/35 p-3 backdrop-blur-sm md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase text-primary">Fiche utilisateur</p>
              <h2 className="mt-1 text-2xl font-bold text-secondary">
                {detail?.displayName || username}
              </h2>
              <p className="text-sm text-gray-500">
                {username} · {detail?.group || "Groupe inconnu"}
              </p>
            </div>
            <button type="button" className="ui-button-secondary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading && !detail ? (
            <EmptyPanel label="Chargement de la fiche..." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <StatCard icon={Activity} label="Events" value={detail?.totalEvents} />
                <StatCard icon={CalendarDays} label="Jours actifs" value={detail?.activeDays} />
                <StatCard icon={Layers3} label="Modules" value={detail?.modules?.length} />
                <StatCard icon={Clock3} label="Top events" value={detail?.topEvents?.length} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <SectionTitle icon={LineChartIcon} title="Activité utilisateur" />
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detail?.timeline || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="events"
                          name="Événements"
                          stroke="var(--color-primary)"
                          strokeWidth={3}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-5">
                  <SectionTitle icon={Layers3} title="Modules préférés" />
                  <MiniBarList items={detail?.modules || []} />
                </Card>
              </div>
            </>
          )}

          <Card className="p-5">
            <SectionTitle icon={Table2} title="Timeline complète" subtitle="Événements paginés et propriétés déjà nettoyées." />
            <DataTable
              columns={columns}
              data={events}
              pagination={pagination}
              setPagination={setPagination}
              sorting={sorting}
              setSorting={setSorting}
              rowCount={rowCount}
              loading={false}
              emptyLabel="Aucun événement utilisateur"
            />
          </Card>
        </div>
      </motion.aside>
    </motion.div>
  );
};

const ModulesTab = ({ range }) => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => {
    const loadModules = async () => {
      setLoading(true);
      try {
        const response = await fetchApi(`/api/analytics/admin/modules?range=${range}`);
        const data = await response.json();
        const rows = data.success ? data.modules || [] : [];
        setModules(rows);
        setSelectedModule(rows[0]?.module || null);
      } catch (error) {
        console.error(error);
        setModules([]);
      } finally {
        setLoading(false);
      }
    };
    loadModules();
  }, [range]);

  const selected = modules.find((item) => item.module === selectedModule);

  if (loading) return <LoadingPanel />;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
      <Card className="p-4">
        <SectionTitle icon={Layers3} title="Modules" />
        <div className="space-y-2">
          {modules.map((item) => (
            <button
              key={item.module}
              type="button"
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedModule === item.module
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-gray-200 bg-gray-50 text-secondary hover:bg-white"
              }`}
              onClick={() => setSelectedModule(item.module)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">{item.module}</span>
                <span className="text-sm font-semibold">{formatNumber(item.totalEvents)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {formatNumber(item.activeUsers)} utilisateur(s)
              </p>
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {!selected ? (
          <EmptyPanel label="Aucun module sélectionné" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatCard icon={Activity} label="Events" value={selected.totalEvents} />
              <StatCard icon={Users} label="Utilisateurs" value={selected.activeUsers} />
              <StatCard icon={Clock3} label="Actions" value={selected.topEvents?.length} />
            </div>
            <Card className="p-5">
              <SectionTitle icon={LineChartIcon} title={`Évolution ${selected.module}`} />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selected.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Événements"
                      stroke="var(--color-primary)"
                      fill="var(--color-primary)"
                      fillOpacity={0.18}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <SectionTitle icon={Activity} title="Actions du module" />
              <MiniBarList items={selected.topEvents || []} />
            </Card>
          </>
        )}
      </div>
    </motion.div>
  );
};

const HeatmapTab = ({ range }) => {
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHeatmap = async () => {
      setLoading(true);
      try {
        const response = await fetchApi(`/api/analytics/admin/heatmap?range=${range}`);
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
  }, [range]);

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

const RetentionTab = ({ range }) => {
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRetention = async () => {
      setLoading(true);
      try {
        const response = await fetchApi(`/api/analytics/admin/retention?range=${range}`);
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
  }, [range]);

  if (loading) return <LoadingPanel />;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard icon={Users} label="Utilisateurs actifs" value={retention?.activeUsers} />
        <StatCard icon={CalendarDays} label="Buckets jours" value={retention?.activeDayBuckets?.length} />
        <StatCard icon={Layers3} label="Buckets modules" value={retention?.moduleBreadth?.length} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
      </div>
      <Card className="p-5">
        <SectionTitle icon={Flame} title="Utilisateurs les plus récurrents" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(retention?.stickyUsers || []).map((item) => (
            <div key={item.username} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="font-bold text-secondary">{item.username}</p>
              <p className="mt-1 text-sm text-gray-500">
                {item.activeDays} jour(s) actifs · {item.moduleCount} module(s) · {item.events} events
              </p>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
};

const AnalyticsAdminPage = ({ user }) => {
  const [range, setRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (!user?.is_admin) {
      setLoading(false);
      return;
    }

    const loadOverview = async () => {
      setLoading(true);
      setError("");
      try {
        const [summaryResponse, timeseriesResponse] = await Promise.all([
          fetchApi(`/api/analytics/admin/summary?range=${range}`),
          fetchApi(`/api/analytics/admin/timeseries?range=${range}&groupBy=day`),
        ]);
        const summaryData = await summaryResponse.json();
        const timeseriesData = await timeseriesResponse.json();

        if (!summaryData.success || !timeseriesData.success) {
          setError(
            summaryData.error ||
              timeseriesData.error ||
              "Impossible de charger les statistiques.",
          );
          return;
        }

        setSummary(summaryData.summary);
        setTimeseries(timeseriesData.timeseries);
      } catch (loadError) {
        console.error(loadError);
        setError("Erreur réseau lors du chargement des statistiques.");
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, [range, user?.is_admin]);

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
    <motion.div
      className="space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
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
                Exploration interne des usages : événements, modules, utilisateurs,
                timelines et rétention. Les propriétés affichées sont celles déjà
                nettoyées par le backend.
              </p>
            </div>
            <label className="block min-w-44 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
              <span className="text-sm font-semibold text-secondary">Période</span>
              <select
                className="ui-select mt-1"
                value={range}
                onChange={(event) => setRange(event.target.value)}
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
        </div>
      </Card>

      <Card className="p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "text-secondary hover:bg-primary/10 hover:text-primary"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {loading && activeTab === "overview" ? (
        <LoadingPanel />
      ) : error ? (
        <ErrorPanel error={error} />
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewTab summary={summary} timeseries={timeseries} />
          )}
          {activeTab === "explorer" && <ExplorerTab range={range} />}
          {activeTab === "users" && (
            <UsersTab range={range} onSelectUser={setSelectedUser} />
          )}
          {activeTab === "modules" && <ModulesTab range={range} />}
          {activeTab === "heatmap" && <HeatmapTab range={range} />}
          {activeTab === "retention" && <RetentionTab range={range} />}
        </>
      )}

      <UserDetailPanel
        username={selectedUser}
        range={range}
        onClose={() => setSelectedUser(null)}
      />
    </motion.div>
  );
};

export default AnalyticsAdminPage;
