const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveLocalPrincipal } = require("./localPrincipal.cjs");

function directory(rows) {
  return {
    findByUsername: async name => rows.find(row => row.username === name) || null,
    findByEntUsername: async name => rows.filter(row => row.ent_username === name),
  };
}

test("an ENT login resolves to the canonical Centraliz account before key derivation", async () => {
  const result = await resolveLocalPrincipal(" ent-alice ", {
    directory: directory([{ username: "cla-alice", ent_username: "ent-alice" }]),
    deriveUserKey: name => `derived-for:${name}`,
  });
  assert.deepEqual(result, { username: "cla-alice", userKey: "derived-for:cla-alice" });
});

test("canonical Centraliz logins still work", async () => {
  const result = await resolveLocalPrincipal("cla-alice", {
    directory: directory([{ username: "cla-alice", ent_username: "ent-alice" }]),
    deriveUserKey: name => name,
  });
  assert.equal(result.username, "cla-alice");
});

test("unknown and ambiguous accounts are rejected instead of selecting another user", async () => {
  const deriveUserKey = () => assert.fail("no key should be derived");
  await assert.rejects(resolveLocalPrincipal("unknown", { directory: directory([]), deriveUserKey }), { code: "MCP_ACCOUNT_NOT_FOUND" });
  await assert.rejects(resolveLocalPrincipal("shared", { directory: directory([
    { username: "a", ent_username: "shared" }, { username: "b", ent_username: "shared" },
  ]), deriveUserKey }), { code: "MCP_ACCOUNT_AMBIGUOUS" });
  await assert.rejects(resolveLocalPrincipal("alice", { directory: directory([
    { username: "alice", ent_username: "ent-alice" }, { username: "bob", ent_username: "alice" },
  ]), deriveUserKey }), { code: "MCP_ACCOUNT_AMBIGUOUS" });
});

test("a database failure is not reported as a missing ENT account", async () => {
  await assert.rejects(resolveLocalPrincipal("alice", {
    directory: { findByUsername: async () => { throw new Error("private database details"); } },
    deriveUserKey: () => assert.fail("no key should be derived"),
  }), error => error.code === "MCP_ACCOUNT_LOOKUP_FAILED" && !error.message.includes("private"));
});

test("an existing account without a linked ENT fails with a specific recovery message", async () => {
  await assert.rejects(resolveLocalPrincipal("alice", {
    directory: directory([{ username: "alice", ent_username: null }]), deriveUserKey: () => "unused",
  }), { code: "MCP_ENT_NOT_LINKED" });
});
