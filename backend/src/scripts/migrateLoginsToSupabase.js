const supabase = require('../utils/supabaseClient');
const fs = require('fs');
const path = require('path');
const { addHours, formatISO } = require('date-fns');

const LOGINS_DATA_FILE = path.join(__dirname, '../data/logins.json');

async function migrateLogins() {
  console.log('Début de la migration des connexions...');

  // 1. Récupérer tous les utilisateurs (username et display_name) de la table public.users dans Supabase.
  console.log('Récupération des utilisateurs depuis Supabase...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('username, display_name');

  if (usersError) {
    console.error('Erreur lors de la récupération des utilisateurs:', usersError);
    return;
  }

  // 2. Construire un mapping display_name -> username en mémoire.
  const displayNameToUsername = {};
  users.forEach(user => {
    displayNameToUsername[user.display_name] = user.username;
  });
  console.log(`Mapping créé pour ${Object.keys(displayNameToUsername).length} utilisateurs.`);

  // 3. Lire le fichier logins.json
  console.log(`Lecture du fichier de connexions: ${LOGINS_DATA_FILE}`);
  let loginsData;
  try {
    loginsData = JSON.parse(fs.readFileSync(LOGINS_DATA_FILE, 'utf-8'));
  } catch (readError) {
    console.error(`Erreur lors de la lecture du fichier logins.json: ${readError.message}`);
    return;
  }

  const loginsToInsert = [];
  let processedEntries = 0;
  let skippedEntries = 0;

  console.log('Traitement des entrées de connexion...');
  for (const displayName in loginsData) {
    const username = displayNameToUsername[displayName];

    if (!username) {
      console.warn(`Avertissement: Nom d'affichage "${displayName}" non trouvé dans la base de données. Connexions ignorées.`);
      skippedEntries++;
      continue;
    }

    const loginTimes = loginsData[displayName];
    for (const loginTimeStr of loginTimes) {
      try {
        let originalDate = new Date(loginTimeStr);
        if (isNaN(originalDate.getTime())) {
          console.warn(`Avertissement: Date invalide "${loginTimeStr}" pour "${displayName}". Ignorée.`);
          continue;
        }

        // Ajouter 2 heures à l'horodatage
        const adjustedDate = addHours(originalDate, 2);
        const formattedLoginTime = formatISO(adjustedDate, { representation: 'complete' });

        loginsToInsert.push({
          username: username,
          login_time: formattedLoginTime,
        });
        processedEntries++;
      } catch (dateError) {
        console.error(`Erreur lors du traitement de la date "${loginTimeStr}" pour "${displayName}": ${dateError.message}`);
      }
    }
  }

  if (loginsToInsert.length === 0) {
    console.log('Aucune connexion à insérer après le traitement.');
    console.log(`Bilan: ${skippedEntries} entrées ignorées (noms d'affichage non trouvés ou dates invalides).`);
    return;
  }

  console.log(`Insertion de ${loginsToInsert.length} connexions dans la table user_logins...`);
  const { data, error } = await supabase
    .from('user_logins')
    .insert(loginsToInsert);

  if (error) {
    console.error('Erreur lors de la migration des connexions:', error);
  } else {
    console.log('Connexions migrées avec succès.');
    console.log(`Bilan: ${loginsToInsert.length} connexions insérées.`);
    console.log(`Bilan: ${skippedEntries} entrées ignorées (noms d'affichage non trouvés ou dates invalides).`);
  }
}

migrateLogins().then(() => process.exit(0));