# Règles de design

Ce document décrit les règles de design de base pour les pages de l'application.

## Template de base

Le template de base est composé des éléments suivants :

*   Un `div` principal qui englobe l'en-tête, la navigation et le contenu principal.
*   Un en-tête (`Header`) en haut de la page.
*   Une navigation (`Navigation`) en bas de la page.
*   Un contenu principal (`main`) qui occupe le reste de l'espace disponible.

## Approche "mobile first"

L'application adopte une approche "mobile first", où les styles sont définis pour les écrans de petite taille par défaut, puis adaptés pour les écrans plus grands à l'aide de media queries.

## Gestion de la barre de navigation

La barre de navigation est positionnée en bas de l'écran à l'aide de la classe `fixed bottom-5`, et un margin bottom de `mb-20` est ajouté au contenu principal pour éviter qu'il ne soit masqué par la barre de navigation.