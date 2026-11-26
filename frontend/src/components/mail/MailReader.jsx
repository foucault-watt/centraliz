import { ExternalLink, X } from "lucide-react";
import { useMemo } from "react";
import {
  avatarColor,
  displayName,
  formatLongDate,
  initials,
  sanitizeMailContent,
  zimbraUrl,
} from "./mailFormat";

export const MailAvatar = ({ author, size = "md" }) => (
  <span
    aria-hidden="true"
    className={`shrink-0 inline-flex items-center justify-center rounded-full font-bold ${avatarColor(
      author,
    )} ${size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs"}`}
  >
    {initials(author)}
  </span>
);

const BodySkeleton = () => (
  <div className="space-y-3 animate-pulse" aria-label="Chargement du mail">
    {[92, 100, 85, 96, 60, 0, 88, 94, 40].map((width, index) =>
      width ? (
        <div
          key={index}
          className="h-3 rounded bg-gray-200"
          style={{ width: `${width}%` }}
        />
      ) : (
        <div key={index} className="h-2" />
      ),
    )}
  </div>
);

// Les liens du mail s'ouvrent dans un nouvel onglet.
const openLinksInNewTab = (event) => {
  const link = event.target.closest?.("a[href]");
  if (!link) return;
  event.preventDefault();
  window.open(link.href, "_blank", "noopener,noreferrer");
};

// Lecture d'un mail : partagée entre le panneau PC et la feuille mobile.
const MailReader = ({ mail, content, loading, onClose }) => {
  const html = useMemo(() => sanitizeMailContent(content), [content]);

  return (
    <article className="flex flex-col h-full min-h-0">
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <h2 className="flex-1 min-w-0 text-lg md:text-xl font-bold text-secondary leading-snug break-words">
            {mail.title || "(Sans objet)"}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 -mr-2 -mt-1 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-secondary"
              aria-label="Fermer le mail"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <MailAvatar author={mail.author} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-secondary truncate">
              {displayName(mail.author)}
            </p>
            <p className="text-xs text-gray-500 truncate" title={mail.author}>
              {formatLongDate(mail.pubDate)}
            </p>
          </div>
          <a
            href={zimbraUrl(mail.id)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Répondre
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        {loading ? (
          <BodySkeleton />
        ) : html ? (
          <div
            className="mail-content"
            onClick={openLinksInNewTab}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-gray-500">
            Le contenu de ce mail n'a pas pu être chargé.{" "}
            <a
              href={zimbraUrl(mail.id)}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              L'ouvrir sur Zimbra
            </a>
          </p>
        )}
      </div>
    </article>
  );
};

export default MailReader;
