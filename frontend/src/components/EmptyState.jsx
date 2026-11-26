// État vide commun : icône dans une pastille, titre, texte et action optionnelle.
// `bare` : sans carte autour (quand on est déjà dans un panneau).
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  bare = false,
  className = "",
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${
      bare ? "" : "bg-white rounded-2xl border border-gray-200/80 shadow-sm"
    } ${className}`}
  >
    {Icon && (
      <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon size={26} />
      </span>
    )}
    <p className="font-semibold text-secondary">{title}</p>
    {description && (
      <p className="text-sm text-gray-500 max-w-sm">{description}</p>
    )}
    {action}
  </div>
);

export default EmptyState;
