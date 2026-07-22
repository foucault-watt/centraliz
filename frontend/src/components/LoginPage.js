import { motion } from "framer-motion";
import {
  ArrowRight,
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
  const [modalType, setModalType] = useState(null); // 'legal' | 'privacy' | null
  const rememberMe = true;

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
    { icon: Calendar, text: "Calendriers" },
    { icon: Mail, text: "Mails" },
    { icon: Users, text: "Vie étudiante" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 14, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 170, damping: 20 },
    },
  };

  return (
    <div className="min-h-screen bg-background-light text-text-primary flex flex-col">
      <main className="flex-1 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center w-full max-w-6xl mx-auto px-5 py-8 md:px-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="min-w-0"
        >
          <div className="flex items-center gap-4">
            <img
              src="/logo-title.png"
              alt="Centraliz"
              className="h-20 w-20 object-contain"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Centraliz
              </p>
              <h1 className="text-3xl md:text-5xl font-black text-secondary leading-tight">
                Votre espace numérique unifié.
              </h1>
            </div>
          </div>

          <p className="mt-5 text-base md:text-xl text-gray-700 max-w-2xl leading-relaxed">
            Centraliz rassemble les outils utiles pour les étudiants de Centrale
            Lille, ITEEM et ENSCL. Connectez-vous avec CLA, puis retrouvez
            vos informations au même endroit.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {features.map((feature) => (
              <span
                key={feature.text}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-gray-200 px-3 py-2 text-sm font-semibold text-secondary shadow-sm"
              >
                <feature.icon className="text-primary" size={16} />
                {feature.text}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md mx-auto"
        >
          <motion.h2
            variants={itemVariants}
            className="text-2xl md:text-3xl font-bold text-secondary mb-2"
          >
            Connexion
          </motion.h2>
          <motion.p
            variants={itemVariants}
            className="text-text-secondary mb-6"
          >
            Accédez à l'application avec votre compte école.
          </motion.p>

          <motion.button
            variants={itemVariants}
            onClick={handleLogin}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 px-5 rounded-xl flex items-center justify-center gap-3 text-lg shadow-lg shadow-primary/20 transition-all duration-200"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogIn size={24} />
            Se connecter via CLA
            <ArrowRight size={20} />
          </motion.button>

          <motion.div
            variants={itemVariants}
            className="mt-4 flex items-start gap-2 text-sm text-text-secondary"
          >
            <Shield size={16} className="text-primary mt-0.5 shrink-0" />
            <p>Connexion sécurisée via le portail de l'école.</p>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-6 text-center text-sm text-text-secondary"
          >
            <a
              href="https://github.com/foucault-watt/centraliz"
              className="flex items-center justify-center space-x-2 mt-4 hover:text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitBranch size={16} />
              <span>Projet open-source sur GitHub</span>
            </a>
          </motion.div>
        </motion.div>
      </main>

      <footer className="px-4 pb-6 text-center text-sm text-text-secondary">
          <p className="flex items-center justify-center mb-2">
            <Heart size={14} className="mr-1.5 text-danger" />
            Fait pour la communauté de Centrale Lille.
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
                le système de connexion SSO (Centrale Lille Associations) de l'école.
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
                - Identifiants de connexion CLA
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
  );
};

export default LoginPage;
