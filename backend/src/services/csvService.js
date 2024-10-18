const fs = require('fs');
const path = require('path');
const puppeteer = require('../utils/puppeteer');

exports.downloadCSV = async (req, res) => {
    const { username, password } = req.body;
  
    try {
        const csvPath = await puppeteer.downloadCSV(username, password);
        res.json({ success: true, filePath: csvPath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getCSVData = (req, res) => {
    const csvPath = req.query.path;
  
    if (!csvPath) {
        return res.status(400).json({ error: 'Chemin du CSV non fourni' });
    }
  
    fs.readFile(csvPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la lecture du fichier CSV' });
        }
        res.send(data);
    });
};