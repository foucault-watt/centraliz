const supabase = require("../utils/supabaseClient");

const CAMPAIGN_TYPES = ["alert", "poll", "prompt", "announcement", "stack"];
const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"];
const PLACEMENTS = ["global", "page-scoped"];
const PRESENTATIONS = ["modal", "banner", "toast", "bottom-sheet"];
const DISMISS_MODES = ["dismissible", "persistent", "hide-forever"];
const RESPONSE_MODES = ["none", "optional", "required"];
const FREQUENCY_MODES = [
  "once",
  "always",
  "until_dismissed",
  "until_response",
  "until_end_date",
  "max_n_times",
];
const BLOCK_TYPES = ["text", "cta", "poll", "textarea", "event-highlight"];
const PAGE_PREFIXES = [
  "/notes",
  "/calendars",
  "/events",
  "/events/admin",
  "/events/create",
  "/events/association/",
  "/communication",
  "/links",
  "/feedback",
  "/help",
  "/bibli",
  "/analytics/admin",
  "/cekilui",
  "/pokemon",
];

const normalizeText = (value, maxLength = 4000) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeArray = (value = [], maxLength = 100) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxLength);
};

const parseOptionalDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("DATE_INVALID");
  }
  return parsed.toISOString();
};

const validateChoice = (value, allowedValues, fallback = null) => {
  if ((value === undefined || value === null || value === "") && fallback !== null) {
    return fallback;
  }
  if (allowedValues.includes(value)) return value;
  throw new Error("INVALID_CHOICE");
};

const matchesPage = (pagePath, targets = []) => {
  if (!targets.length) return true;
  return targets.some((target) => pagePath === target || pagePath.startsWith(target));
};

const isCooldownActive = (lastSeenAt, cooldownMinutes) => {
  if (!lastSeenAt || !cooldownMinutes) return false;
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  return diffMs < cooldownMinutes * 60 * 1000;
};

class CampaignService {
  async listTargetOptions() {
    const { data, error } = await supabase
      .from("users")
      .select("\"group\"")
      .not("group", "is", null);

    if (error) {
      throw new Error(`Impossible de récupérer les groupes: ${error.message}`);
    }

    const groups = Array.from(
      new Set((data || []).map((entry) => String(entry.group || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "fr"));

    return {
      groups,
      page_paths: PAGE_PREFIXES,
    };
  }

  buildCampaignRecord(payload = {}, username, previous = null) {
    const title = normalizeText(payload.title, 180);
    if (!title) {
      throw new Error("TITLE_REQUIRED");
    }

    const startAt = parseOptionalDate(payload.start_at);
    const endAt = parseOptionalDate(payload.end_at);
    if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
      throw new Error("DATE_RANGE_INVALID");
    }

    const campaign = {
      type: validateChoice(payload.type, CAMPAIGN_TYPES, previous?.type || "alert"),
      status: validateChoice(payload.status, CAMPAIGN_STATUSES, previous?.status || "draft"),
      title,
      body: normalizeText(payload.body, 4000) || null,
      placement: validateChoice(payload.placement, PLACEMENTS, previous?.placement || "global"),
      presentation: validateChoice(
        payload.presentation,
        PRESENTATIONS,
        previous?.presentation || "modal",
      ),
      priority: Number.isFinite(Number(payload.priority))
        ? Number(payload.priority)
        : previous?.priority ?? 100,
      dismiss_mode: validateChoice(
        payload.dismiss_mode,
        DISMISS_MODES,
        previous?.dismiss_mode || "dismissible",
      ),
      response_mode: validateChoice(
        payload.response_mode,
        RESPONSE_MODES,
        previous?.response_mode || "none",
      ),
      frequency_mode: validateChoice(
        payload.frequency_mode,
        FREQUENCY_MODES,
        previous?.frequency_mode || "once",
      ),
      max_impressions:
        payload.max_impressions === null || payload.max_impressions === ""
          ? null
          : Number.isFinite(Number(payload.max_impressions))
            ? Number(payload.max_impressions)
            : previous?.max_impressions ?? null,
      cooldown_minutes: Number.isFinite(Number(payload.cooldown_minutes))
        ? Math.max(0, Number(payload.cooldown_minutes))
        : previous?.cooldown_minutes ?? 0,
      start_at: startAt,
      end_at: endAt,
      updated_by: username,
      updated_at: new Date().toISOString(),
    };

    if (!previous) {
      campaign.created_by = username;
    }

    if (campaign.frequency_mode !== "max_n_times") {
      campaign.max_impressions = null;
    } else if (!campaign.max_impressions || campaign.max_impressions < 1) {
      campaign.max_impressions = 1;
    }

    if (campaign.type === "poll" && payload.response_mode === undefined) {
      campaign.response_mode = "required";
    }
    if (campaign.type === "prompt" && payload.response_mode === undefined) {
      campaign.response_mode = "required";
    }

    return campaign;
  }

  buildBlocks(payload = {}, previousBlocks = []) {
    let blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
    if (!blocks.length && payload.body) {
      blocks = [
        {
          type: "text",
          payload: { text: payload.body },
        },
      ];
    }
    if (!blocks.length) {
      throw new Error("BLOCKS_REQUIRED");
    }

    const normalized = blocks.map((block, index) => {
      const type = validateChoice(
        block?.type || block?.block_type,
        BLOCK_TYPES,
        previousBlocks[index]?.block_type || "text",
      );

      const payloadData = block?.payload || {};
      const position = Number.isFinite(Number(block?.position))
        ? Number(block.position)
        : index;

      if (type === "text") {
        const text = normalizeText(payloadData.text, 5000);
        if (!text) throw new Error("TEXT_BLOCK_REQUIRED");
        return {
          id: block?.id || null,
          block_type: type,
          position,
          payload: {
            text,
            tone: normalizeText(payloadData.tone, 24) || "default",
          },
        };
      }

      if (type === "cta") {
        const label = normalizeText(payloadData.label, 80);
        const href = normalizeText(payloadData.href, 500);
        if (!label) throw new Error("CTA_LABEL_REQUIRED");
        return {
          id: block?.id || null,
          block_type: type,
          position,
          payload: {
            label,
            href: href || null,
            action: normalizeText(payloadData.action, 40) || "dismiss",
            style: normalizeText(payloadData.style, 24) || "primary",
          },
        };
      }

      if (type === "poll") {
        const question = normalizeText(payloadData.question, 280);
        const options = normalizeArray(payloadData.options, 12).map((option) =>
          option.slice(0, 120),
        );
        if (!question || options.length < 2) {
          throw new Error("POLL_INVALID");
        }
        return {
          id: block?.id || null,
          block_type: type,
          position,
          payload: {
            question,
            options,
            allow_multiple: Boolean(payloadData.allow_multiple),
          },
        };
      }

      if (type === "textarea") {
        const prompt = normalizeText(payloadData.prompt, 280);
        if (!prompt) throw new Error("TEXTAREA_INVALID");
        return {
          id: block?.id || null,
          block_type: type,
          position,
          payload: {
            prompt,
            placeholder: normalizeText(payloadData.placeholder, 220) || "",
            required: payloadData.required !== false,
            max_length: Number.isFinite(Number(payloadData.max_length))
              ? Math.min(4000, Math.max(50, Number(payloadData.max_length)))
              : 600,
          },
        };
      }

      const title = normalizeText(payloadData.title, 160);
      return {
        id: block?.id || null,
        block_type: type,
        position,
        payload: {
          title: title || "Temps fort",
          description: normalizeText(payloadData.description, 1200) || "",
          href: normalizeText(payloadData.href, 500) || null,
          label: normalizeText(payloadData.label, 80) || "En savoir plus",
        },
      };
    });

    return normalized.sort((a, b) => a.position - b.position);
  }

  buildTarget(payload = {}, previous = null) {
    const pagePaths = normalizeArray(payload.page_paths || previous?.page_paths || [], 24)
      .map((entry) => entry.startsWith("/") ? entry : `/${entry}`)
      .filter((entry) => entry.length <= 120);
    const groups = normalizeArray(payload.groups || previous?.groups || [], 40).map((entry) =>
      entry.slice(0, 60),
    );
    const includeUsernames = normalizeArray(
      payload.include_usernames || previous?.include_usernames || [],
      80,
    ).map((entry) => entry.slice(0, 120));
    const excludeUsernames = normalizeArray(
      payload.exclude_usernames || previous?.exclude_usernames || [],
      80,
    ).map((entry) => entry.slice(0, 120));

    return {
      page_paths: pagePaths,
      groups,
      include_usernames: includeUsernames,
      exclude_usernames: excludeUsernames,
      updated_at: new Date().toISOString(),
    };
  }

  serializeCampaign(campaign, blocks = [], target = null, state = null, responses = []) {
    const startAt = campaign.start_at ? new Date(campaign.start_at) : null;
    const endAt = campaign.end_at ? new Date(campaign.end_at) : null;
    let lifecycleState = campaign.status;
    if (campaign.status === "active" && startAt && startAt > new Date()) {
      lifecycleState = "planned";
    }
    if (campaign.status === "active" && endAt && endAt < new Date()) {
      lifecycleState = "expired";
    }

    return {
      ...campaign,
      lifecycle_state: lifecycleState,
      blocks: blocks.sort((a, b) => a.position - b.position),
      target: target || {
        page_paths: [],
        groups: [],
        include_usernames: [],
        exclude_usernames: [],
      },
      delivery_state: state || null,
      responses,
    };
  }

  async getCampaignBundle(campaignIds) {
    if (!campaignIds.length) {
      return { blocksByCampaign: new Map(), targetsByCampaign: new Map() };
    }

    const [{ data: blocksData, error: blocksError }, { data: targetsData, error: targetsError }] =
      await Promise.all([
        supabase
          .from("campaign_blocks")
          .select("*")
          .in("campaign_id", campaignIds)
          .order("position", { ascending: true }),
        supabase.from("campaign_targets").select("*").in("campaign_id", campaignIds),
      ]);

    if (blocksError) {
      throw new Error(`Impossible de récupérer les blocs: ${blocksError.message}`);
    }
    if (targetsError) {
      throw new Error(`Impossible de récupérer les ciblages: ${targetsError.message}`);
    }

    const blocksByCampaign = new Map();
    (blocksData || []).forEach((block) => {
      const list = blocksByCampaign.get(block.campaign_id) || [];
      list.push(block);
      blocksByCampaign.set(block.campaign_id, list);
    });

    const targetsByCampaign = new Map();
    (targetsData || []).forEach((target) => {
      targetsByCampaign.set(target.campaign_id, target);
    });

    return { blocksByCampaign, targetsByCampaign };
  }

  async listAdminCampaigns() {
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Impossible de récupérer les campagnes: ${error.message}`);
    }

    const campaignIds = (campaigns || []).map((campaign) => campaign.id);
    const { blocksByCampaign, targetsByCampaign } = await this.getCampaignBundle(campaignIds);

    const [{ data: responsesData }, { data: statesData }] = await Promise.all([
      campaignIds.length
        ? supabase.from("campaign_responses").select("campaign_id, username")
            .in("campaign_id", campaignIds)
        : Promise.resolve({ data: [] }),
      campaignIds.length
        ? supabase
            .from("campaign_delivery_states")
            .select("campaign_id, username, impressions_count, completed_at, hidden_forever")
            .in("campaign_id", campaignIds)
        : Promise.resolve({ data: [] }),
    ]);

    const responseCounts = new Map();
    (responsesData || []).forEach((entry) => {
      responseCounts.set(entry.campaign_id, (responseCounts.get(entry.campaign_id) || 0) + 1);
    });
    const stateCounts = new Map();
    (statesData || []).forEach((entry) => {
      const prev = stateCounts.get(entry.campaign_id) || {
        impressions: 0,
        completed: 0,
        hidden: 0,
      };
      prev.impressions += entry.impressions_count || 0;
      prev.completed += entry.completed_at ? 1 : 0;
      prev.hidden += entry.hidden_forever ? 1 : 0;
      stateCounts.set(entry.campaign_id, prev);
    });

    return (campaigns || []).map((campaign) => ({
      ...this.serializeCampaign(
        campaign,
        blocksByCampaign.get(campaign.id) || [],
        targetsByCampaign.get(campaign.id) || null,
      ),
      stats: {
        responses_count: responseCounts.get(campaign.id) || 0,
        impressions_count: stateCounts.get(campaign.id)?.impressions || 0,
        completed_count: stateCounts.get(campaign.id)?.completed || 0,
        hidden_count: stateCounts.get(campaign.id)?.hidden || 0,
      },
    }));
  }

  async getAdminCampaign(id) {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !campaign) {
      return null;
    }

    const [
      { blocksByCampaign, targetsByCampaign },
      { data: responsesData, error: responsesError },
      { data: deliveryStatesData, error: deliveryStatesError },
    ] =
      await Promise.all([
        this.getCampaignBundle([id]),
        supabase
          .from("campaign_responses")
          .select("*, users(username, display_name)")
          .eq("campaign_id", id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("campaign_delivery_states")
          .select("*, users(username, display_name, group)")
          .eq("campaign_id", id)
          .order("last_seen_at", { ascending: false }),
      ]);

    if (responsesError) {
      throw new Error(`Impossible de récupérer les réponses: ${responsesError.message}`);
    }
    if (deliveryStatesError) {
      throw new Error(
        `Impossible de récupérer les impressions: ${deliveryStatesError.message}`,
      );
    }

    const deliveryStates = deliveryStatesData || [];
    const impressionStats = deliveryStates.reduce(
      (acc, entry) => {
        acc.total_impressions += entry.impressions_count || 0;
        acc.unique_viewers += 1;
        acc.completed_count += entry.completed_at ? 1 : 0;
        acc.dismissed_count += entry.dismissed_at ? 1 : 0;
        acc.hidden_count += entry.hidden_forever ? 1 : 0;

        if (entry.last_seen_at) {
          if (!acc.last_impression_at || new Date(entry.last_seen_at) > new Date(acc.last_impression_at)) {
            acc.last_impression_at = entry.last_seen_at;
          }
        }

        return acc;
      },
      {
        total_impressions: 0,
        unique_viewers: 0,
        completed_count: 0,
        dismissed_count: 0,
        hidden_count: 0,
        last_impression_at: null,
      },
    );

    const serialized = this.serializeCampaign(
      campaign,
      blocksByCampaign.get(id) || [],
      targetsByCampaign.get(id) || null,
      null,
      responsesData || [],
    );

    return {
      ...serialized,
      delivery_states: deliveryStates,
      stats: {
        ...(serialized.stats || {}),
        ...impressionStats,
        responses_count: (responsesData || []).length,
      },
    };
  }

  async saveCampaign(payload, username, id = null) {
    const previous = id ? await this.getAdminCampaign(id) : null;
    if (id && !previous) {
      return {
        status: 404,
        body: { success: false, error: "Campagne introuvable." },
      };
    }

    try {
      const campaignRecord = this.buildCampaignRecord(payload, username, previous);
      const blocks = this.buildBlocks(payload, previous?.blocks || []);
      const target = this.buildTarget(payload, previous?.target || null);

      const campaignQuery = id
        ? supabase.from("campaigns").update(campaignRecord).eq("id", id)
        : supabase.from("campaigns").insert([{ ...campaignRecord, created_by: username }]);

      const { data: campaignRows, error: campaignError } = await campaignQuery.select().single();

      if (campaignError) {
        throw new Error(campaignError.message);
      }

      const campaignId = campaignRows.id;

      const { error: deleteBlocksError } = await supabase
        .from("campaign_blocks")
        .delete()
        .eq("campaign_id", campaignId);
      if (deleteBlocksError) {
        throw new Error(deleteBlocksError.message);
      }

      const { error: targetUpsertError } = await supabase
        .from("campaign_targets")
        .upsert([
          {
            campaign_id: campaignId,
            ...target,
          },
        ]);
      if (targetUpsertError) {
        throw new Error(targetUpsertError.message);
      }

      const { data: blockRows, error: insertBlocksError } = await supabase
        .from("campaign_blocks")
        .insert(
          blocks.map((block) => ({
            campaign_id: campaignId,
            block_type: block.block_type,
            position: block.position,
            payload: block.payload,
          })),
        )
        .select("*");

      if (insertBlocksError) {
        throw new Error(insertBlocksError.message);
      }

      const saved = this.serializeCampaign(campaignRows, blockRows || [], {
        campaign_id: campaignId,
        ...target,
      });

      return { status: id ? 200 : 201, body: { success: true, campaign: saved } };
    } catch (error) {
      const messageMap = {
        TITLE_REQUIRED: "Le titre est requis.",
        DATE_INVALID: "Une des dates est invalide.",
        DATE_RANGE_INVALID: "La date de fin doit être après la date de début.",
        INVALID_CHOICE: "Une valeur de configuration est invalide.",
        TEXT_BLOCK_REQUIRED: "Un bloc texte doit contenir du texte.",
        CTA_LABEL_REQUIRED: "Un bouton CTA doit contenir un libellé.",
        POLL_INVALID: "Un sondage doit avoir une question et au moins deux options.",
        TEXTAREA_INVALID: "Une invite texte doit contenir une question.",
        BLOCKS_REQUIRED: "Ajoute au moins un bloc à afficher.",
      };

      return {
        status: 400,
        body: {
          success: false,
          error: messageMap[error.message] || "Impossible d'enregistrer la campagne.",
        },
      };
    }
  }

  async deleteCampaign(id) {
    const { data, error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return {
        status: 500,
        body: { success: false, error: "Impossible de supprimer la campagne." },
      };
    }

    if (!data) {
      return {
        status: 404,
        body: { success: false, error: "Campagne introuvable." },
      };
    }

    return { status: 200, body: { success: true } };
  }

  async duplicateCampaign(id, username) {
    const campaign = await this.getAdminCampaign(id);
    if (!campaign) {
      return {
        status: 404,
        body: { success: false, error: "Campagne introuvable." },
      };
    }

    const duplicatePayload = {
      ...campaign,
      title: `${campaign.title} (copie)`,
      status: "draft",
      start_at: null,
      end_at: null,
      blocks: campaign.blocks,
      page_paths: campaign.target?.page_paths || [],
      groups: campaign.target?.groups || [],
      include_usernames: campaign.target?.include_usernames || [],
      exclude_usernames: campaign.target?.exclude_usernames || [],
    };

    return this.saveCampaign(
      {
        ...duplicatePayload,
        blocks: campaign.blocks.map((block) => ({
          type: block.block_type,
          position: block.position,
          payload: block.payload,
        })),
        page_paths: campaign.target?.page_paths || [],
        groups: campaign.target?.groups || [],
        include_usernames: campaign.target?.include_usernames || [],
        exclude_usernames: campaign.target?.exclude_usernames || [],
      },
      username,
    );
  }

  isCampaignEligible(campaign, user, pagePath) {
    const target = campaign.target || {};
    const state = campaign.delivery_state || {};
    const now = new Date();

    if (campaign.status !== "active") return false;
    if (campaign.start_at && new Date(campaign.start_at) > now) return false;
    if (campaign.end_at && new Date(campaign.end_at) < now) return false;

    const includeList = (target.include_usernames || []).map((entry) => entry.toLowerCase());
    const excludeList = (target.exclude_usernames || []).map((entry) => entry.toLowerCase());
    const groupList = target.groups || [];
    const username = String(user.username || "").toLowerCase();

    if (excludeList.includes(username)) return false;

    const explicitlyIncluded = includeList.includes(username);
    if (!explicitlyIncluded && groupList.length) {
      if (!user.group || !groupList.includes(user.group)) {
        return false;
      }
    }

    if (campaign.placement === "page-scoped" && !matchesPage(pagePath, target.page_paths || [])) {
      return false;
    }

    if (state.hidden_forever) return false;
    if (isCooldownActive(state.last_seen_at, campaign.cooldown_minutes)) return false;

    switch (campaign.frequency_mode) {
      case "once":
        return !state.impressions_count;
      case "until_dismissed":
        return !state.dismissed_at;
      case "until_response":
        return !state.completed_at;
      case "max_n_times":
        return (state.impressions_count || 0) < (campaign.max_impressions || 1);
      case "until_end_date":
      case "always":
      default:
        return true;
    }
  }

  async listActiveCampaigns(username, pagePath) {
    const [{ data: user, error: userError }, { data: campaigns, error: campaignError }] =
      await Promise.all([
        supabase.from("users").select("username, \"group\"").eq("username", username).single(),
        supabase
          .from("campaigns")
          .select("*")
          .eq("status", "active")
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false }),
      ]);

    if (userError || !user) {
      return {
        status: 404,
        body: { success: false, error: "Utilisateur introuvable." },
      };
    }
    if (campaignError) {
      return {
        status: 500,
        body: { success: false, error: "Impossible de charger les campagnes." },
      };
    }

    const campaignIds = (campaigns || []).map((campaign) => campaign.id);
    const [{ blocksByCampaign, targetsByCampaign }, { data: statesData, error: statesError }] =
      await Promise.all([
        this.getCampaignBundle(campaignIds),
        campaignIds.length
          ? supabase
              .from("campaign_delivery_states")
              .select("*")
              .eq("username", username)
              .in("campaign_id", campaignIds)
          : Promise.resolve({ data: [] }),
      ]);

    if (statesError) {
      return {
        status: 500,
        body: { success: false, error: "Impossible de charger l'état des campagnes." },
      };
    }

    const statesByCampaign = new Map();
    (statesData || []).forEach((state) => statesByCampaign.set(state.campaign_id, state));

    const normalizedPage = PAGE_PREFIXES.find((prefix) => pagePath.startsWith(prefix)) || pagePath;
    const eligible = (campaigns || [])
      .map((campaign) =>
        this.serializeCampaign(
          campaign,
          blocksByCampaign.get(campaign.id) || [],
          targetsByCampaign.get(campaign.id) || null,
          statesByCampaign.get(campaign.id) || null,
        ),
      )
      .filter((campaign) => this.isCampaignEligible(campaign, user, normalizedPage));

    return { status: 200, body: { success: true, campaigns: eligible } };
  }

  async ensureCampaignExists(id) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, frequency_mode, dismiss_mode")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  async upsertDeliveryState(id, username, patchBuilder) {
    const { data: existing } = await supabase
      .from("campaign_delivery_states")
      .select("*")
      .eq("campaign_id", id)
      .eq("username", username)
      .maybeSingle();

    const next = patchBuilder(existing || null);

    const { data, error } = await supabase
      .from("campaign_delivery_states")
      .upsert([
        {
          campaign_id: id,
          username,
          created_at: existing?.created_at || new Date().toISOString(),
          ...existing,
          ...next,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async recordImpression(id, username) {
    const campaign = await this.ensureCampaignExists(id);
    if (!campaign) {
      return {
        status: 404,
        body: { success: false, error: "Campagne introuvable." },
      };
    }

    const state = await this.upsertDeliveryState(id, username, (existing) => ({
      impressions_count: (existing?.impressions_count || 0) + 1,
      last_seen_at: new Date().toISOString(),
    }));

    return { status: 200, body: { success: true, delivery_state: state } };
  }

  async dismissCampaign(id, username, hideForever = false) {
    const campaign = await this.ensureCampaignExists(id);
    if (!campaign) {
      return {
        status: 404,
        body: { success: false, error: "Campagne introuvable." },
      };
    }

    const state = await this.upsertDeliveryState(id, username, (existing) => ({
      dismissed_at:
        campaign.frequency_mode === "until_dismissed"
          ? new Date().toISOString()
          : existing?.dismissed_at || null,
      hidden_forever: hideForever ? true : existing?.hidden_forever || false,
      last_interacted_at: new Date().toISOString(),
    }));

    return { status: 200, body: { success: true, delivery_state: state } };
  }

  async submitResponse(id, username, payload = {}) {
    const campaign = await this.getAdminCampaign(id);
    if (!campaign) {
      return {
        status: 404,
        body: { success: false, error: "Campagne introuvable." },
      };
    }

    const responses = Array.isArray(payload.responses) ? payload.responses : [];
    if (!responses.length) {
      return {
        status: 400,
        body: { success: false, error: "Aucune réponse à enregistrer." },
      };
    }

    const blocksById = new Map(campaign.blocks.map((block) => [block.id, block]));
    const upserts = [];

    try {
      responses.forEach((response) => {
        const block = blocksById.get(response.block_id);
        if (!block) {
          throw new Error("BLOCK_NOT_FOUND");
        }

        if (block.block_type === "poll") {
          const options = block.payload?.options || [];
          const selectedOptions = normalizeArray(
            Array.isArray(response.selected_options)
              ? response.selected_options
              : response.selected_options
                ? [response.selected_options]
                : [],
            12,
          );
          if (!selectedOptions.length || selectedOptions.some((option) => !options.includes(option))) {
            throw new Error("POLL_RESPONSE_INVALID");
          }
          upserts.push({
            campaign_id: id,
            campaign_block_id: block.id,
            username,
            response_type: "poll",
            payload: {
              selected_options: selectedOptions,
            },
            updated_at: new Date().toISOString(),
          });
          return;
        }

        if (block.block_type === "textarea") {
          const text = normalizeText(response.text, block.payload?.max_length || 600);
          if (block.payload?.required !== false && !text) {
            throw new Error("TEXT_RESPONSE_INVALID");
          }
          upserts.push({
            campaign_id: id,
            campaign_block_id: block.id,
            username,
            response_type: "text",
            payload: {
              text,
            },
            updated_at: new Date().toISOString(),
          });
          return;
        }

        throw new Error("BLOCK_NOT_RESPONDABLE");
      });

      const { data, error } = await supabase
        .from("campaign_responses")
        .upsert(upserts, { onConflict: "campaign_block_id,username" })
        .select("*");

      if (error) {
        throw new Error(error.message);
      }

      const state = await this.upsertDeliveryState(id, username, (existing) => ({
        completed_at: new Date().toISOString(),
        last_interacted_at: new Date().toISOString(),
        hidden_forever: existing?.hidden_forever || false,
      }));

      return {
        status: 200,
        body: { success: true, responses: data || [], delivery_state: state },
      };
    } catch (error) {
      const messageMap = {
        BLOCK_NOT_FOUND: "Bloc de réponse introuvable.",
        POLL_RESPONSE_INVALID: "La réponse au sondage est invalide.",
        TEXT_RESPONSE_INVALID: "La réponse texte est invalide.",
        BLOCK_NOT_RESPONDABLE: "Ce bloc ne peut pas recevoir de réponse.",
      };

      return {
        status: 400,
        body: {
          success: false,
          error: messageMap[error.message] || "Impossible d'enregistrer la réponse.",
        },
      };
    }
  }
}

module.exports = new CampaignService();
