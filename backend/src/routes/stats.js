const express = require("express");
const router = express.Router();
const QuickChart = require("quickchart-js");
const supabase = require("../utils/supabaseClient"); // Assurez-vous que le chemin est correct
const ZimbraService = require("../services/zimbraService");

router.get(`/stats`, async (req, res) => {
  console.log("Route /stats appelée");

  try {
    // Récupérer les utilisateurs depuis Supabase
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('username, display_name, group, birth_date');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
    }

    const users = usersData.reduce((acc, user) => {
      acc[user.username] = {
        displayName: user.display_name,
        group: user.group,
        birthDate: user.birth_date
      };
      return acc;
    }, {});

    // Récupérer les connexions depuis Supabase
    const { data: loginsData, error: loginsError } = await supabase
      .from('user_logins')
      .select('username, login_time');

    if (loginsError) {
      console.error('Error fetching logins:', loginsError);
      return res.status(500).json({ error: "Erreur lors de la récupération des connexions" });
    }

    // Obtenir les connexions par jour
    const userLoginsPerDay = {};
    let totalLogins = loginsData.length;

    // Trouver la première date de connexion
    let firstDate = new Date();
    if (loginsData.length > 0) {
      firstDate = new Date(
        Math.min(...loginsData.map((d) => new Date(d.login_time)))
      );
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
    loginsData.forEach((login) => {
      const date = new Date(login.login_time);
      const dateString = date.toISOString().split("T")[0];
      if (userLoginsPerDay[dateString]) {
        userLoginsPerDay[dateString].add(login.username);
      }
    });

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

  try {
    // Récupérer les informations de l'utilisateur depuis Supabase
    const { data: userInfo, error: userError } = await supabase
      .from('users')
      .select('username, display_name, group, birth_date')
      .eq('username', userName)
      .single();

    if (userError || !userInfo) {
      console.error('Error fetching user:', userError);
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Récupérer les connexions de l'utilisateur spécifique depuis Supabase
    const { data: userLoginsData, error: userLoginsError } = await supabase
      .from('user_logins')
      .select('login_time')
      .eq('username', userName);

    if (userLoginsError) {
      console.error('Error fetching user logins:', userLoginsError);
      return res.status(500).json({ error: "Erreur lors de la récupération des connexions de l'utilisateur" });
    }

    // Récupérer toutes les connexions pour la courbe globale
    const { data: allLoginsData, error: allLoginsError } = await supabase
      .from('user_logins')
      .select('username, login_time');

    if (allLoginsError) {
      console.error('Error fetching all logins:', allLoginsError);
      return res.status(500).json({ error: "Erreur lors de la récupération de toutes les connexions" });
    }

    const hasMdp = await ZimbraService.hasStoredPassword(userName); // Assurez-vous que ZimbraService est importé
    const { display_name: displayName, birth_date: birthDate, group } = userInfo;

    // Obtenir les connexions de tous les utilisateurs pour la courbe globale
    const globalLoginsPerDay = {};
    allLoginsData.forEach((login) => {
      const date = new Date(login.login_time);
      const dateString = date.toISOString().split("T")[0];
      if (!globalLoginsPerDay[dateString]) {
        globalLoginsPerDay[dateString] = new Set();
      }
      globalLoginsPerDay[dateString].add(login.username);
    });

    // Obtenir les connexions de l'utilisateur spécifique
    const userLogins = userLoginsData.map(login => login.login_time);
    const totalLogins = userLogins.length;
    const userLoginsPerDay = {};

    // Trouver la première et dernière date
    const dates = userLogins.map((timestamp) => new Date(timestamp));
    const firstDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
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
