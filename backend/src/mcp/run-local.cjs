const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { createUserSecretSalt } = require("../utils/userSecret");
const { createMoodleService } = require("../services/moodleService");
const { createLocalMcpApp } = require("./localHttp.cjs");
const { createAccountDirectory, resolveLocalPrincipal } = require("./localPrincipal.cjs");

async function main() {
  const userFlag = process.argv.indexOf("--user");
  let username = userFlag >= 0 ? process.argv[userFlag + 1] : "";
  if (!username) {
    const readline = require("node:readline/promises").createInterface({ input: process.stdin, output: process.stdout });
    try { username = (await readline.question("Identifiant ENT ou Centraliz (aucun mot de passe) : ")).trim(); }
    finally { readline.close(); }
  }
  if (!username || username.startsWith("--")) throw new Error("Missing account");
  const principal = await resolveLocalPrincipal(username, {
    directory: createAccountDirectory(require("../utils/supabaseClient")),
    deriveUserKey: createUserSecretSalt,
  });
  console.log("Compte Centraliz retrouvé et liaison ENT vérifiée.");
  const credentialsService = require('../services/zimbraService');
  const hint = await credentialsService.getClientKeyHint(principal.username);
  if (hint.userKeyMode === 'client') {
    const keyFlag = process.argv.indexOf('--key-file');
    if (keyFlag < 0 || !process.argv[keyFlag + 1]) throw Object.assign(new Error('Compte protégé : fournissez --key-file avec la sauvegarde de votre clé personnelle. Aucun secret dans la ligne de commande.'), { code: 'MCP_CLIENT_KEY_REQUIRED' });
    principal.userKey = require('node:fs').readFileSync(process.argv[keyFlag + 1], 'utf8').trim();
    if (!require('./clientVault.cjs').validSecret(principal.userKey)) throw new Error('Invalid key file');
  }
  const moodleService = createMoodleService({ credentialsService });
  const app = createLocalMcpApp({ moodleService, principal });
  const server = app.listen(3002, "127.0.0.1", () => {
    console.log("MCP Moodle local : http://127.0.0.1:3002/mcp (compte fixé au démarrage, accès depuis cette machine uniquement)");
  });
  server.on("error", () => { console.error("Impossible de démarrer le MCP local (port 3002 ou configuration)."); process.exitCode = 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { moodleService.close(); server.close(); });
}

main().catch(error => {
  const safeCodes = new Set(["MCP_ACCOUNT_NOT_FOUND", "MCP_ACCOUNT_AMBIGUOUS", "MCP_ACCOUNT_LOOKUP_FAILED", "MCP_ENT_NOT_LINKED", 'MCP_CLIENT_KEY_REQUIRED']);
  console.error(safeCodes.has(error.code) ? error.message : "Démarrage MCP impossible. Vérifiez backend/.env et le compte Centraliz.");
  process.exitCode = 1;
});
