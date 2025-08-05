const fs = require("fs");
const path = require("path");
const puppeteer = require("../utils/puppeteer");
const supabase = require('../utils/supabaseClient');

exports.downloadCSV = async (req, res) => {
  const username = req.session.user.userName;
  const { password } = req.body;

  try {
    const csvPath = await puppeteer.downloadCSV(username, password);

    // Incrémenter le compteur de téléchargements pour cet utilisateur dans Supabase
    const { data, error } = await supabase
      .from('users')
      .select('notes_count')
      .eq('username', username)
      .single();

    if (error) {
      console.error('Error fetching user notes count:', error);
    } else {
      const newCount = (data?.notes_count || 0) + 1;
      const { error: updateError } = await supabase
        .from('users')
        .update({ notes_count: newCount })
        .eq('username', username);

      if (updateError) {
        console.error('Error updating user notes count:', updateError);
      } else {
        console.log(`Compteur de téléchargement incrémenté pour ${username}: ${newCount}`);
      }
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
