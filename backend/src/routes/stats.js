const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const QuickChart = require('quickchart-js'); // Importer QuickChart

router.get(`/stats`, async (req, res) => {
  console.log('Route /stats appelée'); // Ajout du log
  const filePath = path.join(__dirname, "../data/logins.json");
  
  // Vérifier si le fichier existe
  if (!fs.existsSync(filePath)) {
    console.log(`Fichier non trouvé: ${filePath}`);
    return res.status(404).json({ error: "Fichier logins.json non trouvé" });
  }

  fs.readFile(filePath, "utf8", async (err, data) => {
    if (err) {
      console.log('Erreur de lecture du fichier:', err); // Ajout du log
      return res.status(500).json({ error: "Erreur lors de la lecture du fichier" });
    }

    try {
      const logins = JSON.parse(data);
      const loginsPerDay = {}; // Utiliser des Sets pour stocker les utilisateurs uniques par jour

      // Collecter les connexions par utilisateur et par jour
      for (const user in logins) {
        logins[user].forEach((timestamp) => {
          const date = new Date(timestamp);
          const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

          if (!loginsPerDay[dateString]) {
            loginsPerDay[dateString] = new Set();
          }
          loginsPerDay[dateString].add(user); // Ajouter l'utilisateur au Set pour ce jour
        });
      }

      // Convertir en tableau pour un affichage facile avec le nombre unique de connexions par jour
      const result = Object.keys(loginsPerDay).map((date) => ({
        date: date,
        count: loginsPerDay[date].size, // Nombre d'utilisateurs uniques
      }));

      // Trier les résultats par date croissante
      result.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Préparer les données pour le graphique
      const labels = result.map(item => item.date);
      const dataPoints = result.map(item => item.count);

      // Configurer le graphique avec QuickChart
      const chart = new QuickChart();
      chart.setConfig({
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Utilisateurs uniques connectés par jour',
            data: dataPoints,
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Statistiques de connexion quotidienne',
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: 20
            },
            legend: {
              position: 'top'
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                maxRotation: 45,
                minRotation: 45
              },
              title: {
                display: true,
                text: 'Date',
                font: {
                  weight: 'bold'
                }
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              title: {
                display: true,
                text: 'Nombre d\'utilisateurs',
                font: {
                  weight: 'bold'
                }
              },
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
      chart.setWidth(1000);
      chart.setHeight(500);
      chart.setBackgroundColor('white');

      const imageUrl = chart.getUrl();

      // Rediriger vers l'URL de l'image du graphique
      res.redirect(imageUrl);
    } catch (parseError) {
      console.log('Erreur de parsing JSON ou de génération du graphique:', parseError); // Ajout du log
      res.status(500).json({ error: "Erreur de traitement des données" });
    }
  });
});

module.exports = router;