const supabase = require("../utils/supabaseClient");
const analyticsService = require("./analyticsService");

const REQUIRED_BEHAVIORAL_STEP_COUNT = 4; // mailRead, linksUsed, calendarViewed, cekiPlayed
const EVENTS_FETCH_BATCH_SIZE = 1000;

// Récupère, par lots, tous les événements analytics correspondant aux étapes
// de configuration comportementales (filtrés par nom dès la requête : pas
// besoin de ramener l'historique analytics complet de tout le monde).
async function fetchStepEvents() {
  const events = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + EVENTS_FETCH_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("analytics_events")
      .select("user_username, event_name, module")
      .in("event_name", analyticsService.STEP_EVENT_NAMES)
      .range(from, to);

    if (error) {
      console.error(
        "[SetupStatus] Erreur lors de la récupération des événements:",
        error,
      );
      return events;
    }

    const batch = data || [];
    events.push(...batch);
    if (batch.length < EVENTS_FETCH_BATCH_SIZE) break;
    from += EVENTS_FETCH_BATCH_SIZE;
  }

  return events;
}

// Calcule, sur l'ensemble des utilisateurs, le pourcentage de ceux ayant
// terminé toute la configuration (hors choix de couleur, qui n'est pas un
// "step" compté). Alimente la formulation "tu es dans les X%..." de la page
// Réglages.
async function getSetupCompletionPercentage() {
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("username, ent_username, ical_link, hasPhoto");

  if (usersError) {
    console.error(
      "[SetupStatus] Erreur lors de la récupération des utilisateurs:",
      usersError,
    );
    return 0;
  }
  if (!users || users.length === 0) return 0;

  const { data: passwordRows, error: passwordsError } = await supabase
    .from("passwords")
    .select("ent_username");

  if (passwordsError) {
    console.error(
      "[SetupStatus] Erreur lors de la récupération des mots de passe:",
      passwordsError,
    );
  }
  const entUsernamesWithPassword = new Set(
    (passwordRows || []).map((row) => row.ent_username).filter(Boolean),
  );

  const events = await fetchStepEvents();

  const stepKeysByUser = new Map();
  events.forEach((event) => {
    const stepKey = analyticsService.stepKeyForEvent(event.event_name, event.module);
    if (!stepKey || !event.user_username) return;
    if (!stepKeysByUser.has(event.user_username)) {
      stepKeysByUser.set(event.user_username, new Set());
    }
    stepKeysByUser.get(event.user_username).add(stepKey);
  });

  const completedCount = users.filter((user) => {
    const hasMailPassword = Boolean(
      user.ent_username && entUsernamesWithPassword.has(user.ent_username),
    );
    const hasSchedule = Boolean(user.ical_link);
    const hasPhoto = Boolean(user.hasPhoto);
    const behavioralSteps = stepKeysByUser.get(user.username);
    const hasAllBehavioralSteps =
      Boolean(behavioralSteps) && behavioralSteps.size >= REQUIRED_BEHAVIORAL_STEP_COUNT;

    return hasMailPassword && hasSchedule && hasPhoto && hasAllBehavioralSteps;
  }).length;

  return Math.round((completedCount / users.length) * 100);
}

module.exports = { getSetupCompletionPercentage };
