import React from "react";
import Header from "./Header";
import Navigation from "./Navigation";
import { pagesConfig } from "../config/pages";
import "./../styles/PageSection.scss";

const PageLayout = ({ children }) => {
  return (
    <div className="page-section" style={{ minHeight: "100vh", overflow: "hidden" }}>
      <Header />
      <Navigation pagesConfig={pagesConfig} />
      <div className="section-content">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
