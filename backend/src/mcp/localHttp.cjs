const express = require("express");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { createMoodleMcpServer } = require("./moodleServer.cjs");

function createLocalMcpApp({ moodleService, principal }) {
  const app = express();
  app.use((req, res, next) => {
    const host = (req.headers.host || "").split(":")[0];
    const remote = req.socket.remoteAddress;
    const allowedOrigins = new Set(["http://localhost:6274", "http://127.0.0.1:6274"]);
    if (!["localhost", "127.0.0.1"].includes(host)
      || !["127.0.0.1", "::ffff:127.0.0.1", "::1"].includes(remote)
      || (req.headers.origin && !allowedOrigins.has(req.headers.origin))) return res.sendStatus(403);
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.all("/mcp", async (req, res) => {
    const server = createMoodleMcpServer({ moodleService, principal });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
    }
  });
  return app;
}

module.exports = { createLocalMcpApp };
