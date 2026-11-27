import { ChevronDown, FastForward, Gamepad2, History, Radio, Save, Users, Vote, Zap } from "lucide-react";

const releases = [
  {
    version: "1.2",
    title: "Partie en vitesse ×2",
    changes: [
      {
        icon: FastForward,
        title: "Le jeu tourne deux fois plus vite",
        description: "La partie avance maintenant à vitesse ×2 pour tout le monde : déplacements, dialogues et combats vont deux fois plus vite.",
      },
    ],
  },
  {
    version: "1.1",
    title: "Image en direct",
    changes: [
      {
        icon: Radio,
        title: "Chaque image arrive dès qu’elle change",
        description: "Le serveur envoie maintenant chaque nouvelle image au moment où elle apparaît, au lieu d’attendre que le navigateur la demande. Plus d’images sautées pendant les déplacements, et moins de données consommées. Si la connexion ne le permet pas, la page repasse d’elle-même à l’ancien mode.",
      },
    ],
  },
  {
    version: "1.0",
    title: "Première version",
    changes: [
      {
        icon: Zap,
        title: "Jusqu’à 30 images par seconde",
        description: "L’affichage passe de 10 à 30 images par seconde au maximum pour rendre les déplacements plus fluides. Quand l’écran reste identique, l’image n’est pas renvoyée.",
      },
      {
        icon: Gamepad2,
        title: "Une manette sur mobile et sur PC",
        description: "La partie se joue avec la manette tactile ou les raccourcis clavier. Une direction maintenue fait avancer en continu.",
      },
      {
        icon: Users,
        title: "Qui joue, qui regarde ?",
        description: "La liste sous la console indique qui regarde la partie et qui a récemment utilisé les commandes, sur téléphone ou sur ordinateur.",
      },
    ],
  },
];

const upcoming = [
  {
    icon: Save,
    title: "Sauvegarde automatique",
    description: "Conserver la progression de la partie partagée et la retrouver après un redémarrage.",
  },
  {
    icon: Vote,
    title: "Votes en jeu",
    description: "Voter ensemble pour décider de la suite de la partie.",
  },
];

function UpdateList({ items }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map(({ icon: Icon, title, description }) => (
        <li key={title} className="flex gap-3 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-secondary">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PokemonUpdates() {
  return (
    <details className="group mx-auto w-full max-w-3xl rounded-2xl border border-gray-200/80 bg-white shadow-sm">
      <summary
        className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
        onKeyDown={(event) => {
          // Entrée ouvre le panneau au lieu d'envoyer Start au jeu.
          if (event.key === "Enter") event.stopPropagation();
        }}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <History size={20} aria-hidden="true" />
        </span>
        <span className="grow text-sm font-semibold text-secondary">Nouveautés</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          v{releases[0].version}
        </span>
        <ChevronDown size={18} className="shrink-0 text-gray-500 group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="grid gap-5 border-t border-gray-100 p-4 sm:grid-cols-[3fr_2fr] sm:p-5">
        <div className="space-y-5">
          {releases.map(({ version, title, changes }) => (
            <section key={version}>
              <h2 className="font-semibold text-secondary">{title} <span className="text-sm font-medium text-gray-500">· v{version}</span></h2>
              <UpdateList items={changes} />
            </section>
          ))}
        </div>
        <section className="rounded-xl bg-slate-50 px-4 pt-3">
          <h2 className="font-semibold text-secondary">À venir</h2>
          <UpdateList items={upcoming} />
        </section>
      </div>
    </details>
  );
}
