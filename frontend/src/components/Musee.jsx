import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Maximize2, Play, ExternalLink } from "lucide-react";
import "./Musee.css";
import { createMuseeTracker } from "../utils/museeAnalytics";
import PageHeader from "./PageHeader";
import { Landmark as PageIcon } from "lucide-react";

// Accueil : les cadres puis le texte apparaissent en cascade.
const landing = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};
// Trois cadres décoratifs, légèrement de travers, comme sur un mur d'expo.
const FRAMES = [
  { rotate: -6, className: "w-20 h-24 from-amber-200 via-rose-200 to-sky-200" },
  { rotate: 2, className: "w-24 h-32 from-emerald-200 via-amber-100 to-orange-300" },
  { rotate: 7, className: "w-20 h-20 from-indigo-200 via-sky-100 to-teal-200" },
];

const SMALL_OR_TOUCH = "(max-width: 767px), (pointer: coarse)";

// iPhone Safari has no Fullscreen API; older Safari and Android browsers prefix it.
const fullscreenSupported = () => Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const standalone = () => window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

async function enterFullscreen(element) {
  const request = element?.requestFullscreen || element?.webkitRequestFullscreen;
  if (!request) throw new Error("unsupported");
  await request.call(element);
}

export default function Musee() {
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const frame = useRef(null);
  const gameFrame = useRef(null);
  const [tracker] = useState(createMuseeTracker);
  useEffect(() => {
    const handle = event => tracker.message(event, gameFrame.current);
    window.addEventListener("message", handle);
    window.addEventListener("pagehide", tracker.close);
    return () => {
      window.removeEventListener("message", handle);
      window.removeEventListener("pagehide", tracker.close);
      tracker.close();
    };
  }, [tracker]);
  const [immersive, setImmersive] = useState(() => window.matchMedia(SMALL_OR_TOUCH).matches);
  // Versioned per export so a cached page never shows an old game.
  const version = process.env.REACT_APP_MUSEE_VERSION;
  const gameUrl = `${process.env.PUBLIC_URL || ""}/games/le-musee/index.html${version ? `?v=${version}` : ""}`;

  useEffect(() => {
    // Only the styles change: the iframe stays mounted, so a game in progress survives.
    const query = window.matchMedia(SMALL_OR_TOUCH);
    const update = () => setImmersive(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(fullscreenElement()));
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  const covering = playing && immersive;
  useEffect(() => {
    if (!covering) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [covering]);

  const fullscreen = async () => {
    try {
      await enterFullscreen(frame.current);
      setFullscreenError("");
    } catch {
      setFullscreenError(immersive
        ? "Plein écran indisponible"
        : "Le plein écran est indisponible. Tu peux ouvrir le jeu dans un nouvel onglet.");
    }
  };

  const play = () => {
    tracker.play();
    // Fullscreen needs the player in the page while the tap still counts as a user gesture.
    flushSync(() => setPlaying(true));
    // If refused, the player still covers the whole page and its bar offers a retry.
    if (immersive && fullscreenSupported()) enterFullscreen(frame.current).catch(() => {});
  };

  const quit = () => {
    tracker.close();
    if (fullscreenElement()) {
      Promise.resolve((document.exitFullscreen || document.webkitExitFullscreen).call(document)).catch(() => {});
    }
    setFullscreenError("");
    setPlaying(false);
  };

  return (
    <section className="space-y-4">
      <PageHeader
        icon={PageIcon}
        title="Le Musée"
        actions={playing && !immersive && (
          <>
            <button type="button" onClick={fullscreen} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-gray-50">
              <Maximize2 size={16} /> Plein écran
            </button>
            <a href={window.location.pathname} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-gray-50">
              <ExternalLink size={16} /> Nouvel onglet
            </a>
          </>
        )}
      />
      {fullscreenError && !immersive && <p role="status" className="text-sm">{fullscreenError}</p>}
      {playing ? (
        <div ref={frame} className={`musee-player ${immersive ? "musee-player--immersive" : ""}`}>
          {immersive && (
            <div className="musee-player-bar">
              <button type="button" onClick={quit}><ArrowLeft size={18} /> Quitter</button>
              {fullscreenError
                ? <span role="status">{fullscreenError}</span>
                : fullscreenSupported() && !isFullscreen && (
                  <button type="button" onClick={fullscreen}><Maximize2 size={18} /> Plein écran</button>
                )}
            </div>
          )}
          <iframe
            ref={gameFrame}
            title="Le Musée — jeu"
            src={gameUrl}
            allow="fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <motion.div
          className="relative flex min-h-[420px] flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-amber-50/60 p-8 text-center text-stone-900 shadow-sm"
          variants={landing}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-end gap-5" aria-hidden="true">
            {FRAMES.map((frameStyle, index) => (
              <motion.span
                key={index}
                variants={{
                  hidden: { opacity: 0, y: -18, rotate: 0 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    rotate: frameStyle.rotate,
                    transition: { type: "spring", stiffness: 260, damping: 18 },
                  },
                }}
                className={`block rounded-sm border-[6px] border-stone-700 bg-gradient-to-br shadow-lg ${frameStyle.className}`}
              />
            ))}
          </div>
          <motion.p variants={rise} className="max-w-lg text-base font-medium">Tu es commissaire d’exposition : accroche les tableaux pour répondre à chaque commande.</motion.p>
          <motion.button variants={rise} type="button" onClick={play} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-7 py-3 font-semibold text-white shadow-lg hover:bg-stone-700">
            <Play size={18} /> Jouer
          </motion.button>
          <motion.div variants={rise} className="space-y-2">
            <p className="mx-auto max-w-lg text-sm text-stone-600">Le premier chargement peut prendre un moment. Ta progression est conservée dans ce navigateur. Des statistiques de jeu sont recueillies pour améliorer les niveaux.</p>
            {immersive && (
              <p className="mx-auto max-w-lg text-sm text-stone-600">Le jeu s’ouvre sur tout l’écran et pèse une soixantaine de Mo : le Wi-Fi est conseillé. Sur téléphone, il se joue à la verticale ; sur tablette, dans les deux sens.</p>
            )}
            {immersive && !fullscreenSupported() && !standalone() && (
              <p className="mx-auto max-w-lg text-sm text-stone-600">Ton navigateur ne propose pas le vrai plein écran : le jeu occupera toute la page, hors barres du navigateur. Pour les masquer sur iPhone, ajoute Centraliz à l’écran d’accueil (Partager, puis « Sur l’écran d’accueil ») et ouvre Le Musée depuis l’app.</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
