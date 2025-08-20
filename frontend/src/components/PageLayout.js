import Navigation from "./Navigation";
import { pagesConfig } from "../config/pages";

const PageLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <Navigation pagesConfig={pagesConfig} />
      <main className="flex-1 flex justify-center w-full mt-4 mb-20">
        <div className="w-full max-w-4xl px-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
