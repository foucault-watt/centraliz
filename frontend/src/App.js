import { Suspense, createContext, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import BdsFloatingButton from "./components/BdsFloatingButton";
import Header from "./components/Header"; // Import Header
import LoginPage from "./components/LoginPage.js";
import Onboarding from "./components/Onboarding.js";
import PageLayout from "./components/PageLayout";
import ProductRouteTracker from "./components/ProductRouteTracker";
import SlideMenu from "./components/SlideMenu"; // Import SlideMenu
import { getSupportBdsInfo } from "./config/supportBds";
import { fetchApi } from "./utils/api";
import { applyBDSTheme } from "./utils/bdsTheme";

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
const Bdi = lazy(() => import("./components/Bdi"));
const Links = lazy(() => import("./components/Links"));
const Bibli = lazy(() => import("./components/Bibli"));
const Cekilui = lazy(() => import("./components/Cekilui.js"));
const HelpPage = lazy(() => import("./components/HelpPage.js"));
const FeedbackPage = lazy(() => import("./components/FeedbackPage.js"));
const LegalPage = lazy(() => import("./components/LegalPage.js"));
const BdsLanding = lazy(() => import("./components/BdsLanding.js"));
const AnalyticsAdminPage = lazy(() => import("./components/AnalyticsAdminPage.js"));

export const UserContext = createContext();

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
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
        console.log("[App] User authenticated:", data.user);
        // Appliquer le thème BDS si l'utilisateur en soutient un
        if (data.user && data.user.support_bds) {
          console.log("[App] Applying BDS theme:", data.user.support_bds);
          applyBDSTheme(data.user.support_bds);
        } else {
          console.log("[App] No support_bds found for user");
        }

        // Vérifier si un mot de passe Zimbra est stocké
        try {
          const zimbraResponse = await fetch(
            `${process.env.REACT_APP_URL_BACK}/api/zimbra/check`,
            { credentials: "include" },
          );
          const zimbraData = await zimbraResponse.json();
          setUser({ ...data.user, hasPassword: zimbraData.hasPassword });
        } catch (zimbraError) {
          console.warn("Could not check Zimbra password:", zimbraError);
          setUser({ ...data.user, hasPassword: false });
        }
        setNeedsOnboarding(!data.user.icalLink);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuthStatus();
  }, []);

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
      <BrowserRouter>
        {needsOnboarding ? (
          <Onboarding userName={user.userName} onComplete={refreshAuthStatus} />
        ) : (
          <>
            <Header onMenuToggle={toggleSlideMenu} />{" "}
            {/* Pass toggle function to Header */}
            <SlideMenu
              isOpen={isSlideMenuOpen}
              onClose={toggleSlideMenu}
              user={user}
            />{" "}
            {/* Pass state and toggle to SlideMenu */}
            <ProductRouteTracker />
            <Suspense fallback={<div></div>}>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/calendars" replace />}
                />
                <Route
                  path="/notes"
                  element={
                    <PageLayout fullWidth>
                      <Notes />
                    </PageLayout>
                  }
                />
                <Route
                  path="/calendars"
                  element={
                    <PageLayout>
                      <Calendars user={user} />
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
                      <Communication />
                    </PageLayout>
                  }
                />
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
                  path="/analytics/admin"
                  element={
                    <PageLayout>
                      <AnalyticsAdminPage user={user} />
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
          </>
        )}
      </BrowserRouter>
    </UserContext.Provider>
  );
};

export default App;
