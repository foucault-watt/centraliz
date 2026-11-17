import Navigation from "./Navigation";

const PageLayout = ({ children, fullWidth = false }) => {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="app-main">
        <div
          className={`app-main-inner ${
            fullWidth ? "app-main-inner-full" : ""
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
