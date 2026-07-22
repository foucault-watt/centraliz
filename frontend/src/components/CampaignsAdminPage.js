import {
  Bell,
  ClipboardList,
  Copy,
  Eye,
  LayoutTemplate,
  MessageSquareText,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchApi } from "../utils/api";
import {
  campaignBlockOptions,
  campaignDismissOptions,
  campaignFrequencyOptions,
  campaignPageOptions,
  campaignPlacementOptions,
  campaignPresentationOptions,
  campaignResponseOptions,
  campaignStatusOptions,
  campaignTypeOptions,
  createDefaultCampaignDraft,
} from "../config/campaigns";
import { CampaignPreviewFrame } from "./CampaignSurface";

const pageVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut", staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

const typeIcons = {
  alert: Bell,
  announcement: Send,
  poll: ClipboardList,
  prompt: MessageSquareText,
  stack: LayoutTemplate,
};

const toDraft = (campaign) => ({
  id: campaign.id,
  title: campaign.title || "",
  body: campaign.body || "",
  type: campaign.type || "alert",
  status: campaign.status || "draft",
  placement: campaign.placement || "global",
  presentation: campaign.presentation || "modal",
  dismiss_mode: campaign.dismiss_mode || "dismissible",
  response_mode: campaign.response_mode || "none",
  frequency_mode: campaign.frequency_mode || "once",
  priority: campaign.priority ?? 100,
  max_impressions: campaign.max_impressions ?? "",
  cooldown_minutes: campaign.cooldown_minutes ?? 0,
  start_at: campaign.start_at ? campaign.start_at.slice(0, 16) : "",
  end_at: campaign.end_at ? campaign.end_at.slice(0, 16) : "",
  page_paths: campaign.target?.page_paths || [],
  groups: campaign.target?.groups || [],
  include_usernames: campaign.target?.include_usernames || [],
  exclude_usernames: campaign.target?.exclude_usernames || [],
  blocks: (campaign.blocks || []).map((block) => ({
    id: block.id,
    type: block.block_type,
    payload: { ...(block.payload || {}) },
  })),
  responses: campaign.responses || [],
});

const toPayload = (draft) => ({
  title: draft.title,
  body: draft.body,
  type: draft.type,
  status: draft.status,
  placement: draft.placement,
  presentation: draft.presentation,
  dismiss_mode: draft.dismiss_mode,
  response_mode: draft.response_mode,
  frequency_mode: draft.frequency_mode,
  priority: Number(draft.priority) || 0,
  max_impressions:
    draft.frequency_mode === "max_n_times" && draft.max_impressions !== ""
      ? Number(draft.max_impressions)
      : null,
  cooldown_minutes: Number(draft.cooldown_minutes) || 0,
  start_at: draft.start_at || null,
  end_at: draft.end_at || null,
  page_paths: draft.page_paths,
  groups: draft.groups,
  include_usernames: draft.include_usernames,
  exclude_usernames: draft.exclude_usernames,
  blocks: draft.blocks.map((block, index) => ({
    id: block.id,
    type: block.type,
    position: index,
    payload: block.payload,
  })),
});

const statusTone = (status) => {
  if (status === "active") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "paused") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "archived") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const splitCommaValues = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const formatDateTime = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const fieldClass = "ui-input mt-1";
const selectClass = "ui-select mt-1";
const textareaClass = "ui-textarea mt-1";
const secondaryButtonClass =
  "ui-button-secondary min-h-0 px-3 py-2 text-sm";
const primaryButtonClass =
  "ui-button-primary min-h-0 px-4 py-2.5 text-sm";

const BlockEditor = ({ block, index, onChange, onRemove }) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-500">
          Bloc {index + 1}
        </span>
        <select
          className="ui-select"
          value={block.type}
          onChange={(event) =>
            onChange({
              ...block,
              type: event.target.value,
              payload: {},
            })
          }
        >
          {campaignBlockOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger/10"
        aria-label="Supprimer le bloc"
      >
        <Trash2 size={16} />
      </button>
    </div>

    {block.type === "text" && (
      <div className="grid gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Texte</span>
          <textarea
            className="ui-textarea mt-1 min-h-[110px]"
            value={block.payload?.text || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  text: event.target.value,
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Ton</span>
          <select
            className="ui-select mt-1"
            value={block.payload?.tone || "default"}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  tone: event.target.value,
                },
              })
            }
          >
            <option value="default">Neutre</option>
            <option value="info">Info</option>
            <option value="success">Succès</option>
            <option value="warning">Avertissement</option>
            <option value="danger">Critique</option>
          </select>
        </label>
      </div>
    )}

    {block.type === "cta" && (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Libellé</span>
          <input
            className="ui-input mt-1"
            value={block.payload?.label || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  label: event.target.value,
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Lien</span>
          <input
            className="ui-input mt-1"
            value={block.payload?.href || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  href: event.target.value,
                },
              })
            }
            placeholder="https://..."
          />
        </label>
      </div>
    )}

    {block.type === "poll" && (
      <div className="grid gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Question</span>
          <input
            className="ui-input mt-1"
            value={block.payload?.question || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  question: event.target.value,
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-secondary">
            Options
          </span>
          <textarea
            className="ui-textarea mt-1 min-h-[100px]"
            value={(block.payload?.options || []).join(", ")}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  options: splitCommaValues(event.target.value),
                },
              })
            }
            placeholder="Option 1, Option 2, Option 3"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(block.payload?.allow_multiple)}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  allow_multiple: event.target.checked,
                },
              })
            }
          />
          Autoriser plusieurs choix
        </label>
      </div>
    )}

    {block.type === "textarea" && (
      <div className="grid gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Question</span>
          <input
            className="ui-input mt-1"
            value={block.payload?.prompt || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  prompt: event.target.value,
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-secondary">
            Placeholder
          </span>
          <input
            className="ui-input mt-1"
            value={block.payload?.placeholder || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  placeholder: event.target.value,
                },
              })
            }
          />
        </label>
      </div>
    )}

    {block.type === "event-highlight" && (
      <div className="grid gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Titre</span>
          <input
            className="ui-input mt-1"
            value={block.payload?.title || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  title: event.target.value,
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-secondary">Description</span>
          <textarea
            className="ui-textarea mt-1 min-h-[100px]"
            value={block.payload?.description || ""}
            onChange={(event) =>
              onChange({
                ...block,
                payload: {
                  ...block.payload,
                  description: event.target.value,
                },
              })
            }
          />
        </label>
      </div>
    )}
  </div>
);

const CampaignsAdminPage = ({ user }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState("new");
  const [draft, setDraft] = useState(() => createDefaultCampaignDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [groupOptions, setGroupOptions] = useState([]);
  const [customGroupInput, setCustomGroupInput] = useState("");
  const [detailResponses, setDetailResponses] = useState([]);
  const [detailDeliveryStates, setDetailDeliveryStates] = useState([]);
  const [detailCampaign, setDetailCampaign] = useState(null);

  const isAdmin = Boolean(user?.is_admin);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignResponse, optionsResponse] = await Promise.all([
        fetchApi("/api/campaigns/admin"),
        fetchApi("/api/campaigns/admin/options"),
      ]);
      const [campaignPayload, optionsPayload] = await Promise.all([
        campaignResponse.json(),
        optionsResponse.json(),
      ]);
      setCampaigns(campaignPayload.success ? campaignPayload.campaigns || [] : []);
      setGroupOptions(optionsPayload.success ? optionsPayload.options?.groups || [] : []);
    } catch (error) {
      console.error("[CampaignsAdmin] Erreur de chargement:", error);
      setCampaigns([]);
      setGroupOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadCampaigns();
    }
  }, [isAdmin, loadCampaigns]);

  const loadCampaignDetail = useCallback(async (campaignId) => {
    if (!campaignId || campaignId === "new") {
      setDetailResponses([]);
      setDetailDeliveryStates([]);
      setDetailCampaign(null);
      return;
    }
    try {
      const response = await fetchApi(`/api/campaigns/admin/${campaignId}`);
      const payload = await response.json();
      if (response.ok && payload.success && payload.campaign) {
        setDetailCampaign(payload.campaign);
        setDraft(toDraft(payload.campaign));
        setDetailResponses(payload.campaign.responses || []);
        setDetailDeliveryStates(payload.campaign.delivery_states || []);
      }
    } catch (error) {
      console.error("[CampaignsAdmin] Erreur de détail:", error);
    }
  }, []);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) || null,
    [campaigns, selectedId],
  );

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(createDefaultCampaignDraft());
      setDetailResponses([]);
      setDetailDeliveryStates([]);
      setDetailCampaign(null);
      return;
    }
    if (selectedCampaign) {
      setDraft(toDraft(selectedCampaign));
      setDetailResponses(selectedCampaign.responses || []);
      setDetailDeliveryStates(selectedCampaign.delivery_states || []);
      setDetailCampaign(selectedCampaign);
      loadCampaignDetail(selectedCampaign.id);
    }
  }, [loadCampaignDetail, selectedCampaign, selectedId]);

  const pushStatus = (message) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(""), 3200);
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const payload = toPayload(draft);
      const response = await fetchApi(
        draft.id ? `/api/campaigns/admin/${draft.id}` : "/api/campaigns/admin",
        {
          method: draft.id ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible d'enregistrer la campagne.");
      }

      await loadCampaigns();
      const nextId = data.campaign?.id || draft.id || "new";
      setSelectedId(nextId);
      setDetailCampaign(data.campaign);
      setDraft(toDraft(data.campaign));
      pushStatus("Campagne enregistrée.");
    } catch (error) {
      pushStatus(error.message || "Erreur pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateDraft = async () => {
    if (!draft.id) return;
    try {
      const response = await fetchApi(`/api/campaigns/admin/${draft.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible de dupliquer la campagne.");
      }
      await loadCampaigns();
      setSelectedId(data.campaign.id);
      setDetailCampaign(data.campaign);
      setDraft(toDraft(data.campaign));
      pushStatus("Campagne dupliquée.");
    } catch (error) {
      pushStatus(error.message || "Erreur pendant la duplication.");
    }
  };

  const deleteDraft = async () => {
    if (!draft.id || !window.confirm("Supprimer cette campagne ?")) return;
    try {
      const response = await fetchApi(`/api/campaigns/admin/${draft.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Suppression impossible.");
      }
      await loadCampaigns();
      setSelectedId("new");
      setDraft(createDefaultCampaignDraft());
      pushStatus("Campagne supprimée.");
    } catch (error) {
      pushStatus(error.message || "Erreur pendant la suppression.");
    }
  };

  const togglePagePath = (pagePath) => {
    setDraft((prev) => ({
      ...prev,
      page_paths: prev.page_paths.includes(pagePath)
        ? prev.page_paths.filter((entry) => entry !== pagePath)
        : [...prev.page_paths, pagePath],
    }));
  };

  const toggleGroup = (groupValue) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.includes(groupValue)
        ? prev.groups.filter((entry) => entry !== groupValue)
        : [...prev.groups, groupValue],
    }));
  };

  const addBlock = () => {
    setDraft((prev) => ({
      ...prev,
      blocks: [...prev.blocks, { type: "text", payload: { text: "", tone: "default" } }],
    }));
  };

  const previewCampaign = useMemo(() => {
    const fakeId = draft.id || "preview";
    return {
      id: fakeId,
      title: draft.title || "Campagne sans titre",
      body: draft.body,
      type: draft.type,
      status: draft.status,
      lifecycle_state: draft.status,
      placement: draft.placement,
      presentation: draft.presentation,
      priority: draft.priority,
      dismiss_mode: draft.dismiss_mode,
      response_mode: draft.response_mode,
      frequency_mode: draft.frequency_mode,
      blocks: draft.blocks.map((block, index) => ({
        id: block.id || `${fakeId}-${index}`,
        block_type: block.type,
        position: index,
        payload: block.payload,
      })),
      target: {
        page_paths: draft.page_paths,
        groups: draft.groups,
        include_usernames: draft.include_usernames,
        exclude_usernames: draft.exclude_usernames,
      },
    };
  }, [draft]);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger/10 p-6 text-danger">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5" />
          <div>
            <p className="font-semibold">Accès admin requis</p>
            <p className="text-sm text-danger/90">
              Cette page est réservée aux administrateurs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.section
        variants={itemVariants}
        className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Centraliz
        </p>
        <h1 className="mt-1 text-3xl font-bold text-secondary">
          Campagnes admin
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Crée des avertissements, annonces, sondages et invites texte sans
          rebuild. Chaque campagne peut viser des pages, des groupes et des
          exceptions utilisateur, avec un rendu mobile prêt à l’emploi.
        </p>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <motion.aside
          variants={itemVariants}
          className="rounded-3xl border border-gray-200 bg-white p-4 shadow-md"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-secondary">Campagnes</p>
              <p className="text-xs text-gray-500">
                Actives, brouillons, planifiées, archivées
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId("new")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Plus size={16} /> Nouveau
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Chargement des campagnes...</p>
          ) : campaigns.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              Aucune campagne pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const Icon = typeIcons[campaign.type] || Bell;
                const isSelected = campaign.id === selectedId;
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => setSelectedId(campaign.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/6"
                        : "border-gray-200 bg-gray-50/70 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                          <Icon size={18} />
                        </span>
                        <div>
                          <p className="font-semibold text-secondary">{campaign.title}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {campaign.presentation} · {campaign.placement}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone(campaign.status)}`}
                      >
                        {campaign.lifecycle_state || campaign.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{campaign.stats?.responses_count || 0} réponses</span>
                      <span>{campaign.stats?.impressions_count || 0} impressions</span>
                      <span>prio {campaign.priority}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </motion.aside>

        <motion.section
          variants={itemVariants}
          className="rounded-3xl border border-gray-200 bg-white p-5 shadow-md"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-secondary">
                {draft.id ? "Édition de campagne" : "Nouvelle campagne"}
              </p>
              <p className="text-xs text-gray-500">
                Type, règles de diffusion, ciblage et contenu
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusMessage && (
                <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                  {statusMessage}
                </span>
              )}
              {draft.id && (
                <button
                  type="button"
                  onClick={duplicateDraft}
                  className={secondaryButtonClass}
                >
                  <Copy size={16} /> Dupliquer
                </button>
              )}
              {draft.id && (
                <button
                  type="button"
                  onClick={deleteDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-danger/20 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              )}
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className={primaryButtonClass}
              >
                <Save size={16} /> {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-secondary">Titre</span>
                <input
                  className={fieldClass}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">Type</span>
                <select
                  className={selectClass}
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, type: event.target.value }))
                  }
                >
                  {campaignTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-secondary">
                  Texte d’introduction
                </span>
                <textarea
                  className={`${textareaClass} min-h-[96px]`}
                  value={draft.body}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, body: event.target.value }))
                  }
                />
              </label>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-slate-50/60 p-4">
              <div className="mb-4">
                <p className="font-semibold text-secondary">Diffusion</p>
                <p className="text-xs text-gray-500">
                  Règles d'affichage, temporalité et fréquence
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-secondary">Statut</span>
                <select
                  className={selectClass}
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  {campaignStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Placement
                </span>
                <select
                  className={selectClass}
                  value={draft.placement}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, placement: event.target.value }))
                  }
                >
                  {campaignPlacementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Présentation
                </span>
                <select
                  className={selectClass}
                  value={draft.presentation}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, presentation: event.target.value }))
                  }
                >
                  {campaignPresentationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Fermeture
                </span>
                <select
                  className={selectClass}
                  value={draft.dismiss_mode}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, dismiss_mode: event.target.value }))
                  }
                >
                  {campaignDismissOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Réponse attendue
                </span>
                <select
                  className={selectClass}
                  value={draft.response_mode}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, response_mode: event.target.value }))
                  }
                >
                  {campaignResponseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Fréquence
                </span>
                <select
                  className={selectClass}
                  value={draft.frequency_mode}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, frequency_mode: event.target.value }))
                  }
                >
                  {campaignFrequencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">Priorité</span>
                <input
                  type="number"
                  className={fieldClass}
                  value={draft.priority}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, priority: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Cooldown (minutes)
                </span>
                <input
                  type="number"
                  className={fieldClass}
                  value={draft.cooldown_minutes}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      cooldown_minutes: event.target.value,
                    }))
                  }
                />
              </label>
              {draft.frequency_mode === "max_n_times" && (
                <label className="block">
                  <span className="text-sm font-semibold text-secondary">
                    Max impressions
                  </span>
                  <input
                    type="number"
                    className={fieldClass}
                    value={draft.max_impressions}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        max_impressions: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <label className="block">
                <span className="text-sm font-semibold text-secondary">
                  Début
                </span>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={draft.start_at}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, start_at: event.target.value }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-secondary">Fin</span>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={draft.end_at}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, end_at: event.target.value }))
                  }
                />
              </label>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-secondary">Ciblage</p>
                  <p className="text-xs text-gray-500">
                    Pages, groupes et exceptions utilisateur
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-secondary">Pages</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {campaignPageOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => togglePagePath(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          draft.page_paths.includes(option.value)
                            ? "border-primary bg-primary/8 text-primary"
                            : "border-gray-200 bg-white text-gray-600 hover:border-primary/30"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-secondary">Groupes</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groupOptions.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          draft.groups.includes(group)
                            ? "border-primary bg-primary/8 text-primary"
                            : "border-gray-200 bg-white text-gray-600 hover:border-primary/30"
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="ui-input"
                      value={customGroupInput}
                      onChange={(event) => setCustomGroupInput(event.target.value)}
                      placeholder="Ajouter un groupe manuel"
                    />
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => {
                        const values = splitCommaValues(customGroupInput);
                        if (!values.length) return;
                        setDraft((prev) => ({
                          ...prev,
                          groups: Array.from(new Set([...prev.groups, ...values])),
                        }));
                        setCustomGroupInput("");
                      }}
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-secondary">
                      Utilisateurs inclus
                    </span>
                    <textarea
                      className={`${textareaClass} min-h-[86px]`}
                      value={draft.include_usernames.join(", ")}
                      onChange={(event) => {
                        setDraft((prev) => ({
                          ...prev,
                          include_usernames: splitCommaValues(event.target.value),
                        }));
                      }}
                      placeholder="username1, username2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-secondary">
                      Utilisateurs exclus
                    </span>
                    <textarea
                      className={`${textareaClass} min-h-[86px]`}
                      value={draft.exclude_usernames.join(", ")}
                      onChange={(event) => {
                        setDraft((prev) => ({
                          ...prev,
                          exclude_usernames: splitCommaValues(event.target.value),
                        }));
                      }}
                      placeholder="username3, username4"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-secondary">Blocs</p>
                  <p className="text-xs text-gray-500">
                    Compose la campagne sans code
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBlock}
                  className={secondaryButtonClass}
                >
                  <Plus size={16} /> Ajouter un bloc
                </button>
              </div>
              <div className="space-y-4">
                {draft.blocks.map((block, index) => (
                  <BlockEditor
                    key={`${block.id || "new"}-${index}`}
                    block={block}
                    index={index}
                    onChange={(nextBlock) =>
                      setDraft((prev) => ({
                        ...prev,
                        blocks: prev.blocks.map((entry, blockIndex) =>
                          blockIndex === index ? nextBlock : entry,
                        ),
                      }))
                    }
                    onRemove={() =>
                      setDraft((prev) => ({
                        ...prev,
                        blocks: prev.blocks.filter((_, blockIndex) => blockIndex !== index),
                      }))
                    }
                  />
                ))}
              </div>
            </section>

            {detailResponses.length > 0 && (
              <section className="rounded-2xl border border-gray-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Eye size={16} className="text-primary" />
                  <p className="font-semibold text-secondary">Dernières réponses</p>
                </div>
                <div className="space-y-3">
                  {detailResponses.slice(0, 8).map((response) => (
                    <div
                      key={response.id}
                      className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3 text-sm"
                    >
                      <p className="font-semibold text-secondary">
                        {response.users?.display_name || response.username}
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-gray-700">
                        {JSON.stringify(response.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {draft.id && (
              <section className="rounded-2xl border border-gray-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Eye size={16} className="text-primary" />
                  <div>
                    <p className="font-semibold text-secondary">Impressions</p>
                    <p className="text-xs text-gray-500">
                      Qui a vu la campagne, combien de fois et quand
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Impressions
                    </p>
                    <p className="mt-1 text-xl font-bold text-secondary">
                      {detailCampaign?.stats?.impressions_count || 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Vues uniques
                    </p>
                    <p className="mt-1 text-xl font-bold text-secondary">
                      {detailCampaign?.stats?.unique_viewers || 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Dernière vue
                    </p>
                    <p className="mt-1 text-sm font-semibold text-secondary">
                      {formatDateTime(detailCampaign?.stats?.last_impression_at)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Réponses
                    </p>
                    <p className="mt-1 text-xl font-bold text-secondary">
                      {detailCampaign?.stats?.responses_count || 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Dismiss
                    </p>
                    <p className="mt-1 text-xl font-bold text-secondary">
                      {detailCampaign?.stats?.dismissed_count || 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Masqués
                    </p>
                    <p className="mt-1 text-xl font-bold text-secondary">
                      {detailCampaign?.stats?.hidden_count || 0}
                    </p>
                  </div>
                </div>

                {detailDeliveryStates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    Aucune impression enregistrée pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailDeliveryStates.map((state) => (
                      <div
                        key={`${state.campaign_id}-${state.username}`}
                        className="rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-secondary">
                              {state.users?.display_name || state.username}
                            </p>
                            <p className="text-xs text-gray-500">
                              {state.username}
                              {state.users?.group ? ` · ${state.users.group}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="ui-badge">
                              {state.impressions_count || 0} impression(s)
                            </span>
                            {state.completed_at && <span className="ui-badge">a répondu</span>}
                            {state.dismissed_at && <span className="ui-badge">dismiss</span>}
                            {state.hidden_forever && <span className="ui-badge">masqué</span>}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-3">
                          <p>
                            <strong>Dernière vue :</strong> {formatDateTime(state.last_seen_at)}
                          </p>
                          <p>
                            <strong>Dernière interaction :</strong> {formatDateTime(state.last_interacted_at)}
                          </p>
                          <p>
                            <strong>Réponse complétée :</strong> {formatDateTime(state.completed_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </motion.section>

        <motion.aside
          variants={itemVariants}
          className="space-y-4"
        >
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <Eye size={16} className="text-primary" />
              <div>
                <p className="font-semibold text-secondary">Aperçu mobile</p>
                <p className="text-xs text-gray-500">
                  Même renderer que côté étudiant
                </p>
              </div>
            </div>
            <CampaignPreviewFrame campaign={previewCampaign} />
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center gap-2">
              <LayoutTemplate size={16} className="text-primary" />
              <p className="font-semibold text-secondary">Résumé de diffusion</p>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>Pages :</strong>{" "}
                {draft.page_paths.length ? draft.page_paths.join(", ") : "toutes"}
              </p>
              <p>
                <strong>Groupes :</strong>{" "}
                {draft.groups.length ? draft.groups.join(", ") : "tous"}
              </p>
              <p>
                <strong>Exceptions + :</strong>{" "}
                {draft.include_usernames.length || 0}
              </p>
              <p>
                <strong>Exceptions - :</strong>{" "}
                {draft.exclude_usernames.length || 0}
              </p>
              <p>
                <strong>Fréquence :</strong> {draft.frequency_mode}
              </p>
              <p>
                <strong>Blocs :</strong> {draft.blocks.length}
              </p>
              <p>
                <strong>Impressions :</strong> {detailCampaign?.stats?.impressions_count || 0}
              </p>
            </div>
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
};

export default CampaignsAdminPage;
