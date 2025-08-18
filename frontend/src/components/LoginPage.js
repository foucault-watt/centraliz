import { motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  GitBranch,
  Heart,
  LogIn,
  Mail,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const LoginPage = () => {
  const [rememberMe, setRememberMe] = useState(true);
  const [modalType, setModalType] = useState(null); // 'legal' | 'privacy' | null

  // Contact email: prefer env var, fallback to reasonable default
  const contactEmail = "foucault.wattinne@iteem.centralelille.fr";

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setModalType(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const Modal = ({ title, children, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-[90%] max-w-lg bg-white rounded-lg shadow-xl p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-start justify-between">
          <h4 id="modal-title" className="text-lg font-semibold">
            {title}
          </h4>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 rounded"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-700">{children}</div>
      </motion.div>
    </div>
  );

  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_URL_BACK}/api/auth/login?remember=${rememberMe}`;
  };

  const features = [
    { icon: <Calendar size={20} />, text: "Calendriers unifiés" },
    { icon: <Mail size={20} />, text: "Accès aux mails Zimbra" },
    { icon: <BookOpen size={20} />, text: "Consultation des notes" },
    { icon: <Users size={20} />, text: "Prochaines soirées et événements" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background-light text-text-primary">
      {/* Section Gauche - Branding */}
      <div className="w-full lg:w-1/2 bg-primary-dark flex flex-col justify-center items-center p-8 lg:p-12 text-white text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <img
            src="/logo-title.png"
            alt="Centraliz Logo"
            className="w-48 h-48 mx-auto mb-6"
          />
        </motion.div>
        <motion.h1
          className="text-4xl md:text-5xl font-bold mb-4"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Centraliz
        </motion.h1>
        <motion.p
          className="text-lg md:text-xl max-w-md"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Votre espace numérique unifié pour les étudiants de Centrale Lille,
          ITEEM et ENSCL.
        </motion.p>
      </div>

      {/* Section Droite - Connexion */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md mx-auto"
        >
          <motion.h2
            variants={itemVariants}
            className="text-3xl font-bold text-secondary mb-2"
          >
            Bienvenue !
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-text-secondary mb-8"
          >
            Connectez-vous pour accéder à tous vos outils.
          </motion.p>

          <motion.button
            variants={itemVariants}
            onClick={handleLogin}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogIn size={28} className="mr-4" />
            Se connecter avec le CAS
          </motion.button>

          <motion.div
            variants={itemVariants}
            className="mt-6 flex items-center justify-center"
          >
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label
              htmlFor="remember"
              className="ml-3 text-md text-text-secondary cursor-pointer"
            >
              Se souvenir de moi
            </label>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-12 text-center">
            <h3 className="text-lg font-semibold text-secondary mb-4">
              Un seul portail pour tout gérer :
            </h3>
            <div className="grid grid-cols-2 gap-4 text-text-secondary">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 bg-gray-50 shadow-sm hover:shadow-md transition-shadow cursor-default"
                >
                  <div className="text-primary">{feature.icon}</div>
                  <span className="text-sm">{feature.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-10 text-center text-sm text-text-secondary"
          >
            <div className="flex items-center justify-center space-x-2">
              <Shield size={16} />
              <p>Connexion sécurisée via le portail de l'école.</p>
            </div>
            <a
              href="https://github.com/foucault-watt/centraliz"
              className="flex items-center justify-center space-x-2 mt-4 hover:text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitBranch size={16} />
              <span>Projet open-source, contribuez sur GitHub !</span>
            </a>
          </motion.div>
        </motion.div>
        <footer className="mt-auto pt-8 text-center text-sm text-text-secondary">
          <p className="flex items-center justify-center mb-2">
            <Heart size={14} className="mr-1.5 text-danger" />
            Développé avec passion pour la communauté de Centrale Lille.
          </p>
          <div className="flex justify-center items-center space-x-2">
            <button
              onClick={() => setModalType("legal")}
              className="hover:text-primary transition-colors"
            >
              Mentions légales
            </button>
            <span>•</span>
            <a
              href={`mailto:${contactEmail}`}
              className="hover:text-primary transition-colors"
            >
              Contact
            </a>
          </div>
        </footer>
        {modalType === "legal" && (
          <Modal title="Mentions légales" onClose={() => setModalType(null)}>
            <div className="space-y-3 text-xs text-gray-600 max-h-[60vh] overflow-y-auto p-1">
              <p>
                <strong>1. Éditeur du site</strong>
                <br />
                Le site Centraliz est une initiative personnelle de Foucault
                Wattinne, étudiant à l'ITEEM (Centrale Lille).
                <br />
                Adresse : Adresse disponible sur demande
                <br />
                Email de contact : foucault.wattinne@iteem.centralelille.fr
              </p>
              <p>
                <strong>2. Hébergeur du site</strong>
                <br />
                Le site est hébergé par Rézoléo
                <br />
                Adresse : Résidence Léonard de Vinci, Avenue Paul Langevin,
                59650, Villeneuve d'Ascq
                <br />
                Email de contact : contact@rezoleo.fr
              </p>
              <p>
                <strong>3. Objet du site</strong>
                <br />
                Le site Centraliz permet aux élèves de l'École Centrale de Lille
                de centraliser leurs informations académiques sur une interface
                unique. Il propose notamment :
                <br />- L'accès à l'emploi du temps, aux notes et aux emails via
                le système de connexion SSO (Central Authentication Service -
                CAS) de l'école.
                <br />- Une interface simplifiée pour consulter les informations
                académiques.
              </p>
              <p>
                <strong>4. Propriété intellectuelle</strong>
                <br />
                L'ensemble des contenus présents sur le site (textes,
                graphismes, logos, etc.) sont la propriété exclusive de leur
                auteur ou de l'École Centrale de Lille pour les données qu'elle
                fournit. Toute reproduction, modification ou diffusion sans
                autorisation préalable est interdite.
              </p>
              <p>
                <strong>5. Protection des données personnelles</strong>
                <br />
                Conformément au Règlement Général sur la Protection des Données
                (RGPD), Centraliz collecte et traite des données personnelles de
                ses utilisateurs avec leur consentement explicite.
                <br />
                <strong className="mt-2 block">Données collectées :</strong>
                - Nom et prénom
                <br />
                - Adresse e-mail institutionnelle
                <br />
                - Date de naissance
                <br />
                - Identifiants de connexion CAS
                <br />- Mot de passe de messagerie (facultatif, stocké de
                manière chiffrée et inaccessible en clair)
                <br />
                <strong className="mt-2 block">
                  Finalités du traitement :
                </strong>
                - Fournir l'accès aux services de Centraliz
                <br />- Faciliter la consultation des e-mails, emplois du temps
                et notes
                <br />
                <strong className="mt-2 block">
                  Sécurité et confidentialité :
                </strong>
                Les mots de passe de messagerie, lorsqu'ils sont fournis par
                l'utilisateur, sont stockés sous forme chiffrée et ne sont
                jamais accessibles en clair. L'administrateur du site ne peut
                pas récupérer ces mots de passe ni les utiliser à d'autres fins.
                Les données personnelles ne sont ni vendues, ni cédées à des
                tiers. Les utilisateurs peuvent demander la suppression de leurs
                données à tout moment en contactant l'éditeur.
              </p>
              <p>
                <strong>6. Responsabilité</strong>
                <br />
                Centraliz est un outil personnel mis à disposition des
                étudiants, sans garantie expresse ou implicite quant à la
                fiabilité des informations affichées. L'éditeur ne peut être
                tenu responsable des erreurs, interruptions de service ou pertes
                de données.
              </p>
              <p>
                <strong>7. Droits des utilisateurs</strong>
                <br />
                Conformément à la loi Informatique et Libertés et au RGPD, les
                utilisateurs disposent des droits suivants :<br />
                - Accès, modification et suppression de leurs données
                personnelles
                <br />
                - Opposition au traitement de leurs données
                <br />
                - Portabilité des données
                <br />
                Pour exercer ces droits, contactez :
                foucault.wattinne@iteem.centralelille.fr
              </p>
              <p>
                <strong>8. Cookies</strong>
                <br />
                Le site Centraliz utilise des cookies à des fins fonctionnelles.
              </p>
              <p>
                <strong>9. Jeu "Qui est-ce ?"</strong>
                <br />
                Le site propose un jeu consistant à deviner à qui appartiennent
                les photos des étudiants. Les photos utilisées sont celles
                fournies par les utilisateurs ou l'école. Elles sont stockées de
                manière sécurisée et ne sont utilisées que dans le cadre de ce
                jeu. Elles ne sont pas partagées ni réutilisées à d'autres fins.
              </p>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
