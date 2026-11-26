import { BarChart3, CalendarPlus, CircleHelp, Megaphone, MessageCircle, PanelBottom, Palette, Scale, ShieldCheck } from "lucide-react";

export const slideMenuConfig = [
  { id: "events", label: "Créer un événement", icon: CalendarPlus, path: "/events" },
  { id: "help", label: "Autres infos", icon: CircleHelp, path: "/help" },
  { id: "feedback", label: "Donner son avis", icon: MessageCircle, path: "/feedback" },
  { id: "events-admin", label: "Espace admin events", icon: ShieldCheck, path: "/events/admin", adminOnly: true },
  { id: "campaigns-admin", label: "Campagnes admin", icon: Megaphone, path: "/campaigns/admin", adminOnly: true },
  { id: "analytics-admin", label: "Analytics admin", icon: BarChart3, path: "/analytics/admin", adminOnly: true },
  { id: "theme-palette-admin", label: "Assos & couleurs admin", icon: Palette, path: "/theme-palette/admin", adminOnly: true },
  { id: "nav-pages-admin", label: "Pages navbar admin", icon: PanelBottom, path: "/nav-pages/admin", adminOnly: true },
  { id: "legal", label: "Mentions légales", icon: Scale, path: "/legal" },
];
