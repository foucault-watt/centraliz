const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { createLocalMcpApp } = require("./localHttp.cjs");

test("MCP HTTP discovers tools and transfers exact original bytes for a server-bound account", { timeout: 15000 }, async t => {
  const bytes = Buffer.from("%PDF-1.7\nfixture-binary\x00\xff", "latin1");
  const calls = [];
  const file = { name: "cours.pdf", mimeType: "application/pdf", size: bytes.length, sha256: "fixture", blob: bytes.toString("base64") };
  const moodleService = {
    listCourses: async (...args) => { calls.push(args); return [{ name: "Maths", url: "https://moodle.centralelille.fr/course/view.php?id=12" }]; },
    listSections: async (...args) => { calls.push(args); return []; },
    listFiles: async (...args) => { calls.push(args); return [{ fileIndex: 0, name: "cours.pdf", mimeType: "application/pdf" }]; },
    downloadFile: async (...args) => { calls.push(args); return file; },
  };
  const { resolveLocalPrincipal } = require("./localPrincipal.cjs");
  const principal = await resolveLocalPrincipal("ent-alice", {
    directory: { findByUsername: async () => null,
      findByEntUsername: async () => [{ username: "alice", ent_username: "ent-alice" }] },
    deriveUserKey: username => { assert.equal(username, "alice"); return "private-key"; },
  });
  const app = createLocalMcpApp({ moodleService, principal });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  let client;
  t.after(async () => { await client?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
  client = new Client({ name: "test-client", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(url));
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 4);
  const courses = await client.callTool({ name: "lister_mes_cours", arguments: { username: "bob" } });
  assert.equal(courses.isError, undefined);
  assert.deepEqual(calls[0], ["alice", "private-key"]);
  const result = await client.callTool({ name: "recuperer_fichier", arguments: { courseId: 12, moduleId: 7 } });
  const resource = result.content.find(item => item.type === "resource").resource;
  assert.equal(resource.mimeType, "application/pdf");
  assert.deepEqual(Buffer.from(resource.blob, "base64"), bytes);
  assert.equal(JSON.stringify(result.structuredContent).includes("blob"), false);
  const read = await client.readResource({ uri: resource.uri });
  assert.deepEqual(Buffer.from(read.contents[0].blob, "base64"), bytes);
  assert.deepEqual(calls.at(-1), ["alice", "private-key", 12, 7, 0]);
  const invalid = await client.callTool({ name: "recuperer_fichier", arguments: { courseId: -1, moduleId: 7 } });
  assert.equal(invalid.isError, true);
  assert.equal((await fetch(url, { method: "POST", headers: { Origin: "https://evil.example" } })).status, 403);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const request = require("node:http").request(url, { method: "POST", headers: { Host: "evil.example" } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    request.on("error", reject); request.end();
  });
  assert.equal(wrongHostStatus, 403);
});

test("raw service errors never reach MCP clients", async t => {
  const { createMoodleMcpServer } = require("./moodleServer.cjs");
  const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");
  const server = createMoodleMcpServer({ principal: { username: "alice", userKey: "private" },
    moodleService: { listCourses: async () => { throw new Error("password=secret"); } } });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  t.after(() => Promise.all([client.close(), server.close()]));
  const result = await client.callTool({ name: "lister_mes_cours", arguments: {} });
  assert.equal(result.isError, true);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});
