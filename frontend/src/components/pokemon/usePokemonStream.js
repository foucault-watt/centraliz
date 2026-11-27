import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "../../utils/api";
import { recordFrame, recordRtt } from "./sessionStats";

// Image du jeu, rafraîchie en boucle (une requête à la fois, jamais
// d'empilement), mise en pause quand l'onglet est caché.
//
// status :
//   "connecting"   pas encore d'image ;
//   "live"         l'image arrive ;
//   "reconnecting" on a eu une image, les dernières requêtes échouent ;
//   "offline"      trop d'échecs : on arrête et on propose de réessayer.
//
// targetFps est envoyé au serveur (?fps=), qui capture au rythme du
// spectateur le plus exigeant.
//
// mode :
//   "sse"     flux continu (Server-Sent Events, /api/pokemon/stream) : le
//             serveur pousse chaque image différente, sans requête ;
//   "polling" secours : interrogation de /api/pokemon/frame en boucle (304
//             si l'image n'a pas changé). Choisi si le flux ne donne aucune
//             image (navigateur, proxy, session).

export const DEFAULT_FPS = 30;
export const ADMIN_MAX_FPS = 60;
export const RETRY_DELAY_MS = 1000;
export const MAX_FAILURES_BEFORE_FRAME = 8;
export const MAX_FAILURES_AFTER_FRAME = 15;
const RECENT_MS = 3000;
export const SSE_FIRST_FRAME_MS = 6000;
const SSE_FPS_DEBOUNCE_MS = 400;

const canUseSse = () => typeof window !== "undefined" && typeof window.EventSource === "function";

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
const MINUTE_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isHidden = () =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

const average = (values) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

const EMPTY_STATS = {
  requestsPerSec: 0,
  freshPerSec: 0,
  duplicateRatio: 0,
  bytesPerFrame: 0,
  bytesPerSecond: 0,
  rttMs: 0,
  ageMs: 0,
  delayMs: 0,
  notModifiedRatio: 0,
  pushedPerSec: 0,
  minute: { requests: 0, pushed: 0, fresh: 0, bytes: 0, errors: 0, notModified: 0 },
  session: { requests: 0, fresh: 0, bytes: 0, errors: 0 },
  history: [],
};

// Calcule les stats à partir des échantillons (exporté pour les tests).
// sample : { at, ok, bytes, rttMs, ageMs, fresh, unchanged (304), pushed (SSE) }
export function computeStats(samples, session, history, now = Date.now()) {
  const recent = samples.filter((s) => now - s.at <= RECENT_MS);
  const minute = samples.filter((s) => now - s.at <= MINUTE_MS);
  const recentOk = recent.filter((s) => s.ok);
  const recentFresh = recentOk.filter((s) => s.fresh);
  const seconds = RECENT_MS / 1000;
  const rttMs = average(recentOk.map((s) => s.rttMs).filter((v) => v != null));
  const ages = recentOk.map((s) => s.ageMs).filter((v) => v != null);
  const ageMs = average(ages);
  const bytes = recentOk.reduce((sum, s) => sum + s.bytes, 0);

  return {
    requestsPerSec: recent.filter((s) => !s.pushed).length / seconds,
    pushedPerSec: recentOk.filter((s) => s.pushed).length / seconds,
    freshPerSec: recentFresh.length / seconds,
    duplicateRatio: recentOk.length ? 1 - recentFresh.length / recentOk.length : 0,
    notModifiedRatio: recentOk.length ? recentOk.filter((s) => s.unchanged).length / recentOk.length : 0,
    // Taille moyenne d'une image réellement téléchargée (les 304 sont vides).
    bytesPerFrame: (() => {
      const downloaded = recentOk.filter((s) => s.bytes > 0);
      return downloaded.length ? bytes / downloaded.length : 0;
    })(),
    bytesPerSecond: bytes / seconds,
    rttMs,
    ageMs,
    // Retard entre la capture sur le serveur et l'affichage : âge de
    // l'image au départ du serveur + trajet retour (moitié de l'aller-retour).
    delayMs: ages.length ? ageMs + rttMs / 2 : 0,
    minute: {
      requests: minute.filter((s) => !s.pushed).length,
      pushed: minute.filter((s) => s.pushed).length,
      fresh: minute.filter((s) => s.ok && s.fresh).length,
      bytes: minute.reduce((sum, s) => sum + (s.ok ? s.bytes : 0), 0),
      errors: minute.filter((s) => !s.ok).length,
      notModified: minute.filter((s) => s.unchanged).length,
    },
    session: { ...session },
    history,
  };
}

export default function usePokemonStream({ targetFps = DEFAULT_FPS, isAdmin = false } = {}) {
  const [frameUrl, setFrameUrl] = useState("");
  const [status, setStatus] = useState("connecting");
  const [runId, setRunId] = useState(0);
  const [hidden, setHidden] = useState(isHidden);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [mode, setMode] = useState(() => (canUseSse() ? "sse" : "polling"));
  const requestedFps = Math.min(targetFps, isAdmin && mode === "sse" ? ADMIN_MAX_FPS : DEFAULT_FPS);
  // En flux, changer de cadence demande une nouvelle connexion : on attend
  // que le curseur se stabilise.
  const [sseFps, setSseFps] = useState(requestedFps);
  const streamFps = mode === "sse" ? Math.min(sseFps, isAdmin ? ADMIN_MAX_FPS : DEFAULT_FPS) : 0;
  useEffect(() => {
    const id = setTimeout(() => setSseFps(requestedFps), SSE_FPS_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [requestedFps]);
  const urlRef = useRef("");
  const fpsRef = useRef(requestedFps);
  fpsRef.current = requestedFps;
  const samples = useRef([]);
  const session = useRef({ requests: 0, fresh: 0, bytes: 0, errors: 0 });
  const history = useRef([]);
  const lastTimestamp = useRef(null);

  useEffect(() => {
    const onVisibility = () => setHidden(isHidden());
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (hidden) return undefined;

    let cancelled = false;
    let failures = 0;
    let hasFrame = Boolean(urlRef.current);

    const record = (sample) => {
      samples.current.push(sample);
      if (!sample.pushed) session.current.requests += 1;
      if (sample.ok) {
        session.current.bytes += sample.bytes;
        if (sample.fresh) session.current.fresh += 1;
      } else {
        session.current.errors += 1;
      }
    };

    const showFrame = (blob) => {
      const nextUrl = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = nextUrl;
      setFrameUrl(nextUrl);
    };

    const loop = async () => {
      while (!cancelled) {
        const startedAt = Date.now();
        const fps = Math.max(fpsRef.current, 1);
        try {
          // On envoie l'empreinte de l'image affichée : si elle n'a pas
          // changé, le serveur répond 304 sans la renvoyer.
          const known = urlRef.current ? lastTimestamp.current : null;
          const response = await fetchApi(`/api/pokemon/frame?fps=${fps}&t=${startedAt}`, {
            method: "GET",
            cache: "no-store",
            headers: known ? { "If-None-Match": known } : {},
          });
          const unchanged = response.status === 304;
          if (!response.ok && !unchanged) throw new Error(`HTTP ${response.status}`);
          const blob = unchanged ? null : await response.blob();
          if (cancelled) return;

          const id = response.headers?.get?.("ETag") || response.headers?.get?.("X-Frame-Timestamp") || null;
          const ageHeader = response.headers?.get?.("X-Frame-Age-Ms");
          const fresh = !unchanged && (!id || id !== lastTimestamp.current);
          if (!unchanged) lastTimestamp.current = id;
          const rttMs = Date.now() - startedAt;
          const ageMs = ageHeader != null && ageHeader !== "" ? Number(ageHeader) : null;
          record({
            at: Date.now(),
            ok: true,
            bytes: blob ? blob.size : 0,
            rttMs,
            ageMs,
            fresh,
            unchanged,
          });
          recordRtt(rttMs);
          if (fresh) recordFrame({ bytes: blob ? blob.size : 0, ageMs, rttMs });

          if (blob && (fresh || !urlRef.current)) showFrame(blob);
          hasFrame = true;
          failures = 0;
          setStatus("live");
          await sleep(Math.max(0, 1000 / fps - (Date.now() - startedAt)));
        } catch {
          if (cancelled) return;
          record({ at: Date.now(), ok: false, bytes: 0, rttMs: Date.now() - startedAt, ageMs: null, fresh: false });
          failures += 1;
          const limit = hasFrame ? MAX_FAILURES_AFTER_FRAME : MAX_FAILURES_BEFORE_FRAME;
          if (failures >= limit) {
            setStatus("offline");
            return;
          }
          setStatus(hasFrame ? "reconnecting" : "connecting");
          await sleep(RETRY_DELAY_MS);
        }
      }
    };

    if (mode === "sse") {
      const base = process.env.REACT_APP_URL_BACK || "";
      const experimental = streamFps > DEFAULT_FPS;
      const endpoint = experimental ? "/api/pokemon/admin/stream" : "/api/pokemon/stream";
      const source = new window.EventSource(`${base}${endpoint}?fps=${Math.max(streamFps, 1)}`, {
        withCredentials: true,
      });
      let errors = 0;
      let receivedFrame = false;
      const toPolling = () => {
        source.close();
        setMode("polling");
      };
      // Aucune image au bout de quelques secondes : flux bloqué quelque
      // part (proxy, navigateur), on repasse à l'interrogation.
      const fallback = setTimeout(() => {
        if (!hasFrame || (experimental && !receivedFrame)) toPolling();
      }, SSE_FIRST_FRAME_MS);

      source.addEventListener("frame", (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          showFrame(new Blob([base64ToBytes(data.img)], { type: "image/webp" }));
          record({ at: Date.now(), ok: true, bytes: data.img.length, rttMs: null, ageMs: data.ageMs ?? null, fresh: true, pushed: true });
          recordFrame({ bytes: data.img.length, ageMs: data.ageMs ?? null });
          hasFrame = true;
          receivedFrame = true;
          errors = 0;
          setStatus("live");
        } catch {
          // Message illisible : on attend le suivant.
        }
      });
      source.onerror = () => {
        if (cancelled) return;
        errors += 1;
        const closedForGood = source.readyState === 2; // CLOSED : refus définitif (401...)
        if ((!hasFrame || experimental) && (closedForGood || errors >= 3)) {
          clearTimeout(fallback);
          toPolling();
          return;
        }
        if (closedForGood || errors >= MAX_FAILURES_AFTER_FRAME) {
          source.close();
          setStatus("offline");
          return;
        }
        // Sinon, EventSource se reconnecte tout seul.
        setStatus(hasFrame ? "reconnecting" : "connecting");
      };

      return () => {
        cancelled = true;
        clearTimeout(fallback);
        source.close();
      };
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [hidden, runId, mode, streamFps]);

  // Stats recalculées chaque seconde ; un point d'historique par seconde,
  // 60 points gardés.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      samples.current = samples.current.filter((s) => now - s.at <= MINUTE_MS);
      const lastSecond = samples.current.filter((s) => now - s.at <= 1000);
      const okLastSecond = lastSecond.filter((s) => s.ok);
      history.current = [
        ...history.current,
        {
          t: now,
          asked: fpsRef.current,
          fresh: okLastSecond.filter((s) => s.fresh).length,
          requests: lastSecond.filter((s) => !s.pushed).length,
          kbps: okLastSecond.reduce((sum, s) => sum + s.bytes, 0) / 1024,
          rtt: Math.round(average(okLastSecond.map((s) => s.rttMs).filter((v) => v != null))),
        },
      ].slice(-60);
      setStats(computeStats(samples.current, session.current, history.current, now));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const retry = useCallback(() => {
    setStatus(urlRef.current ? "reconnecting" : "connecting");
    if (canUseSse()) setMode("sse");
    setRunId((id) => id + 1);
  }, []);

  return { frameUrl, status, retry, stats, mode, requestedFps };
}
