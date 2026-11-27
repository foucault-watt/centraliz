import {
  Calendar1,
  ExternalLink,
  FileText,
  Gamepad2,
  Mail,
  BookOpen,
  LibraryBig,
  Landmark,
  Users,
} from "lucide-react";

// Catalogue des pages disponibles dans la navbar du bas (libellé + icône).
// L'activation et les promos concernées sont gérées côté admin (/nav-pages/admin).
export const pagesCatalog = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "links", label: "Liens", icon: ExternalLink },
  { id: "calendars", label: "Calendriers", icon: Calendar1 },
  { id: "communication", label: "Mails", icon: Mail },
  { id: "moodle", label: "Moodle", icon: BookOpen },
  { id: "cekilui", label: "Cékilui", icon: Users },
  { id: "pokemon", label: "Pokémon", icon: Gamepad2 },
  { id: "bibli", label: "Bibli", icon: LibraryBig },
  // /le-musee, pas /musee : /musee est la page publique à partager, sans menu.
  ...(process.env.REACT_APP_MUSEE_ENABLED === "true"
    ? [{ id: "le-musee", label: "Le Musée", icon: Landmark }]
    : []),
];

// Utilisé si l'API est injoignable.
export const defaultPageIds = ["links", "calendars", "communication", "cekilui"];
