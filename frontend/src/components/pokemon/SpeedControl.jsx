import { useEffect, useState } from "react";
import { fetchApi } from "../../utils/api";

const SPEED_OPTIONS = [
  { speed: 1, label: "×1" },
  { speed: 1.5, label: "×1,5" },
  { speed: 2, label: "×2" },
];

export default function SpeedControl({ canPlay }) {
  const [state, setState] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canPlay || pending) return undefined;
    const controller = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await fetchApi("/api/pokemon/speed", { signal: controller.signal });
        if (response.status === 404) return;
        if (response.ok) {
          const status = await response.json();
          if (!controller.signal.aborted) setState(status);
          if (status.available === false) return;
        }
      } catch {
        // Réessayer tant que le jeu est en ligne.
      }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
    }
    refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [canPlay, pending]);

  async function changeSpeed(speed) {
    setPending(true);
    setError("");
    try {
      const response = await fetchApi("/api/pokemon/speed", {
        method: "PUT",
        body: JSON.stringify({ speed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setState(result);
    } catch (failure) {
      setError(failure.message || "Impossible de changer la vitesse.");
    } finally {
      setPending(false);
    }
  }

  if (!state?.available) return null;

  return (
    <div className="space-y-1">
      <fieldset className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 pb-3">
        <legend className="px-1 text-sm font-semibold text-secondary">Vitesse du jeu (partagée)</legend>
        {SPEED_OPTIONS.map(({ speed, label }) => (
          <button
            key={speed}
            type="button"
            aria-pressed={state.speed === speed}
            disabled={!canPlay || pending}
            onClick={() => changeSpeed(speed)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.stopPropagation();
            }}
            className="min-h-9 rounded-lg bg-gray-100 px-3 text-sm font-semibold text-secondary hover:bg-gray-200 disabled:opacity-50 aria-pressed:bg-primary/10 aria-pressed:text-primary"
          >
            {label}
          </button>
        ))}
        {pending && <p role="status" className="text-sm text-gray-500">Changement de vitesse…</p>}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
