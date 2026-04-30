const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const eventsService = require("../services/eventsService");

const router = express.Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Type de fichier non autorisé."));
  },
});

router.get("/schools", authMiddleware, (req, res) => {
  res.json({ success: true, schools: eventsService.ALLOWED_SCHOOLS });
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    if (req.query.association_slug) {
      const result = await eventsService.listAssociationEvents(
        req.session.user.userName,
        req.query.association_slug,
        limit,
      );
      return res.status(result.status).json(result.body);
    }

    const events = await eventsService.listUpcomingEvents(
      req.session.user.userName,
      limit,
    );
    return res.json({ success: true, events });
  } catch (error) {
    console.error("[Events] Erreur GET /:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des événements.",
    });
  }
});

router.get("/admin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 200;
    const result = await eventsService.listAdminEvents(
      req.session.user.userName,
      limit,
    );
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Events] Erreur GET /admin:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des événements admin.",
    });
  }
});

router.get(
  "/admin/associations",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await eventsService.listAdminAssociations(
        req.session.user.userName,
      );
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("[Events] Erreur GET /admin/associations:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la récupération des associations.",
      });
    }
  },
);

router.post(
  "/admin/associations",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await eventsService.createAssociation(
        req.session.user.userName,
        req.body,
      );
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("[Events] Erreur POST /admin/associations:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la création de l'association.",
      });
    }
  },
);

router.get("/association/:slug", authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const result = await eventsService.listAssociationEvents(
      req.session.user.userName,
      req.params.slug,
      limit,
    );
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Events] Erreur GET /association/:slug:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des événements d'association.",
    });
  }
});

router.post("/", authMiddleware, upload.single("photo"), async (req, res) => {
  try {
    const result = await eventsService.createEvent(
      req.session.user.userName,
      req.body,
      req.file,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Events] Erreur POST /:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la création de l'événement.",
    });
  }
});

router.post(
  "/association/:slug",
  authMiddleware,
  upload.single("photo"),
  async (req, res) => {
    try {
      const result = await eventsService.createEvent(
        req.session.user.userName,
        {
          ...req.body,
          association_slug: req.params.slug,
        },
        req.file,
      );
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error("[Events] Erreur POST /association/:slug:", error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la création de l'événement.",
      });
    }
  },
);

router.put("/:id", authMiddleware, upload.single("photo"), async (req, res) => {
  try {
    const result = await eventsService.updateEvent(
      req.session.user.userName,
      req.params.id,
      req.body,
      req.file,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Events] Erreur PUT /:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la modification de l'événement.",
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const result = await eventsService.deleteEvent(
      req.session.user.userName,
      req.params.id,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Events] Erreur DELETE /:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de l'événement.",
    });
  }
});

module.exports = router;
