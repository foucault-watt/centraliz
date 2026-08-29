import { Palette, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchApi } from "../utils/api";

const emptyDraft = () => ({
  id: null,
  name: "",
  colorPrimary: "#597ee5",
  colorPrimaryDark: "#4267ce",
  displayOrder: 0,
  isActive: true,
  iconFile: null,
  removeIcon: false,
});

const toDraft = (entry) => ({
  id: entry.id,
  name: entry.name || "",
  colorPrimary: entry.colorPrimary || "#597ee5",
  colorPrimaryDark: entry.colorPrimaryDark || "",
  displayOrder: entry.displayOrder ?? 0,
  isActive: Boolean(entry.isActive),
  iconFile: null,
  removeIcon: false,
});

const ThemePaletteAdminPage = ({ user }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("new");
  const [draft, setDraft] = useState(emptyDraft());
  const [statusMessage, setStatusMessage] = useState("");

  const isAdmin = Boolean(user?.is_admin);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/api/theme-palette/admin");
      const data = await response.json();
      setEntries(data.success ? data.entries || [] : []);
    } catch (error) {
      console.error("[ThemePaletteAdmin] Erreur de chargement:", error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadEntries();
    }
  }, [isAdmin, loadEntries]);

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyDraft());
      return;
    }
    const entry = entries.find((item) => item.id === selectedId);
    if (entry) {
      setDraft(toDraft(entry));
    }
  }, [selectedId, entries]);

  const pushStatus = (message) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(""), 3200);
  };

  const saveDraft = async () => {
    if (!draft.name || !draft.colorPrimary) {
      pushStatus("Nom et couleur principale requis.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", draft.name);
      formData.append("colorPrimary", draft.colorPrimary);
      if (draft.colorPrimaryDark) {
        formData.append("colorPrimaryDark", draft.colorPrimaryDark);
      }
      formData.append("displayOrder", String(draft.displayOrder));
      formData.append("isActive", String(draft.isActive));
      if (draft.iconFile) {
        formData.append("icon", draft.iconFile);
      }
      if (draft.removeIcon) {
        formData.append("removeIcon", "true");
      }

      const endpoint = draft.id
        ? `/api/theme-palette/admin/${draft.id}`
        : "/api/theme-palette/admin";

      const response = await fetch(`${process.env.REACT_APP_URL_BACK}${endpoint}`, {
        method: draft.id ? "PUT" : "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible d'enregistrer.");
      }

      await loadEntries();
      setSelectedId(data.entry?.id || "new");
      pushStatus("Entrée enregistrée.");
    } catch (error) {
      pushStatus(error.message || "Erreur pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!draft.id || !window.confirm("Supprimer cette entrée de palette ?")) return;
    try {
      const response = await fetchApi(`/api/theme-palette/admin/${draft.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Suppression impossible.");
      }
      await loadEntries();
      setSelectedId("new");
      pushStatus("Entrée supprimée.");
    } catch (error) {
      pushStatus(error.message || "Erreur pendant la suppression.");
    }
  };

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
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Centraliz
        </p>
        <h1 className="mt-1 text-3xl font-bold text-secondary">
          Assos &amp; couleurs admin
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Gère les entrées proposées dans le sélecteur de couleur d'accent
          personnelle (nom, couleur, icône). Séparé du système de parrainage
          BDS existant — ceci ne pilote que la personnalisation privée des
          utilisateurs, jamais un affichage public.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-gray-200 bg-white p-4 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-secondary">Entrées</p>
              <p className="text-xs text-gray-500">{entries.length} au total</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId("new")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              <Plus size={16} /> Nouvelle
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              Aucune entrée pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                    entry.id === selectedId
                      ? "border-primary bg-primary/6"
                      : "border-gray-200 bg-gray-50/70 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {entry.iconUrl ? (
                      <img
                        src={`${process.env.REACT_APP_URL_BACK}${entry.iconUrl}`}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="h-8 w-8 rounded-full shrink-0"
                        style={{ backgroundColor: entry.colorPrimary }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-secondary">
                        {entry.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.isActive ? "Active" : "Inactive"} · ordre{" "}
                        {entry.displayOrder}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-md">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-secondary">
                {draft.id ? "Édition" : "Nouvelle entrée"}
              </p>
              <p className="text-xs text-gray-500">
                Nom, couleurs et icône affichés dans le sélecteur
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
                className="ui-button-primary min-h-0 px-4 py-2.5 text-sm"
              >
                <Save size={16} /> {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-secondary">Nom</span>
              <input
                className="ui-input mt-1"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nom de l'association"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-secondary">Ordre</span>
              <input
                type="number"
                className="ui-input mt-1"
                value={draft.displayOrder}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    displayOrder: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-secondary">
                Couleur principale
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded border border-gray-200"
                  value={draft.colorPrimary}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      colorPrimary: event.target.value,
                    }))
                  }
                />
                <input
                  className="ui-input flex-1"
                  value={draft.colorPrimary}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      colorPrimary: event.target.value,
                    }))
                  }
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-secondary">
                Couleur foncée (optionnel)
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-14 rounded border border-gray-200"
                  value={draft.colorPrimaryDark || draft.colorPrimary}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      colorPrimaryDark: event.target.value,
                    }))
                  }
                />
                <input
                  className="ui-input flex-1"
                  value={draft.colorPrimaryDark}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      colorPrimaryDark: event.target.value,
                    }))
                  }
                  placeholder="Dérivée automatiquement si vide"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-secondary">Icône</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="ui-input mt-1"
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    iconFile: event.target.files?.[0] || null,
                    removeIcon: false,
                  }))
                }
              />
            </label>
            <label className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-gray-700 md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active dans le sélecteur
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Palette size={16} className="text-primary" />
              <p className="font-semibold text-secondary">Aperçu</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <span
                className="h-9 w-9 rounded-full"
                style={{ backgroundColor: draft.colorPrimary }}
              />
              <span className="font-medium text-secondary">
                {draft.name || "Nom de l'association"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ThemePaletteAdminPage;
