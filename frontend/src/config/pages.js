import { Calendar1, FileText, Mail } from "lucide-react";

const FleurIcon = ({ className }) => (
  <img
    src="/fleur-min.png"
    alt="Fleur icon"
    style={{
      width: "30px",
      height: "30px",
      filter: className?.includes("active")
        ? "brightness(0) invert(1)"
        : "none",
    }}
  />
);

export const pagesConfig = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "calendars", label: "Calendriers", icon: Calendar1 },
  { id: "communication", label: "Mails", icon: Mail },
  { id: "canart", label: "Art'Cadia", icon: FleurIcon },
];
