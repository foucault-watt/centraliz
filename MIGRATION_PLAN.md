# Plan de Migration de l'Authentification

Ce document contient les étapes et les extraits de code nécessaires pour migrer l'authentification de CAS vers CLA.

## Phase 1 : Préparation de la Base de Données

### 1.1 & 1.2 : Script de Migration SQL

Créez un nouveau fichier de migration `backend/src/migrations/003_add_cla_migration_schema.sql` et copiez-y le contenu suivant :

```sql
-- Phase 1: Préparation de la base de données pour la migration vers l'authentification CLA

-- 1.1. Création de la table de mapping des utilisateurs
-- Cette table fera le lien entre l'ancien username (CAS) et le nouveau (CLA).
CREATE TABLE public.user_mapping (
  cas_username TEXT NOT NULL,
  cla_username TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  CONSTRAINT user_mapping_pkey PRIMARY KEY (cas_username),
  CONSTRAINT user_mapping_cla_username_key UNIQUE (cla_username),
  CONSTRAINT user_mapping_cas_username_fkey FOREIGN KEY (cas_username) REFERENCES public.users (username) ON DELETE CASCADE
);

-- 1.2. Ajout des colonnes first_name et last_name à la table users
-- Ces colonnes contiendront les informations de nom provenant de CLA.
ALTER TABLE public.users
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

```

### 1.3 : Script de Migration des Utilisateurs

Créez un nouveau fichier `backend/src/scripts/migrateClaUsers.js` et copiez-y le contenu suivant. Ce script vous permettra de mapper les anciens `username` (CAS) aux nouveaux (CLA) de manière interactive.

**Dépendances :** Vous aurez besoin d'installer `inquirer` pour que le script fonctionne. Exécutez `npm install inquirer` dans le répertoire `backend`.

```javascript
// backend/src/scripts/migrateClaUsers.js
const supabase = require('../utils/supabaseClient');
const inquirer = require('inquirer');

async function mapUsers() {
  console.log("Démarrage du script de mapping des utilisateurs...");

  // 1. Récupérer tous les utilisateurs actuels (CAS usernames)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('username');

  if (usersError) {
    console.error("Erreur lors de la récupération des utilisateurs:", usersError);
    return;
  }

  // 2. Récupérer les utilisateurs déjà mappés
  const { data: mappedUsers, error: mappedError } = await supabase
    .from('user_mapping')
    .select('cas_username');

  if (mappedError) {
    console.error("Erreur lors de la récupération des mappings existants:", mappedError);
    return;
  }

  const mappedUsernames = new Set(mappedUsers.map(u => u.cas_username));
  const usersToMap = users.filter(u => !mappedUsernames.has(u.username));

  if (usersToMap.length === 0) {
    console.log("Tous les utilisateurs sont déjà mappés. Aucune action requise.");
    return;
  }

  console.log(`${usersToMap.length} utilisateur(s) à mapper.`);

  // 3. Boucler sur les utilisateurs non mappés et demander les nouvelles infos
  for (const user of usersToMap) {
    console.log(`\n--- Mapping pour l'utilisateur : ${user.username} ---`);

    const answers = await inquirer.prompt([
      {
        name: 'cla_username',
        message: 'Entrez le nouveau username (CLA) (ex: prenom.nom):',
        validate: input => input ? true : 'Le username ne peut pas être vide.'
      },
      {
        name: 'first_name',
        message: 'Entrez le prénom:',
        validate: input => input ? true : 'Le prénom не peut pas être vide.'
      },
      {
        name: 'last_name',
        message: 'Entrez le nom de famille:',
        validate: input => input ? true : 'Le nom de famille ne peut pas être vide.'
      }
    ]);

    // 4. Insérer les nouvelles données dans la table de mapping
    const { error: insertError } = await supabase
      .from('user_mapping')
      .insert({
        cas_username: user.username,
        cla_username: answers.cla_username,
        first_name: answers.first_name,
        last_name: answers.last_name
      });

    if (insertError) {
      console.error(`Erreur lors de l'insertion du mapping pour ${user.username}:`, insertError);
      // Optionnel: décider si on arrête le script ou si on continue
    } else {
      console.log(`✅ Mapping pour ${user.username} enregistré avec succès !`);
    }
  }

  console.log("\nScript de mapping terminé.");
}

mapUsers().catch(console.error);
```

## Phase 2 : Adaptation du Backend

Cette phase consiste à modifier le code de l'application pour utiliser le nouveau système d'authentification CLA, tout en gérant la transition pour les utilisateurs existants.

### 2.1. Créer le service `claService.js`

Créez un nouveau fichier `backend/src/services/claService.js`. Ce service sera une adaptation de l'exemple de code que vous avez fourni, mais intégré à notre architecture Supabase.

```javascript
// backend/src/services/claService.js
const supabase = require('../utils/supabaseClient');
const tokenService = require('./tokenService');
const loginService = require('./loginService');

// Remplacez par vos variables d'environnement
const claAuthHost = process.env.CLA_AUTH_HOST;
const claAuthIdentifier = process.env.CLA_AUTH_IDENTIFIER;

exports.login = (req, res) => {
  const url = `${claAuthHost}/authentification/${claAuthIdentifier}`;
  res.redirect(url);
};

exports.callback = async (req, res) => {
  const { ticket } = req.query;
  if (!ticket) {
    return res.status(400).send("Erreur : ticket CLA manquant.");
  }

  try {
    // 1. Valider le ticket auprès de la plateforme CLA
    const validationUrl = `${claAuthHost}/authentification/${claAuthIdentifier}/${encodeURIComponent(ticket)}`;
    const response = await fetch(validationUrl, {
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json());

    if (!response || !response.success) {
      console.error("[CLA Service] La réponse du serveur d'authentification est invalide", response);
      return res.status(401).send("Échec de l'authentification CLA.");
    }

    const { username: cla_username, firstName, lastName } = response.payload;

    // 2. Chercher si un mapping existe pour cet utilisateur
    const { data: mapping, error: mappingError } = await supabase
      .from('user_mapping')
      .select('cas_username')
      .eq('cla_username', cla_username)
      .single();

    let final_username;

    if (mapping) {
      // L'utilisateur est déjà mappé, on utilise son ancien username (cas_username)
      final_username = mapping.cas_username;
      
      // On en profite pour mettre à jour son profil dans la table 'users'
      await supabase.from('users').update({
        first_name: firstName,
        last_name: lastName
      }).eq('username', final_username);

    } else {
      // Nouvel utilisateur ou utilisateur pas encore mappé.
      // On suppose que le cla_username peut être utilisé directement,
      // mais idéalement il faudrait le mapper à un ancien compte si possible.
      // Pour l'instant, on crée un nouvel utilisateur avec le cla_username.
      
      // ATTENTION : Cette partie crée un NOUVEL utilisateur.
      // Le script de migration manuel est là pour éviter ce cas.
      final_username = cla_username;
      
      const { data: newUser, error: newUserError } = await supabase
        .from('users')
        .upsert({
          username: final_username,
          display_name: `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName
        }, { onConflict: 'username' });

      if (newUserError) throw newUserError;
    }

    // 3. Récupérer l'utilisateur complet et créer la session
    const { data: user, error: fetchError } = await loginService.getUser(final_username);
    if (fetchError || !user) {
      throw new Error("Impossible de récupérer l'utilisateur après l'authentification CLA.");
    }

    req.session.user = {
      userName: user.username,
      displayName: user.display_name,
      icalLink: user.ical_link,
      is_admin: user.is_admin,
      is_bibli_admin: user.is_bibli_admin
    };
    
    // Gérer le "Remember Me"
    if (req.session.rememberMe) {
      const token = await tokenService.generateToken(user.username);
      if (token) {
        res.cookie('remember_me', token, {
          httpOnly: true,
          secure: process.env.SECURE === 'true',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }
    }

    await loginService.addLogin(user.username);
    res.redirect(process.env.URL_FRONT);

  } catch (error) {
    console.error("[CLA Service] Erreur lors du callback:", error);
    res.status(500).send("Erreur interne lors de l'authentification.");
  }
};
```

### 2.2. Modifier les routes d'authentification

Modifiez le fichier `backend/src/routes/auth.js` pour utiliser le nouveau service.

```javascript
// backend/src/routes/auth.js

// ... autres imports
const claService = require("../services/claService"); // Importer le nouveau service

// ... router.get("/status", ...) reste inchangé

// Modifiez la route /login pour pointer vers le service CLA
router.get("/login", (req, res, next) => {
  req.session.rememberMe = req.query.remember === 'true';
  claService.login(req, res, next); // <- CHANGEMENT ICI
});

// Modifiez la route /callback pour pointer vers le service CLA
router.get("/callback", claService.callback); // <- CHANGEMENT ICI

// ... router.post("/logout", ...) reste inchangé

module.exports = router;

```

## Phase 3 : Finalisation et Nettoyage

### 3.1. Mettre à jour les variables d'environnement

Assurez-vous que votre fichier `.env` contient les nouvelles variables pour le service CLA :

```
CLA_AUTH_HOST="https://votre-domaine-cla.fr"
CLA_AUTH_IDENTIFIER="votre-identifiant-cla"
```

### 3.2. Nettoyage (Post-migration)

Une fois que vous avez mappé tous les utilisateurs et que vous êtes certain que le nouveau système fonctionne correctement, vous pourrez :

1.  **Supprimer le fichier** `backend/src/services/casService.js`.
2.  **Supprimer la dépendance** à ce service dans `backend/src/routes/auth.js` si elle existe encore.
3.  (Optionnel) Archiver ou supprimer le script `migrateClaUsers.js`.

Ce plan d'action vous fournit tous les éléments pour réaliser la migration.
