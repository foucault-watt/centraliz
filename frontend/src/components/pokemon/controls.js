// Boutons acceptés par le backend (/api/pokemon/input) et raccourcis clavier.

export const DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT"];

// Les directions se répètent tant qu'on garde le doigt (ou la touche)
// appuyé : c'est ce qui permet de marcher sans marteler le bouton.
export const isRepeatable = (button) => DIRECTIONS.includes(button);

export const REPEAT_DELAY_MS = 280;
export const REPEAT_INTERVAL_MS = 170;

// Flèches, ZQSD (AZERTY) et WASD (QWERTY) pour la croix ;
// X / K = A, C / L = B, Entrée = Start.
const KEY_TO_BUTTON = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  z: "UP",
  w: "UP",
  s: "DOWN",
  q: "LEFT",
  a: "LEFT",
  d: "RIGHT",
  x: "A",
  k: "A",
  c: "B",
  l: "B",
  Enter: "START",
};

export const buttonForKey = (key) =>
  KEY_TO_BUTTON[key] || KEY_TO_BUTTON[String(key).toLowerCase()] || null;

// Ne jamais détourner le clavier quand on écrit quelque part.
export const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(target.isContentEditable)
  );
};
