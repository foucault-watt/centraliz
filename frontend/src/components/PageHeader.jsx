// En-tête commun à toutes les pages :
//   [icône]  Titre                                  [actions]
//            Une phrase courte qui dit à quoi sert la page.
// - icon : l'icône de la page (la même que dans la navigation) ;
// - kicker : seulement pour marquer un espace à part ("Admin") ;
// - level={2} : version section, quand le bloc est intégré dans une autre page.
// Posé sur le fond de la page, sans carte, pour que toutes les pages
// commencent de la même façon.
const PageHeader = ({
  icon: Icon,
  kicker,
  title,
  subtitle,
  actions,
  level = 1,
  className = "",
}) => {
  const isPage = level === 1;
  const Heading = isPage ? "h1" : "h2";

  return (
    <header
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3 md:gap-4">
        {Icon && isPage && (
          <span className="inline-flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md shadow-primary/25">
            <Icon size={22} />
          </span>
        )}
        <div className="min-w-0">
          {kicker && (
            <p className="text-[0.7rem] font-bold uppercase tracking-wider text-primary">
              {kicker}
            </p>
          )}
          <Heading
            className={`font-bold text-secondary leading-tight ${
              isPage ? "text-2xl md:text-[1.75rem]" : "text-xl"
            }`}
          >
            {title}
          </Heading>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500 max-w-2xl">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
