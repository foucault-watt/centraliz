const axios = require('axios');

const casBaseURL = 'https://cas.centralelille.fr';
const serviceURL = 'http://localhost:3001/auth/callback';

exports.login = (req, res) => {
    const loginUrl = `${casBaseURL}/login?service=${encodeURIComponent(serviceURL)}`;
    res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
    const { ticket } = req.query;
    if (!ticket) {
        return res.status(400).send('Erreur : ticket CAS manquant.');
    }

    try {
        const validateUrl = `${casBaseURL}/p3/serviceValidate?service=${encodeURIComponent(serviceURL)}&ticket=${ticket}`;
        const response = await axios.get(validateUrl);

        const usernameMatch = /<cas:user>(.*?)<\/cas:user>/.exec(response.data);
        const username = usernameMatch ? usernameMatch[1] : null;

        if (!username) {
            return res.status(401).send("Échec de l'authentification CAS.");
        }

        req.session.user = { username, casTicket: ticket };
        res.redirect('http://localhost:3000');
    } catch (error) {
        console.error('Erreur lors de la validation du ticket CAS:', error);
        res.status(500).send('Erreur lors de la validation CAS.');
    }
};