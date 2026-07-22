import {
  CheckCircle2,
  History,
  MessageCircle,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "../utils/api";

const feedbackTypes = [
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Bug" },
  { value: "question", label: "Question" },
  { value: "content", label: "Contenu" },
  { value: "other", label: "Autre" },
];

const feedbackAreas = [
  { value: "general", label: "Général" },
  { value: "notes", label: "Notes" },
  { value: "calendars", label: "Calendriers" },
  { value: "mails", label: "Mails" },
  { value: "links", label: "Liens" },
  { value: "cekilui", label: "Cékilui" },
  { value: "events", label: "Événements" },
  { value: "install", label: "Installation" },
];

const priorities = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "bloquant", label: "Bloquant" },
];

const adminStatuses = [
  { value: "new", label: "Nouveau" },
  { value: "read", label: "Lu" },
  { value: "planned", label: "Prévu" },
  { value: "done", label: "Traité" },
  { value: "rejected", label: "Refusé" },
];

const toMap = (items) =>
  items.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

const statusLabels = toMap(adminStatuses);
const typeLabels = toMap(feedbackTypes);
const areaLabels = toMap(feedbackAreas);

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const SectionCard = ({ icon: Icon, kicker, title, children }) => (
  <section className="bg-white rounded-2xl p-5 md:p-6 shadow-md border border-gray-200">
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {kicker}
        </p>
        <h2 className="text-xl md:text-2xl font-bold text-secondary mt-1">
          {title}
        </h2>
      </div>
    </div>
    {children}
  </section>
);

const FeedbackMeta = ({ feedback }) => (
  <div className="flex flex-wrap gap-2 text-xs">
    <span className="ui-badge">{typeLabels[feedback.type] || feedback.type}</span>
    <span className="ui-badge">{areaLabels[feedback.area] || "Général"}</span>
    <span className="ui-badge">
      {statusLabels[feedback.admin_status] || "Nouveau"}
    </span>
    <span className="ui-badge">{feedback.priority || "normal"}</span>
  </div>
);

const FeedbackPage = ({ user }) => {
  const [form, setForm] = useState({
    type: "suggestion",
    area: "general",
    priority: "normal",
    text: "",
    wants_response: true,
  });
  const [submitStatus, setSubmitStatus] = useState("");
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [myLoading, setMyLoading] = useState(true);
  const [adminFeedbacks, setAdminFeedbacks] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState("all");
  const [adminDrafts, setAdminDrafts] = useState({});
  const [adminStatus, setAdminStatus] = useState("");

  const isAdmin = Boolean(user?.is_admin);

  const loadMyFeedbacks = useCallback(async () => {
    setMyLoading(true);
    try {
      const response = await fetchApi("/api/feedback/me");
      const data = await response.json();
      setMyFeedbacks(data.success ? data.feedbacks || [] : []);
    } catch (error) {
      console.error(error);
      setMyFeedbacks([]);
    } finally {
      setMyLoading(false);
    }
  }, []);

  const loadAdminFeedbacks = useCallback(async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try {
      const query = adminFilter === "all" ? "" : `?status=${adminFilter}`;
      const response = await fetchApi(`/api/feedback/admin${query}`);
      const data = await response.json();
      const feedbacks = data.success ? data.feedbacks || [] : [];
      setAdminFeedbacks(feedbacks);
      setAdminDrafts((prev) => {
        const next = { ...prev };
        feedbacks.forEach((feedback) => {
          next[feedback.id] = next[feedback.id] || {
            admin_status: feedback.admin_status || "new",
            admin_response: feedback.admin_response || "",
          };
        });
        return next;
      });
    } catch (error) {
      console.error(error);
      setAdminFeedbacks([]);
    } finally {
      setAdminLoading(false);
    }
  }, [adminFilter, isAdmin]);

  useEffect(() => {
    loadMyFeedbacks();
  }, [loadMyFeedbacks]);

  useEffect(() => {
    loadAdminFeedbacks();
  }, [loadAdminFeedbacks]);

  const submitFeedback = async (event) => {
    event.preventDefault();
    setSubmitStatus("Envoi en cours...");

    try {
      const response = await fetchApi("/api/feedback", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!data.success) {
        setSubmitStatus(data.error || "Envoi impossible.");
        return;
      }

      setSubmitStatus("Merci, ton retour est envoyé.");
      setForm((prev) => ({ ...prev, text: "" }));
      await loadMyFeedbacks();
      if (isAdmin) await loadAdminFeedbacks();
    } catch (error) {
      console.error(error);
      setSubmitStatus("Erreur réseau pendant l'envoi.");
    } finally {
      setTimeout(() => setSubmitStatus(""), 3500);
    }
  };

  const saveAdminFeedback = async (feedbackId) => {
    setAdminStatus("Enregistrement...");
    try {
      const draft = adminDrafts[feedbackId];
      const response = await fetchApi(`/api/feedback/admin/${feedbackId}`, {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      const data = await response.json();

      if (!data.success) {
        setAdminStatus(data.error || "Mise à jour impossible.");
        return;
      }

      setAdminStatus("Retour mis à jour.");
      await loadAdminFeedbacks();
      await loadMyFeedbacks();
    } catch (error) {
      console.error(error);
      setAdminStatus("Erreur réseau pendant la mise à jour.");
    } finally {
      setTimeout(() => setAdminStatus(""), 3500);
    }
  };

  const deleteMyFeedback = async (feedbackId) => {
    if (!window.confirm("Supprimer ce retour ?")) return;
    setSubmitStatus("Suppression...");

    try {
      const response = await fetchApi(`/api/feedback/${feedbackId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        setSubmitStatus(data.error || "Suppression impossible.");
        return;
      }

      setSubmitStatus("Retour supprimé.");
      await loadMyFeedbacks();
      if (isAdmin) await loadAdminFeedbacks();
    } catch (error) {
      console.error(error);
      setSubmitStatus("Erreur réseau pendant la suppression.");
    } finally {
      setTimeout(() => setSubmitStatus(""), 3500);
    }
  };

  const deleteAdminFeedback = async (feedbackId) => {
    if (!window.confirm("Supprimer définitivement ce retour ?")) return;
    setAdminStatus("Suppression...");

    try {
      const response = await fetchApi(`/api/feedback/admin/${feedbackId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!data.success) {
        setAdminStatus(data.error || "Suppression impossible.");
        return;
      }

      setAdminStatus("Retour supprimé.");
      await loadAdminFeedbacks();
      await loadMyFeedbacks();
    } catch (error) {
      console.error(error);
      setAdminStatus("Erreur réseau pendant la suppression.");
    } finally {
      setTimeout(() => setAdminStatus(""), 3500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Centraliz
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-secondary mt-1">
          Donner son avis
        </h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          Une idée, un bug, un détail pénible ? Écris-le ici. Les retours restent
          visibles avec leur statut et une réponse admin quand il y en a une.
        </p>
      </div>

      <SectionCard icon={MessageCircle} kicker="Avis" title="Nouveau retour">
        <form onSubmit={submitFeedback} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-secondary">Type</span>
              <select
                className="ui-select mt-1"
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value }))
                }
              >
                {feedbackTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-secondary">Zone</span>
              <select
                className="ui-select mt-1"
                value={form.area}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, area: event.target.value }))
                }
              >
                {feedbackAreas.map((area) => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-secondary">
                Priorité ressentie
              </span>
              <select
                className="ui-select mt-1"
                value={form.priority}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priority: event.target.value }))
                }
              >
                {priorities.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-secondary">Message</span>
            <textarea
              className="ui-textarea mt-1"
              value={form.text}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, text: event.target.value }))
              }
              maxLength={1000}
              required
              placeholder="Explique vite ce que tu as vu, ce que tu aimerais, ou ce qui bloque."
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.wants_response}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  wants_response: event.target.checked,
                }))
              }
            />
            Je veux une réponse si besoin
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="ui-button-primary">
              <Send size={16} /> Envoyer
            </button>
            {submitStatus && (
              <span className="text-sm font-semibold text-primary">
                {submitStatus}
              </span>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard icon={History} kicker="Historique" title="Mes retours">
        {myLoading ? (
          <p className="text-sm text-gray-600">Chargement des retours...</p>
        ) : myFeedbacks.length === 0 ? (
          <p className="text-sm text-gray-600">
            Aucun retour envoyé pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {myFeedbacks.map((feedback) => (
              <article
                key={feedback.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <FeedbackMeta feedback={feedback} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">
                      {formatDate(feedback.created_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteMyFeedback(feedback.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors"
                      aria-label="Supprimer ce retour"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {feedback.text}
                </p>
                {feedback.admin_response && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-secondary">
                    <p className="font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-primary" />
                      Réponse admin
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {feedback.admin_response}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      {isAdmin && (
        <SectionCard icon={ShieldCheck} kicker="Admin" title="Gestion des retours">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              className="ui-select max-w-xs"
              value={adminFilter}
              onChange={(event) => setAdminFilter(event.target.value)}
            >
              <option value="all">Tous les statuts</option>
              {adminStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            {adminStatus && (
              <span className="text-sm font-semibold text-primary">
                {adminStatus}
              </span>
            )}
          </div>

          {adminLoading ? (
            <p className="text-sm text-gray-600">Chargement des retours...</p>
          ) : adminFeedbacks.length === 0 ? (
            <p className="text-sm text-gray-600">Aucun retour à afficher.</p>
          ) : (
            <div className="space-y-4">
              {adminFeedbacks.map((feedback) => {
                const draft = adminDrafts[feedback.id] || {
                  admin_status: feedback.admin_status || "new",
                  admin_response: feedback.admin_response || "",
                };

                return (
                  <article
                    key={feedback.id}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-bold text-secondary">
                          {feedback.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(feedback.created_at)}
                        </p>
                      </div>
                      <FeedbackMeta feedback={feedback} />
                    </div>

                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {feedback.text}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-3 items-end">
                      <label className="block">
                        <span className="text-sm font-semibold text-secondary">
                          Statut
                        </span>
                        <select
                          className="ui-select mt-1"
                          value={draft.admin_status}
                          onChange={(event) =>
                            setAdminDrafts((prev) => ({
                              ...prev,
                              [feedback.id]: {
                                ...draft,
                                admin_status: event.target.value,
                              },
                            }))
                          }
                        >
                          {adminStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-secondary">
                          Réponse admin
                        </span>
                        <textarea
                          className="ui-textarea mt-1 min-h-[88px]"
                          value={draft.admin_response}
                          onChange={(event) =>
                            setAdminDrafts((prev) => ({
                              ...prev,
                              [feedback.id]: {
                                ...draft,
                                admin_response: event.target.value,
                              },
                            }))
                          }
                          maxLength={1200}
                        />
                      </label>

                      <button
                        type="button"
                        className="ui-button-primary"
                        onClick={() => saveAdminFeedback(feedback.id)}
                      >
                        Enregistrer
                      </button>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => deleteAdminFeedback(feedback.id)}
                        className="ui-button-secondary text-danger hover:text-danger"
                      >
                        <Trash2 size={16} /> Supprimer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};

export default FeedbackPage;
