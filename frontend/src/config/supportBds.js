// Configuration per support BDS. Update colors, labels and logos here.
// Keys should match the `support_bds` value stored in Supabase.
export const SUPPORT_BDS_MAP = {
  mads: {
    displayName: "Madaga'Sport",
    badgeLabel: "Support BDS",
    accentColor: "#f97316",
    textColor: "#0f172a",
    overlayGradient:
      "linear-gradient(145deg, rgba(249,115,22,0.22) 0%, rgba(249,115,22,0.08) 45%, rgba(15,23,42,0.15) 100%)",
    glowColor: "rgba(249, 115, 22, 0.75)",
    footerBackground:
      "linear-gradient(120deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.9) 100%)",
    logoSrc: "/bds/liste_1.png",
  },
  // Default fallback used when a support_bds value exists but no config has been added yet.
  _default: {
    displayName: "ton BDS",
    badgeLabel: "Support BDS",
    accentColor: "#0ea5e9",
    textColor: "#0b1224",
    overlayGradient:
      "linear-gradient(140deg, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.05) 48%, rgba(15,23,42,0.16) 100%)",
    glowColor: "rgba(14, 165, 233, 0.65)",
    footerBackground:
      "linear-gradient(120deg, rgba(12,74,110,0.9) 0%, rgba(8,47,73,0.92) 100%)",
    logoSrc: "",
  },
};

export function getSupportBdsInfo(supportKey) {
  if (!supportKey) return null;
  const normalizedKey = supportKey.toLowerCase().trim();
  const config = SUPPORT_BDS_MAP[normalizedKey] || SUPPORT_BDS_MAP._default;
  return {
    key: normalizedKey,
    ...config,
  };
}
