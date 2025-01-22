const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/ranking/", (req, res) => {
  const username = req.session.user.displayName;
  console.log(username);

  try {
    const leaderboardPath = path.join(__dirname, "../data/leaderboard.json");
    const leaderboardData = JSON.parse(
      fs.readFileSync(leaderboardPath, "utf8")
    );

    const userIndex = leaderboardData.findIndex(
      (user) => user.name === username
    );

    if (userIndex === -1) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const userRank = userIndex + 1;
    const previousUser = userIndex > 0 ? leaderboardData[userIndex - 1] : null;
    const userData = leaderboardData[userIndex];

    let message = "";
    if (userRank === 1) {
      message = "Bravo !\nVous êtes en tête du classement ! 🏆";
    } else {
      message = `Top ${userRank}\nderrière ${previousUser.name}`;
    }

    res.json({
      rank: userRank,
      totalUsers: leaderboardData.length,
      previousUser: previousUser
        ? {
            name: previousUser.name,
            rank: userIndex,
          }
        : null,
      userScore: userData.score,
      message: message,
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
