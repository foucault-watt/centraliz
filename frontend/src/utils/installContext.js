// Détection de plateforme pour l'installation PWA, partagée entre HelpPage
// et la page Réglages. Chaque contexte fournit un texte adapté et,
// éventuellement, l'info que l'installation native (Android/Chrome) peut
// être déclenchée directement — voir installPrompt.js pour la capture de
// l'événement beforeinstallprompt.
export const getInstallContext = () => {
  const userAgent = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isChrome = /Chrome|CriOS/i.test(userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone;

  if (isStandalone) {
    return {
      kicker: "C'est prêt",
      title: "Centraliz est déjà installé",
      punchline: "Tu as déjà le raccourci le plus rapide. Nickel.",
      steps: ["Ouvre Centraliz depuis ton écran d'accueil ou ton dock."],
      cta: null,
      platform: "standalone",
    };
  }

  if (isIOS) {
    return {
      kicker: "iPhone",
      title: "Ajoute Centraliz à ton écran d'accueil",
      punchline: "Un geste, et Centraliz devient une app comme les autres.",
      steps: ["Appuie sur Partager.", "Choisis Sur l'écran d'accueil.", "Valide avec Ajouter."],
      cta: "Ça prend dix secondes.",
      platform: "ios",
    };
  }

  if (isAndroid && isChrome) {
    return {
      kicker: "Android",
      title: "Installe Centraliz en un clic",
      punchline: "Plus besoin de chercher le lien avant les cours.",
      steps: ["Appuie sur le menu ⋮.", "Choisis Installer l'application.", "Confirme."],
      cta: "Tu l'auras directement avec tes apps.",
      platform: "android-chrome",
    };
  }

  if (isAndroid) {
    return {
      kicker: "Android",
      title: "Ajoute Centraliz sur ton téléphone",
      punchline: "Le raccourci évite la chasse à l'onglet perdu.",
      steps: ["Ouvre le menu du navigateur.", "Cherche Ajouter à l'écran d'accueil.", "Confirme."],
      cta: "Chrome marche souvent le mieux pour ça.",
      platform: "android-other",
    };
  }

  if (isSafari) {
    return {
      kicker: "Mac",
      title: "Garde Centraliz sous la main",
      punchline: "Sur ordinateur, le favori est le raccourci le plus utile.",
      steps: ["Clique sur Partager.", "Ajoute Centraliz aux favoris.", "Place-le dans ta barre de favoris."],
      cta: "Simple, visible, efficace.",
      platform: "desktop-safari",
    };
  }

  return {
    kicker: "Ordinateur",
    title: "Mets Centraliz dans ta barre de favoris",
    punchline: "Sur PC, le meilleur réflexe c'est un favori bien visible.",
    steps: ["Appuie sur Ctrl + D.", "Renomme en Centraliz.", "Place-le dans la barre de favoris."],
    cta: "Un clic et tu y es.",
    platform: "desktop-other",
  };
};
