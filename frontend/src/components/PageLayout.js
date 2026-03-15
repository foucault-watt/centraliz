import { pagesConfig } from "../config/pages";
import Navigation from "./Navigation";

const PageLayout = ({ children, fullWidth = false }) => {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <Navigation pagesConfig={pagesConfig} />
      <main className="flex-1 flex justify-center w-full mt-4 mb-20">
        <div
          className={`w-full ${fullWidth ? "max-w-none px-4 lg:px-6" : "max-w-6xl px-4"}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
