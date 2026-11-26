import { useState } from "react";
import AccentColorCard from "./AccentColorCard";
import CalendarSkeleton from "./CalendarSkeleton";
import EventCalendar from "./EventCalendar";
import HpCalendar from "./HpCalendar";
import IcalSetupCard from "./IcalSetupCard";
import PasswordGateModal from "./PasswordGateModal";
import PageHeader from "./PageHeader";
import { Calendar1 as PageIcon } from "lucide-react";

// Largeur max de l'emploi du temps quand il est seul sur sa ligne.
const SOLO_WIDTH = "w-full xl:max-w-[64rem] xl:mx-auto";

const HpCard = ({ user, needsIcalLink, onIcalLinkSaved, className = "" }) => (
  <div
    className={`min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-2 md:p-3 ${className}`}
  >
    {needsIcalLink ? (
      <PasswordGateModal background={<CalendarSkeleton />}>
        <IcalSetupCard userName={user.userName} onSaved={onIcalLinkSaved} />
      </PasswordGateModal>
    ) : (
      <HpCalendar user={user} />
    )}
  </div>
);

const Calendars = ({ user, onIcalLinkSaved, onThemeColorSaved }) => {
  const needsIcalLink = Boolean(user) && !user.icalLink;
  // null tant que les événements chargent.
  const [eventCount, setEventCount] = useState(null);
  const noEvents = eventCount === 0;
  const hpProps = { user, needsIcalLink, onIcalLinkSaved };

  const accentCard = user && !user.theme_color && (
    <AccentColorCard onSaved={onThemeColorSaved} />
  );

  // Événements en colonne à droite, masqués s'il n'y en a pas.
  return (
    <div className="space-y-4">
      <PageHeader
        icon={PageIcon}
        title="Calendriers"
      />
      {accentCard}
      <div
        className={`grid grid-cols-1 gap-4 items-start ${
          noEvents
            ? ""
            : "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]"
        }`}
      >
        <HpCard {...hpProps} className={noEvents ? SOLO_WIDTH : ""} />
        <div className={noEvents ? "hidden" : "min-w-0 xl:sticky xl:top-20"}>
          <EventCalendar user={user} onCountChange={setEventCount} />
        </div>
      </div>
    </div>
  );
};

export default Calendars;
