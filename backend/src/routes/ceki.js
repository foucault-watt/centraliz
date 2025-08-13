const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const cekiService = require("../services/cekiService");
const authMiddleware = require("../middlewares/auth");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

console.log("Ceki routes loaded");


module.exports = router;
