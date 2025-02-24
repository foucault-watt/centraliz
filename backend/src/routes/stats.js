const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const QuickChart = require('quickchart-js'); // Importer QuickChart

router.get(`/stat`, async (req, res) => {
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

router.get(`/stats/${process.env.SECRET_API}/:userName`, async (req, res) => {
  console.log(`Route /stats/${process.env.SECRET_API}/${req.params.userName} appelée`);
  const { userName } = req.params;
  
  // Chemins des fichiers
  const loginsPath = path.join(__dirname, "../data/logins.json");
  const usersPath = path.join(__dirname, "../data/users.json");
  const mdpPath = path.join(__dirname, "../data/mdp.json");

  try {
    console.log('Lecture des fichiers JSON...');
    // Lecture des fichiers
    const loginsData = JSON.parse(fs.readFileSync(loginsPath, "utf8"));
    const usersData = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    const mdpData = JSON.parse(fs.readFileSync(mdpPath, "utf8"));

    // Vérifier si l'utilisateur existe dans users.json
    const userInfo = usersData[userName];
    if (!userInfo) {
      console.log('Utilisateur non trouvé');
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    console.log('Récupération des données de l\'utilisateur...');
    // Récupérer les données de l'utilisateur
    const hasMdp = mdpData.hasOwnProperty(userName);
    const { displayName, birthDate, group } = userInfo;

    console.log('Calcul des connexions globales par jour...');
    // Obtenir les connexions de tous les utilisateurs pour la courbe globale
    const globalLoginsPerDay = {};
    for (const user in loginsData) {
      loginsData[user].forEach((timestamp) => {
        const date = new Date(timestamp);
        const dateString = date.toISOString().split('T')[0];
        if (!globalLoginsPerDay[dateString]) {
          globalLoginsPerDay[dateString] = new Set();
        }
        globalLoginsPerDay[dateString].add(user);
      });
    }

    console.log('Calcul des connexions de l\'utilisateur spécifique...');
    // Obtenir les connexions de l'utilisateur spécifique
    const userLogins = loginsData[displayName] || [];
    const totalLogins = userLogins.length;
    const userLoginsPerDay = {};

    // Trouver la première et dernière date
    const dates = userLogins.map(timestamp => new Date(timestamp));
    const firstDate = new Date(Math.min(...dates));
    const lastDate = new Date();

    console.log('Création du tableau de dates...');
    // Créer un tableau de toutes les dates entre la première connexion et aujourd'hui
    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split('T')[0];
      userLoginsPerDay[dateString] = 0;
      if (!globalLoginsPerDay[dateString]) {
        globalLoginsPerDay[dateString] = new Set();
      }
    }

    console.log('Comptage des connexions par jour pour l\'utilisateur...');
    // Compter les connexions par jour pour l'utilisateur
    userLogins.forEach((timestamp) => {
      const date = new Date(timestamp);
      const dateString = date.toISOString().split('T')[0];
      userLoginsPerDay[dateString] = (userLoginsPerDay[dateString] || 0) + 1;
    });

    console.log('Préparation des données pour le graphique...');
    // Préparer les données pour le graphique
    const labels = Object.keys(userLoginsPerDay).sort();
    const userDataPoints = labels.map(date => userLoginsPerDay[date]);
    const globalDataPoints = labels.map(date => globalLoginsPerDay[date].size);

    console.log('Configuration du graphique...');
    // Configurer le graphique
    const chart = new QuickChart();
    chart.setConfig({
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Connexions de ' + displayName,
            data: userDataPoints,
            fill: true,
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(255, 99, 132, 1)',
            tension: 0.3
          },
          {
            label: 'Utilisateurs uniques par jour',
            data: globalDataPoints,
            fill: true,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: [
            'Statistiques de ' + displayName,
            'Total connexions: ' + totalLogins + ' | Mot de passe enregistré: ' + (hasMdp ? 'Oui' : 'Non'),
            'Date de naissance: ' + (birthDate || 'Non renseignée') + ' | Groupe: ' + (group || 'Non renseigné')
          ],
          fontSize: 16,
          fontStyle: 'bold',
          padding: 20,
          lineHeight: 1.2
        },
        scales: {
          xAxes: [{
            display: true,
            gridLines: {
              display: false
            },
            scaleLabel: {
              display: true,
              labelString: 'Date',
              fontStyle: 'bold'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }],
          yAxes: [{
            display: true,
            gridLines: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            scaleLabel: {
              display: true,
              labelString: 'Nombre de connexions',
              fontStyle: 'bold'
            },
            ticks: {
              beginAtZero: true
            }
          }]
        },
        legend: {
          position: 'top'
        }
      }
    });

    chart.setWidth(1000);
    chart.setHeight(500);
    chart.setBackgroundColor('white');

    console.log('Génération de l\'URL du graphique...');
    const imageUrl = await chart.getShortUrl();
    console.log('URL du graphique générée:', imageUrl);

    res.redirect(imageUrl);
    console.log('redirection vers l\'URL du graphique');

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: "Erreur lors du traitement des données" });
  }
});

module.exports = router;