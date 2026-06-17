const express = require("express");
const router = express.Router();
const csvService = require("../services/csvService");
const authMiddleware = require("../middlewares/auth");
const { attachUserKey } = require("../middlewares/userKey");
router.post("/download-csv", authMiddleware, attachUserKey, csvService.downloadCSV);
router.get("/csv-data", authMiddleware, csvService.getCSVData);
module.exports = router;
