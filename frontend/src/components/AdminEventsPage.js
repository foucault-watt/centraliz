import { Plus, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchApi } from "../utils/api";
import EventManagementPage from "./EventManagementPage";

const AdminEventsPage = ({ user }) => {
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [associationForm, setAssociationForm] = useState({
    association_name: "",
    association_slug: "",
    description: "",
  });
  const [isCreatingAssociation, setIsCreatingAssociation] = useState(false);
  const [associationFeedback, setAssociationFeedback] = useState("");

  const slugifyAssociationName = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  useEffect(() => {
    const loadAssociations = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchApi("/api/events/admin/associations");
        const data = await response.json();
        if (!data.success) {
          setError(data.error || "Impossible de charger les associations.");
          return;
        }
        setAssociations(data.associations || []);
      } catch (loadError) {
        console.error(loadError);
        setError("Erreur réseau lors du chargement des associations.");
      } finally {
        setLoading(false);
      }
    };

    if (user?.is_admin) {
      loadAssociations();
    } else {
      setLoading(false);
    }
  }, [user?.is_admin]);

  useEffect(() => {
    if (!associationFeedback) return undefined;
    const timeout = setTimeout(() => setAssociationFeedback(""), 3500);
    return () => clearTimeout(timeout);
  }, [associationFeedback]);

  const createAssociation = async (event) => {
    event.preventDefault();

    const associationName = associationForm.association_name.trim();
    const associationSlug = (
      associationForm.association_slug.trim() ||
      slugifyAssociationName(associationName)
    ).trim();

    if (!associationName || !associationSlug) {
      setAssociationFeedback("Le nom de l'association est requis.");
      return;
    }

    setIsCreatingAssociation(true);
    setAssociationFeedback("");

    try {
      const response = await fetchApi("/api/events/admin/associations", {
        method: "POST",
        body: JSON.stringify({
          association_name: associationName,
          association_slug: associationSlug,
          description: associationForm.description.trim(),
        }),
      });
      const data = await response.json();

      if (!data.success) {
        setAssociationFeedback(data.error || "Création impossible.");
        return;
      }

      setAssociationForm({
        association_name: "",
        association_slug: "",
        description: "",
      });
      setAssociationFeedback("Association créée.");

      const reloadResponse = await fetchApi("/api/events/admin/associations");
      const reloadData = await reloadResponse.json();
      if (reloadData.success) {
        setAssociations(reloadData.associations || []);
      }
    } catch (createError) {
      console.error(createError);
      setAssociationFeedback("Erreur réseau lors de la création.");
    } finally {
      setIsCreatingAssociation(false);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="text-amber-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-secondary">
              Accès admin requis
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Cette vue est réservée aux administrateurs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-10 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-3 text-secondary font-medium">
          Chargement de l'admin...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">
            Associations
          </p>
          <h2 className="text-2xl font-bold text-secondary mt-1">
            Créer une association
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Ajoutez une association depuis l'administration, même si elle
            n'existe encore pour aucun membre.
          </p>
        </div>

        {associationFeedback && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {associationFeedback}
          </div>
        )}

        <form
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          onSubmit={createAssociation}
        >
          <label className="block">
            <span className="text-sm font-semibold text-secondary">
              Nom de l'association
            </span>
            <input
              type="text"
              value={associationForm.association_name}
              onChange={(event) => {
                const nextName = event.target.value;
                setAssociationForm((prev) => ({
                  ...prev,
                  association_name: nextName,
                  association_slug: prev.association_slug
                    ? prev.association_slug
                    : slugifyAssociationName(nextName),
                }));
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Association sportive"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-secondary">Slug</span>
            <input
              type="text"
              value={associationForm.association_slug}
              onChange={(event) =>
                setAssociationForm((prev) => ({
                  ...prev,
                  association_slug: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="association-sportive"
            />
          </label>

          <label className="block md:col-span-1">
            <span className="text-sm font-semibold text-secondary">
              Description
            </span>
            <input
              type="text"
              value={associationForm.description}
              onChange={(event) =>
                setAssociationForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Optionnelle"
            />
          </label>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={isCreatingAssociation}
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Plus size={16} />
              {isCreatingAssociation ? "Création..." : "Créer l'association"}
            </button>
          </div>
        </form>

        {associations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
            {associations.map((association) => (
              <div
                key={association.association_slug}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-secondary">
                      {association.association_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 break-all">
                      {association.association_slug}
                    </p>
                  </div>
                </div>
                {association.created_by && (
                  <p className="text-xs text-gray-500 mt-3">
                    Créée par {association.created_by}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <EventManagementPage
        user={user}
        mode="admin"
        associationOptions={associations}
        title="Administration des événements"
        subtitle="Toutes les associations et tous les événements sont visibles et modifiables ici."
      />
    </div>
  );
};

export default AdminEventsPage;
