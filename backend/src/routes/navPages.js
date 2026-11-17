const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const navPagesService = require("../services/navPagesService");

/**
 * GET /api/nav-pages
 * Pages de la navbar visibles pour la promo de l'utilisateur connecté.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const pages = await navPagesService.listForGroup(req.session.user.group);
    res.json({ success: true, pages });
  } catch (error) {
    console.error("[NavPages] Erreur de listing:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des pages" });
  }
});

/**
 * GET /api/nav-pages/admin
 * Configuration complète + promos disponibles.
 */
router.get("/admin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [pages, availablePromos] = await Promise.all([
      navPagesService.listAll(),
      navPagesService.listAvailablePromos(),
    ]);
    res.json({ success: true, pages, availablePromos, knownPageIds: navPagesService.KNOWN_PAGE_IDS });
  } catch (error) {
    console.error("[NavPages] Erreur de listing admin:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération de la configuration" });
  }
});

/**
 * PUT /api/nav-pages/admin/:id
 * Body: { isActive?, promos?: string[], displayOrder? }
 */
router.put("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, promos, displayOrder } = req.body;

    if (!navPagesService.KNOWN_PAGE_IDS.includes(id)) {
      return res.status(400).json({ success: false, error: "Page inconnue" });
    }
    if (promos !== undefined && (!Array.isArray(promos) || promos.some((p) => typeof p !== "string"))) {
      return res.status(400).json({ success: false, error: "Liste de promos invalide" });
    }
    if (displayOrder !== undefined && !Number.isInteger(displayOrder)) {
      return res.status(400).json({ success: false, error: "Ordre invalide" });
    }

    const page = await navPagesService.update(id, {
      isActive: isActive === undefined ? undefined : Boolean(isActive),
      promos,
      displayOrder,
    });
    res.json({ success: true, page });
  } catch (error) {
    console.error("[NavPages] Erreur de mise à jour:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour" });
  }
});

module.exports = router;
