const fs = require("fs");
const path = require("path");
const puppeteer = require("../utils/puppeteer");

exports.downloadCSV = async (req, res) => {
  const username = req.session.user.userName;
  const { password } = req.body;

  try {
    const csvPath = await puppeteer.downloadCSV(username, password);

    // Incrémenter le compteur de téléchargements pour cet utilisateur
    const usersFilePath = path.resolve(__dirname, "../data/users.json");
    const users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));

    if (users[username]) {
      // Initialiser le compteur s'il n'existe pas
      if (!users[username].hasOwnProperty("notesCount")) {
        users[username].notesCount = 0;
      }

      // Incrémenter le compteur
      users[username].notesCount += 1;

      // Enregistrer les modifications
      fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf8");
      console.log(
        `Compteur de téléchargement incrémenté pour ${username}: ${users[username].notesCount}`
      );
    }

    res.json({ success: true, filePath: csvPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCSVData = (req, res) => {
  const csvPath = req.query.path;

  if (!csvPath) {
    return res.status(400).json({ error: "Chemin du CSV non fourni" });
  }

  fs.readFile(csvPath, "utf8", (err, data) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Erreur lors de la lecture du fichier CSV" });
    }
    res.send(data);
  });
};
