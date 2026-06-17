import {
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  PencilLine,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../App";
import InlineFeedbackModal from "./InlineFeedbackModal";
import { fetchApi } from "../utils/api";

const pageVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: "easeOut", staggerChildren: 0.045 },
  },
};

const softItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: "easeOut" } },
};

const panelMotion = {
  initial: { opacity: 0, y: -8, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.99 },
  transition: { duration: 0.22, ease: "easeOut" },
};

const avg = (value) => (typeof value === "number" ? value.toFixed(2) : "—");

const avgColorClass = (value) => {
  if (value === null || value === undefined) return "bg-gray-100 text-gray-500";
  if (value >= 10) return "bg-green-100 text-green-700";
  if (value >= 7) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-600";
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR", { dateStyle: "short" });
};

const formatGrade = (entry) => {
  switch (entry?.gradeKind) {
    case "numeric":
      return entry.numericGrade?.toFixed(2) ?? entry.gradeRaw ?? "—";
    case "validated":
      return "Valide";
    case "not_validated":
      return "Non valide";
    case "letter":
      return entry.gradeRaw ?? "—";
    default:
      return entry?.gradeRaw ?? "—";
  }
};

const getResultLabel = (moduleItem) => {
  if (moduleItem.resultKind === "not_validated") return "Non valide";
  if (moduleItem.resultKind === "validated") return "Valide";
  if (moduleItem.resultKind === "numeric") return avg(moduleItem.average);
  return "—";
};

const computeModuleAverage = (entries, simulatedEntries, overrides) => {
  const source = [
    ...entries.map((entry) => ({
      gradeKind: entry.gradeKind,
      numericGrade:
        overrides[entry.fingerprint]?.numericGrade !== undefined
          ? overrides[entry.fingerprint].numericGrade
          : entry.numericGrade,
      coefficient:
        overrides[entry.fingerprint]?.coefficient !== undefined
          ? overrides[entry.fingerprint].coefficient
          : entry.coefficient,
    })),
    ...simulatedEntries.map((entry) => ({
      gradeKind: "numeric",
      numericGrade: entry.numericGrade,
      coefficient: entry.coefficient,
    })),
  ];

  const numeric = source.filter(
    (entry) => entry.gradeKind === "numeric" && entry.numericGrade !== null,
  );

  if (!numeric.length) return null;

  const totalCoef = numeric.reduce((sum, entry) => sum + entry.coefficient, 0);
  if (!totalCoef) return null;

  return (
    numeric.reduce(
      (sum, entry) => sum + entry.numericGrade * entry.coefficient,
      0,
    ) / totalCoef
  );
};

const getRefreshText = (progress) => {
  if (progress < 18) return "Connexion au portail";
  if (progress < 38) return "Verification des identifiants";
  if (progress < 58) return "Recuperation du CSV";
  if (progress < 78) return "Lecture des notes et des coefficients";
  if (progress < 92) return "Mise en forme des moyennes";
  return "Finalisation de la mise a jour";
};

const formatRetryAfter = (retryAfterMs) => {
  const totalSeconds = Math.max(0, Math.ceil((retryAfterMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes} min ${seconds}s`;
};

const formatTimeSince = (value, now = Date.now()) => {
  if (!value) return "Jamais mis a jour";

  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return "Derniere mise a jour inconnue";

  const elapsedSeconds = Math.max(0, Math.floor((now - parsed) / 1000));
  if (elapsedSeconds < 60) return "Mis a jour a l'instant";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `Mis a jour il y a ${elapsedMinutes} min`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Mis a jour il y a ${elapsedHours} h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Mis a jour il y a ${elapsedDays} jour${elapsedDays > 1 ? "s" : ""}`;
};

const REFRESH_MODES = {
  http: {
    label: "Rapide",
    description: "HTTP direct",
    loaderDurationMs: 8000,
  },
  csv: {
    label: "Secours",
    description: "Navigation navigateur",
    loaderDurationMs: 12000,
  },
};

const isCredentialFailure = (response, payload) => {
  const message = payload?.error || "";
  const code = payload?.code || payload?.details?.code || "";

  return (
    response?.status === 401 ||
    code === "ENT_AUTH_FAILED" ||
    code === "ENT_CREDENTIALS_INVALID" ||
    /mot de passe|identifiant|auth/i.test(message)
  );
};

const MaskedEntryRow = ({ rule, onUnhide, isSaving }) => {
  return (
    <tr className="bg-gray-50/80 border-b border-gray-100 text-sm">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2 text-gray-500">
          <EyeOff className="w-3.5 h-3.5" />
          <div>
            <p className="line-through">
              {rule.assessment_name || "Note masquee"}
            </p>
            <p className="text-xs text-gray-400">Masquee du calcul</p>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-3 hidden md:table-cell text-gray-400">
        {rule.assessment_type || "—"}
      </td>
      <td className="py-2.5 px-3 hidden lg:table-cell text-gray-400">
        {formatDate(rule.assessment_date)}
      </td>
      <td className="py-2.5 px-3 text-gray-400">—</td>
      <td className="py-2.5 px-3 text-gray-400">{rule.grade_value || "—"}</td>
      <td className="py-2.5 px-3">
        <button
          type="button"
          onClick={() => onUnhide(rule.id)}
          disabled={isSaving}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-white hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          <Eye className="w-3.5 h-3.5" />
          Afficher
        </button>
      </td>
    </tr>
  );
};

const EntryRow = ({ entry, override, onOverrideChange, onHide, isSaving }) => {
  const [isEditing, setIsEditing] = useState(false);
  const effectiveGrade =
    override?.numericGrade !== undefined
      ? override.numericGrade
      : entry.numericGrade;
  const effectiveCoef =
    override?.coefficient !== undefined
      ? override.coefficient
      : entry.coefficient;
  const isModified = override !== undefined;

  return (
    <tr
      className={`border-b border-gray-100 text-sm ${
        isModified ? "bg-amber-50" : "hover:bg-gray-50"
      } transition-colors`}
    >
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          {isModified && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          <div>
            <p className="font-medium text-gray-800">{entry.assessmentName}</p>
            {entry.assessmentDetail && (
              <p className="text-xs text-gray-400">{entry.assessmentDetail}</p>
            )}
          </div>
        </div>
      </td>

      <td className="py-3 px-3 text-gray-500 hidden md:table-cell">
        {entry.assessmentType || "—"}
      </td>
      <td className="py-3 px-3 text-gray-500 hidden lg:table-cell">
        {formatDate(entry.assessmentDate)}
      </td>

      <td className="py-3 px-3 w-28">
        {isEditing ? (
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={effectiveCoef}
            onChange={(event) =>
              onOverrideChange(entry.fingerprint, {
                ...(override || {}),
                coefficient: Number.parseFloat(event.target.value) || 0,
              })
            }
            className="w-16 text-center border border-gray-200 rounded-md text-xs py-1"
          />
        ) : (
          <span
            className={
              isModified ? "font-semibold text-amber-700" : "text-gray-700"
            }
          >
            {effectiveCoef}
          </span>
        )}
      </td>

      <td className="py-3 px-3 w-56">
        {isEditing && entry.gradeKind === "numeric" ? (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={effectiveGrade ?? 0}
              onChange={(event) =>
                onOverrideChange(entry.fingerprint, {
                  ...(override || {}),
                  numericGrade: Number.parseFloat(event.target.value),
                })
              }
              className="w-32 accent-primary"
            />
            <span className="w-10 text-sm font-mono font-semibold text-gray-700">
              {(effectiveGrade ?? 0).toFixed(1)}
            </span>
          </div>
        ) : (
          <span
            className={`font-semibold ${
              isModified ? "text-amber-700" : "text-gray-800"
            }`}
          >
            {entry.gradeKind === "numeric"
              ? (effectiveGrade ?? 0).toFixed(2)
              : formatGrade(entry)}
          </span>
        )}
      </td>

      <td className="py-3 px-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
          {entry.gradeKind === "numeric" && (
            <button
              type="button"
              onClick={() => setIsEditing((previous) => !previous)}
              className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-1.5 rounded-md border border-primary/20 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
              title={isEditing ? "Fermer l edition" : "Simuler cette note"}
            >
              <PencilLine className="w-3.5 h-3.5" />
              {isEditing ? "Edition" : "Simuler"}
            </button>
          )}

          {isModified && (
            <button
              type="button"
              onClick={() => onOverrideChange(entry.fingerprint, undefined)}
              className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-2 py-1 rounded-md border border-amber-200 text-amber-700 text-xs hover:bg-amber-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onHide(entry)}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Masquer
          </button>
        </div>
      </td>
    </tr>
  );
};

const SimulatedEntryRow = ({ entry, onUpdate, onRemove }) => {
  return (
    <tr className="bg-blue-50 border-b border-blue-100 text-sm">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <input
            value={entry.assessmentName}
            onChange={(event) =>
              onUpdate({ ...entry, assessmentName: event.target.value })
            }
            className="border border-blue-200 rounded-md px-2 py-1 text-xs bg-white w-40"
            placeholder="Nouvelle epreuve"
          />
        </div>
      </td>
      <td className="py-2.5 px-3 hidden md:table-cell text-blue-500">
        Simulee
      </td>
      <td className="py-2.5 px-3 hidden lg:table-cell text-blue-400">—</td>
      <td className="py-2.5 px-3">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={entry.coefficient}
          onChange={(event) =>
            onUpdate({
              ...entry,
              coefficient: Number.parseFloat(event.target.value) || 0,
            })
          }
          className="w-16 text-center border border-blue-200 rounded-md text-xs py-1 bg-white"
        />
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={entry.numericGrade}
            onChange={(event) =>
              onUpdate({
                ...entry,
                numericGrade: Number.parseFloat(event.target.value),
              })
            }
            className="w-32 accent-primary"
          />
          <span className="w-10 text-sm font-mono font-semibold text-blue-700">
            {entry.numericGrade.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-3">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          Supprimer
        </button>
      </td>
    </tr>
  );
};

const ModuleCard = ({
  moduleItem,
  simAverage,
  isSimulated,
  simOverrides,
  simNewEntries,
  hiddenRules,
  onOverrideChange,
  onAddSimEntry,
  onUpdateSimEntry,
  onRemoveSimEntry,
  onHideEntry,
  onUnhideRule,
  isSaving,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const effectiveAverage = isSimulated ? simAverage : moduleItem.average;

  return (
    <motion.article
      layout
      variants={softItemVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-gray-800 truncate">
                {moduleItem.moduleName}
              </h4>
              {isSimulated && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  Simulation active
                </span>
              )}
              {hiddenRules.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {hiddenRules.length} masquee(s)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {moduleItem.counts?.entries ?? 0} note(s) visibles · coef{" "}
              {moduleItem.coefficient}
            </p>
          </div>
        </div>

        <span
          className={`text-sm font-bold px-3 py-1 rounded-full ${avgColorClass(effectiveAverage)}`}
        >
          {moduleItem.resultKind === "validated"
            ? "Valide"
            : moduleItem.resultKind === "not_validated"
              ? "Non valide"
              : avg(effectiveAverage)}
          {isSimulated && moduleItem.average !== null && (
            <span className="ml-1 text-xs opacity-50 line-through">
              {avg(moduleItem.average)}
            </span>
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="module-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="border-t border-gray-100 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="py-2 px-3 text-left">Epreuve</th>
                    <th className="py-2 px-3 text-left hidden md:table-cell">
                      Type
                    </th>
                    <th className="py-2 px-3 text-left hidden lg:table-cell">
                      Date
                    </th>
                    <th className="py-2 px-3 text-left">Coef</th>
                    <th className="py-2 px-3 text-left">Note /20</th>
                    <th className="py-2 px-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleItem.entries.map((entry) => (
                    <EntryRow
                      key={entry.fingerprint}
                      entry={entry}
                      override={simOverrides[entry.fingerprint]}
                      onOverrideChange={onOverrideChange}
                      onHide={onHideEntry}
                      isSaving={isSaving}
                    />
                  ))}

                  {simNewEntries.map((entry) => (
                    <SimulatedEntryRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={onUpdateSimEntry}
                      onRemove={() => onRemoveSimEntry(entry.id)}
                    />
                  ))}

                  {hiddenRules.map((rule) => (
                    <MaskedEntryRow
                      key={rule.id}
                      rule={rule}
                      onUnhide={onUnhideRule}
                      isSaving={isSaving}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <button
                type="button"
                onClick={() => onAddSimEntry(moduleItem.moduleName)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-primary/20 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Ajouter une note simulee
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

const UnmappedModuleCard = ({ moduleItem }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.article
      layout
      variants={softItemVariants}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-xl border border-yellow-200 bg-white overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-yellow-50/60 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight
            className={`w-4 h-4 text-yellow-700 transition-transform ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          />
          <div className="min-w-0">
            <h5 className="text-sm font-semibold text-yellow-900 truncate">
              {moduleItem.moduleName}
            </h5>
            <p className="text-xs text-yellow-800/80 mt-0.5">
              {moduleItem.counts?.entries ?? moduleItem.entryCount ?? 0} note(s)
              · hors calcul UE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${avgColorClass(moduleItem.average)}`}
          >
            {getResultLabel(moduleItem)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
            Hors calcul
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="unmapped-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="border-t border-yellow-100 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-yellow-50/70">
                  <tr className="text-xs font-medium uppercase tracking-wide text-yellow-800">
                    <th className="py-2 px-3 text-left">Epreuve</th>
                    <th className="py-2 px-3 text-left hidden md:table-cell">
                      Type
                    </th>
                    <th className="py-2 px-3 text-left hidden lg:table-cell">
                      Date
                    </th>
                    <th className="py-2 px-3 text-left">Coef</th>
                    <th className="py-2 px-3 text-left">Note /20</th>
                  </tr>
                </thead>
                <tbody>
                  {(moduleItem.entries || []).map((entry) => (
                    <tr
                      key={entry.id || entry.fingerprint}
                      className="border-b border-yellow-50 text-sm"
                    >
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-800">
                          {entry.assessmentName}
                        </p>
                        {entry.assessmentDetail && (
                          <p className="text-xs text-gray-400">
                            {entry.assessmentDetail}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell text-gray-500">
                        {entry.assessmentType || "—"}
                      </td>
                      <td className="py-2.5 px-3 hidden lg:table-cell text-gray-500">
                        {formatDate(entry.assessmentDate)}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">
                        {entry.coefficient}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800">
                        {formatGrade(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};

let simulatedEntryCounter = 0;

const NotesV2 = () => {
  const { user, setUser } = useContext(UserContext);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [gradesData, setGradesData] = useState(null);
  const [hiddenRules, setHiddenRules] = useState([]);

  const [credentials, setCredentials] = useState({
    entUsername: user?.ent_username || "",
    hasStoredPassword: Boolean(user?.hasPassword),
  });

  const [entUsername, setEntUsername] = useState(user?.ent_username || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showRefreshForm, setShowRefreshForm] = useState(false);
  const [refreshMode, setRefreshMode] = useState("http");
  const [showHttpFallbackHint, setShowHttpFallbackHint] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const [simOverrides, setSimOverrides] = useState({});
  const [simulatedEntries, setSimulatedEntries] = useState([]);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [cooldownRetryAfterMs, setCooldownRetryAfterMs] = useState(null);
  const [lastRefreshReport, setLastRefreshReport] = useState(null);
  const [now, setNow] = useState(Date.now());

  const hasSimulation =
    Object.keys(simOverrides).length > 0 || simulatedEntries.length > 0;

  useEffect(() => {
    if (!isRefreshing) {
      setRefreshProgress(0);
      return undefined;
    }

    const loaderDurationMs =
      REFRESH_MODES[refreshMode]?.loaderDurationMs || 8000;
    const intervalMs = 120;
    const targetProgress = 90;
    const startProgress = 12;
    const totalSteps = Math.max(1, Math.round(loaderDurationMs / intervalMs));
    const progressStep = (targetProgress - startProgress) / totalSteps;

    setRefreshProgress(12);
    const timer = setInterval(() => {
      setRefreshProgress((previous) => {
        if (previous >= targetProgress) {
          return previous;
        }

        return Math.min(targetProgress, previous + progressStep);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRefreshing, refreshMode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const updateFromResponse = useCallback(
    (payload) => {
      setSnapshot(payload.snapshot || null);
      setGradesData(payload.data || null);
      setHiddenRules(payload.hiddenRules || []);

      const nextCredentials = {
        entUsername:
          payload.credentials?.entUsername ||
          payload.snapshot?.entUsername ||
          "",
        hasStoredPassword: Boolean(payload.credentials?.hasStoredPassword),
      };

      setCredentials(nextCredentials);
      if (nextCredentials.entUsername)
        setEntUsername(nextCredentials.entUsername);

      if (setUser) {
        setUser((previous) => ({
          ...(previous || {}),
          hasPassword: nextCredentials.hasStoredPassword,
          ent_username: nextCredentials.entUsername || previous?.ent_username,
        }));
      }
    },
    [setUser],
  );

  const loadGrades = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetchApi("/api/grades");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de charger les notes");
      }

      updateFromResponse(payload);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger les notes");
    } finally {
      setIsLoading(false);
    }
  }, [updateFromResponse]);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  useEffect(() => {
    if (user?.ent_username && !entUsername) {
      setEntUsername(user.ent_username);
    }
  }, [user?.ent_username, entUsername]);

  const handleRefresh = async (body = {}) => {
    setError(null);
    setCooldownRetryAfterMs(null);
    setLastRefreshReport(null);
    setShowHttpFallbackHint(false);
    setIsRefreshing(true);
    const requestBody = {
      ...body,
      strategy: refreshMode === "http" ? "http" : "csv",
    };

    try {
      const response = await fetchApi("/api/grades/refresh", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterMs = Number(payload?.details?.retryAfterMs || 0);
          setCooldownRetryAfterMs(retryAfterMs);
          const refreshError = new Error(
            `Rafraichissement trop frequent. Reessaie dans ${formatRetryAfter(retryAfterMs)}.`,
          );
          refreshError.skipFallbackHint = true;
          throw refreshError;
        }

        if (isCredentialFailure(response, payload)) {
          const nextEntUsername =
            payload?.details?.entUsername ||
            entUsername ||
            credentials.entUsername;

          setCredentials((previous) => ({
            ...previous,
            entUsername: nextEntUsername || previous.entUsername,
            hasStoredPassword: false,
          }));
          if (nextEntUsername) {
            setEntUsername(nextEntUsername);
          }
          setPassword("");
          setShowRefreshForm(true);
          const refreshError = new Error(
            "Tes identifiants ENT ne sont plus valides. Merci de les ressaisir.",
          );
          refreshError.skipFallbackHint = true;
          throw refreshError;
        }

        if (
          payload?.code === "USER_KEY_MISSING" ||
          payload?.code === "USER_KEY_INVALID"
        ) {
          const refreshError = new Error(
            "Ta cle locale ENT n'est plus disponible. Recharge la page ou reconnecte-toi pour resynchroniser l'acces.",
          );
          refreshError.skipFallbackHint = true;
          throw refreshError;
        }

        const refreshError = new Error(
          payload.error || "Impossible de mettre a jour les notes",
        );
        refreshError.suggestFallback = requestBody.strategy === "http";
        throw refreshError;
      }

      setRefreshProgress(100);
      updateFromResponse(payload);
      setLastRefreshReport(payload.refreshReport || null);
      setPassword("");
      setShowRefreshForm(false);
    } catch (refreshError) {
      if (
        requestBody.strategy === "http" &&
        !refreshError.skipFallbackHint &&
        (refreshError.suggestFallback || !refreshError.message)
      ) {
        setShowHttpFallbackHint(true);
      }
      setError(refreshError.message || "Impossible de mettre a jour les notes");
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 120);
    }
  };

  const handleRefreshClick = async () => {
    let hasStoredPassword = credentials.hasStoredPassword;
    let linkedEntUsername = credentials.entUsername || entUsername;

    try {
      const statusResponse = await fetchApi("/api/grades/credentials/status");
      const statusPayload = await statusResponse.json();

      if (statusResponse.ok) {
        hasStoredPassword = Boolean(statusPayload.hasStoredPassword);
        linkedEntUsername = statusPayload.entUsername || linkedEntUsername;

        setCredentials({
          entUsername: linkedEntUsername || "",
          hasStoredPassword,
        });
        if (linkedEntUsername) {
          setEntUsername(linkedEntUsername);
        }
      }
    } catch (statusError) {
      console.warn(
        "[NotesV2] Impossible de verifier le statut des credentials",
        statusError,
      );
    }

    if (hasStoredPassword) {
      await handleRefresh();
      return;
    }

    setShowRefreshForm(true);
  };

  const handleSubmitCredentials = async (event) => {
    event.preventDefault();

    await handleRefresh({
      ent_username: entUsername,
      password,
      rememberMe,
    });
  };

  const handleForceRefresh = async () => {
    const forcePayload = { force: true };

    if (showRefreshForm) {
      forcePayload.ent_username = entUsername;
      if (password) {
        forcePayload.password = password;
      }
      forcePayload.rememberMe = rememberMe;
    }

    await handleRefresh(forcePayload);
  };

  const handleHideEntry = async (entry) => {
    setError(null);
    setIsSavingRule(true);

    try {
      const response = await fetchApi("/api/grades/hidden-rules", {
        method: "POST",
        body: JSON.stringify({
          matchStrategy: "entry_fingerprint",
          entryFingerprint: entry.fingerprint,
          moduleName: entry.moduleName,
          assessmentName: entry.assessmentName,
          assessmentType: entry.assessmentType,
          gradeValue: entry.gradeRaw,
          assessmentDate: entry.assessmentDate,
          reason: "masked_from_notes_page",
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de masquer cette note");
      }

      await loadGrades();
    } catch (saveError) {
      setError(saveError.message || "Impossible de masquer cette note");
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleUnhideRule = async (ruleId) => {
    setError(null);
    setIsSavingRule(true);

    try {
      const response = await fetchApi(`/api/grades/hidden-rules/${ruleId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de demasquer cette note");
      }

      await loadGrades();
    } catch (restoreError) {
      setError(restoreError.message || "Impossible de demasquer cette note");
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleOverrideChange = (fingerprint, value) => {
    setSimOverrides((previous) => {
      if (value === undefined) {
        const next = { ...previous };
        delete next[fingerprint];
        return next;
      }

      return {
        ...previous,
        [fingerprint]: value,
      };
    });
  };

  const handleAddSimulatedEntry = (moduleName) => {
    setSimulatedEntries((previous) => [
      ...previous,
      {
        id: `sim-${++simulatedEntryCounter}`,
        moduleName,
        assessmentName: "Nouvelle note",
        numericGrade: 10,
        coefficient: 1,
      },
    ]);
  };

  const handleUpdateSimulatedEntry = (updated) => {
    setSimulatedEntries((previous) =>
      previous.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  };

  const handleRemoveSimulatedEntry = (entryId) => {
    setSimulatedEntries((previous) =>
      previous.filter((entry) => entry.id !== entryId),
    );
  };

  const handleResetSimulation = () => {
    setSimOverrides({});
    setSimulatedEntries([]);
  };

  const hiddenRulesByModule = useMemo(() => {
    const byModule = new Map();
    hiddenRules.forEach((rule) => {
      const moduleName = rule.module_name;
      if (!moduleName) return;
      if (!byModule.has(moduleName)) byModule.set(moduleName, []);
      byModule.get(moduleName).push(rule);
    });
    return byModule;
  }, [hiddenRules]);

  const sections = useMemo(() => {
    if (!gradesData) return [];

    const sourceSections = gradesData.ueSections?.length
      ? gradesData.ueSections
      : [
          {
            ueName: "Modules",
            coefficient: null,
            average: null,
            modules: gradesData.modules || [],
          },
        ];

    return sourceSections.map((section) => {
      const modules = (section.modules || []).map((moduleItem) => {
        const currentSimulatedEntries = simulatedEntries.filter(
          (entry) => entry.moduleName === moduleItem.moduleName,
        );

        const hasSimulatedChanges =
          currentSimulatedEntries.length > 0 ||
          (moduleItem.entries || []).some(
            (entry) => simOverrides[entry.fingerprint] !== undefined,
          );

        const simulatedAverage = hasSimulatedChanges
          ? computeModuleAverage(
              moduleItem.entries || [],
              currentSimulatedEntries,
              simOverrides,
            )
          : moduleItem.average;

        return {
          ...moduleItem,
          simAverage: simulatedAverage,
          isSimulated: hasSimulatedChanges,
        };
      });

      const isSectionSimulated = modules.some(
        (moduleItem) => moduleItem.isSimulated,
      );

      let sectionSimAverage = section.average;
      if (isSectionSimulated) {
        const numericModules = modules.filter(
          (moduleItem) => moduleItem.simAverage !== null,
        );
        const totalCoef = numericModules.reduce(
          (sum, moduleItem) => sum + moduleItem.coefficient,
          0,
        );

        sectionSimAverage = totalCoef
          ? numericModules.reduce(
              (sum, moduleItem) =>
                sum + moduleItem.simAverage * moduleItem.coefficient,
              0,
            ) / totalCoef
          : null;
      }

      return {
        ...section,
        modules,
        simAverage: sectionSimAverage,
        isSimulated: isSectionSimulated,
      };
    });
  }, [gradesData, simulatedEntries, simOverrides]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement des notes
        </div>
      </div>
    );
  }

  const refreshLabel = getRefreshText(refreshProgress);
  const feedbackPrefill = [
    "Erreur sur la page Notes",
    `Message affiche: ${error || "Aucun message precise"}`,
    `Mode de recuperation: ${REFRESH_MODES[refreshMode]?.label || refreshMode} (${refreshMode})`,
    `Derniere mise a jour: ${snapshot?.createdAt ? formatDateTime(snapshot.createdAt) : "aucune"}`,
    "",
    "Ce que je faisais / details a ajouter:",
  ].join("\n");

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-[1680px] mx-auto px-2 lg:px-4"
    >
      <motion.div
        variants={softItemVariants}
        className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm p-4 md:p-6 lg:p-7 space-y-5"
      >
        <motion.header
          variants={softItemVariants}
          className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes notes</h1>
            <p className="text-sm text-gray-500 mt-1">
              {snapshot
                ? `Snapshot du ${formatDateTime(snapshot.createdAt)} · groupe ${gradesData?.userGroup || "—"}`
                : "Aucun snapshot local pour le moment"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasSimulation && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-semibold">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Simulation active
              </span>
            )}

            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1">
              {Object.entries(REFRESH_MODES).map(([mode, config]) => {
                const isActive = refreshMode === mode;
                const isSuggestedFallback =
                  showHttpFallbackHint && mode === "csv" && !isActive;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setRefreshMode(mode);
                      if (mode === "csv") {
                        setShowHttpFallbackHint(false);
                      }
                    }}
                    disabled={isRefreshing}
                    title={config.description}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : isSuggestedFallback
                          ? "bg-amber-50 text-amber-800 ring-2 ring-amber-300 shadow-sm"
                          : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
              <Clock3 className="w-3.5 h-3.5" />
              {formatTimeSince(snapshot?.createdAt, now)}
            </span>

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2.5 hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Mettre a jour
            </button>
          </div>
        </motion.header>

        <motion.div
          variants={softItemVariants}
          whileHover={{ y: -1 }}
          className="inline-flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900"
        >
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Vous pouvez masquer la note remplacee apres une reparation ou un
            rattrapage, car l'ecole ajoute souvent la nouvelle note sans
            retirer l'ancienne.
          </p>
        </motion.div>

        <AnimatePresence initial={false}>
          {isRefreshing && (
            <motion.section
              key="refreshing"
              {...panelMotion}
              className="rounded-xl border border-primary/15 bg-primary/5 p-4"
            >
            <div className="flex items-center gap-2 text-primary text-sm font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              {refreshLabel}
            </div>
            <p className="text-xs text-primary/80 mt-1 animate-pulse">
              Synchronisation en cours...
            </p>
            <div className="mt-3 h-2 rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${refreshProgress}%` }}
              />
            </div>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showRefreshForm && (
            <motion.section
              key="refresh-form"
              {...panelMotion}
              className="max-w-md rounded-xl border border-gray-200 p-4 bg-white"
            >
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Connexion ENT
            </h3>
            <form className="space-y-3" onSubmit={handleSubmitCredentials}>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold text-gray-700">
                  Mode selectionne
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {REFRESH_MODES[refreshMode]?.label} ·{" "}
                  {REFRESH_MODES[refreshMode]?.description}
                </p>
              </div>

              <label className="block">
                <span className="text-xs text-gray-500">Identifiant ENT</span>
                <input
                  type="text"
                  value={entUsername}
                  onChange={(event) => setEntUsername(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500">Mot de passe ENT</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Se souvenir du mot de passe
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isRefreshing}
                  className="flex-1 rounded-lg bg-primary text-white text-sm font-semibold py-2 hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  Lancer la mise a jour
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefreshForm(false)}
                  className="rounded-lg border border-gray-200 text-sm px-3 py-2 text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              key="error"
              {...panelMotion}
              className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>{error}</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Prevenir l'admin
                    </button>
                    {cooldownRetryAfterMs !== null && (
                      <button
                        type="button"
                        onClick={handleForceRefresh}
                        disabled={isRefreshing}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
                      >
                        Forcer maintenant
                      </button>
                    )}
                  </div>
                </div>

                {showHttpFallbackHint && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
                        <div>
                          <p className="text-sm font-semibold">
                            Le mode rapide a echoue.
                          </p>
                          <p className="mt-0.5 text-xs text-amber-800">
                            Tu peux prevenir l'admin du probleme. En attendant,
                            le mode Secours peut aussi aider : il est plus lent,
                            mais ouvre le portail comme un navigateur complet.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRefreshMode("csv");
                          setShowHttpFallbackHint(false);
                        }}
                        disabled={isRefreshing}
                        className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
                      >
                        Essayer Secours
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {lastRefreshReport && (
            <motion.section
              key="last-refresh-report"
              {...panelMotion}
              className="rounded-xl border border-green-200 bg-green-50/80 p-4"
            >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-green-900">
                  Dernieres notes recuperees
                </h3>
                <p className="text-xs text-green-800/80 mt-0.5">
                  {lastRefreshReport.hasPreviousSnapshot
                    ? lastRefreshReport.newEntryCount > 0
                      ? `${lastRefreshReport.newEntryCount} nouvelle(s) note(s) depuis la derniere mise a jour`
                      : "Aucune nouvelle note depuis la derniere mise a jour"
                    : "Premier snapshot enregistre pour tes notes"}
                </p>
              </div>
            </div>

            {lastRefreshReport.newEntries?.length > 0 && (
              <motion.div
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              >
                {lastRefreshReport.newEntries.map((entry) => (
                  <motion.div
                    key={entry.fingerprint}
                    variants={softItemVariants}
                    whileHover={{ y: -2 }}
                    className="rounded-lg border border-green-200 bg-white px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-green-900 truncate">
                      {entry.moduleName || "Module inconnu"}
                    </p>
                    <p className="text-sm font-medium text-gray-800 truncate mt-0.5">
                      {entry.assessmentName || "Epreuve sans nom"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.assessmentType || "Type inconnu"} ·{" "}
                      {formatDate(entry.assessmentDate)} · coef{" "}
                      {entry.coefficient ?? "—"}
                    </p>
                    <p className="text-sm font-bold text-green-700 mt-1">
                      {entry.gradeKind === "numeric" &&
                      typeof entry.numericGrade === "number"
                        ? entry.numericGrade.toFixed(2)
                        : entry.gradeRaw || "—"}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {lastRefreshReport.newEntryCount >
              (lastRefreshReport.newEntries?.length || 0) && (
              <p className="text-xs text-green-800/80 mt-3">
                +{" "}
                {lastRefreshReport.newEntryCount -
                  (lastRefreshReport.newEntries?.length || 0)}{" "}
                autre(s) note(s)
              </p>
            )}
            </motion.section>
          )}
        </AnimatePresence>

        {snapshot && (
          <motion.section
            variants={pageVariants}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {[
              ["Notes visibles", snapshot?.counts?.visibleEntryCount ?? 0],
              ["Notes masquees", snapshot?.counts?.hiddenEntryCount ?? 0],
              [
                "Notes hors plaquette",
                snapshot?.counts?.unmappedModuleCount ?? 0,
              ],
            ].map(([label, value]) => (
              <motion.div
                key={label}
                variants={softItemVariants}
                whileHover={{ y: -2 }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">
                  {value}
                </p>
              </motion.div>
            ))}
          </motion.section>
        )}

        {gradesData ? (
          <motion.div
            variants={softItemVariants}
            className="flex gap-5 items-start"
          >
            <motion.div
              variants={pageVariants}
              className="flex-1 min-w-0 space-y-8"
            >
              {sections.map((section, index) => (
                <motion.section
                  key={`${section.ueName || "modules"}-${index}`}
                  variants={softItemVariants}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                        {section.ueName || "Modules"}
                        {section.isSimulated && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Simule
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {section.modules.length} module(s)
                        {section.coefficient
                          ? ` · coef UE ${section.coefficient}`
                          : ""}
                      </p>
                    </div>

                    {(section.simAverage !== null ||
                      section.average !== null) && (
                      <div className="flex items-center gap-2">
                        {section.isSimulated && section.average !== null && (
                          <span className="text-xs text-gray-400 line-through">
                            {avg(section.average)}
                          </span>
                        )}
                        <span
                          className={`text-sm font-bold px-3 py-1 rounded-full ${avgColorClass(
                            section.isSimulated
                              ? section.simAverage
                              : section.average,
                          )}`}
                        >
                          {avg(
                            section.isSimulated
                              ? section.simAverage
                              : section.average,
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <motion.div variants={pageVariants} className="space-y-2">
                    {section.modules.map((moduleItem) => (
                      <ModuleCard
                        key={moduleItem.moduleName}
                        moduleItem={moduleItem}
                        simAverage={moduleItem.simAverage}
                        isSimulated={moduleItem.isSimulated}
                        simOverrides={simOverrides}
                        simNewEntries={simulatedEntries.filter(
                          (entry) => entry.moduleName === moduleItem.moduleName,
                        )}
                        hiddenRules={
                          hiddenRulesByModule.get(moduleItem.moduleName) || []
                        }
                        onOverrideChange={handleOverrideChange}
                        onAddSimEntry={handleAddSimulatedEntry}
                        onUpdateSimEntry={handleUpdateSimulatedEntry}
                        onRemoveSimEntry={handleRemoveSimulatedEntry}
                        onHideEntry={handleHideEntry}
                        onUnhideRule={handleUnhideRule}
                        isSaving={isSavingRule}
                      />
                    ))}
                  </motion.div>
                </motion.section>
              ))}
            </motion.div>

            <motion.aside
              variants={softItemVariants}
              className="w-72 shrink-0 hidden lg:block space-y-4 sticky top-4"
            >
              <motion.section
                whileHover={{ y: -2 }}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <h4 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-3">
                  Snapshot
                </h4>
                <dl className="space-y-2 text-sm">
                  {[
                    [
                      "ID",
                      snapshot?.id ? `${snapshot.id.slice(0, 8)}...` : "—",
                    ],
                    ["Source", snapshot?.source || "—"],
                    ["Statut", snapshot?.status || "—"],
                    ["Groupe", gradesData?.userGroup || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-2"
                    >
                      <dt className="text-gray-400">{label}</dt>
                      <dd className="text-gray-700 font-medium text-right">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </motion.section>

              <motion.section
                whileHover={{ y: -2 }}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <h4 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-3 flex items-center justify-between">
                  <span>Notes masquees</span>
                  {hiddenRules.length > 0 && (
                    <span className="text-xs rounded-full px-1.5 py-0.5 bg-gray-100 text-gray-600">
                      {hiddenRules.length}
                    </span>
                  )}
                </h4>

                {hiddenRules.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucune note masquee</p>
                ) : (
                  <ul className="space-y-2">
                    {hiddenRules.map((rule) => (
                      <li
                        key={rule.id}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {rule.assessment_name || "Note masquee"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {rule.module_name || "—"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnhideRule(rule.id)}
                          disabled={isSavingRule}
                          className="text-xs rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50"
                        >
                          Afficher
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            </motion.aside>
          </motion.div>
        ) : (
          <motion.div
            {...panelMotion}
            className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400"
          >
            Aucune note disponible
          </motion.div>
        )}

        {gradesData?.unmappedModules?.length > 0 && (
          <motion.section
            variants={softItemVariants}
            className="mt-2 border-t border-gray-100 pt-5"
          >
            <motion.div
              whileHover={{ y: -1 }}
              className="rounded-xl border border-yellow-200 bg-yellow-50/70 p-4"
            >
              <h4 className="text-sm font-semibold text-yellow-900 mb-1">
                Notes hors plaquette pedagogique
              </h4>
              <p className="text-xs text-yellow-800 mb-2">
                Ces notes correspondent a des modules absents de la plaquette
                pedagogique de l'ecole. Elles sont affichees ici avec leurs
                details, mais restent exclues des calculs UE.
              </p>
              <motion.div variants={pageVariants} className="space-y-2">
                {gradesData.unmappedModules.map((moduleItem) => (
                  <UnmappedModuleCard
                    key={moduleItem.moduleName}
                    moduleItem={moduleItem}
                  />
                ))}
              </motion.div>
            </motion.div>
          </motion.section>
        )}
      </motion.div>

      <InlineFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        type="bug"
        area="notes"
        priority="important"
        title="Signaler le probleme"
        description="Le message est pre-rempli avec le contexte de l'erreur. Tu peux juste ajouter ce que tu faisais."
        prefill={feedbackPrefill}
      />

      <AnimatePresence>
        {hasSimulation && (
          <motion.button
            type="button"
            onClick={handleResetSimulation}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-amber-500 text-white px-4 py-2.5 text-sm font-semibold shadow-lg hover:bg-amber-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reinitialiser la simulation
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NotesV2;
