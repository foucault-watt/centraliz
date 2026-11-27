// Bouton de manette : réagit dès que le doigt touche l'écran (pas au
// relâchement), reste enfoncé tant qu'on appuie, et ne déclenche ni menu
// contextuel, ni sélection de texte, ni zoom au double appui.
const GameButton = ({
  button,
  label,
  isPressed,
  onPress,
  onRelease,
  disabled,
  className = "",
  pressedClassName = "",
  children,
}) => {
  const start = (event) => {
    if (disabled || event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPress(button);
  };
  const stop = () => onRelease(button);

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isPressed}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(event) => event.preventDefault()}
      // Activation au clavier (Tab + Entrée/Espace) : detail vaut 0.
      onClick={(event) => {
        if (event.detail !== 0) return;
        onPress(button);
        setTimeout(() => onRelease(button), 120);
      }}
      style={{ touchAction: "none", WebkitTouchCallout: "none" }}
      className={`select-none outline-none transition-[transform,background-color,box-shadow] duration-75 focus-visible:ring-4 focus-visible:ring-white/40 disabled:opacity-40 ${
        isPressed ? `translate-y-0.5 ${pressedClassName}` : ""
      } ${className}`}
    >
      {children}
    </button>
  );
};

export default GameButton;
