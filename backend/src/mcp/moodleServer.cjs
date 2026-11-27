const { McpServer, ResourceTemplate } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");

const id = () => z.number().int().min(1).max(2147483647);
const index = () => z.number().int().min(0).max(10000).default(0);
const fileUri = (courseId, moduleId, fileIndex) => `moodle://courses/${courseId}/resources/${moduleId}/files/${fileIndex}`;

function createMoodleMcpServer({ moodleService, principal, profileId }) {
  if (!principal?.username || !principal?.userKey) throw new Error("MCP principal required");
  const server = new McpServer({ name: "centraliz-moodle", version: "0.2.0" });
  const call = (method, ...args) => moodleService[method](principal.username, principal.userKey, ...args);
  const safe = handler => async args => {
    try { return await handler(args); }
    catch (error) {
      const messages = {
        USER_KEY_INVALID: "Identifiants Centraliz à renouveler.",
        STORED_PASSWORD_NOT_FOUND: "Compte ENT à connecter dans Centraliz.",
        MOODLE_COURSE_NOT_ACCESSIBLE: "Cours non accessible avec ce compte.",
      };
      return { isError: true, content: [{ type: "text", text: messages[error.code] || "La requête Moodle a échoué. Consultez les logs backend [Moodle]." }] };
    }
  };
  const json = data => ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data });
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };

  if (profileId) server.registerTool('whoami', {
    description: 'Identifie le compte autorisé pour cette connexion Moodle.', inputSchema: {},
    outputSchema: { id: z.string() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { 'openai/profile': true },
  }, async () => json({ id: profileId }));

  server.registerTool("lister_mes_cours", {
    description: "Liste les cours Moodle du compte connecté. L’identité est imposée par le serveur.",
    inputSchema: {}, annotations,
  }, safe(async () => json({ courses: await call("listCourses") })));
  server.registerTool("lister_ressources_cours", {
    description: "Liste les sections et ressources d’un cours. Utiliser courseId extrait du lien du cours et moduleId de la ressource pour ses fichiers.",
    inputSchema: { courseId: id() }, annotations,
  }, safe(async ({ courseId }) => json({ sections: await call("listSections", courseId) })));
  server.registerTool("lister_fichiers_ressource", {
    description: "Liste les fichiers originaux d’une ressource Fichier ou Dossier Moodle. Renvoie fileIndex, nom et type MIME, sans extraire de texte.",
    inputSchema: { courseId: id(), moduleId: id() }, annotations,
  }, safe(async ({ courseId, moduleId }) => json({ files: await call("listFiles", courseId, moduleId) })));
  server.registerTool("recuperer_fichier", {
    description: "Récupère le fichier original (20 Mio maximum) sous forme de ressource MCP binaire encodée en base64. Aucun texte n’est extrait. Le client doit prendre en charge les blobs MCP pour enregistrer ou lire le fichier.",
    inputSchema: { courseId: id(), moduleId: id(), fileIndex: index() }, annotations,
  }, safe(async ({ courseId, moduleId, fileIndex }) => {
    const { blob, ...metadata } = await call("downloadFile", courseId, moduleId, fileIndex);
    return {
      structuredContent: metadata,
      content: [
        { type: "text", text: JSON.stringify(metadata) },
        { type: "resource", resource: { uri: fileUri(courseId, moduleId, fileIndex), mimeType: metadata.mimeType, blob } },
      ],
    };
  }));
  server.registerResource("fichier_moodle", new ResourceTemplate("moodle://courses/{courseId}/resources/{moduleId}/files/{fileIndex}", { list: undefined }), {
    description: "Fichier original autorisé pour le compte connecté, sans conversion.",
  }, async (uri, variables) => {
    const courseId = id().parse(Number(variables.courseId));
    const moduleId = id().parse(Number(variables.moduleId));
    const fileIndex = index().parse(Number(variables.fileIndex));
    try {
      const file = await call("downloadFile", courseId, moduleId, fileIndex);
      return { contents: [{ uri: uri.href, mimeType: file.mimeType, blob: file.blob }] };
    } catch { throw new Error("Fichier Moodle indisponible pour ce compte."); }
  });
  return server;
}

module.exports = { createMoodleMcpServer };
