import { useEffect, useState } from "react";
import { fetchApi } from "../../utils/api";

const formatSpeed = (speed) => `×${String(speed).replace(".", ",")}`;

export default function SpeedControl() {
  const [state, setState] = useState(null);
  const [draftSpeed, setDraftSpeed] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (pending) return undefined;
    const controller = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await fetchApi("/api/pokemon/speed", { signal: controller.signal });
        if ([401, 403, 404].includes(response.status)) {
          if (!controller.signal.aborted) setState({ available: false });
          return;
        }
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
  }, [pending]);

  const selectedSpeed = draftSpeed ?? state?.speed ?? 1;

  async function changeSpeed() {
    setPending(true);
    setError("");
    try {
      const response = await fetchApi("/api/pokemon/speed", {
        method: "PUT",
        body: JSON.stringify({ speed: selectedSpeed }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error);
      setState(result);
      setDraftSpeed(null);
    } catch (failure) {
      setError(failure.message || "Impossible de changer la vitesse.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <fieldset className="rounded-2xl border border-gray-200 bg-white px-4 pb-3">
        <legend className="px-1 text-sm font-semibold text-secondary">Vitesse du jeu (admin)</legend>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-48 flex-1 items-center gap-3 text-sm font-semibold text-secondary">
            <span>{formatSpeed(selectedSpeed)}</span>
            <input
              type="range"
              aria-label="Vitesse du jeu"
              aria-valuetext={formatSpeed(selectedSpeed)}
              min={1}
              max={2}
              step={0.5}
              value={selectedSpeed}
              disabled={!state?.available || pending}
              onChange={(event) => setDraftSpeed(Number(event.target.value))}
              className="min-w-0 flex-1 accent-[var(--color-primary)]"
            />
          </label>
          <button
            type="button"
            disabled={!state?.available || pending || state.speed === selectedSpeed}
            onClick={changeSpeed}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.stopPropagation();
            }}
            className="min-h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Appliquer
          </button>
        </div>
        <p role="status" className="mt-2 text-sm text-gray-600">
          {pending
            ? "Changement de vitesse…"
            : state?.speed
              ? `${formatSpeed(state.speed)} pour toute la partie`
              : state?.available === false
                ? "Commande de vitesse indisponible."
                : "Vitesse actuelle en cours de vérification…"}
        </p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
