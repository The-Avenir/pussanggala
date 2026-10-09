#!/usr/bin/env node
// Committed immutable metadata; source bytes (including README) stay in ignored raw/.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TEXT = new Set([".md", ".txt", ".json", ".jsonl", ".csv", ".tsv"]);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const fail = (msg) => { throw new Error(msg); };
export function assertRegularFile(file) {
  if (!lstatSync(file).isFile()) fail("expected a regular file: " + file);
}
/** Exact bytes are authoritative; only known valid UTF-8 text has a separate LF hash. */
export function hashBytes(buf, name) {
  let sha256_lf = null;
  if (TEXT.has(path.extname(name).toLowerCase()) && !buf.includes(0)) {
    try {
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
      sha256_lf = sha(Buffer.from(text.replace(/\r\n/g, "\n")));
    } catch { /* Binary: never reinterpret its bytes. */ }
  }
  return { bytes: buf.length, sha256: sha(buf), sha256_lf };
}
function options(o) {
  return {
    sourceDir: path.resolve(o.sourceDir ?? path.join(ROOT, "howtogetthereph_dataset")),
    destDir: path.resolve(o.destDir ?? path.join(ROOT, "data/reference/howtogetthereph_dataset-precleaned")),
    sourceId: o.sourceId ?? "howtogetthereph_dataset",
  };
}
function filesAt(dir) {
  if (!lstatSync(dir).isDirectory()) fail("expected a regular directory");
  return readdirSync(dir).sort().map((name) => {
    if (/[\r\n]/.test(name)) fail("unsupported source filename");
    assertRegularFile(path.join(dir, name));
    return { name, ...hashBytes(readFileSync(path.join(dir, name)), name) };
  });
}
export function readFrozenReference(destDir) {
  for (const name of ["SHA256SUMS.txt", "README.md"]) assertRegularFile(path.join(destDir, name));
  const lines = readFileSync(path.join(destDir, "SHA256SUMS.txt"), "utf8").split(/\r?\n/).filter(Boolean);
  const readme = readFileSync(path.join(destDir, "README.md"), "utf8");
  const legacy = lines[0] !== "# frozen-reference-v2";
  const tick = String.fromCharCode(96);
  const sourceId = legacy
    ? readme.match(new RegExp("Working input path \\(unchanged\\): " + tick + "([^" + tick + "]+)/" + tick))?.[1]
    : JSON.parse(lines.find((l) => l.startsWith("# source-id: "))?.slice(13) ?? "null");
  const frozenAt = legacy
    ? readme.match(new RegExp("Frozen at: " + tick + "([^" + tick + "]+)" + tick))?.[1]
    : JSON.parse(lines.find((l) => l.startsWith("# frozen-at: "))?.slice(13) ?? "null");
  if (typeof sourceId !== "string" || !sourceId || !Number.isFinite(Date.parse(frozenAt))) fail("invalid reference identity/timestamp");
  const files = lines.filter((l) => !l.startsWith("#")).map((line) => {
    if (!legacy) return JSON.parse(line);
    const m = line.match(/^([a-f0-9]{64})  (.+)  bytes=(\d+)  sha256_as_checked_out=([a-f0-9]{64})$/);
    if (!m) fail("invalid legacy checksum");
    return { name: m[2], bytes: Number(m[3]), sha256: m[4], sha256_lf: m[1] };
  });
  const names = new Set();
  for (const f of files) {
    if (!f || typeof f.name !== "string" || !f.name || /[/\\\r\n]/.test(f.name) || [".", ".."].includes(f.name) || names.has(f.name)) fail("invalid/duplicate reference filename");
    if (!Number.isSafeInteger(f.bytes) || f.bytes < 0 || !/^[a-f0-9]{64}$/.test(f.sha256) || !(f.sha256_lf === null || /^[a-f0-9]{64}$/.test(f.sha256_lf))) fail("invalid reference digest");
    names.add(f.name);
  }
  if (!files.length) fail("empty frozen reference");
  return { sourceId, frozenAt, files, legacy };
}
function assertHash(file, expected) {
  assertRegularFile(file);
  const actual = hashBytes(readFileSync(file), expected.name);
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256 || actual.sha256_lf !== expected.sha256_lf) fail("reference byte/digest drift: " + expected.name);
}
/** Recover a Git LF/CRLF checkout only when it reproduces the original exact hash. */
export function readSnapshotBytes(file, expected) {
  assertRegularFile(file);
  const buf = readFileSync(file);
  const h = hashBytes(buf, expected.name);
  if (h.bytes === expected.bytes && h.sha256 === expected.sha256 && h.sha256_lf === expected.sha256_lf) return buf;
  if (expected.sha256_lf !== null && h.sha256_lf === expected.sha256_lf) {
    const lf = buf.toString("utf8").replace(/\r\n/g, "\n");
    for (const text of [lf, lf.replace(/\n/g, "\r\n")]) {
      const candidate = Buffer.from(text);
      if (candidate.length === expected.bytes && sha(candidate) === expected.sha256) return candidate;
    }
  }
  fail("reference source cannot reproduce frozen bytes: " + expected.name);
}
/** Validate all existing copies and source identity before recreation or publication. */
export function validateFrozenReference(o = {}) {
  const { sourceDir, destDir, sourceId } = options(o);
  if (!lstatSync(destDir).isDirectory()) fail("reference must be a regular directory");
  const baseline = readFrozenReference(destDir);
  if (baseline.sourceId !== sourceId) fail("frozen reference source identity mismatch");
  const names = filesAt(sourceDir).map((f) => f.name);
  if (JSON.stringify(names) !== JSON.stringify(baseline.files.map((f) => f.name).sort())) fail("frozen reference source file set drift");
  const rawDir = path.join(destDir, "raw");
  if (existsSync(rawDir)) {
    if (!lstatSync(rawDir).isDirectory()) fail("raw must be a regular directory");
    for (const name of readdirSync(rawDir)) if (!names.includes(name)) fail("unexpected frozen raw file");
  }
  for (const f of baseline.files) {
    readSnapshotBytes(path.join(sourceDir, f.name), f);
    if (existsSync(path.join(rawDir, f.name))) assertHash(path.join(rawDir, f.name), f);
    // The legacy README was overwritten with metadata, not preserved source bytes.
    if (baseline.legacy && !["README.md", "SHA256SUMS.txt"].includes(f.name) && existsSync(path.join(destDir, f.name))) assertHash(path.join(destDir, f.name), f);
  }
  return baseline;
}
export function freezeReference(o = {}) {
  const { sourceDir, destDir, sourceId } = options(o);
  if (typeof sourceId !== "string" || !sourceId || /[\r\n]/.test(sourceId)) fail("invalid source identity");
  const inside = (p) => !p || (!p.startsWith(".." + path.sep) && p !== ".." && !path.isAbsolute(p));
  if (inside(path.relative(sourceDir, destDir)) || inside(path.relative(destDir, sourceDir))) fail("source and reference directories must be separate");
  if (existsSync(destDir) && !lstatSync(destDir).isDirectory()) fail("reference must be a regular directory");
  if (existsSync(path.join(destDir, "SHA256SUMS.txt")) || existsSync(path.join(destDir, "README.md"))) {
    const baseline = validateFrozenReference({ sourceDir, destDir, sourceId });
    mkdirSync(path.join(destDir, "raw"), { recursive: true });
    for (const f of baseline.files) {
      const to = path.join(destDir, "raw", f.name);
      if (!existsSync(to)) {
        const buf = readSnapshotBytes(path.join(sourceDir, f.name), f);
        writeFileSync(to, buf, { flag: "wx" });
      }
    }
    return { ...baseline, destDir, created: false };
  }
  if (existsSync(destDir) && readdirSync(destDir).length) fail("refusing unrecognized reference contents");
  const files = filesAt(sourceDir);
  if (!files.length) fail("cannot freeze an empty source");
  const frozenAt = o.frozenAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(frozenAt))) fail("invalid freeze timestamp");
  mkdirSync(path.dirname(destDir), { recursive: true });
  const stage = mkdtempSync(path.join(path.dirname(destDir), ".reference-freeze-"));
  try {
    mkdirSync(path.join(stage, "raw"));
    for (const f of files) {
      const buf = readFileSync(path.join(sourceDir, f.name));
      if (sha(buf) !== f.sha256) fail("source changed during freeze");
      writeFileSync(path.join(stage, "raw", f.name), buf);
    }
    writeFileSync(path.join(stage, "SHA256SUMS.txt"), ["# frozen-reference-v2", "# source-id: " + JSON.stringify(sourceId), "# frozen-at: " + JSON.stringify(frozenAt), ...files.map((f) => JSON.stringify(f)), ""].join("\n"));
    writeFileSync(path.join(stage, "README.md"), [
      "# Frozen pre-cleaned reference", "", "- Frozen at: " + frozenAt, "- Source identity: " + sourceId, "",
      "Only this generated README and SHA256SUMS.txt are committed. Original files,",
      "including the source README, live under gitignored raw/ and may contain raw",
      "source wording. They are audit inputs, never shipped seed/runtime/training assets.", "",
      "sha256 and bytes describe exact original bytes. sha256_lf is a separate",
      "CRLF-to-LF digest for known valid UTF-8 text, or null for binary files.",
      "A Git LF/CRLF checkout is accepted only if the original exact hash/size can be",
      "reconstructed; LF equality alone never blesses snapshot drift.", "",
      "Run node tools/corpus/freeze-reference.mjs to verify or recreate missing ignored",
      "copies. Metadata, timestamp and existing copies are never overwritten.", "",
    ].join("\n"));
    if (existsSync(destDir)) rmSync(destDir); // Only the verified empty directory.
    renameSync(stage, destDir);
  } finally { rmSync(stage, { recursive: true, force: true }); }
  return { sourceId, frozenAt, files, legacy: false, destDir, created: true };
}
export function parseArgs(argv) {
  const o = {};
  const flags = { "--source": "sourceDir", "--out": "destDir", "--source-id": "sourceId" };
  for (let i = 0; i < argv.length; i++) {
    const key = flags[argv[i]];
    if (!key || !argv[i + 1] || argv[i + 1].startsWith("--")) fail("invalid argument: " + argv[i]);
    o[key] = argv[++i];
  }
  return o;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const r = freezeReference(parseArgs(process.argv.slice(2)));
    console.log("reference " + (r.created ? "frozen" : "verified") + ": " + r.destDir);
  } catch (e) { console.error("FREEZE FAILED: " + e.message); process.exitCode = 1; }
}
