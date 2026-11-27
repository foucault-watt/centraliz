const fs = require("node:fs");
const path = require("node:path");

const CODE_DIRS = ["config", "middlewares", "routes", "services", "utils", "ws", "mcp", "migrations"];
const COLLECTOR_FILES = ["courses.py", "sections.py", "files.py", "worker.py", "session_worker.py", "requirements.txt"];
const PROTECTED = /(^|\/)(\.[^/]+|node_modules|downloads|logs|cache|__pycache__|data|fixtures|__tests__)(\/|$)|\.(test|spec)\.[^/]+$|\.log$/i;

function walk(root, allowed = () => true) {
  const files = [];
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Dossier source symbolique refusé');
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, item.name);
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (item.isSymbolicLink()) throw new Error(`Lien symbolique local refusé : ${relative}`);
      if (!allowed(relative, item.isDirectory())) continue;
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) files.push(file);
    }
  }
  visit(root);
  return files;
}

function remotePath(value, name) {
  if (!value || !value.startsWith("/") || /[\\\x00-\x1f]/.test(value) || value.split("/").includes("..")) {
    throw new Error(`${name} doit être un chemin SFTP absolu explicite`);
  }
  const normalized = path.posix.normalize(value).replace(/\/$/, "") || "/";
  if (["/", "/home", "/root", "/var", "/var/www", "/usr", "/etc", "/tmp", "/opt"].includes(normalized)) throw new Error(`${name} désigne un répertoire trop général`);
  return normalized;
}

const overlap = (a, b) => a === b || a.startsWith(b + "/") || b.startsWith(a + "/");

function createPlan({ root, env, frontend = true, backend = true, strict = true }) {
  const targets = [];
  if (frontend) targets.push({ id: "frontend", label: "Frontend", localDir: path.join(root, "frontend/build"),
    remoteDir: env.SFTP_REMOTE_PATH ? remotePath(env.SFTP_REMOTE_PATH, "SFTP_REMOTE_PATH") : null,
    atomic: false, replaceDirectory: true,
    files: walk(path.join(root, "frontend/build")) });
  if (backend) {
    const localDir = path.join(root, "backend");
    const files = ["server.js", "package.json", "package-lock.json"].map(name => path.join(localDir, name)).filter(file => fs.existsSync(file));
    for (const dir of CODE_DIRS) files.push(...walk(path.join(localDir, "src", dir), (relative, isDir) =>
      !PROTECTED.test(relative) && (isDir || /\.(?:js|cjs|mjs|sql)$/.test(relative))));
    const remoteDir = env.SFTP_BACKEND_REMOTE_PATH ? remotePath(env.SFTP_BACKEND_REMOTE_PATH, "SFTP_BACKEND_REMOTE_PATH") : null;
    targets.push({ id: "backend", label: "Backend", localDir, remoteDir, files, atomic: true });
    const collectorDir = path.join(root, "prototypes/moodle");
    const collectorFiles = COLLECTOR_FILES.map(name => path.join(collectorDir, name)).filter(file => fs.existsSync(file));
    if (collectorFiles.length) targets.push({ id: "collectors", label: "Collecteurs Moodle", localDir: collectorDir,
      remoteDir: remoteDir ? path.posix.join(path.posix.dirname(remoteDir), "prototypes/moodle") : null,
      files: collectorFiles, atomic: true });
  }
  for (const target of targets) {
    if (strict && !target.remoteDir) throw new Error(`Chemin distant absent pour ${target.label} : configurer ${target.id === 'frontend' ? 'SFTP_REMOTE_PATH' : 'SFTP_BACKEND_REMOTE_PATH'}`);
    for (const file of target.files) if (fs.lstatSync(file).isSymbolicLink()) throw new Error("Lien symbolique local refusé");
    target.bytes = target.files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  }
  const configured = targets.filter(target => target.remoteDir);
  for (let i = 0; i < configured.length; i++) for (let j = i + 1; j < configured.length; j++) {
    if (overlap(configured[i].remoteDir, configured[j].remoteDir)) throw new Error("Les destinations frontend, backend et collecteurs doivent être distinctes et non imbriquées");
  }
  return targets;
}

async function validateRemoteTargets(sftp, targets) {
  const paths = new Set();
  for (const target of targets) {
    const directories = [target.remoteDir, ...target.files.map(file => path.posix.dirname(path.posix.join(target.remoteDir, path.relative(target.localDir, file).split(path.sep).join("/"))))];
    for (let directory of directories) while (directory !== "/") { paths.add(directory); directory = path.posix.dirname(directory); }
  }
  for (const directory of paths) {
    const type = await sftp.exists(directory);
    if (type && type !== "d") throw new Error("Une destination SFTP ou son parent n’est pas un dossier ordinaire (lien refusé)");
  }
}

module.exports = { createPlan, remotePath, validateRemoteTargets, walk };
