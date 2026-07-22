import { Outlet } from "react-router-dom";
import { pagesConfig } from "../config/pages";
import Navigation from "./Navigation";

function Main() {
  return (
      <div className="w-100 overflow-hidden">
        <Navigation pagesConfig={pagesConfig} />
        <div>
          <Outlet />
        </div>
      </div>
  );
}

export default Main;
