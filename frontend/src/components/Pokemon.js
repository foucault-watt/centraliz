import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Gamepad2,
  Image,
  Play,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApi } from "../utils/api";

const directionalButtons = [
  {
    button: "UP",
    label: "Haut",
    icon: ChevronUp,
    className: "col-start-2 row-start-1",
  },
  {
    button: "LEFT",
    label: "Gauche",
    icon: ChevronLeft,
    className: "col-start-1 row-start-2",
  },
  {
    button: "RIGHT",
    label: "Droite",
    icon: ChevronRight,
    className: "col-start-3 row-start-2",
  },
  {
    button: "DOWN",
    label: "Bas",
    icon: ChevronDown,
    className: "col-start-2 row-start-3",
  },
];

const actionButtons = [
  { button: "A", label: "A", accent: "from-emerald-500 to-teal-500" },
  { button: "B", label: "B", accent: "from-rose-500 to-orange-500" },
  {
    button: "START",
    label: "Start",
    accent: "from-slate-700 to-slate-900",
    wide: true,
  },
];

function Pokemon() {
  const [health, setHealth] = useState({
    loading: true,
    success: false,
    status: "offline",
    error: "",
  });
  const [stream, setStream] = useState({
    loading: true,
    status: "starting",
    hasFrame: false,
    lastFrameAt: null,
    intervalMs: 100,
    format: "webp",
    width: 240,
    height: 160,
    error: "",
  });
  const [frameUrl, setFrameUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [feedback, setFeedback] = useState({
    type: "",
    message: "",
  });
  const latestObjectUrlRef = useRef("");

  const loadHealth = useCallback(async () => {
    setHealth((prev) => ({
      ...prev,
      loading: true,
    }));

    try {
      const response = await fetchApi("/api/pokemon/health", {
        method: "GET",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Le backend Pokémon ne répond pas correctement."
        );
      }

      setHealth({
        loading: false,
        success: true,
        status: result.status || "ok",
        error: "",
      });
    } catch (error) {
      setHealth({
        loading: false,
        success: false,
        status: "offline",
        error:
          error.message ||
          "Impossible de joindre le backend Pokémon pour le moment.",
      });
    }
  }, []);

  const loadStreamStatus = useCallback(async () => {
    try {
      const response = await fetchApi("/api/pokemon/frame-status", {
        method: "GET",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Impossible de récupérer le statut du flux Pokémon."
        );
      }

      setStream({
        loading: false,
        status: result.status || "starting",
        hasFrame: Boolean(result.hasFrame),
        lastFrameAt: result.lastFrameAt || null,
        intervalMs: result.intervalMs || 100,
        format: result.format || "webp",
        width: result.width || 240,
        height: result.height || 160,
        error: result.error || "",
      });
    } catch (error) {
      setStream((prev) => ({
        ...prev,
        loading: false,
        status: "error",
        error:
          error.message ||
          "Impossible de récupérer le statut du flux Pokémon.",
      }));
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadStreamStatus();
  }, [loadHealth, loadStreamStatus]);

  useEffect(() => {
    const refreshFrame = async () => {
      if (!stream.hasFrame) return;

      try {
        const response = await fetchApi(`/api/pokemon/frame?t=${Date.now()}`, {
          method: "GET",
        });

        if (!response.ok) {
          throw new Error("Impossible de charger la frame Pokémon.");
        }

        const frameBlob = await response.blob();
        const nextObjectUrl = URL.createObjectURL(frameBlob);

        setFrameUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          latestObjectUrlRef.current = nextObjectUrl;
          return nextObjectUrl;
        });
      } catch (error) {
        setStream((prev) => ({
          ...prev,
          status: "error",
          error:
            error.message || "Impossible de charger la frame Pokémon.",
        }));
      }
    };

    const frameIntervalMs = Math.max(stream.intervalMs || 100, 100);

    refreshFrame();
    const frameInterval = setInterval(refreshFrame, frameIntervalMs);
    const statusInterval = setInterval(loadStreamStatus, 1500);

    return () => {
      clearInterval(frameInterval);
      clearInterval(statusInterval);
      if (latestObjectUrlRef.current) {
        URL.revokeObjectURL(latestObjectUrlRef.current);
        latestObjectUrlRef.current = "";
      }
    };
  }, [loadStreamStatus, stream.hasFrame, stream.intervalMs]);

  const sendInput = async (button) => {
    setIsSending(true);
    setFeedback({ type: "", message: "" });

    try {
      const response = await fetchApi("/api/pokemon/input", {
        method: "POST",
        body: JSON.stringify({ button }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Impossible d'envoyer la commande.");
      }

      setLastAction(result.button);
      setFeedback({
        type: "success",
        message: result.message || `Bouton ${result.button} envoyé.`,
      });
      setHealth((prev) => ({
        ...prev,
        success: true,
        status: "ok",
        error: "",
      }));
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error.message ||
          "Le backend Pokémon a refusé la commande demandée.",
      });
      setHealth((prev) => ({
        ...prev,
        success: false,
        status: "offline",
        error:
          error.message ||
          "Le backend Pokémon semble indisponible pour le moment.",
      }));
    } finally {
      setIsSending(false);
    }
  };

  const formattedTimestamp = useMemo(() => {
    if (!stream.lastFrameAt) return "—";

    const parsedDate = new Date(stream.lastFrameAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return stream.lastFrameAt;
    }

    return parsedDate.toLocaleTimeString("fr-FR");
  }, [stream.lastFrameAt]);

  const statusTone = health.success
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-rose-200 bg-rose-50 text-rose-900";

  const feedbackTone =
    feedback.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  const streamTone =
    stream.status === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : stream.status === "capturing" || stream.status === "starting"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  const streamBadge =
    stream.status === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : stream.status === "capturing" || stream.status === "starting"
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";

  return (
    <div className="max-w-5xl mx-auto animate-scale-in space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-[0_25px_70px_-40px_rgba(15,23,42,0.45)] md:p-8">
        <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_60%)]" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              <Gamepad2 size={14} />
              Pokemon MVP
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
                Contrôle direct de l&apos;émulateur
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                Chaque clic envoie immédiatement une commande au backend Node,
                qui la relaie à <span className="font-semibold">mGBA-http</span>.
                Cette page sert à valider la chaîne complète React → Node →
                mGBA et à afficher le jeu en quasi temps réel.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHealth}
            disabled={health.loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw
              size={16}
              className={health.loading ? "animate-spin" : ""}
            />
            Vérifier la connexion
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.55)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Statut
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                Backend Pokémon
              </h2>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                health.success
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {health.loading
                ? "Checking"
                : health.success
                ? "Connecté"
                : "Hors ligne"}
            </div>
          </div>

          <div className={`rounded-3xl border px-4 py-4 text-sm ${statusTone}`}>
            {health.loading ? (
              <p>Vérification de la disponibilité de mGBA-http…</p>
            ) : health.success ? (
              <p>
                La route backend répond et semble pouvoir joindre mGBA-http.
                Tu peux tester les boutons et surveiller la frame en direct.
              </p>
            ) : (
              <p>{health.error}</p>
            )}
          </div>

          {feedback.message && (
            <div
              className={`mt-4 rounded-3xl border px-4 py-4 text-sm ${feedbackTone}`}
            >
              {feedback.message}
            </div>
          )}

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Dernière action
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-black text-slate-900">
                  {lastAction || "—"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Le dernier input accepté par l&apos;API.
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Mode
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  Envoi immédiat
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.55)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Live view
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                Flux WebP natif
              </h2>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${streamBadge}`}
            >
              {stream.loading
                ? "Boot"
                : stream.status === "ok"
                ? "Actif"
                : stream.status === "capturing"
                ? "Capture"
                : stream.status === "starting"
                ? "Démarrage"
                : "Erreur"}
            </div>
          </div>

          <div className={`rounded-3xl border px-4 py-4 text-sm ${streamTone}`}>
            {stream.status === "ok" ? (
              <p>
                Le flux frame-based est disponible et rafraîchi toutes les{" "}
                <strong>{stream.intervalMs} ms</strong>.
              </p>
            ) : stream.error ? (
              <p>{stream.error}</p>
            ) : (
              <p>Initialisation de la première frame Pokémon…</p>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span>
                {stream.width}×{stream.height} • {stream.format.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => {
                  loadStreamStatus();
                  if (stream.hasFrame) {
                    fetchApi(`/api/pokemon/frame?t=${Date.now()}`, {
                      method: "GET",
                    })
                      .then(async (response) => {
                        if (!response.ok) {
                          throw new Error(
                            "Impossible de charger la frame Pokémon."
                          );
                        }

                        const frameBlob = await response.blob();
                        const nextObjectUrl = URL.createObjectURL(frameBlob);

                        setFrameUrl((previousUrl) => {
                          if (previousUrl) {
                            URL.revokeObjectURL(previousUrl);
                          }
                          latestObjectUrlRef.current = nextObjectUrl;
                          return nextObjectUrl;
                        });
                      })
                      .catch((error) => {
                        setStream((prev) => ({
                          ...prev,
                          status: "error",
                          error:
                            error.message ||
                            "Impossible de charger la frame Pokémon.",
                        }));
                      });
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-slate-200 transition-colors duration-200 hover:bg-white/10"
              >
                <RefreshCcw size={14} />
                Rafraîchir
              </button>
            </div>

            <div className="mt-4 mx-auto flex aspect-[3/2] w-full max-w-[720px] items-center justify-center overflow-hidden rounded-[20px] bg-slate-900">
              {stream.hasFrame && frameUrl ? (
                <img
                  src={frameUrl}
                  alt="Flux en direct du jeu Pokémon"
                  className="h-full w-full rounded-[12px] border border-white/5 bg-black object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="text-center text-slate-400">
                  <Image size={28} className="mx-auto mb-3" />
                  <p>Aucune frame reçue pour le moment.</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Dernière frame
                </p>
                <p className="mt-1 font-semibold">{formattedTimestamp}</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Cadence backend
                </p>
                <p className="mt-1 font-semibold">{stream.intervalMs} ms</p>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Persistance
                </p>
                <p className="mt-1 font-semibold">
                  {stream.hasFrame ? "Dernière frame conservée" : "En attente"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_70px_-40px_rgba(2,6,23,0.9)] lg:col-span-2">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <Play size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Commandes
              </p>
              <h2 className="text-2xl font-bold">Manette MVP</h2>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div className="grid grid-cols-3 grid-rows-3 gap-3 justify-items-center">
              {directionalButtons.map(
                ({ button, label, icon: Icon, className }) => (
                  <button
                    key={button}
                    type="button"
                    onClick={() => sendInput(button)}
                    disabled={isSending}
                    className={`${className} flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/10 bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:-translate-y-1 hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-label={label}
                    title={label}
                  >
                    <Icon size={28} />
                  </button>
                )
              )}
              <div className="col-start-2 row-start-2 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/15 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Pad
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {actionButtons.map(({ button, label, accent, wide }) => (
                <button
                  key={button}
                  type="button"
                  onClick={() => sendInput(button)}
                  disabled={isSending}
                  className={`inline-flex items-center justify-center rounded-[24px] bg-gradient-to-br ${accent} px-6 py-5 text-lg font-black tracking-[0.08em] text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                    wide ? "min-w-[170px]" : "min-w-[120px]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-sm leading-6 text-slate-400">
            Le backend ne maintient aucun état collectif ici. Chaque bouton
            déclenche simplement une requête directe vers l&apos;API Pokémon,
            pendant que la dernière frame PNG partagée est rafraîchie en fond.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Pokemon;
