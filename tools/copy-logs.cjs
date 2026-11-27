const { spawn } = require('node:child_process');

function copyLogs(text, { platform = process.platform, spawnProcess = spawn } = {}) {
  if (platform !== 'win32') return Promise.reject(new Error('Copie automatique Windows uniquement : utiliser L ou le fichier journal.'));
  return new Promise((resolve, reject) => {
    // Fixed command only. Log text travels on stdin, never as PowerShell code.
    const child = spawnProcess('powershell.exe', ['-STA', '-NoProfile', '-NonInteractive', '-Command',
      '[Console]::InputEncoding = [System.Text.UTF8Encoding]::new(); Set-Clipboard -Value ([Console]::In.ReadToEnd())'],
    { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    child.once('error', () => reject(new Error('Copie impossible : utiliser le fichier journal.')));
    child.stdin.on('error', () => {});
    child.once('close', code => code === 0 ? resolve() : reject(new Error('Copie impossible : utiliser le fichier journal.')));
    child.stdin.end(text, 'utf8');
  });
}
module.exports = { copyLogs };
