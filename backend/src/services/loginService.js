const fs = require('fs');
const path = require('path');

class LoginService {
  constructor() {
    this.loginPath = path.join(__dirname, '../data/logins.json');
    this.leaderboardPath = path.join(__dirname, '../data/leaderboard.json');
    this.ensureFileExists();
  }

  ensureFileExists() {
    try {
      if (!fs.existsSync(path.dirname(this.loginPath))) {
        fs.mkdirSync(path.dirname(this.loginPath), { recursive: true });
      }

      if (!fs.existsSync(this.loginPath)) {
        fs.writeFileSync(this.loginPath, JSON.stringify({}, null, 2), 'utf8');
      } else {
        const content = fs.readFileSync(this.loginPath, 'utf8');
        if (!content.trim()) {
          fs.writeFileSync(this.loginPath, JSON.stringify({}, null, 2), 'utf8');
        } else {
          try {
            JSON.parse(content);
          } catch (e) {
            fs.writeFileSync(this.loginPath, JSON.stringify({}, null, 2), 'utf8');
          }
        }
      }

      if (!fs.existsSync(this.leaderboardPath)) {
        fs.writeFileSync(this.leaderboardPath, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du fichier de connexions:', error);
      throw new Error('Impossible d\'initialiser le stockage des connexions');
    }
  }

  updateLeaderboard() {
    const data = fs.readFileSync(this.loginPath, 'utf8');
    const logins = JSON.parse(data);
    
    const leaderboard = Object.entries(logins).map(([name, dates]) => {
      // Convertir les dates en jours uniques (YYYY-MM-DD)
      const uniqueDays = new Set(
        dates.map(date => date.split('T')[0])
      );
      
      return {
        name,
        score: uniqueDays.size
      };
    });

    // Trier par score décroissant
    leaderboard.sort((a, b) => b.score - a.score);
    
    fs.writeFileSync(this.leaderboardPath, JSON.stringify(leaderboard, null, 2), 'utf8');
  }

  addLogin(displayName) {
    
    // Ne pas enregistrer pour "Foucault Wattinne"
    if (displayName === "Foucault Wattinne") {
      return;
    }

    try {
      const data = fs.readFileSync(this.loginPath, 'utf8');
      const logins = data.trim() ? JSON.parse(data) : {};

      if (!logins[displayName]) {
        logins[displayName] = [];
      }

      logins[displayName].push(new Date().toISOString());

      fs.writeFileSync(this.loginPath, JSON.stringify(logins, null, 2), 'utf8');

      // Mettre à jour le classement
      this.updateLeaderboard();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la connexion:', error);
      throw new Error('Impossible d\'enregistrer la connexion');
    }
  }
}

module.exports = new LoginService();
