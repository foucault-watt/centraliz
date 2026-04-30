const crypto = require("crypto");
const supabase = require("../utils/supabaseClient");

const ALLOWED_SCHOOLS = ["ITEEM", "Centrale", "Chimie"];
const EVENTS_STORAGE_BUCKET = process.env.EVENTS_STORAGE_BUCKET || "events";
const ASSOCIATIONS_TABLE = "associations";
const ALLOWED_EVENT_TYPES = [
  "Soirée",
  "Bar",
  "BBQ",
  "JT",
  "Dej",
  "Petit dej",
  "Sport",
  "Art",
  "Formation",
  "Autre",
];
const TYPE_EMOJI_MAP = {
  Soirée: "🎉",
  Bar: "🍻",
  BBQ: "🍖",
  JT: "📣",
  Dej: "🍽️",
  "Petit dej": "🥐",
  Sport: "🏅",
  Art: "🎨",
  Formation: "📚",
  Autre: "✨",
};

const getDefaultEventEmoji = (eventType) => {
  return TYPE_EMOJI_MAP[eventType] || "✨";
};

const isEmojiLike = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;

  try {
    return /\p{Extended_Pictographic}/u.test(text);
  } catch (error) {
    return true;
  }
};

const slugifyAssociationName = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const parseSchools = (raw) => {
  let schools = raw;

  if (typeof schools === "string") {
    try {
      schools = JSON.parse(schools);
    } catch (error) {
      schools = schools
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(schools)) {
    return [];
  }

  const deduped = [
    ...new Set(schools.map((entry) => String(entry).trim()).filter(Boolean)),
  ];
  return deduped.filter((school) => ALLOWED_SCHOOLS.includes(school));
};

const normalizeEventLink = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
};

const sanitizePayload = (payload) => {
  const eventType = String(payload.event_type || "").trim();
  const shortTitle = String(payload.short_title || "")
    .trim()
    .slice(0, 15);
  const eventEmoji = String(payload.event_emoji || "").trim();
  const eventLink = normalizeEventLink(payload.event_link);

  return {
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    event_date: String(payload.event_date || "").trim(),
    event_time: payload.event_time ? String(payload.event_time).trim() : null,
    location: String(payload.location || "").trim(),
    event_type: eventType,
    short_title: shortTitle,
    event_emoji: eventEmoji || getDefaultEventEmoji(eventType),
    event_link: eventLink,
    ecoles: ALLOWED_SCHOOLS,
    association_slug: payload.association_slug
      ? String(payload.association_slug).trim()
      : null,
    association_name: payload.association_name
      ? String(payload.association_name).trim()
      : null,
  };
};

const validatePayload = (data, { requireAssociation = false } = {}) => {
  if (!data.title) return "Le titre est requis.";
  if (!data.description) return "La description est requise.";
  if (!data.event_date) return "La date est requise.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.event_date)) {
    return "Format de date invalide (YYYY-MM-DD attendu).";
  }
  if (!data.event_time) {
    return "L'heure est requise.";
  }
  if (!/^\d{2}:\d{2}$/.test(data.event_time)) {
    return "Format d'heure invalide (HH:MM attendu).";
  }
  if (!data.location) return "Le lieu est requis.";
  if (!data.event_type) return "Le type est requis.";
  if (!ALLOWED_EVENT_TYPES.includes(data.event_type)) {
    return "Type d'événement invalide.";
  }
  if (!data.short_title) return "Le nom raccourci est requis.";
  if (data.short_title.length > 15) {
    return "Le nom raccourci doit faire 15 caractères maximum.";
  }
  if (!data.event_emoji) return "L'emoji est requis.";
  if (!isEmojiLike(data.event_emoji)) {
    return "Choisissez un emoji valide.";
  }
  if (data.event_link) {
    try {
      const parsed = new URL(data.event_link);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "Le lien doit être une URL http(s) valide.";
      }
    } catch (error) {
      return "Le lien doit être une URL valide.";
    }
  }
  if (requireAssociation && !data.association_slug) {
    return "L'association est requise.";
  }
  if (requireAssociation && !data.association_name) {
    return "Le nom de l'association est requis.";
  }

  return null;
};

const getUserAssociations = async (username) => {
  const { data, error } = await supabase
    .from("user_associations")
    .select("association_slug, association_name, role")
    .eq("username", username);

  if (error) {
    throw new Error(
      `Impossible de récupérer les associations: ${error.message}`,
    );
  }

  return data || [];
};

const getAssociationForUser = async (username, associationSlug) => {
  const associations = await getUserAssociations(username);
  return (
    associations.find((entry) => entry.association_slug === associationSlug) ||
    null
  );
};

const isMissingAssociationsSchemaError = (error) => {
  return Boolean(
    error &&
    (error.code === "42P01" ||
      String(error.message || "").includes(
        'relation "associations" does not exist',
      ) ||
      String(error.message || "").includes(
        'table "associations" does not exist',
      )),
  );
};

const getAssociationBySlug = async (associationSlug) => {
  const { data, error } = await supabase
    .from(ASSOCIATIONS_TABLE)
    .select(
      "association_slug, association_name, description, created_by, created_at, updated_at",
    )
    .eq("association_slug", associationSlug)
    .maybeSingle();

  if (error) {
    if (isMissingAssociationsSchemaError(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("user_associations")
        .select("association_slug, association_name")
        .eq("association_slug", associationSlug)
        .limit(1);

      if (legacyError) {
        throw new Error(
          `Impossible de récupérer l'association: ${legacyError.message}`,
        );
      }

      return (legacyData || [])[0] || null;
    }

    throw new Error(`Impossible de récupérer l'association: ${error.message}`);
  }

  return data || null;
};

const getUserRoleMeta = async (username) => {
  const { data, error } = await supabase
    .from("users")
    .select("is_admin, has_association_role")
    .eq("username", username)
    .single();

  if (error || !data) {
    throw new Error("Utilisateur introuvable.");
  }

  return {
    is_admin: Boolean(data.is_admin),
    has_association_role: Boolean(data.has_association_role),
  };
};

const isMissingAssociationSchemaError = (error) => {
  return Boolean(
    error &&
    (error.code === "42703" ||
      String(error.message || "").includes(
        "events.association_slug does not exist",
      ) ||
      String(error.message || "").includes(
        'column "association_slug" does not exist',
      ) ||
      String(error.message || "").includes(
        "events.short_title does not exist",
      ) ||
      String(error.message || "").includes(
        'column "short_title" does not exist',
      ) ||
      String(error.message || "").includes(
        "events.event_emoji does not exist",
      ) ||
      String(error.message || "").includes(
        'column "event_emoji" does not exist',
      ) ||
      String(error.message || "").includes(
        "events.event_link does not exist",
      ) ||
      String(error.message || "").includes(
        'column "event_link" does not exist',
      )),
  );
};

const canManageEvent = async (username, roleMeta, event) => {
  if (roleMeta.is_admin) {
    return true;
  }

  if (event.created_by === username) {
    return true;
  }

  if (event.association_slug) {
    const association = await getAssociationForUser(
      username,
      event.association_slug,
    );
    return Boolean(association);
  }

  return false;
};

const uploadEventPhoto = async (username, file) => {
  if (!file) {
    return { photo_url: null, photo_path: null };
  }

  const extension =
    file.mimetype === "image/png"
      ? "png"
      : file.mimetype === "image/webp"
        ? "webp"
        : "jpg";
  const fileName = `${Date.now()}_${crypto.randomBytes(10).toString("hex")}.${extension}`;
  const filePath = `${username}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(EVENTS_STORAGE_BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload photo impossible: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(EVENTS_STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return {
    photo_url: publicUrlData ? publicUrlData.publicUrl : null,
    photo_path: filePath,
  };
};

const removeEventPhoto = async (photoPath) => {
  if (!photoPath) return;

  await supabase.storage.from(EVENTS_STORAGE_BUCKET).remove([photoPath]);
};

exports.listUpcomingEvents = async (username, limit = 30) => {
  const roleMeta = await getUserRoleMeta(username);
  const todayIso = new Date().toISOString().slice(0, 10);
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 100)
    : 30;

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, event_time, location, event_type, short_title, event_emoji, event_link, ecoles, photo_url, created_by, association_slug, association_name, created_at, updated_at",
    )
    .gte("event_date", todayIso)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingAssociationSchemaError(error)) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            "La base de données n'a pas encore les colonnes d'événements complètes. Appliquez les migrations 007_add_event_association_fields.sql, 009_add_event_preview_fields.sql et 010_add_event_link.sql.",
        },
      };
    }
    throw new Error(`Impossible de récupérer les événements: ${error.message}`);
  }

  const associations = await getUserAssociations(username);
  const associationSlugs = associations.map((entry) => entry.association_slug);

  return (data || []).map((event) => ({
    ...event,
    can_manage:
      roleMeta.is_admin ||
      (event.association_slug &&
        associationSlugs.includes(event.association_slug)) ||
      event.created_by === username,
  }));
};

exports.listAssociationEvents = async (
  username,
  associationSlug,
  limit = 100,
) => {
  const roleMeta = await getUserRoleMeta(username);
  const association = roleMeta.is_admin
    ? await getAssociationBySlug(associationSlug)
    : await getAssociationForUser(username, associationSlug);

  if (!roleMeta.is_admin && !association) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Vous n'avez pas accès à cette association.",
      },
    };
  }

  if (roleMeta.is_admin && !association) {
    return {
      status: 404,
      body: {
        success: false,
        error: "Association introuvable.",
      },
    };
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 100)
    : 100;

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, event_time, location, event_type, short_title, event_emoji, event_link, ecoles, photo_url, created_by, association_slug, association_name, created_at, updated_at",
    )
    .eq("association_slug", associationSlug)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingAssociationSchemaError(error)) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            "La base de données n'a pas encore les colonnes d'événements complètes. Appliquez les migrations 007_add_event_association_fields.sql, 009_add_event_preview_fields.sql et 010_add_event_link.sql.",
        },
      };
    }
    throw new Error(
      `Impossible de récupérer les événements de l'association: ${error.message}`,
    );
  }

  return {
    status: 200,
    body: {
      success: true,
      events: (data || []).map((event) => ({
        ...event,
        can_manage:
          roleMeta.is_admin ||
          Boolean(association) ||
          event.created_by === username,
      })),
    },
  };
};

exports.listAdminEvents = async (username, limit = 200) => {
  const roleMeta = await getUserRoleMeta(username);
  if (!roleMeta.is_admin) {
    return {
      status: 403,
      body: { success: false, error: "Accès administrateur requis." },
    };
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 300)
    : 200;

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, event_time, location, event_type, short_title, event_emoji, event_link, ecoles, photo_url, created_by, association_slug, association_name, created_at, updated_at",
    )
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingAssociationSchemaError(error)) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            "La base de données n'a pas encore les colonnes d'événements complètes. Appliquez les migrations 007_add_event_association_fields.sql, 009_add_event_preview_fields.sql et 010_add_event_link.sql.",
        },
      };
    }
    throw new Error(
      `Impossible de récupérer les événements admin: ${error.message}`,
    );
  }

  return {
    status: 200,
    body: {
      success: true,
      events: (data || []).map((event) => ({
        ...event,
        can_manage: true,
      })),
    },
  };
};

exports.listAdminAssociations = async (username) => {
  const roleMeta = await getUserRoleMeta(username);
  if (!roleMeta.is_admin) {
    return {
      status: 403,
      body: { success: false, error: "Accès administrateur requis." },
    };
  }

  const { data, error } = await supabase
    .from(ASSOCIATIONS_TABLE)
    .select(
      "association_slug, association_name, description, created_by, created_at, updated_at",
    )
    .order("association_name", { ascending: true });

  if (error) {
    if (!isMissingAssociationsSchemaError(error)) {
      throw new Error(
        `Impossible de récupérer les associations: ${error.message}`,
      );
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("user_associations")
      .select("association_slug, association_name")
      .order("association_name", { ascending: true });

    if (legacyError) {
      throw new Error(
        `Impossible de récupérer les associations: ${legacyError.message}`,
      );
    }

    const unique = [];
    const seen = new Set();

    (legacyData || []).forEach((entry) => {
      const key = entry.association_slug;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          association_slug: entry.association_slug,
          association_name: entry.association_name,
          description: null,
          created_by: null,
          created_at: null,
          updated_at: null,
        });
      }
    });

    return {
      status: 200,
      body: { success: true, associations: unique },
    };
  }

  return {
    status: 200,
    body: { success: true, associations: data || [] },
  };
};

exports.createAssociation = async (username, payload) => {
  const roleMeta = await getUserRoleMeta(username);
  if (!roleMeta.is_admin) {
    return {
      status: 403,
      body: { success: false, error: "Accès administrateur requis." },
    };
  }

  const associationName = String(
    payload.association_name || payload.name || "",
  ).trim();
  const associationSlug = String(
    payload.association_slug || slugifyAssociationName(associationName),
  ).trim();
  const description = String(payload.description || "").trim();

  if (!associationName) {
    return {
      status: 400,
      body: { success: false, error: "Le nom de l'association est requis." },
    };
  }

  if (!associationSlug) {
    return {
      status: 400,
      body: { success: false, error: "Le slug de l'association est requis." },
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from(ASSOCIATIONS_TABLE)
    .select("association_slug")
    .eq("association_slug", associationSlug)
    .maybeSingle();

  if (existingError) {
    if (isMissingAssociationsSchemaError(existingError)) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            "La base de données n'a pas encore la table des associations. Appliquez la migration 008_add_associations_catalog.sql.",
        },
      };
    }

    throw new Error(
      `Impossible de vérifier l'association existante: ${existingError.message}`,
    );
  }

  if (existing) {
    return {
      status: 409,
      body: {
        success: false,
        error: "Une association avec ce slug existe déjà.",
      },
    };
  }

  const { data, error } = await supabase
    .from(ASSOCIATIONS_TABLE)
    .insert({
      association_slug: associationSlug,
      association_name: associationName,
      description: description || null,
      created_by: username,
    })
    .select(
      "association_slug, association_name, description, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    if (isMissingAssociationsSchemaError(error)) {
      return {
        status: 503,
        body: {
          success: false,
          error:
            "La base de données n'a pas encore la table des associations. Appliquez la migration 008_add_associations_catalog.sql.",
        },
      };
    }

    throw new Error(`Création de l'association impossible: ${error.message}`);
  }

  return {
    status: 201,
    body: { success: true, association: data },
  };
};

exports.createEvent = async (username, payload, file) => {
  const roleMeta = await getUserRoleMeta(username);
  if (!roleMeta.is_admin && !roleMeta.has_association_role) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Seuls les membres d'association peuvent créer un événement.",
      },
    };
  }

  const sanitized = sanitizePayload(payload);
  const validationError = validatePayload(sanitized, {
    requireAssociation: true,
  });
  if (validationError) {
    return {
      status: 400,
      body: { success: false, error: validationError },
    };
  }

  const association = roleMeta.is_admin
    ? await getAssociationBySlug(sanitized.association_slug)
    : await getAssociationForUser(username, sanitized.association_slug);

  if (!association) {
    return {
      status: roleMeta.is_admin ? 404 : 403,
      body: {
        success: false,
        error: roleMeta.is_admin
          ? "Association introuvable."
          : "Vous n'êtes pas autorisé à créer un événement pour cette association.",
      },
    };
  }

  if (association) {
    sanitized.association_name = association.association_name;
  }

  const uploadedPhoto = await uploadEventPhoto(username, file);
  const { data, error } = await supabase
    .from("events")
    .insert({
      ...sanitized,
      photo_url: uploadedPhoto.photo_url,
      photo_path: uploadedPhoto.photo_path,
      created_by: username,
    })
    .select("id")
    .single();

  if (error) {
    if (uploadedPhoto.photo_path) {
      await removeEventPhoto(uploadedPhoto.photo_path);
    }
    throw new Error(`Création de l'événement impossible: ${error.message}`);
  }

  return {
    status: 201,
    body: { success: true, eventId: data.id },
  };
};

exports.updateEvent = async (username, eventId, payload, file) => {
  const roleMeta = await getUserRoleMeta(username);
  const { data: currentEvent, error: currentEventError } = await supabase
    .from("events")
    .select(
      "id, created_by, photo_path, association_slug, association_name, short_title, event_emoji",
    )
    .eq("id", eventId)
    .single();

  if (currentEventError || !currentEvent) {
    return {
      status: 404,
      body: { success: false, error: "Événement introuvable." },
    };
  }

  const canManage = await canManageEvent(username, roleMeta, currentEvent);
  if (!canManage) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Vous ne pouvez pas modifier cet événement.",
      },
    };
  }

  const sanitized = sanitizePayload(payload);
  const validationError = validatePayload(sanitized);
  if (validationError) {
    return {
      status: 400,
      body: { success: false, error: validationError },
    };
  }

  let uploadedPhoto = null;
  if (file) {
    uploadedPhoto = await uploadEventPhoto(username, file);
  }

  const updatePayload = {
    ...sanitized,
    association_slug: currentEvent.association_slug,
    association_name: currentEvent.association_name,
  };
  if (uploadedPhoto) {
    updatePayload.photo_url = uploadedPhoto.photo_url;
    updatePayload.photo_path = uploadedPhoto.photo_path;
  }

  const { error: updateError } = await supabase
    .from("events")
    .update(updatePayload)
    .eq("id", eventId);

  if (updateError) {
    if (uploadedPhoto && uploadedPhoto.photo_path) {
      await removeEventPhoto(uploadedPhoto.photo_path);
    }
    throw new Error(`Mise à jour impossible: ${updateError.message}`);
  }

  if (uploadedPhoto && currentEvent.photo_path) {
    await removeEventPhoto(currentEvent.photo_path);
  }

  return {
    status: 200,
    body: { success: true },
  };
};

exports.deleteEvent = async (username, eventId) => {
  const roleMeta = await getUserRoleMeta(username);
  const { data: currentEvent, error: currentEventError } = await supabase
    .from("events")
    .select(
      "id, created_by, photo_path, association_slug, association_name, short_title, event_emoji",
    )
    .eq("id", eventId)
    .single();

  if (currentEventError || !currentEvent) {
    return {
      status: 404,
      body: { success: false, error: "Événement introuvable." },
    };
  }

  const canManage = await canManageEvent(username, roleMeta, currentEvent);
  if (!canManage) {
    return {
      status: 403,
      body: {
        success: false,
        error: "Vous ne pouvez pas supprimer cet événement.",
      },
    };
  }

  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId);

  if (deleteError) {
    throw new Error(`Suppression impossible: ${deleteError.message}`);
  }

  if (currentEvent.photo_path) {
    await removeEventPhoto(currentEvent.photo_path);
  }

  return {
    status: 200,
    body: { success: true },
  };
};

exports.ALLOWED_SCHOOLS = ALLOWED_SCHOOLS;
exports.ALLOWED_EVENT_TYPES = ALLOWED_EVENT_TYPES;
