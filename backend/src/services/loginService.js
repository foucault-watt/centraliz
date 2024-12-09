const fs = require('fs');
const path = require('path');

class LoginService {
  constructor() {
    this.filePath = path.join(__dirname, '../data/logins.json');
    this.ensureFileExists();
  }

  ensureFileExists() {
    try {
      if (!fs.existsSync(path.dirname(this.filePath))) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2), 'utf8');
      } else {
        const content = fs.readFileSync(this.filePath, 'utf8');
        if (!content.trim()) {
          fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2), 'utf8');
        } else {
          try {
            JSON.parse(content);
          } catch (e) {
            fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2), 'utf8');
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du fichier de connexions:', error);
      throw new Error('Impossible d\'initialiser le stockage des connexions');
    }
  }

  addLogin(displayName) {
    // Ne pas enregistrer pour "Foucault Wattinne"
    if (displayName === "Foucault Wattinne") {
      return;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      const logins = data.trim() ? JSON.parse(data) : {};

      if (!logins[displayName]) {
        logins[displayName] = [];
      }

      logins[displayName].push(new Date().toISOString());

      fs.writeFileSync(this.filePath, JSON.stringify(logins, null, 2), 'utf8');
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la connexion:', error);
      throw new Error('Impossible d\'enregistrer la connexion');
    }
  }
}

module.exports = new LoginService();
