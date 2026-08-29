import { Check, Circle, Download, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AccentColorCard from "./AccentColorCard";
import { getSetupStatus } from "../utils/getSetupStatus";
import { getInstallContext } from "../utils/installContext";
import {
  getInstallPromptState,
  subscribeToInstallPrompt,
  triggerInstallPrompt,
} from "../utils/installPrompt";
import { fetchApi } from "../utils/api";

const ReglagesPage = ({ user, onUserRefresh }) => {
  const setupStatus = useMemo(() => getSetupStatus(user), [user]);
  const [percentage, setPercentage] = useState(null);
  const [installState, setInstallState] = useState(getInstallPromptState);
  const [installOutcome, setInstallOutcome] = useState(null);
  const install = useMemo(getInstallContext, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchApi("/api/user/setup-stats");
        const data = await response.json();
        if (!cancelled && data.success) {
          setPercentage(data.percentage);
        }
      } catch (error) {
        console.error("Error loading setup stats:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeToInstallPrompt(setInstallState), []);

  const handleInstallClick = async () => {
    const outcome = await triggerInstallPrompt();
    setInstallOutcome(outcome);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Centraliz
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-secondary mt-1">
          Réglages
        </h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          Ta couleur, ta progression de configuration, et l'accès à
          l'installation de l'application.
        </p>
      </div>

      <section>
        <AccentColorCard forceVisible onSaved={onUserRefresh} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              Progression
            </p>
            <h2 className="text-lg font-bold text-secondary mt-0.5">
              {setupStatus.completedCount}/{setupStatus.totalCount} étapes
              terminées
            </h2>
            {percentage !== null && (
              <p className="text-sm text-gray-600 mt-1">
                Tu es dans les {percentage}% qui ont tout configuré.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 h-2 rounded-full bg-primary/10 overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{
              width: `${Math.round(
                (setupStatus.completedCount / setupStatus.totalCount) * 100
              )}%`,
            }}
          />
        </div>

        <ul className="mt-4 space-y-2">
          {setupStatus.steps
            .filter((step) => step.key !== "login")
            .map((step) => (
              <li
                key={step.key}
                className="flex items-center gap-2.5 text-sm"
              >
                {step.done ? (
                  <Check size={16} className="text-success shrink-0" />
                ) : (
                  <Circle size={16} className="text-gray-300 shrink-0" />
                )}
                <span
                  className={
                    step.done
                      ? "text-secondary font-medium"
                      : "text-gray-500"
                  }
                >
                  {step.label}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Download size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {install.kicker}
            </p>
            <h2 className="text-lg font-bold text-secondary mt-0.5">
              {install.title}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{install.punchline}</p>
          </div>
        </div>

        {installState.canInstall ? (
          <button
            type="button"
            onClick={handleInstallClick}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold px-4 py-2.5 hover:bg-primary-dark transition-colors"
          >
            <Download size={16} />
            Installer Centraliz
          </button>
        ) : (
          <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal list-inside">
            {install.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}

        {installOutcome === "dismissed" && (
          <p className="text-xs text-gray-500 mt-2">
            Pas de souci, tu pourras réessayer depuis cette page quand tu
            veux.
          </p>
        )}
      </section>
    </div>
  );
};

export default ReglagesPage;
