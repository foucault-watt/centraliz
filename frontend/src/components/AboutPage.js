import React from "react";
import PageLayout from "./PageLayout";
import { Info } from "lucide-react";

const AboutPage = () => {
  return (
    <PageLayout>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <Info className="mr-2" size={24} /> À propos
        </h2>
        <p className="text-gray-700 mb-2">
          Centraliz est votre outil de productivité tout-en-un pour Iteemiens,
          Centraliens et Chimistes. Simplifiez votre organisation quotidienne
          en centralisant vos calendriers, notes et mails.
        </p>
        <p className="text-gray-600 text-sm">Version {process.env.REACT_APP_VERSION}</p>
      </div>
    </PageLayout>
  );
};

export default AboutPage;