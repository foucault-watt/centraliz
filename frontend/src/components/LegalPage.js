import React from "react";
import { motion } from "framer-motion";
import PageLayout from "./PageLayout";
import { Scale } from "lucide-react";

const LegalPage = () => {
  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-4 bg-background-module rounded-lg shadow-lg"
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center text-text-primary">
          <Scale className="mr-2 text-primary" size={24} /> Mentions Légales
        </h2>
        <div className="space-y-4 text-text-secondary text-sm">
          <h3 className="text-lg font-semibold text-text-primary">1. Éditeur du site</h3>
          <p>
            Le site <strong>Centraliz</strong> est une initiative personnelle de
            Foucault Wattinne, étudiant à l'ITEEM (Centrale Lille).
          </p>
          <p>Adresse : Adresse disponible sur demande</p>
          <p>Email de contact : foucault.wattinne@iteem.centralelille.fr</p>

          <h3 className="text-lg font-semibold text-text-primary">2. Hébergeur du site</h3>
          <p>Le site est hébergé par Rézoléo</p>
          <p>Adresse : Résidence Léonard de Vinci, Avenue Paul Langevin, 59650, Villeneuve d'Ascq</p>
          <p>Email de contact : contact@rezoleo.fr</p>

          <h3 className="text-lg font-semibold text-text-primary">3. Objet du site</h3>
          <p>
            Le site Centraliz permet aux élèves de l'École Centrale de Lille de
            centraliser leurs informations académiques sur une interface unique.
            Il propose notamment :
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              L'accès à l'emploi du temps, aux notes et aux emails via le système
              de connexion SSO (Central Authentication Service - CAS) de l'école.
            </li>
            <li>
              Une interface simplifiée pour consulter les informations
              académiques.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-text-primary">4. Propriété intellectuelle</h3>
          <p>
            L'ensemble des contenus présents sur le site (textes, graphismes,
            logos, etc.) sont la propriété exclusive de leur auteur ou de l'École
            Centrale de Lille pour les données qu'elle fournit. Toute
            reproduction, modification ou diffusion sans autorisation préalable
            est interdite.
          </p>

          <h3 className="text-lg font-semibold text-text-primary">5. Protection des données personnelles</h3>
          <p>
            Conformément au Règlement Général sur la Protection des Données
            (RGPD), Centraliz collecte et traite des données personnelles de ses
            utilisateurs avec leur consentement explicite.
          </p>

          <h4 className="font-semibold text-text-primary">Données collectées :</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>Nom et prénom</li>
            <li>Adresse e-mail institutionnelle</li>
            <li>Date de naissance</li>
            <li>Identifiants de connexion CAS</li>
            <li>
              Mot de passe de messagerie (facultatif, stocké de manière chiffrée
              et inaccessible en clair)
            </li>
          </ul>

          <h4 className="font-semibold text-text-primary">Finalités du traitement :</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>Fournir l'accès aux services de Centraliz</li>
            <li>
              Faciliter la consultation des e-mails, emplois du temps et notes
            </li>
          </ul>

          <h4>Sécurité et confidentialité :</h4>
          <p>
            Les mots de passe de messagerie, lorsqu'ils sont fournis par
            l'utilisateur, sont stockés sous forme chiffrée et ne sont jamais
            accessibles en clair. L'administrateur du site ne peut pas récupérer
            ces mots de passe ni les utiliser à d'autres fins.
          </p>
          <p>
            Les données personnelles ne sont ni vendues, ni cédées à des tiers.
            Les utilisateurs peuvent demander la suppression de leurs données à
            tout moment en contactant l'éditeur.
          </p>

          <h3 className="text-lg font-semibold text-text-primary">6. Responsabilité</h3>
          <p>
            Centraliz est un outil personnel mis à disposition des étudiants, sans
            garantie expresse ou implicite quant à la fiabilité des informations
            affichées. L'éditeur ne peut être tenu responsable des erreurs,
            interruptions de service ou pertes de données.
          </p>

          <h3 className="text-lg font-semibold text-text-primary">7. Droits des utilisateurs</h3>
          <p>
            Conformément à la loi Informatique et Libertés et au RGPD, les
            utilisateurs disposent des droits suivants :
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Accès, modification et suppression de leurs données personnelles
            </li>
            <li>Opposition au traitement de leurs données</li>
            <li>Portabilité des données</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez :
            foucault.wattinne@iteem.centralelille.fr
          </p>

          <h3 className="text-lg font-semibold text-text-primary">8. Cookies</h3>
          <p>
            Le site Centraliz utilise des cookies à des fins fonctionnelles
            uniquement (authentification, session utilisateur). Aucun cookie
            publicitaire ou de suivi tiers n'est utilisé.
          </p>

          <h3 className="text-lg font-semibold text-text-primary">9. Modification des mentions légales</h3>
          <p>
            L'éditeur se réserve le droit de modifier ces mentions légales à tout
            moment. Les utilisateurs seront informés des modifications
            importantes.
          </p>

          <h3 className="text-lg font-semibold text-text-primary">10. Contact</h3>
          <p>
            Pour toute question concernant ces mentions légales, contactez :
            foucault.wattinne@iteem.centralelille.fr
          </p>
        </div>
      </motion.div>
    </PageLayout>
  );
};

export default LegalPage;