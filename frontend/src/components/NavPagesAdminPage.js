import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { pagesCatalog } from "../config/pages";
import { fetchApi } from "../utils/api";
import { invalidateNavPages } from "../utils/navPages";

const NavPagesAdminPage = ({ user }) => {
  const [pages, setPages] = useState([]);
  const [availablePromos, setAvailablePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const isAdmin = Boolean(user?.is_admin);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi("/api/nav-pages/admin");
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      // Inclut les pages du catalogue absentes de la base (inactives par défaut)
      const byId = new Map(data.pages.map((p) => [p.id, p]));
      const merged = pagesCatalog.map((c, i) => ({
        id: c.id,
        isActive: false,
        promos: [],
        displayOrder: 100 + i,
        ...byId.get(c.id),
      }));
      merged.sort((a, b) => a.displayOrder - b.displayOrder);
      setPages(merged);
      setAvailablePromos(data.availablePromos || []);
    } catch (error) {
      console.error("[NavPagesAdmin] Erreur de chargement:", error);
      setStatusMessage("Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const pushStatus = (message) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(""), 3000);
  };

  const save = async (id, patch) => {
    const previous = pages;
    setPages((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSavingId(id);
    try {
      const response = await fetchApi(`/api/nav-pages/admin/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error);
      invalidateNavPages();
      pushStatus("Enregistré.");
    } catch (error) {
      setPages(previous);
      pushStatus(error.message || "Erreur pendant l'enregistrement.");
    } finally {
      setSavingId(null);
    }
  };

  const togglePromo = (page, promo) => {
    const promos = page.promos.includes(promo)
      ? page.promos.filter((p) => p !== promo)
      : [...page.promos, promo];
    save(page.id, { promos });
  };

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    const reordered = [...pages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const withOrder = reordered.map((p, i) => ({ ...p, displayOrder: i }));
    setPages(withOrder);
    Promise.all(
      withOrder.map((p) =>
        fetchApi(`/api/nav-pages/admin/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: p.displayOrder }),
        })
      )
    )
      .then(() => {
        invalidateNavPages();
        pushStatus("Ordre enregistré.");
      })
      .catch(() => pushStatus("Erreur pendant l'enregistrement."));
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger/10 p-6 text-danger">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5" />
          <p className="font-semibold">Accès admin requis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Centraliz</p>
        <h1 className="mt-1 text-3xl font-bold text-secondary">Pages navbar admin</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Active ou désactive les pages de la barre de navigation du bas, et
          choisis les promos qui les voient. Sans promo cochée, la page est
          visible par toutes les promos. Les changements s'appliquent au
          prochain chargement de l'app pour les utilisateurs.
        </p>
        {statusMessage && (
          <span className="mt-3 inline-block rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
            {statusMessage}
          </span>
        )}
      </section>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {pages.map((page, index) => {
            const meta = pagesCatalog.find((c) => c.id === page.id);
            const Icon = meta.icon;
            return (
              <div
                key={page.id}
                className="rounded-3xl border border-gray-200 bg-white p-5 shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="text-primary" />
                    <div>
                      <p className="font-semibold text-secondary">{meta.label}</p>
                      <p className="text-xs text-gray-500">/{page.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:opacity-30"
                      aria-label="Monter"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === pages.length - 1}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      ↓
                    </button>
                    <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-secondary">
                      <input
                        type="checkbox"
                        checked={page.isActive}
                        disabled={savingId === page.id}
                        onChange={(e) => save(page.id, { isActive: e.target.checked })}
                      />
                      {page.isActive ? "Active" : "Inactive"}
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Promos concernées{" "}
                    {page.promos.length === 0 && (
                      <span className="normal-case text-gray-400">(toutes)</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availablePromos.map((promo) => {
                      const selected = page.promos.includes(promo);
                      return (
                        <button
                          key={promo}
                          type="button"
                          disabled={savingId === page.id}
                          onClick={() => togglePromo(page, promo)}
                          className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                            selected
                              ? "border-primary bg-primary text-white"
                              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-primary/40"
                          }`}
                        >
                          {promo}
                        </button>
                      );
                    })}
                    {availablePromos.length === 0 && (
                      <p className="text-sm text-gray-400">Aucune promo trouvée.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NavPagesAdminPage;
