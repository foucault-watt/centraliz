const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { prepareMusee, existingMusee, gameVersion } = require("./prepare-musee.cjs");

const command = process.argv[2];
if (!["start", "build"].includes(command)) throw new Error("Commande attendue : start ou build.");
const frontendDir = path.resolve(__dirname, "..");
const sourceDir = process.env.LE_MUSEE_DIR
  ? path.resolve(process.env.LE_MUSEE_DIR)
  : path.resolve(frontendDir, "..", "..", "le-musee");

try {
  const enabled = command === "build" ? prepareMusee({ frontendDir, sourceDir }) : existingMusee({ frontendDir });
  console.log(`[centraliz] ${command === "build" ? "Build React de production" : "Démarrage React"} (Musée ${enabled ? "inclus" : "exclu"})…`);
  const result = spawnSync(process.execPath, [
    path.join(frontendDir, "node_modules/vite/bin/vite.js"), ...(command === "build" ? ["build"] : []), ...process.argv.slice(3),
  ], {
    cwd: frontendDir,
    stdio: "inherit",
    env: {
      ...process.env,
      REACT_APP_MUSEE_ENABLED: String(enabled),
      REACT_APP_MUSEE_VERSION: enabled ? gameVersion(path.join(frontendDir, "public/games/le-musee")) : "",
      REACT_APP_URL_BACK: process.env.REACT_APP_URL_BACK ||
        (command === "build" ? "https://centraliz.it" : "http://localhost:3001"),
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`[musee] ${error.message}`);
  process.exitCode = 1;
}
