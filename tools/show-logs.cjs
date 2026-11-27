try { require('./session-log.cjs').showLatest(require('node:path').resolve(__dirname, '..'), process.argv[2]); }
catch { console.error('Journal introuvable. Utilisation : npm run logs -- go|rezo'); process.exitCode = 1; }
