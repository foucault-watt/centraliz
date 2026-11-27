const path = require("path");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");

const WORKER_STAGES = new Set([
  "runtime_imports", "input", "browser_start", "cas_open", "cas_form",
  "cas_submit", "moodle_authentication", "courses_open", "courses_overview",
  "courses_filters", "courses_extract", "courses_pagination", "courses_frontend_request", "browser_close", "completed",
  "course_access_check", "course_sections_open", "course_sections_extract", "course_section_open",
  "file_resource_open", "file_download",
]);
const ERROR_TYPES = new Set(["TimeoutError", "ProbeError", "Error", "ModuleNotFoundError", "ImportError", "ValueError", "JSONDecodeError"]);
const WORKER_REASONS = new Set([
  "MOODLE_UNEXPECTED_STATE", "COURSE_GROUP_FILTER_MISSING", "COURSE_PAGINATION_UNSUPPORTED",
  "COURSE_PAGINATION_STALLED", "COURSE_LINK_INVALID", "NO_COURSES_EXTRACTED",
  "COURSE_FRONTEND_UNAVAILABLE", "COURSE_FRONTEND_TIMEOUT", "COURSE_FRONTEND_INVALID_RESPONSE", "COURSE_FRONTEND_REQUEST_FAILED",
  "COURSE_ID_INVALID", "COURSE_NOT_ENROLLED", "COURSE_SECTIONS_UNSUPPORTED", "COURSE_SECTION_LINK_INVALID",
  "FILE_REDIRECT_REJECTED", "FILE_TOO_LARGE", "FILE_RESOURCE_NOT_ACCESSIBLE", "FILE_NOT_FOUND",
]);
const ERROR_CODES = new Set(["USER_KEY_MISSING", "USER_KEY_INVALID", "STORED_PASSWORD_NOT_FOUND", "ENT_SERVICE_MISCONFIGURED", "MOODLE_COLLECTION_FAILED"]);

const collectorDir = path.resolve(__dirname, "../../../prototypes/moodle");
const collectionError = () => Object.assign(
  new Error("Impossible de récupérer les cours Moodle. Vérifiez vos identifiants ENT ou réessayez plus tard."),
  { statusCode: 502, code: "MOODLE_COLLECTION_FAILED" },
);

const resultCounts = (operation, result) => operation === "file" ? { fileBytes: result.size }
  : { [{ courses: "courseCount", sections: "sectionCount", files: "fileCount" }[operation]]: result.length };
const runCollector = (credentials, { log = () => {}, operation = "courses", courseId, moduleId, fileIndex = 0 } = {}) => new Promise((resolve, reject) => {
  const python = process.env.MOODLE_PYTHON || path.join(
    collectorDir, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const env = { ...process.env };
  delete env.DEBUG;
  delete env.PWDEBUG;
  log("collector_starting", { platform: process.platform, customPython: Boolean(process.env.MOODLE_PYTHON) });
  const child = spawn(python, [path.join(collectorDir, "worker.py")], {
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env,
  });
  let output = "";
  let diagnostics = "";
  let finished = false;
  const fail = (event, fields = {}, error = collectionError()) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    log(event, fields);
    reject(error);
  };
  const timer = setTimeout(() => { fail("collector_timeout", { timeoutMs: 180000 }); child.kill(); }, 180000);
  child.on("spawn", () => log("collector_started"));
  child.on("error", error => fail("collector_spawn_failed", {
    reason: ["ENOENT", "EACCES", "EPERM"].includes(error.code) ? error.code : "SPAWN_ERROR",
  }));
  child.stdin.on("error", () => {}); // Early worker exit; close/error handles the failure.
  child.stderr.on("data", chunk => {
    diagnostics += chunk.toString();
    let end;
    while ((end = diagnostics.indexOf("\n")) !== -1) {
      const line = diagnostics.slice(0, end);
      diagnostics = diagnostics.slice(end + 1);
      // Never forward raw stderr: tracebacks may contain passwords or tickets.
      try {
        const entry = JSON.parse(line);
        if (WORKER_STAGES.has(entry.stage) && ["stage_started", "stage_failed"].includes(entry.event)) {
          log(entry.event, {
            workerStage: entry.stage,
            ...(ERROR_TYPES.has(entry.errorType) ? { errorType: entry.errorType } : {}),
            ...(WORKER_REASONS.has(entry.reason) ? { reason: entry.reason } : {}),
          });
        }
      } catch { /* Ignore unstructured third-party diagnostics. */ }
    }
    if (diagnostics.length > 8192) diagnostics = "";
  });
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (Buffer.byteLength(output) > (operation === "file" ? 29 * 1024 * 1024 : 2 * 1024 * 1024)) {
      fail("collector_output_limit");
      child.kill();
    }
  });
  child.on("close", (code, signal) => {
    clearTimeout(timer);
    if (finished) return;
    if (code !== 0) {
      let error = collectionError();
      try {
        if (JSON.parse(output).code === "MOODLE_COURSE_NOT_ACCESSIBLE") {
          error = Object.assign(new Error("Ce cours n’est pas accessible avec votre compte Moodle."), {
            statusCode: 403, code: "MOODLE_COURSE_NOT_ACCESSIBLE",
          });
        }
      } catch { /* Never propagate raw worker output. */ }
      return fail("collector_exit_failed", {
      exitCode: code, signal: ["SIGTERM", "SIGKILL", "SIGINT"].includes(signal) ? signal : null,
      }, error);
    }
    try {
      const result = JSON.parse(output);
      if (operation === "file") {
        const file = result.file;
        if (!file || typeof file.blob !== "string" || typeof file.name !== "string" || typeof file.mimeType !== "string"
          || !Number.isInteger(file.size) || file.size < 0 || file.size > 20 * 1024 * 1024) throw collectionError();
        const { createHash } = require("crypto");
        const bytes = Buffer.from(file.blob, "base64");
        if (bytes.length !== file.size || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw collectionError();
      } else if (!Array.isArray(result[operation])) throw collectionError();
      finished = true;
      log("collector_completed", resultCounts(operation, result[operation]));
      resolve(result[operation]);
    } catch { fail("collector_invalid_output"); }
  });
  child.stdin.end(JSON.stringify({ entUsername: credentials.entUsername, password: credentials.password, operation, courseId, moduleId, fileIndex }));
});

const createMoodleService = ({ credentialsService, collect, logger = console }) => {
  const pool = collect ? null : require("./moodleCollectorPool.cjs").createCollectorPool();
  collect = collect || pool.collect;
  const execute = async (username, userKey, operation, courseId, moduleId, fileIndex) => {
    // Use exactly the ENT resolver used by Centraliz. Never select an ENT
    // identity from request parameters, and never return credentials.
    const started = Date.now();
    const requestId = randomUUID();
    const log = (event, fields = {}) => logger.log(`[Moodle] ${JSON.stringify({
      requestId, operation, event, durationMs: Date.now() - started, ...fields,
    })}`);
    let stage = "credentials";
    log("started");
    try {
      const credentials = await credentialsService.resolveStoredCredentials(username, userKey);
      log("credentials_resolved");
      stage = "collection";
      const accountKey = require("crypto").createHash("sha256").update(JSON.stringify([username, userKey])).digest("hex");
      const result = await collect(credentials, { log, operation, courseId, moduleId, fileIndex, accountKey });
      log("completed", resultCounts(operation, result));
      return result;
    } catch (error) {
      log("failed", { stage, code: ERROR_CODES.has(error.code) ? error.code : "UNCLASSIFIED_ERROR" });
      throw error;
    }
  };
  const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
  const invalidId = () => Promise.reject(Object.assign(new Error("Identifiant de ressource invalide"), { statusCode: 400, code: "COURSE_ID_INVALID" }));
  return {
    close: () => pool?.close(),
    listCourses: (username, userKey) => execute(username, userKey, "courses"),
    listSections(username, userKey, courseId) {
      if (!Number.isSafeInteger(courseId) || courseId < 1 || courseId > 2147483647) {
        return Promise.reject(Object.assign(new Error("Identifiant de cours invalide"), { statusCode: 400, code: "COURSE_ID_INVALID" }));
      }
      return execute(username, userKey, "sections", courseId);
    },
    listFiles(username, userKey, courseId, moduleId) {
      if (!validId(courseId) || !validId(moduleId)) return invalidId();
      return execute(username, userKey, "files", courseId, moduleId);
    },
    downloadFile(username, userKey, courseId, moduleId, fileIndex = 0) {
      if (!validId(courseId) || !validId(moduleId) || !Number.isSafeInteger(fileIndex) || fileIndex < 0 || fileIndex > 10000) return invalidId();
      return execute(username, userKey, "file", courseId, moduleId, fileIndex);
    },
  };
};

module.exports = { createMoodleService, runCollector };
