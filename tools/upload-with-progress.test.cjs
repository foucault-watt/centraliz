const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Writable } = require("node:stream");
const { uploadWithProgress, formatBytes } = require("./upload-with-progress.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "centraliz-upload-"));
  t.after(() => {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("centraliz-upload-")) throw new Error("Unsafe cleanup");
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, "games"));
  const files = [path.join(root, "index.html"), path.join(root, "games", "index.wasm")];
  files.forEach((file, index) => fs.writeFileSync(file, Buffer.alloc(index ? 1024 * 1024 : 10, index)));
  return { root, files };
}

test("reports acknowledged bytes and speed before a large file completes", async t => {
  const { root, files } = fixture(t);
  const updates = [], destinations = [];
  const sftp = {
    async mkdir() {},
    createWriteStream(destination) {
      destinations.push(destination);
      const stream = new Writable({
        write(chunk, encoding, callback) {
          setTimeout(() => { stream.bytesWritten += chunk.length; callback(); }, 5);
        },
      });
      stream.bytesWritten = 0;
      return stream;
    },
  };
  await uploadWithProgress({ sftp, localDir: root, remoteDir: "/site", files, intervalMs: 2, onProgress: update => updates.push(update) });
  assert(updates.some(u => u.uploadedBytes > 10 && u.uploadedBytes < u.totalBytes && u.bytesPerSecond > 0));
  assert.equal(updates.at(-1).uploadedBytes, 1048586);
  assert.equal(updates.at(-1).uploadedFiles, 2);
  assert(updates.every((u, i) => !i || u.uploadedBytes >= updates[i - 1].uploadedBytes));
  assert.deepEqual(destinations.sort(), ["/site/games/index.wasm", "/site/index.html"]);
});

test("propagates write failures and never reports successful completion", async t => {
  const { root, files } = fixture(t);
  const updates = [];
  const sftp = {
    async mkdir() {},
    createWriteStream() { return new Writable({ write(chunk, encoding, callback) { callback(new Error("write failed")); } }); },
  };
  await assert.rejects(uploadWithProgress({ sftp, localDir: root, remoteDir: "/site", files, onProgress: u => updates.push(u) }), /write failed/);
  assert(updates.every(u => u.uploadedFiles === 0));
});

test("handles an empty upload and formats readable numeric rates", async () => {
  const updates = [];
  await uploadWithProgress({ sftp: {}, localDir: ".", remoteDir: "/site", files: [], onProgress: u => updates.push(u) });
  assert.equal(updates.at(-1).totalBytes, 0);
  assert.equal(formatBytes(1500000), "1.5 Mo");
  assert.equal(formatBytes(500), "500 o");
});
