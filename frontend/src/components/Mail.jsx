import { AnimatePresence, motion } from "framer-motion";
import { Inbox, MailOpen, RefreshCw, Search, X } from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserContext } from "../App";
import { fetchApi } from "../utils/api";
import { readBrowserEntCredentials } from "../utils/browserEntCredentials";
import ZimbraAuth from "./mail/zimbraAuth";
import MailReader, { MailAvatar } from "./mail/MailReader";
import {
  displayName,
  formatShortDate,
  groupLabel,
  matchesQuery,
} from "./mail/mailFormat";
import MailModal from "./MailModal";
import PageHeader from "./PageHeader";
import PasswordGateModal from "./PasswordGateModal";
import EmptyState from "./EmptyState";
import { Mail as PageIcon } from "lucide-react";

const PAGE_SIZE = 30;
const PANEL =
  "bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-clip";
// Sur PC, liste et lecture tiennent dans l'écran et défilent chacune.
const SPLIT =
  "md:grid md:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] gap-4 md:h-[calc(100svh-11rem)] md:min-h-[30rem]";

const isMobile = () => window.matchMedia("(max-width: 767px)").matches;

// Un seul écran d'attente, de la connexion Zimbra jusqu'à la liste.
const MailSkeleton = ({ label }) => (
  <div className={SPLIT} aria-busy="true">
    <div className={`${PANEL} flex flex-col`}>
      <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-500 flex items-center gap-2">
        <RefreshCw size={12} className="animate-spin text-primary" />
        {label}
      </p>
      <div className="animate-pulse">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="flex gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2 py-0.5">
              <div className="flex justify-between gap-4">
                <div className="h-3 w-1/3 rounded bg-gray-200" />
                <div className="h-3 w-10 rounded bg-gray-100" />
              </div>
              <div className="h-3 w-4/5 rounded bg-gray-200" />
              <div className="h-2.5 w-full rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className={`${PANEL} hidden md:block`} />
  </div>
);

const EmptyReader = ({ count }) => (
  <EmptyState
    bare
    className="h-full"
    icon={MailOpen}
    title="Choisis un mail à lire"
    description={`${count} message${count > 1 ? "s" : ""} dans ta boîte de réception`}
  />
);

const MailRow = ({ mail, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(mail)}
    aria-current={selected ? "true" : undefined}
    className={`w-full flex gap-3 px-3.5 py-3 text-left border-l-[3px] transition-colors ${
      selected
        ? "bg-primary/[0.07] border-primary"
        : "border-transparent hover:bg-gray-50"
    }`}
  >
    <MailAvatar author={mail.author} />
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline justify-between gap-3">
        <span
          className="text-sm font-semibold text-secondary truncate"
          title={mail.author}
        >
          {displayName(mail.author)}
        </span>
        <span
          className={`shrink-0 text-xs ${
            selected ? "text-primary font-semibold" : "text-gray-400"
          }`}
        >
          {formatShortDate(mail.pubDate)}
        </span>
      </span>
      <span className="block text-sm text-secondary/90 truncate">
        {mail.title || "(Sans objet)"}
      </span>
      {mail.description && (
        <span className="block text-xs text-gray-500 truncate mt-0.5">
          {mail.description}
        </span>
      )}
    </span>
  </button>
);

function Mail() {
  const { user } = useContext(UserContext);
  const account = user?.userName;
  const browserStorage = user?.ent_password_storage === "browser";
  const hasStoredPassword = user?.hasPassword;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStatus, setAuthStatus] = useState("pending");
  const [allMails, setAllMails] = useState([]);
  const [mailsLoaded, setMailsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState("");
  // undefined = pas encore chargé, "" = échec.
  const [mailContents, setMailContents] = useState({});
  const [selectedMail, setSelectedMail] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);
  const requestedRef = useRef(new Set());
  const temporaryCredentials = useRef(null);

  const acceptMails = useCallback((mails, message = "", credentials = null) => {
    temporaryCredentials.current = credentials ? { account, credentials } : null;
    setAllMails([...mails].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)));
    setMailsLoaded(true);
    setStatus(message);
    setIsAuthenticated(true);
    setAuthStatus("success");
  }, [account]);

  const readCredentials = useCallback(() => {
    if (temporaryCredentials.current && temporaryCredentials.current.account === account) {
      return Promise.resolve(temporaryCredentials.current.credentials);
    }
    return readBrowserEntCredentials(account);
  }, [account]);

  const promptCredentials = useCallback((message = "") => {
    temporaryCredentials.current = null;
    setIsAuthenticated(false);
    setAuthStatus("failure");
    setStatus(message);
  }, []);

  const fetchMails = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const credentials = browserStorage ? await readCredentials() : null;
      if (browserStorage && !credentials) {
        promptCredentials();
        return;
      }
      const response = browserStorage
        ? await fetchApi("/api/zimbra", { method: "POST", body: JSON.stringify(credentials) })
        : await fetchApi("/api/zimbra/mails");
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.mails)) {
        setAllMails(
          [...data.mails].sort(
            (a, b) => new Date(b.pubDate) - new Date(a.pubDate),
          ),
        );
        if (!temporaryCredentials.current) setStatus("");
        setIsAuthenticated(true);
        setAuthStatus("success");
      } else if (browserStorage && data.code === "ENT_CREDENTIALS_INVALID") {
        promptCredentials("Ton mot de passe ENT doit être ressaisi.");
      } else if (!browserStorage && data.code === "ENT_PASSWORD_REQUIRED") {
        window.location.reload();
      } else {
        if (browserStorage) setAuthStatus("failure");
        setStatus("Impossible de récupérer les mails.");
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des mails:", error);
      if (browserStorage) setAuthStatus("failure");
      setStatus("Erreur réseau lors de la récupération des mails.");
    } finally {
      setIsRefreshing(false);
      setMailsLoaded(true);
    }
  }, [browserStorage, promptCredentials, readCredentials]);

  const fetchMailContent = useCallback(async (mailId) => {
    if (requestedRef.current.has(mailId)) return;
    requestedRef.current.add(mailId);
    // Nouvel essai après un échec : on réaffiche le squelette.
    setMailContents((prev) =>
      prev[mailId] === "" ? { ...prev, [mailId]: undefined } : prev,
    );
    let content = "";
    try {
      const credentials = browserStorage ? await readCredentials() : null;
      if (browserStorage && !credentials) {
        setIsModalOpen(false);
        promptCredentials();
      }
      const response = browserStorage && !credentials ? null : await fetchApi(
        `/api/zimbra/mail/${encodeURIComponent(mailId)}`,
        browserStorage ? { method: "POST", body: JSON.stringify(credentials) } : {},
      );
      if (response?.ok) {
        const data = await response.json();
        content = data.content || "";
      } else if (browserStorage && response?.status === 401) {
        setIsModalOpen(false);
        promptCredentials("Ton mot de passe ENT doit être ressaisi.");
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du contenu:", error);
    }
    if (!content) requestedRef.current.delete(mailId); // réessayable
    setMailContents((prev) => ({ ...prev, [mailId]: content }));
  }, [browserStorage, promptCredentials, readCredentials]);

  // Authentification automatique avec le mot de passe ENT enregistré.
  useEffect(() => {
    if (browserStorage) {
      fetchMails();
      return;
    }
    if (!hasStoredPassword) {
      setAuthStatus("failure");
      return;
    }
    const autoAuthenticate = async () => {
      try {
        const authResponse = await fetchApi("/api/zimbra/auto-auth", {
          method: "POST",
        });
        const authData = await authResponse.json();
        if (authResponse.ok && authData.success) {
          acceptMails(authData.mails);
          return;
        }
        if (authData.code === "ENT_PASSWORD_REQUIRED") {
          window.location.reload();
          return;
        }
        if (authData.code === "ENT_CREDENTIALS_INVALID") {
          setStatus("Ton mot de passe ENT a changé. Merci de le ressaisir.");
        } else if (
          authData.code === "USER_KEY_MISSING" ||
          authData.code === "USER_KEY_INVALID"
        ) {
          setStatus(
            "Ta session locale doit être resynchronisée. Recharge la page ou reconnecte-toi.",
          );
        }
        setAuthStatus("failure");
      } catch (error) {
        console.error("Erreur d'authentification automatique:", error);
        setAuthStatus("failure");
      }
    };
    setAuthStatus("pending");
    autoAuthenticate();
  }, [acceptMails, browserStorage, fetchMails, hasStoredPassword]);

  const filteredMails = useMemo(
    () => allMails.filter((mail) => matchesQuery(mail, query)),
    [allMails, query],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  const groups = useMemo(() => {
    const result = [];
    filteredMails.slice(0, visibleCount).forEach((mail) => {
      const label = groupLabel(mail.pubDate);
      const last = result[result.length - 1];
      if (last?.label === label) last.mails.push(mail);
      else result.push({ label, mails: [mail] });
    });
    return result;
  }, [filteredMails, visibleCount]);

  const hasMore = visibleCount < filteredMails.length;

  // Affiche la suite quand on arrive en bas de la liste.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, groups]);

  const handleSelect = (mail) => {
    setSelectedMail(mail);
    fetchMailContent(mail.id);
    if (isMobile()) setIsModalOpen(true);
  };

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const selectedContent = selectedMail
    ? mailContents[selectedMail.id]
    : undefined;
  const selectedLoading = Boolean(selectedMail) && selectedContent === undefined;

  const needsPassword = !isAuthenticated && authStatus === "failure";
  const waitingLabel = !isAuthenticated
    ? "Connexion à ta boîte mail…"
    : "Récupération des mails…";

  let body;
  if (needsPassword) {
    body = (
      <PasswordGateModal background={<MailSkeleton label="" />}>
        <ZimbraAuth
          onAuthenticated={acceptMails}
          authStatus={authStatus}
        />
      </PasswordGateModal>
    );
  } else if (!isAuthenticated || !mailsLoaded) {
    body = <MailSkeleton label={waitingLabel} />;
  } else if (allMails.length === 0 && !status) {
    body = <EmptyState icon={Inbox} title="Boîte de réception vide" />;
  } else {
    body = (
      <div className={SPLIT}>
        <div className={`${PANEL} flex flex-col min-h-0`}>
          <div className="flex-1 min-h-0 md:overflow-y-auto overscroll-contain">
            {groups.length === 0 ? (
              <EmptyState
                bare
                icon={Search}
                title="Aucun résultat"
                description={`Aucun mail ne correspond à « ${query} ».`}
              />
            ) : (
              groups.map((group) => (
                <section key={group.label}>
                  <h3 className="sticky top-14 md:top-0 z-[1] px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50/95 backdrop-blur border-y border-gray-100">
                    {group.label}
                  </h3>
                  <div className="divide-y divide-gray-100">
                    {group.mails.map((mail) => (
                      <MailRow
                        key={mail.id}
                        mail={mail}
                        selected={selectedMail?.id === mail.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
            {hasMore && <div ref={sentinelRef} className="h-12" />}
          </div>
        </div>

        <div className={`${PANEL} hidden md:block min-h-0`}>
          {selectedMail ? (
            <motion.div
              key={selectedMail.id}
              className="h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.12 }}
            >
              <MailReader
                mail={selectedMail}
                content={selectedContent}
                loading={selectedLoading}
              />
            </motion.div>
          ) : (
            <EmptyReader count={allMails.length} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        icon={PageIcon}
        title="Mails"
        subtitle={
          isAuthenticated && mailsLoaded
            ? `${allMails.length} message${allMails.length > 1 ? "s" : ""} dans ta boîte de réception`
            : undefined
        }
        actions={
          isAuthenticated && mailsLoaded && allMails.length > 0 && (
          <div className="flex w-full sm:w-auto items-center gap-2">
            <label className="relative flex-1 sm:w-72">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un mail…"
                aria-label="Rechercher un mail"
                className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm shadow-sm focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-secondary"
                  aria-label="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={fetchMails}
              disabled={isRefreshing}
              className="shrink-0 rounded-full border border-gray-200 bg-white p-2.5 text-secondary shadow-sm hover:bg-gray-50 disabled:opacity-60"
              aria-label="Actualiser les mails"
              title="Actualiser"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
          )
        }
      />

      {status && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          <span>{status}</span>
          {isAuthenticated && (
            <button
              type="button"
              onClick={fetchMails}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {body}

      <AnimatePresence>
        {isModalOpen && selectedMail && (
          <MailModal
            mail={selectedMail}
            content={selectedContent}
            loading={selectedLoading}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Mail;
