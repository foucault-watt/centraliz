const express = require("express");
const router = express.Router();
const supabase = require("../utils/supabaseClient");

router.get("/ranking/", async (req, res) => {
  const { userName } = req.session.user;

  try {
    const { data: leaderboardData, error } = await supabase.rpc('get_leaderboard');

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return res.status(500).json({ error: "Erreur lors de la récupération du classement" });
    }

    const userIndex = leaderboardData.findIndex(
      (user) => user.username === userName
    );

    if (userIndex === -1) {
      return res.status(404).json({ error: "Utilisateur non trouvé dans le classement" });
    }

    const userData = leaderboardData[userIndex];
    const userRank = userData.rank;
    const previousUser = leaderboardData.find(user => user.rank === userRank - 1);

    let message = "";
    if (userRank === 1) {
      message = "Bravo !\nVous êtes en tête du classement ! 🏆";
    } else if (previousUser) {
      message = `Top ${userRank}\nderrière ${previousUser.display_name}`;
    } else {
      message = `Top ${userRank}`;
    }

    res.json({
      rank: userRank,
      totalUsers: leaderboardData.length,
      previousUser: previousUser
        ? {
            name: previousUser.display_name,
            rank: previousUser.rank,
          }
        : null,
      userScore: userData.score,
      message: message,
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
