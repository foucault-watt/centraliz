# Centraliz : La plateforme qui simplifie ta vie étudiante 🚀

## 🌟 Description

**Centraliz** est l’outil indispensable pour tous les étudiants de **Centrale Lille**, **ITEEM** et **ENSCL**. Plus besoin de jongler entre Hypperplanning, Web Aurion et le CLA ! Centraliz regroupe en un seul endroit les ressources dont tu as besoin pour t'organiser.

### 🎯 Que peux-tu faire avec Centraliz ?

- 📅 **Accès rapide aux calendriers de cours** : Parce que l'interface d'hypperplanning est bien moche.
- 🎉 **Agenda CLA des événements et soirées** : Pour ne rater plus aucun torchtôt.
- 📝 **Consultation des notes** : Uniquement si t'es à ITEEM sinon t'as sûrement pas de DS.
- 📧 **Affichage des emails Zimbra** : Ce serait dommage de rater un mail de l'admin.

Centraliz, le site indispensable pour que tu te concentres sur l’essentiel : apprendre et profiter de la vie étudiante. 🎓🎉

## 📱 PWA

Centraliz est maintenant une Progressive Web App (PWA). Tu peux l'installer sur ton appareil pour un accès rapide et une expérience utilisateur améliorée.

## ⚙️ Configuration backend (sessions)

Les sessions backend utilisent Redis et nécessitent une configuration par variables d’environnement (ne pas versionner de secrets) :

- `SESSION_SECRET` : secret de signature des sessions Express.
- `REDIS_URL` : URL de connexion Redis (ex: `redis://host:6379`).
- `URL_FRONT` : origine frontend autorisée en CORS.
- `URL_BACK` : URL backend utilisée pour le callback CAS.
- `SECURE` : `true` en HTTPS, sinon `false` (cookie de session).

Le serveur backend refuse de démarrer si `SESSION_SECRET` ou `REDIS_URL` est absent/invalide, ou si Redis est inaccessible.

## 👤 Auteur

- **Foucault Wattinne**  
  Étudiant à l’ITEEM, avec une passion pour la tech et l'innovation.

## 📬 Contact

Tu as des questions ou des idées pour améliorer Centraliz ? Fais-le moi savoir, je suis tout ouïe !

- ✉️ Email : [foucault.wattinne@iteem.centralelille.fr](mailto:foucault.wattinne@iteem.centralelille.fr)
- 📱 Messenger : [@foucaultwatt](https://m.me/fukowatt)
- 🔗 Projet sur GitHub : [Découvre le projet ici](https://github.com/foucault-watt/centraliz)

## 🔔 Nouveautés à venir

- 🔕 Notifications de nouveaux mails
- 📊 Historique et évolution des notes
- ⚙️ Widgets Android pour un accès encore plus rapide

---

_Rends-toi la vie à Centrale plus facile avec Centraliz !_
