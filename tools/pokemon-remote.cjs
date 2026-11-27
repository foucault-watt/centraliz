#!/usr/bin/env node
// Pilotage à distance du serveur de jeu Pokémon (SSH + SFTP).
//
// Réutilise les identifiants SFTP du .env racine (SFTP_HOST, SFTP_USER,
// SFTP_PASSWORD, SFTP_PORT=8887 par défaut). Le compte a un vrai shell :
// on peut lancer des commandes, prendre des captures et récupérer des
// fichiers sans intervention manuelle.
//
// Usage : node tools/pokemon-remote.cjs <commande> [arguments]
//   status                 Diagnostic complet (services, ports, API, frames qui avancent ?)
//   native                 Capture native 240x160 via mGBA-http : la vraie image du jeu (à privilégier)
//   screenshot [--full]    Capture X11 de la fenêtre mGBA (ou de tout l'écran :98) : utile pour voir
//                          les menus/dialogues Qt, mais peut montrer une image figée
//   press <BTN...>         Tape des boutons via mGBA-http puis capture native (A B START UP DOWN LEFT RIGHT SELECT L R)
//   logs [n]               Fin du log mGBA-http (sans couleurs) + journal systemd
//   restart                Redémarre centraliz-gba.service puis relance le diagnostic
//   exec "<commande>"      Commande shell arbitraire sur le serveur
//   get <distant> [local]  Télécharge un fichier
//   put <local> <distant>  Envoie un fichier
//   stream-check [url]     Vérifie de l'extérieur que le flux SSE passe nginx et le proxy HTTPS
//
// Les captures atterrissent dans logs/pokemon/ (ignoré par Git).

const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

const ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const GAME_DIR = '/home/fwattinne/centraliz/game-runner';
const DISPLAY = ':98';
const API = 'http://127.0.0.1:5000';
const SHOTS_DIR = path.join(ROOT, 'logs', 'pokemon');
const BUTTONS = {
  A: 'A', B: 'B', START: 'Start', SELECT: 'Select',
  UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right', L: 'L', R: 'R',
};

function connect() {
  const { SFTP_HOST, SFTP_USER, SFTP_PASSWORD } = process.env;
  if (!SFTP_HOST || !SFTP_USER || !SFTP_PASSWORD) {
    throw new Error('SFTP_HOST, SFTP_USER et SFTP_PASSWORD doivent être définis dans le .env racine');
  }
  return new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on('ready', () => resolve(client))
      .on('error', reject)
      .connect({
        host: SFTP_HOST,
        port: Number(process.env.SFTP_PORT || 8887),
        username: SFTP_USER,
        password: SFTP_PASSWORD,
        readyTimeout: 20000,
      });
  });
}

// Exécute une commande distante. Renvoie { code, out } (stdout+stderr mêlés).
function run(client, command, { echo = true, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      const timer = setTimeout(() => { stream.close(); reject(new Error(`Délai dépassé (${timeoutMs} ms) : ${command.slice(0, 80)}`)); }, timeoutMs);
      const onData = (d) => { out += d; if (echo) process.stdout.write(d); };
      stream.on('data', onData).stderr.on('data', onData);
      stream.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
    });
  });
}

function sftpOf(client) {
  return new Promise((resolve, reject) => client.sftp((err, sftp) => (err ? reject(err) : resolve(sftp))));
}

async function download(client, remote, local) {
  const sftp = await sftpOf(client);
  fs.mkdirSync(path.dirname(local), { recursive: true });
  await new Promise((resolve, reject) => sftp.fastGet(remote, local, (err) => (err ? reject(err) : resolve())));
  return local;
}

async function upload(client, local, remote) {
  const sftp = await sftpOf(client);
  await new Promise((resolve, reject) => sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve())));
  return remote;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Script de diagnostic : chaque ligne commence par OK / FAIL / INFO pour
// rester lisible par un humain comme par une IA.
const STATUS_SCRIPT = String.raw`
export DISPLAY=${DISPLAY}
ok()   { printf 'OK    %s\n' "$*"; }
ko()   { printf 'FAIL  %s\n' "$*"; }
info() { printf 'INFO  %s\n' "$*"; }
for s in centraliz-xvfb centraliz-openbox centraliz-gba; do
  st=$(systemctl is-active $s.service 2>/dev/null)
  [ "$st" = active ] && ok "$s.service actif (depuis $(systemctl show $s.service -p ActiveEnterTimestamp --value))" || ko "$s.service : $st"
done
MGBA_PID=$(pgrep -x mgba-qt | head -1)
HTTP_PID=$(pgrep -f 'tools/mgba-http/mgba-http$' | head -1)
[ -n "$MGBA_PID" ] && ok "mgba-qt pid $MGBA_PID" || ko "mgba-qt absent"
[ -n "$HTTP_PID" ] && ok "mgba-http pid $HTTP_PID" || ko "mgba-http absent"
ss -ltn | grep -q ':8888 ' && ok "port Lua 8888 en écoute" || ko "port Lua 8888 fermé"
ss -ltn | grep -q ':5000 ' && ok "port API 5000 en écoute" || ko "port API 5000 fermé"
STUCK=$(ss -tn state established '( sport = :8888 )' 2>/dev/null | awk 'NR>1 && $1>0' | wc -l)
[ "$STUCK" -gt 0 ] && ko "$STUCK connexion(s) vers Lua avec des données non lues (Lua ne traite plus les messages)"
# Le CPU de mGBA (~3 %) et la capture X11 ne prouvent rien : la fenêtre
# Xvfb peut rester figée alors que l'émulation tourne. Seul le compteur
# de frames fait foi.
L=$(curl -s -o /dev/null -m 4 -w '%{time_total}' ${API}/core/getgametitle)
T=$(curl -s -m 4 ${API}/core/getgametitle) && [ -n "$T" ] && ok "API titre : $T (latence $L s)" || ko "API /core/getgametitle sans réponse en 4 s (file de requêtes bloquée côté Lua ?)"
c1=$(curl -s -m 4 ${API}/core/currentFrame); sleep 2; c2=$(curl -s -m 4 ${API}/core/currentFrame)
if [ -n "$c1" ] && [ -n "$c2" ]; then
  fps=$(( (c2 - c1) / 2 )) 2>/dev/null
  [ "$fps" -ge 50 ] 2>/dev/null && ok "émulation à ~$fps fps ($c1 -> $c2)" || ko "émulation lente ou figée : ~$fps fps ($c1 -> $c2)"
else ko "API /core/currentFrame sans réponse"; fi
info "fenêtres : $(xdotool search --name 'mGBA' 2>/dev/null | while read w; do xdotool getwindowname $w; done | paste -sd '|')"
info "log mgba-http : $(du -h ${GAME_DIR}/logs/mgba-http.log 2>/dev/null | cut -f1) ; disque libre : $(df -h ~ | awk 'NR==2{print $4}')"
info "audioSync=$(grep -m1 '^audioSync' ~/.config/mgba/config.ini | cut -d= -f2) videoSync=$(grep -m1 '^videoSync' ~/.config/mgba/config.ini | cut -d= -f2)"
`;

async function status(client) {
  const { out } = await run(client, STATUS_SCRIPT);
  return out.includes('FAIL') ? 1 : 0;
}

async function screenshot(client, { full = false, label = 'screen' } = {}) {
  const remote = `/tmp/centraliz-shot-${process.pid}.png`;
  const crop = full ? '' : String.raw`
W=$(xdotool search --name 'mGBA - ' 2>/dev/null | head -1)
if [ -n "$W" ]; then eval $(xdotool getwindowgeometry --shell $W); VF="-vf crop=$WIDTH:$((HEIGHT+40)):$X:$((Y-40))"; fi`;
  const { code, out } = await run(client, `export DISPLAY=${DISPLAY}; VF=""; ${crop}
ffmpeg -y -v error -f x11grab -video_size 1024x768 -i ${DISPLAY} -frames:v 1 $VF ${remote}`, { echo: false });
  if (code !== 0) throw new Error(`Capture échouée : ${out}`);
  const local = path.join(SHOTS_DIR, `${stamp()}-${label}.png`);
  await download(client, remote, local);
  await run(client, `rm -f ${remote}`, { echo: false });
  console.log(`Capture : ${local}`);
  return local;
}

async function nativeShot(client) {
  const remote = `/tmp/centraliz-native-${process.pid}.png`;
  const { out } = await run(client, `curl -s -m 5 -X POST '${API}/core/screenshot?path=${remote}' -o /dev/null -w '%{http_code}'; sleep 0.3; test -s ${remote} && echo ' fichier-ok'`, { echo: false });
  if (!out.includes('fichier-ok')) throw new Error(`mGBA-http n'a pas produit de capture (réponse : ${out.trim() || 'aucune'})`);
  const local = path.join(SHOTS_DIR, `${stamp()}-native.png`);
  await download(client, remote, local);
  await run(client, `rm -f ${remote}`, { echo: false });
  console.log(`Capture native : ${local}`);
  return local;
}

async function press(client, buttons) {
  for (const raw of buttons) {
    const name = BUTTONS[raw.toUpperCase()];
    if (!name) throw new Error(`Bouton inconnu : ${raw}. Valeurs : ${Object.keys(BUTTONS).join(' ')}`);
    const { out } = await run(client, `curl -s -m 4 -X POST '${API}/mgba-http/button/tap?button=${name}' -o /dev/null -w '%{http_code}'`, { echo: false });
    console.log(`${raw.toUpperCase()} -> HTTP ${out.trim() || 'pas de réponse'}`);
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1500));
  return nativeShot(client);
}

async function logs(client, lines = 40) {
  await run(client, `echo '== mgba-http.log'; tail -n ${lines} ${GAME_DIR}/logs/mgba-http.log | sed 's/\\x1b\\[[0-9;]*m//g'
echo; echo '== journal centraliz-gba'; journalctl -u centraliz-gba.service -n ${lines} --no-pager 2>&1 | tail -n ${lines}`);
}

async function restart(client) {
  console.log('Redémarrage de centraliz-gba.service…');
  const { code, out } = await run(client, 'systemctl restart centraliz-gba.service 2>&1; echo "exit=$?"', { timeoutMs: 180000 });
  if (!/exit=0/.test(out) || code !== 0) {
    throw new Error('systemctl restart refusé. Le compte n\'a peut-être pas le droit de piloter ce service : demander à l\'administrateur.');
  }
  await run(client, 'journalctl -u centraliz-gba.service --since "-3min" --no-pager 2>&1 | grep -E "start-game|healthcheck|OK|FAIL|ERROR" | tail -20');
  return status(client);
}

// Vérifie depuis l'extérieur (nginx + proxy HTTPS compris) que le flux SSE
// arrive au fil de l'eau : /api/pokemon/stream-test envoie 10 messages
// espacés de 250 ms. S'ils arrivent tous d'un coup, un proxy les retient.
async function streamCheck(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/pokemon/stream-test`;
  const started = Date.now();
  const response = await fetch(url, { headers: { Accept: 'text/event-stream' } });
  console.log(`${url} -> HTTP ${response.status} (${response.headers.get('content-type') || 'sans type'})`);
  if (!response.ok || !/event-stream/.test(response.headers.get('content-type') || '')) {
    console.log('FAIL  pas de flux SSE (route absente ou bloquée : backend déployé ?)');
    return 1;
  }
  const arrivals = [];
  const decoder = new TextDecoder();
  let text = '';
  for await (const chunk of response.body) {
    text += decoder.decode(chunk, { stream: true });
    const count = (text.match(/event: tick/g) || []).length;
    while (arrivals.length < count) arrivals.push(Date.now() - started);
  }
  console.log(`Arrivées (ms) : ${arrivals.join(', ')}`);
  const spread = arrivals.length ? arrivals[arrivals.length - 1] - arrivals[0] : 0;
  if (arrivals.length === 10 && spread >= 1800) {
    console.log('OK    les messages arrivent au fil de l\'eau : le flux passe sans être retenu');
    return 0;
  }
  console.log(`FAIL  ${arrivals.length}/10 messages, étalés sur ${spread} ms : un proxy retient le flux`);
  return 1;
}

async function main(argv = process.argv.slice(2)) {
  const [command = 'status', ...args] = argv;
  if (['-h', '--help', 'help'].includes(command)) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  if (command === 'stream-check') {
    return streamCheck(args[0] || process.env.DEPLOY_BACKEND_URL || 'https://centraliz.it');
  }
  const client = await connect();
  try {
    switch (command) {
      case 'status': return await status(client);
      case 'screenshot': await screenshot(client, { full: args.includes('--full') }); return 0;
      case 'native': await nativeShot(client); return 0;
      case 'press': await press(client, args); return 0;
      case 'logs': await logs(client, Number(args[0]) || 40); return 0;
      case 'restart': return await restart(client);
      case 'exec': return (await run(client, args.join(' '))).code;
      case 'get': {
        const local = args[1] || path.join(SHOTS_DIR, path.posix.basename(args[0]));
        console.log(await download(client, args[0], local)); return 0;
      }
      case 'put': console.log(await upload(client, args[0], args[1])); return 0;
      default: throw new Error(`Commande inconnue : ${command} (voir --help)`);
    }
  } finally {
    client.end();
  }
}

if (require.main === module) {
  main().then((code) => process.exit(code || 0), (err) => { console.error(`Erreur : ${err.message}`); process.exit(1); });
}

module.exports = { connect, run, download, upload, screenshot, main };
