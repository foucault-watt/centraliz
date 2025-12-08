const express = require("express");
const router = express.Router();
const csvService = require("../services/csvService");
const authMiddleware = require("../middlewares/auth");
router.post("/download-csv", authMiddleware, csvService.downloadCSV);
router.get("/csv-data", authMiddleware, csvService.getCSVData);
module.exports = router;
