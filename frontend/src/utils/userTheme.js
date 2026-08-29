// Thème de couleur d'accent personnelle, indépendant du thème BDS
// (frontend/src/utils/bdsTheme.js). Écrit les mêmes variables CSS
// (--color-primary / --color-primary-dark) mais applyBDSTheme reste
// prioritaire visuellement quand un support_bds est actif : voir l'ordre
// d'appel dans App.js.

const clamp = (value) => Math.min(255, Math.max(0, value));

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.substring(0, 2), 16),
    g: parseInt(normalized.substring(2, 4), 16),
    b: parseInt(normalized.substring(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel)).toString(16).padStart(2, "0"))
    .join("")}`;

export const darkenHex = (hex, amount = 0.15) => {
  if (!hex) return hex;
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - amount;
  return rgbToHex({ r: r * factor, g: g * factor, b: b * factor });
};

export const applyUserTheme = (themeColor, themeColorDark) => {
  if (!themeColor) return;

  const dark = themeColorDark || darkenHex(themeColor);

  document.documentElement.style.setProperty("--color-primary", themeColor);
  document.documentElement.style.setProperty("--color-primary-dark", dark);
};
