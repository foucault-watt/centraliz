import React from "react";
import PageLayout from "./PageLayout";
import { Download } from "lucide-react";

const getInstallInstructions = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isFirefox = ua.toLowerCase().indexOf("firefox") > -1;
  const isChrome = /chrome/i.test(ua);
  const isAndroid = /android/i.test(ua);

  if (isIOS) {
    return "Sur iOS : Appuyez sur l'icône 'Partager' en bas de Safari, puis sélectionnez 'Sur l'écran d'accueil'";
  } else if (isAndroid && isChrome) {
    return "Sur Android : Appuyez sur les trois points en haut à droite, puis 'Ajouter à l'écran d'accueil'";
  } else if (isFirefox) {
    return "Sur Firefox : Appuyez sur les trois points dans la barre d'adresse, puis 'Installer l'application'";
  } else if (isSafari) {
    return "Sur Safari : Utilisez le menu 'Partager' puis 'Ajouter à l'écran d'accueil'";
  }
  return "Dans votre navigateur : Utilisez le menu (⋮) puis 'Installer l'application' ou 'Ajouter à l'écran d'accueil'";
};

const InstallationPage = () => {
  return (
    <PageLayout>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <Download className="mr-2" size={24} /> Installer l'application
        </h2>
        <p className="text-gray-700">{getInstallInstructions()}</p>
      </div>
    </PageLayout>
  );
};

export default InstallationPage;