import { LogOut, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchApi } from "../utils/api";
import EventManagementPage from "./EventManagementPage";

const AssociationEventsPage = ({ user }) => {
  const navigate = useNavigate();
  const { associationSlug } = useParams();

  const association = useMemo(
    () =>
      (user?.association_roles || []).find(
        (entry) => entry.association_slug === associationSlug,
      ) || null,
    [associationSlug, user?.association_roles],
  );

  if (!association && !(user?.is_admin && associationSlug)) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="text-amber-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-secondary">
              Association introuvable
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Vérifiez que cette association est bien liée à votre compte CLA.
            </p>
            <div className="mt-4 flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/events")}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 font-semibold"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetchApi("/api/auth/logout", { method: "POST" });
                  window.location.href = "/";
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white font-semibold"
              >
                <LogOut size={16} /> Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EventManagementPage
      user={user}
      mode="association"
      association={
        association || {
          association_slug: associationSlug,
          association_name: associationSlug,
        }
      }
      title={association?.association_name || associationSlug}
      subtitle="Gérez les événements de cette association : création, modification et suppression sans popup."
    />
  );
};

export default AssociationEventsPage;
