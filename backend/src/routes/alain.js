const express = require("express");
const router = express.Router();
const alainService = require("../services/alainService");

router.post("/chat", async (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  try {
    const response = await alainService.chat(
      req.body.message,
      req.session.user.userName
    );
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/limits", (req, res) => {
  if (!req.session?.user?.userName) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const canUseChat = alainService.checkUserLimit(req.session.user.userName);
  res.json({ canUseChat });
});

module.exports = router;
