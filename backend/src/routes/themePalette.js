const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const themePaletteService = require("../services/themePaletteService");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ICON_SIZE = 128;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Type de fichier non autorisé. Seuls JPG, PNG et WEBP sont acceptés."
        ),
        false
      );
    }
  },
});

const parseBoolean = (value, fallback) => {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === "1";
};

const processIcon = (buffer) =>
  sharp(buffer)
    .resize(ICON_SIZE, ICON_SIZE, { fit: "cover", position: "center" })
    .webp({ quality: 90 })
    .toBuffer();

/**
 * GET /api/theme-palette
 * Liste des entrées actives, pour le picker de couleur d'accent.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const entries = await themePaletteService.listActive();
    res.json({ success: true, entries });
  } catch (error) {
    console.error("[ThemePalette] Erreur de listing:", error);
    res
      .status(500)
      .json({ success: false, error: "Erreur lors de la récupération de la palette" });
  }
});

/**
 * GET /api/theme-palette/icon/:filename
 * Sert l'icône d'une association de la palette.
 */
router.get("/icon/:filename", authMiddleware, async (req, res) => {
  const fileName = req.params.filename;

  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    return res.status(400).json({ success: false, error: "Nom de fichier invalide" });
  }

  const filePath = path.join(themePaletteService.ICON_DIR, fileName);

  try {
    await fs.access(filePath);
  } catch (error) {
    return res.status(404).json({ success: false, error: "Icône non trouvée" });
  }

  const ext = path.extname(fileName).toLowerCase();
  let contentType = "image/webp";
  if (ext === ".png") contentType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(filePath);
});

/**
 * GET /api/theme-palette/admin
 * Liste complète (actives et inactives), réservée aux admins.
 */
router.get("/admin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const entries = await themePaletteService.listAll();
    res.json({ success: true, entries });
  } catch (error) {
    console.error("[ThemePalette] Erreur de listing admin:", error);
    res
      .status(500)
      .json({ success: false, error: "Erreur lors de la récupération de la palette" });
  }
});

/**
 * POST /api/theme-palette/admin
 * Crée une entrée de palette (association + couleur + icône optionnelle).
 */
router.post("/admin", authMiddleware, adminMiddleware, upload.single("icon"), async (req, res) => {
  try {
    const { name, colorPrimary, colorPrimaryDark, displayOrder, isActive } = req.body;

    if (!name || !colorPrimary || !HEX_COLOR_REGEX.test(colorPrimary)) {
      return res
        .status(400)
        .json({ success: false, error: "Nom et couleur principale (hex) requis" });
    }
    if (colorPrimaryDark && !HEX_COLOR_REGEX.test(colorPrimaryDark)) {
      return res.status(400).json({ success: false, error: "Couleur foncée invalide" });
    }

    let entry = await themePaletteService.create({
      name,
      colorPrimary,
      colorPrimaryDark: colorPrimaryDark || null,
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      isActive: parseBoolean(isActive, true),
    });

    if (req.file) {
      const buffer = await processIcon(req.file.buffer);
      const fileName = await themePaletteService.saveIconFile(buffer, "webp");
      entry = await themePaletteService.setIcon(entry.id, fileName);
    }

    res.json({ success: true, entry });
  } catch (error) {
    console.error("[ThemePalette] Erreur de création:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la création" });
  }
});

/**
 * PUT /api/theme-palette/admin/:id
 * Met à jour une entrée de palette (et son icône si fournie).
 */
router.put("/admin/:id", authMiddleware, adminMiddleware, upload.single("icon"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, colorPrimary, colorPrimaryDark, displayOrder, isActive, removeIcon } =
      req.body;

    if (colorPrimary && !HEX_COLOR_REGEX.test(colorPrimary)) {
      return res.status(400).json({ success: false, error: "Couleur principale invalide" });
    }
    if (colorPrimaryDark && !HEX_COLOR_REGEX.test(colorPrimaryDark)) {
      return res.status(400).json({ success: false, error: "Couleur foncée invalide" });
    }

    let entry = await themePaletteService.update(id, {
      name,
      colorPrimary,
      colorPrimaryDark,
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : undefined,
      isActive: isActive !== undefined ? parseBoolean(isActive) : undefined,
    });

    if (req.file) {
      const existing = await themePaletteService.getById(id);
      if (existing && existing.icon_filename) {
        await themePaletteService.deleteIconFile(existing.icon_filename);
      }
      const buffer = await processIcon(req.file.buffer);
      const fileName = await themePaletteService.saveIconFile(buffer, "webp");
      entry = await themePaletteService.setIcon(id, fileName);
    } else if (parseBoolean(removeIcon, false)) {
      const existing = await themePaletteService.getById(id);
      if (existing && existing.icon_filename) {
        await themePaletteService.deleteIconFile(existing.icon_filename);
      }
      entry = await themePaletteService.setIcon(id, null);
    }

    res.json({ success: true, entry });
  } catch (error) {
    console.error("[ThemePalette] Erreur de mise à jour:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour" });
  }
});

/**
 * DELETE /api/theme-palette/admin/:id
 */
router.delete("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await themePaletteService.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[ThemePalette] Erreur de suppression:", error);
    res.status(500).json({ success: false, error: "Erreur lors de la suppression" });
  }
});

module.exports = router;
