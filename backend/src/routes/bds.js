const express = require("express");
const router = express.Router();
const cookieParser = require("cookie-parser");
const supabase = require("../utils/supabaseClient");
const bdsWhitelist = require("../config/bdsWhitelist");
const analyticsService = require("../services/analyticsService");

router.use(cookieParser());

router.post("/track", async (req, res) => {
  const { supportKey } = req.body;

  if (!supportKey || !bdsWhitelist.includes(supportKey)) {
    return res.status(400).json({ error: "Invalid support key" });
  }

  analyticsService.trackEvent({
    req,
    eventName: "bds_referral_tracked",
    module: "bds",
    properties: {
      support_key: supportKey,
      authenticated: Boolean(req.session?.user?.userName),
    },
  });

  // Set the cookie
  res.cookie("bds_referral", supportKey, {
    httpOnly: true,
    secure: process.env.SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  // If user is already logged in, update the database immediately
  if (req.session && req.session.user && req.session.user.userName) {
    try {
      const { error } = await supabase
        .from("users")
        .update({ support_bds: supportKey })
        .eq("username", req.session.user.userName);

      if (error) {
        console.error("Error updating support_bds for logged in user:", error);
        // We still return success because the cookie is set, so it might work later?
        // Or we return partial success.
        // Let's assume if DB fails, we keep the cookie so it tries again later.
        return res.json({
          success: true,
          updated: false,
          message: "Cookie set, but DB update failed.",
        });
      }

      // If DB update successful, clear the cookie as it's no longer needed
      res.clearCookie("bds_referral");

      return res.json({ success: true, updated: true });
    } catch (err) {
      console.error("Exception updating support_bds:", err);
      return res.json({ success: true, updated: false });
    }
  }

  return res.json({ success: true, updated: false });
});

module.exports = router;
