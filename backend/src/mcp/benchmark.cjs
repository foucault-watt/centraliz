const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

async function main() {
  const client = new Client({ name: "centraliz-latency-benchmark", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3002/mcp")));
    console.log(JSON.stringify({ server: client.getServerVersion() }));
    for (let i = 0; i < 3; i++) {
      const started = performance.now();
      const result = await client.callTool({ name: "lister_mes_cours", arguments: {} }, undefined, { timeout: 180000 });
      console.log(JSON.stringify({ call: i + 1, durationMs: Math.round(performance.now() - started),
        isError: Boolean(result.isError), courseCount: result.structuredContent?.courses?.length }));
      if (result.isError) break;
    }
  } finally { await client.close(); }
}
main().catch(() => { console.error("Mesure impossible : vérifiez que le MCP local est démarré."); process.exitCode = 1; });
