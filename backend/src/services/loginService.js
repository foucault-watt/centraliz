const supabase = require('../utils/supabaseClient');

class LoginService {
  constructor() {}

  async updateLeaderboard() {
    try {
      // Supprimer toutes les entrées existantes dans public.leaderboard
      const { error: deleteError } = await supabase
        .from('leaderboard')
        .delete()
        .neq('username', 'null'); // Supprime tout sauf si username est null (condition toujours vraie pour delete all)

      if (deleteError) {
        console.error('Erreur lors de la suppression du classement existant:', deleteError);
        throw new Error('Impossible de supprimer le classement existant');
      }

      // Récupérer toutes les connexions de public.user_logins
      const { data: loginsData, error: fetchError } = await supabase
        .from('user_logins')
        .select('username, login_time');

      if (fetchError) {
        console.error('Erreur lors de la récupération des connexions:', fetchError);
        throw new Error('Impossible de récupérer les connexions');
      }

      const userLogins = {};
      loginsData.forEach(login => {
        if (!userLogins[login.username]) {
          userLogins[login.username] = [];
        }
        userLogins[login.username].push(login.login_time);
      });

      const leaderboard = Object.entries(userLogins).map(([username, dates]) => {
        const uniqueDays = new Set(
          dates.map(date => new Date(date).toISOString().split('T')[0])
        );
        return {
          username,
          score: uniqueDays.size
        };
      });

      leaderboard.sort((a, b) => b.score - a.score);

      // Insérer les nouveaux scores dans public.leaderboard
      const { error: insertError } = await supabase
        .from('leaderboard')
        .insert(leaderboard);

      if (insertError) {
        console.error('Erreur lors de l\'insertion du nouveau classement:', insertError);
        throw new Error('Impossible d\'insérer le nouveau classement');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du classement:', error);
      throw new Error('Impossible de mettre à jour le classement');
    }
  }

  async addLogin(username) {

    try {
      const { error } = await supabase
        .from('user_logins')
        .insert([
          { username: username, login_time: new Date().toISOString() }
        ]);

      if (error) {
        console.error('Erreur lors de l\'enregistrement de la connexion:', error);
        throw new Error('Impossible d\'enregistrer la connexion');
      }

      // Mettre à jour le classement
      await this.updateLeaderboard();
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la connexion:', error);
      throw new Error('Impossible d\'enregistrer la connexion');
    }
  }

  async getUser(username) {
    return supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
  }
}

module.exports = new LoginService();
