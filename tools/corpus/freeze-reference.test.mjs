import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { freezeReference, hashBytes, parseArgs, readFrozenReference } from "./freeze-reference.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pg-freeze-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceDir = join(root, "source");
  const destDir = join(root, "reference");
  mkdirSync(sourceDir);
  writeFileSync(join(sourceDir, "README.md"), "Original source README\r\n");
  writeFileSync(join(sourceDir, "ncr_routes.json"), "[]\n");
  return { root, sourceDir, destDir, sourceId: "fixture", frozenAt: "2026-10-01T00:00:00Z" };
}
const metadata = (dir) => ["README.md", "SHA256SUMS.txt"].map((f) => readFileSync(join(dir, f)));

test("freeze is import-safe, repeatable and preserves source README and timestamp", (t) => {
  const f = fixture(t);
  assert.equal(freezeReference(f).created, true);
  const before = metadata(f.destDir);
  assert.equal(freezeReference({ ...f, frozenAt: "2030-01-01T00:00:00Z" }).created, false);
  assert.deepEqual(metadata(f.destDir), before);
  assert.equal(readFrozenReference(f.destDir).frozenAt, f.frozenAt);
  assert.deepEqual(readFileSync(join(f.destDir, "raw/README.md")), readFileSync(join(f.sourceDir, "README.md")));
  assert.deepEqual(readdirSync(f.destDir).sort(), ["README.md", "SHA256SUMS.txt", "raw"]);
});

test("missing ignored files are recreated without changing metadata", (t) => {
  const f = fixture(t);
  freezeReference(f);
  const before = metadata(f.destDir);
  rmSync(join(f.destDir, "raw"), { recursive: true });
  freezeReference(f);
  assert.deepEqual(metadata(f.destDir), before);
  assert.deepEqual(readFileSync(join(f.destDir, "raw/ncr_routes.json")), readFileSync(join(f.sourceDir, "ncr_routes.json")));
});

test("LF checkout recreates original CRLF bytes only when exact baseline hashes match", (t) => {
  const f = fixture(t);
  freezeReference(f);
  const before = metadata(f.destDir);
  const original = readFileSync(join(f.sourceDir, "README.md"));
  rmSync(join(f.destDir, "raw/README.md"));
  writeFileSync(join(f.sourceDir, "README.md"), original.toString("utf8").replace(/\r\n/g, "\n"));
  freezeReference(f);
  assert.deepEqual(readFileSync(join(f.destDir, "raw/README.md")), original);
  assert.deepEqual(metadata(f.destDir), before);
  // An existing frozen copy is exact-byte evidence and cannot be silently repaired.
  writeFileSync(join(f.destDir, "raw/README.md"), readFileSync(join(f.sourceDir, "README.md")));
  assert.throws(() => freezeReference(f), /drift/);
});

test("LF-only checkout cannot recreate an unrecoverable mixed-ending baseline", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.sourceDir, "README.md"), "one\r\ntwo\n");
  freezeReference(f);
  rmSync(join(f.destDir, "raw/README.md"));
  writeFileSync(join(f.sourceDir, "README.md"), "one\ntwo\n");
  assert.throws(() => freezeReference(f), /cannot reproduce/);
});

test("legacy checksum baseline is preserved and its overwritten source README is recreated", (t) => {
  const f = fixture(t);
  mkdirSync(f.destDir);
  const sums = readdirSync(f.sourceDir).sort().map((name) => {
    const h = hashBytes(readFileSync(join(f.sourceDir, name)), name);
    return `${h.sha256_lf}  ${name}  bytes=${h.bytes}  sha256_as_checked_out=${h.sha256}`;
  }).join("\n") + "\n";
  writeFileSync(join(f.destDir, "SHA256SUMS.txt"), sums);
  writeFileSync(join(f.destDir, "README.md"), `Frozen at: \`${f.frozenAt}\`\nWorking input path (unchanged): \`fixture/\`\n`);
  const before = metadata(f.destDir);
  assert.equal(freezeReference(f).legacy, true);
  assert.deepEqual(metadata(f.destDir), before);
  assert.deepEqual(readFileSync(join(f.destDir, "raw/README.md")), readFileSync(join(f.sourceDir, "README.md")));
  freezeReference(f);
  assert.deepEqual(metadata(f.destDir), before);
});

for (const kind of ["source drift", "missing source", "corrupt snapshot", "file set drift", "identity mismatch", "bad metadata"]) {
  test(`reject ${kind} before recreating missing files or changing metadata`, (t) => {
    const f = fixture(t);
    freezeReference(f);
    rmSync(join(f.destDir, "raw/README.md"));
    if (kind === "source drift") writeFileSync(join(f.sourceDir, "ncr_routes.json"), "[{}]\n");
    if (kind === "missing source") rmSync(join(f.sourceDir, "ncr_routes.json"));
    if (kind === "corrupt snapshot") writeFileSync(join(f.destDir, "raw/ncr_routes.json"), "corrupt");
    if (kind === "file set drift") writeFileSync(join(f.sourceDir, "extra.bin"), Buffer.from([1, 2]));
    if (kind === "identity mismatch") f.sourceId = "different";
    if (kind === "bad metadata") writeFileSync(join(f.destDir, "SHA256SUMS.txt"), "invalid\n");
    const before = metadata(f.destDir);
    assert.throws(() => freezeReference(f));
    assert.deepEqual(metadata(f.destDir), before);
    assert.equal(readdirSync(join(f.destDir, "raw")).includes("README.md"), false);
  });
}

test("LF digests are distinct from exact byte hashes; binary bytes are never decoded", (t) => {
  const f = fixture(t);
  const lf = hashBytes(Buffer.from("one\ntwo\n"), "a.txt");
  const crlf = hashBytes(Buffer.from("one\r\ntwo\r\n"), "a.txt");
  assert.equal(lf.sha256_lf, crlf.sha256_lf);
  assert.notEqual(lf.sha256, crlf.sha256);
  for (const [name, bytes] of [["opaque.bin", Buffer.from([0xff, 13, 10])], ["bad.txt", Buffer.from([0xff, 13, 10])], ["null.txt", Buffer.from([0, 13, 10])]]) {
    writeFileSync(join(f.sourceDir, name), bytes);
    assert.equal(hashBytes(bytes, name).sha256_lf, null);
  }
  const result = freezeReference(f);
  for (const file of result.files) assert.deepEqual(readFileSync(join(f.destDir, "raw", file.name)), readFileSync(join(f.sourceDir, file.name)));
});

test("CLI accepts isolated paths and fails closed on invalid flags", (t) => {
  const f = fixture(t);
  const run = (...args) => spawnSync(process.execPath, ["tools/corpus/freeze-reference.mjs", ...args], { encoding: "utf8" });
  assert.equal(run("--source", f.sourceDir, "--out", f.destDir, "--source-id", f.sourceId).status, 0);
  assert.equal(run("--bad").status, 1);
  assert.throws(() => parseArgs(["--out"]));
  assert.throws(() => freezeReference({ ...f, destDir: join(f.sourceDir, "nested") }));
});
