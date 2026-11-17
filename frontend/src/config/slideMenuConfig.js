import { BarChart3, CircleHelp, Megaphone, MessageCircle, PanelBottom, Palette, Scale } from "lucide-react";

export const slideMenuConfig = [
  { id: "help", label: "Autres infos", icon: CircleHelp, path: "/help" },
  { id: "feedback", label: "Donner son avis", icon: MessageCircle, path: "/feedback" },
  { id: "campaigns-admin", label: "Campagnes admin", icon: Megaphone, path: "/campaigns/admin", adminOnly: true },
  { id: "analytics-admin", label: "Analytics admin", icon: BarChart3, path: "/analytics/admin", adminOnly: true },
  { id: "theme-palette-admin", label: "Assos & couleurs admin", icon: Palette, path: "/theme-palette/admin", adminOnly: true },
  { id: "nav-pages-admin", label: "Pages navbar admin", icon: PanelBottom, path: "/nav-pages/admin", adminOnly: true },
  { id: "legal", label: "Mentions légales", icon: Scale, path: "/legal" },
];
