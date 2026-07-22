import EventCalendar from "./EventCalendar";
import HpCalendar from "./HpCalendar";

const Calendars = ({ user }) => {
  return (
    <div className="space-y-4">
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
