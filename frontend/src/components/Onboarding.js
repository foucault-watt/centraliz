import { CalendarCheck, ChevronDown, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const Onboarding = ({ userName, onComplete }) => {
  const [icalLink, setIcalLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [openHelp, setOpenHelp] = useState(null);

  const toggleHelp = (helpKey) => {
    setOpenHelp((current) => (current === helpKey ? null : helpKey));
  };

  const handleSubmitLink = async (e) => {
    e.preventDefault();
    setLinkError("");

    try {
      const validationResponse = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/validate-ical`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icalLink }),
        }
      );

      const validationData = await validationResponse.json();
      if (!validationData.isValid) {
        setLinkError(
          "Ce lien ne semble pas valide. Vérifie que tu l'as bien copié !"
        );
        return;
      }

      await fetch(`${process.env.REACT_APP_URL_BACK}/api/save-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userName, icalLink }),
      });

      // Update session data after saving iCal link
      await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/auth/status`,
        {
          credentials: "include",
        }
      );

      onComplete();
    } catch (error) {
      setLinkError("Oups ! Une erreur s'est produite. Réessaie !");
    }
  };

  return (
    <div className="onboarding-overlay">
      <motion.div
        className="onboarding-content"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <motion.div
          className="onboarding-intro"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
        >
          <motion.div
            className="step-icon"
            aria-hidden="true"
            initial={{ rotate: -8, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <CalendarCheck size={34} />
          </motion.div>
          <p className="eyebrow">Dernier réglage</p>
          <h1>Ajoute ton emploi du temps</h1>
          <p>
            Centraliz a besoin de ton lien iCal Hyperplanning pour afficher ton
            planning dans l'app.
          </p>
        </motion.div>

        <motion.a
          href="https://planning.centralelille.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="hyperplanning-link"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.99 }}
        >
          <span>
            Ouvrir Hyperplanning
            <small>Nouvel onglet: copie le lien iCal, puis reviens ici.</small>
          </span>
          <ExternalLink size={18} />
        </motion.a>

        <div className="ical-help">
          <div className="help-accordion">
            <button
              type="button"
              className="help-summary"
              onClick={() => toggleHelp("desktop")}
              aria-expanded={openHelp === "desktop"}
            >
              <span>Je suis sur ordinateur</span>
              <motion.span
                animate={{ rotate: openHelp === "desktop" ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={18} />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {openHelp === "desktop" && (
                <motion.div
                  className="ical-help-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: "easeInOut" }}
                >
                  <section>
                    <h2>Recuperer le lien sur ordinateur</h2>
                    <div className="help-steps">
                      <p>
                        <span>1</span>
                        Ouvre Hyperplanning et connecte-toi.
                      </p>
                      <p>
                        <span>2</span>
                        Clique sur l'icone iCal en haut a droite.
                      </p>
                      <p>
                        <span>3</span>
                        Copie l'adresse du lien, puis colle-la ici.
                      </p>
                    </div>
                    <img
                      src="/ical-link-destock.png"
                      alt="Emplacement du lien iCal sur ordinateur"
                      loading="lazy"
                    />
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="help-accordion">
            <button
              type="button"
              className="help-summary"
              onClick={() => toggleHelp("mobile")}
              aria-expanded={openHelp === "mobile"}
            >
              <span>Je suis sur mobile</span>
              <motion.span
                animate={{ rotate: openHelp === "mobile" ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={18} />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {openHelp === "mobile" && (
                <motion.div
                  className="ical-help-content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: "easeInOut" }}
                >
                  <section>
                    <h2>Recuperer le lien sur mobile</h2>
                    <div className="help-steps">
                      <p>
                        <span>1</span>
                        Ouvre ton emploi du temps dans Hyperplanning.
                      </p>
                      <p>
                        <span>2</span>
                        Clique sur l'icone iCal en bas a droite.
                      </p>
                      <p>
                        <span>3</span>
                        Copie le lien, puis reviens dans Centraliz.
                      </p>
                    </div>
                    <img
                      src="/ical-link-mobile.png"
                      alt="Emplacement du lien iCal sur mobile"
                      loading="lazy"
                    />
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.form
          onSubmit={handleSubmitLink}
          className="onboarding-form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" }}
        >
          <label className="input-group">
            <span>Lien iCal</span>
            <input
              type="text"
              value={icalLink}
              onChange={(e) => setIcalLink(e.target.value)}
              placeholder="https://planning.centralelille.fr/..."
              required
            />
          </label>
          {linkError && <div className="error-message">{linkError}</div>}
          <motion.button
            type="submit"
            className="submit-button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
          >
            Valider et entrer
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default Onboarding;
