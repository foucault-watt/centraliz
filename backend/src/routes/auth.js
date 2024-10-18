const express = require("express");
const router = express.Router();
const casService = require("../services/casService");

router.get("/status", (req, res) => {
console.log(req.session.user);
  res.json({
    authenticated: !!req.session.user,
    user: req.session.user || null,
  });
});

router.get("/login", casService.login);
router.get("/callback", casService.callback);
module.exports = router;