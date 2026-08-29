import AccentColorCard from "./AccentColorCard";
import EventCalendar from "./EventCalendar";
import HpCalendar from "./HpCalendar";
import IcalSetupCard from "./IcalSetupCard";

const Calendars = ({ user, onIcalLinkSaved, onThemeColorSaved }) => {
  return (
    <div className="space-y-4">
      {user && !user.theme_color && (
        <AccentColorCard onSaved={onThemeColorSaved} />
      )}
      {user && !user.icalLink && (
        <IcalSetupCard userName={user.userName} onSaved={onIcalLinkSaved} />
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-2 md:p-3">
          <HpCalendar user={user} />
        </div>
        <div className="min-w-0 xl:sticky xl:top-4">
          <EventCalendar user={user} />
        </div>
      </div>
    </div>
  );
};

export default Calendars;
