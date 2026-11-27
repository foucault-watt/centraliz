import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";

function Main() {
  return (
      <div className="w-100 overflow-hidden">
        <Navigation />
        <div>
          <Outlet />
        </div>
      </div>
  );
}

export default Main;
