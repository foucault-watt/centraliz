// backend/src/services/logService.js
const fs = require("fs");
const path = require("path");

class LogService {
  constructor() {
    this.logDirectory = path.join(__dirname, "../data");
    this.recentLogs = new Set();
    this.dedupeWindow = 100; // ms
    this.ensureLogDirectoryExists();
    this.setupConsoleOverride();
  }

  getLogFilePath() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const fileName = `backend-${day}-${month}-${year}.log`;
    return path.join(this.logDirectory, fileName);
  }

  ensureLogDirectoryExists() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
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
    const filePath = this.getLogFilePath();
    fs.appendFileSync(filePath, logEntry, "utf8");
  }

  logError(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ERROR: ${message}\n`;
    const filePath = this.getLogFilePath();
    fs.appendFileSync(filePath, logEntry, "utf8");
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
