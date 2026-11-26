import { useLocation } from "react-router-dom";
import Navigation from "./Navigation";
import SideRail from "./SideRail";

// Mobile : navbar flottante en bas. PC (lg+) : rail fixe à gauche qui
// regroupe les pages et les autres onglets ; la navbar du bas est masquée
// (cf. .app-shell dans Main.scss).
const PageLayout = ({ children, fullWidth = false }) => {
  const { pathname } = useLocation();
  // Une clé par section (/events/admin et /events/create comptent comme
  // /events) : la transition rejoue en changeant de page, pas sur les
  // sous-routes d'une même page.
  const section = pathname.split("/")[1] || "home";

  return (
    <div className="app-shell">
      <Navigation />
      <div className="lg:flex">
        <SideRail />
        <main className="app-main min-w-0">
          <div
            key={section}
            className={`app-main-inner app-page-enter ${
              fullWidth ? "app-main-inner-full" : ""
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PageLayout;
