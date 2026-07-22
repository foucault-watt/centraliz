// backend/src/scripts/user_mapping_data.js

// Remplissez ce tableau avec les correspondances entre les anciens et les nouveaux utilisateurs.
// Le script `migrateClaUsers.js` lira ce fichier et insérera les données dans la table `user_mapping`.

const mappings = [
  // {
  //   cas_username: "ancien_username_1", // ex: fwattinn
  //   cla_username: "nouveau.username.1", // ex: foucault.wattinne
  //   first_name: "Prénom1",
  //   last_name: "Nom1"
  // },
  // {
  //   cas_username: "ancien_username_2",
  //   cla_username: "nouveau.username.2",
  //   first_name: "Prénom2",
  //   last_name: "Nom2"
  // }
  {
    cas_username: "jderouba",
    cla_username: "jules.deroubaix",
    first_name: "Jules",
    last_name: "Deroubaix",
  },
];

module.exports = { mappings };
