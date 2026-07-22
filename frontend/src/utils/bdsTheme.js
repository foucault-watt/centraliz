// Configuration des couleurs par BDS
export const BDS_THEMES = {
  mads: {
    primary: "#f97316",
    "primary-dark": "#ea580c",
  },
  phoenix: {
    primary: "#e06710",
    "primary-dark": "#d45d08",
  },
  default: {
    primary: "#597ee5",
    "primary-dark": "#4267ce",
  },
};

// Applique le thème en modifiant les CSS variables
export const applyBDSTheme = (supportBds) => {
  console.log("[BDS Theme] Applying theme for:", supportBds);
  if (!supportBds) return;

  const theme = BDS_THEMES[supportBds] || BDS_THEMES.default;
  console.log("[BDS Theme] Theme found:", theme);

  // Appliquer aux CSS variables
  document.documentElement.style.setProperty("--color-primary", theme.primary);
  document.documentElement.style.setProperty(
    "--color-primary-dark",
    theme["primary-dark"]
  );
};

// Récupère le thème pour utilisation en JavaScript (utile pour tailwind)
export const getBDSTheme = (supportBds) => {
  return BDS_THEMES[supportBds] || BDS_THEMES.default;
};
