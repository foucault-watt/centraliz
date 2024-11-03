// backend/src/services/logService.js
const fs = require('fs');
const path = require('path');
const util = require('util');

class LogService {
  constructor() {
    this.filePath = path.join(__dirname, '../data/backend.log');
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
      fs.writeFileSync(this.filePath, '', 'utf8');
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
    fs.appendFileSync(this.filePath, logEntry);
  }

  setupConsoleOverride() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    console.log = (...args) => {
      const message = util.format(...args);
      this.log(`LOG: ${message}`);
      originalConsole.log(...args);
    };

    console.warn = (...args) => {
      const message = util.format(...args);
      this.log(`WARN: ${message}`);
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      const message = util.format(...args);
      this.log(`ERROR: ${message}`);
      originalConsole.error(...args);
    };

    // Capture stdout/stderr
    const writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
    process.stdout.write = process.stdout.write.bind(process.stdout);
    process.stderr.write = process.stderr.write.bind(process.stderr);

    const oldStdoutWrite = process.stdout.write;
    const oldStderrWrite = process.stderr.write;

    process.stdout.write = function(chunk, encoding, callback) {
      writeStream.write(chunk);
      return oldStdoutWrite.apply(process.stdout, arguments);
    };

    process.stderr.write = function(chunk, encoding, callback) {
      writeStream.write(chunk);
      return oldStderrWrite.apply(process.stderr, arguments);
    };
  }
}

module.exports = new LogService();