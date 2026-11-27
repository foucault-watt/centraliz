const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { pipeline } = require("node:stream/promises");
const { randomUUID } = require("node:crypto");

function formatBytes(bytes) {
  const units = ["o", "Ko", "Mo", "Go"];
  let unit = 0;
  while (bytes >= 1000 && unit < units.length - 1) { bytes /= 1000; unit++; }
  return `${bytes.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

async function uploadWithProgress({ sftp, localDir, remoteDir, files, onProgress, intervalMs = 500, atomic = false }) {
  const entries = files.map(file => ({
    file, size: fs.statSync(file).size,
    relative: path.relative(localDir, file).split(path.sep).join("/"),
  }));
  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  for (const entry of entries) {
    if (!entry.relative || entry.relative.split('/').includes('..') || path.isAbsolute(entry.relative)) throw new Error('Fichier hors du dossier de transfert');
  }
  const active = new Map();
  const abort = new AbortController();
  const started = performance.now();
  let completedBytes = 0, uploadedFiles = 0, next = 0;
  let sampleTime = started, sampleBytes = 0, speed = 0;
  function report(final = false) {
    // ssh2 increments bytesWritten only after the SFTP write is acknowledged.
    const uploadedBytes = completedBytes + [...active.values()].reduce(
      (sum, entry) => sum + Math.min(entry.size, entry.stream.bytesWritten || 0), 0,
    );
    const now = performance.now();
    if (now - sampleTime >= intervalMs || final) {
      speed = final
        ? uploadedBytes * 1000 / Math.max(now - started, 1)
        : (uploadedBytes - sampleBytes) * 1000 / Math.max(now - sampleTime, 1);
      sampleBytes = uploadedBytes;
      sampleTime = now;
    }
    onProgress({
      uploadedBytes, totalBytes, uploadedFiles, totalFiles: entries.length,
      bytesPerSecond: speed,
      file: [...active.values()].map(entry => entry.relative).join(", ") || (final ? "Terminé" : "Préparation…"),
    });
  }
  const timer = setInterval(report, intervalMs);
  let workers = [];
  try {
    report();
    const directories = new Set(entries.map(entry => path.posix.dirname(path.posix.join(remoteDir, entry.relative))));
    for (const directory of directories) await sftp.mkdir(directory, true);
    async function worker() {
      while (next < entries.length && !abort.signal.aborted) {
        const entry = entries[next++];
        const destination = path.posix.join(remoteDir, entry.relative);
        const temporary = atomic ? path.posix.join(path.posix.dirname(destination), `.centraliz-upload-${randomUUID()}`) : destination;
        const stream = sftp.createWriteStream(temporary, { autoClose: true });
        active.set(entry.file, { ...entry, stream });
        report();
        try {
          await pipeline(fs.createReadStream(entry.file), stream, { signal: abort.signal });
          if (atomic) await sftp.posixRename(temporary, destination);
        } catch (error) {
          if (atomic) { try { await sftp.delete(temporary); } catch {} }
          throw error;
        }
        completedBytes += entry.size;
        uploadedFiles++;
        active.delete(entry.file);
        report();
      }
    }
    // Match uploadDir's default limit of ten concurrent file transfers.
    workers = Array.from({ length: Math.min(10, entries.length) }, worker);
    await Promise.all(workers);
    report(true);
  } catch (error) {
    abort.abort();
    await Promise.allSettled(workers);
    throw error;
  } finally {
    clearInterval(timer);
  }
}

module.exports = { uploadWithProgress, formatBytes };
