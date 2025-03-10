const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const QuickChart = require("quickchart-js");

router.get(`/stats`, async (req, res) => {
  console.log("Route /stats appelée");

  // Chemins des fichiers
  const loginsPath = path.join(__dirname, "../data/logins.json");
  const usersPath = path.join(__dirname, "../data/users.json");

  try {
    // Lecture des fichiers
    const loginsData = JSON.parse(fs.readFileSync(loginsPath, "utf8"));
    const usersData = JSON.parse(fs.readFileSync(usersPath, "utf8"));

    // Obtenir les connexions par jour
    const userLoginsPerDay = {};
    let totalLogins = 0;

    // Trouver la première date de connexion
    let firstDate = new Date();
    for (const user in loginsData) {
      if (loginsData[user].length > 0) {
        const userFirstLogin = new Date(
          Math.min(...loginsData[user].map((d) => new Date(d)))
        );
        if (userFirstLogin < firstDate) {
          firstDate = userFirstLogin;
        }
      }
    }

    // Créer un tableau de toutes les dates entre la première connexion et aujourd'hui
    const lastDate = new Date();
    for (
      let d = new Date(firstDate);
      d <= lastDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateString = d.toISOString().split("T")[0];
      userLoginsPerDay[dateString] = new Set();
    }

    // Compter les utilisateurs uniques par jour
    for (const user in loginsData) {
      totalLogins += loginsData[user].length;
      loginsData[user].forEach((timestamp) => {
        const date = new Date(timestamp);
        const dateString = date.toISOString().split("T")[0];
        if (userLoginsPerDay[dateString]) {
          userLoginsPerDay[dateString].add(user);
        }
      });
    }

    // Préparer les données pour le graphique
    const labels = Object.keys(userLoginsPerDay).sort();
    const dataPoints = labels.map((date) => userLoginsPerDay[date].size);
    const totalUsers = Object.keys(usersData).length;

    // Configurer le graphique
    const chart = new QuickChart();
    chart.setConfig({
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Utilisateurs uniques par jour",
            data: dataPoints,
            fill: true,
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "rgba(54, 162, 235, 1)",
            pointBorderColor: "#fff",
            pointHoverRadius: 6,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: [
            "Statistiques globales de connexion de Centraliz",
            `Total utilisateurs: ${totalUsers} | Total connexions: ${totalLogins}`,
            `Période: ${labels[0]} à ${labels[labels.length - 1]}`,
          ],
          fontSize: 16,
          fontStyle: "bold",
          padding: 20,
          lineHeight: 1.2,
        },
        scales: {
          xAxes: [
            {
              display: true,
              gridLines: {
                display: false,
              },
              scaleLabel: {
                display: true,
                labelString: "Date",
                fontStyle: "bold",
              },
              ticks: {
                maxRotation: 45,
                minRotation: 45,
              },
            },
          ],
          yAxes: [
            {
              display: true,
              gridLines: {
                color: "rgba(0, 0, 0, 0.1)",
              },
              scaleLabel: {
                display: true,
                labelString: "Nombre d'utilisateurs uniques",
                fontStyle: "bold",
              },
              ticks: {
                beginAtZero: true,
                stepSize: 1,
              },
            },
          ],
        },
        legend: {
          position: "top",
        },
      },
    });

    chart.setWidth(1000);
    chart.setHeight(500);
    chart.setBackgroundColor("white");

    const imageUrl = await chart.getShortUrl();
    console.log("URL du graphique générée:", imageUrl);

    res.redirect(imageUrl);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ error: "Erreur lors du traitement des données" });
  }
});

router.get(`/stats/${process.env.SECRET_API}/:userName`, async (req, res) => {
  const { userName } = req.params;

  // Chemins des fichiers
  const loginsPath = path.join(__dirname, "../data/logins.json");
  const usersPath = path.join(__dirname, "../data/users.json");
  const mdpPath = path.join(__dirname, "../data/mdp.json");

  try {
    // Lecture des fichiers
    const loginsData = JSON.parse(fs.readFileSync(loginsPath, "utf8"));
    const usersData = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    const mdpData = JSON.parse(fs.readFileSync(mdpPath, "utf8"));

    // Vérifier si l'utilisateur existe dans users.json
    const userInfo = usersData[userName];
    if (!userInfo) {
      console.log("Utilisateur non trouvé");
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Récupérer les données de l'utilisateur
    const hasMdp = mdpData.hasOwnProperty(userName);
    const { displayName, birthDate, group } = userInfo;

    // Obtenir les connexions de tous les utilisateurs pour la courbe globale
    const globalLoginsPerDay = {};
    for (const user in loginsData) {
      loginsData[user].forEach((timestamp) => {
        const date = new Date(timestamp);
        const dateString = date.toISOString().split("T")[0];
        if (!globalLoginsPerDay[dateString]) {
          globalLoginsPerDay[dateString] = new Set();
        }
        globalLoginsPerDay[dateString].add(user);
      });
    }

    // Obtenir les connexions de l'utilisateur spécifique
    const userLogins = loginsData[displayName] || [];
    const totalLogins = userLogins.length;
    const userLoginsPerDay = {};

    // Trouver la première et dernière date
    const dates = userLogins.map((timestamp) => new Date(timestamp));
    const firstDate = new Date(Math.min(...dates));
    const lastDate = new Date();

    // Créer un tableau de toutes les dates entre la première connexion et aujourd'hui
    for (
      let d = new Date(firstDate);
      d <= lastDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateString = d.toISOString().split("T")[0];
      userLoginsPerDay[dateString] = 0;
      if (!globalLoginsPerDay[dateString]) {
        globalLoginsPerDay[dateString] = new Set();
      }
    }

    // Compter les connexions par jour pour l'utilisateur
    userLogins.forEach((timestamp) => {
      const date = new Date(timestamp);
      const dateString = date.toISOString().split("T")[0];
      userLoginsPerDay[dateString] = (userLoginsPerDay[dateString] || 0) + 1;
    });

    // Préparer les données pour le graphique
    const labels = Object.keys(userLoginsPerDay).sort();
    const userDataPoints = labels.map((date) => userLoginsPerDay[date]);
    const globalDataPoints = labels.map(
      (date) => globalLoginsPerDay[date].size
    );

    // Configurer le graphique
    const chart = new QuickChart();
    chart.setConfig({
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Connexions de " + displayName,
            data: userDataPoints,
            fill: true,
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "rgba(255, 99, 132, 1)",
            tension: 0.3,
          },
          {
            label: "Utilisateurs uniques par jour",
            data: globalDataPoints,
            fill: true,
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "rgba(54, 162, 235, 1)",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: [
            "Statistiques de " + displayName,
            "Total connexions: " +
              totalLogins +
              " | Mot de passe enregistré: " +
              (hasMdp ? "Oui" : "Non"),
            "Date de naissance: " +
              (birthDate || "Non renseignée") +
              " | Groupe: " +
              (group || "Non renseigné"),
          ],
          fontSize: 16,
          fontStyle: "bold",
          padding: 20,
          lineHeight: 1.2,
        },
        scales: {
          xAxes: [
            {
              display: true,
              gridLines: {
                display: false,
              },
              scaleLabel: {
                display: true,
                labelString: "Date",
                fontStyle: "bold",
              },
              ticks: {
                maxRotation: 45,
                minRotation: 45,
              },
            },
          ],
          yAxes: [
            {
              display: true,
              gridLines: {
                color: "rgba(0, 0, 0, 0.1)",
              },
              scaleLabel: {
                display: true,
                labelString: "Nombre de connexions",
                fontStyle: "bold",
              },
              ticks: {
                beginAtZero: true,
              },
            },
          ],
        },
        legend: {
          position: "top",
        },
      },
    });

    chart.setWidth(1000);
    chart.setHeight(500);
    chart.setBackgroundColor("white");

    const imageUrl = await chart.getShortUrl();
    console.log("URL du graphique générée:", imageUrl);

    res.redirect(imageUrl);
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({ error: "Erreur lors du traitement des données" });
  }
});

module.exports = router;
