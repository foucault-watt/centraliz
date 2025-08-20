const supabase = require('../utils/supabaseClient');

class FeedbackService {
  async addFeedback(username, text) {
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .insert([
          { username, text, state: 'waiting' }
        ])
        .select();

      if (error) {
        console.error('Erreur lors de l\'ajout du feedback à Supabase:', error);
        throw new Error('Impossible d\'ajouter le feedback');
      }
      return data[0];
    } catch (error) {
      console.error('Erreur lors de l\'ajout du feedback:', error);
      throw new Error('Impossible d\'ajouter le feedback');
    }
  }
}

module.exports = new FeedbackService();