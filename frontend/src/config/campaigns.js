export const campaignTypeOptions = [
  { value: "alert", label: "Avertissement" },
  { value: "announcement", label: "Annonce" },
  { value: "poll", label: "Sondage" },
  { value: "prompt", label: "Réponse texte" },
  { value: "stack", label: "Pile de contenus" },
];

export const campaignStatusOptions = [
  { value: "draft", label: "Brouillon" },
  { value: "active", label: "Active" },
  { value: "paused", label: "En pause" },
  { value: "archived", label: "Archivée" },
];

export const campaignPlacementOptions = [
  { value: "global", label: "Partout" },
  { value: "page-scoped", label: "Pages ciblées" },
];

export const campaignPresentationOptions = [
  { value: "modal", label: "Modale" },
  { value: "bottom-sheet", label: "Bottom sheet" },
  { value: "banner", label: "Bannière" },
  { value: "toast", label: "Toast" },
];

export const campaignDismissOptions = [
  { value: "dismissible", label: "Fermable" },
  { value: "persistent", label: "Non fermable" },
  { value: "hide-forever", label: "Masquable définitivement" },
];

export const campaignResponseOptions = [
  { value: "none", label: "Aucune réponse" },
  { value: "optional", label: "Réponse facultative" },
  { value: "required", label: "Réponse obligatoire" },
];

export const campaignFrequencyOptions = [
  { value: "once", label: "Une seule fois" },
  { value: "always", label: "À chaque visite" },
  { value: "until_dismissed", label: "Jusqu'au dismiss" },
  { value: "until_response", label: "Jusqu'à réponse" },
  { value: "until_end_date", label: "Jusqu'à la fin" },
  { value: "max_n_times", label: "Maximum N fois" },
];

export const campaignBlockOptions = [
  { value: "text", label: "Texte" },
  { value: "cta", label: "Bouton" },
  { value: "poll", label: "Sondage" },
  { value: "textarea", label: "Question texte" },
  { value: "event-highlight", label: "Mise en avant" },
];

export const campaignPageOptions = [
  { value: "/notes", label: "Notes" },
  { value: "/calendars", label: "Calendriers" },
  { value: "/communication", label: "Mails" },
  { value: "/links", label: "Liens" },
  { value: "/events", label: "Événements" },
  { value: "/events/admin", label: "Événements admin" },
  { value: "/feedback", label: "Feedback" },
  { value: "/help", label: "Aide" },
  { value: "/bibli", label: "Bibli" },
  { value: "/cekilui", label: "Cékilui" },
  { value: "/pokemon", label: "Pokémon" },
  { value: "/analytics/admin", label: "Analytics admin" },
];

export const createDefaultCampaignDraft = () => ({
  title: "",
  body: "",
  type: "alert",
  status: "draft",
  placement: "global",
  presentation: "modal",
  dismiss_mode: "dismissible",
  response_mode: "none",
  frequency_mode: "once",
  priority: 100,
  max_impressions: "",
  cooldown_minutes: 0,
  start_at: "",
  end_at: "",
  page_paths: [],
  groups: [],
  include_usernames: [],
  exclude_usernames: [],
  blocks: [
    {
      type: "text",
      payload: {
        text: "",
        tone: "default",
      },
    },
  ],
});
