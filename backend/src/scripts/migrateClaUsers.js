// backend/src/scripts/migrateClaUsers.js
const supabase = require('../utils/supabaseClient');
const { mappings } = require('./user_mapping_data');

async function mapUsers() {
  console.log("Démarrage du script de mapping des utilisateurs depuis le fichier de données...");

  if (!mappings || mappings.length === 0) {
    console.log("Le fichier user_mapping_data.js est vide ou ne contient pas de mappings. Aucune action requise.");
    return;
  }

  // Récupérer les utilisateurs déjà mappés pour ne pas les insérer en double
  const { data: mappedUsers, error: mappedError } = await supabase
    .from('user_mapping')
    .select('cas_username');

  if (mappedError) {
    console.error("Erreur lors de la récupération des mappings existants:", mappedError);
    return;
  }

  const mappedUsernames = new Set(mappedUsers.map(u => u.cas_username));
  const newMappings = mappings.filter(m => !mappedUsernames.has(m.cas_username));

  if (newMappings.length === 0) {
    console.log("Tous les utilisateurs du fichier de données sont déjà mappés. Aucune action requise.");
    return;
  }

  console.log(`${newMappings.length} nouveau(x) mapping(s) à insérer.`);

  // Insérer les nouveaux mappings
  const { error: insertError } = await supabase
    .from('user_mapping')
    .insert(newMappings);

  if (insertError) {
    console.error("Erreur lors de l'insertion des nouveaux mappings:", insertError);
  } else {
    console.log(`✅ ${newMappings.length} nouveau(x) mapping(s) inséré(s) avec succès !`);
  }

  console.log("\nScript de mapping terminé.");
}

mapUsers().catch(console.error);