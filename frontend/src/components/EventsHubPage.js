import { ArrowRight, BarChart3, LogOut, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchApi } from "../utils/api";

const EventsHubPage = ({ user }) => {
  const navigate = useNavigate();
  const associations = user?.association_roles || [];

  const logout = async () => {
    await fetchApi("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Événements
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-secondary mt-1">
              Vous voulez ajouter votre évent ?
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/calendars")}
            className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Retour au calendrier
          </button>
        </div>

        {!associations.length && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:p-5 text-amber-950 flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0 text-amber-500" size={18} />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm md:text-base font-medium leading-relaxed">
                Pour ajouter un événement, il faut être membre d'une association
                sur le site de Centrale Lille Associations. Si vous pensez que
                vous avez un rôle qui n'est pas affiché ici, vous pouvez vous
                reconnecter avec CLA pour actualiser la base de données.
              </p>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
              >
                <LogOut size={16} /> Se déconnecter puis se reconnecter
              </button>
            </div>
          </div>
        )}
      </div>

      {associations.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-secondary">
              Mes associations
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Cliquez sur une association pour gérer ses événements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {associations.map((association) => (
              <button
                key={association.association_slug}
                type="button"
                onClick={() =>
                  navigate(
                    `/events/association/${association.association_slug}`,
                  )
                }
                className="text-left rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:border-primary hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {association.role}
                    </p>
                    <h4 className="text-lg font-bold text-secondary mt-1">
                      {association.association_name}
                    </h4>
                  </div>
                  <ArrowRight className="text-primary shrink-0" />
                </div>
                <p className="text-xs text-gray-500 mt-3 break-all">
                  {association.association_slug}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {user?.is_admin && (
        <div className="bg-secondary/5 rounded-2xl p-6 border border-secondary/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-secondary">
                Admin
              </p>
              <h3 className="text-xl font-bold text-secondary mt-1">
                Administration complète
              </h3>
              <p className="text-sm text-gray-600 mt-2 max-w-2xl">
                Accès à toutes les associations, tous les événements et aux
                outils d’administration.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/events/admin")}
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Ouvrir l'admin
            </button>
            <button
              type="button"
              onClick={() => navigate("/analytics/admin")}
              className="inline-flex items-center gap-2 rounded-lg border border-secondary/20 bg-white px-4 py-2 text-secondary font-semibold hover:bg-secondary/5 transition-colors"
            >
              <BarChart3 size={16} /> Analytics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsHubPage;
