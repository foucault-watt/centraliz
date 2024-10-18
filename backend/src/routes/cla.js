const express = require('express');
const router = express.Router();
const icalService = require('../services/claService');

router.get('/cla-data', async (req, res) => {
    try {
        const icalData = await icalService.fetchIcalData();
        res.send(icalData);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des données iCal' });
    }
});

module.exports = router;