const fs = require('fs');
const path = require('path');

class FeedbackService {
  constructor() {
    this.filePath = path.join(__dirname, '../data/feedbacks.json');
    this.ensureFileExists();
  }

  ensureFileExists() {
    try {
      if (!fs.existsSync(path.dirname(this.filePath))) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      }
      
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
      } else {
        // Vérifie si le fichier est vide ou mal formaté
        const content = fs.readFileSync(this.filePath, 'utf8');
        if (!content.trim()) {
          fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
        } else {
          try {
            JSON.parse(content);
          } catch (e) {
            // Si le JSON est invalide, réinitialise le fichier
            fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), 'utf8');
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du fichier:', error);
      throw new Error('Impossible d\'initialiser le stockage des feedbacks');
    }
  }

  getFeedbacks() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erreur lors de la lecture des feedbacks:', error);
      return [];
    }
  }

  addFeedback(username, text) {
    try {
      const feedbacks = this.getFeedbacks();
      const newFeedback = {
        id: Date.now(),
        username,
        text,
        timestamp: new Date().toISOString()
      };

      feedbacks.push(newFeedback);
      fs.writeFileSync(this.filePath, JSON.stringify(feedbacks, null, 2), 'utf8');
      return newFeedback;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du feedback:', error);
      throw new Error('Impossible d\'ajouter le feedback');
    }
  }
}

module.exports = new FeedbackService();