import { Suspense, createContext, lazy, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BdsFloatingButton from "./components/BdsFloatingButton";
import Header from "./components/Header"; // Import Header
import LoginPage from "./components/LoginPage.jsx";
import PageLayout from "./components/PageLayout";
import CampaignRuntime from "./components/CampaignRuntime";
import EntBrowserMigration from "./components/EntBrowserMigration";
import SlideMenu from "./components/SlideMenu"; // Import SlideMenu
import { getSupportBdsInfo } from "./config/supportBds";
import {
  clearStoredUserSecretSalt,
  fetchApi,
  syncUserSecretSalt,
  getStoredUserSecretSalt,
} from "./utils/api";
import { applyBDSTheme } from "./utils/bdsTheme";
import { applyUserTheme } from "./utils/userTheme";

// Lazy load page components
const Notes = lazy(() => import("./components/NotesV2"));
const Calendars = lazy(() => import("./components/Calendars"));
const EventCreatePage = lazy(() => import("./components/EventCreatePage"));
const EventsHubPage = lazy(() => import("./components/EventsHubPage"));
const AssociationEventsPage = lazy(
  () => import("./components/AssociationEventsPage"),
);
const AdminEventsPage = lazy(() => import("./components/AdminEventsPage"));
const Communication = lazy(() => import("./components/Communication"));
const MoodleCourses = lazy(() => import("./components/MoodleCourses"));
const Bdi = lazy(() => import("./components/Bdi"));
const Links = lazy(() => import("./components/Links"));
const Bibli = lazy(() => import("./components/Bibli"));
const Cekilui = lazy(() => import("./components/Cekilui.jsx"));
const Pokemon = lazy(() => import("./components/Pokemon.jsx"));
const Musee = process.env.REACT_APP_MUSEE_ENABLED === "true"
  ? lazy(() => import("./components/Musee.jsx"))
  : null;
const HelpPage = lazy(() => import("./components/HelpPage.jsx"));
const FeedbackPage = lazy(() => import("./components/FeedbackPage.jsx"));
const LegalPage = lazy(() => import("./components/LegalPage.jsx"));
const BdsLanding = lazy(() => import("./components/BdsLanding.jsx"));
const AnalyticsAdminPage = lazy(() => import("./components/AnalyticsAdminPage.jsx"));
const CampaignsAdminPage = lazy(() => import("./components/CampaignsAdminPage.jsx"));
const ThemePaletteAdminPage = lazy(() => import("./components/ThemePaletteAdminPage.jsx"));
const NavPagesAdminPage = lazy(() => import("./components/NavPagesAdminPage.jsx"));
const ReglagesPage = lazy(() => import("./components/ReglagesPage.jsx"));

export const UserContext = createContext();

const App = () => {
  // Lien public à partager, sans compte ni menu. Dans l'app, le jeu est sur /le-musee.
  // Décidé une fois : un re-rendu ne doit jamais faire basculer une page ouverte.
  const [publicMusee] = useState(() => process.env.REACT_APP_MUSEE_ENABLED === "true" &&
    window.location.pathname.replace(/\/+$/, "") === "/musee");
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState(false); // State for SlideMenu

  const toggleSlideMenu = () => {
    setIsSlideMenuOpen(!isSlideMenuOpen);
  };

  const refreshAuthStatus = async () => {
    setIsLoading(true); // Afficher l'écran de chargement pendant le rafraîchissement
    try {
      const response = await fetchApi("/api/auth/status");
      const data = await response.json();
      setIsAuthenticated(data.authenticated);

      if (data.authenticated) {
        syncUserSecretSalt(data.user);
        // Le thème BDS (campagne élection) reste prioritaire sur la couleur
        // personnelle quand les deux sont présents.
        if (data.user && data.user.support_bds) {
          console.log("[App] Applying BDS theme:", data.user.support_bds);
          applyBDSTheme(data.user.support_bds);
        } else if (data.user && data.user.theme_color) {
          applyUserTheme(data.user.theme_color, data.user.theme_color_dark);
        }

        // has_mail_password vient directement de /api/auth/status, qui fait
        // maintenant lui-même l'appel que /api/zimbra/check faisait avant.
        setUser({ ...data.user, hasPassword: Boolean(data.user?.has_mail_password) });
      } else {
        clearStoredUserSecretSalt();
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      clearStoredUserSecretSalt();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!publicMusee) refreshAuthStatus();
  }, [publicMusee]);

  if (window.location.pathname.startsWith("/support/")) {
    return (
      <Suspense
        fallback={
          <div className="loading-container">
            <img
              src={"/logo-title.png"}
              className="logo-loading"
              alt="logo"
              rel="preload"
            />
            <span className="title-loading">
              <b>Centraliz</b>
            </span>
          </div>
        }
      >
        <BrowserRouter>
          <Routes>
            <Route path="/support/:supportKey" element={<BdsLanding />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    );
  }

  if (publicMusee) {
    return (
      <Suspense fallback={<p className="p-8">Chargement du Musée…</p>}>
        <main className="mx-auto max-w-7xl px-4 py-6"><Musee /></main>
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <img
          src={"/logo-title.png"}
          className="logo-loading"
          alt="logo"
          rel="preload"
        />
        <span className="title-loading">
          <b>Centraliz</b>
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {/* Les animations framer-motion suivent le réglage système « réduire les animations ». */}
      <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Header onMenuToggle={toggleSlideMenu} />{" "}
        {user?.userKeyMode === 'client' && !getStoredUserSecretSalt() && (
          <p role="alert" className="mx-4 mt-4 rounded-xl bg-amber-50 p-4 text-amber-950">
            Cet appareil ne possède pas ta clé personnelle ENT.{' '}
            <a className="underline" href="/api/mcp/oauth/consent/connections">Restaurer ma sauvegarde</a>
          </p>
        )}
        {/* Pass toggle function to Header */}
        <SlideMenu
          isOpen={isSlideMenuOpen}
          onClose={toggleSlideMenu}
          user={user}
        />{" "}
        {/* Pass state and toggle to SlideMenu */}
        <CampaignRuntime />
        <Suspense fallback={<div></div>}>
          <Routes>
            {process.env.REACT_APP_MUSEE_ENABLED === "true" && (
              <Route path="/le-musee" element={<PageLayout fullWidth><Musee /></PageLayout>} />
            )}
            <Route
              path="/"
              element={<Navigate to="/calendars" replace />}
            />
            <Route
              path="/notes"
              element={
                <PageLayout fullWidth>
                  <EntBrowserMigration user={user} onMigrated={refreshAuthStatus}>
                    <Notes />
                  </EntBrowserMigration>
                </PageLayout>
              }
            />
            <Route
              path="/calendars"
              element={
                <PageLayout>
                  <Calendars
                    user={user}
                    onIcalLinkSaved={refreshAuthStatus}
                    onThemeColorSaved={refreshAuthStatus}
                  />
                </PageLayout>
              }
            />
            <Route
              path="/events"
              element={
                <PageLayout>
                  <EventsHubPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/events/association/:associationSlug"
              element={
                <PageLayout>
                  <AssociationEventsPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/events/admin"
              element={
                <PageLayout>
                  <AdminEventsPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/events/create"
              element={
                <PageLayout>
                  <EventCreatePage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/communication"
              element={
                <PageLayout>
                  <EntBrowserMigration user={user} onMigrated={refreshAuthStatus}>
                    <Communication />
                  </EntBrowserMigration>
                </PageLayout>
              }
            />
            <Route path="/moodle" element={<PageLayout><MoodleCourses /></PageLayout>} />
            <Route
              path="/bdi"
              element={
                <PageLayout>
                  <Bdi />
                </PageLayout>
              }
            />
            <Route
              path="/links"
              element={
                <PageLayout>
                  <Links />
                </PageLayout>
              }
            />
            <Route
              path="/bibli"
              element={
                <PageLayout>
                  <Bibli user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/cekilui"
              element={
                <PageLayout>
                  <Cekilui />
                </PageLayout>
              }
            />
            <Route
              path="/pokemon"
              element={
                <PageLayout>
                  <Pokemon user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/help"
              element={
                <PageLayout>
                  <HelpPage />
                </PageLayout>
              }
            />
            <Route path="/install" element={<Navigate to="/help" replace />} />
            <Route
              path="/about"
              element={<Navigate to="/help" replace />}
            />
            <Route
              path="/feedback"
              element={
                <PageLayout>
                  <FeedbackPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/contact"
              element={<Navigate to="/help" replace />}
            />
            <Route
              path="/legal"
              element={
                <PageLayout>
                  <LegalPage />
                </PageLayout>
              }
            />
            <Route
              path="/analytics/admin/*"
              element={
                <PageLayout>
                  <AnalyticsAdminPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/campaigns/admin"
              element={
                <PageLayout fullWidth>
                  <CampaignsAdminPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/theme-palette/admin"
              element={
                <PageLayout fullWidth>
                  <ThemePaletteAdminPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/nav-pages/admin"
              element={
                <PageLayout>
                  <NavPagesAdminPage user={user} />
                </PageLayout>
              }
            />
            <Route
              path="/reglages"
              element={
                <PageLayout>
                  <ReglagesPage user={user} onUserRefresh={refreshAuthStatus} />
                </PageLayout>
              }
            />
          </Routes>
        </Suspense>
        {/* Bouton flottant BDS si l'utilisateur soutient une liste */}
        {user && user.support_bds && (
          <BdsFloatingButton
            bdsInfo={getSupportBdsInfo(user.support_bds)}
          />
        )}
      </BrowserRouter>
      </MotionConfig>
    </UserContext.Provider>
  );
};

export default App;
