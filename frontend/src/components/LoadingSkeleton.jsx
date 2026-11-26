// Chargement commun : des lignes grises qui pulsent à la place d'un spinner,
// pour que la page garde sa forme pendant l'attente.
// `card` : dans une carte blanche. `avatar` : une pastille ronde par ligne.
const LoadingSkeleton = ({
  label = "Chargement…",
  rows = 4,
  card = true,
  avatar = false,
  className = "",
}) => (
  <div
    role="status"
    aria-label={label}
    className={`${
      card ? "bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4" : ""
    } ${className}`}
  >
    <p className="mb-3 text-xs font-medium text-gray-500">{label}</p>
    <div className="animate-pulse space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-3">
          {avatar && <div className="w-9 h-9 shrink-0 rounded-full bg-gray-200" />}
          <div className="flex-1 space-y-2 py-0.5">
            <div
              className="h-3.5 rounded bg-gray-200"
              style={{ width: `${40 + ((index * 17) % 35)}%` }}
            />
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-4/5 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default LoadingSkeleton;
