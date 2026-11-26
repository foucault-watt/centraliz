# Règles de design

Les règles à suivre pour qu'une page ressemble au reste de l'app.

## Structure d'une page

Toute page authentifiée passe par `PageLayout` (dans `App.jsx`) :

- **Header** (`Header.jsx`) collant en haut : menu, logo, pastille Réglages.
- **Navigation** :
  - mobile (< 1024 px) : barre flottante en bas (`Navigation.jsx`) + menu latéral (`SlideMenu.jsx`) ;
  - PC (≥ 1024 px) : rail fixe à gauche (`SideRail.jsx`) qui regroupe les pages de la navbar et les entrées du menu latéral. La barre du bas est masquée.
- **Contenu** dans `.app-main-inner` : largeur max 72rem, 84rem dès 1600 px, 96rem dès 2200 px. `fullWidth` retire la limite.

Les pages de la navigation se pilotent depuis l'admin (`/nav-pages/admin`) ; les entrées du menu latéral et du rail sont dans `config/slideMenuConfig.js`.

## Tailles

- La taille de base est fluide (`index.scss`) : 16 px jusqu'à 1600 px, puis elle grandit jusqu'à 20 px. Tout ce qui est en `rem` suit, donc **préférer les classes Tailwind et les `rem` aux `px`**.
- Mobile first : styles pour petit écran par défaut, puis `sm:`/`md:`/`lg:`/`xl:`.

## Composants communs

| Besoin | Composant |
|---|---|
| Haut de page (petite ligne, titre, sous-titre, actions) | `PageHeader` — `level={2}` pour un bloc intégré dans une autre page |
| Rien à afficher | `EmptyState` (icône, titre, texte, action) — `bare` dans un panneau existant |
| Chargement | `LoadingSkeleton` (lignes qui pulsent, `role="status"`) — pas de spinner rond plein écran |

Chaque page commence par un `PageHeader` posé sur le fond (pas dans une carte), toujours construit pareil :

- `icon` : l'icône de la page, la même que dans la navigation (tuile à la couleur de l'utilisateur) ;
- `title` : court (« Mails », « Calendriers ») ;
- `subtitle` : **seulement pour une info utile et vivante** (date de mise à jour des notes, nombre de mails). Pas de phrase qui décrit la page ;
- `kicker` : uniquement `"Admin"` pour les pages d'administration ;
- `actions` : boutons de la page, à droite (sous le titre sur mobile). Les cartes : `bg-white rounded-2xl border border-gray-200/80 shadow-sm`.

## Animations

- **Arrivée sur une page** : gérée une seule fois par `PageLayout` (`.app-page-enter`, fondu + légère montée). Ne pas ajouter d'animation d'entrée au niveau d'une page.
- Animations internes (listes, modales, feuilles mobiles) : framer-motion, courtes (≤ 0,35 s).
- Le réglage système « réduire les animations » est respecté : `MotionConfig reducedMotion="user"` dans `App.jsx` et `prefers-reduced-motion` en CSS.
- Éviter les `transform` qui restent appliqués sur un conteneur de page : ils décalent les éléments `position: fixed` (modales) à l'intérieur.

## Styles

- Nouveau code : Tailwind. Les couleurs viennent de `tailwind.config.js` (`primary`, `secondary`, …) ; `--color-primary` suit le thème de l'utilisateur.
- Le SCSS restant (`styles/`) couvre l'emploi du temps HP, le calendrier CLA, la connexion Zimbra, le contenu des mails (`.mail-content`) et le shell (`Main.scss`). Ne pas y ajouter de styles de page.
