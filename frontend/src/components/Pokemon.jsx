import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Gamepad2,
  RefreshCcw,
} from "lucide-react";
import { useId, useState } from "react";
import PageHeader from "./PageHeader";
import GameButton from "./pokemon/GameButton";
import usePokemonInput from "./pokemon/usePokemonInput";
import usePokemonStream, { ADMIN_MAX_FPS, DEFAULT_FPS } from "./pokemon/usePokemonStream";
import DebugPanel from "./pokemon/DebugPanel";
import ActivityPanel from "./pokemon/ActivityPanel";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./pokemon/framePainter";
import PlayersPanel from "./pokemon/PlayersPanel";
import PokemonUpdates from "./pokemon/PokemonUpdates";
import SpeedControl from "./pokemon/SpeedControl";
import { useSessionStatsReporter } from "./pokemon/sessionStats";

// Page Pokémon : une console. L'écran du jeu, une croix, A, B et Start.
// Mobile : écran en haut, manette sous les pouces.
// PC (lg) : disposition GBA, croix | écran | A B, et raccourcis clavier.

const STATUS = {
  connecting: { label: "Connexion…", dot: "bg-amber-400 animate-pulse" },
  live: { label: "En direct", dot: "bg-emerald-400 animate-pulse" },
  reconnecting: { label: "Reconnexion…", dot: "bg-amber-400 animate-pulse" },
  offline: { label: "Hors ligne", dot: "bg-rose-500" },
};

const DPAD = [
  { button: "UP", label: "Haut", icon: ChevronUp, cell: "col-start-2 row-start-1", shape: "rounded-t-xl" },
  { button: "LEFT", label: "Gauche", icon: ChevronLeft, cell: "col-start-1 row-start-2", shape: "rounded-l-xl" },
  { button: "RIGHT", label: "Droite", icon: ChevronRight, cell: "col-start-3 row-start-2", shape: "rounded-r-xl" },
  { button: "DOWN", label: "Bas", icon: ChevronDown, cell: "col-start-2 row-start-3", shape: "rounded-b-xl" },
];

function Screen({ canvasRef, hasFrame, status, error, onRetry }) {
  const tone = STATUS[status];

  return (
    <div className="relative w-full">
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-black ring-4 ring-black/40">
        {/* Toujours monté (on y dessine avant de l'afficher), caché tant
            qu'aucune image n'y est dessinée. */}
        <canvas
          ref={canvasRef}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          role="img"
          aria-label="Écran du jeu Pokémon en direct"
          hidden={!hasFrame}
          className={`h-full w-full select-none object-contain transition-opacity duration-300 ${
            status === "live" ? "opacity-100" : "opacity-50"
          }`}
          style={{ imageRendering: "pixelated" }}
        />

        {!hasFrame && status === "connecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400" role="status">
            <Gamepad2 size={32} className="animate-pulse" />
            <p className="text-sm">Connexion au jeu…</p>
          </div>
        )}

        {status === "offline" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
            <p className="font-semibold text-white">Le jeu ne répond pas</p>
            <p className="max-w-xs text-sm text-slate-300">
              Il redémarre peut-être. Nouvel essai possible dans quelques secondes.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <RefreshCcw size={16} />
              Réessayer
            </button>
          </div>
        )}

        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur-sm">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
          {tone.label}
        </span>
      </div>

      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-center text-sm text-rose-300">
        {error}
      </p>
    </div>
  );
}

function DPad({ pressed, onPress, onRelease, disabled }) {
  return (
    <div className="grid grid-cols-3 grid-rows-3 h-[9rem] w-[9rem] sm:h-[10.5rem] sm:w-[10.5rem] lg:h-[12rem] lg:w-[12rem]">
      {DPAD.map(({ button, label, icon: Icon, cell, shape }) => (
        <GameButton
          key={button}
          button={button}
          label={label}
          isPressed={pressed.has(button)}
          onPress={onPress}
          onRelease={onRelease}
          disabled={disabled}
          className={`${cell} ${shape} flex items-center justify-center bg-slate-700 text-slate-200 shadow-[inset_0_-3px_0_rgba(0,0,0,0.35)]`}
          pressedClassName="bg-slate-600 shadow-none"
        >
          <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
        </GameButton>
      ))}
      <div aria-hidden="true" className="col-start-2 row-start-2 bg-slate-700" />
    </div>
  );
}

function ActionButton({ button, caption, pressed, onPress, onRelease, disabled, primary }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <GameButton
        button={button}
        label={`${button}, ${caption.toLowerCase()}`}
        isPressed={pressed.has(button)}
        onPress={onPress}
        onRelease={onRelease}
        disabled={disabled}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)] sm:h-16 sm:w-16 sm:text-2xl lg:h-[4.5rem] lg:w-[4.5rem] ${
          primary ? "bg-primary" : "bg-slate-600"
        }`}
        pressedClassName="brightness-90 shadow-none"
      >
        {button}
      </GameButton>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
        {caption}
      </span>
    </div>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 font-sans text-xs font-semibold text-secondary shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      {children}
    </kbd>
  );
}

const debugEnabled = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

const FPS_PRESETS = [8, 15, 22, 30];

function Pokemon({ user }) {
  const isAdmin = user?.is_admin === true;
  const [showDebug, setShowDebug] = useState(debugEnabled);
  const debugId = useId();
  const [targetFps, setTargetFps] = useState(DEFAULT_FPS);
  const { canvasRef, hasFrame, status, retry, stats, mode, requestedFps } = usePokemonStream({ targetFps, isAdmin });
  useSessionStatsReporter();
  const maxFps = isAdmin && mode === "sse" ? ADMIN_MAX_FPS : DEFAULT_FPS;
  const canPlay = hasFrame && status !== "offline";
  const { press, release, pressed, error } = usePokemonInput({ enabled: canPlay });
  const controls = { pressed, onPress: press, onRelease: release, disabled: !canPlay };

  return (
    <div className="mx-auto max-w-md space-y-5 lg:max-w-6xl">
      <PageHeader
        icon={Gamepad2}
        title="Pokémon"
        subtitle="Une seule partie pour toute l'école : chaque bouton compte."
      />

      <PokemonUpdates />

      <section
        aria-label="Console de jeu"
        className="grid grid-cols-2 items-center gap-x-4 gap-y-5 rounded-3xl bg-slate-900 p-4 shadow-xl shadow-slate-900/20 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-10 lg:p-8"
      >
        <div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          <Screen canvasRef={canvasRef} hasFrame={hasFrame} status={status} error={error} onRetry={retry} />
        </div>

        <div className="justify-self-start lg:col-start-1 lg:row-start-1">
          <DPad {...controls} />
        </div>

        {/* A en haut à droite, B en bas à gauche, comme sur la console. */}
        <div className="justify-self-end lg:col-start-3 lg:row-start-1">
          <div className="grid grid-cols-2 grid-rows-2 gap-x-1">
            <div className="col-start-1 row-start-2">
              <ActionButton button="B" caption="Retour" {...controls} />
            </div>
            <div className="col-start-2 row-start-1">
              <ActionButton button="A" caption="Valider" primary {...controls} />
            </div>
          </div>
        </div>

        <div className="col-span-2 flex justify-center lg:col-span-1 lg:col-start-2 lg:row-start-2">
          <div className="flex flex-col items-center gap-1.5">
            <GameButton
              button="START"
              label="Start, menu"
              isPressed={pressed.has("START")}
              onPress={press}
              onRelease={release}
              disabled={!canPlay}
              className="h-8 w-20 -rotate-6 rounded-full bg-slate-600 text-[0.7rem] font-bold uppercase tracking-wider text-slate-200 shadow-[inset_0_-3px_0_rgba(0,0,0,0.3)]"
              pressedClassName="bg-slate-500 shadow-none"
            >
              Start
            </GameButton>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
              Menu
            </span>
          </div>
        </div>
      </section>

      <p className="text-center text-sm text-gray-500 lg:hidden">
        Un appui maintenu sur une flèche fait avancer en continu.
      </p>
      <p className="hidden flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-500 lg:flex">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>←↑↓→</Kbd> ou <Kbd>ZQSD</Kbd> se déplacer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>X</Kbd> A
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>C</Kbd> B
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>Entrée</Kbd> Start
        </span>
      </p>

      {/* Sur grand écran : le chat à gauche, joueurs et réglages à droite.
          Sur mobile : une seule colonne, joueurs puis chat puis réglages. */}
      <div className="mx-auto grid w-full max-w-3xl gap-5 lg:max-w-none lg:grid-cols-2 lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <PlayersPanel />
        </div>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ActivityPanel isAdmin={isAdmin} />
        </div>

        <div className="space-y-3 lg:col-start-2 lg:row-start-2">
          {isAdmin && <SpeedControl />}
          <div
            role="group"
            aria-label="Réglages du flux"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gray-200/80 bg-white px-3 py-2 shadow-sm sm:px-4"
            onKeyDown={(event) => {
              // Entrée active le réglage sélectionné sans envoyer Start au jeu.
              if (event.key === "Enter") event.stopPropagation();
            }}
          >
            <label className="flex w-full items-center gap-3 sm:w-auto sm:flex-1">
              <span className="shrink-0 text-sm font-semibold tabular-nums text-secondary">Cible {requestedFps} FPS</span>
              <input
                aria-label="FPS cibles"
                type="range"
                min="1"
                max={maxFps}
                value={requestedFps}
                onChange={(event) => setTargetFps(Number(event.target.value))}
                className="min-w-0 flex-1 accent-[var(--color-primary)]"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(maxFps > DEFAULT_FPS ? [...FPS_PRESETS, 45, ADMIN_MAX_FPS] : FPS_PRESETS).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  aria-label={`${fps} FPS`}
                  aria-pressed={requestedFps === fps}
                  onClick={() => setTargetFps(fps)}
                  className="min-h-9 min-w-9 rounded-lg bg-gray-100 px-2 text-sm font-semibold tabular-nums text-secondary hover:bg-gray-200 aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-primary"
                >
                  {fps}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-expanded={showDebug}
              aria-controls={debugId}
              onClick={() => setShowDebug((open) => !open)}
              className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-secondary hover:bg-gray-100"
            >
              Stats du flux
              <ChevronDown size={16} aria-hidden="true" className={showDebug ? "rotate-180" : undefined} />
            </button>
          </div>
          <div id={debugId} hidden={!showDebug}>
            {showDebug && <DebugPanel targetFps={requestedFps} stats={stats} mode={mode} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pokemon;
