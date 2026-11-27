import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "../../utils/api";
import {
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  buttonForKey,
  isRepeatable,
  isTypingTarget,
} from "./controls";

// Envoi des boutons :
// - press(button) envoie tout de suite, puis répète les directions tant
//   qu'on n'a pas appelé release(button) ;
// - une seule requête à la fois : une répétition qui tomberait pendant un
//   envoi est ignorée, pour ne jamais accumuler de retard ;
// - pressed : boutons actuellement enfoncés (pour l'effet visuel, y compris
//   au clavier) ;
// - error : message court en cas d'échec, effacé tout seul.

export default function usePokemonInput({ enabled = true } = {}) {
  const [pressed, setPressed] = useState(() => new Set());
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const timers = useRef(new Map());
  const errorTimer = useRef(null);

  const send = useCallback(async (button) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetchApi("/api/pokemon/input", {
        method: "POST",
        body: JSON.stringify({ button }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setError("");
    } catch {
      setError("La commande n'est pas passée. Nouvel essai possible dans un instant.");
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(""), 3500);
    } finally {
      inFlight.current = false;
    }
  }, []);

  const release = useCallback((button) => {
    const timer = timers.current.get(button);
    if (timer) {
      clearTimeout(timer.delay);
      clearInterval(timer.repeat);
      timers.current.delete(button);
    }
    setPressed((prev) => {
      if (!prev.has(button)) return prev;
      const next = new Set(prev);
      next.delete(button);
      return next;
    });
  }, []);

  const press = useCallback(
    (button) => {
      if (!enabled || timers.current.has(button)) return;
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(8);
      }
      setPressed((prev) => new Set(prev).add(button));
      send(button);

      const timer = {};
      if (isRepeatable(button)) {
        timer.delay = setTimeout(() => {
          timer.repeat = setInterval(() => send(button), REPEAT_INTERVAL_MS);
        }, REPEAT_DELAY_MS);
      }
      timers.current.set(button, timer);
    },
    [enabled, send]
  );

  // Clavier (PC).
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const button = buttonForKey(event.key);
      if (!button) return;
      event.preventDefault();
      if (!event.repeat) press(button);
    };
    const onKeyUp = (event) => {
      const button = buttonForKey(event.key);
      if (button) release(button);
    };
    const releaseAll = () => {
      [...timers.current.keys()].forEach(release);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [enabled, press, release]);

  useEffect(() => () => clearTimeout(errorTimer.current), []);

  return { press, release, pressed, error };
}
