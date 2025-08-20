/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        primary: "#597ee5",
        "primary-dark": "#4267ce",
        secondary: "#2c3e50",
        day: "#f7f7f7", // Correspond à $day
        "background-light": "#f7f7f7", // Correspond à $day
        "border-light": "#ddd", // Correspond à $day-border
        success: "#49c16b", // Correspond à $green
        warning: "#ff9800", // Correspond à $orange
        danger: "#e65656", // Correspond à $red
        background: "#efece6",
        "background-module": "#fafafa",
        "text-primary": "#1a202c",
        "text-secondary": "#4a5568",
        black: "#000", // Correspond à $first
        // Variables spécifiques au gameplay Cékilui
        game: {
          correct: "#22c55e", // Vert pour bonnes réponses
          incorrect: "#ef4444", // Rouge pour mauvaises réponses
          warning: "#f59e0b", // Orange pour avertissements
          ready: "#6366f1", // Bleu pour état "prêt"
          timer: "#fbbf24", // Jaune pour timer circulaire
          overlay: "rgba(0,0,0,0.6)", // Overlay sombre
          "photo-border": "#e5e7eb", // Bordure photo
        },
      },
      borderRadius: {
        game: "25px",
      },
      boxShadow: {
        "game-default": "0 8px 20px rgba(0, 0, 0, 0.08)",
        "game-hover": "0 12px 28px rgba(0, 0, 0, 0.15)",
      },
      animation: {
        "pulse-soft": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        countdown: "countdown 3s linear forwards",
        "timer-ring": "timer-ring 5s linear forwards",
        "scale-in": "scale-in 0.3s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
      },
      keyframes: {
        countdown: {
          "0%": { width: "100%" },
          "100%": { width: "0%" },
        },
        "timer-ring": {
          "0%": { "stroke-dashoffset": "283" },
          "100%": { "stroke-dashoffset": "0" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".slider::-webkit-slider-thumb": {
          appearance: "none",
          height: "20px",
          width: "20px",
          borderRadius: "50%",
          background: "#597ee5",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        },
        ".slider::-moz-range-thumb": {
          height: "20px",
          width: "20px",
          borderRadius: "50%",
          background: "#597ee5",
          cursor: "pointer",
          border: "none",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        },
      });
    },
  ],
};
