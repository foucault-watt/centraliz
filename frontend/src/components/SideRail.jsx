import { useContext } from "react";
import { NavLink } from "react-router-dom";
import { UserContext } from "../App";
import { slideMenuConfig } from "../config/slideMenuConfig";
import { useNavPages } from "../utils/navPages";

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-primary text-white shadow-sm"
      : "text-secondary hover:bg-primary/10"
  }`;

// Sur PC (lg+), la navbar du bas et le menu latéral fusionnent dans un
// rail fixe à gauche. Sur mobile, il est masqué (navbar du bas + menu).
const SideRail = () => {
  const { user } = useContext(UserContext) || {};
  const pages = useNavPages() || [];
  const menuPages = slideMenuConfig.filter(
    (page) => !page.adminOnly || user?.is_admin,
  );

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-60 shrink-0 sticky top-16 self-start max-h-[calc(100svh-4rem)] overflow-y-auto py-5 pl-4 pr-2">
      <nav className="flex flex-col gap-1" aria-label="Pages principales">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <NavLink key={page.id} to={`/${page.id}`} className={linkClass}>
              <Icon size={18} />
              <span>{page.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="h-px bg-gray-200 mx-3" />
      <nav className="flex flex-col gap-0.5" aria-label="Autres onglets">
        {menuPages.map((page) => (
          <NavLink key={page.id} to={page.path} end className={linkClass}>
            <page.icon size={16} className="opacity-70" />
            <span className="text-[0.8rem]">{page.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default SideRail;
