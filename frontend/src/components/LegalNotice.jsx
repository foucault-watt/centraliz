import React from "react";

const LegalNotice = () => {
  return (
    <div className="legal-notice">
      <h2>MENTIONS LÉGALES DU SITE CENTRALIZ</h2>

      <section>
        <h3>1. Éditeur du site</h3>
        <p>
          Le site <strong>Centraliz</strong> est une initiative personnelle de
          Foucault Wattinne, étudiant à l'ITEEM (Centrale Lille).
        </p>
        <p>Adresse : Adresse disponible sur demande</p>
        <p>Email de contact : foucault.wattinne@iteem.centralelille.fr</p>
      </section>

      <section>
        <h3>2. Hébergeur du site</h3>
        <p>Le site est hébergé par Rézoléo</p>
        <p>Adresse : Résidence Léonard de Vinci, Avenue Paul Langevin, 59650, Villeneuve d'Ascq</p>
        <p>Email de contact : contact@rezoleo.fr</p>
      </section>

      <section>
        <h3>3. Objet du site</h3>
        <p>
          Le site Centraliz permet aux élèves de l'École Centrale de Lille de
          centraliser leurs informations académiques sur une interface unique.
          Il propose notamment :
        </p>
        <ul>
          <li>
            L'accès à l'emploi du temps, aux notes et aux emails via le système
            de connexion SSO (Central Authentication Service - CAS) de l'école.
          </li>
          <li>
            Une interface simplifiée pour consulter les informations
            académiques.
          </li>
        </ul>
      </section>

      <section>
        <h3>4. Propriété intellectuelle</h3>
        <p>
          L'ensemble des contenus présents sur le site (textes, graphismes,
          logos, etc.) sont la propriété exclusive de leur auteur ou de l'École
          Centrale de Lille pour les données qu'elle fournit. Toute
          reproduction, modification ou diffusion sans autorisation préalable
          est interdite.
        </p>
      </section>

      <section>
        <h3>5. Protection des données personnelles</h3>
        <p>
          Conformément au Règlement Général sur la Protection des Données
          (RGPD), Centraliz collecte et traite des données personnelles de ses
          utilisateurs avec leur consentement explicite.
        </p>

        <h4>Données collectées :</h4>
        <ul>
          <li>Nom et prénom</li>
          <li>Adresse e-mail institutionnelle</li>
          <li>Date de naissance</li>
          <li>Identifiants de connexion CAS</li>
          <li>
            Mot de passe de messagerie (facultatif, stocké de manière chiffrée
            et inaccessible en clair)
          </li>
        </ul>

        <h4>Finalités du traitement :</h4>
        <ul>
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
      </section>

      <section>
        <h3>6. Responsabilité</h3>
        <p>
          Centraliz est un outil personnel mis à disposition des étudiants, sans
          garantie expresse ou implicite quant à la fiabilité des informations
          affichées. L'éditeur ne peut être tenu responsable des erreurs,
          interruptions de service ou pertes de données.
        </p>
      </section>

      <section>
        <h3>7. Droits des utilisateurs</h3>
        <p>
          Conformément à la loi Informatique et Libertés et au RGPD, les
          utilisateurs disposent des droits suivants :
        </p>
        <ul>
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
      </section>

      <section>
        <h3>8. Cookies</h3>
        <p>
          Le site Centraliz utilise des cookies à des fins fonctionnelles
          uniquement (authentification, session utilisateur). Aucun cookie
          publicitaire ou de suivi tiers n'est utilisé.
        </p>
      </section>

      <section>
        <h3>9. Modification des mentions légales</h3>
        <p>
          L'éditeur se réserve le droit de modifier ces mentions légales à tout
          moment. Les utilisateurs seront informés des modifications
          importantes.
        </p>
      </section>

      <section>
        <h3>10. Contact</h3>
        <p>
          Pour toute question concernant ces mentions légales, contactez :
          foucault.wattinne@iteem.centralelille.fr
        </p>
      </section>
    </div>
  );
};

export default LegalNotice;
