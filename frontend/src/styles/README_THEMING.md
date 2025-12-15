# Système de Thématisation BDS

## Problème

Les variables SCSS (`$main`, `$green`, etc.) sont compilées au moment du build avec des valeurs fixes.
Les CSS variables (`var(--color-primary)`) permettent le changement dynamique au runtime.

## Solution Hybride

### Pour les fonctions SCSS (darken, lighten, etc.)

Utiliser les variables hex:

```scss
background: darken($main, 10%); // Utilise $main-hex compilé
```

### Pour les couleurs directes (sans fonction SCSS)

Utiliser les CSS variables:

```scss
color: var(--color-primary); // Changement dynamique
background: var(--color-primary); // Changement dynamique
border-color: var(--color-primary); // Changement dynamique
```

## Pattern de Migration

### Avant:

```scss
.button {
  background: $main;
  color: white;

  &:hover {
    background: darken($main, 10%);
  }
}
```

### Après:

```scss
.button {
  background: var(--color-primary); // CSS variable pour changement dynamique
  color: white;

  &:hover {
    background: darken($main, 10%); // Fonction SCSS garde $main
  }
}
```

## Variables Disponibles

### CSS Variables (Dynamiques)

- `var(--color-primary)` - Couleur principale
- `var(--color-primary-dark)` - Couleur principale foncée
- `var(--color-green)` - Vert
- `var(--color-orange)` - Orange
- `var(--color-red)` - Rouge

### SCSS Variables (Statiques, pour fonctions)

- `$main` / `$main-hex` - Pour darken/lighten
- `$green` / `$green-hex` - Pour darken/lighten
- etc.

## Convention de Nommage

- `$main-dynamic` = `var(--color-primary)` - Variable dynamique explicite
- `$main` = `$main-hex` - Variable statique pour SCSS
