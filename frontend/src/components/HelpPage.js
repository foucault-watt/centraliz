import {
  BookmarkPlus,
  Download,
  Facebook,
  Github,
  HelpCircle,
  LinkedinIcon,
  Mail,
  MessageSquare,
  MousePointerClick,
  Share,
  Smartphone,
} from "lucide-react";
import { useMemo } from "react";

const SectionCard = ({ icon: Icon, kicker, title, children }) => (
  <section className="bg-white rounded-2xl p-5 md:p-6 shadow-md border border-gray-200">
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {kicker}
        </p>
        <h2 className="text-xl md:text-2xl font-bold text-secondary mt-1">
          {title}
        </h2>
      </div>
    </div>
    {children}
  </section>
);

const getInstallContext = () => {
  const userAgent = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isChrome = /Chrome|CriOS/i.test(userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone;

  if (isStandalone) {
    return {
      icon: Smartphone,
      kicker: "C'est prêt",
      title: "Centraliz est déjà installé",
      punchline: "Tu as déjà le raccourci le plus rapide. Nickel.",
      steps: ["Ouvre Centraliz depuis ton écran d'accueil ou ton dock."],
      cta: null,
    };
  }

  if (isIOS) {
    return {
      icon: Share,
      kicker: "iPhone",
      title: "Ajoute Centraliz à ton écran d'accueil",
      punchline: "Un geste, et Centraliz devient une app comme les autres.",
      steps: ["Appuie sur Partager.", "Choisis Sur l'écran d'accueil.", "Valide avec Ajouter."],
      cta: "Ça prend dix secondes.",
    };
  }

  if (isAndroid && isChrome) {
    return {
      icon: Download,
      kicker: "Android",
      title: "Installe Centraliz en un clic",
      punchline: "Plus besoin de chercher le lien avant les cours.",
      steps: ["Appuie sur le menu ⋮.", "Choisis Installer l'application.", "Confirme."],
      cta: "Tu l'auras directement avec tes apps.",
    };
  }

  if (isAndroid) {
    return {
      icon: Download,
      kicker: "Android",
      title: "Ajoute Centraliz sur ton téléphone",
      punchline: "Le raccourci évite la chasse à l'onglet perdu.",
      steps: ["Ouvre le menu du navigateur.", "Cherche Ajouter à l'écran d'accueil.", "Confirme."],
      cta: "Chrome marche souvent le mieux pour ça.",
    };
  }

  if (isSafari) {
    return {
      icon: BookmarkPlus,
      kicker: "Mac",
      title: "Garde Centraliz sous la main",
      punchline: "Sur ordinateur, le favori est le raccourci le plus utile.",
      steps: ["Clique sur Partager.", "Ajoute Centraliz aux favoris.", "Place-le dans ta barre de favoris."],
      cta: "Simple, visible, efficace.",
    };
  }

  return {
    icon: BookmarkPlus,
    kicker: "Ordinateur",
    title: "Mets Centraliz dans ta barre de favoris",
    punchline: "Sur PC, le meilleur réflexe c'est un favori bien visible.",
    steps: ["Appuie sur Ctrl + D.", "Renomme en Centraliz.", "Place-le dans la barre de favoris."],
    cta: "Un clic et tu y es.",
  };
};

const HelpPage = () => {
  const install = useMemo(getInstallContext, []);
  const InstallIcon = install.icon;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Centraliz
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-secondary mt-1">
          Autres infos
        </h1>
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          Le coin pratique : installer Centraliz, comprendre l'app et retrouver
          les contacts utiles.
        </p>
      </div>

      <section className="bg-white rounded-2xl p-5 md:p-6 shadow-md border border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5 items-start">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-md">
            <InstallIcon size={28} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {install.kicker}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-secondary mt-1">
              {install.title}
            </h2>
            <p className="mt-2 text-base font-semibold text-gray-700">
              {install.punchline}
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              {install.steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-black">
                    {index + 1}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-secondary">
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {install.cta && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
                <MousePointerClick size={16} />
                {install.cta}
              </p>
            )}
          </div>
        </div>
      </section>

      <SectionCard icon={HelpCircle} kicker="Infos" title="À propos">
        <p className="text-sm text-gray-700 leading-relaxed">
          Centraliz rassemble les outils utiles du quotidien étudiant :
          calendriers, notes, mails, liens et petits services qui évitent de
          naviguer partout. L'objectif est simple : ouvrir une seule app et
          retrouver ce qu'il faut vite.
        </p>
      </SectionCard>

      <SectionCard icon={Mail} kicker="Contact" title="Besoin de me joindre ?">
        <div className="flex flex-wrap gap-3">
          {[
            {
              icon: Mail,
              label: "Email",
              href: "mailto:foucault.wattinne@iteem.centralelille.fr",
            },
            {
              icon: Github,
              label: "GitHub",
              href: "https://github.com/foucault-watt/centraliz",
            },
            {
              icon: LinkedinIcon,
              label: "LinkedIn",
              href: "https://linkedin.com/in/foucault-wattinne",
            },
            {
              icon: Facebook,
              label: "Facebook",
              href: "https://facebook.com/fukowatt",
            },
            {
              icon: MessageSquare,
              label: "Messenger",
              href: "https://m.me/fukowatt",
            },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="ui-button-secondary text-sm"
            >
              <link.icon size={16} /> {link.label}
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export default HelpPage;
