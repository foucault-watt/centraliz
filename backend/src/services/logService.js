// backend/src/services/logService.js
const fs = require("fs");
const path = require("path");

class LogService {
  constructor() {
    this.filePath = path.join(__dirname, "../data/backend.log");
    this.recentLogs = new Set();
    this.dedupeWindow = 100; // ms
    this.ensureFileExists();
    this.setupConsoleOverride();
  }

  ensureFileExists() {
    if (!fs.existsSync(path.dirname(this.filePath))) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", "utf8");
    }
  }

  isDuplicate(message) {
    if (this.recentLogs.has(message)) {
      return true;
    }
    this.recentLogs.add(message);
    setTimeout(() => {
      this.recentLogs.delete(message);
    }, this.dedupeWindow);
    return false;
  }

  log(message) {
    if (this.isDuplicate(message)) return;

    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${message}\n`;
    const currentContent = fs.readFileSync(this.filePath, 'utf8');
    fs.writeFileSync(this.filePath, logEntry + currentContent);
  }

  logError(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ERROR: ${message}\n`;
    const currentContent = fs.readFileSync(this.filePath, 'utf8');
    fs.writeFileSync(this.filePath, logEntry + currentContent);
  }

  setupConsoleOverride() {
    // Fonction de formatage alternative
    const formatMessage = (...args) => args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      } else {
        return String(arg);
      }
    }).join(' ');

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args) => {
      const message = formatMessage(...args);
      this.log(`LOG: ${message}`);
      originalConsole.log(...args);
    };

    console.warn = (...args) => {
      const message = formatMessage(...args);
      this.log(`WARN: ${message}`);
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      const message = formatMessage(...args);
      this.log(`ERROR: ${message}`);
      originalConsole.error(...args);
    };

    // Capture stdout/stderr
    const writeStream = fs.createWriteStream(this.filePath, { flags: "a" });
    process.stdout.write = process.stdout.write.bind(process.stdout);
    process.stderr.write = process.stderr.write.bind(process.stderr);

    const oldStdoutWrite = process.stdout.write;
    const oldStderrWrite = process.stderr.write;

    process.stdout.write = function (chunk, encoding, callback) {
      const currentContent = fs.readFileSync(logService.filePath, 'utf8');
      fs.writeFileSync(logService.filePath, chunk + currentContent);
      return oldStdoutWrite.apply(process.stdout, arguments);
    };

    process.stderr.write = function (chunk, encoding, callback) {
      const currentContent = fs.readFileSync(logService.filePath, 'utf8');
      fs.writeFileSync(logService.filePath, chunk + currentContent);
      return oldStderrWrite.apply(process.stderr, arguments);
    };
  }
}

// Instancier le service de log
const logService = new LogService();

// Ajouter les handlers pour les erreurs non gérées
process.on('uncaughtException', (err) => {
  logService.logError(`Uncaught Exception: ${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logService.logError(`Unhandled Rejection at: ${promise} reason: ${reason}`);
});

module.exports = logService;
