const express = require('express');
const router = express.Router();
const csvService = require('../services/csvService');
router.post('/download-csv', csvService.downloadCSV);
router.get('/csv-data', csvService.getCSVData);
module.exports = router;