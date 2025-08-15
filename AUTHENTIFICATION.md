# Analyse du système d'authentification actuel

Ce document décrit le fonctionnement de l'authentification basée sur le CAS de l'application Centraliz.

## Acteurs

*   **Frontend** : L'application React qui s'exécute dans le navigateur de l'utilisateur.
*   **Backend** : Le serveur Node.js/Express qui gère la logique métier.
*   **CAS (Central Authentication Service)** : Le service d'authentification externe de Centrale Lille.
*   **Supabase** : Notre base de données, qui stockera les utilisateurs et les jetons de connexion persistante.

## Flux d'authentification initial (sans "Se souvenir de moi")

```mermaid
sequenceDiagram
    participant Utilisateur
    participant Frontend
    participant Backend
    participant CAS

    Utilisateur->>Frontend: Accède à l'application
    Frontend->>Backend: /api/auth/status (vérifie la session)
    Backend-->>Frontend: { authenticated: false }

    Note right of Frontend: Affiche la page de connexion

    Utilisateur->>Frontend: Clique sur "Se connecter"
    Frontend->>Backend: Redirection vers /api/auth/login
    Backend->>CAS: Redirection vers la page de login du CAS

    Utilisateur->>CAS: Saisit ses identifiants
    CAS-->>Backend: Redirection vers /api/auth/callback?ticket=...

    Backend->>CAS: /p3/serviceValidate (valide le ticket)
    CAS-->>Backend: XML avec les informations utilisateur

    Note right of Backend: Crée une session utilisateur (express-session)

    Backend-->>Frontend: Redirection vers la page d'accueil

    Frontend->>Backend: /api/auth/status
    Backend-->>Frontend: { authenticated: true, user: {...} }

    Note right of Frontend: Affiche l'application principale
```

---

## Nouvelle Architecture : Connexion persistante avec Token

Pour répondre au besoin de reconnexion automatique, nous avons implémenté un système de jeton (token) persistant.

### Principes

1.  **Jeton de Souvenir** : Si l'utilisateur coche "Se souvenir de moi", le backend génère un jeton unique et sécurisé.
2.  **Stockage du Jeton** :
    *   Ce jeton est stocké dans un cookie `httpOnly` sur le navigateur de l'utilisateur, avec une longue durée de vie (ex: 30 jours).
    *   Une empreinte (hash) de ce jeton est stockée en base de données (Supabase), associée à l'utilisateur.
3.  **Reconnexion Automatique** :
    *   Au chargement de l'application, si l'utilisateur n'a pas de session active, le frontend vérifie la présence du cookie "souvenir".
    *   Si le cookie existe, le backend l'utilise pour retrouver l'utilisateur, valider le jeton, et créer une nouvelle session.

### Nouveau flux détaillé

```mermaid
sequenceDiagram
    participant Utilisateur
    participant Frontend
    participant Backend
    participant Supabase

    %% === Scénario 1 : Connexion avec "Se souvenir de moi" ===
    Utilisateur->>Frontend: Coche "Se souvenir de moi" et se connecte via CAS
    Frontend->>Backend: /api/auth/callback (après retour du CAS)

    Note right of Backend: L'utilisateur est authentifié par le CAS

    Backend->>Backend: Génère un token unique et sécurisé
    Backend->>Supabase: Stocke le hash du token pour l'utilisateur
    Supabase-->>Backend: Confirmation

    Note right of Backend: Crée la session (cookie de session)
    Note right of Backend: Crée le cookie "rememberMe" (longue durée)

    Backend-->>Frontend: Redirige vers l'application

    %% === Scénario 2 : Visite suivante (reconnexion auto) ===
    Utilisateur->>Frontend: Ouvre l'application (pas de session active)
    Frontend->>Backend: /api/auth/status

    Note right of Backend: Le cookie "rememberMe" est présent

    Backend->>Supabase: Trouve l'utilisateur via le hash du token
    Supabase-->>Backend: Informations de l'utilisateur

    Note right of Backend: Le token est valide
    Note right of Backend: Crée une nouvelle session

    Backend-->>Frontend: { authenticated: true, user: {...} }
    Note right of Frontend: Affiche l'application directement
```

### Implémentation

#### 1. Base de Données (Supabase)

Table `remember_me_token` :

*   `id` (uuid, clé primaire)
*   `username` (text, clé étrangère vers `users.username`)
*   `token_hash` (text, unique)
*   `expires_at` (timestamp with time zone)
*   `created_at` (timestamp with time zone)

#### 2. Backend

*   **`backend/src/services/tokenService.js`**
    *   `generateToken(username)`: Crée et stocke un nouveau token.
    *   `validateToken(token)`: Valide un token et retourne l'utilisateur associé.
    *   `deleteToken(token)`: Supprime un token de la base de données.
*   **`backend/src/routes/auth.js`**
    *   `/api/auth/status` : Vérifie la session, puis le cookie `remember_me`. Si le cookie est valide, recrée la session.
    *   `/api/auth/login` : Stocke le choix "Se souvenir de moi" dans la session.
    *   `/api/auth/logout` : Supprime le token de la base de données et efface les cookies.
*   **`backend/src/services/casService.js`**
    *   Dans `callback`, si "Se souvenir de moi" est coché :
        1.  Génère un token sécurisé.
        2.  Stocke le hash du token dans la table `remember_me_token`.
        3.  Envoie le token brut dans un cookie `remember_me`.

#### 3. Frontend

*   **`frontend/src/components/LoginPage.js`**
    *   Case à cocher "Se souvenir de moi".
    *   Passe la valeur de la case à cocher à l'URL de connexion.
*   **`frontend/src/App.js`**
    *   La logique existante dans `useEffect` pour appeler `/api/auth/status` est déjà correcte. Si le backend recrée la session grâce au token, le frontend reçoit `authenticated: true` et affiche l'application.