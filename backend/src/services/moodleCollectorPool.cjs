const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const path = require("node:path");

function createCollectorPool({ spawnProcess = spawn, idleMs = 120000, maxWorkers = 4 } = {}) {
  const workers = new Map();
  const inflight = new Map();
  const directory = path.resolve(__dirname, "../../../prototypes/moodle");
  const failure = () => Object.assign(new Error("Collecte Moodle interrompue"), { code: "MOODLE_COLLECTION_FAILED", statusCode: 502 });
  function dispose(entry) {
    clearTimeout(entry.idle);
    entry.pending?.reject(failure()); entry.pending = null;
    if (entry.child) {
      const child = entry.child; entry.child = null;
      child.stdin.end();
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill(); }, 1500);
      timer.unref();
    }
  }
  function start(entry) {
    const python = process.env.MOODLE_PYTHON || path.join(directory, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    const env = { ...process.env, PYTHONUNBUFFERED: "1" };
    delete env.DEBUG; delete env.PWDEBUG;
    const child = spawnProcess(python, [path.join(directory, "session_worker.py")], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env });
    entry.child = child;
    let output = "", diagnostic = "";
    child.stdin.on("error", () => {});
    child.stdout.on("data", data => {
      if (entry.child !== child) return;
      output += data.toString();
      if (output.length > 29 * 1024 * 1024) { entry.pending?.reject(failure()); dispose(entry); return; }
      let end;
      while ((end = output.indexOf("\n")) >= 0) {
        const line = output.slice(0, end); output = output.slice(end + 1);
        const pending = entry.pending; entry.pending = null;
        if (!pending) continue;
        try {
          const result = JSON.parse(line);
          if (result.code) {
            const error = failure();
            if (result.code === "MOODLE_COURSE_NOT_ACCESSIBLE") { error.code = result.code; error.statusCode = 403; }
            pending.reject(error);
          } else pending.resolve(result);
        } catch { pending.reject(failure()); dispose(entry); }
      }
    });
    child.stderr.on("data", data => {
      if (entry.child !== child) return;
      diagnostic += data.toString();
      let end;
      while ((end = diagnostic.indexOf("\n")) >= 0) {
        const line = diagnostic.slice(0, end); diagnostic = diagnostic.slice(end + 1);
        try {
          const event = JSON.parse(line);
          const stages = new Set(["browser_start", "cas_open", "cas_form", "cas_submit", "moodle_authentication", "courses_open", "courses_overview", "courses_frontend_request", "course_access_check", "course_sections_open", "course_sections_extract", "course_section_open", "file_resource_open", "file_download", "session_reused", "session_reconnecting", "courses_cache_hit", "sections_cache_hit", "resource_cache_hit"]);
          if (stages.has(event.stage) && ["stage_started", "stage_failed"].includes(event.event)) {
            entry.log?.(event.event, { workerStage: event.stage,
              ...(event.event === "stage_failed" ? { reason: "WORKER_STAGE_FAILED" } : {}) });
          }
        } catch { /* Never forward raw browser errors. */ }
      }
      if (diagnostic.length > 8192) diagnostic = "";
    });
    const stopped = () => {
      if (entry.child !== child) return;
      entry.child = null;
      entry.pending?.reject(failure()); entry.pending = null;
    };
    child.on("error", stopped); child.on("close", stopped);
  }
  async function collect(credentials, options) {
    const identity = options.accountKey || credentials.entUsername;
    const key = createHash("sha256").update(JSON.stringify([identity, credentials.entUsername, credentials.password])).digest("hex");
    const requestKey = JSON.stringify([key, options.operation, options.courseId, options.moduleId, options.fileIndex]);
    if (inflight.has(requestKey)) { options.log("request_coalesced"); return structuredClone(await inflight.get(requestKey)); }
    let entry = workers.get(key);
    if (!entry) {
      // A changed credential must not retain the previous account session.
      for (const [oldKey, old] of workers) if (old.identity === identity && oldKey !== key) { old.retired = true; dispose(old); workers.delete(oldKey); }
      if (workers.size >= maxWorkers) {
        const idle = [...workers].find(([, candidate]) => candidate.queued === 0);
        if (!idle) throw failure();
        dispose(idle[1]); workers.delete(idle[0]);
      }
      entry = { identity, tail: Promise.resolve(), queued: 0, child: null };
      workers.set(key, entry);
    }
    clearTimeout(entry.idle); entry.queued++;
    const task = entry.tail.catch(() => {}).then(async () => {
      if (entry.retired) throw failure();
      entry.log = options.log;
      options.log("worker_request_started");
      if (!entry.child) start(entry);
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { entry.pending = null; dispose(entry); reject(failure()); }, 180000);
        entry.pending = {
          resolve: value => { clearTimeout(timer); resolve(value); },
          reject: error => { clearTimeout(timer); reject(error); },
        };
        entry.child.stdin.write(JSON.stringify({ ...credentials, operation: options.operation, courseId: options.courseId,
          moduleId: options.moduleId, fileIndex: options.fileIndex ?? 0 }) + "\n");
      });
      if (options.operation === "file") {
        const file = result.file;
        if (!file || typeof file.blob !== "string" || !Number.isInteger(file.size) || file.size > 20 * 1024 * 1024) throw failure();
        const bytes = Buffer.from(file.blob, "base64");
        if (bytes.length !== file.size || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw failure();
      } else if (!Array.isArray(result[options.operation])) throw failure();
      return result[options.operation];
    }).catch(error => {
      dispose(entry);
      throw error;
    }).finally(() => {
      entry.queued--;
      if (!entry.queued) {
        entry.log = null;
        entry.idle = setTimeout(() => { dispose(entry); workers.delete(key); }, idleMs);
        entry.idle.unref();
      }
      inflight.delete(requestKey);
    });
    entry.tail = task;
    inflight.set(requestKey, task);
    return structuredClone(await task);
  }
  return { collect, close() { for (const entry of workers.values()) { entry.retired = true; dispose(entry); } workers.clear(); } };
}
module.exports = { createCollectorPool };
