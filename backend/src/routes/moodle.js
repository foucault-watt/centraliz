const express = require("express");
const { requireUserKey } = require("../middlewares/userKey");

module.exports = ({ authMiddleware, moodleService }) => {
  const router = express.Router();
  const handle = (operation) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      if (["sections", "files", "file"].includes(operation)) {
        if (!/^[1-9]\d{0,9}$/.test(req.params.courseId)) {
          return res.status(400).json({ error: "Identifiant de cours invalide", code: "COURSE_ID_INVALID" });
        }
        if (operation !== "sections") {
          if (!/^[1-9]\d{0,9}$/.test(req.params.moduleId)) return res.status(400).json({ error: "Ressource invalide" });
          const args = [req.session.user.userName, req.userKey, Number(req.params.courseId), Number(req.params.moduleId)];
          if (operation === "files") return res.json({ files: await moodleService.listFiles(...args) });
          const file = await moodleService.downloadFile(...args, req.body?.fileIndex ?? 0);
          res.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`);
          res.set("Content-Type", file.mimeType);
          return res.send(Buffer.from(file.blob, "base64"));
        }
        const sections = await moodleService.listSections(req.session.user.userName, req.userKey, Number(req.params.courseId));
        return res.json({ sections });
      }
      return res.json({ courses: await moodleService.listCourses(req.session.user.userName, req.userKey) });
    } catch (error) {
      // Keep the existing ENT recovery contract, without propagating arbitrary
      // collector errors, credentials, or browser diagnostics to the client.
      const recovery = {
        USER_KEY_INVALID: [401, "Clé utilisateur invalide", "relogin_sso"],
        USER_KEY_MISSING: [428, "Clé utilisateur manquante", "retry_with_local_key"],
        STORED_PASSWORD_NOT_FOUND: [404, "Connectez votre compte ENT dans Mails", "prompt_ent_password"],
        COURSE_ID_INVALID: [400, "Identifiant de cours invalide", null],
        MOODLE_COURSE_NOT_ACCESSIBLE: [403, "Ce cours n’est pas accessible avec votre compte Moodle.", null],
      }[error.code];
      if (recovery) return res.status(recovery[0]).json({ error: recovery[1], code: error.code, action: recovery[2] });
      return res.status(502).json({ error: operation !== "courses"
        ? "Impossible de récupérer les ressources de ce cours Moodle. Réessayez plus tard."
        : "Impossible de récupérer les cours Moodle. Vérifiez votre connexion ENT ou réessayez plus tard.", code: "MOODLE_COLLECTION_FAILED" });
    }
  };
  router.post("/courses", authMiddleware, requireUserKey, handle("courses"));
  router.post("/courses/:courseId/sections", authMiddleware, requireUserKey, handle("sections"));
  router.post("/courses/:courseId/resources/:moduleId/files", authMiddleware, requireUserKey, handle("files"));
  router.post("/courses/:courseId/resources/:moduleId/file", authMiddleware, requireUserKey, handle("file"));
  return router;
};
