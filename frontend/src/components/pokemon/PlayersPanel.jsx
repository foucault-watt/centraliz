import { useEffect, useState } from "react";
import { Eye, Gamepad2, Monitor, Smartphone } from "lucide-react";
import { fetchApi } from "../../utils/api";

// Qui joue (a appuyé sur un bouton depuis 30 s) et qui regarde, pour tous,
// avec les appareils de chacun (téléphone, ordinateur). L'appareil qui joue
// est mis en couleur.

const POLL_MS = 3000;

const initials = (name) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

function usePresence() {
  const [presence, setPresence] = useState({ playing: [], watching: [] });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetchApi("/api/pokemon/presence", { method: "GET" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setPresence({ playing: data.playing || [], watching: data.watching || [] });
      } catch {
        // On garde la dernière liste connue.
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return presence;
}

const DEVICE = {
  mobile: { icon: Smartphone, label: "téléphone" },
  desktop: { icon: Monitor, label: "ordinateur" },
};

function Devices({ devices = [] }) {
  if (!devices.length) return null;
  const label = devices
    .map((d) => `${DEVICE[d.type]?.label || "appareil"}${d.playing ? " (joue)" : ""}`)
    .join(", ");
  return (
    <span className="flex items-center gap-0.5" aria-label={label} title={label}>
      {devices.map((d, index) => {
        const Icon = DEVICE[d.type]?.icon || Monitor;
        return <Icon key={index} size={14} aria-hidden="true" className={d.playing ? "text-primary" : "text-gray-400"} />;
      })}
    </span>
  );
}

function Person({ name, detail, active, devices }) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3">
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.7rem] font-bold ${
          active ? "bg-primary text-white" : "bg-gray-100 text-gray-500"
        }`}
      >
        {initials(name)}
      </span>
      <span className="text-sm font-medium text-secondary">{name}</span>
      <Devices devices={devices} />
      {detail && <span className="text-xs tabular-nums text-gray-400">{detail}</span>}
    </li>
  );
}

export default function PlayersPanel() {
  const { playing, watching } = usePresence();

  return (
    <section aria-label="Joueurs en ligne" className="space-y-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-secondary">
          <Gamepad2 size={16} className="text-primary" />
          En train de jouer
          <span className="font-semibold text-gray-400">{playing.length}</span>
        </h2>
        {playing.length ? (
          <ul className="flex flex-wrap gap-2">
            {playing.map((p) => (
              <Person
                key={p.name}
                name={p.name}
                devices={p.devices}
                active
                detail={`${p.lastButton} · ${p.secondsAgo < 2 ? "à l'instant" : `il y a ${p.secondsAgo} s`}`}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Personne ne joue pour l'instant.</p>
        )}
      </div>

      {watching.length > 0 && (
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-secondary">
            <Eye size={16} className="text-gray-400" />
            Regardent
            <span className="font-semibold text-gray-400">{watching.length}</span>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {watching.map((p) => (
              <Person key={p.name} name={p.name} devices={p.devices} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
