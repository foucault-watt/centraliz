const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const RUNTIME_FILES = ["index.html", "index.js", "index.wasm", "index.pck"];

function exportGame(sourceDir) {
  const script = path.join(sourceDir, "tools", "export-web.ps1");
  if (!fs.existsSync(script)) throw new Error(`Exporteur Le Musée absent : ${script}`);
  const result = spawnSync(process.platform === "win32" ? "powershell.exe" : "pwsh", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
  ], { cwd: sourceDir, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Échec de l’export web de Le Musée.");
}

// Browsers keep the game files: Ctrl+F5 reloads the page, not the files the
// game fetches itself (index.js, index.pck). Each export gets its own URLs,
// and the folder is revalidated at every visit.
const HTACCESS = `<IfModule mod_expires.c>
    ExpiresActive Off
</IfModule>
<IfModule mod_headers.c>
    Header set Cache-Control "no-cache"
</IfModule>
`;

function gameVersion(dir) {
  const hash = crypto.createHash("sha1");
  for (const name of ["index.js", "index.wasm", "index.pck"]) hash.update(fs.readFileSync(path.join(dir, name)));
  return hash.digest("hex").slice(0, 10);
}

function versionUrls(destination) {
  const version = gameVersion(destination);
  const htmlPath = path.join(destination, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8")
    .replace('src="index.js"', `src="index.js?v=${version}"`)
    .replace(/const GODOT_CONFIG = (\{.*?\});/, (match, json) => {
      const config = JSON.parse(json);
      config.mainPack = `index.pck?v=${version}`;
      if (config.fileSizes?.["index.pck"]) config.fileSizes[config.mainPack] = config.fileSizes["index.pck"];
      return `const GODOT_CONFIG = ${JSON.stringify(config)};`;
    });
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(destination, ".htaccess"), HTACCESS);
  return version;
}

// Dev only: no Godot export, the last one stays usable until the next build.
function existingMusee({ frontendDir }) {
  const destination = path.resolve(frontendDir, "public", "games", "le-musee");
  const found = RUNTIME_FILES.every(name => fs.existsSync(path.join(destination, name)));
  console.log(found
    ? "[musee] Export Godot ignoré en dev : dernier export réutilisé."
    : "[musee] Export Godot ignoré en dev : aucun export trouvé, page exclue.");
  return found;
}

function prepareMusee({ frontendDir, sourceDir, exporter = exportGame }) {
  console.log(`[musee 1/3] Recherche du projet : ${sourceDir}`);
  const publicDir = path.resolve(frontendDir, "public");
  const destination = path.resolve(publicDir, "games", "le-musee");
  const relative = path.relative(publicDir, destination);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Le dossier généré doit rester dans frontend/public.");
  }
  // Never traverse a linked parent or remove content outside the generated folder.
  for (const dir of [publicDir, path.dirname(destination), destination]) {
    if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) {
      throw new Error(`Dossier généré lié refusé : ${dir}`);
    }
  }
  fs.rmSync(destination, { recursive: true, force: true });
  if (!fs.existsSync(sourceDir)) {
    console.log(`[musee] Projet absent (${sourceDir}) : page et jeu exclus.`);
    return false;
  }
  if (!fs.existsSync(path.join(sourceDir, "project.godot"))) {
    throw new Error(`Le dossier Le Musée ne contient pas project.godot : ${sourceDir}`);
  }
  console.log("[musee 2/3] Export web Godot (progression en direct)…");
  exporter(sourceDir);
  const exported = path.join(sourceDir, "build", "web");
  for (const name of RUNTIME_FILES) {
    if (!fs.existsSync(path.join(exported, name))) {
      throw new Error(`Export Le Musée incomplet : ${name} absent.`);
    }
  }
  fs.mkdirSync(destination, { recursive: true });
  console.log("[musee 3/3] Copie des fichiers du jeu…");
  for (const entry of fs.readdirSync(exported, { withFileTypes: true })) {
    if (entry.isFile() && /\.(html|js|wasm|pck|png)$/.test(entry.name)) {
      fs.copyFileSync(path.join(exported, entry.name), path.join(destination, entry.name));
    }
  }
  console.log(`[musee] Version ${versionUrls(destination)} (cache du navigateur contourné).`);
  const bytes = fs.readdirSync(destination).reduce((total, name) => total + fs.statSync(path.join(destination, name)).size, 0);
  console.log(`[musee] /musee activé — ${(bytes / 1000000).toFixed(1)} Mo.`);
  return true;
}

module.exports = { prepareMusee, existingMusee, gameVersion };
