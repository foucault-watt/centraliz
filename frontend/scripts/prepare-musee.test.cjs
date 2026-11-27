const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepareMusee, existingMusee } = require("./prepare-musee.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "centraliz-musee-"));
  t.after(() => {
    const resolved = path.resolve(root);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("centraliz-musee-")) {
      throw new Error("Unsafe fixture cleanup");
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const frontendDir = path.join(root, "frontend");
  const sourceDir = path.join(root, "le-musee");
  const destination = path.join(frontendDir, "public/games/le-musee");
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, "stale.pck"), "stale");
  return { frontendDir, sourceDir, destination };
}

test("missing project disables the page and removes the previous game without calling Godot", t => {
  const f = fixture(t);
  assert.equal(prepareMusee({ ...f, exporter: () => assert.fail("must not export") }), false);
  assert.equal(fs.existsSync(f.destination), false);
});

test("present project is exported and only runtime files are copied", t => {
  const f = fixture(t);
  fs.mkdirSync(f.sourceDir, { recursive: true });
  fs.writeFileSync(path.join(f.sourceDir, "project.godot"), "project");
  let calls = 0;
  const exporter = sourceDir => {
    calls++;
    const output = path.join(sourceDir, "build/web");
    fs.mkdirSync(output, { recursive: true });
    for (const name of ["index.html", "index.js", "index.wasm", "index.pck", "index.png", "index.png.import"]) {
      fs.writeFileSync(path.join(output, name), name);
    }
  };
  assert.equal(prepareMusee({ ...f, exporter }), true);
  assert.equal(calls, 1);
  assert.deepEqual(fs.readdirSync(f.destination).sort(), [".htaccess", "index.html", "index.js", "index.pck", "index.png", "index.wasm"]);
});

test("each export gets versioned URLs so browsers cannot reuse an old game", t => {
  const f = fixture(t);
  fs.mkdirSync(f.sourceDir, { recursive: true });
  fs.writeFileSync(path.join(f.sourceDir, "project.godot"), "project");
  const exporter = pck => sourceDir => {
    const output = path.join(sourceDir, "build/web");
    fs.mkdirSync(output, { recursive: true });
    for (const name of ["index.js", "index.wasm"]) fs.writeFileSync(path.join(output, name), name);
    fs.writeFileSync(path.join(output, "index.pck"), pck);
    fs.writeFileSync(path.join(output, "index.html"),
      '<script src="index.js"></script><script>const GODOT_CONFIG = {"executable":"index","fileSizes":{"index.pck":3}};</script>');
  };
  const page = () => fs.readFileSync(path.join(f.destination, "index.html"), "utf8");
  prepareMusee({ ...f, exporter: exporter("old") });
  const first = page();
  const version = first.split("index.js?v=")[1].split('"')[0];
  assert.ok(first.includes(`"mainPack":"index.pck?v=${version}"`));
  assert.ok(first.includes(`"index.pck?v=${version}":3`), "the loading bar keeps the pack size");
  assert.match(fs.readFileSync(path.join(f.destination, ".htaccess"), "utf8"), /no-cache/);
  prepareMusee({ ...f, exporter: exporter("new") });
  assert.ok(!page().includes(version), "a new export changes the URLs");
});

test("export errors fail preparation instead of reusing stale assets", t => {
  const f = fixture(t);
  fs.mkdirSync(f.sourceDir, { recursive: true });
  fs.writeFileSync(path.join(f.sourceDir, "project.godot"), "project");
  assert.throws(() => prepareMusee({ ...f, exporter: () => { throw new Error("export failed"); } }), /export failed/);
  assert.equal(fs.existsSync(f.destination), false);
});

test("dev reuses a complete export and leaves it untouched", t => {
  const f = fixture(t);
  for (const name of ["index.html", "index.js", "index.wasm", "index.pck"]) fs.writeFileSync(path.join(f.destination, name), name);
  assert.equal(existingMusee({ frontendDir: f.frontendDir }), true);
  assert.equal(fs.readFileSync(path.join(f.destination, "stale.pck"), "utf8"), "stale");
});

test("dev without a complete export excludes the page and keeps the files", t => {
  const f = fixture(t);
  assert.equal(existingMusee({ frontendDir: f.frontendDir }), false);
  assert.equal(fs.existsSync(path.join(f.destination, "stale.pck")), true);
});

test("incomplete exports cannot enable the page", t => {
  const f = fixture(t);
  fs.mkdirSync(f.sourceDir, { recursive: true });
  fs.writeFileSync(path.join(f.sourceDir, "project.godot"), "project");
  assert.throws(() => prepareMusee({ ...f, exporter: () => {} }), /incomplet/);
});
