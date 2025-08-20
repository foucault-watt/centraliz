import { Download, Info, MessageCircle, Mail, Scale } from "lucide-react";

export const slideMenuConfig = [
  { id: "install", label: "Installer l'app", icon: Download, path: "/install" },
  { id: "about", label: "À propos", icon: Info, path: "/about" },
  { id: "feedback", label: "Feedback", icon: MessageCircle, path: "/feedback" },
  { id: "contact", label: "Contact", icon: Mail, path: "/contact" },
  { id: "legal", label: "Mentions légales", icon: Scale, path: "/legal" },
];