const express = require("express");
const authMiddleware = require("../middlewares/auth");
const adminMiddleware = require("../middlewares/admin");
const analyticsService = require("../services/analyticsService");
const campaignService = require("../services/campaignService");

const router = express.Router();

router.get("/active", authMiddleware, async (req, res) => {
  try {
    const page = String(req.query.page || "/");
    const result = await campaignService.listActiveCampaigns(
      req.session.user.userName,
      page,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur GET /active:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du chargement des campagnes actives.",
    });
  }
});

router.post("/:id/impression", authMiddleware, async (req, res) => {
  try {
    const result = await campaignService.recordImpression(
      req.params.id,
      req.session.user.userName,
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur POST /:id/impression:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement de l'impression.",
    });
  }
});

router.post("/:id/dismiss", authMiddleware, async (req, res) => {
  try {
    const result = await campaignService.dismissCampaign(
      req.params.id,
      req.session.user.userName,
      Boolean(req.body?.hide_forever),
    );
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "campaign_dismissed",
        module: "campaigns",
        eventType: "interaction",
        isAutomatic: false,
        properties: {
          campaign_id: req.params.id,
          hide_forever: Boolean(req.body?.hide_forever),
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur POST /:id/dismiss:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors du dismiss de la campagne.",
    });
  }
});

router.post("/:id/respond", authMiddleware, async (req, res) => {
  try {
    const result = await campaignService.submitResponse(
      req.params.id,
      req.session.user.userName,
      req.body,
    );
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "campaign_responded",
        module: "campaigns",
        eventType: "conversion",
        isAutomatic: false,
        properties: {
          campaign_id: req.params.id,
          response_count: Array.isArray(req.body?.responses)
            ? req.body.responses.length
            : 0,
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur POST /:id/respond:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement de la réponse.",
    });
  }
});

router.get("/admin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const campaigns = await campaignService.listAdminCampaigns();
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error("[Campaigns] Erreur GET /admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération admin des campagnes.",
    });
  }
});

router.get("/admin/options", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const options = await campaignService.listTargetOptions();
    res.json({ success: true, options });
  } catch (error) {
    console.error("[Campaigns] Erreur GET /admin/options:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des options de ciblage.",
    });
  }
});

router.get("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const campaign = await campaignService.getAdminCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Campagne introuvable.",
      });
    }
    return res.json({ success: true, campaign });
  } catch (error) {
    console.error("[Campaigns] Erreur GET /admin/:id:", error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération de la campagne.",
    });
  }
});

router.post("/admin", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await campaignService.saveCampaign(
      req.body,
      req.session.user.userName,
    );
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "campaign_created",
        module: "campaigns",
        eventType: "admin",
        isAutomatic: false,
        properties: {
          type: req.body?.type,
          presentation: req.body?.presentation,
          placement: req.body?.placement,
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur POST /admin:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la création de la campagne.",
    });
  }
});

router.put("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await campaignService.saveCampaign(
      req.body,
      req.session.user.userName,
      req.params.id,
    );
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "campaign_updated",
        module: "campaigns",
        eventType: "admin",
        isAutomatic: false,
        properties: {
          campaign_id: req.params.id,
          status: req.body?.status,
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur PUT /admin/:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour de la campagne.",
    });
  }
});

router.post("/admin/:id/duplicate", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await campaignService.duplicateCampaign(
      req.params.id,
      req.session.user.userName,
    );
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "campaign_duplicated",
        module: "campaigns",
        eventType: "admin",
        isAutomatic: false,
        properties: {
          campaign_id: req.params.id,
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur POST /admin/:id/duplicate:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la duplication de la campagne.",
    });
  }
});

router.delete("/admin/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await campaignService.deleteCampaign(req.params.id);
    if (result.status < 400) {
      analyticsService.trackEvent({
        req,
        eventName: "campaign_deleted",
        module: "campaigns",
        eventType: "admin",
        isAutomatic: false,
        properties: {
          campaign_id: req.params.id,
        },
      });
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("[Campaigns] Erreur DELETE /admin/:id:", error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la suppression de la campagne.",
    });
  }
});

module.exports = router;
