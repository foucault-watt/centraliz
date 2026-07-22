const supabase = require('../utils/supabaseClient');

const FEEDBACK_TYPES = ["bug", "suggestion", "question", "content", "other"];
const FEEDBACK_AREAS = [
  "notes",
  "calendars",
  "mails",
  "links",
  "cekilui",
  "events",
  "install",
  "general",
];
const FEEDBACK_PRIORITIES = ["normal", "important", "bloquant"];
const ADMIN_STATUSES = ["new", "read", "planned", "done", "rejected"];

const normalizeText = (value, maxLength) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

class FeedbackService {
  validateChoice(value, allowedValues, fallback = null) {
    if (!value && fallback !== null) return fallback;
    if (allowedValues.includes(value)) return value;
    throw new Error("Valeur de feedback invalide");
  }

  async addFeedback(username, payload = {}) {
    try {
      const text = normalizeText(payload.text, 1000);
      if (!username || !text) {
        return {
          status: 400,
          body: { success: false, error: "Utilisateur et message requis." },
        };
      }

      const feedback = {
        username,
        text,
        type: this.validateChoice(payload.type, FEEDBACK_TYPES, "suggestion"),
        area: payload.area
          ? this.validateChoice(payload.area, FEEDBACK_AREAS)
          : "general",
        priority: this.validateChoice(
          payload.priority,
          FEEDBACK_PRIORITIES,
          "normal",
        ),
        wants_response: payload.wants_response !== false,
        state: "waiting",
        admin_status: "new",
      };

      const { data, error } = await supabase
        .from('feedbacks')
        .insert([feedback])
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de l\'ajout du feedback à Supabase:', error);
        throw new Error('Impossible d\'ajouter le feedback');
      }
      return { status: 201, body: { success: true, feedback: data } };
    } catch (error) {
      console.error('Erreur lors de l\'ajout du feedback:', error);
      if (error.message === "Valeur de feedback invalide") {
        return {
          status: 400,
          body: { success: false, error: "Un champ du retour est invalide." },
        };
      }
      return {
        status: 500,
        body: { success: false, error: "Impossible d'ajouter le retour." },
      };
    }
  }

  async listUserFeedbacks(username) {
    if (!username) {
      return {
        status: 400,
        body: { success: false, error: "Utilisateur requis." },
      };
    }

    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .eq("username", username)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors de la récupération des retours:", error);
      return {
        status: 500,
        body: { success: false, error: "Impossible de récupérer les retours." },
      };
    }

    return { status: 200, body: { success: true, feedbacks: data || [] } };
  }

  async listAdminFeedbacks(filters = {}) {
    let query = supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.status && ADMIN_STATUSES.includes(filters.status)) {
      query = query.eq("admin_status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erreur lors de la récupération admin des retours:", error);
      return {
        status: 500,
        body: { success: false, error: "Impossible de récupérer les retours." },
      };
    }

    return { status: 200, body: { success: true, feedbacks: data || [] } };
  }

  async updateAdminFeedback(id, adminUsername, payload = {}) {
    try {
      const adminStatus = this.validateChoice(
        payload.admin_status,
        ADMIN_STATUSES,
        "read",
      );
      const adminResponse = normalizeText(payload.admin_response, 1200);

      const { data, error } = await supabase
        .from("feedbacks")
        .update({
          admin_status: adminStatus,
          admin_response: adminResponse || null,
          admin_updated_by: adminUsername,
          admin_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          state: adminStatus === "new" ? "waiting" : adminStatus,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Erreur lors de la mise à jour du retour:", error);
        return {
          status: 500,
          body: { success: false, error: "Impossible de mettre à jour le retour." },
        };
      }

      return { status: 200, body: { success: true, feedback: data } };
    } catch (error) {
      if (error.message === "Valeur de feedback invalide") {
        return {
          status: 400,
          body: { success: false, error: "Le statut choisi est invalide." },
        };
      }
      console.error("Erreur inattendue lors de la mise à jour du retour:", error);
      return {
        status: 500,
        body: { success: false, error: "Impossible de mettre à jour le retour." },
      };
    }
  }

  async deleteUserFeedback(id, username) {
    if (!id || !username) {
      return {
        status: 400,
        body: { success: false, error: "Retour et utilisateur requis." },
      };
    }

    const { data, error } = await supabase
      .from("feedbacks")
      .delete()
      .eq("id", id)
      .eq("username", username)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erreur lors de la suppression du retour:", error);
      return {
        status: 500,
        body: { success: false, error: "Impossible de supprimer le retour." },
      };
    }

    if (!data) {
      return {
        status: 404,
        body: { success: false, error: "Retour introuvable." },
      };
    }

    return { status: 200, body: { success: true } };
  }

  async deleteAdminFeedback(id) {
    if (!id) {
      return {
        status: 400,
        body: { success: false, error: "Retour requis." },
      };
    }

    const { data, error } = await supabase
      .from("feedbacks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erreur lors de la suppression admin du retour:", error);
      return {
        status: 500,
        body: { success: false, error: "Impossible de supprimer le retour." },
      };
    }

    if (!data) {
      return {
        status: 404,
        body: { success: false, error: "Retour introuvable." },
      };
    }

    return { status: 200, body: { success: true } };
  }
}

module.exports = new FeedbackService();
