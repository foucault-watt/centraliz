// Sélecteur pur : calcule l'état de configuration d'un utilisateur (étapes
// faites, onglets à débloquer, couleur active) sans jamais faire d'appel
// réseau ni toucher au DOM. Toute la donnée nécessaire doit déjà être sur
// l'objet `user` renvoyé par /api/auth/status.
import { getBDSTheme } from "./bdsTheme";

const STEPS = [
  { key: "login", label: "Se connecter", done: () => true },
  {
    key: "mailPassword",
    label: "Mot de passe mail configuré",
    done: (user) => Boolean(user.has_mail_password),
  },
  {
    key: "schedule",
    label: "Emploi du temps ajouté",
    done: (user) => Boolean(user.icalLink),
  },
  {
    key: "mailRead",
    label: "Mails lus",
    done: (user) => Boolean(user.has_read_mail),
  },
  {
    key: "linksUsed",
    label: "Liens utilisés",
    done: (user) => Boolean(user.has_used_links),
  },
  {
    key: "calendarViewed",
    label: "Détail d'un événement vu sur le calendrier",
    done: (user) => Boolean(user.has_viewed_calendar_event),
  },
  {
    key: "cekiPlayed",
    label: "Partie jouée au jeu des photos",
    done: (user) => Boolean(user.has_played_ceki_round),
  },
  {
    key: "cekiPhoto",
    label: "Photo ajoutée au jeu des photos",
    done: (user) => Boolean(user.has_cekilui_photo),
  },
];

const getActiveColor = (user) => {
  if (user.support_bds) {
    const theme = getBDSTheme(user.support_bds);
    return { source: "bds", primary: theme.primary, dark: theme["primary-dark"] };
  }
  if (user.theme_color) {
    return {
      source: "personal",
      primary: user.theme_color,
      dark: user.theme_color_dark || null,
    };
  }
  return null;
};

export const getSetupStatus = (user) => {
  const safeUser = user || {};

  const steps = STEPS.map(({ key, label, done }) => ({
    key,
    label,
    done: done(safeUser),
  }));

  const completedCount = steps.filter((step) => step.done).length;
  const totalCount = steps.length;

  return {
    steps,
    completedCount,
    totalCount,
    isComplete: completedCount === totalCount,
    unlockedTabs: safeUser.has_mail_password ? ["notes", "communication"] : [],
    activeColor: getActiveColor(safeUser),
  };
};
