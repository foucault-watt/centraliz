const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const puppeteer = require("../utils/puppeteer");
const supabase = require("../utils/supabaseClient");
const ZimbraService = require("./zimbraService");
const AurionHttpService = require("./aurionHttpService");
const {
  buildGradesView,
  parseCsvToEntries,
} = require("./gradesParser");

const PARSER_VERSION = "v1";
const REFRESH_COOLDOWN_MS = Number.parseInt(
  process.env.GRADES_REFRESH_COOLDOWN_MS || "120000",
  15,
);
const HTTP_FALLBACK_ENABLED = /^true$/i.test(
  process.env.GRADES_HTTP_FALLBACK_ENABLED || "true",
);
const HTTP_FIRST_ENABLED = /^true$/i.test(
  process.env.GRADES_HTTP_FIRST_ENABLED || "",
);
const GRADES_DEBUG = /^true$/i.test(process.env.GRADES_DEBUG || "");
const refreshLocks = new Map();

const createHttpError = (statusCode, message, details = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

const logGradesDebug = (event, details = {}) => {
  if (!GRADES_DEBUG) {
    return;
  }

  console.log(`[GradesService] ${event}`, details);
};

const acquireRefreshLock = async (key) => {
  const previousLock = refreshLocks.get(key) || Promise.resolve();
  let releaseCurrentLock;

  const currentLock = new Promise((resolve) => {
    releaseCurrentLock = resolve;
  });

  refreshLocks.set(
    key,
    previousLock.catch(() => undefined).then(() => currentLock),
  );

  await previousLock.catch(() => undefined);

  return () => {
    releaseCurrentLock();
    if (refreshLocks.get(key) === currentLock) {
      refreshLocks.delete(key);
    }
  };
};

const cleanupDownloadedCsv = (csvPath) => {
  if (!csvPath) {
    return;
  }

  try {
    if (fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }
  } catch (error) {
    console.warn(
      "[GradesService] Impossible de supprimer le CSV temporaire:",
      error.message,
    );
  }

  const csvDirectory = path.dirname(csvPath);
  const directoryName = path.basename(csvDirectory);

  if (!directoryName.startsWith("centraliz-notes-")) {
    return;
  }

  try {
    fs.rmSync(csvDirectory, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      "[GradesService] Impossible de supprimer le dossier temporaire:",
      error.message,
    );
  }
};

const readCoefficientsConfig = () => {
  const coefsPath = path.join(__dirname, "../data/coef.json");
  return JSON.parse(fs.readFileSync(coefsPath, "utf-8"));
};

const getUserRecord = async (username) => {
  const { data, error } = await supabase
    .from("users")
    .select("username, ent_username, group")
    .eq("username", username)
    .single();

  if (error || !data) {
    throw createHttpError(404, "Utilisateur introuvable", error);
  }

  return data;
};

const getHiddenRules = async (username, { includeInactive = false } = {}) => {
  let query = supabase
    .from("grade_hidden_rules")
    .select("*")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw createHttpError(
      500,
      "Impossible de récupérer les règles de masquage",
      error,
    );
  }

  return data || [];
};

const getLatestSnapshotRow = async (username) => {
  const { data, error } = await supabase
    .from("grade_snapshots")
    .select("*")
    .eq("username", username)
    .eq("is_latest", true)
    .maybeSingle();

  if (error) {
    throw createHttpError(
      500,
      "Impossible de récupérer le dernier snapshot de notes",
      error,
    );
  }

  return data || null;
};

const insertRefreshLog = async ({
  username,
  snapshotId = null,
  step,
  level = "info",
  message,
  details = null,
}) => {
  try {
    const { error } = await supabase.from("grade_refresh_logs").insert({
      username,
      snapshot_id: snapshotId,
      step,
      level,
      message,
      details,
    });

    if (error) {
      console.warn(
        "[GradesService] Impossible d'insérer un log de refresh:",
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      "[GradesService] Erreur lors de l'insertion d'un log de refresh:",
      error.message,
    );
  }
};

const incrementNotesCount = async (username) => {
  const { data, error } = await supabase
    .from("users")
    .select("notes_count")
    .eq("username", username)
    .single();

  if (error) {
    console.warn(
      "[GradesService] Impossible de lire notes_count:",
      error.message,
    );
    return;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ notes_count: (data?.notes_count || 0) + 1 })
    .eq("username", username);

  if (updateError) {
    console.warn(
      "[GradesService] Impossible d'incrémenter notes_count:",
      updateError.message,
    );
  }
};

const resolveCredentials = async (username, providedCredentials = {}) => {
  const userRecord = await getUserRecord(username);
  let entUsername = providedCredentials.ent_username || userRecord.ent_username;
  let password = providedCredentials.password || null;

  if (!entUsername) {
    entUsername = await ZimbraService.getEntUsername(username);
  }

  if (!password) {
    if (!entUsername) {
      throw createHttpError(
        400,
        "Aucun compte ENT lié et aucun identifiant fourni",
      );
    }

    try {
      const encryptedPassword =
        await ZimbraService.getStoredPassword(entUsername);
      password = ZimbraService.decryptPassword(entUsername, encryptedPassword);
    } catch (error) {
      throw createHttpError(
        400,
        "Mot de passe ENT manquant et aucun mot de passe stocké disponible",
      );
    }
  }

  if (!entUsername || !password) {
    throw createHttpError(400, "Identifiants ENT incomplets");
  }

  return {
    entUsername,
    password,
    rememberMe: Boolean(providedCredentials.rememberMe),
    userRecord,
  };
};

const persistSnapshot = async ({
  username,
  entUsername,
  source,
  rawCsv,
  parsedPayload,
  computedView,
  refreshDurationMs,
  errorMessage = null,
  status = "success",
}) => {
  const rawCsvSha256 = rawCsv
    ? crypto.createHash("sha256").update(rawCsv).digest("hex")
    : null;

  const { error: clearLatestError } = await supabase
    .from("grade_snapshots")
    .update({ is_latest: false })
    .eq("username", username)
    .eq("is_latest", true);

  if (clearLatestError) {
    throw createHttpError(
      500,
      "Impossible de mettre à jour le snapshot courant",
      clearLatestError,
    );
  }

  const payloadToStore = {
    ...parsedPayload,
    computed: computedView,
  };

  const { data, error } = await supabase
    .from("grade_snapshots")
    .insert({
      username,
      ent_username: entUsername,
      source,
      status,
      parser_version: PARSER_VERSION,
      raw_csv: rawCsv,
      raw_csv_sha256: rawCsvSha256,
      parsed_payload: payloadToStore,
      csv_row_count: parsedPayload.diagnostics?.csvRowCount || 0,
      parsed_entry_count: parsedPayload.entries?.length || 0,
      visible_entry_count: computedView.visibleEntryCount || 0,
      hidden_entry_count: computedView.hiddenEntryCount || 0,
      unmapped_module_count: computedView.unmappedModules?.length || 0,
      refresh_duration_ms: refreshDurationMs,
      error_message: errorMessage,
      is_latest: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw createHttpError(500, "Impossible d'enregistrer le snapshot", error);
  }

  return data;
};

const buildResponseFromSnapshot = async (username, snapshotRow) => {
  if (!snapshotRow) {
    return {
      snapshot: null,
      hiddenRules: [],
      data: null,
      credentials: {
        entUsername: null,
        hasStoredPassword: await ZimbraService.hasStoredPassword(username),
      },
    };
  }

  const hiddenRules = await getHiddenRules(username);
  const parsedPayload = snapshotRow.parsed_payload || {};
  const entries = Array.isArray(parsedPayload.entries)
    ? parsedPayload.entries
    : [];
  const metadata = parsedPayload.metadata || {};
  const coefficients = readCoefficientsConfig();

  const computedView = buildGradesView({
    entries,
    userGroup: metadata.userGroup || null,
    coefficients,
    hiddenRules,
  });

  return {
    snapshot: {
      id: snapshotRow.id,
      createdAt: snapshotRow.created_at,
      source: snapshotRow.source,
      status: snapshotRow.status,
      parserVersion: snapshotRow.parser_version,
      counts: {
        csvRowCount: snapshotRow.csv_row_count,
        parsedEntryCount: snapshotRow.parsed_entry_count,
        visibleEntryCount: computedView.visibleEntryCount,
        hiddenEntryCount: computedView.hiddenEntryCount,
        unmappedModuleCount: computedView.unmappedModules.length,
      },
    },
    hiddenRules,
    data: computedView,
    credentials: {
      entUsername: snapshotRow.ent_username || null,
      hasStoredPassword: await ZimbraService.hasStoredPassword(username),
    },
  };
};

const buildRefreshReport = (previousSnapshotRow, nextEntries) => {
  if (!previousSnapshotRow) {
    return {
      hasPreviousSnapshot: false,
      newEntryCount: 0,
      newEntries: [],
    };
  }

  const previousPayload = previousSnapshotRow.parsed_payload || {};
  const previousEntries = Array.isArray(previousPayload.entries)
    ? previousPayload.entries
    : [];
  const previousFingerprints = new Set(
    previousEntries.map((entry) => entry.fingerprint).filter(Boolean),
  );

  const newEntries = nextEntries
    .filter(
      (entry) =>
        entry.fingerprint && !previousFingerprints.has(entry.fingerprint),
    )
    .map((entry) => ({
      fingerprint: entry.fingerprint,
      moduleName: entry.moduleName,
      assessmentName: entry.assessmentName,
      assessmentType: entry.assessmentType,
      assessmentDate: entry.assessmentDate,
      gradeRaw: entry.gradeRaw,
      gradeKind: entry.gradeKind,
      numericGrade: entry.numericGrade,
      coefficient: entry.coefficient,
    }));

  return {
    hasPreviousSnapshot: true,
    newEntryCount: newEntries.length,
    newEntries: newEntries.slice(0, 12),
  };
};

const getGrades = async (username) => {
  const latestSnapshot = await getLatestSnapshotRow(username);
  return buildResponseFromSnapshot(username, latestSnapshot);
};

const enforceRefreshCooldown = async (username, force = false) => {
  if (force || REFRESH_COOLDOWN_MS <= 0) {
    return;
  }

  const latestSnapshot = await getLatestSnapshotRow(username);
  if (!latestSnapshot?.created_at) {
    return;
  }

  const rawElapsed = Date.now() - new Date(latestSnapshot.created_at).getTime();
  const elapsed = Math.max(0, rawElapsed);

  if (elapsed >= REFRESH_COOLDOWN_MS) {
    return;
  }

  const retryAfterMs = Math.min(
    REFRESH_COOLDOWN_MS,
    Math.max(0, REFRESH_COOLDOWN_MS - elapsed),
  );
  throw createHttpError(429, "Rafraîchissement trop fréquent", {
    retryAfterMs,
  });
};

const refreshGrades = async (username, options = {}) => {
  const source = options.source || "manual_refresh";
  const requestedStrategy = String(options.strategy || "").trim().toLowerCase();
  const forceHttpOnly =
    requestedStrategy === "http" || requestedStrategy === "aurion_http";
  const tryHttpFirst = forceHttpOnly || HTTP_FIRST_ENABLED;

  const { entUsername, password, rememberMe, userRecord } =
    await resolveCredentials(username, options);

  const lockKey = `grades-refresh:${String(entUsername).toLowerCase()}`;
  const lockWaitStartedAt = Date.now();
  const releaseLock = await acquireRefreshLock(lockKey);
  const waitedForLockMs = Date.now() - lockWaitStartedAt;

  let csvPath = null;
  let rawCsv = null;
  let snapshot = null;

  try {
    const startedAt = Date.now();

    if (waitedForLockMs > 50) {
      await insertRefreshLog({
        username,
        step: "debug",
        level: "info",
        message: "Rafraîchissement en file d'attente",
        details: { waitedForLockMs, lockKey },
      });
    }

    await enforceRefreshCooldown(username, Boolean(options.force));
    const previousSnapshot = await getLatestSnapshotRow(username);

    await insertRefreshLog({
      username,
      step: "auth",
      level: "info",
      message: "Début du rafraîchissement des notes",
      details: { source },
    });

    let parsedPayload = null;
    let effectiveSource = source;
    let snapshotSource = source;

    logGradesDebug("refresh_started", {
      username,
      source,
      requestedStrategy,
      forceHttpOnly,
      tryHttpFirst,
      httpFallbackEnabled: HTTP_FALLBACK_ENABLED,
      httpFirstEnabled: HTTP_FIRST_ENABLED,
      entUsername,
    });

    if (tryHttpFirst) {
      try {
        logGradesDebug("http_strategy_attempt", {
          username,
          entUsername,
          baseUrl: process.env.AURION_BASE_URL || null,
        });
        await insertRefreshLog({
          username,
          step: "debug",
          level: "info",
          message: "Tentative de récupération HTTP directe des notes",
          details: {
            strategy: "aurion_http_notations",
          },
        });

        const httpCsv = await AurionHttpService.downloadNotesCsv(
          entUsername,
          password,
          {
            baseUrl: process.env.AURION_BASE_URL,
          },
        );

        rawCsv = httpCsv.rawCsv;
        parsedPayload = parseCsvToEntries(rawCsv, {
          parserVersion: `${PARSER_VERSION}-aurion-http-csv`,
        });
        parsedPayload.metadata = {
          ...(parsedPayload.metadata || {}),
          sourceKind: "aurion_http_csv_export",
          httpDiagnostics: httpCsv.diagnostics,
        };
        effectiveSource = `${source}:aurion_http_csv`;
        snapshotSource = source;

        logGradesDebug("http_strategy_success", {
          username,
          bytes: httpCsv.diagnostics?.bytes || 0,
          durationMs: httpCsv.diagnostics?.durationMs || null,
        });

        await insertRefreshLog({
          username,
          step: "debug",
          level: "info",
          message: "CSV récupéré via HTTP sans navigateur",
          details: httpCsv.diagnostics,
        });
      } catch (httpError) {
        logGradesDebug("http_strategy_failed", {
          username,
          forceHttpOnly,
          error: httpError.message,
          ...(httpError.details || {}),
        });
        await insertRefreshLog({
          username,
          step: "debug",
          level: forceHttpOnly ? "error" : "warn",
          message: "Échec de la stratégie HTTP directe",
          details: {
            strategy: "aurion_http_notations",
            error: httpError.message,
            ...httpError.details,
          },
        });

        if (forceHttpOnly) {
          throw createHttpError(
            502,
            "La récupération HTTP directe des notes a échoué",
            {
              strategy: "aurion_http_notations",
              originalMessage: httpError.message,
              ...(httpError.details || {}),
            },
          );
        }
      }
    }

    if (!parsedPayload) {
      try {
        logGradesDebug("csv_strategy_attempt", {
          username,
          entUsername,
        });
        csvPath = await puppeteer.downloadCSV(entUsername, password, {
          requestId: crypto.randomUUID(),
        });
        rawCsv = fs.readFileSync(csvPath, "utf-8");

        logGradesDebug("csv_strategy_success", {
          username,
          csvPath,
          bytes: Buffer.byteLength(rawCsv, "utf-8"),
        });

        await insertRefreshLog({
          username,
          step: "download",
          level: "info",
          message: "CSV téléchargé avec succès",
          details: {
            entUsername,
            csvPath,
            bytes: Buffer.byteLength(rawCsv, "utf-8"),
          },
        });

        parsedPayload = parseCsvToEntries(rawCsv, {
          parserVersion: PARSER_VERSION,
        });
      } catch (csvError) {
        logGradesDebug("csv_strategy_failed", {
          username,
          error: csvError.message,
        });
        if (!HTTP_FALLBACK_ENABLED || forceHttpOnly || tryHttpFirst) {
          throw csvError;
        }

        await insertRefreshLog({
          username,
          step: "download",
          level: "warn",
          message: "Échec du téléchargement CSV, fallback HTTP activé",
          details: {
            error: csvError.message,
          },
        });

        const httpCsv = await AurionHttpService.downloadNotesCsv(
          entUsername,
          password,
          {
            baseUrl: process.env.AURION_BASE_URL,
          },
        );

        rawCsv = httpCsv.rawCsv;
        parsedPayload = parseCsvToEntries(rawCsv, {
          parserVersion: `${PARSER_VERSION}-aurion-http-csv`,
        });
        parsedPayload.metadata = {
          ...(parsedPayload.metadata || {}),
          sourceKind: "aurion_http_csv_export",
          httpDiagnostics: httpCsv.diagnostics,
        };
        effectiveSource = `${source}:aurion_http_csv_fallback`;
        snapshotSource = source;

        logGradesDebug("http_fallback_success", {
          username,
          bytes: httpCsv.diagnostics?.bytes || 0,
          durationMs: httpCsv.diagnostics?.durationMs || null,
        });
      }
    }

    const refreshReport = buildRefreshReport(
      previousSnapshot,
      parsedPayload.entries,
    );

    const userGroup = userRecord.group
      ? String(userRecord.group).toUpperCase()
      : null;
    const coefficients = readCoefficientsConfig();
    const hiddenRules = await getHiddenRules(username);

    const computedView = buildGradesView({
      entries: parsedPayload.entries,
      userGroup,
      coefficients,
      hiddenRules,
    });

    logGradesDebug("parsed_payload_ready", {
      username,
      effectiveSource,
      entryCount: parsedPayload.entries?.length || 0,
      sourceKind:
        parsedPayload.metadata?.sourceKind ||
        (rawCsv ? "csv_export" : "aurion_http_notations"),
      parseErrors: parsedPayload.diagnostics?.parseErrors?.length || 0,
    });

    parsedPayload.metadata = {
      parserVersion:
        parsedPayload.diagnostics?.parserVersion || parsedPayload.parserVersion,
      importedAt: new Date().toISOString(),
      userGroup,
      source: snapshotSource,
      effectiveSource,
      sourceKind:
        parsedPayload.metadata?.sourceKind ||
        (rawCsv ? "csv_export" : "aurion_http_notations"),
    };

    await insertRefreshLog({
      username,
      step: "parse",
      level: parsedPayload.diagnostics.parseErrors.length > 0 ? "warn" : "info",
      message: "CSV parsé",
      details: parsedPayload.diagnostics,
    });

    await insertRefreshLog({
      username,
      step: "mapping",
      level: computedView.unmappedModules.length > 0 ? "warn" : "info",
      message: "Mapping UE/modules terminé",
      details: {
        userGroup,
        unmappedModules: computedView.unmappedModules,
      },
    });

    await insertRefreshLog({
      username,
      step: "compute",
      level: "info",
      message: "Calcul métier terminé",
      details: {
        visibleEntryCount: computedView.visibleEntryCount,
        hiddenEntryCount: computedView.hiddenEntryCount,
        matchedHiddenRuleIds: computedView.matchedHiddenRuleIds,
      },
    });

    snapshot = await persistSnapshot({
      username,
      entUsername,
      source: snapshotSource,
      rawCsv,
      parsedPayload,
      computedView,
      refreshDurationMs: Date.now() - startedAt,
    });

    if (entUsername) {
      try {
        await ZimbraService.linkEntUsername(username, entUsername);
      } catch (error) {
        console.warn(
          "[GradesService] Liaison ent_username impossible:",
          error.message,
        );
      }
    }

    if (rememberMe) {
      try {
        await ZimbraService.storeEncryptedPassword(entUsername, password);
      } catch (error) {
        console.warn(
          "[GradesService] Sauvegarde du mot de passe impossible:",
          error.message,
        );
      }
    }

    if (computedView.matchedHiddenRuleIds.length > 0) {
      const { error } = await supabase
        .from("grade_hidden_rules")
        .update({ last_matched_at: new Date().toISOString() })
        .in("id", computedView.matchedHiddenRuleIds);

      if (error) {
        console.warn(
          "[GradesService] Mise à jour last_matched_at impossible:",
          error.message,
        );
      }
    }

    await incrementNotesCount(username);

    await insertRefreshLog({
      username,
      snapshotId: snapshot.id,
      step: "store",
      level: "info",
      message: "Snapshot enregistré",
      details: {
        snapshotId: snapshot.id,
        refreshDurationMs: Date.now() - startedAt,
      },
    });

    const response = await buildResponseFromSnapshot(username, snapshot);
    logGradesDebug("refresh_completed", {
      username,
      snapshotId: snapshot.id,
      effectiveSource,
      visibleEntryCount: response?.data?.visibleEntryCount || 0,
      hiddenEntryCount: response?.data?.hiddenEntryCount || 0,
      newEntryCount: refreshReport.newEntryCount,
    });
    return {
      ...response,
      refreshReport,
    };
  } catch (error) {
    await insertRefreshLog({
      username,
      snapshotId: snapshot?.id || null,
      step: "debug",
      level: "error",
      message: error.message,
      details: error.details || null,
    });

    if (error.statusCode) {
      throw error;
    }

    if (error.code === "ENT_AUTH_FAILED") {
      throw createHttpError(401, "Mot de passe ENT invalide", {
        code: "ENT_AUTH_FAILED",
        entUsername,
        originalMessage: error.message,
      });
    }

    throw createHttpError(500, "Le rafraîchissement des notes a échoué", {
      originalMessage: error.message,
    });
  } finally {
    cleanupDownloadedCsv(csvPath);
    releaseLock();
  }
};

const createHiddenRule = async (username, input) => {
  const payload = {
    username,
    match_strategy: input.matchStrategy || "entry_fingerprint",
    entry_fingerprint: input.entryFingerprint || null,
    module_name: input.moduleName || null,
    assessment_name: input.assessmentName || null,
    assessment_type: input.assessmentType || null,
    grade_value: input.gradeValue || null,
    assessment_date: input.assessmentDate || null,
    reason: input.reason || null,
    active: input.active !== false,
  };

  const { data, error } = await supabase
    .from("grade_hidden_rules")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw createHttpError(
      500,
      "Impossible d'enregistrer la règle de masquage",
      error,
    );
  }

  return data;
};

const deactivateHiddenRule = async (username, ruleId) => {
  const { data, error } = await supabase
    .from("grade_hidden_rules")
    .update({ active: false })
    .eq("username", username)
    .eq("id", ruleId)
    .select("*")
    .single();

  if (error || !data) {
    throw createHttpError(404, "Règle de masquage introuvable", error);
  }

  return data;
};

const restoreHiddenRule = async (username, ruleId) => {
  const { data, error } = await supabase
    .from("grade_hidden_rules")
    .update({ active: true })
    .eq("username", username)
    .eq("id", ruleId)
    .select("*")
    .single();

  if (error || !data) {
    throw createHttpError(404, "Règle de masquage introuvable", error);
  }

  return data;
};

const getCredentialStatus = async (username) => {
  const userRecord = await getUserRecord(username);
  return {
    entUsername: userRecord.ent_username || null,
    hasStoredPassword: await ZimbraService.hasStoredPassword(username),
  };
};

module.exports = {
  createHiddenRule,
  deactivateHiddenRule,
  getCredentialStatus,
  getGrades,
  getHiddenRules,
  refreshGrades,
  restoreHiddenRule,
};
